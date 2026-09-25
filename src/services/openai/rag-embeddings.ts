import "server-only";

import type OpenAI from "openai";

import type { RagChunk } from "../../core/rag/types.ts";
import { createOpenAIClient } from "./client.ts";

export const RAG_EMBEDDING_MODEL = "text-embedding-3-small" as const;
export const RAG_EMBEDDING_DIMENSIONS = 1536 as const;
export const RAG_EMBEDDING_BATCH_SIZE = 25 as const;

export type RagEmbedding = Readonly<{
  model: typeof RAG_EMBEDDING_MODEL;
  dimensions: typeof RAG_EMBEDDING_DIMENSIONS;
  vector: readonly number[];
}>;

export type RagEmbeddingsClient = Pick<OpenAI, "embeddings">;

/** Stable semantic text only; database identifiers and metadata stay out of embeddings. */
export function buildRagEmbeddingInput(chunk: Pick<RagChunk, "title" | "content">): string {
  return `${chunk.title}\n${chunk.content}`;
}

export function validateRagEmbeddingVector(vector: unknown): number[] {
  if (!Array.isArray(vector) || vector.length !== RAG_EMBEDDING_DIMENSIONS) {
    throw new Error(
      `Invalid RAG embedding: expected ${RAG_EMBEDDING_DIMENSIONS} dimensions.`,
    );
  }

  if (!vector.every((value) => typeof value === "number" && Number.isFinite(value))) {
    throw new Error("Invalid RAG embedding: every dimension must be a finite number.");
  }

  return [...vector];
}

/** Generates validated embeddings in deterministic, sequential batches. */
export async function embedRagTexts(
  texts: readonly string[],
  client: RagEmbeddingsClient = createOpenAIClient(),
): Promise<RagEmbedding[]> {
  const embeddings: RagEmbedding[] = [];

  for (let offset = 0; offset < texts.length; offset += RAG_EMBEDDING_BATCH_SIZE) {
    const batch = texts.slice(offset, offset + RAG_EMBEDDING_BATCH_SIZE);
    const response = await client.embeddings.create({
      model: RAG_EMBEDDING_MODEL,
      dimensions: RAG_EMBEDDING_DIMENSIONS,
      input: batch,
    });
    const data = [...response.data].sort((left, right) => left.index - right.index);

    if (data.length !== batch.length || data.some((item, index) => item.index !== index)) {
      throw new Error("Invalid RAG embedding response: batch entries are incomplete or unordered.");
    }

    for (const item of data) {
      embeddings.push({
        model: RAG_EMBEDDING_MODEL,
        dimensions: RAG_EMBEDDING_DIMENSIONS,
        vector: validateRagEmbeddingVector(item.embedding),
      });
    }
  }

  return embeddings;
}

/** Generates one validated M32 semantic-query embedding using the M31 contract. */
export async function embedRagQuery(
  queryText: string,
  client?: RagEmbeddingsClient,
): Promise<RagEmbedding> {
  const embeddings = await embedRagTexts([queryText], client);
  return embeddings[0];
}
