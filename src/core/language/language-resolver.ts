import type { DetectedOriginalLanguage } from "../types/semantic-normalization.ts";

export const RESPONSE_LANGUAGES = [
  "english",
  "malayalam",
  "manglish",
] as const;

export type ResolvedLanguage = (typeof RESPONSE_LANGUAGES)[number];

export type LanguageResolverInput = {
  requestedResponseLanguage: ResolvedLanguage | null;
  currentDetectedLanguage: DetectedOriginalLanguage | null;
  recentLanguage: ResolvedLanguage | null;
  storedPreferredLanguage: ResolvedLanguage | null;
  defaultLanguage: ResolvedLanguage;
  inheritCurrentLanguageContext: boolean;
};

function isResolvedLanguage(
  language: DetectedOriginalLanguage | null,
): language is ResolvedLanguage {
  return (
    language === "english" ||
    language === "malayalam" ||
    language === "manglish"
  );
}

/**
 * Resolves the language Saleel should use from already-classified signals.
 * This function does not inspect text, call providers, query storage, or
 * mutate the supplied input.
 */
export function resolveLanguage(
  input: LanguageResolverInput,
): ResolvedLanguage {
  if (input.requestedResponseLanguage !== null) {
    return input.requestedResponseLanguage;
  }

  if (
    !input.inheritCurrentLanguageContext &&
    isResolvedLanguage(input.currentDetectedLanguage)
  ) {
    return input.currentDetectedLanguage;
  }

  if (input.recentLanguage !== null) {
    return input.recentLanguage;
  }

  if (input.storedPreferredLanguage !== null) {
    return input.storedPreferredLanguage;
  }

  return input.defaultLanguage;
}
