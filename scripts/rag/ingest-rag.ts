import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

import { getRequiredServerEnv } from "../../src/config/env.ts";
import { ingestRagChunksForStorage } from "../../src/core/rag/rag-storage.ts";
import { ingestSkillUpRagDocument } from "../../src/core/rag/rag-ingestion.ts";
import { getCourseByInternalName } from "../../src/lib/db/repositories/courses.ts";
import { upsertKnowledgeBaseRecords } from "../../src/lib/db/repositories/knowledge-base.ts";
import { embedRagTexts } from "../../src/services/openai/rag-embeddings.ts";

const sourcePath = fileURLToPath(
  new URL("../../../02_SkillUp_RAG_Deep_Course_Knowledge.md", import.meta.url),
);
const markdown = await readFile(sourcePath, "utf8");
const chunks = ingestSkillUpRagDocument(markdown);
const eligible = chunks.filter((chunk) => chunk.normalRetrievalEligible).length;
const repositoryClient = createClient(
  getRequiredServerEnv("SUPABASE_URL"),
  getRequiredServerEnv("SUPABASE_PUBLISHABLE_KEY"),
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  },
);

if (chunks.length !== 104 || eligible !== 96 || chunks.length - eligible !== 8) {
  throw new Error(
    `Unexpected Doc 02 corpus shape: ${chunks.length} total, ${eligible} eligible, ${chunks.length - eligible} excluded.`,
  );
}

const summary = await ingestRagChunksForStorage(chunks, {
  getCourseByInternalName: (internalName) => getCourseByInternalName(
    internalName,
    repositoryClient,
  ),
  embedRagTexts,
  upsertKnowledgeBaseRecords: (records) => upsertKnowledgeBaseRecords(
    records,
    repositoryClient,
  ),
});

console.log(JSON.stringify({
  totalChunks: summary.total,
  normalRetrievalEligibleChunks: summary.eligible,
  excludedTbdChunks: summary.excluded,
  embeddedChunks: summary.eligible,
  storedOrUpsertedChunks: summary.stored,
  model: "text-embedding-3-small",
  dimensions: 1536,
}));
