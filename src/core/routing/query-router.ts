import {
  TURN_INTENTS,
  type Intent,
  type TurnAnalysis,
} from "../types/turn-analysis.ts";
import type { QueryRoute, QueryToolRequest } from "./types.ts";

export type IntentRoutingRule = Readonly<{
  needsStructuredCourseFacts: boolean;
  needsBranchFacts: boolean;
  needsRag: boolean;
  needsMemory: boolean;
  needsState: boolean;
  needsCourseContext: boolean;
  toolRequests: readonly QueryToolRequest[];
}>;

const NO_TOOLS: readonly QueryToolRequest[] = [];
const AVAILABILITY_TOOL: readonly QueryToolRequest[] = [
  { tool: "check_demo_availability" },
];
const LOCATION_TOOL: readonly QueryToolRequest[] = [
  { tool: "get_branch_location" },
];

function rule(
  overrides: Partial<IntentRoutingRule> = {},
): IntentRoutingRule {
  return {
    needsStructuredCourseFacts: false,
    needsBranchFacts: false,
    needsRag: false,
    needsMemory: false,
    needsState: false,
    needsCourseContext: false,
    toolRequests: NO_TOOLS,
    ...overrides,
  };
}

function documentRequest(
  documentType: "brochure" | "syllabus" | "testimonial",
): readonly QueryToolRequest[] {
  return [{ tool: "get_course_document", documentType }];
}

/**
 * Every approved TurnAnalysis intent is consciously mapped to source needs.
 * `satisfies Record<Intent, ...>` makes additions to TURN_INTENTS a compile
 * error until a routing decision is added here.
 */
export const INTENT_ROUTING_RULES = {
  greeting: rule(),
  course_overview: rule({
    needsStructuredCourseFacts: true,
    needsRag: true,
    needsCourseContext: true,
  }),
  course_topics: rule({ needsRag: true, needsCourseContext: true }),
  course_duration: rule({
    needsStructuredCourseFacts: true,
    needsCourseContext: true,
  }),
  learning_method: rule({ needsRag: true, needsCourseContext: true }),
  practical_learning: rule({ needsRag: true, needsCourseContext: true }),
  fee_question: rule({
    needsStructuredCourseFacts: true,
    needsCourseContext: true,
  }),
  gst_question: rule({
    needsStructuredCourseFacts: true,
    needsCourseContext: true,
  }),
  admission_fee_question: rule({
    needsStructuredCourseFacts: true,
    needsCourseContext: true,
  }),
  total_fee_question: rule({
    needsStructuredCourseFacts: true,
    needsCourseContext: true,
  }),
  installment_question: rule({
    needsStructuredCourseFacts: true,
    needsCourseContext: true,
  }),
  discount_question: rule({
    needsStructuredCourseFacts: true,
    needsCourseContext: true,
  }),
  scholarship_question: rule({ needsRag: true, needsCourseContext: true }),
  refund_question: rule({ needsRag: true, needsCourseContext: true }),
  placement_question: rule({
    needsStructuredCourseFacts: true,
    needsRag: true,
    needsCourseContext: true,
  }),
  job_guarantee_question: rule({
    needsStructuredCourseFacts: true,
    needsCourseContext: true,
  }),
  salary_question: rule({ needsRag: true, needsCourseContext: true }),
  career_question: rule({ needsRag: true, needsCourseContext: true }),
  internship_question: rule({
    needsStructuredCourseFacts: true,
    needsRag: true,
    needsCourseContext: true,
  }),
  internship_duration: rule({
    needsStructuredCourseFacts: true,
    needsCourseContext: true,
  }),
  internship_paid: rule({ needsRag: true, needsCourseContext: true }),
  internship_mode: rule({ needsRag: true, needsCourseContext: true }),
  internship_company_choice: rule({
    needsRag: true,
    needsCourseContext: true,
  }),
  internship_certificate: rule({
    needsStructuredCourseFacts: true,
    needsRag: true,
    needsCourseContext: true,
  }),
  eligibility_question: rule({
    needsStructuredCourseFacts: true,
    needsMemory: true,
    needsCourseContext: true,
  }),
  qualification_statement: rule({ needsMemory: true }),
  batch_question: rule({
    needsStructuredCourseFacts: true,
    needsCourseContext: true,
  }),
  joining_question: rule({
    needsStructuredCourseFacts: true,
    needsCourseContext: true,
  }),
  class_timing_question: rule({
    needsStructuredCourseFacts: true,
    needsCourseContext: true,
  }),
  branch_question: rule({ needsBranchFacts: true, needsCourseContext: true }),
  location_question: rule({
    needsBranchFacts: true,
    needsMemory: true,
    toolRequests: LOCATION_TOOL,
  }),
  facility_question: rule({ needsBranchFacts: true }),
  hostel_question: rule({ needsBranchFacts: true }),
  certificate_question: rule({
    needsStructuredCourseFacts: true,
    needsCourseContext: true,
  }),
  mentor_support_question: rule({ needsRag: true, needsCourseContext: true }),
  lms_question: rule({ needsRag: true, needsCourseContext: true }),
  recorded_class_question: rule({
    needsRag: true,
    needsCourseContext: true,
  }),
  demo_question: rule({
    needsStructuredCourseFacts: true,
    needsCourseContext: true,
  }),
  demo_acceptance: rule({
    needsStructuredCourseFacts: true,
    needsMemory: true,
    needsState: true,
    needsCourseContext: true,
  }),
  demo_rejection: rule({ needsState: true }),
  booking_request: rule({
    needsStructuredCourseFacts: true,
    needsMemory: true,
    needsState: true,
    needsCourseContext: true,
  }),
  booking_date: rule({
    needsStructuredCourseFacts: true,
    needsMemory: true,
    needsState: true,
    needsCourseContext: true,
    toolRequests: AVAILABILITY_TOOL,
  }),
  booking_time: rule({
    needsStructuredCourseFacts: true,
    needsMemory: true,
    needsState: true,
    needsCourseContext: true,
    toolRequests: AVAILABILITY_TOOL,
  }),
  booking_branch: rule({
    needsBranchFacts: true,
    needsMemory: true,
    needsState: true,
  }),
  booking_name: rule({ needsMemory: true, needsState: true }),
  booking_contact: rule({ needsMemory: true, needsState: true }),
  brochure_request: rule({
    needsMemory: true,
    needsCourseContext: true,
    toolRequests: documentRequest("brochure"),
  }),
  syllabus_request: rule({
    needsMemory: true,
    needsCourseContext: true,
    toolRequests: documentRequest("syllabus"),
  }),
  testimonial_request: rule({
    needsMemory: true,
    needsCourseContext: true,
    toolRequests: documentRequest("testimonial"),
  }),
  parent_delay: rule({ needsState: true }),
  competitor_comparison: rule({
    needsStructuredCourseFacts: true,
    needsRag: true,
    needsCourseContext: true,
  }),
  fee_objection: rule({
    needsStructuredCourseFacts: true,
    needsState: true,
    needsCourseContext: true,
  }),
  course_switch: rule({
    needsStructuredCourseFacts: true,
    needsMemory: true,
    needsState: true,
    needsCourseContext: true,
  }),
  not_interested: rule({ needsState: true }),
  human_request: rule({ needsState: true }),
  other: rule(),
} satisfies Record<Intent, IntentRoutingRule>;

function toolRequestKey(request: QueryToolRequest): string {
  if (request.tool === "get_course_document") {
    return `${request.tool}:${request.documentType}`;
  }

  return request.tool;
}

/**
 * Produces a deterministic source plan from an already-valid TurnAnalysis.
 * It retrieves nothing, mutates nothing, and authorizes no action.
 */
export function routeQuery(turnAnalysis: TurnAnalysis): QueryRoute {
  let needsStructuredCourseFacts = false;
  let needsBranchFacts = false;
  let needsRag = false;
  let needsMemory = false;
  let needsState = false;
  let needsMissingCourseContext = false;
  const toolRequests: QueryToolRequest[] = [];
  const toolRequestKeys = new Set<string>();

  for (const intent of turnAnalysis.intents) {
    const routingRule: IntentRoutingRule = INTENT_ROUTING_RULES[intent];

    needsStructuredCourseFacts ||= routingRule.needsStructuredCourseFacts;
    needsBranchFacts ||= routingRule.needsBranchFacts;
    needsRag ||= routingRule.needsRag;
    needsMemory ||= routingRule.needsMemory;
    needsState ||= routingRule.needsState;
    needsMissingCourseContext ||=
      routingRule.needsCourseContext && turnAnalysis.course === null;

    for (const request of routingRule.toolRequests) {
      const key = toolRequestKey(request);

      if (!toolRequestKeys.has(key)) {
        toolRequestKeys.add(key);
        toolRequests.push({ ...request });
      }
    }
  }

  return {
    needsStructuredCourseFacts,
    needsBranchFacts,
    needsRag,
    needsMemory,
    needsState: needsState || needsMissingCourseContext,
    toolRequests,
  };
}

// Keep a runtime reference so tests can assert the complete mapping in plain
// JavaScript as well as relying on TypeScript's Record coverage.
export const ROUTED_INTENTS: readonly Intent[] = TURN_INTENTS;
