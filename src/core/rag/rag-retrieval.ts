import type { TurnCourse } from "../types/turn-analysis.ts";
import type {
  KnowledgeBaseSimilarityMatch,
  JsonValue,
  Uuid,
} from "../../lib/db/repositories/types.ts";
import { getCourseByInternalName } from "../../lib/db/repositories/courses.ts";
import { searchKnowledgeBaseByCosineSimilarity } from "../../lib/db/repositories/knowledge-base.ts";
import {
  embedRagQuery,
  RAG_EMBEDDING_DIMENSIONS,
  RAG_EMBEDDING_MODEL,
  validateRagEmbeddingVector,
} from "../../services/openai/rag-embeddings.ts";

export const RAG_RETRIEVAL_MAX_RESULTS = 5 as const;
export const RAG_RETRIEVAL_MAX_COSINE_DISTANCE = 0.46 as const;

export type RagRetrievedMetadata = Readonly<{
  headingPath: readonly string[];
  sourceSectionId: string | null;
  tags: readonly string[];
  knowledgeClasses: readonly ("business_locked" | "demo_explanatory")[];
  normalRetrievalEligible: true;
}>;

export type RagRetrievedChunk = Readonly<{
  id: string;
  sourceChunkId: string;
  courseId: string | null;
  title: string;
  content: string;
  category: string | null;
  intent: string | null;
  knowledgeClass: "business_locked" | "demo_explanatory";
  studentFacing: true;
  sourceDocument: string | null;
  sourceSection: string | null;
  metadata: RagRetrievedMetadata;
  distance: number;
}>;

export type RagRetrievalResult = Readonly<{
  queryText: string;
  chunks: readonly RagRetrievedChunk[];
}>;

export type RagRetrievalDependencies = Readonly<{
  embedRagQuery: typeof embedRagQuery;
  getCourseByInternalName: typeof getCourseByInternalName;
  searchKnowledgeBaseByCosineSimilarity: typeof searchKnowledgeBaseByCosineSimilarity;
}>;

const defaultDependencies: RagRetrievalDependencies = {
  embedRagQuery,
  getCourseByInternalName,
  searchKnowledgeBaseByCosineSimilarity,
};

function stringArray(value: JsonValue | undefined): string[] | null {
  return Array.isArray(value) && value.every((item) => typeof item === "string")
    ? [...value]
    : null;
}

function metadataFor(match: KnowledgeBaseSimilarityMatch): RagRetrievedMetadata | null {
  const metadata = match.metadata_json;
  if (metadata === null || Array.isArray(metadata) || typeof metadata !== "object") return null;
  const value = metadata as Record<string, JsonValue>;
  const headingPath = stringArray(value.headingPath);
  const tags = stringArray(value.tags);
  const classes = stringArray(value.knowledgeClasses);
  const sourceSectionId = value.sourceSectionId;
  if (
    headingPath === null || tags === null || classes === null ||
    value.normalRetrievalEligible !== true ||
    (sourceSectionId !== null && typeof sourceSectionId !== "string") ||
    !classes.every((item) => item === "business_locked" || item === "demo_explanatory")
  ) return null;
  return {
    headingPath,
    sourceSectionId,
    tags,
    knowledgeClasses: classes as Array<"business_locked" | "demo_explanatory">,
    normalRetrievalEligible: true,
  };
}

function toRetrievedChunk(
  match: KnowledgeBaseSimilarityMatch,
  courseId: Uuid | null,
): RagRetrievedChunk | null {
  const metadata = metadataFor(match);
  if (
    metadata === null || match.student_facing !== true ||
    (match.knowledge_class !== "business_locked" && match.knowledge_class !== "demo_explanatory") ||
    !Number.isFinite(match.distance) || match.distance > RAG_RETRIEVAL_MAX_COSINE_DISTANCE ||
    (courseId === null ? match.course_id !== null : match.course_id !== null && match.course_id !== courseId)
  ) return null;
  return {
    id: match.id, sourceChunkId: match.source_chunk_id, courseId: match.course_id,
    title: match.title, content: match.content, category: match.category, intent: match.intent,
    knowledgeClass: match.knowledge_class, studentFacing: true,
    sourceDocument: match.source_document, sourceSection: match.source_section,
    metadata, distance: match.distance,
  };
}

/** Controlled M32 explanatory retrieval. It never merges RAG with structured truth. */
export async function retrieveRagKnowledge(
  input: Readonly<{ queryText: string; course: TurnCourse | null }>,
  overrides: Partial<RagRetrievalDependencies> = {},
): Promise<RagRetrievalResult> {
  const dependencies = { ...defaultDependencies, ...overrides };
  const course = input.course === null
    ? null
    : await dependencies.getCourseByInternalName(input.course);
  if (input.course !== null && (course === null || course.internal_name !== input.course)) {
    throw new Error(`RAG retrieval course could not be resolved: ${input.course}.`);
  }
  const embedding = await dependencies.embedRagQuery(input.queryText);
  const queryEmbedding = validateRagEmbeddingVector(embedding.vector);
  if (embedding.model !== RAG_EMBEDDING_MODEL || embedding.dimensions !== RAG_EMBEDDING_DIMENSIONS) {
    throw new Error("RAG retrieval received an invalid query embedding contract.");
  }
  const matches = await dependencies.searchKnowledgeBaseByCosineSimilarity({
    queryEmbedding, courseId: course?.id ?? null,
    maxDistance: RAG_RETRIEVAL_MAX_COSINE_DISTANCE, maxResults: RAG_RETRIEVAL_MAX_RESULTS,
  });
  const chunks = matches
    .map((match) => toRetrievedChunk(match, course?.id ?? null))
    .filter((chunk): chunk is RagRetrievedChunk => chunk !== null)
    .sort((left, right) => left.distance - right.distance || left.sourceChunkId.localeCompare(right.sourceChunkId))
    .slice(0, RAG_RETRIEVAL_MAX_RESULTS);
  return { queryText: input.queryText, chunks };
}
