import type { OrchestrationSources } from "../orchestration/types.ts";
import type { SemanticNormalizationResult } from "../types/semantic-normalization.ts";
import {
  TURN_ANALYSIS_COURSES,
  type TurnAnalysis,
  type TurnCourse,
} from "../types/turn-analysis.ts";
import type { JsonValue, Lead } from "../../lib/db/repositories/types.ts";
import type { DemoBookingProgress, SalesAction } from "./sales-types.ts";

const BOOKING_STATUSES = [
  "NONE",
  "COLLECTING",
  "CHECKING",
  "READY",
  "CONFIRMED",
  "FAILED",
] as const;

function isRecord(value: JsonValue): value is { [key: string]: JsonValue } {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function normalizedString(value: JsonValue | undefined): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizedCourse(value: JsonValue | undefined): TurnCourse | null {
  const course = normalizedString(value);
  return course !== null &&
    (TURN_ANALYSIS_COURSES as readonly string[]).includes(course)
    ? (course as TurnCourse)
    : null;
}

function normalizedStatus(
  value: JsonValue | undefined,
): DemoBookingProgress["status"] {
  const status = normalizedString(value);
  return status !== null &&
    (BOOKING_STATUSES as readonly string[]).includes(status)
    ? (status as DemoBookingProgress["status"])
    : "NONE";
}

/** Treats unknown or malformed persisted JSON as an empty, safe state. */
export function parseDemoBookingProgress(value: JsonValue): DemoBookingProgress {
  if (!isRecord(value)) {
    return {
      name: null,
      contact: null,
      course: null,
      branch: null,
      date: null,
      time: null,
      status: "NONE",
    };
  }

  return {
    name: normalizedString(value.name),
    contact: normalizedString(value.contact),
    course: normalizedCourse(value.course),
    branch: normalizedString(value.branch),
    date: normalizedString(value.date),
    time: normalizedString(value.time),
    status: normalizedStatus(value.status),
  };
}

function entityValue(
  semanticNormalization: Readonly<SemanticNormalizationResult>,
  type: "date" | "time",
): string | null {
  const value = semanticNormalization.preservedEntities.find(
    (entity) => entity.type === type && entity.value.trim().length > 0,
  )?.value;
  return value?.trim() ?? null;
}

function resolveBranch(
  turnAnalysis: Readonly<TurnAnalysis>,
  lead: Readonly<Lead>,
  sources: OrchestrationSources,
  existing: DemoBookingProgress,
): string | null {
  if (sources.structuredBranchFacts.status === "loaded") {
    const explicit = turnAnalysis.leadFacts.branchPreference?.trim();
    const explicitRecord = explicit
      ? sources.structuredBranchFacts.data.find(
          (branch) => branch.name.toLowerCase() === explicit.toLowerCase(),
        )
      : undefined;

    if (explicitRecord) {
      return explicitRecord.name;
    }

    const storedRecord = sources.structuredBranchFacts.data.find(
      (branch) => branch.id === lead.branch_preference_id,
    );

    if (storedRecord) {
      return storedRecord.name;
    }
  }

  return existing.branch;
}

export function buildDemoBookingProgress(input: Readonly<{
  persisted: JsonValue;
  semanticNormalization: Readonly<SemanticNormalizationResult>;
  turnAnalysis: Readonly<TurnAnalysis>;
  lead: Readonly<Lead>;
  sources: OrchestrationSources;
}>): DemoBookingProgress {
  const existing = parseDemoBookingProgress(input.persisted);
  const loadedCourse =
    input.sources.structuredCourseFacts.status === "loaded" &&
    input.sources.structuredCourseFacts.data.internal_name === input.turnAnalysis.course
      ? input.turnAnalysis.course
      : null;

  return {
    name: input.turnAnalysis.leadFacts.name?.trim() || input.lead.name || existing.name,
    contact:
      input.turnAnalysis.leadFacts.contact?.trim() ||
      input.lead.phone ||
      existing.contact,
    course: loadedCourse ?? existing.course,
    branch: resolveBranch(
      input.turnAnalysis,
      input.lead,
      input.sources,
      existing,
    ),
    date: entityValue(input.semanticNormalization, "date") ?? existing.date,
    time: entityValue(input.semanticNormalization, "time") ?? existing.time,
    status: existing.status,
  };
}

export const BOOKING_MISSING_FIELD_ORDER = [
  ["name", "ask_booking_name", "booking_name"],
  ["contact", "ask_booking_contact", "booking_contact"],
  ["branch", "ask_booking_branch", "booking_branch"],
  ["date", "ask_booking_date", "booking_date"],
  ["time", "ask_booking_time", "booking_time"],
] as const satisfies readonly (readonly [
  keyof Pick<DemoBookingProgress, "name" | "contact" | "branch" | "date" | "time">,
  SalesAction,
  string,
])[];

export function nextMissingBookingField(progress: DemoBookingProgress):
  | Readonly<{ action: SalesAction; questionKey: string }>
  | null {
  for (const [field, action, questionKey] of BOOKING_MISSING_FIELD_ORDER) {
    if (progress[field] === null) {
      return { action, questionKey };
    }
  }

  return null;
}
