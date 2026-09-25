import assert from "node:assert/strict";
import test from "node:test";

import {
  RAG_EMBEDDING_BATCH_SIZE,
  RAG_EMBEDDING_DIMENSIONS,
  RAG_EMBEDDING_MODEL,
  buildRagEmbeddingInput,
  embedRagTexts,
  validateRagEmbeddingVector,
} from "../src/services/openai/rag-embeddings.ts";
import {
  ingestRagChunksForStorage,
  mapKnowledgeClassesToStorageClass,
  prepareRagStorageRecords,
  resolveRagCourseIds,
} from "../src/core/rag/rag-storage.ts";
import { upsertKnowledgeBaseRecords } from "../src/lib/db/repositories/knowledge-base.ts";

const vector = (value = 0.25) => Array.from(
  { length: RAG_EMBEDDING_DIMENSIONS },
  () => value,
);

function chunk(overrides = {}) {
  return {
    chunkId: "skillup-rag-v1-da-07",
    title: "DA-07 — Power BI",
    content: "Source-derived Power BI content.",
    course: "data_analytics",
    category: "course_topic",
    intents: ["data_analytics", "power_bi"],
    knowledgeClasses: ["business_locked"],
    studentFacing: true,
    sourceDocument: "02_SkillUp_RAG_Deep_Course_Knowledge.md",
    sourceSection: "DA-07",
    metadata: {
      headingPath: ["Data Analytics", "DA-07 — Power BI"],
      sourceSectionId: "DA-07",
      tags: ["data_analytics", "power_bi"],
    },
    normalRetrievalEligible: true,
    ...overrides,
  };
}

const courseIds = {
  data_analytics: "course-da",
  digital_marketing: "course-dm",
  accounting: "course-ac",
};

test("locks the approved OpenAI embedding model and dimension", () => {
  assert.equal(RAG_EMBEDDING_MODEL, "text-embedding-3-small");
  assert.equal(RAG_EMBEDDING_DIMENSIONS, 1536);
  assert.equal(RAG_EMBEDDING_BATCH_SIZE, 25);
});

test("embedding input is stable semantic title plus content only", () => {
  assert.equal(
    buildRagEmbeddingInput(chunk()),
    "DA-07 — Power BI\nSource-derived Power BI content.",
  );
});

test("embedding batches are deterministic and sequential", async () => {
  const calls = [];
  const texts = Array.from({ length: 26 }, (_, index) => `text-${index}`);
  const client = {
    embeddings: {
      create: async ({ input }) => {
        calls.push([...input]);
        return {
          data: input.map((_, index) => ({ index, embedding: vector(index) })),
        };
      },
    },
  };
  const result = await embedRagTexts(texts, client);
  assert.deepEqual(calls.map((call) => call.length), [25, 1]);
  assert.equal(result.length, 26);
  assert.equal(result[25].vector[0], 0);
});

test("malformed vector dimensions fail before storage", () => {
  assert.throws(() => validateRagEmbeddingVector([1, 2]), /expected 1536/);
});

test("NaN and infinite embedding dimensions fail before storage", () => {
  const nan = vector();
  nan[4] = Number.NaN;
  const infinity = vector();
  infinity[8] = Number.POSITIVE_INFINITY;
  assert.throws(() => validateRagEmbeddingVector(nan), /finite number/);
  assert.throws(() => validateRagEmbeddingVector(infinity), /finite number/);
});

test("eligible chunks receive one validated embedding", () => {
  const records = prepareRagStorageRecords(
    [chunk()],
    courseIds,
    [{ model: RAG_EMBEDDING_MODEL, dimensions: 1536, vector: vector() }],
  );
  assert.match(records[0].embedding, /^\[/);
});

test("TBD-only chunks do not consume embeddings and store null", () => {
  const records = prepareRagStorageRecords(
    [chunk({ knowledgeClasses: ["tbd"], normalRetrievalEligible: false, studentFacing: false })],
    courseIds,
    [],
  );
  assert.equal(records[0].embedding, null);
  assert.equal(records[0].knowledge_class, "tbd");
  assert.equal(records[0].student_facing, false);
});

test("course-specific chunks resolve through the trusted course lookup boundary", async () => {
  const seen = [];
  const result = await resolveRagCourseIds(
    [chunk(), chunk({ course: "digital_marketing" }), chunk({ course: "accounting" })],
    async (name) => {
      seen.push(name);
      return { id: `id-${name}`, internal_name: name };
    },
  );
  assert.deepEqual(seen, ["data_analytics", "digital_marketing", "accounting"]);
  assert.equal(result.data_analytics, "id-data_analytics");
  assert.equal(result.digital_marketing, "id-digital_marketing");
  assert.equal(result.accounting, "id-accounting");
});

test("all-course and general chunks store a null course ID", () => {
  const records = prepareRagStorageRecords(
    [chunk({ course: "all" }), chunk({ course: null })],
    {},
    [{ model: RAG_EMBEDDING_MODEL, dimensions: 1536, vector: vector() }, { model: RAG_EMBEDDING_MODEL, dimensions: 1536, vector: vector() }],
  );
  assert.deepEqual(records.map((record) => record.course_id), [null, null]);
});

test("missing required course resolution fails before embedding or storage", async () => {
  await assert.rejects(
    () => resolveRagCourseIds([chunk()], async () => null),
    /data_analytics/,
  );
});

test("storage class mapping uses the least-authoritative applicable source class", () => {
  assert.equal(mapKnowledgeClassesToStorageClass(["business_locked"]), "business_locked");
  assert.equal(
    mapKnowledgeClassesToStorageClass(["business_locked", "demo_explanatory"]),
    "demo_explanatory",
  );
  assert.equal(
    mapKnowledgeClassesToStorageClass(["business_locked", "demo_explanatory", "tbd"]),
    "tbd",
  );
});

test("source classes and all intents remain in metadata while first intent maps to DB", () => {
  const records = prepareRagStorageRecords(
    [chunk({ knowledgeClasses: ["business_locked", "demo_explanatory"] })],
    courseIds,
    [{ model: RAG_EMBEDDING_MODEL, dimensions: 1536, vector: vector() }],
  );
  assert.equal(records[0].intent, "data_analytics");
  assert.deepEqual(records[0].metadata_json.knowledgeClasses, ["business_locked", "demo_explanatory"]);
  assert.deepEqual(records[0].metadata_json.intents, ["data_analytics", "power_bi"]);
});

test("storage keys idempotency to the stable M30 source chunk ID", () => {
  const record = prepareRagStorageRecords(
    [chunk()],
    courseIds,
    [{ model: RAG_EMBEDDING_MODEL, dimensions: 1536, vector: vector() }],
  )[0];
  assert.equal(record.source_chunk_id, "skillup-rag-v1-da-07");
});

test("repository upserts repeated logical chunks by source_chunk_id", async () => {
  const record = prepareRagStorageRecords(
    [chunk()],
    courseIds,
    [{ model: RAG_EMBEDDING_MODEL, dimensions: 1536, vector: vector() }],
  )[0];
  const calls = [];
  const client = {
    from(table) {
      assert.equal(table, "knowledge_base");
      return {
        upsert(records, options) {
          calls.push({ records, options });
          return {
            select() {
              return Promise.resolve({ data: [{ id: "row-1" }], error: null });
            },
          };
        },
      };
    },
  };

  await upsertKnowledgeBaseRecords([record], client);
  await upsertKnowledgeBaseRecords([record], client);

  assert.equal(calls.length, 2);
  assert.deepEqual(calls.map((call) => call.options), [
    { onConflict: "source_chunk_id" },
    { onConflict: "source_chunk_id" },
  ]);
  assert.equal(calls[0].records[0].source_chunk_id, calls[1].records[0].source_chunk_id);
});

test("the complete pipeline embeds only eligible chunks before one upsert phase", async () => {
  const events = [];
  const result = await ingestRagChunksForStorage(
    [chunk(), chunk({ chunkId: "skillup-rag-v1-gap", knowledgeClasses: ["tbd"], normalRetrievalEligible: false, studentFacing: false })],
    {
      getCourseByInternalName: async (name) => {
        events.push(`course:${name}`);
        return { id: `id-${name}`, internal_name: name };
      },
      embedRagTexts: async (texts) => {
        events.push(`embed:${texts.length}`);
        return texts.map(() => ({ model: RAG_EMBEDDING_MODEL, dimensions: 1536, vector: vector() }));
      },
      upsertKnowledgeBaseRecords: async (records) => {
        events.push(`upsert:${records.length}`);
        return records;
      },
    },
  );
  assert.deepEqual(events, ["course:data_analytics", "embed:1", "upsert:2"]);
  assert.deepEqual(result, { total: 2, eligible: 1, excluded: 1, stored: 2 });
});

test("embedding failure prevents the storage upsert", async () => {
  let upserted = false;
  await assert.rejects(
    () => ingestRagChunksForStorage([chunk()], {
      getCourseByInternalName: async (name) => ({ id: `id-${name}`, internal_name: name }),
      embedRagTexts: async () => { throw new Error("provider failed"); },
      upsertKnowledgeBaseRecords: async () => { upserted = true; return []; },
    }),
    /provider failed/,
  );
  assert.equal(upserted, false);
});

test("unclassified chunks fail preflight before embedding or storage", async () => {
  let embedded = false;
  let upserted = false;
  await assert.rejects(
    () => ingestRagChunksForStorage([chunk({ knowledgeClasses: [] })], {
      getCourseByInternalName: async (name) => ({ id: `id-${name}`, internal_name: name }),
      embedRagTexts: async () => { embedded = true; return []; },
      upsertKnowledgeBaseRecords: async () => { upserted = true; return []; },
    }),
    /recognized knowledge class/,
  );
  assert.equal(embedded, false);
  assert.equal(upserted, false);
});

test("prepared records are independent from mutable caller input", () => {
  const source = chunk();
  const records = prepareRagStorageRecords(
    [source],
    courseIds,
    [{ model: RAG_EMBEDDING_MODEL, dimensions: 1536, vector: vector() }],
  );
  source.intents.push("unexpected");
  assert.deepEqual(records[0].metadata_json.intents, ["data_analytics", "power_bi"]);
});
