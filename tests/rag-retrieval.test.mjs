import assert from "node:assert/strict";
import test from "node:test";

import {
  RAG_RETRIEVAL_MAX_COSINE_DISTANCE,
  RAG_RETRIEVAL_MAX_RESULTS,
  retrieveRagKnowledge,
} from "../src/core/rag/rag-retrieval.ts";
import {
  RAG_EMBEDDING_DIMENSIONS,
  RAG_EMBEDDING_MODEL,
} from "../src/services/openai/rag-embeddings.ts";

const vector = () => Array.from({ length: RAG_EMBEDDING_DIMENSIONS }, () => 0.2);
const courses = {
  data_analytics: { id: "course-da", internal_name: "data_analytics" },
  digital_marketing: { id: "course-dm", internal_name: "digital_marketing" },
  accounting: { id: "course-ac", internal_name: "accounting" },
};

function match(overrides = {}) {
  return {
    id: "row-da", source_chunk_id: "skillup-rag-v1-da-07", course_id: "course-da",
    title: "DA-07 — Power BI", content: "Power BI dashboards.", category: "course_topic",
    intent: "data_analytics", knowledge_class: "business_locked", student_facing: true,
    metadata_json: {
      headingPath: ["Data Analytics", "DA-07 — Power BI"], sourceSectionId: "DA-07",
      tags: ["data_analytics", "power_bi"], knowledgeClasses: ["business_locked"],
      normalRetrievalEligible: true,
    },
    source_document: "02_SkillUp_RAG_Deep_Course_Knowledge.md", source_section: "DA-07",
    distance: 0.3,
    ...overrides,
  };
}

function dependencies(overrides = {}) {
  return {
    embedRagQuery: async () => ({
      model: RAG_EMBEDDING_MODEL, dimensions: RAG_EMBEDDING_DIMENSIONS, vector: vector(),
    }),
    getCourseByInternalName: async (name) => courses[name] ?? null,
    searchKnowledgeBaseByCosineSimilarity: async () => [],
    ...overrides,
  };
}

test("locks M32 to the M31 model, dimensions, threshold, and max five results", () => {
  assert.equal(RAG_EMBEDDING_MODEL, "text-embedding-3-small");
  assert.equal(RAG_EMBEDDING_DIMENSIONS, 1536);
  assert.equal(RAG_RETRIEVAL_MAX_RESULTS, 5);
  assert.equal(RAG_RETRIEVAL_MAX_COSINE_DISTANCE, 0.46);
});

test("uses the trusted normalized-English query text unchanged", async () => {
  let received;
  const result = await retrieveRagKnowledge(
    { queryText: "What is Power BI?", course: "data_analytics" },
    dependencies({ embedRagQuery: async (text) => { received = text; return { model: RAG_EMBEDDING_MODEL, dimensions: 1536, vector: vector() }; } }),
  );
  assert.equal(received, "What is Power BI?");
  assert.equal(result.queryText, "What is Power BI?");
});

test("uses resolved course UUIDs rather than hard-coded UUIDs", async () => {
  let input;
  await retrieveRagKnowledge(
    { queryText: "Power BI", course: "data_analytics" },
    dependencies({ searchKnowledgeBaseByCosineSimilarity: async (value) => { input = value; return []; } }),
  );
  assert.equal(input.courseId, "course-da");
});

test("uses null course filtering without inventing a course", async () => {
  let input;
  await retrieveRagKnowledge(
    { queryText: "How does internship work?", course: null },
    dependencies({ searchKnowledgeBaseByCosineSimilarity: async (value) => { input = value; return []; } }),
  );
  assert.equal(input.courseId, null);
});

test("returns zero relevant chunks as successful retrieval", async () => {
  const result = await retrieveRagKnowledge(
    { queryText: "unrelated weather", course: null }, dependencies(),
  );
  assert.deepEqual(result.chunks, []);
});

test("returns fewer than three chunks without padding", async () => {
  const result = await retrieveRagKnowledge(
    { queryText: "Power BI", course: "data_analytics" },
    dependencies({ searchKnowledgeBaseByCosineSimilarity: async () => [match()] }),
  );
  assert.equal(result.chunks.length, 1);
});

test("caps normal retrieval at five chunks", async () => {
  const rows = Array.from({ length: 7 }, (_, index) => match({
    id: `row-${index}`, source_chunk_id: `chunk-${index}`, distance: 0.1 + index / 100,
  }));
  const result = await retrieveRagKnowledge(
    { queryText: "Power BI", course: "data_analytics" },
    dependencies({ searchKnowledgeBaseByCosineSimilarity: async () => rows }),
  );
  assert.equal(result.chunks.length, 5);
});

test("passes the explicit threshold and top-k limit to the repository boundary", async () => {
  let input;
  await retrieveRagKnowledge(
    { queryText: "Power BI", course: null },
    dependencies({ searchKnowledgeBaseByCosineSimilarity: async (value) => { input = value; return []; } }),
  );
  assert.equal(input.maxDistance, RAG_RETRIEVAL_MAX_COSINE_DISTANCE);
  assert.equal(input.maxResults, RAG_RETRIEVAL_MAX_RESULTS);
});

test("orders by cosine distance then stable source chunk ID", async () => {
  const result = await retrieveRagKnowledge(
    { queryText: "Power BI", course: "data_analytics" },
    dependencies({ searchKnowledgeBaseByCosineSimilarity: async () => [
      match({ source_chunk_id: "z", distance: 0.2 }), match({ source_chunk_id: "b", distance: 0.1 }),
      match({ source_chunk_id: "a", distance: 0.1 }),
    ] }),
  );
  assert.deepEqual(result.chunks.map((chunk) => chunk.sourceChunkId), ["a", "b", "z"]);
});

test("rejects TBD, non-student-facing, ineligible, and null-course-specific leakage from results", async () => {
  const result = await retrieveRagKnowledge(
    { queryText: "Power BI", course: "data_analytics" },
    dependencies({ searchKnowledgeBaseByCosineSimilarity: async () => [
      match({ knowledge_class: "tbd" }), match({ student_facing: false }),
      match({ metadata_json: { ...match().metadata_json, normalRetrievalEligible: false } }),
      match({ course_id: "course-dm" }), match(),
    ] }),
  );
  assert.deepEqual(result.chunks.map((chunk) => chunk.sourceChunkId), ["skillup-rag-v1-da-07"]);
});

test("drops malformed metadata and results beyond the configured relevance threshold", async () => {
  const result = await retrieveRagKnowledge(
    { queryText: "Power BI", course: "data_analytics" },
    dependencies({ searchKnowledgeBaseByCosineSimilarity: async () => [
      match({ metadata_json: {} }), match({ distance: RAG_RETRIEVAL_MAX_COSINE_DISTANCE + 0.01 }), match(),
    ] }),
  );
  assert.deepEqual(result.chunks.map((chunk) => chunk.sourceChunkId), ["skillup-rag-v1-da-07"]);
});

test("allows exact-course, all-course, and general chunks with a known course", async () => {
  const result = await retrieveRagKnowledge(
    { queryText: "Power BI", course: "data_analytics" },
    dependencies({ searchKnowledgeBaseByCosineSimilarity: async () => [
      match({ source_chunk_id: "exact", course_id: "course-da" }),
      match({ source_chunk_id: "all", course_id: null }), match({ source_chunk_id: "general", course_id: null }),
    ] }),
  );
  assert.deepEqual(result.chunks.map((chunk) => chunk.sourceChunkId), ["all", "exact", "general"]);
});

test("blocks all course-specific chunks when no canonical course is known", async () => {
  const result = await retrieveRagKnowledge(
    { queryText: "Internship", course: null },
    dependencies({ searchKnowledgeBaseByCosineSimilarity: async () => [match({ course_id: "course-da" }), match({ course_id: null })] }),
  );
  assert.deepEqual(result.chunks.map((chunk) => chunk.courseId), [null]);
});

test("marketing_analytics metadata never bypasses trusted course isolation", async () => {
  const result = await retrieveRagKnowledge(
    { queryText: "marketing analytics", course: "data_analytics" },
    dependencies({ searchKnowledgeBaseByCosineSimilarity: async () => [
      match({ course_id: "course-dm", metadata_json: { ...match().metadata_json, tags: ["marketing_analytics"] } }),
    ] }),
  );
  assert.deepEqual(result.chunks, []);
});

test("keeps course metadata as the authoritative isolation signal, not tags or intent", async () => {
  const result = await retrieveRagKnowledge(
    { queryText: "Power BI", course: "data_analytics" },
    dependencies({ searchKnowledgeBaseByCosineSimilarity: async () => [
      match({ course_id: "course-dm", intent: "data_analytics", metadata_json: { ...match().metadata_json, tags: ["data_analytics"] } }),
    ] }),
  );
  assert.deepEqual(result.chunks, []);
});

test("rejects a malformed or wrong-contract query embedding", async () => {
  await assert.rejects(
    () => retrieveRagKnowledge({ queryText: "Power BI", course: null }, dependencies({
      embedRagQuery: async () => ({ model: RAG_EMBEDDING_MODEL, dimensions: 1536, vector: [1] }),
    })), /1536/,
  );
  await assert.rejects(
    () => retrieveRagKnowledge({ queryText: "Power BI", course: null }, dependencies({
      embedRagQuery: async () => ({ model: "other", dimensions: 1536, vector: vector() }),
    })), /invalid query embedding contract/,
  );
});

test("course resolution and provider/database failures remain failures, not empty retrieval", async () => {
  await assert.rejects(
    () => retrieveRagKnowledge({ queryText: "Power BI", course: "data_analytics" }, dependencies({ getCourseByInternalName: async () => null })),
    /course could not be resolved/,
  );
  await assert.rejects(
    () => retrieveRagKnowledge({ queryText: "Power BI", course: null }, dependencies({ embedRagQuery: async () => { throw new Error("provider failed"); } })),
    /provider failed/,
  );
  await assert.rejects(
    () => retrieveRagKnowledge({ queryText: "Power BI", course: null }, dependencies({ searchKnowledgeBaseByCosineSimilarity: async () => { throw new Error("database failed"); } })),
    /database failed/,
  );
});

test("normal results expose no vector and no M33 merge or generated answer", async () => {
  const result = await retrieveRagKnowledge(
    { queryText: "Power BI", course: "data_analytics" },
    dependencies({ searchKnowledgeBaseByCosineSimilarity: async () => [match()] }),
  );
  assert.equal("embedding" in result.chunks[0], false);
  assert.equal("answer" in result, false);
  assert.equal("structuredFacts" in result, false);
});

test("does not mutate query inputs or returned repository rows", async () => {
  const input = Object.freeze({ queryText: "Power BI", course: "data_analytics" });
  const row = match();
  const before = structuredClone(row);
  await retrieveRagKnowledge(input, dependencies({ searchKnowledgeBaseByCosineSimilarity: async () => [row] }));
  assert.deepEqual(row, before);
});
