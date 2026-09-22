import type { ResponseCreateParamsNonStreaming } from "openai/resources/responses/responses";

import { validateWithOneRepair } from "../../core/validation/structured-output.ts";
import { turnAnalysisSchema } from "../../core/validation/schemas/turn-analysis.schema.ts";
import type { TurnAnalysis, TurnAnalysisInput } from "../../core/types/turn-analysis.ts";
import {
  createOpenAIClient,
  type OpenAIConfigurationError,
} from "./client.ts";
import {
  getTurnAnalysisPrompt,
  TURN_ANALYSIS_JSON_SCHEMA,
} from "./prompts/turn-analysis.prompt.ts";
import { buildStructuredOutputRepairPrompt } from "./prompts/structured-output-repair.prompt.ts";

export const TURN_ANALYSIS_MODEL = "gpt-5.6-luna" as const;

export class TurnAnalysisProviderError extends Error {
  readonly code = "TURN_ANALYSIS_PROVIDER_ERROR" as const;

  constructor(cause: unknown) {
    super("OpenAI turn analysis request failed.", { cause });
    this.name = "TurnAnalysisProviderError";
  }
}

export class TurnAnalysisOutputError extends Error {
  readonly code = "TURN_ANALYSIS_OUTPUT_ERROR" as const;
  readonly reason: "invalid_after_repair" | "repair_failed";

  constructor(
    reason: "invalid_after_repair" | "repair_failed" = "invalid_after_repair",
  ) {
    super("OpenAI returned unavailable or malformed turn analysis output.");
    this.name = "TurnAnalysisOutputError";
    this.reason = reason;
  }
}

type OpenAIResponseCreate = (
  request: ResponseCreateParamsNonStreaming,
) => Promise<unknown>;

export type TurnAnalysisDependencies = {
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

function buildTurnAnalysisRequest(
  instructions: string,
  input: string,
): ResponseCreateParamsNonStreaming {
  return {
    model: TURN_ANALYSIS_MODEL,
    instructions,
    input,
    store: false,
    text: {
      format: {
        type: "json_schema",
        name: "turn_analysis",
        strict: true,
        schema: TURN_ANALYSIS_JSON_SCHEMA,
      },
    },
  };
}

function resolveCreateResponse(
  dependencies: TurnAnalysisDependencies,
): OpenAIResponseCreate {
  if (dependencies.createResponse) {
    return dependencies.createResponse;
  }

  const client = createOpenAIClient();
  return (request) => client.responses.create(request);
}

export async function analyzeTurn(
  input: TurnAnalysisInput,
  dependencies: TurnAnalysisDependencies = {},
): Promise<TurnAnalysis> {
  const prompt = getTurnAnalysisPrompt(input);
  const createResponse = resolveCreateResponse(dependencies);
  let initialOutput: unknown;

  try {
    initialOutput = extractOutputText(
      await createResponse(buildTurnAnalysisRequest(prompt.instructions, prompt.input)),
    );
  } catch (error) {
    throw new TurnAnalysisProviderError(error);
  }

  const validation = await validateWithOneRepair({
    rawOutput: initialOutput,
    schema: turnAnalysisSchema,
    repair: async ({ previousOutput, issues }) => {
      const repairPrompt = buildStructuredOutputRepairPrompt({
        contractName: "TurnAnalysis",
        issues,
        previousOutput,
      });

      return extractOutputText(
        await createResponse(
          buildTurnAnalysisRequest(repairPrompt.instructions, repairPrompt.input),
        ),
      );
    },
  });

  if (validation.status === "fallback") {
    throw new TurnAnalysisOutputError(validation.reason);
  }

  return validation.value;
}

export type TurnAnalysisConfigurationError = OpenAIConfigurationError;
