import type { ConversationStateUpdatePatch } from "../state/conversation-state.ts";
import type { DemoPushStatus, JsonValue } from "../../lib/db/repositories/types.ts";

export type ConfidenceState = Readonly<{
  course: Readonly<{
    structure: boolean;
    whatLearn: boolean;
    howLearn: boolean;
    outcomes: boolean;
  }>;
  fees: Readonly<{
    feeBasics: boolean;
    totalClarity: boolean;
    installments: boolean;
    paymentPracticality: boolean;
  }>;
  placement: Readonly<{
    assistance: boolean;
    supportProcess: boolean;
    conditions: boolean;
    proof: boolean;
  }>;
  internship: Readonly<{
    availabilityDuration: boolean;
    nature: boolean;
    process: boolean;
  }>;
  career: Readonly<{
    direction: boolean;
  }>;
  support: Readonly<{
    mentor: boolean;
    learningSupport: boolean;
  }>;
  branches: Readonly<{
    availability: boolean;
    location: boolean;
    facilities: boolean;
  }>;
}>;

export const CONFIDENCE_COVERAGE_ITEMS = [
  "course.structure",
  "course.whatLearn",
  "course.howLearn",
  "course.outcomes",
  "fees.feeBasics",
  "fees.totalClarity",
  "fees.installments",
  "fees.paymentPracticality",
  "placement.assistance",
  "placement.supportProcess",
  "placement.conditions",
  "placement.proof",
  "internship.availabilityDuration",
  "internship.nature",
  "internship.process",
  "career.direction",
  "support.mentor",
  "support.learningSupport",
  "branches.availability",
  "branches.location",
  "branches.facilities",
] as const;

export type ConfidenceCoverageItem = (typeof CONFIDENCE_COVERAGE_ITEMS)[number];

export type ConfidenceScore = Readonly<{
  course: number;
  fees: number;
  placement: number;
  internship: number;
  career: number;
  support: number;
  branches: number;
  total: number;
}>;

export const CONFIDENCE_RANGES = [
  "information_trust_building",
  "qualification_sales_conversation",
  "demo_may_be_appropriate",
] as const;

export type ConfidenceRange = (typeof CONFIDENCE_RANGES)[number];

export type ConfidenceSnapshot = Readonly<{
  state: ConfidenceState;
  score: ConfidenceScore;
  range: ConfidenceRange;
}>;

export type DemoGateInput = Readonly<{
  confidence: ConfidenceScore;
  eligible: boolean;
  demoAvailable: boolean;
  strongDemoIntent: boolean;
  demoPushStatus: DemoPushStatus;
}>;

export type DemoGateResult = Readonly<{
  allowed: boolean;
  path: "normal_confidence" | "strong_intent" | "blocked";
  reason:
    | "demo_unavailable"
    | "not_eligible"
    | "demo_push_stopped"
    | "strong_intent_bypass"
    | "normal_confidence_met"
    | "normal_confidence_not_met";
}>;

export type ConfidenceStatePatch = Pick<
  ConversationStateUpdatePatch,
  "confidence_state_json"
>;

export type PersistedConfidenceValue = JsonValue;
