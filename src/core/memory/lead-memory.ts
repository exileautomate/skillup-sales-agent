import { getBranchByName } from "../../lib/db/repositories/branches.ts";
import { getCourseByInternalName } from "../../lib/db/repositories/courses.ts";
import { updateLead } from "../../lib/db/repositories/leads.ts";
import type {
  Branch,
  Course,
  Lead,
} from "../../lib/db/repositories/types.ts";
import type { SemanticNormalizationResult } from "../types/semantic-normalization.ts";
import type { TurnAnalysis } from "../types/turn-analysis.ts";

export const LEAD_MEMORY_FIELDS = [
  "name",
  "qualification",
  "preferred_language",
  "current_course_interest_id",
  "branch_preference_id",
] as const;

export type LeadMemoryField = (typeof LEAD_MEMORY_FIELDS)[number];

export type LeadMemoryUpdatePatch = Readonly<
  Partial<Pick<Lead, LeadMemoryField>>
>;

export type LeadMemoryUpdateResult = Readonly<{
  lead: Readonly<Lead>;
  changedFields: readonly LeadMemoryField[];
}>;

export type LeadMemoryDependencies = Readonly<{
  getBranchByName: typeof getBranchByName;
  getCourseByInternalName: typeof getCourseByInternalName;
  updateLead: typeof updateLead;
}>;

export type DeriveLeadMemoryUpdateInput = Readonly<{
  lead: Readonly<Lead>;
  semanticNormalization: Readonly<SemanticNormalizationResult>;
  turnAnalysis: Readonly<TurnAnalysis>;
  resolvedBranch: Readonly<Branch> | null;
  resolvedCourse: Readonly<Course> | null;
}>;

export type LeadMemoryUpdateDecision = Readonly<{
  patch: LeadMemoryUpdatePatch;
  changedFields: readonly LeadMemoryField[];
}>;

const defaultDependencies: LeadMemoryDependencies = {
  getBranchByName,
  getCourseByInternalName,
  updateLead,
};

function nonEmptyExplicitValue(value: string | null): string | null {
  if (value === null) {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

function hasExplicitCourseEntity(
  semanticNormalization: Readonly<SemanticNormalizationResult>,
): boolean {
  return semanticNormalization.preservedEntities.some(
    (entity) => entity.type === "course",
  );
}

/**
 * Builds an M24-owned update only from trusted current-turn facts and
 * repository-resolved relational records. It never mutates its inputs.
 */
export function deriveLeadMemoryUpdate(
  input: DeriveLeadMemoryUpdateInput,
): LeadMemoryUpdateDecision {
  const patch: Partial<Pick<Lead, LeadMemoryField>> = {};
  const changedFields: LeadMemoryField[] = [];
  const explicitName = nonEmptyExplicitValue(input.turnAnalysis.leadFacts.name);
  const explicitQualification = nonEmptyExplicitValue(
    input.turnAnalysis.leadFacts.qualification,
  );

  if (explicitName !== null && explicitName !== input.lead.name) {
    patch.name = explicitName;
    changedFields.push("name");
  }

  if (
    explicitQualification !== null &&
    explicitQualification !== input.lead.qualification
  ) {
    patch.qualification = explicitQualification;
    changedFields.push("qualification");
  }

  if (
    input.turnAnalysis.requestedResponseLanguage !== null &&
    input.turnAnalysis.requestedResponseLanguage !==
      input.lead.preferred_language
  ) {
    patch.preferred_language = input.turnAnalysis.requestedResponseLanguage;
    changedFields.push("preferred_language");
  }

  if (
    input.lead.current_course_interest_id === null &&
    input.turnAnalysis.course !== null &&
    hasExplicitCourseEntity(input.semanticNormalization) &&
    input.resolvedCourse !== null
  ) {
    patch.current_course_interest_id = input.resolvedCourse.id;
    changedFields.push("current_course_interest_id");
  }

  if (
    input.resolvedBranch !== null &&
    input.resolvedBranch.id !== input.lead.branch_preference_id
  ) {
    patch.branch_preference_id = input.resolvedBranch.id;
    changedFields.push("branch_preference_id");
  }

  return { patch, changedFields };
}

/**
 * Resolves relational facts, derives one conservative patch, and performs at
 * most one Lead update for the current turn.
 */
export async function applyLeadMemory(
  input: Readonly<{
    lead: Readonly<Lead>;
    semanticNormalization: Readonly<SemanticNormalizationResult>;
    turnAnalysis: Readonly<TurnAnalysis>;
  }>,
  dependencies: LeadMemoryDependencies = defaultDependencies,
): Promise<LeadMemoryUpdateResult> {
  const explicitBranchPreference = nonEmptyExplicitValue(
    input.turnAnalysis.leadFacts.branchPreference,
  );
  const shouldResolveCourse =
    input.lead.current_course_interest_id === null &&
    input.turnAnalysis.course !== null &&
    hasExplicitCourseEntity(input.semanticNormalization);
  const explicitCourse = shouldResolveCourse
    ? input.turnAnalysis.course
    : null;

  const resolvedBranch =
    explicitBranchPreference === null
      ? null
      : await dependencies.getBranchByName(explicitBranchPreference);
  const resolvedCourse = explicitCourse !== null
    ? await dependencies.getCourseByInternalName(explicitCourse)
    : null;
  const decision = deriveLeadMemoryUpdate({
    ...input,
    resolvedBranch,
    resolvedCourse,
  });

  if (decision.changedFields.length === 0) {
    return { lead: input.lead, changedFields: [] };
  }

  const updatedLead = await dependencies.updateLead(
    input.lead.id,
    decision.patch,
  );

  return {
    lead: updatedLead,
    changedFields: decision.changedFields,
  };
}
