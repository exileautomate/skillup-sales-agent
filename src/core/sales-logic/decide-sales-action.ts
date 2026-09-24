import type {
  OrchestrationSources,
} from "../orchestration/types.ts";
import type { QueryRoute, QueryToolRequest } from "../routing/types.ts";
import type { SemanticNormalizationResult } from "../types/semantic-normalization.ts";
import type { TurnAnalysis } from "../types/turn-analysis.ts";
import type {
  Conversation,
  Course,
  Lead,
  SalesStage,
} from "../../lib/db/repositories/types.ts";
import type { ConversationStateUpdatePatch } from "../state/conversation-state.ts";
import {
  buildDemoBookingProgress,
  nextMissingBookingField,
} from "./booking-progress.ts";
import { INTENT_ACTION_OBLIGATIONS } from "./intent-obligations.ts";
import { evaluateQualification } from "./qualification.ts";
import type {
  DemoBookingProgress,
  QualificationDecision,
  SalesAction,
  SalesDecision,
  SalesGroup,
  SalesReasonCode,
} from "./sales-types.ts";

export type SalesDecisionInput = Readonly<{
  semanticNormalization: Readonly<SemanticNormalizationResult>;
  turnAnalysis: Readonly<TurnAnalysis>;
  lead: Readonly<Lead>;
  conversation: Readonly<Conversation>;
  existingConversationCourse: Readonly<Course> | null;
  queryRoute: Readonly<QueryRoute>;
  sources: OrchestrationSources;
}>;

const QUALIFICATION_INTENTS = new Set([
  "eligibility_question",
  "qualification_statement",
]);
const BOOKING_INTENTS = new Set([
  "booking_request",
  "booking_date",
  "booking_time",
  "booking_branch",
  "booking_name",
  "booking_contact",
]);
const STAGE_RANK: Readonly<Record<SalesStage, number>> = {
  NEW: 0,
  DISCOVERY: 1,
  COURSE_EDUCATION: 2,
  QUALIFICATION: 3,
  OBJECTION: 4,
  DEMO_READY: 5,
  BOOKING: 6,
  BOOKED: 7,
  NURTURE: 8,
  STOPPED: 9,
};

type MutableConversationStatePatch = {
  -readonly [Field in keyof ConversationStateUpdatePatch]: ConversationStateUpdatePatch[Field];
};

function addUnique<T>(target: T[], value: T): void {
  if (!target.includes(value)) {
    target.push(value);
  }
}

function addAllUnique<T>(target: T[], values: readonly T[]): void {
  for (const value of values) {
    addUnique(target, value);
  }
}

function copyToolRequest(request: QueryToolRequest): QueryToolRequest {
  return request.tool === "get_course_document"
    ? { tool: request.tool, documentType: request.documentType }
    : { tool: request.tool };
}

function addToolRequest(
  requests: QueryToolRequest[],
  request: QueryToolRequest,
): void {
  const duplicate = requests.some((current) =>
    current.tool === "get_course_document" && request.tool === "get_course_document"
      ? current.documentType === request.documentType
      : current.tool === request.tool,
  );

  if (!duplicate) {
    requests.push(copyToolRequest(request));
  }
}

function hasAnyIntent(
  turnAnalysis: Readonly<TurnAnalysis>,
  intents: ReadonlySet<string>,
): boolean {
  return turnAnalysis.intents.some((intent) => intents.has(intent));
}

function hasDirectAnswer(actions: readonly SalesAction[]): boolean {
  return actions.some(
    (action) =>
      action.startsWith("answer_") ||
      action.startsWith("send_") ||
      action === "escalate_human_request",
  );
}

function isStrongDemoIntent(turnAnalysis: Readonly<TurnAnalysis>): boolean {
  return (
    turnAnalysis.intents.includes("demo_acceptance") ||
    turnAnalysis.intents.includes("booking_request") ||
    turnAnalysis.salesSignal === "strong_demo_intent" ||
    turnAnalysis.salesSignal === "booking_intent"
  );
}

function shouldEvaluateQualification(
  input: SalesDecisionInput,
  strongDemoIntent: boolean,
): boolean {
  return (
    input.turnAnalysis.course !== null &&
    (input.lead.qualification !== null ||
      hasAnyIntent(input.turnAnalysis, QUALIFICATION_INTENTS) ||
      strongDemoIntent ||
      input.turnAnalysis.salesSignal === "positive_interest")
  );
}

function qualificationFromTrustedState(
  input: SalesDecisionInput,
): QualificationDecision | null {
  if (input.lead.qualification !== null) {
    return null;
  }

  if (input.conversation.qualification_status === "QUALIFIED") {
    return { status: "eligible", reason: "persisted_qualified_state" };
  }

  if (input.conversation.qualification_status === "UNQUALIFIED") {
    return { status: "ineligible", reason: "persisted_unqualified_state" };
  }

  return null;
}

function preferredStage(
  current: SalesStage,
  desired: SalesStage | null,
): SalesStage | null {
  if (
    desired === null ||
    current === desired ||
    current === "BOOKED" ||
    current === "NURTURE" ||
    current === "STOPPED"
  ) {
    return null;
  }

  if (desired === "OBJECTION" || STAGE_RANK[desired] > STAGE_RANK[current]) {
    return desired;
  }

  return null;
}

function qualificationStatusFor(
  decision: QualificationDecision,
): Conversation["qualification_status"] | null {
  switch (decision.status) {
    case "eligible":
      return "QUALIFIED";
    case "ineligible":
      return "UNQUALIFIED";
    case "clarification_required":
      return "PENDING";
    case "unknown":
      return null;
  }
}

function leadStatusFor(
  lead: Readonly<Lead>,
  decision: QualificationDecision,
): Lead["lead_status"] | null {
  const next =
    decision.status === "eligible"
      ? "QUALIFIED"
      : decision.status === "ineligible"
        ? "UNQUALIFIED"
        : decision.status === "clarification_required"
          ? "QUALIFYING"
          : null;
  return next !== null && next !== lead.lead_status ? next : null;
}

function businessAuthorizedRouteTools(input: SalesDecisionInput): QueryToolRequest[] {
  const requests: QueryToolRequest[] = [];

  for (const request of input.queryRoute.toolRequests) {
    if (request.tool === "check_demo_availability") {
      continue;
    }

    if (
      request.tool === "get_course_document" &&
      input.turnAnalysis.course !== null
    ) {
      addToolRequest(requests, request);
    }

    if (
      request.tool === "get_branch_location" &&
      input.sources.structuredBranchFacts.status === "loaded"
    ) {
      addToolRequest(requests, request);
    }
  }

  return requests;
}

function bookingProgressPatch(
  progress: DemoBookingProgress,
  status: DemoBookingProgress["status"],
): DemoBookingProgress {
  return { ...progress, status };
}

/**
 * Deterministically decides business obligations and permissions from trusted
 * stage outputs. It performs no I/O and never mutates its inputs.
 */
export function decideSalesAction(input: SalesDecisionInput): SalesDecision {
  const requiredActions: SalesAction[] = [];
  const allowedActions: SalesAction[] = [];
  const blockedActions: SalesAction[] = [];
  const reasonCodes: SalesReasonCode[] = [];
  const toolRequests = businessAuthorizedRouteTools(input);
  const conversationStatePatch: MutableConversationStatePatch = {};
  let followUpQuestionKey: string | null = null;
  let qualificationDecision: QualificationDecision | null = null;
  let leadStatusUpdate: Lead["lead_status"] | null = null;
  let desiredStage: SalesStage | null = null;
  let salesGroup: SalesGroup = "answer_educate";

  for (const intent of input.turnAnalysis.intents) {
    addAllUnique(requiredActions, INTENT_ACTION_OBLIGATIONS[intent]);
  }

  const directAnswer = hasDirectAnswer(requiredActions);
  if (directAnswer) {
    addUnique(
      reasonCodes,
      input.turnAnalysis.intents.length > 1
        ? "MULTI_INTENT_INFORMATION_REQUEST"
        : "DIRECT_INFORMATION_REQUEST",
    );
    if (input.turnAnalysis.course !== null) {
      desiredStage = "COURSE_EDUCATION";
    }
  }

  if (
    input.queryRoute.needsStructuredCourseFacts &&
    input.sources.structuredCourseFacts.status !== "loaded"
  ) {
    addUnique(reasonCodes, "STRUCTURED_SOURCE_UNAVAILABLE");
    addUnique(blockedActions, "invent_fact");
  }

  if (
    input.queryRoute.needsBranchFacts &&
    input.sources.structuredBranchFacts.status !== "loaded"
  ) {
    addUnique(reasonCodes, "STRUCTURED_SOURCE_UNAVAILABLE");
    addUnique(blockedActions, "invent_fact");
  }

  if (input.queryRoute.needsRag && input.sources.rag.status === "deferred") {
    addUnique(reasonCodes, "APPROVED_RAG_DEFERRED");
    addUnique(blockedActions, "invent_fact");
  }

  if (input.turnAnalysis.course === null) {
    addUnique(reasonCodes, "COURSE_UNKNOWN");
  }

  const courseSwitchDeferred =
    input.existingConversationCourse !== null &&
    input.turnAnalysis.course !== null &&
    input.existingConversationCourse.internal_name !== input.turnAnalysis.course;
  if (courseSwitchDeferred) {
    addUnique(reasonCodes, "COURSE_SWITCH_DEFERRED");
    addAllUnique(blockedActions, [
      "offer_demo",
      "check_demo_availability",
      "create_demo_booking",
      "claim_booking_success",
    ]);
  }

  const criticalAmbiguity =
    input.turnAnalysis.ambiguity.some((ambiguity) => ambiguity.critical) ||
    input.semanticNormalization.uncertainty.some((uncertainty) => uncertainty.critical);
  if (criticalAmbiguity) {
    addUnique(requiredActions, "clarify_critical_ambiguity");
    addUnique(reasonCodes, "CRITICAL_AMBIGUITY");
    addAllUnique(blockedActions, [
      "offer_demo",
      "check_demo_availability",
      "create_demo_booking",
      "claim_booking_success",
    ]);
  }

  const stopSignal =
    input.turnAnalysis.intents.includes("not_interested") ||
    input.turnAnalysis.salesSignal === "not_interested" ||
    input.turnAnalysis.salesSignal === "negative";
  if (stopSignal) {
    salesGroup = "nurture_stop";
    addUnique(requiredActions, "acknowledge_stop_signal");
    addUnique(reasonCodes, "STOP_SIGNAL");
    addAllUnique(blockedActions, [
      "proactive_sales_push",
      "offer_demo",
      "check_demo_availability",
      "create_demo_booking",
      "claim_booking_success",
    ]);
  }

  const feeObjection =
    input.turnAnalysis.intents.includes("fee_objection") ||
    input.turnAnalysis.objection === "fee";
  const parentObjection =
    input.turnAnalysis.intents.includes("parent_delay") ||
    input.turnAnalysis.objection === "parent";
  const competitorObjection =
    input.turnAnalysis.intents.includes("competitor_comparison") ||
    input.turnAnalysis.objection === "competitor";
  const demoObjection =
    input.turnAnalysis.intents.includes("demo_rejection") ||
    input.turnAnalysis.objection === "demo_hesitation";

  if (!stopSignal && (feeObjection || parentObjection || competitorObjection || demoObjection)) {
    salesGroup = "handle_objection";
    desiredStage = "OBJECTION";
  }

  if (feeObjection) {
    addUnique(requiredActions, "handle_fee_objection");
    addAllUnique(allowedActions, ["mention_installment", "mention_verified_value"]);
    addAllUnique(blockedActions, ["offer_discount", "unauthorized_negotiation", "fake_urgency"]);
    addUnique(reasonCodes, "OBJECTION_FEE");
  }

  if (parentObjection) {
    addUnique(requiredActions, "handle_parent_objection");
    addAllUnique(allowedActions, ["mention_installment", "mention_parent_counsellor"]);
    addUnique(reasonCodes, "OBJECTION_PARENT");
  }

  if (competitorObjection) {
    addUnique(requiredActions, "handle_competitor_objection");
    addUnique(allowedActions, "mention_verified_value");
    addAllUnique(blockedActions, ["attack_competitor", "offer_discount", "invent_fact"]);
    addUnique(reasonCodes, "OBJECTION_COMPETITOR");
  }

  if (demoObjection) {
    addUnique(requiredActions, "handle_demo_hesitation");
    addUnique(reasonCodes, "OBJECTION_DEMO");
  }

  if (input.turnAnalysis.objection === "timing" && !stopSignal) {
    addUnique(requiredActions, "acknowledge_nurture_signal");
    addUnique(reasonCodes, "NURTURE_SIGNAL");
  }

  const strongDemoIntent = isStrongDemoIntent(input.turnAnalysis);
  const wantsBooking =
    hasAnyIntent(input.turnAnalysis, BOOKING_INTENTS) ||
    input.turnAnalysis.salesSignal === "booking_intent";
  const qualificationRelevant = shouldEvaluateQualification(input, strongDemoIntent);

  if (qualificationRelevant && !courseSwitchDeferred) {
    qualificationDecision =
      qualificationFromTrustedState(input) ??
      evaluateQualification(input.turnAnalysis.course, input.lead.qualification);
    const qualificationStatus = qualificationStatusFor(qualificationDecision);

    if (qualificationStatus !== null) {
      conversationStatePatch.qualification_status = qualificationStatus;
    }
    leadStatusUpdate = leadStatusFor(input.lead, qualificationDecision);

    if (qualificationDecision.status === "eligible") {
      addUnique(reasonCodes, "QUALIFICATION_CONFIRMED");
      if (
        input.conversation.pending_question === "qualification" ||
        input.conversation.pending_question === "qualification_detail"
      ) {
        conversationStatePatch.pending_question = null;
      }
    } else if (qualificationDecision.status === "ineligible") {
      addUnique(requiredActions, "answer_eligibility");
      addUnique(reasonCodes, "QUALIFICATION_FAILED");
      addAllUnique(blockedActions, [
        "offer_demo",
        "check_demo_availability",
        "create_demo_booking",
        "claim_booking_success",
      ]);
      desiredStage = "QUALIFICATION";
      if (
        input.conversation.pending_question === "qualification" ||
        input.conversation.pending_question === "qualification_detail"
      ) {
        conversationStatePatch.pending_question = null;
      }
      if (!directAnswer && !stopSignal) {
        salesGroup = "qualify";
      }
    } else if (qualificationDecision.status === "clarification_required") {
      const action =
        qualificationDecision.questionKey === "qualification"
          ? "ask_qualification"
          : "ask_qualification_detail";
      addUnique(requiredActions, action);
      addUnique(
        reasonCodes,
        qualificationDecision.reason === "qualification_missing"
          ? "QUALIFICATION_REQUIRED"
          : "QUALIFICATION_CLARIFICATION_REQUIRED",
      );
      followUpQuestionKey = qualificationDecision.questionKey;
      conversationStatePatch.pending_question = followUpQuestionKey;
      desiredStage = "QUALIFICATION";
      if (!directAnswer && !stopSignal) {
        salesGroup = "qualify";
      }
    }
  }

  const demoStopped =
    input.conversation.demo_push_status === "STOP_DEMO_PUSH" ||
    input.conversation.demo_push_status === "STOP_ALL_SALES_PUSH";
  if (demoStopped) {
    addUnique(reasonCodes, "DEMO_PUSH_ALREADY_STOPPED");
    addAllUnique(blockedActions, ["offer_demo", "proactive_sales_push"]);
  }

  if (
    input.turnAnalysis.salesSignal === "positive_interest" &&
    !strongDemoIntent &&
    !stopSignal
  ) {
    addUnique(reasonCodes, "CONFIDENCE_GATE_PENDING");
    addUnique(blockedActions, "offer_demo");
  }

  if (directAnswer && !strongDemoIntent) {
    addUnique(blockedActions, "offer_demo");
  }

  if (strongDemoIntent) {
    addUnique(reasonCodes, "DEMO_STRONG_INTENT");
    if (input.turnAnalysis.course === null) {
      addUnique(requiredActions, "ask_course_interest");
      followUpQuestionKey = "course_interest";
      conversationStatePatch.pending_question = "course_interest";
    }
    const courseFacts =
      input.sources.structuredCourseFacts.status === "loaded"
        ? input.sources.structuredCourseFacts.data
        : null;
    const qualified = qualificationDecision?.status === "eligible";
    const demoAvailable = courseFacts?.demo_available === true;
    const progressionBlocked =
      courseSwitchDeferred ||
      criticalAmbiguity ||
      stopSignal ||
      demoStopped ||
      input.turnAnalysis.course === null ||
      courseFacts === null ||
      !qualified ||
      !demoAvailable;

    if (courseFacts !== null && courseFacts.demo_available === false) {
      addUnique(requiredActions, "answer_demo_availability");
      addUnique(reasonCodes, "DEMO_NOT_AVAILABLE_FOR_COURSE");
    }

    if (courseFacts !== null && courseFacts.demo_available === null) {
      addUnique(reasonCodes, "STRUCTURED_SOURCE_UNAVAILABLE");
      addUnique(blockedActions, "invent_fact");
    }

    if (progressionBlocked) {
      addAllUnique(blockedActions, [
        "offer_demo",
        "check_demo_availability",
        "create_demo_booking",
        "claim_booking_success",
      ]);
    } else if (wantsBooking) {
      salesGroup = "booking_progression";
      desiredStage = "BOOKING";
      const progress = buildDemoBookingProgress({
        persisted: input.conversation.booking_progress_json,
        semanticNormalization: input.semanticNormalization,
        turnAnalysis: input.turnAnalysis,
        lead: input.lead,
        sources: input.sources,
      });
      const missing = nextMissingBookingField(progress);

      addAllUnique(blockedActions, ["create_demo_booking", "claim_booking_success"]);
      addUnique(reasonCodes, "BOOKING_EXECUTION_DEFERRED");

      if (missing !== null) {
        addUnique(requiredActions, missing.action);
        addUnique(reasonCodes, "BOOKING_FIELDS_MISSING");
        followUpQuestionKey = missing.questionKey;
        conversationStatePatch.pending_question = missing.questionKey;
        conversationStatePatch.booking_progress_json = bookingProgressPatch(
          progress,
          "COLLECTING",
        );
      } else {
        addUnique(requiredActions, "check_demo_availability");
        addUnique(reasonCodes, "BOOKING_AVAILABILITY_REQUIRED");
        addToolRequest(toolRequests, { tool: "check_demo_availability" });
        conversationStatePatch.pending_question = null;
        conversationStatePatch.booking_progress_json = bookingProgressPatch(
          progress,
          "CHECKING",
        );
      }
    } else {
      salesGroup = "demo_progression";
      desiredStage = "DEMO_READY";
      addUnique(allowedActions, "offer_demo");
    }
  }

  if (
    !stopSignal &&
    salesGroup === "answer_educate" &&
    qualificationRelevant &&
    !directAnswer &&
    qualificationDecision?.status !== "eligible"
  ) {
    salesGroup = "qualify";
  }

  const nextStage = courseSwitchDeferred
    ? null
    : preferredStage(input.conversation.current_sales_stage, desiredStage);
  if (nextStage !== null) {
    conversationStatePatch.current_sales_stage = nextStage;
  }

  return {
    salesGroup,
    requiredActions: [...requiredActions],
    allowedActions: [...allowedActions],
    blockedActions: [...blockedActions],
    reasonCodes: [...reasonCodes],
    nextStage,
    conversationStatePatch,
    leadStatusUpdate,
    toolRequests: toolRequests.map(copyToolRequest),
    followUpQuestionKey,
    qualificationDecision,
  };
}
