export const DETECTED_ORIGINAL_LANGUAGES = [
  "english",
  "malayalam",
  "manglish",
  "mixed",
  "unclear",
] as const;

export type DetectedOriginalLanguage =
  (typeof DETECTED_ORIGINAL_LANGUAGES)[number];

export const PRESERVED_ENTITY_TYPES = [
  "person",
  "course",
  "branch",
  "date",
  "time",
  "amount",
  "phone",
  "qualification",
  "other",
] as const;

export type PreservedEntityType = (typeof PRESERVED_ENTITY_TYPES)[number];

export type SemanticUncertainty = {
  text: string;
  reason: string;
  critical: boolean;
};

export type PreservedEntity = {
  type: PreservedEntityType;
  value: string;
};

export type SemanticNormalizationResult = {
  normalizedEnglish: string;
  detectedOriginalLanguage: DetectedOriginalLanguage;
  uncertainty: SemanticUncertainty[];
  preservedEntities: PreservedEntity[];
};
