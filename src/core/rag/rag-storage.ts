import type {
  JsonValue,
  KnowledgeClass,
  UpsertKnowledgeBaseRecordInput,
  Uuid,
} from "../../lib/db/repositories/types.ts";
import {
  RAG_EMBEDDING_DIMENSIONS,
  RAG_EMBEDDING_MODEL,
  buildRagEmbeddingInput,
  type RagEmbedding,
} from "../../services/openai/rag-embeddings.ts";
import type { RagChunk, RagCourse, RagKnowledgeClass } from "./types.ts";

export type RagCourseIds = Readonly<{
  data_analytics: Uuid;
  digital_marketing: Uuid;
  accounting: Uuid;
}>;

export type RagCourseLookup = (internalName: string) => Promise<{
  id: Uuid;
  internal_name: string;
} | null>;

export type RagStorageDependencies = Readonly<{
  getCourseByInternalName: RagCourseLookup;
  embedRagTexts: (texts: readonly string[]) => Promise<readonly RagEmbedding[]>;
  upsertKnowledgeBaseRecords: (
    records: readonly UpsertKnowledgeBaseRecordInput[],
  ) => Promise<readonly unknown[]>;
}>;

const COURSE_NAMES: readonly Exclude<RagCourse, "all" | null>[] = [
  "data_analytics",
  "digital_marketing",
  "accounting",
];

export function mapKnowledgeClassesToStorageClass(
  knowledgeClasses: readonly RagKnowledgeClass[],
): KnowledgeClass {
  if (knowledgeClasses.includes("tbd")) return "tbd";
  if (knowledgeClasses.includes("demo_explanatory")) return "demo_explanatory";
  if (knowledgeClasses.includes("business_locked")) return "business_locked";
  throw new Error("RAG chunk cannot be stored without a recognized knowledge class.");
}

export async function resolveRagCourseIds(
  chunks: readonly RagChunk[],
  getCourseByInternalName: RagCourseLookup,
): Promise<Partial<RagCourseIds>> {
  const required = new Set(chunks.map((chunk) => chunk.course).filter(
    (course): course is Exclude<RagCourse, "all" | null> => course !== null && course !== "all",
  ));
  const resolved: {
    data_analytics?: Uuid;
    digital_marketing?: Uuid;
    accounting?: Uuid;
  } = {};

  for (const internalName of COURSE_NAMES) {
    if (!required.has(internalName)) continue;
    const course = await getCourseByInternalName(internalName);
    if (course === null || course.internal_name !== internalName) {
      throw new Error(`Required RAG course could not be resolved: ${internalName}.`);
    }
    resolved[internalName] = course.id;
  }

  return resolved;
}

function courseIdFor(chunk: RagChunk, courseIds: Partial<RagCourseIds>): Uuid | null {
  if (chunk.course === null || chunk.course === "all") return null;
  const courseId = courseIds[chunk.course];
  if (courseId === undefined) {
    throw new Error(`RAG storage mapping is missing course ID: ${chunk.course}.`);
  }
  return courseId;
}

export function toPgVectorLiteral(vector: readonly number[]): string {
  return `[${vector.join(",")}]`;
}

function metadataFor(chunk: RagChunk): JsonValue {
  return {
    chunkId: chunk.chunkId,
    course: chunk.course,
    intents: [...chunk.intents],
    knowledgeClasses: [...chunk.knowledgeClasses],
    normalRetrievalEligible: chunk.normalRetrievalEligible,
    headingPath: [...chunk.metadata.headingPath],
    sourceSectionId: chunk.metadata.sourceSectionId,
    tags: [...chunk.metadata.tags],
    embeddingModel: RAG_EMBEDDING_MODEL,
    embeddingDimensions: RAG_EMBEDDING_DIMENSIONS,
  };
}

export function prepareRagStorageRecords(
  chunks: readonly RagChunk[],
  courseIds: Partial<RagCourseIds>,
  embeddings: readonly RagEmbedding[],
): UpsertKnowledgeBaseRecordInput[] {
  const eligible = chunks.filter((chunk) => chunk.normalRetrievalEligible);
  if (eligible.length !== embeddings.length) {
    throw new Error("RAG storage mapping requires one embedding for every eligible chunk.");
  }

  let embeddingIndex = 0;
  return chunks.map((chunk) => {
    const embedding = chunk.normalRetrievalEligible
      ? embeddings[embeddingIndex++]
      : null;
    if (embedding !== null && (
      embedding.model !== RAG_EMBEDDING_MODEL ||
      embedding.dimensions !== RAG_EMBEDDING_DIMENSIONS ||
      embedding.vector.length !== RAG_EMBEDDING_DIMENSIONS
    )) {
      throw new Error("RAG storage mapping received an invalid embedding contract.");
    }

    return {
      source_chunk_id: chunk.chunkId,
      course_id: courseIdFor(chunk, courseIds),
      category: chunk.category,
      intent: chunk.intents[0] ?? null,
      title: chunk.title,
      content: chunk.content,
      knowledge_class: mapKnowledgeClassesToStorageClass(chunk.knowledgeClasses),
      student_facing: chunk.studentFacing,
      metadata_json: metadataFor(chunk),
      embedding: embedding === null ? null : toPgVectorLiteral(embedding.vector),
      source_document: chunk.sourceDocument,
      source_section: chunk.sourceSection,
    };
  });
}

function validateRagStorageMappings(
  chunks: readonly RagChunk[],
  courseIds: Partial<RagCourseIds>,
): void {
  for (const chunk of chunks) {
    mapKnowledgeClassesToStorageClass(chunk.knowledgeClasses);
    courseIdFor(chunk, courseIds);
  }
}

/** Preflights all mappings and embeddings before one idempotent storage phase. */
export async function ingestRagChunksForStorage(
  chunks: readonly RagChunk[],
  dependencies: RagStorageDependencies,
): Promise<Readonly<{ total: number; eligible: number; excluded: number; stored: number }>> {
  const courseIds = await resolveRagCourseIds(chunks, dependencies.getCourseByInternalName);
  validateRagStorageMappings(chunks, courseIds);
  const eligibleChunks = chunks.filter((chunk) => chunk.normalRetrievalEligible);
  const embeddings = await dependencies.embedRagTexts(
    eligibleChunks.map(buildRagEmbeddingInput),
  );
  const records = prepareRagStorageRecords(chunks, courseIds, embeddings);
  const stored = await dependencies.upsertKnowledgeBaseRecords(records);

  if (stored.length !== records.length) {
    throw new Error("RAG storage upsert did not return every requested record.");
  }

  return {
    total: chunks.length,
    eligible: eligibleChunks.length,
    excluded: chunks.length - eligibleChunks.length,
    stored: stored.length,
  };
}
