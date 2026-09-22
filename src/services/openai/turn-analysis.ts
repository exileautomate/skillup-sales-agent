import type { ResponseCreateParamsNonStreaming } from "openai/resources/responses/responses";

import {
  createOpenAIClient,
  type OpenAIConfigurationError,
} from "./client.ts";
import {
  getTurnAnalysisPrompt,
  TURN_ANALYSIS_JSON_SCHEMA,
} from "./prompts/turn-analysis.prompt.ts";
import {
  INTENT_RELATIONSHIPS,
  REQUESTED_RESPONSE_LANGUAGES,
  TURN_ANALYSIS_COURSES,
  TURN_ANALYSIS_LANGUAGES,
  TURN_INTENTS,
  TURN_OBJECTIONS,
  TURN_SALES_SIGNALS,
  type Intent,
  type IntentRelationship,
  type LeadFacts,
  type RequestedResponseLanguage,
  type TurnAmbiguity,
  type TurnAnalysis,
  type TurnAnalysisInput,
  type TurnCourse,
  type TurnLanguage,
  type TurnObjection,
  type TurnSalesSignal,
} from "../../core/types/turn-analysis.ts";

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

  constructor() {
    super("OpenAI returned unavailable or malformed turn analysis output.");
    this.name = "TurnAnalysisOutputError";
  }
}

type OpenAIResponseCreate = (
  request: ResponseCreateParamsNonStreaming,
) => Promise<unknown>;

export type TurnAnalysisDependencies = {
  createResponse?: OpenAIResponseCreate;
};

const ALLOWED_RESULT_KEYS = new Set([
  "language",
  "requestedResponseLanguage",
  "course",
  "intents",
  "leadFacts",
  "objection",
  "salesSignal",
  "intentRelationship",
  "ambiguity",
]);

const ALLOWED_LEAD_FACT_KEYS = new Set([
  "name",
  "qualification",
  "branchPreference",
  "contact",
]);

const ALLOWED_AMBIGUITY_KEYS = new Set([
  "field",
  "description",
  "critical",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasOnlyKeys(
  value: Record<string, unknown>,
  allowedKeys: Set<string>,
): boolean {
  return Object.keys(value).every((key) => allowedKeys.has(key));
}

function isEnumValue<const T extends readonly string[]>(
  value: unknown,
  allowedValues: T,
): value is T[number] {
  return (
    typeof value === "string" &&
    (allowedValues as readonly string[]).includes(value)
  );
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

function isLeadFacts(value: unknown): value is LeadFacts {
  return (
    isRecord(value) &&
    hasOnlyKeys(value, ALLOWED_LEAD_FACT_KEYS) &&
    isNullableString(value.name) &&
    isNullableString(value.qualification) &&
    isNullableString(value.branchPreference) &&
    isNullableString(value.contact)
  );
}

function isTurnAmbiguity(value: unknown): value is TurnAmbiguity {
  return (
    isRecord(value) &&
    hasOnlyKeys(value, ALLOWED_AMBIGUITY_KEYS) &&
    typeof value.field === "string" &&
    typeof value.description === "string" &&
    typeof value.critical === "boolean"
  );
}

function isTurnLanguage(value: unknown): value is TurnLanguage {
  return isEnumValue(value, TURN_ANALYSIS_LANGUAGES);
}

function isRequestedResponseLanguage(
  value: unknown,
): value is RequestedResponseLanguage | null {
  return value === null || isEnumValue(value, REQUESTED_RESPONSE_LANGUAGES);
}

function isTurnCourse(value: unknown): value is TurnCourse | null {
  return value === null || isEnumValue(value, TURN_ANALYSIS_COURSES);
}

function isIntent(value: unknown): value is Intent {
  return isEnumValue(value, TURN_INTENTS);
}

function isTurnObjection(value: unknown): value is TurnObjection | null {
  return value === null || isEnumValue(value, TURN_OBJECTIONS);
}

function isTurnSalesSignal(value: unknown): value is TurnSalesSignal {
  return isEnumValue(value, TURN_SALES_SIGNALS);
}

function isIntentRelationship(value: unknown): value is IntentRelationship {
  return isEnumValue(value, INTENT_RELATIONSHIPS);
}

function isTurnAnalysis(value: unknown): value is TurnAnalysis {
  const hasValidIntentRelationship =
    isRecord(value) &&
    Array.isArray(value.intents) &&
    ((value.intents.length === 1 && value.intentRelationship === "single") ||
      (value.intents.length > 1 && value.intentRelationship !== "single"));

  return (
    isRecord(value) &&
    hasOnlyKeys(value, ALLOWED_RESULT_KEYS) &&
    isTurnLanguage(value.language) &&
    isRequestedResponseLanguage(value.requestedResponseLanguage) &&
    isTurnCourse(value.course) &&
    Array.isArray(value.intents) &&
    value.intents.length > 0 &&
    value.intents.every(isIntent) &&
    hasValidIntentRelationship &&
    isLeadFacts(value.leadFacts) &&
    isTurnObjection(value.objection) &&
    isTurnSalesSignal(value.salesSignal) &&
    isIntentRelationship(value.intentRelationship) &&
    Array.isArray(value.ambiguity) &&
    value.ambiguity.every(isTurnAmbiguity)
  );
}

function extractOutputText(response: unknown): string {
  if (!isRecord(response) || typeof response.output_text !== "string") {
    throw new TurnAnalysisOutputError();
  }

  if (response.output_text.trim() === "") {
    throw new TurnAnalysisOutputError();
  }

  return response.output_text;
}

function parseTurnAnalysis(outputText: string): TurnAnalysis {
  let parsed: unknown;

  try {
    parsed = JSON.parse(outputText) as unknown;
  } catch {
    throw new TurnAnalysisOutputError();
  }

  if (!isTurnAnalysis(parsed)) {
    throw new TurnAnalysisOutputError();
  }

  return parsed;
}

export async function analyzeTurn(
  input: TurnAnalysisInput,
  dependencies: TurnAnalysisDependencies = {},
): Promise<TurnAnalysis> {
  const prompt = getTurnAnalysisPrompt(input);
  const request: ResponseCreateParamsNonStreaming = {
    model: TURN_ANALYSIS_MODEL,
    instructions: prompt.instructions,
    input: prompt.input,
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

  let createResponse = dependencies.createResponse;

  if (!createResponse) {
    const client = createOpenAIClient();
    createResponse = (requestToSend) => client.responses.create(requestToSend);
  }

  let response: unknown;

  try {
    response = await createResponse(request);
  } catch (error) {
    throw new TurnAnalysisProviderError(error);
  }

  return parseTurnAnalysis(extractOutputText(response));
}

export type TurnAnalysisConfigurationError = OpenAIConfigurationError;
