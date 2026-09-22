import { z } from "zod";

export type StructuredOutputValidationIssue = Readonly<{
  path: string;
  code: string;
}>;

export type StructuredOutputValidationAttempt<T> =
  | Readonly<{
      valid: true;
      value: T;
    }>
  | Readonly<{
      valid: false;
      issues: readonly StructuredOutputValidationIssue[];
    }>;

export type StructuredOutputValidationResult<T> =
  | Readonly<{
      status: "valid";
      value: T;
      repaired: false;
    }>
  | Readonly<{
      status: "repaired";
      value: T;
      repaired: true;
    }>
  | Readonly<{
      status: "fallback";
      value: null;
      reason: "invalid_after_repair" | "repair_failed";
    }>;

export type StructuredOutputRepair<T> = (
  request: Readonly<{
    previousOutput: unknown;
    issues: readonly StructuredOutputValidationIssue[];
  }>,
) => Promise<unknown>;

export type ValidateWithOneRepairInput<T> = Readonly<{
  rawOutput: unknown;
  schema: z.ZodType<T>;
  repair: StructuredOutputRepair<T>;
}>;

const MAX_ISSUES = 8;

function summarizeZodIssues(
  error: z.ZodError,
): readonly StructuredOutputValidationIssue[] {
  return error.issues.slice(0, MAX_ISSUES).map((issue) => ({
    path: issue.path.map(String).join("."),
    code: issue.code,
  }));
}

function invalidAttempt(
  path: string,
  code: string,
): StructuredOutputValidationAttempt<never> {
  return {
    valid: false,
    issues: [{ path, code }],
  };
}

/**
 * Parses a raw provider result and validates it without changing the parsed
 * data. Callers receive concise structural issue metadata, never raw errors.
 */
export function validateStructuredOutput<T>(
  rawOutput: unknown,
  schema: z.ZodType<T>,
): StructuredOutputValidationAttempt<T> {
  if (typeof rawOutput !== "string") {
    return invalidAttempt("", "invalid_output_type");
  }

  if (rawOutput.trim() === "") {
    return invalidAttempt("", "empty_output");
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(rawOutput) as unknown;
  } catch {
    return invalidAttempt("", "invalid_json");
  }

  const result = schema.safeParse(parsed);

  if (!result.success) {
    return {
      valid: false,
      issues: summarizeZodIssues(result.error),
    };
  }

  return {
    valid: true,
    value: result.data,
  };
}

/**
 * Performs at most one injected repair. This module intentionally does not
 * instantiate providers or fabricate a contract-valid fallback value.
 */
export async function validateWithOneRepair<T>(
  input: ValidateWithOneRepairInput<T>,
): Promise<StructuredOutputValidationResult<T>> {
  const firstAttempt = validateStructuredOutput(input.rawOutput, input.schema);

  if (firstAttempt.valid) {
    return {
      status: "valid",
      value: firstAttempt.value,
      repaired: false,
    };
  }

  let repairedOutput: unknown;

  try {
    repairedOutput = await input.repair({
      previousOutput: input.rawOutput,
      issues: firstAttempt.issues,
    });
  } catch {
    return {
      status: "fallback",
      value: null,
      reason: "repair_failed",
    };
  }

  const repairedAttempt = validateStructuredOutput(repairedOutput, input.schema);

  if (!repairedAttempt.valid) {
    return {
      status: "fallback",
      value: null,
      reason: "invalid_after_repair",
    };
  }

  return {
    status: "repaired",
    value: repairedAttempt.value,
    repaired: true,
  };
}
