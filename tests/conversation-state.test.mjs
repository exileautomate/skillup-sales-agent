import assert from "node:assert/strict";
import test from "node:test";

import {
  applyConversationState,
  deriveConversationStateUpdate,
  getConversationState,
  persistConversationStatePatch,
} from "../src/core/state/conversation-state.ts";

function conversation(overrides = {}) {
  return {
    id: "conversation-1",
    lead_id: "lead-1",
    channel: "telegram",
    status: null,
    current_course_id: null,
    current_sales_stage: "NEW",
    qualification_status: "UNKNOWN",
    confidence_state_json: { course: 0 },
    demo_push_status: "NORMAL",
    demo_rejection_count: 0,
    pending_question: null,
    booking_progress_json: { date: null },
    created_at: "2026-09-22T10:00:00.000Z",
    updated_at: "2026-09-22T10:00:00.000Z",
    ...overrides,
  };
}

function semanticNormalization(overrides = {}) {
  return {
    normalizedEnglish: "Tell me about Data Analytics",
    detectedOriginalLanguage: "english",
    uncertainty: [],
    preservedEntities: [{ type: "course", value: "Data Analytics" }],
    ...overrides,
  };
}

function turnAnalysis(overrides = {}) {
  return {
    language: "english",
    requestedResponseLanguage: null,
    course: "data_analytics",
    intents: ["course_overview"],
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

function course(overrides = {}) {
  return {
    id: "course-data-analytics",
    internal_name: "data_analytics",
    ...overrides,
  };
}

test("maps a persisted Conversation row into the M25 state snapshot", () => {
  assert.deepEqual(getConversationState(conversation({
    current_course_id: "course-1",
    current_sales_stage: "BOOKING",
    qualification_status: "PENDING",
    demo_push_status: "NURTURE",
    demo_rejection_count: 2,
    pending_question: "Which branch?",
  })), {
    currentCourseId: "course-1",
    currentSalesStage: "BOOKING",
    qualificationStatus: "PENDING",
    demoPushStatus: "NURTURE",
    demoRejectionCount: 2,
    pendingQuestion: "Which branch?",
    bookingProgress: { date: null },
    confidenceState: { course: 0 },
  });
});

test("an empty state patch performs no Conversation update", async () => {
  let updateCalls = 0;
  const storedConversation = conversation();

  const result = await persistConversationStatePatch(
    storedConversation,
    {},
    { updateConversation: async () => { updateCalls += 1; return storedConversation; } },
  );

  assert.equal(updateCalls, 0);
  assert.strictEqual(result.conversation, storedConversation);
  assert.deepEqual(result.changedFields, []);
});

test("combines multiple approved state changes into one update", async () => {
  const storedConversation = conversation();
  const calls = [];
  const updatedConversation = conversation({
    current_sales_stage: "DISCOVERY",
    pending_question: "Which branch?",
  });

  const result = await persistConversationStatePatch(
    storedConversation,
    {
      current_sales_stage: "DISCOVERY",
      pending_question: "Which branch?",
    },
    {
      updateConversation: async (id, patch) => {
        calls.push([id, patch]);
        return updatedConversation;
      },
    },
  );

  assert.deepEqual(calls, [[storedConversation.id, {
    current_sales_stage: "DISCOVERY",
    pending_question: "Which branch?",
  }]]);
  assert.strictEqual(result.conversation, updatedConversation);
  assert.deepEqual(result.changedFields, ["current_sales_stage", "pending_question"]);
});

test("omits unchanged fields, including structurally equal JSON", async () => {
  let updateCalls = 0;
  const result = await persistConversationStatePatch(
    conversation(),
    {
      current_sales_stage: "NEW",
      confidence_state_json: { course: 0 },
      booking_progress_json: { date: null },
    },
    { updateConversation: async () => { updateCalls += 1; throw new Error("must not update"); } },
  );

  assert.equal(updateCalls, 0);
  assert.deepEqual(result.changedFields, []);
});

test("ignores identity and generic fields supplied outside the state patch contract", () => {
  const decision = deriveConversationStateUpdate(conversation(), {
    id: "other-conversation",
    lead_id: "other-lead",
    channel: "other-channel",
    status: "invented",
    current_sales_stage: "DISCOVERY",
  });

  assert.deepEqual(decision.patch, { current_sales_stage: "DISCOVERY" });
  assert.deepEqual(decision.changedFields, ["current_sales_stage"]);
});

test("establishes one initial current course from explicit single-course evidence", async () => {
  const storedConversation = conversation();
  const updatedConversation = conversation({ current_course_id: "course-data-analytics" });
  const calls = [];

  const result = await applyConversationState(
    { conversation: storedConversation, semanticNormalization: semanticNormalization(), turnAnalysis: turnAnalysis() },
    {
      getCourseByInternalName: async (name) => { calls.push(["course", name]); return course(); },
      updateConversation: async (id, patch) => { calls.push(["update", id, patch]); return updatedConversation; },
    },
  );

  assert.deepEqual(calls, [
    ["course", "data_analytics"],
    ["update", storedConversation.id, { current_course_id: "course-data-analytics" }],
  ]);
  assert.strictEqual(result.conversation, updatedConversation);
  assert.deepEqual(result.changedFields, ["current_course_id"]);
  assert.equal(updatedConversation.current_sales_stage, "NEW");
  assert.equal(updatedConversation.qualification_status, "UNKNOWN");
  assert.equal(updatedConversation.demo_rejection_count, 0);
});

test("does not establish a course from canonical analysis without current-turn evidence", async () => {
  let courseCalls = 0;
  const storedConversation = conversation();
  const result = await applyConversationState(
    {
      conversation: storedConversation,
      semanticNormalization: semanticNormalization({ preservedEntities: [] }),
      turnAnalysis: turnAnalysis(),
    },
    {
      getCourseByInternalName: async () => { courseCalls += 1; return course(); },
      updateConversation: async () => { throw new Error("must not update"); },
    },
  );

  assert.equal(courseCalls, 0);
  assert.strictEqual(result.conversation, storedConversation);
});

test("does not establish an active course for multiple explicit course entities", async () => {
  let courseCalls = 0;
  await applyConversationState(
    {
      conversation: conversation(),
      semanticNormalization: semanticNormalization({
        preservedEntities: [
          { type: "course", value: "Data Analytics" },
          { type: "course", value: "Digital Marketing" },
        ],
      }),
      turnAnalysis: turnAnalysis(),
    },
    {
      getCourseByInternalName: async () => { courseCalls += 1; return course(); },
      updateConversation: async () => { throw new Error("must not update"); },
    },
  );

  assert.equal(courseCalls, 0);
});

test("keeps an existing current course without looking up or switching it", async () => {
  const storedConversation = conversation({ current_course_id: "course-accounting" });
  let courseCalls = 0;
  const result = await applyConversationState(
    { conversation: storedConversation, semanticNormalization: semanticNormalization(), turnAnalysis: turnAnalysis() },
    {
      getCourseByInternalName: async () => { courseCalls += 1; return course(); },
      updateConversation: async () => { throw new Error("must not update"); },
    },
  );

  assert.equal(courseCalls, 0);
  assert.strictEqual(result.conversation, storedConversation);
});

test("a missing initial course record leaves state unchanged", async () => {
  let updateCalls = 0;
  const storedConversation = conversation();
  const result = await applyConversationState(
    { conversation: storedConversation, semanticNormalization: semanticNormalization(), turnAnalysis: turnAnalysis() },
    {
      getCourseByInternalName: async () => null,
      updateConversation: async () => { updateCalls += 1; return storedConversation; },
    },
  );

  assert.equal(updateCalls, 0);
  assert.strictEqual(result.conversation, storedConversation);
});

test("course lookup and Conversation update failures propagate", async () => {
  const courseFailure = new Error("course lookup failed");
  const updateFailure = new Error("conversation update failed");

  await assert.rejects(
    () => applyConversationState(
      { conversation: conversation(), semanticNormalization: semanticNormalization(), turnAnalysis: turnAnalysis() },
      {
        getCourseByInternalName: async () => { throw courseFailure; },
        updateConversation: async () => conversation(),
      },
    ),
    (error) => error === courseFailure,
  );

  await assert.rejects(
    () => applyConversationState(
      { conversation: conversation(), semanticNormalization: semanticNormalization(), turnAnalysis: turnAnalysis() },
      {
        getCourseByInternalName: async () => course(),
        updateConversation: async () => { throw updateFailure; },
      },
    ),
    (error) => error === updateFailure,
  );
});

test("state operations do not mutate frozen inputs", async () => {
  const storedConversation = Object.freeze(conversation());
  const semantic = Object.freeze(semanticNormalization());
  const analysis = Object.freeze(turnAnalysis());

  const result = await applyConversationState(
    { conversation: storedConversation, semanticNormalization: semantic, turnAnalysis: analysis },
    {
      getCourseByInternalName: async () => null,
      updateConversation: async () => { throw new Error("must not update"); },
    },
  );

  assert.strictEqual(result.conversation, storedConversation);
});
