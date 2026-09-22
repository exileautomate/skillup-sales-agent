import "server-only";

import OpenAI from "openai";

import { getRequiredServerEnv } from "../../config/env.ts";

export class OpenAIConfigurationError extends Error {
  readonly code = "OPENAI_CONFIGURATION_ERROR" as const;

  constructor() {
    super(
      "OPENAI_API_KEY is required to run semantic normalization. Configure it only in the server environment.",
    );
    this.name = "OpenAIConfigurationError";
  }
}

/**
 * Creates the server-only OpenAI client only when a real request is needed.
 * No client or request state is retained between calls.
 */
export function createOpenAIClient(): OpenAI {
  try {
    return new OpenAI({ apiKey: getRequiredServerEnv("OPENAI_API_KEY") });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes("OPENAI_API_KEY")
    ) {
      throw new OpenAIConfigurationError();
    }

    throw error;
  }
}
