import { z } from "zod";

import {
  INTENT_RELATIONSHIPS,
  REQUESTED_RESPONSE_LANGUAGES,
  TURN_ANALYSIS_COURSES,
  TURN_ANALYSIS_LANGUAGES,
  TURN_INTENTS,
  TURN_OBJECTIONS,
  TURN_SALES_SIGNALS,
} from "../../types/turn-analysis.ts";

export const turnAnalysisSchema = z
  .object({
    language: z.enum(TURN_ANALYSIS_LANGUAGES),
    requestedResponseLanguage: z
      .enum(REQUESTED_RESPONSE_LANGUAGES)
      .nullable(),
    course: z.enum(TURN_ANALYSIS_COURSES).nullable(),
    intents: z.array(z.enum(TURN_INTENTS)).min(1),
    leadFacts: z
      .object({
        name: z.string().nullable(),
        qualification: z.string().nullable(),
        branchPreference: z.string().nullable(),
        contact: z.string().nullable(),
      })
      .strict(),
    objection: z.enum(TURN_OBJECTIONS).nullable(),
    salesSignal: z.enum(TURN_SALES_SIGNALS),
    intentRelationship: z.enum(INTENT_RELATIONSHIPS),
    ambiguity: z.array(
      z
        .object({
          field: z.string(),
          description: z.string(),
          critical: z.boolean(),
        })
        .strict(),
    ),
  })
  .strict()
  .superRefine((value, context) => {
    const hasSingleIntent = value.intents.length === 1;
    const hasSingleRelationship = value.intentRelationship === "single";

    if (hasSingleIntent !== hasSingleRelationship) {
      context.addIssue({
        code: "custom",
        path: ["intentRelationship"],
        message:
          "intentRelationship must be single exactly when there is one intent.",
      });
    }
  });
