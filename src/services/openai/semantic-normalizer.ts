import type { ResponseCreateParamsNonStreaming } from "openai/resources/responses/responses";

import {
  createOpenAIClient,
  type OpenAIConfigurationError,
} from "./client.ts";
import {
  getSemanticNormalizerPrompt,
  SEMANTIC_NORMALIZATION_JSON_SCHEMA,
} from "./prompts/semantic-normalizer.prompt.ts";
import {
  DETECTED_ORIGINAL_LANGUAGES,
  PRESERVED_ENTITY_TYPES,
  type DetectedOriginalLanguage,
  type PreservedEntity,
  type SemanticNormalizationResult,
  type SemanticUncertainty,
} from "../../core/types/semantic-normalization.ts";

export const SEMANTIC_NORMALIZER_MODEL = "gpt-5.6-luna" as const;

export class SemanticNormalizationProviderError extends Error {
  readonly code = "SEMANTIC_NORMALIZATION_PROVIDER_ERROR" as const;

  constructor(cause: unknown) {
    super("OpenAI semantic normalization request failed.", { cause });
    this.name = "SemanticNormalizationProviderError";
  }
}

export class SemanticNormalizationOutputError extends Error {
  readonly code = "SEMANTIC_NORMALIZATION_OUTPUT_ERROR" as const;

  constructor() {
    super("OpenAI returned unavailable or malformed semantic normalization output.");
    this.name = "SemanticNormalizationOutputError";
  }
}

type OpenAIResponseCreate = (
  request: ResponseCreateParamsNonStreaming,
) => Promise<unknown>;

export type SemanticNormalizerDependencies = {
  createResponse?: OpenAIResponseCreate;
};

const ALLOWED_RESULT_KEYS = new Set([
  "normalizedEnglish",
  "detectedOriginalLanguage",
  "uncertainty",
  "preservedEntities",
]);

const ALLOWED_UNCERTAINTY_KEYS = new Set(["text", "reason", "critical"]);
const ALLOWED_ENTITY_KEYS = new Set(["type", "value"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasOnlyKeys(
  value: Record<string, unknown>,
  allowedKeys: Set<string>,
): boolean {
  return Object.keys(value).every((key) => allowedKeys.has(key));
}

function isDetectedOriginalLanguage(
  value: unknown,
): value is DetectedOriginalLanguage {
  return (
    typeof value === "string" &&
    (DETECTED_ORIGINAL_LANGUAGES as readonly string[]).includes(value)
  );
}

function isUncertainty(value: unknown): value is SemanticUncertainty {
  return (
    isRecord(value) &&
    hasOnlyKeys(value, ALLOWED_UNCERTAINTY_KEYS) &&
    typeof value.text === "string" &&
    typeof value.reason === "string" &&
    typeof value.critical === "boolean"
  );
}

function isPreservedEntity(value: unknown): value is PreservedEntity {
  return (
    isRecord(value) &&
    hasOnlyKeys(value, ALLOWED_ENTITY_KEYS) &&
    typeof value.type === "string" &&
    (PRESERVED_ENTITY_TYPES as readonly string[]).includes(value.type) &&
    typeof value.value === "string"
  );
}

function isSemanticNormalizationResult(
  value: unknown,
): value is SemanticNormalizationResult {
  return (
    isRecord(value) &&
    hasOnlyKeys(value, ALLOWED_RESULT_KEYS) &&
    typeof value.normalizedEnglish === "string" &&
    isDetectedOriginalLanguage(value.detectedOriginalLanguage) &&
    Array.isArray(value.uncertainty) &&
    value.uncertainty.every(isUncertainty) &&
    Array.isArray(value.preservedEntities) &&
    value.preservedEntities.every(isPreservedEntity)
  );
}

function extractOutputText(response: unknown): string {
  if (!isRecord(response) || typeof response.output_text !== "string") {
    throw new SemanticNormalizationOutputError();
  }

  if (response.output_text.trim() === "") {
    throw new SemanticNormalizationOutputError();
  }

  return response.output_text;
}

function parseSemanticNormalizationResult(
  outputText: string,
): SemanticNormalizationResult {
  let parsed: unknown;

  try {
    parsed = JSON.parse(outputText) as unknown;
  } catch {
    throw new SemanticNormalizationOutputError();
  }

  if (!isSemanticNormalizationResult(parsed)) {
    throw new SemanticNormalizationOutputError();
  }

  return parsed;
}

export async function normalizeSemanticMeaning(
  originalMessage: string,
  dependencies: SemanticNormalizerDependencies = {},
): Promise<SemanticNormalizationResult> {
  const prompt = getSemanticNormalizerPrompt(originalMessage);
  const request: ResponseCreateParamsNonStreaming = {
    model: SEMANTIC_NORMALIZER_MODEL,
    instructions: prompt.instructions,
    input: prompt.input,
    store: false,
    text: {
      format: {
        type: "json_schema",
        name: "semantic_normalization",
        strict: true,
        schema: SEMANTIC_NORMALIZATION_JSON_SCHEMA,
      },
    },
  };

  let createResponse = dependencies.createResponse;

  if (!createResponse) {
    const client = createOpenAIClient();
    createResponse = (requestToSend) => client.responses.create(requestToSend);
  }

  let response: unknown;

  try {
    response = await createResponse(request);
  } catch (error) {
    throw new SemanticNormalizationProviderError(error);
  }

  return parseSemanticNormalizationResult(extractOutputText(response));
}

export type SemanticNormalizationConfigurationError = OpenAIConfigurationError;
