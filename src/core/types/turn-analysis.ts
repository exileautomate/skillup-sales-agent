export const TURN_ANALYSIS_LANGUAGES = [
  "english",
  "malayalam",
  "manglish",
  "unclear",
] as const;

export type TurnLanguage = (typeof TURN_ANALYSIS_LANGUAGES)[number];

export const REQUESTED_RESPONSE_LANGUAGES = [
  "english",
  "malayalam",
  "manglish",
] as const;

export type RequestedResponseLanguage =
  (typeof REQUESTED_RESPONSE_LANGUAGES)[number];

export const TURN_ANALYSIS_COURSES = [
  "data_analytics",
  "digital_marketing",
  "accounting",
] as const;

export type TurnCourse = (typeof TURN_ANALYSIS_COURSES)[number];

export const TURN_INTENTS = [
  "greeting",
  "course_overview",
  "course_topics",
  "course_duration",
  "learning_method",
  "practical_learning",
  "fee_question",
  "gst_question",
  "admission_fee_question",
  "total_fee_question",
  "installment_question",
  "discount_question",
  "scholarship_question",
  "refund_question",
  "placement_question",
  "job_guarantee_question",
  "salary_question",
  "career_question",
  "internship_question",
  "internship_duration",
  "internship_paid",
  "internship_mode",
  "internship_company_choice",
  "internship_certificate",
  "eligibility_question",
  "qualification_statement",
  "batch_question",
  "joining_question",
  "class_timing_question",
  "branch_question",
  "location_question",
  "facility_question",
  "hostel_question",
  "certificate_question",
  "mentor_support_question",
  "lms_question",
  "recorded_class_question",
  "demo_question",
  "demo_acceptance",
  "demo_rejection",
  "booking_request",
  "booking_date",
  "booking_time",
  "booking_branch",
  "booking_name",
  "booking_contact",
  "brochure_request",
  "syllabus_request",
  "testimonial_request",
  "parent_delay",
  "competitor_comparison",
  "fee_objection",
  "course_switch",
  "not_interested",
  "human_request",
  "other",
] as const;

export type Intent = (typeof TURN_INTENTS)[number];

export type LeadFacts = {
  name: string | null;
  qualification: string | null;
  branchPreference: string | null;
  contact: string | null;
};

export const TURN_OBJECTIONS = [
  "fee",
  "parent",
  "competitor",
  "demo_hesitation",
  "timing",
  "trust",
  "other",
] as const;

export type TurnObjection = (typeof TURN_OBJECTIONS)[number];

export const TURN_SALES_SIGNALS = [
  "information_seeking",
  "positive_interest",
  "strong_demo_intent",
  "booking_intent",
  "hesitation",
  "objection",
  "negative",
  "not_interested",
  "unclear",
] as const;

export type TurnSalesSignal = (typeof TURN_SALES_SIGNALS)[number];

export const INTENT_RELATIONSHIPS = [
  "single",
  "independent",
  "dependent",
  "mixed",
] as const;

export type IntentRelationship = (typeof INTENT_RELATIONSHIPS)[number];

export type TurnAmbiguity = {
  field: string;
  description: string;
  critical: boolean;
};

export type TurnAnalysis = {
  language: TurnLanguage;
  requestedResponseLanguage: RequestedResponseLanguage | null;
  course: TurnCourse | null;
  intents: Intent[];
  leadFacts: LeadFacts;
  objection: TurnObjection | null;
  salesSignal: TurnSalesSignal;
  intentRelationship: IntentRelationship;
  ambiguity: TurnAmbiguity[];
};

export type TurnAnalysisConversationEntry = Readonly<{
  role: "student" | "assistant";
  content: string;
}>;

export type TurnAnalysisInput = Readonly<{
  originalMessage: string;
  normalizedEnglish: string;
  currentConversationState?: Readonly<Record<string, unknown>> | null;
  leadMemory?: Readonly<Record<string, unknown>> | null;
  recentConversation?: readonly TurnAnalysisConversationEntry[] | null;
}>;
