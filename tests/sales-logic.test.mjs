import assert from "node:assert/strict";
import test from "node:test";

import { decideSalesAction } from "../src/core/sales-logic/decide-sales-action.ts";
import { INTENT_ACTION_OBLIGATIONS } from "../src/core/sales-logic/intent-obligations.ts";
import { TURN_INTENTS } from "../src/core/types/turn-analysis.ts";
import { routeQuery } from "../src/core/routing/query-router.ts";
import { getConfidenceSnapshot } from "../src/core/confidence/confidence-engine.ts";

function lead(overrides = {}) {
  return {
    id: "lead-1",
    channel: "telegram",
    channel_user_id: "101",
    name: null,
    phone: null,
    preferred_language: null,
    qualification: null,
    current_course_interest_id: null,
    branch_preference_id: null,
    lead_status: "NEW",
    created_at: "2026-09-22T10:00:00.000Z",
    updated_at: "2026-09-22T10:00:00.000Z",
    ...overrides,
  };
}

function conversation(overrides = {}) {
  return {
    id: "conversation-1",
    lead_id: "lead-1",
    channel: "telegram",
    status: null,
    current_course_id: null,
    current_sales_stage: "NEW",
    qualification_status: "UNKNOWN",
    confidence_state_json: {},
    demo_push_status: "NORMAL",
    demo_rejection_count: 0,
    pending_question: null,
    booking_progress_json: {},
    created_at: "2026-09-22T10:00:00.000Z",
    updated_at: "2026-09-22T10:00:00.000Z",
    ...overrides,
  };
}

function course(overrides = {}) {
  return {
    id: "course-data-analytics",
    internal_name: "data_analytics",
    student_facing_name: "Data Analytics",
    slug: "data-analytics",
    duration_months: 6,
    learning_months: 4,
    internship_months: 2,
    base_fee: 100,
    gst_percentage: 18,
    fee_including_gst: 118,
    admission_fee: 10,
    total_fee: 128,
    eligibility_summary: "Approved stored fact",
    installment_rules_json: {},
    class_duration_minutes: 90,
    batch_start_rule: "Approved stored rule",
    certificate_summary: "Approved stored fact",
    placement_assistance: true,
    laptop_required: true,
    demo_available: true,
    course_status: "active",
    created_at: "2026-09-22T10:00:00.000Z",
    updated_at: "2026-09-22T10:00:00.000Z",
    ...overrides,
  };
}

function branch(overrides = {}) {
  return {
    id: "branch-calicut",
    name: "Calicut",
    address: "Stored address",
    google_maps_url: "https://example.test/maps",
    wifi: true,
    parking: true,
    computer_lab: true,
    ac_classroom: true,
    boys_hostel_available: false,
    boys_hostel_fee: null,
    boys_hostel_food: null,
    boys_hostel_distance: null,
    boys_hostel_room_type: null,
    girls_hostel_available: false,
    girls_hostel_fee: null,
    girls_hostel_food: null,
    girls_hostel_distance: null,
    girls_hostel_room_type: null,
    other_facilities_json: {},
    created_at: "2026-09-22T10:00:00.000Z",
    updated_at: "2026-09-22T10:00:00.000Z",
    ...overrides,
  };
}

function semantic(overrides = {}) {
  return {
    normalizedEnglish: "What is the Data Analytics fee?",
    detectedOriginalLanguage: "manglish",
    uncertainty: [],
    preservedEntities: [{ type: "course", value: "Data Analytics" }],
    ...overrides,
  };
}

function turn(overrides = {}) {
  return {
    language: "manglish",
    requestedResponseLanguage: null,
    course: "data_analytics",
    intents: ["fee_question"],
    leadFacts: {
      name: null,
      qualification: null,
      branchPreference: null,
      contact: null,
    },
    objection: null,
    salesSignal: "information_seeking",
    intentRelationship: "single",
    ambiguity: [],
    ...overrides,
  };
}

function defaultSources(analyzedTurn, queryRoute, storedCourse = course()) {
  const storedBranch = branch();
  return {
    structuredCourseFacts: queryRoute.needsStructuredCourseFacts
      ? analyzedTurn.course === null
        ? { status: "unresolved", data: null, reason: "canonical_course_unavailable" }
        : { status: "loaded", data: storedCourse }
      : { status: "not_required", data: null },
    structuredBranchFacts: queryRoute.needsBranchFacts
      ? { status: "loaded", data: [storedBranch] }
      : { status: "not_required", data: null },
    courseBranchMapping: { status: "not_required", data: null },
    memorySource: queryRoute.needsMemory
      ? { status: "loaded", data: lead() }
      : { status: "not_required", data: null },
    stateSource: queryRoute.needsState
      ? {
          status: "loaded",
          data: {
            currentCourseId: null,
            currentSalesStage: "NEW",
            qualificationStatus: "UNKNOWN",
            demoPushStatus: "NORMAL",
            demoRejectionCount: 0,
            pendingQuestion: null,
            bookingProgress: {},
            confidenceState: {},
          },
        }
      : { status: "not_required", data: null },
    rag: queryRoute.needsRag
      ? { status: "deferred", data: null, reason: "rag_retrieval_not_implemented" }
      : { status: "not_required", data: null },
    tools:
      queryRoute.toolRequests.length > 0
        ? {
            status: "deferred",
            requests: queryRoute.toolRequests,
            reason: "tool_execution_not_implemented",
          }
        : { status: "not_required", requests: [] },
  };
}

function decide(overrides = {}) {
  const analyzedTurn = turn(overrides.turn);
  const queryRoute = routeQuery(analyzedTurn);
  const storedCourse = overrides.course ??
    course({
      internal_name: analyzedTurn.course ?? "data_analytics",
      student_facing_name:
        analyzedTurn.course === "digital_marketing"
          ? "Digital Marketing"
          : analyzedTurn.course === "accounting"
            ? "Accounting"
            : "Data Analytics",
    });
  return decideSalesAction({
    semanticNormalization: semantic(overrides.semantic),
    turnAnalysis: analyzedTurn,
    lead: lead(overrides.lead),
    conversation: conversation(overrides.conversation),
    existingConversationCourse: overrides.existingConversationCourse ?? null,
    queryRoute,
    sources:
      overrides.sources ?? defaultSources(analyzedTurn, queryRoute, storedCourse),
    confidence:
      overrides.confidence ??
      getConfidenceSnapshot(conversation(overrides.conversation).confidence_state_json),
  });
}

test("intent obligations cover the complete TurnAnalysis vocabulary", () => {
  assert.deepEqual(Object.keys(INTENT_ACTION_OBLIGATIONS), [...TURN_INTENTS]);
});

test("simple fee question preserves the answer and does not start demo progression", () => {
  const result = decide();
  assert.deepEqual(result.requiredActions, ["answer_fee"]);
  assert.equal(result.salesGroup, "answer_educate");
  assert.ok(result.blockedActions.includes("offer_demo"));
  assert.equal(result.toolRequests.length, 0);
});

test("fee, internship, and placement preserve all obligations in stable order", () => {
  const result = decide({
    turn: {
      intents: ["fee_question", "internship_question", "placement_question"],
      intentRelationship: "independent",
    },
  });
  assert.deepEqual(result.requiredActions.slice(0, 3), [
    "answer_fee",
    "answer_internship",
    "answer_placement",
  ]);
  assert.ok(result.reasonCodes.includes("MULTI_INTENT_INFORMATION_REQUEST"));
});

test("direct answers remain before strong demo progression", () => {
  const result = decide({
    lead: { qualification: "B.Sc completed" },
    turn: {
      intents: ["fee_question", "placement_question", "demo_acceptance"],
      salesSignal: "strong_demo_intent",
      intentRelationship: "independent",
    },
  });
  assert.deepEqual(result.requiredActions.slice(0, 2), ["answer_fee", "answer_placement"]);
  assert.equal(result.salesGroup, "demo_progression");
  assert.ok(result.allowedActions.includes("offer_demo"));
});

test("Data Analytics accepts a known completed degree", () => {
  const result = decide({
    lead: { qualification: "Completed B.Sc degree" },
    turn: { intents: ["qualification_statement"] },
  });
  assert.equal(result.qualificationDecision.status, "eligible");
  assert.equal(result.conversationStatePatch.qualification_status, "QUALIFIED");
  assert.equal(result.leadStatusUpdate, "QUALIFIED");
});

test("Data Analytics rejects explicit Plus Two only", () => {
  const result = decide({
    lead: { qualification: "Plus Two only" },
    turn: {
      intents: ["qualification_statement", "booking_request"],
      salesSignal: "booking_intent",
      intentRelationship: "dependent",
    },
  });
  assert.equal(result.qualificationDecision.status, "ineligible");
  assert.equal(result.conversationStatePatch.qualification_status, "UNQUALIFIED");
  assert.equal(result.leadStatusUpdate, "UNQUALIFIED");
  assert.ok(result.blockedActions.includes("offer_demo"));
  assert.ok(result.blockedActions.includes("create_demo_booking"));
});

test("missing Data Analytics qualification asks one question and marks pending", () => {
  const result = decide({
    turn: { intents: ["qualification_statement"], salesSignal: "positive_interest" },
  });
  assert.equal(result.qualificationDecision.status, "clarification_required");
  assert.deepEqual(result.requiredActions, ["ask_qualification"]);
  assert.equal(result.followUpQuestionKey, "qualification");
  assert.equal(result.conversationStatePatch.pending_question, "qualification");
  assert.equal(result.conversationStatePatch.qualification_status, "PENDING");
  assert.equal(result.leadStatusUpdate, "QUALIFYING");
});

test("Digital Marketing accepts Plus Two", () => {
  const result = decide({
    lead: { qualification: "12th completed" },
    turn: { course: "digital_marketing", intents: ["qualification_statement"] },
  });
  assert.equal(result.qualificationDecision.status, "eligible");
});

test("Digital Marketing does not disqualify lack of prior experience or coding", () => {
  const result = decide({
    lead: { qualification: "Plus Two, no marketing or coding experience" },
    turn: { course: "digital_marketing", intents: ["qualification_statement"] },
  });
  assert.equal(result.qualificationDecision.status, "eligible");
  assert.notEqual(result.leadStatusUpdate, "UNQUALIFIED");
});

test("Accounting accepts B.Com", () => {
  const result = decide({
    lead: { qualification: "B.Com completed" },
    turn: { course: "accounting", intents: ["qualification_statement"] },
  });
  assert.equal(result.qualificationDecision.status, "eligible");
});

test("Accounting requests clarification for an unlisted background", () => {
  const result = decide({
    lead: { qualification: "Diploma in business studies" },
    turn: { course: "accounting", intents: ["qualification_statement"] },
  });
  assert.equal(result.qualificationDecision.status, "clarification_required");
  assert.equal(result.qualificationDecision.questionKey, "qualification_detail");
  assert.ok(result.requiredActions.includes("ask_qualification_detail"));
  assert.notEqual(result.leadStatusUpdate, "QUALIFIED");
});

test("fee objection requires handling and blocks unsafe negotiation", () => {
  const result = decide({
    turn: { intents: ["fee_objection"], objection: "fee", salesSignal: "objection" },
  });
  assert.ok(result.requiredActions.includes("handle_fee_objection"));
  assert.ok(result.allowedActions.includes("mention_installment"));
  assert.ok(result.blockedActions.includes("offer_discount"));
  assert.ok(result.blockedActions.includes("unauthorized_negotiation"));
  assert.equal(result.salesGroup, "handle_objection");
});

test("competitor objection blocks attacks, discounts, and invented facts", () => {
  const result = decide({
    turn: {
      intents: ["competitor_comparison"],
      objection: "competitor",
      salesSignal: "objection",
    },
  });
  assert.ok(result.requiredActions.includes("handle_competitor_objection"));
  assert.ok(result.blockedActions.includes("attack_competitor"));
  assert.ok(result.blockedActions.includes("offer_discount"));
  assert.ok(result.blockedActions.includes("invent_fact"));
});

test("parent delay is handled without M29 nurture persistence", () => {
  const result = decide({
    turn: { intents: ["parent_delay"], objection: "parent", salesSignal: "hesitation" },
  });
  assert.ok(result.requiredActions.includes("handle_parent_objection"));
  assert.equal(result.conversationStatePatch.demo_push_status, undefined);
  assert.notEqual(result.nextStage, "NURTURE");
  assert.notEqual(result.leadStatusUpdate, "NURTURE");
});

test("demo hesitation does not mutate rejection count or push state", () => {
  const result = decide({
    conversation: { demo_rejection_count: 1 },
    turn: { intents: ["demo_rejection"], objection: "demo_hesitation", salesSignal: "hesitation" },
  });
  assert.ok(result.requiredActions.includes("handle_demo_hesitation"));
  assert.equal(result.conversationStatePatch.demo_rejection_count, undefined);
  assert.equal(result.conversationStatePatch.demo_push_status, undefined);
});

test("positive interest below the M27 confidence gate remains blocked", () => {
  const result = decide({
    turn: { intents: ["course_overview"], salesSignal: "positive_interest" },
  });
  assert.ok(result.reasonCodes.includes("DEMO_GATE_NOT_READY"));
  assert.ok(result.blockedActions.includes("offer_demo"));
  assert.notEqual(result.nextStage, "DEMO_READY");
});

test("positive interest with trusted qualifying coverage permits normal demo progression", () => {
  const result = decide({
    lead: { qualification: "Bachelor degree completed" },
    turn: { intents: ["course_overview"], salesSignal: "positive_interest" },
    confidence: getConfidenceSnapshot({
      course: { structure: true, whatLearn: true },
      fees: { feeBasics: true, totalClarity: true },
      placement: { assistance: true, supportProcess: true },
      internship: { availabilityDuration: true, nature: true, process: true },
      branches: { availability: true, location: true },
    }),
  });
  assert.ok(result.reasonCodes.includes("DEMO_GATE_READY"));
  assert.ok(result.allowedActions.includes("offer_demo"));
  assert.ok(!result.blockedActions.includes("offer_demo"));
  assert.equal(result.nextStage, "DEMO_READY");
  assert.ok(result.requiredActions.includes("answer_course"));
});

test("strong explicit demo intent bypasses confidence only when qualified and available", () => {
  const result = decide({
    lead: { qualification: "Bachelor degree completed" },
    turn: { intents: ["demo_acceptance"], salesSignal: "strong_demo_intent" },
  });
  assert.ok(result.reasonCodes.includes("DEMO_STRONG_INTENT"));
  assert.ok(result.allowedActions.includes("offer_demo"));
  assert.equal(result.nextStage, "DEMO_READY");
  assert.ok(!result.reasonCodes.includes("CONFIDENCE_GATE_PENDING"));
});

test("strong demo intent with unknown qualification qualifies first", () => {
  const result = decide({
    turn: { intents: ["demo_acceptance"], salesSignal: "strong_demo_intent" },
  });
  assert.equal(result.salesGroup, "qualify");
  assert.ok(result.requiredActions.includes("ask_qualification"));
  assert.ok(result.blockedActions.includes("offer_demo"));
});

test("strong demo intent cannot override ineligibility", () => {
  const result = decide({
    lead: { qualification: "12th only" },
    turn: { intents: ["demo_acceptance"], salesSignal: "strong_demo_intent" },
  });
  assert.equal(result.qualificationDecision.status, "ineligible");
  assert.ok(result.blockedActions.includes("offer_demo"));
  assert.ok(result.blockedActions.includes("create_demo_booking"));
});

test("a course with demo unavailable blocks demo and booking progression", () => {
  const result = decide({
    lead: { qualification: "B.Com completed" },
    course: course({ internal_name: "accounting", demo_available: false }),
    turn: {
      course: "accounting",
      intents: ["demo_acceptance", "booking_request"],
      salesSignal: "booking_intent",
      intentRelationship: "dependent",
    },
  });
  assert.ok(result.requiredActions.includes("answer_demo_availability"));
  assert.ok(result.reasonCodes.includes("DEMO_NOT_AVAILABLE_FOR_COURSE"));
  assert.ok(result.blockedActions.includes("offer_demo"));
  assert.ok(result.blockedActions.includes("create_demo_booking"));
});

test("existing STOP_DEMO_PUSH is respected without M29 mutation", () => {
  const result = decide({
    lead: { qualification: "Degree completed" },
    conversation: { demo_push_status: "STOP_DEMO_PUSH" },
    turn: { intents: ["demo_acceptance"], salesSignal: "strong_demo_intent" },
  });
  assert.ok(result.reasonCodes.includes("DEMO_PUSH_ALREADY_STOPPED"));
  assert.ok(result.blockedActions.includes("offer_demo"));
  assert.equal(result.conversationStatePatch.demo_push_status, undefined);
});

test("booking progression safely normalizes malformed state and asks one next field", () => {
  const result = decide({
    lead: { qualification: "Degree completed" },
    conversation: { booking_progress_json: "malformed" },
    turn: { intents: ["booking_request"], salesSignal: "booking_intent" },
  });
  assert.equal(result.salesGroup, "booking_progression");
  assert.equal(result.followUpQuestionKey, "booking_name");
  assert.deepEqual(
    result.requiredActions.filter((action) => action.startsWith("ask_booking_")),
    ["ask_booking_name"],
  );
  assert.equal(result.conversationStatePatch.booking_progress_json.status, "COLLECTING");
});

test("known booking fields are retained and not asked again", () => {
  const result = decide({
    lead: { qualification: "Degree completed" },
    conversation: {
      booking_progress_json: {
        name: "Asha",
        contact: null,
        course: "data_analytics",
        branch: "Calicut",
        date: "2026-10-01",
        time: "10:00",
        status: "COLLECTING",
      },
    },
    turn: { intents: ["booking_request"], salesSignal: "booking_intent" },
  });
  assert.equal(result.followUpQuestionKey, "booking_contact");
  assert.ok(!result.requiredActions.includes("ask_booking_name"));
  assert.equal(result.conversationStatePatch.booking_progress_json.name, "Asha");
});

test("complete booking preparation authorizes availability check without claiming success", () => {
  const result = decide({
    lead: { qualification: "Degree completed", name: "Asha", phone: "9999999999" },
    conversation: {
      booking_progress_json: {
        name: "Asha",
        contact: "9999999999",
        course: "data_analytics",
        branch: "Calicut",
        date: "2026-10-01",
        time: "10:00",
        status: "COLLECTING",
      },
    },
    turn: { intents: ["booking_request"], salesSignal: "booking_intent" },
  });
  assert.ok(result.requiredActions.includes("check_demo_availability"));
  assert.deepEqual(result.toolRequests, [{ tool: "check_demo_availability" }]);
  assert.equal(result.conversationStatePatch.booking_progress_json.status, "CHECKING");
  assert.ok(!result.requiredActions.includes("claim_booking_success"));
});

test("booking creation and success claims remain blocked and deferred", () => {
  const result = decide({
    lead: { qualification: "Degree completed" },
    turn: { intents: ["booking_request"], salesSignal: "booking_intent" },
  });
  assert.ok(result.blockedActions.includes("create_demo_booking"));
  assert.ok(result.blockedActions.includes("claim_booking_success"));
  assert.ok(result.reasonCodes.includes("BOOKING_EXECUTION_DEFERRED"));
  assert.notEqual(result.nextStage, "BOOKED");
});

test("not interested blocks current-turn sales push without persistent M29 stop", () => {
  const result = decide({
    turn: { course: null, intents: ["not_interested"], salesSignal: "not_interested" },
  });
  assert.equal(result.salesGroup, "nurture_stop");
  assert.ok(result.requiredActions.includes("acknowledge_stop_signal"));
  assert.ok(result.blockedActions.includes("proactive_sales_push"));
  assert.equal(result.conversationStatePatch.demo_push_status, undefined);
  assert.notEqual(result.nextStage, "STOPPED");
});

test("explicit different course preserves answers but defers stateful switching", () => {
  const result = decide({
    lead: { qualification: "Degree completed" },
    conversation: { current_course_id: "course-digital-marketing" },
    existingConversationCourse: course({
      id: "course-digital-marketing",
      internal_name: "digital_marketing",
    }),
    turn: {
      course: "data_analytics",
      intents: ["fee_question", "booking_request", "course_switch"],
      salesSignal: "booking_intent",
      intentRelationship: "mixed",
    },
  });
  assert.ok(result.requiredActions.includes("answer_fee"));
  assert.ok(result.reasonCodes.includes("COURSE_SWITCH_DEFERRED"));
  assert.ok(result.blockedActions.includes("create_demo_booking"));
  assert.equal(result.conversationStatePatch.current_course_id, undefined);
  assert.equal(result.nextStage, null);
});

test("critical ambiguity preserves safe answers and blocks dependent progression", () => {
  const result = decide({
    lead: { qualification: "Degree completed" },
    turn: {
      intents: ["fee_question", "booking_request"],
      salesSignal: "booking_intent",
      intentRelationship: "dependent",
      ambiguity: [{ field: "booking_date", description: "two dates", critical: true }],
    },
  });
  assert.ok(result.requiredActions.includes("answer_fee"));
  assert.ok(result.requiredActions.includes("clarify_critical_ambiguity"));
  assert.ok(result.reasonCodes.includes("CRITICAL_AMBIGUITY"));
  assert.ok(result.blockedActions.includes("check_demo_availability"));
});

test("decision output is deduplicated, deterministic, and does not mutate inputs", () => {
  const analyzedTurn = Object.freeze({
    ...turn({
      intents: Object.freeze(["fee_objection", "fee_objection", "fee_question"]),
      objection: "fee",
      salesSignal: "objection",
      intentRelationship: "mixed",
    }),
    leadFacts: Object.freeze(turn().leadFacts),
    ambiguity: Object.freeze([]),
  });
  const queryRoute = Object.freeze({
    ...routeQuery(analyzedTurn),
    toolRequests: Object.freeze([]),
  });
  const storedLead = Object.freeze(lead());
  const storedConversation = Object.freeze(conversation());
  const normalized = Object.freeze({
    ...semantic(),
    uncertainty: Object.freeze([]),
    preservedEntities: Object.freeze([
      Object.freeze({ type: "course", value: "Data Analytics" }),
    ]),
  });
  const sources = Object.freeze(defaultSources(analyzedTurn, queryRoute));
  const input = Object.freeze({
    semanticNormalization: normalized,
    turnAnalysis: analyzedTurn,
    lead: storedLead,
    conversation: storedConversation,
    existingConversationCourse: null,
    queryRoute,
    sources,
    confidence: getConfidenceSnapshot(storedConversation.confidence_state_json),
  });

  const first = decideSalesAction(input);
  const second = decideSalesAction(input);
  assert.deepEqual(first, second);
  for (const values of [
    first.requiredActions,
    first.allowedActions,
    first.blockedActions,
    first.reasonCodes,
  ]) {
    assert.equal(new Set(values).size, values.length);
  }
  assert.strictEqual(input.lead, storedLead);
  assert.strictEqual(input.conversation, storedConversation);
  assert.strictEqual(input.turnAnalysis, analyzedTurn);
});

test("missing optional structured truth returns a safe decision instead of throwing", () => {
  const analyzedTurn = turn();
  const queryRoute = routeQuery(analyzedTurn);
  const sources = defaultSources(analyzedTurn, queryRoute);
  sources.structuredCourseFacts = {
    status: "unresolved",
    data: null,
    reason: "course_record_not_found",
  };
  const result = decideSalesAction({
    semanticNormalization: semantic(),
    turnAnalysis: analyzedTurn,
    lead: lead(),
    conversation: conversation(),
    existingConversationCourse: null,
    queryRoute,
    sources,
    confidence: getConfidenceSnapshot(conversation().confidence_state_json),
  });
  assert.ok(result.requiredActions.includes("answer_fee"));
  assert.ok(result.reasonCodes.includes("STRUCTURED_SOURCE_UNAVAILABLE"));
  assert.ok(result.blockedActions.includes("invent_fact"));
});
