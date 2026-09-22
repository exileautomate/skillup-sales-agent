import { z } from "zod";

import {
  DETECTED_ORIGINAL_LANGUAGES,
  PRESERVED_ENTITY_TYPES,
} from "../../types/semantic-normalization.ts";

export const semanticNormalizationResultSchema = z
  .object({
    normalizedEnglish: z.string(),
    detectedOriginalLanguage: z.enum(DETECTED_ORIGINAL_LANGUAGES),
    uncertainty: z.array(
      z
        .object({
          text: z.string(),
          reason: z.string(),
          critical: z.boolean(),
        })
        .strict(),
    ),
    preservedEntities: z.array(
      z
        .object({
          type: z.enum(PRESERVED_ENTITY_TYPES),
          value: z.string(),
        })
        .strict(),
    ),
  })
  .strict();
