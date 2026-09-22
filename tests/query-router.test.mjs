import assert from "node:assert/strict";
import test from "node:test";

import {
  INTENT_ROUTING_RULES,
  ROUTED_INTENTS,
  routeQuery,
} from "../src/core/routing/query-router.ts";
import { TURN_INTENTS } from "../src/core/types/turn-analysis.ts";

const EMPTY_LEAD_FACTS = {
  name: null,
  qualification: null,
  branchPreference: null,
  contact: null,
};

function analysis(intents, overrides = {}) {
  return {
    language: "manglish",
    requestedResponseLanguage: null,
    course: "data_analytics",
    intents,
    leadFacts: EMPTY_LEAD_FACTS,
    objection: null,
    salesSignal: "information_seeking",
    intentRelationship: intents.length === 1 ? "single" : "independent",
    ambiguity: [],
    ...overrides,
  };
}

function expectedRoute(overrides = {}) {
  return {
    needsStructuredCourseFacts: false,
    needsBranchFacts: false,
    needsRag: false,
    needsMemory: false,
    needsState: false,
    toolRequests: [],
    ...overrides,
  };
}

test("fee routes to structured course facts without RAG or tools", () => {
  assert.deepEqual(
    routeQuery(analysis(["fee_question"])),
    expectedRoute({ needsStructuredCourseFacts: true }),
  );
});

test("deep course explanation routes to RAG without unnecessary DB facts", () => {
  assert.deepEqual(
    routeQuery(analysis(["practical_learning"])),
    expectedRoute({ needsRag: true }),
  );
});

test("general internship routes to structured facts and RAG", () => {
  const route = routeQuery(analysis(["internship_question"]));

  assert.equal(route.needsStructuredCourseFacts, true);
  assert.equal(route.needsRag, true);
});

test("placement routes to structured facts and RAG", () => {
  const route = routeQuery(analysis(["placement_question"]));

  assert.equal(route.needsStructuredCourseFacts, true);
  assert.equal(route.needsRag, true);
});

test("qualification and eligibility require memory and course facts without a decision", () => {
  const route = routeQuery(
    analysis(["qualification_statement", "eligibility_question"]),
  );

  assert.equal(route.needsMemory, true);
  assert.equal(route.needsStructuredCourseFacts, true);
  assert.equal("eligible" in route, false);
  assert.equal("eligibility" in route, false);
});

test("branch and facility questions route only to branch facts", () => {
  assert.deepEqual(
    routeQuery(analysis(["branch_question", "facility_question"])),
    expectedRoute({ needsBranchFacts: true }),
  );
});

test("location requires branch facts, memory, and a symbolic location tool", () => {
  assert.deepEqual(
    routeQuery(analysis(["location_question"])),
    expectedRoute({
      needsBranchFacts: true,
      needsMemory: true,
      toolRequests: [{ tool: "get_branch_location" }],
    }),
  );
});

test("brochure request emits a document descriptor without a URL or path", () => {
  const route = routeQuery(analysis(["brochure_request"]));

  assert.deepEqual(route.toolRequests, [
    { tool: "get_course_document", documentType: "brochure" },
  ]);
  assert.equal(JSON.stringify(route).includes("url"), false);
  assert.equal(JSON.stringify(route).includes("path"), false);
});

test("different course document types remain distinct", () => {
  const route = routeQuery(
    analysis(["brochure_request", "syllabus_request"]),
  );

  assert.deepEqual(route.toolRequests, [
    { tool: "get_course_document", documentType: "brochure" },
    { tool: "get_course_document", documentType: "syllabus" },
  ]);
});

test("booking request needs facts, memory, and state but never creates a booking", () => {
  const route = routeQuery(analysis(["booking_request"]));

  assert.equal(route.needsStructuredCourseFacts, true);
  assert.equal(route.needsMemory, true);
  assert.equal(route.needsState, true);
  assert.deepEqual(route.toolRequests, []);
  assert.equal(JSON.stringify(route).includes("create_demo_booking"), false);
});

test("booking date and time request one symbolic availability check", () => {
  const route = routeQuery(analysis(["booking_date", "booking_time"]));

  assert.equal(route.needsMemory, true);
  assert.equal(route.needsState, true);
  assert.deepEqual(route.toolRequests, [{ tool: "check_demo_availability" }]);
  assert.equal("toolResult" in route, false);
});

test("demo rejection routes to state without a business decision", () => {
  assert.deepEqual(
    routeQuery(analysis(["demo_rejection"])),
    expectedRoute({ needsState: true }),
  );
});

test("parent delay and not-interested signals route only to state", () => {
  assert.deepEqual(
    routeQuery(analysis(["parent_delay", "not_interested"])),
    expectedRoute({ needsState: true }),
  );
});

test("course switch requires course facts, memory, and state without mutation", () => {
  const input = analysis(["course_switch"], { course: "accounting" });
  const before = structuredClone(input);
  const route = routeQuery(input);

  assert.equal(route.needsStructuredCourseFacts, true);
  assert.equal(route.needsMemory, true);
  assert.equal(route.needsState, true);
  assert.deepEqual(input, before);
  assert.equal("activeCourse" in route, false);
});

test("multi-intent routing unions every source requirement", () => {
  const route = routeQuery(
    analysis([
      "fee_question",
      "internship_question",
      "placement_question",
    ]),
  );

  assert.equal(route.needsStructuredCourseFacts, true);
  assert.equal(route.needsRag, true);
});

test("critical course ambiguity remains unresolved while sources are routed", () => {
  const input = analysis(["branch_question"], {
    course: null,
    ambiguity: [
      {
        field: "course",
        description: "DTA is an unresolved course identifier.",
        critical: true,
      },
    ],
  });
  const route = routeQuery(input);

  assert.equal(input.course, null);
  assert.equal(route.needsBranchFacts, true);
  assert.equal(route.needsState, true);
  assert.equal("course" in route, false);
  assert.doesNotMatch(JSON.stringify(route), /data_analytics|accounting|sap/i);
});

test("missing course context adds state without guessing the course", () => {
  const input = analysis(["fee_question"], { course: null });
  const route = routeQuery(input);

  assert.equal(route.needsStructuredCourseFacts, true);
  assert.equal(route.needsState, true);
  assert.equal(input.course, null);
  assert.equal("course" in route, false);
});

test("greeting avoids unnecessary source retrieval", () => {
  assert.deepEqual(routeQuery(analysis(["greeting"])), expectedRoute());
});

test("equivalent tool requests are deduplicated", () => {
  assert.deepEqual(
    routeQuery(analysis(["booking_date", "booking_time"])).toolRequests,
    [{ tool: "check_demo_availability" }],
  );
});

test("authority-sensitive intents retain their required trusted sources", () => {
  const expectations = {
    fee_question: { needsStructuredCourseFacts: true },
    eligibility_question: {
      needsStructuredCourseFacts: true,
      needsMemory: true,
    },
    certificate_question: { needsStructuredCourseFacts: true },
    internship_certificate: {
      needsStructuredCourseFacts: true,
      needsRag: true,
    },
    placement_question: {
      needsStructuredCourseFacts: true,
      needsRag: true,
    },
    internship_question: {
      needsStructuredCourseFacts: true,
      needsRag: true,
    },
    location_question: {
      needsBranchFacts: true,
      needsMemory: true,
      toolRequests: [{ tool: "get_branch_location" }],
    },
    booking_request: {
      needsStructuredCourseFacts: true,
      needsMemory: true,
      needsState: true,
      toolRequests: [],
    },
    booking_date: {
      needsStructuredCourseFacts: true,
      needsMemory: true,
      needsState: true,
      toolRequests: [{ tool: "check_demo_availability" }],
    },
    booking_time: {
      needsStructuredCourseFacts: true,
      needsMemory: true,
      needsState: true,
      toolRequests: [{ tool: "check_demo_availability" }],
    },
  };

  for (const [intent, expected] of Object.entries(expectations)) {
    const route = routeQuery(analysis([intent]));

    for (const [field, value] of Object.entries(expected)) {
      assert.deepEqual(route[field], value, `${intent}.${field}`);
    }
  }
});

test("every approved intent has exactly one explicit routing rule", () => {
  assert.deepEqual(ROUTED_INTENTS, TURN_INTENTS);
  assert.deepEqual(Object.keys(INTENT_ROUTING_RULES), [...TURN_INTENTS]);

  for (const intent of TURN_INTENTS) {
    assert.ok(INTENT_ROUTING_RULES[intent]);
  }
});

test("routing does not mutate TurnAnalysis input", () => {
  const input = analysis(
    ["location_question", "brochure_request", "booking_time"],
    {
      leadFacts: { ...EMPTY_LEAD_FACTS, branchPreference: "Calicut" },
    },
  );
  const before = structuredClone(input);

  routeQuery(input);

  assert.deepEqual(input, before);
});

test("routing is deterministic for the same validated analysis", () => {
  const input = analysis([
    "fee_question",
    "internship_question",
    "location_question",
    "brochure_request",
  ]);

  assert.deepEqual(routeQuery(input), routeQuery(input));
});
