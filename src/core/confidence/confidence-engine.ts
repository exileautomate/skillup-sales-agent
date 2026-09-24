import type { JsonValue } from "../../lib/db/repositories/types.ts";
import type {
  ConfidenceCoverageItem,
  ConfidenceRange,
  ConfidenceScore,
  ConfidenceSnapshot,
  ConfidenceState,
  ConfidenceStatePatch,
  DemoGateInput,
  DemoGateResult,
} from "./types.ts";

export function createEmptyConfidenceState(): ConfidenceState {
  return {
    course: { structure: false, whatLearn: false, howLearn: false, outcomes: false },
    fees: {
      feeBasics: false,
      totalClarity: false,
      installments: false,
      paymentPracticality: false,
    },
    placement: { assistance: false, supportProcess: false, conditions: false, proof: false },
    internship: { availabilityDuration: false, nature: false, process: false },
    career: { direction: false },
    support: { mentor: false, learningSupport: false },
    branches: { availability: false, location: false, facilities: false },
  };
}

function isRecord(value: JsonValue): value is Record<string, JsonValue> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function covered(value: JsonValue | undefined): boolean {
  return value === true;
}

function pool(raw: JsonValue | undefined): Record<string, JsonValue> {
  return raw !== undefined && isRecord(raw) ? raw : {};
}

/** Parses persisted coverage conservatively; only literal true is coverage. */
export function parseConfidenceState(raw: JsonValue): ConfidenceState {
  const empty = createEmptyConfidenceState();
  if (!isRecord(raw)) {
    return empty;
  }

  const course = pool(raw.course);
  const fees = pool(raw.fees);
  const placement = pool(raw.placement);
  const internship = pool(raw.internship);
  const career = pool(raw.career);
  const support = pool(raw.support);
  const branches = pool(raw.branches);

  return {
    course: {
      structure: covered(course.structure),
      whatLearn: covered(course.whatLearn),
      howLearn: covered(course.howLearn),
      outcomes: covered(course.outcomes),
    },
    fees: {
      feeBasics: covered(fees.feeBasics),
      totalClarity: covered(fees.totalClarity),
      installments: covered(fees.installments),
      paymentPracticality: covered(fees.paymentPracticality),
    },
    placement: {
      assistance: covered(placement.assistance),
      supportProcess: covered(placement.supportProcess),
      conditions: covered(placement.conditions),
      proof: covered(placement.proof),
    },
    internship: {
      availabilityDuration: covered(internship.availabilityDuration),
      nature: covered(internship.nature),
      process: covered(internship.process),
    },
    career: { direction: covered(career.direction) },
    support: {
      mentor: covered(support.mentor),
      learningSupport: covered(support.learningSupport),
    },
    branches: {
      availability: covered(branches.availability),
      location: covered(branches.location),
      facilities: covered(branches.facilities),
    },
  };
}

function countCovered(values: readonly boolean[]): number {
  return values.filter(Boolean).length;
}

export function calculateConfidenceScore(state: Readonly<ConfidenceState>): ConfidenceScore {
  const course = countCovered(Object.values(state.course));
  const fees = countCovered(Object.values(state.fees));
  const placement = countCovered(Object.values(state.placement));
  const internship = countCovered(Object.values(state.internship));
  const career = countCovered(Object.values(state.career));
  const support = countCovered(Object.values(state.support));
  const branches = countCovered(Object.values(state.branches));

  return {
    course,
    fees,
    placement,
    internship,
    career,
    support,
    branches,
    total: course + fees + placement + internship + career + support + branches,
  };
}

export function getConfidenceRange(score: Readonly<ConfidenceScore>): ConfidenceRange {
  if (score.total <= 6) {
    return "information_trust_building";
  }

  return score.total <= 10
    ? "qualification_sales_conversation"
    : "demo_may_be_appropriate";
}

export function getConfidenceSnapshot(raw: JsonValue): ConfidenceSnapshot {
  const state = parseConfidenceState(raw);
  const score = calculateConfidenceScore(state);
  return { state, score, range: getConfidenceRange(score) };
}

function coverItem(state: ConfidenceState, item: ConfidenceCoverageItem): ConfidenceState {
  switch (item) {
    case "course.structure": return { ...state, course: { ...state.course, structure: true } };
    case "course.whatLearn": return { ...state, course: { ...state.course, whatLearn: true } };
    case "course.howLearn": return { ...state, course: { ...state.course, howLearn: true } };
    case "course.outcomes": return { ...state, course: { ...state.course, outcomes: true } };
    case "fees.feeBasics": return { ...state, fees: { ...state.fees, feeBasics: true } };
    case "fees.totalClarity": return { ...state, fees: { ...state.fees, totalClarity: true } };
    case "fees.installments": return { ...state, fees: { ...state.fees, installments: true } };
    case "fees.paymentPracticality": return { ...state, fees: { ...state.fees, paymentPracticality: true } };
    case "placement.assistance": return { ...state, placement: { ...state.placement, assistance: true } };
    case "placement.supportProcess": return { ...state, placement: { ...state.placement, supportProcess: true } };
    case "placement.conditions": return { ...state, placement: { ...state.placement, conditions: true } };
    case "placement.proof": return { ...state, placement: { ...state.placement, proof: true } };
    case "internship.availabilityDuration": return { ...state, internship: { ...state.internship, availabilityDuration: true } };
    case "internship.nature": return { ...state, internship: { ...state.internship, nature: true } };
    case "internship.process": return { ...state, internship: { ...state.internship, process: true } };
    case "career.direction": return { ...state, career: { direction: true } };
    case "support.mentor": return { ...state, support: { ...state.support, mentor: true } };
    case "support.learningSupport": return { ...state, support: { ...state.support, learningSupport: true } };
    case "branches.availability": return { ...state, branches: { ...state.branches, availability: true } };
    case "branches.location": return { ...state, branches: { ...state.branches, location: true } };
    case "branches.facilities": return { ...state, branches: { ...state.branches, facilities: true } };
  }
}

/** Monotonically marks only explicitly verified delivered coverage. */
export function applyConfidenceCoverage(
  currentState: Readonly<ConfidenceState>,
  coveredItems: readonly ConfidenceCoverageItem[],
): ConfidenceState {
  let next: ConfidenceState = {
    course: { ...currentState.course }, fees: { ...currentState.fees },
    placement: { ...currentState.placement }, internship: { ...currentState.internship },
    career: { ...currentState.career }, support: { ...currentState.support },
    branches: { ...currentState.branches },
  };
  for (const item of new Set(coveredItems)) {
    next = coverItem(next, item);
  }
  return next;
}

export function createConfidenceStatePatch(
  state: Readonly<ConfidenceState>,
): ConfidenceStatePatch {
  return { confidence_state_json: applyConfidenceCoverage(state, []) };
}

export function passesNormalDemoConfidenceGate(
  score: Readonly<ConfidenceScore>,
): boolean {
  return score.total >= 11 && score.course >= 2 && score.fees >= 2 && score.placement >= 2;
}

export function evaluateDemoGate(input: DemoGateInput): DemoGateResult {
  if (!input.demoAvailable) {
    return { allowed: false, path: "blocked", reason: "demo_unavailable" };
  }
  if (!input.eligible) {
    return { allowed: false, path: "blocked", reason: "not_eligible" };
  }
  if (
    input.demoPushStatus === "STOP_DEMO_PUSH" ||
    input.demoPushStatus === "STOP_ALL_SALES_PUSH"
  ) {
    return { allowed: false, path: "blocked", reason: "demo_push_stopped" };
  }
  if (input.strongDemoIntent) {
    return { allowed: true, path: "strong_intent", reason: "strong_intent_bypass" };
  }
  return passesNormalDemoConfidenceGate(input.confidence)
    ? { allowed: true, path: "normal_confidence", reason: "normal_confidence_met" }
    : { allowed: false, path: "blocked", reason: "normal_confidence_not_met" };
}
