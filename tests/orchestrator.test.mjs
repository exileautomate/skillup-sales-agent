import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  orchestrateTextTurn,
  shouldInheritCurrentLanguageContext,
} from "../src/core/orchestration/orchestrate-text-turn.ts";
import { applyLeadMemory } from "../src/core/memory/lead-memory.ts";
import { applyConversationState } from "../src/core/state/conversation-state.ts";
import { resolveLanguage } from "../src/core/language/language-resolver.ts";
import { processMessage } from "../src/core/process/process-message.ts";
import {
  normalizeSemanticMeaning,
  SemanticNormalizationOutputError,
} from "../src/services/openai/semantic-normalizer.ts";
import {
  analyzeTurn,
  TurnAnalysisOutputError,
} from "../src/services/openai/turn-analysis.ts";

const GREETING = "Hi, Saleel here from SkillUp. Eth course aan nokkunne?";

function textMessage(overrides = {}) {
  return {
    channel: "telegram",
    channelUserId: "101",
    chatId: "-201",
    messageId: "301",
    updateId: "901",
    timestamp: "2024-03-09T16:00:00.000Z",
    receivedAt: "2026-09-22T10:30:00.000Z",
    messageType: "text",
    text: "Data Analytics fee ethra?",
    voiceFileId: null,
    voiceFileUniqueId: null,
    voiceDurationSeconds: null,
    ...overrides,
  };
}

function voiceMessage() {
  return {
    ...textMessage(),
    messageType: "voice",
    text: null,
    voiceFileId: "voice-file-id",
    voiceFileUniqueId: "voice-unique-id",
    voiceDurationSeconds: 12,
  };
}

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
    google_maps_url: null,
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

function semanticNormalization(overrides = {}) {
  return {
    normalizedEnglish: "What is the Data Analytics fee?",
    detectedOriginalLanguage: "manglish",
    uncertainty: [],
    preservedEntities: [{ type: "course", value: "Data Analytics" }],
    ...overrides,
  };
}

function turnAnalysis(overrides = {}) {
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

function queryRoute(overrides = {}) {
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

function dependencies(overrides = {}) {
  return {
    normalizeSemanticMeaning: async () => semanticNormalization(),
    analyzeTurn: async () => turnAnalysis(),
    applyLeadMemory: async ({ lead: storedLead }) => ({
      lead: storedLead,
      changedFields: [],
    }),
    applyConversationState: async ({ conversation: storedConversation }) => ({
      conversation: storedConversation,
      changedFields: [],
    }),
    resolveLanguage,
    routeQuery: () => queryRoute(),
    getCourseById: async () => null,
    getCourseByInternalName: async () => null,
    getBranchByName: async () => null,
    getActiveBranchesForCourse: async () => [],
    listBranches: async () => [],
    ...overrides,
  };
}

test("processMessage coordinates the complete text-turn sequence", async () => {
  const events = [];
  const storedLead = lead();
  const storedConversation = conversation();
  const analyzedTurn = turnAnalysis({
    leadFacts: {
      name: null,
      qualification: null,
      branchPreference: "Calicut",
      contact: null,
    },
  });

  const result = await processMessage(textMessage(), {
    identifyOrCreateLead: async () => {
      events.push("lead");
      return storedLead;
    },
    getOrCreateConversationForLead: async () => {
      events.push("conversation");
      return storedConversation;
    },
    orchestrationDependencies: dependencies({
      normalizeSemanticMeaning: async () => {
        events.push("semantic_normalization");
        return semanticNormalization();
      },
      analyzeTurn: async () => {
        events.push("turn_analysis");
        return analyzedTurn;
      },
      applyLeadMemory: async ({ lead: currentLead }) => {
        events.push("lead_memory");
        return { lead: currentLead, changedFields: [] };
      },
      applyConversationState: async ({ conversation: currentConversation }) => {
        events.push("conversation_state");
        return { conversation: currentConversation, changedFields: [] };
      },
      resolveLanguage: () => {
        events.push("language_resolution");
        return "manglish";
      },
      routeQuery: () => {
        events.push("query_routing");
        return queryRoute({
          needsStructuredCourseFacts: true,
          needsBranchFacts: true,
        });
      },
      getCourseByInternalName: async () => {
        events.push("course_source");
        return course();
      },
      getBranchByName: async () => {
        events.push("branch_source");
        return branch();
      },
    }),
  });

  assert.deepEqual(events, [
    "lead",
    "conversation",
    "semantic_normalization",
    "turn_analysis",
    "lead_memory",
    "conversation_state",
    "language_resolution",
    "query_routing",
    "course_source",
    "branch_source",
  ]);
  assert.deepEqual(result, {
    status: "completed",
    messages: [{ type: "text", content: GREETING }],
  });
});

test("voice persists identity but skips every intelligence stage", async () => {
  const events = [];
  const result = await processMessage(voiceMessage(), {
    identifyOrCreateLead: async () => {
      events.push("lead");
      return lead();
    },
    getOrCreateConversationForLead: async () => {
      events.push("conversation");
      return conversation();
    },
    orchestrateTextTurn: async () => {
      events.push("orchestration");
      throw new Error("voice must not be orchestrated");
    },
  });

  assert.deepEqual(events, ["lead", "conversation"]);
  assert.deepEqual(result, {
    status: "unsupported",
    reason: "voice-not-supported",
    messages: [],
  });
});

test("passes exact semantic normalization output into TurnAnalysis", async () => {
  const semantic = semanticNormalization({
    normalizedEnglish: "Exact normalized English",
  });
  let receivedAnalysisInput;

  const handoff = await orchestrateTextTurn(
    { message: textMessage(), lead: lead(), conversation: conversation() },
    dependencies({
      normalizeSemanticMeaning: async () => semantic,
      analyzeTurn: async (input) => {
        receivedAnalysisInput = input;
        return turnAnalysis();
      },
    }),
  );

  assert.strictEqual(handoff.semanticNormalization, semantic);
  assert.equal(receivedAnalysisInput.normalizedEnglish, "Exact normalized English");
  assert.equal(receivedAnalysisInput.originalMessage, textMessage().text);
});

test("resolves a persisted current course into minimal read-only analysis context", async () => {
  const storedCourse = course();
  let receivedAnalysisInput;
  let courseIdInput;

  await orchestrateTextTurn(
    {
      message: textMessage(),
      lead: lead(),
      conversation: conversation({ current_course_id: storedCourse.id }),
    },
    dependencies({
      getCourseById: async (id) => {
        courseIdInput = id;
        return storedCourse;
      },
      analyzeTurn: async (input) => {
        receivedAnalysisInput = input;
        return turnAnalysis();
      },
    }),
  );

  assert.equal(courseIdInput, storedCourse.id);
  assert.deepEqual(receivedAnalysisInput.currentConversationState, {
    currentCourse: "data_analytics",
  });
});

test("omits course context when the conversation has no current course", async () => {
  let receivedAnalysisInput;
  let courseLookupCalls = 0;

  await orchestrateTextTurn(
    { message: textMessage(), lead: lead(), conversation: conversation() },
    dependencies({
      getCourseById: async () => {
        courseLookupCalls += 1;
        return course();
      },
      analyzeTurn: async (input) => {
        receivedAnalysisInput = input;
        return turnAnalysis();
      },
    }),
  );

  assert.equal(courseLookupCalls, 0);
  assert.equal("currentConversationState" in receivedAnalysisInput, false);
});

test("stored lead context stays separate from current-turn leadFacts", async () => {
  const analyzedTurn = turnAnalysis();
  let receivedAnalysisInput;

  const handoff = await orchestrateTextTurn(
    {
      message: textMessage(),
      lead: lead({ name: "Stored Name", qualification: "Stored BCom" }),
      conversation: conversation(),
    },
    dependencies({
      analyzeTurn: async (input) => {
        receivedAnalysisInput = input;
        return analyzedTurn;
      },
    }),
  );

  assert.deepEqual(receivedAnalysisInput.leadMemory, {
    name: "Stored Name",
    qualification: "Stored BCom",
  });
  assert.deepEqual(handoff.turnAnalysis.leadFacts, {
    name: null,
    qualification: null,
    branchPreference: null,
    contact: null,
  });
});

test("explicit requested response language wins", async () => {
  const handoff = await orchestrateTextTurn(
    { message: textMessage(), lead: lead(), conversation: conversation() },
    dependencies({
      normalizeSemanticMeaning: async () =>
        semanticNormalization({ detectedOriginalLanguage: "english" }),
      analyzeTurn: async () =>
        turnAnalysis({ requestedResponseLanguage: "malayalam" }),
    }),
  );

  assert.equal(handoff.resolvedLanguage, "malayalam");
});

test("updated Lead memory drives same-turn language resolution and handoff sources", async () => {
  const storedLead = lead();
  const updatedLead = lead({
    preferred_language: "malayalam",
    updated_at: "2026-09-23T10:00:00.000Z",
  });
  let resolverInput;
  let updateCalls = 0;
  const integrationDependencies = dependencies({
    normalizeSemanticMeaning: async () =>
      semanticNormalization({
        detectedOriginalLanguage: "unclear",
        preservedEntities: [],
      }),
    analyzeTurn: async () =>
      turnAnalysis({
        course: null,
        requestedResponseLanguage: "malayalam",
      }),
    resolveLanguage: (input) => {
      resolverInput = input;
      return resolveLanguage(input);
    },
    routeQuery: () => queryRoute({ needsMemory: true }),
    applyLeadMemory,
    updateLead: async (id, patch) => {
      updateCalls += 1;
      assert.equal(id, storedLead.id);
      assert.deepEqual(patch, { preferred_language: "malayalam" });
      return updatedLead;
    },
  });
  const handoff = await orchestrateTextTurn(
    {
      message: textMessage(),
      lead: storedLead,
      conversation: conversation(),
    },
    integrationDependencies,
  );

  assert.equal(updateCalls, 1);
  assert.equal(resolverInput.storedPreferredLanguage, "malayalam");
  assert.strictEqual(handoff.lead, updatedLead);
  assert.strictEqual(handoff.sources.memorySource.data, updatedLead);
});

test("valid stored preference can resolve a short neutral turn", async () => {
  const handoff = await orchestrateTextTurn(
    {
      message: textMessage({ text: " OK " }),
      lead: lead({ preferred_language: "malayalam" }),
      conversation: conversation(),
    },
    dependencies({
      normalizeSemanticMeaning: async () =>
        semanticNormalization({ detectedOriginalLanguage: "english" }),
    }),
  );

  assert.equal(handoff.resolvedLanguage, "malayalam");
});

test("invalid stored language becomes null and recentLanguage is not invented", async () => {
  let resolverInput;

  await orchestrateTextTurn(
    {
      message: textMessage({ text: "hmm" }),
      lead: lead({ preferred_language: "klingon" }),
      conversation: conversation(),
    },
    dependencies({
      resolveLanguage: (input) => {
        resolverInput = input;
        return "manglish";
      },
    }),
  );

  assert.equal(resolverInput.storedPreferredLanguage, null);
  assert.equal(resolverInput.recentLanguage, null);
  assert.equal(resolverInput.defaultLanguage, "manglish");
  assert.equal(resolverInput.inheritCurrentLanguageContext, true);
});

test("short neutral inheritance uses only the approved small set", () => {
  for (const text of ["ok", " OK ", "yes", "Fine", "hmm"]) {
    assert.equal(shouldInheritCurrentLanguageContext(text), true, text);
  }

  for (const text of ["hello", "okay", "yes please", "hmm?"]) {
    assert.equal(shouldInheritCurrentLanguageContext(text), false, text);
  }
});

test("Query Router receives the exact validated TurnAnalysis object", async () => {
  const analyzedTurn = turnAnalysis();
  let receivedTurn;

  const handoff = await orchestrateTextTurn(
    { message: textMessage(), lead: lead(), conversation: conversation() },
    dependencies({
      analyzeTurn: async () => analyzedTurn,
      routeQuery: (input) => {
        receivedTurn = input;
        return queryRoute();
      },
    }),
  );

  assert.strictEqual(receivedTurn, analyzedTurn);
  assert.strictEqual(handoff.turnAnalysis, analyzedTurn);
});

test("loads required structured course facts by canonical internal name", async () => {
  const storedCourse = course();
  let receivedInternalName;

  const handoff = await orchestrateTextTurn(
    { message: textMessage(), lead: lead(), conversation: conversation() },
    dependencies({
      routeQuery: () =>
        queryRoute({ needsStructuredCourseFacts: true }),
      getCourseByInternalName: async (internalName) => {
        receivedInternalName = internalName;
        return storedCourse;
      },
    }),
  );

  assert.equal(receivedInternalName, "data_analytics");
  assert.deepEqual(handoff.sources.structuredCourseFacts, {
    status: "loaded",
    data: storedCourse,
  });
});

test("marks required course facts unresolved without a canonical course", async () => {
  let lookupCalls = 0;
  const handoff = await orchestrateTextTurn(
    { message: textMessage(), lead: lead(), conversation: conversation() },
    dependencies({
      analyzeTurn: async () => turnAnalysis({ course: null }),
      routeQuery: () =>
        queryRoute({ needsStructuredCourseFacts: true, needsState: true }),
      getCourseByInternalName: async () => {
        lookupCalls += 1;
        return course();
      },
    }),
  );

  assert.equal(lookupCalls, 0);
  assert.deepEqual(handoff.sources.structuredCourseFacts, {
    status: "unresolved",
    data: null,
    reason: "canonical_course_unavailable",
  });
  assert.equal("course" in handoff.sources.structuredCourseFacts, false);
});

test("does not load answer sources when the route does not require them", async () => {
  let sourceCalls = 0;
  const unavailable = async () => {
    sourceCalls += 1;
    throw new Error("an unrequested source must not load");
  };

  const handoff = await orchestrateTextTurn(
    { message: textMessage(), lead: lead(), conversation: conversation() },
    dependencies({
      getCourseByInternalName: unavailable,
      getBranchByName: unavailable,
      getActiveBranchesForCourse: unavailable,
      listBranches: unavailable,
    }),
  );

  assert.equal(sourceCalls, 0);
  assert.equal(handoff.sources.structuredCourseFacts.status, "not_required");
  assert.equal(handoff.sources.structuredBranchFacts.status, "not_required");
});

test("loads an explicitly named branch without hard-coded branch data", async () => {
  const storedBranch = branch();
  let receivedName;

  const handoff = await orchestrateTextTurn(
    { message: textMessage(), lead: lead(), conversation: conversation() },
    dependencies({
      analyzeTurn: async () =>
        turnAnalysis({
          course: null,
          leadFacts: {
            name: null,
            qualification: null,
            branchPreference: "Calicut",
            contact: null,
          },
        }),
      routeQuery: () => queryRoute({ needsBranchFacts: true }),
      getBranchByName: async (name) => {
        receivedName = name;
        return storedBranch;
      },
    }),
  );

  assert.equal(receivedName, "Calicut");
  assert.deepEqual(handoff.sources.structuredBranchFacts, {
    status: "loaded",
    data: [storedBranch],
  });
});

test("loads active course-branch mappings for a canonical course", async () => {
  const storedCourse = course();
  const storedBranch = branch();
  let receivedCourseId;

  const handoff = await orchestrateTextTurn(
    { message: textMessage(), lead: lead(), conversation: conversation() },
    dependencies({
      routeQuery: () => queryRoute({ needsBranchFacts: true }),
      getCourseByInternalName: async () => storedCourse,
      getActiveBranchesForCourse: async (courseId) => {
        receivedCourseId = courseId;
        return [storedBranch];
      },
    }),
  );

  assert.equal(receivedCourseId, storedCourse.id);
  assert.deepEqual(handoff.sources.structuredBranchFacts, {
    status: "loaded",
    data: [storedBranch],
  });
  assert.deepEqual(handoff.sources.courseBranchMapping, {
    status: "loaded",
    data: {
      courseId: storedCourse.id,
      courseInternalName: "data_analytics",
      requestedBranchName: null,
      activeBranches: [storedBranch],
    },
  });
});

test("preserves named-branch and canonical-course mapping evidence without deciding availability", async () => {
  const storedCourse = course();
  const requestedBranch = branch({ id: "branch-kochi", name: "Kochi" });
  const mappedBranches = [requestedBranch, branch()];
  const calls = [];

  const handoff = await orchestrateTextTurn(
    { message: textMessage(), lead: lead(), conversation: conversation() },
    dependencies({
      analyzeTurn: async () =>
        turnAnalysis({
          leadFacts: {
            name: null,
            qualification: null,
            branchPreference: "Kochi",
            contact: null,
          },
        }),
      routeQuery: () => queryRoute({ needsBranchFacts: true }),
      getCourseByInternalName: async (internalName) => {
        calls.push(["course", internalName]);
        return storedCourse;
      },
      getActiveBranchesForCourse: async (courseId) => {
        calls.push(["mapping", courseId]);
        return mappedBranches;
      },
      getBranchByName: async (name) => {
        calls.push(["branch", name]);
        return requestedBranch;
      },
    }),
  );

  assert.deepEqual(calls, [
    ["course", "data_analytics"],
    ["mapping", storedCourse.id],
    ["branch", "Kochi"],
  ]);
  assert.deepEqual(handoff.sources.structuredBranchFacts, {
    status: "loaded",
    data: [requestedBranch],
  });
  assert.deepEqual(handoff.sources.courseBranchMapping, {
    status: "loaded",
    data: {
      courseId: storedCourse.id,
      courseInternalName: "data_analytics",
      requestedBranchName: "Kochi",
      activeBranches: mappedBranches,
    },
  });
  assert.equal("available" in handoff.sources.courseBranchMapping.data, false);
});

test("keeps unmatched named-branch mapping evidence truthful without a business conclusion", async () => {
  const storedCourse = course();
  const requestedBranch = branch({ id: "branch-kochi", name: "Kochi" });
  const activeBranches = [branch({ id: "branch-calicut", name: "Calicut" })];

  const handoff = await orchestrateTextTurn(
    { message: textMessage(), lead: lead(), conversation: conversation() },
    dependencies({
      analyzeTurn: async () =>
        turnAnalysis({
          leadFacts: {
            name: null,
            qualification: null,
            branchPreference: "Kochi",
            contact: null,
          },
        }),
      routeQuery: () => queryRoute({ needsBranchFacts: true }),
      getCourseByInternalName: async () => storedCourse,
      getActiveBranchesForCourse: async () => activeBranches,
      getBranchByName: async () => requestedBranch,
    }),
  );

  assert.equal(handoff.sources.structuredBranchFacts.status, "loaded");
  assert.deepEqual(
    handoff.sources.courseBranchMapping.data.activeBranches,
    activeBranches,
  );
  assert.equal(
    handoff.sources.courseBranchMapping.data.activeBranches.some(
      (branchRecord) => branchRecord.id === requestedBranch.id,
    ),
    false,
  );
  assert.equal("isMapped" in handoff.sources.courseBranchMapping.data, false);
});

test("loads the general branch list when neither branch nor course is known", async () => {
  const branches = [branch(), branch({ id: "branch-2", name: "Second" })];
  let listCalls = 0;

  const handoff = await orchestrateTextTurn(
    { message: textMessage(), lead: lead(), conversation: conversation() },
    dependencies({
      analyzeTurn: async () => turnAnalysis({ course: null }),
      routeQuery: () => queryRoute({ needsBranchFacts: true }),
      listBranches: async () => {
        listCalls += 1;
        return branches;
      },
    }),
  );

  assert.equal(listCalls, 1);
  assert.deepEqual(handoff.sources.structuredBranchFacts, {
    status: "loaded",
    data: branches,
  });
});

test("passes Lead memory and the M25 Conversation State snapshot only when requested", async () => {
  const storedLead = lead();
  const storedConversation = conversation();
  const handoff = await orchestrateTextTurn(
    {
      message: textMessage(),
      lead: storedLead,
      conversation: storedConversation,
    },
    dependencies({
      routeQuery: () =>
        queryRoute({ needsMemory: true, needsState: true }),
    }),
  );

  assert.strictEqual(handoff.sources.memorySource.data, storedLead);
  assert.deepEqual(handoff.sources.stateSource.data, {
    currentCourseId: null,
    currentSalesStage: "NEW",
    qualificationStatus: "UNKNOWN",
    demoPushStatus: "NORMAL",
    demoRejectionCount: 0,
    pendingQuestion: null,
    bookingProgress: {},
    confidenceState: {},
  });
  assert.equal(handoff.sources.memorySource.status, "loaded");
  assert.equal(handoff.sources.stateSource.status, "loaded");
});

test("uses the M25-updated Conversation and snapshot in the same-turn handoff", async () => {
  const storedConversation = conversation();
  const updatedConversation = conversation({
    current_course_id: "course-data-analytics",
    updated_at: "2026-09-23T10:00:00.000Z",
  });
  let updateCalls = 0;

  const handoff = await orchestrateTextTurn(
    {
      message: textMessage(),
      lead: lead(),
      conversation: storedConversation,
    },
    dependencies({
      applyConversationState,
      routeQuery: () => queryRoute({ needsState: true }),
      getCourseByInternalName: async () => course(),
      updateConversation: async (id, patch) => {
        updateCalls += 1;
        assert.equal(id, storedConversation.id);
        assert.deepEqual(patch, { current_course_id: "course-data-analytics" });
        return updatedConversation;
      },
    }),
  );

  assert.equal(updateCalls, 1);
  assert.strictEqual(handoff.conversation, updatedConversation);
  assert.deepEqual(handoff.sources.stateSource, {
    status: "loaded",
    data: {
      currentCourseId: "course-data-analytics",
      currentSalesStage: "NEW",
      qualificationStatus: "UNKNOWN",
      demoPushStatus: "NORMAL",
      demoRejectionCount: 0,
      pendingQuestion: null,
      bookingProgress: {},
      confidenceState: {},
    },
  });
});

test("marks RAG and symbolic tools deferred without fake results", async () => {
  const requests = [
    { tool: "check_demo_availability" },
    { tool: "get_course_document", documentType: "brochure" },
  ];
  const handoff = await orchestrateTextTurn(
    { message: textMessage(), lead: lead(), conversation: conversation() },
    dependencies({
      routeQuery: () =>
        queryRoute({ needsRag: true, toolRequests: requests }),
    }),
  );

  assert.deepEqual(handoff.sources.rag, {
    status: "deferred",
    data: null,
    reason: "rag_retrieval_not_implemented",
  });
  assert.deepEqual(handoff.sources.tools, {
    status: "deferred",
    requests,
    reason: "tool_execution_not_implemented",
  });
  assert.notStrictEqual(handoff.sources.tools.requests, requests);
  assert.equal("result" in handoff.sources.tools, false);
});

test("preserves a multi-source handoff without booking execution", async () => {
  const storedCourse = course();
  const storedLead = lead();
  const handoff = await orchestrateTextTurn(
    {
      message: textMessage({ text: "Book the Data Analytics demo" }),
      lead: storedLead,
      conversation: conversation(),
    },
    dependencies({
      analyzeTurn: async () =>
        turnAnalysis({
          intents: ["demo_acceptance", "booking_request"],
          salesSignal: "booking_intent",
          intentRelationship: "dependent",
        }),
      routeQuery: () =>
        queryRoute({
          needsStructuredCourseFacts: true,
          needsRag: true,
          needsMemory: true,
          needsState: true,
        }),
      getCourseByInternalName: async () => storedCourse,
    }),
  );

  assert.equal(handoff.sources.structuredCourseFacts.status, "loaded");
  assert.equal(handoff.sources.memorySource.status, "loaded");
  assert.equal(handoff.sources.stateSource.status, "loaded");
  assert.equal(handoff.sources.rag.status, "deferred");
  assert.deepEqual(handoff.sources.tools, {
    status: "not_required",
    requests: [],
  });
  assert.equal(JSON.stringify(handoff).includes("create_demo_booking"), false);
  assert.equal(JSON.stringify(handoff).includes("bookingConfirmed"), false);
});

test("required repository failures propagate without placeholder success", async () => {
  const courseFailure = new Error("course source failed");
  const branchFailure = new Error("branch source failed");

  await assert.rejects(
    () =>
      orchestrateTextTurn(
        { message: textMessage(), lead: lead(), conversation: conversation() },
        dependencies({
          routeQuery: () =>
            queryRoute({ needsStructuredCourseFacts: true }),
          getCourseByInternalName: async () => {
            throw courseFailure;
          },
        }),
      ),
    (error) => error === courseFailure,
  );

  await assert.rejects(
    () =>
      orchestrateTextTurn(
        { message: textMessage(), lead: lead(), conversation: conversation() },
        dependencies({
          analyzeTurn: async () =>
            turnAnalysis({
              course: null,
              leadFacts: {
                name: null,
                qualification: null,
                branchPreference: "Calicut",
                contact: null,
              },
            }),
          routeQuery: () => queryRoute({ needsBranchFacts: true }),
          getBranchByName: async () => {
            throw branchFailure;
          },
        }),
      ),
    (error) => error === branchFailure,
  );
});

test("semantic normalization and TurnAnalysis failures propagate", async () => {
  const semanticFailure = new Error("semantic normalization failed");
  const analysisFailure = new Error("turn analysis failed");

  await assert.rejects(
    () =>
      orchestrateTextTurn(
        { message: textMessage(), lead: lead(), conversation: conversation() },
        dependencies({
          normalizeSemanticMeaning: async () => {
            throw semanticFailure;
          },
        }),
      ),
    (error) => error === semanticFailure,
  );

  await assert.rejects(
    () =>
      orchestrateTextTurn(
        { message: textMessage(), lead: lead(), conversation: conversation() },
        dependencies({
          analyzeTurn: async () => {
            throw analysisFailure;
          },
        }),
      ),
    (error) => error === analysisFailure,
  );
});

test("a Module 21 semantic fallback prevents TurnAnalysis and query routing", async () => {
  let providerCalls = 0;
  let analysisCalls = 0;
  let routerCalls = 0;

  await assert.rejects(
    () =>
      orchestrateTextTurn(
        { message: textMessage(), lead: lead(), conversation: conversation() },
        dependencies({
          normalizeSemanticMeaning: (originalMessage) =>
            normalizeSemanticMeaning(originalMessage, {
              createResponse: async () => {
                providerCalls += 1;
                return { output_text: "not JSON" };
              },
            }),
          analyzeTurn: async () => {
            analysisCalls += 1;
            return turnAnalysis();
          },
          routeQuery: () => {
            routerCalls += 1;
            return queryRoute();
          },
        }),
      ),
    (error) =>
      error instanceof SemanticNormalizationOutputError &&
      error.reason === "invalid_after_repair",
  );

  assert.equal(providerCalls, 2);
  assert.equal(analysisCalls, 0);
  assert.equal(routerCalls, 0);
});

test("a Module 21 TurnAnalysis fallback prevents query routing", async () => {
  let providerCalls = 0;
  let routerCalls = 0;

  await assert.rejects(
    () =>
      orchestrateTextTurn(
        { message: textMessage(), lead: lead(), conversation: conversation() },
        dependencies({
          analyzeTurn: (input) =>
            analyzeTurn(input, {
              createResponse: async () => {
                providerCalls += 1;
                return {
                  output_text: JSON.stringify({
                    ...turnAnalysis(),
                    intents: ["demo_acceptance", "booking_request"],
                    intentRelationship: "single",
                  }),
                };
              },
            }),
          routeQuery: () => {
            routerCalls += 1;
            return queryRoute();
          },
        }),
      ),
    (error) =>
      error instanceof TurnAnalysisOutputError &&
      error.reason === "invalid_after_repair",
  );

  assert.equal(providerCalls, 2);
  assert.equal(routerCalls, 0);
});

test("processMessage does not return the placeholder when orchestration fails", async () => {
  const failure = new Error("orchestration failed");

  await assert.rejects(
    () =>
      processMessage(textMessage(), {
        identifyOrCreateLead: async () => lead(),
        getOrCreateConversationForLead: async () => conversation(),
        orchestrateTextTurn: async () => {
          throw failure;
        },
      }),
    (error) => error === failure,
  );
});

test("orchestration does not mutate frozen inputs or trusted stage outputs", async () => {
  const message = Object.freeze(textMessage());
  const storedLead = Object.freeze(lead());
  const storedConversation = Object.freeze(conversation());
  const semantic = Object.freeze(semanticNormalization());
  const analyzedTurn = Object.freeze({
    ...turnAnalysis(),
    intents: Object.freeze(["greeting"]),
    leadFacts: Object.freeze(turnAnalysis().leadFacts),
    ambiguity: Object.freeze([]),
  });
  const route = Object.freeze({
    ...queryRoute(),
    toolRequests: Object.freeze([]),
  });

  const handoff = await orchestrateTextTurn(
    { message, lead: storedLead, conversation: storedConversation },
    dependencies({
      normalizeSemanticMeaning: async () => semantic,
      analyzeTurn: async () => analyzedTurn,
      routeQuery: () => route,
    }),
  );

  assert.strictEqual(handoff.lead, storedLead);
  assert.strictEqual(handoff.conversation, storedConversation);
  assert.strictEqual(handoff.semanticNormalization, semantic);
  assert.strictEqual(handoff.turnAnalysis, analyzedTurn);
  assert.strictEqual(handoff.queryRoute, route);
});

test("core orchestration stays channel-adapter independent", async () => {
  const source = await readFile(
    new URL("../src/core/orchestration/orchestrate-text-turn.ts", import.meta.url),
    "utf8",
  );

  assert.doesNotMatch(source, /telegram\/|Telegram|vercel|whatsapp/i);
});
