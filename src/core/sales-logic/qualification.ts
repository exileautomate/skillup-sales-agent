import type { TurnCourse } from "../types/turn-analysis.ts";
import type { QualificationDecision } from "./sales-types.ts";

function normalizeQualification(value: string): string {
  return value
    .toLowerCase()
    .replace(/[._/-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isIncompleteOrNegated(value: string): boolean {
  return /\b(pursuing|studying|student|final year|incomplete|not completed|no degree|without degree)\b/.test(
    value,
  );
}

function hasCompletedDegree(value: string): boolean {
  if (isIncompleteOrNegated(value)) {
    return false;
  }

  return /\b(degree|graduate|graduation|bachelor|master|bcom|b com|bba|bsc|b sc|ba|b a|btech|b tech|b e|mba|m com|mcom|msc|m sc|mtech|m tech|phd|ca|cma|acca)\b/.test(
    value,
  );
}

function hasPlusTwo(value: string): boolean {
  return /\b(plus two|plus 2|12th|class 12|higher secondary|hse)\b/.test(value);
}

function hasAcceptedAccountingBackground(value: string): boolean {
  if (isIncompleteOrNegated(value)) {
    return false;
  }

  return (
    /\b(bcom|b com|bba|ca|cma|acca)\b/.test(value) ||
    /\bmba\s+(in\s+)?finance\b/.test(value) ||
    /\baccount(ing|s)?\s+(work\s+)?experience\b/.test(value) ||
    /\b(work(ed|ing)?\s+as\s+an?\s+)?accountant\b/.test(value)
  );
}

/** Classifies only locked, explicitly safe qualification cases. */
export function evaluateQualification(
  course: TurnCourse | null,
  qualification: string | null,
): QualificationDecision {
  if (course === null) {
    return { status: "unknown", reason: "course_unknown" };
  }

  if (qualification === null || qualification.trim().length === 0) {
    return {
      status: "clarification_required",
      reason: "qualification_missing",
      questionKey: "qualification",
    };
  }

  const normalized = normalizeQualification(qualification);

  if (course === "data_analytics") {
    if (hasCompletedDegree(normalized)) {
      return { status: "eligible", reason: "completed_degree" };
    }

    if (hasPlusTwo(normalized)) {
      return { status: "ineligible", reason: "plus_two_only" };
    }
  }

  if (course === "digital_marketing") {
    if (hasPlusTwo(normalized) || hasCompletedDegree(normalized)) {
      return { status: "eligible", reason: "plus_two_or_higher" };
    }
  }

  if (course === "accounting" && hasAcceptedAccountingBackground(normalized)) {
    return { status: "eligible", reason: "accepted_accounting_background" };
  }

  return {
    status: "clarification_required",
    reason: "qualification_ambiguous",
    questionKey: "qualification_detail",
  };
}
