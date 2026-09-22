import type { ResponseCreateParamsNonStreaming } from "openai/resources/responses/responses";

import { validateWithOneRepair } from "../../core/validation/structured-output.ts";
import { semanticNormalizationResultSchema } from "../../core/validation/schemas/semantic-normalization.schema.ts";
import type { SemanticNormalizationResult } from "../../core/types/semantic-normalization.ts";
import {
  createOpenAIClient,
  type OpenAIConfigurationError,
} from "./client.ts";
import {
  getSemanticNormalizerPrompt,
  SEMANTIC_NORMALIZATION_JSON_SCHEMA,
} from "./prompts/semantic-normalizer.prompt.ts";
import { buildStructuredOutputRepairPrompt } from "./prompts/structured-output-repair.prompt.ts";

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
  readonly reason: "invalid_after_repair" | "repair_failed";

  constructor(
    reason: "invalid_after_repair" | "repair_failed" = "invalid_after_repair",
  ) {
    super("OpenAI returned unavailable or malformed semantic normalization output.");
    this.name = "SemanticNormalizationOutputError";
    this.reason = reason;
  }
}

type OpenAIResponseCreate = (
  request: ResponseCreateParamsNonStreaming,
) => Promise<unknown>;

export type SemanticNormalizerDependencies = {
  createResponse?: OpenAIResponseCreate;
};

function extractOutputText(response: unknown): unknown {
  if (
    typeof response === "object" &&
    response !== null &&
    !Array.isArray(response) &&
    "output_text" in response
  ) {
    return response.output_text;
  }

  return undefined;
}

function buildSemanticNormalizationRequest(
  instructions: string,
  input: string,
): ResponseCreateParamsNonStreaming {
  return {
    model: SEMANTIC_NORMALIZER_MODEL,
    instructions,
    input,
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
}

function resolveCreateResponse(
  dependencies: SemanticNormalizerDependencies,
): OpenAIResponseCreate {
  if (dependencies.createResponse) {
    return dependencies.createResponse;
  }

  const client = createOpenAIClient();
  return (request) => client.responses.create(request);
}

export async function normalizeSemanticMeaning(
  originalMessage: string,
  dependencies: SemanticNormalizerDependencies = {},
): Promise<SemanticNormalizationResult> {
  const prompt = getSemanticNormalizerPrompt(originalMessage);
  const createResponse = resolveCreateResponse(dependencies);
  let initialOutput: unknown;

  try {
    initialOutput = extractOutputText(
      await createResponse(
        buildSemanticNormalizationRequest(prompt.instructions, prompt.input),
      ),
    );
  } catch (error) {
    throw new SemanticNormalizationProviderError(error);
  }

  const validation = await validateWithOneRepair({
    rawOutput: initialOutput,
    schema: semanticNormalizationResultSchema,
    repair: async ({ previousOutput, issues }) => {
      const repairPrompt = buildStructuredOutputRepairPrompt({
        contractName: "SemanticNormalizationResult",
        issues,
        previousOutput,
      });

      return extractOutputText(
        await createResponse(
          buildSemanticNormalizationRequest(
            repairPrompt.instructions,
            repairPrompt.input,
          ),
        ),
      );
    },
  });

  if (validation.status === "fallback") {
    throw new SemanticNormalizationOutputError(validation.reason);
  }

  return validation.value;
}

export type SemanticNormalizationConfigurationError = OpenAIConfigurationError;
