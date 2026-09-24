import type { ConversationStateUpdatePatch } from "../state/conversation-state.ts";
import type { QueryToolRequest } from "../routing/types.ts";
import type {
  Conversation,
  Lead,
} from "../../lib/db/repositories/types.ts";
import type { TurnCourse } from "../types/turn-analysis.ts";

export const SALES_GROUPS = [
  "answer_educate",
  "qualify",
  "handle_objection",
  "demo_progression",
  "booking_progression",
  "nurture_stop",
] as const;

export type SalesGroup = (typeof SALES_GROUPS)[number];

export const SALES_ACTIONS = [
  "answer_course",
  "answer_topics",
  "answer_duration",
  "answer_fee",
  "answer_gst",
  "answer_admission_fee",
  "answer_total_fee",
  "answer_installment",
  "answer_placement",
  "answer_job_guarantee",
  "answer_salary",
  "answer_internship",
  "answer_eligibility",
  "answer_batch",
  "answer_joining",
  "answer_class_timing",
  "answer_branch",
  "answer_location",
  "answer_facility",
  "answer_hostel",
  "answer_certificate",
  "answer_support",
  "answer_demo_availability",
  "send_brochure",
  "send_syllabus",
  "send_testimonial",
  "send_branch_location",
  "ask_course_interest",
  "ask_qualification",
  "ask_qualification_detail",
  "clarify_critical_ambiguity",
  "handle_fee_objection",
  "handle_parent_objection",
  "handle_competitor_objection",
  "handle_demo_hesitation",
  "mention_installment",
  "mention_verified_value",
  "mention_parent_counsellor",
  "offer_demo",
  "check_demo_availability",
  "ask_booking_name",
  "ask_booking_contact",
  "ask_booking_branch",
  "ask_booking_date",
  "ask_booking_time",
  "create_demo_booking",
  "claim_booking_success",
  "acknowledge_nurture_signal",
  "acknowledge_stop_signal",
  "proactive_sales_push",
  "escalate_human_request",
  "offer_discount",
  "unauthorized_negotiation",
  "fake_urgency",
  "attack_competitor",
  "promise_job",
  "promise_salary",
  "invent_fact",
] as const;

export type SalesAction = (typeof SALES_ACTIONS)[number];

export const SALES_REASON_CODES = [
  "DIRECT_INFORMATION_REQUEST",
  "MULTI_INTENT_INFORMATION_REQUEST",
  "COURSE_UNKNOWN",
  "COURSE_SWITCH_DEFERRED",
  "STRUCTURED_SOURCE_UNAVAILABLE",
  "APPROVED_RAG_DEFERRED",
  "QUALIFICATION_REQUIRED",
  "QUALIFICATION_CLARIFICATION_REQUIRED",
  "QUALIFICATION_CONFIRMED",
  "QUALIFICATION_FAILED",
  "OBJECTION_FEE",
  "OBJECTION_PARENT",
  "OBJECTION_COMPETITOR",
  "OBJECTION_DEMO",
  "CONFIDENCE_GATE_PENDING",
  "DEMO_STRONG_INTENT",
  "DEMO_NOT_AVAILABLE_FOR_COURSE",
  "DEMO_PUSH_ALREADY_STOPPED",
  "BOOKING_FIELDS_MISSING",
  "BOOKING_AVAILABILITY_REQUIRED",
  "BOOKING_EXECUTION_DEFERRED",
  "NURTURE_SIGNAL",
  "STOP_SIGNAL",
  "CRITICAL_AMBIGUITY",
] as const;

export type SalesReasonCode = (typeof SALES_REASON_CODES)[number];

export type QualificationDecision =
  | Readonly<{
      status: "eligible";
      reason:
        | "completed_degree"
        | "plus_two_or_higher"
        | "accepted_accounting_background"
        | "persisted_qualified_state";
    }>
  | Readonly<{
      status: "ineligible";
      reason: "plus_two_only" | "persisted_unqualified_state";
    }>
  | Readonly<{
      status: "clarification_required";
      reason: "qualification_missing" | "qualification_ambiguous";
      questionKey: "qualification" | "qualification_detail";
    }>
  | Readonly<{
      status: "unknown";
      reason: "course_unknown" | "not_evaluated";
    }>;

export type DemoBookingProgress = Readonly<{
  name: string | null;
  contact: string | null;
  course: TurnCourse | null;
  branch: string | null;
  date: string | null;
  time: string | null;
  status: "NONE" | "COLLECTING" | "CHECKING" | "READY" | "CONFIRMED" | "FAILED";
}>;

export type SalesDecision = Readonly<{
  salesGroup: SalesGroup;
  requiredActions: readonly SalesAction[];
  allowedActions: readonly SalesAction[];
  blockedActions: readonly SalesAction[];
  reasonCodes: readonly SalesReasonCode[];
  nextStage: Conversation["current_sales_stage"] | null;
  conversationStatePatch: ConversationStateUpdatePatch;
  leadStatusUpdate: Lead["lead_status"] | null;
  toolRequests: readonly QueryToolRequest[];
  followUpQuestionKey: string | null;
  qualificationDecision: QualificationDecision | null;
}>;
