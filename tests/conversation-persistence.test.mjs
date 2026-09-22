import assert from "node:assert/strict";
import test from "node:test";

import { processMessage } from "../src/core/process/process-message.ts";
import { getOrCreateConversationForLead } from "../src/core/conversation/conversation-persistence.ts";

function textInput(overrides = {}) {
  return {
    channel: "telegram",
    channelUserId: "101",
    chatId: "-201",
    messageId: "301",
    updateId: "901",
    timestamp: "2024-03-09T16:00:00.000Z",
    receivedAt: "2026-09-22T10:30:00.000Z",
    messageType: "text",
    text: "Hello",
    voiceFileId: null,
    voiceFileUniqueId: null,
    voiceDurationSeconds: null,
    ...overrides,
  };
}

function voiceInput() {
  return {
    ...textInput(),
    messageType: "voice",
    text: null,
    voiceFileId: "voice-file-id",
    voiceFileUniqueId: "voice-unique-id",
    voiceDurationSeconds: 12,
  };
}

test("returns an existing conversation without creating or overwriting it", async () => {
  const existingConversation = {
    id: "conversation-1",
    lead_id: "lead-1",
    channel: "telegram",
    status: "later-status",
    current_course_id: "course-1",
    current_sales_stage: "BOOKING",
    qualification_status: "QUALIFIED",
    confidence_state_json: { confidence: "high" },
    demo_push_status: "NURTURE",
    demo_rejection_count: 2,
    pending_question: "Which batch?",
    booking_progress_json: { step: "contact" },
  };
  let createCalls = 0;

  const result = await getOrCreateConversationForLead("lead-1", "telegram", {
    findLatestConversationForLeadChannel: async () => existingConversation,
    createConversation: async () => {
      createCalls += 1;
      throw new Error("createConversation should not be called");
    },
  });

  assert.strictEqual(result, existingConversation);
  assert.equal(createCalls, 0);
});

test("creates a new conversation with only lead and channel identity fields", async () => {
  let receivedInput;
  const createdConversation = {
    id: "conversation-2",
    lead_id: "lead-2",
    channel: "telegram",
    current_sales_stage: "NEW",
    qualification_status: "UNKNOWN",
    demo_push_status: "NORMAL",
    demo_rejection_count: 0,
  };

  const result = await getOrCreateConversationForLead("lead-2", "telegram", {
    findLatestConversationForLeadChannel: async () => null,
    createConversation: async (input) => {
      receivedInput = input;
      return createdConversation;
    },
  });

  assert.strictEqual(result, createdConversation);
  assert.deepEqual(receivedInput, { lead_id: "lead-2", channel: "telegram" });
});

test("repeated same-lead same-channel resolution reuses one conversation", async () => {
  const conversations = new Map();
  let createCalls = 0;
  const dependencies = {
    findLatestConversationForLeadChannel: async (leadId, channel) =>
      conversations.get(`${leadId}:${channel}`) ?? null,
    createConversation: async (input) => {
      createCalls += 1;
      const conversation = {
        id: "conversation-3",
        ...input,
        current_sales_stage: "NEW",
      };
      conversations.set(`${input.lead_id}:${input.channel}`, conversation);
      return conversation;
    },
  };

  const first = await getOrCreateConversationForLead(
    "lead-3",
    "telegram",
    dependencies,
  );
  const second = await getOrCreateConversationForLead(
    "lead-3",
    "telegram",
    dependencies,
  );

  assert.strictEqual(second, first);
  assert.equal(createCalls, 1);
});

test("does not reuse a conversation from another channel", async () => {
  const existingByChannel = new Map([
    ["lead-4:whatsapp", { id: "whatsapp-conversation", channel: "whatsapp" }],
  ]);
  let receivedInput;

  const result = await getOrCreateConversationForLead("lead-4", "telegram", {
    findLatestConversationForLeadChannel: async (leadId, channel) =>
      existingByChannel.get(`${leadId}:${channel}`) ?? null,
    createConversation: async (input) => {
      receivedInput = input;
      return { id: "telegram-conversation", ...input };
    },
  });

  assert.equal(result.id, "telegram-conversation");
  assert.deepEqual(receivedInput, { lead_id: "lead-4", channel: "telegram" });
});

test("reuses the newest returned conversation without mutating older rows", async () => {
  const olderConversation = {
    id: "conversation-old",
    lead_id: "lead-5",
    channel: "telegram",
    created_at: "2026-09-01T00:00:00.000Z",
  };
  const newestConversation = {
    id: "conversation-new",
    lead_id: "lead-5",
    channel: "telegram",
    created_at: "2026-09-02T00:00:00.000Z",
  };
  let createCalls = 0;

  const result = await getOrCreateConversationForLead("lead-5", "telegram", {
    findLatestConversationForLeadChannel: async () => newestConversation,
    createConversation: async () => {
      createCalls += 1;
      throw new Error("createConversation should not be called");
    },
  });

  assert.strictEqual(result, newestConversation);
  assert.equal(olderConversation.id, "conversation-old");
  assert.equal(createCalls, 0);
});

test("propagates a genuine conversation lookup failure", async () => {
  const failure = new Error("conversation lookup unavailable");

  await assert.rejects(
    () =>
      getOrCreateConversationForLead("lead-6", "telegram", {
        findLatestConversationForLeadChannel: async () => {
          throw failure;
        },
        createConversation: async () => {
          throw new Error("createConversation should not be called");
        },
      }),
    (error) => error === failure,
  );
});

test("propagates a genuine conversation create failure", async () => {
  const failure = new Error("conversation insert failed");

  await assert.rejects(
    () =>
      getOrCreateConversationForLead("lead-7", "telegram", {
        findLatestConversationForLeadChannel: async () => null,
        createConversation: async () => {
          throw failure;
        },
      }),
    (error) => error === failure,
  );
});

test("processMessage persists lead first, then that lead's channel conversation", async () => {
  const calls = [];

  const result = await processMessage(textInput(), {
    identifyOrCreateLead: async (channel, channelUserId) => {
      calls.push(["lead", channel, channelUserId]);
      return { id: "lead-runtime" };
    },
    getOrCreateConversationForLead: async (leadId, channel) => {
      calls.push(["conversation", leadId, channel]);
      return { id: "conversation-runtime" };
    },
  });

  assert.deepEqual(calls, [
    ["lead", "telegram", "101"],
    ["conversation", "lead-runtime", "telegram"],
  ]);
  assert.deepEqual(result, {
    status: "completed",
    messages: [
      { type: "text", content: "Hi, Saleel here from SkillUp. Eth course aan nokkunne?" },
    ],
  });
});

test("processMessage does not persist a conversation when lead persistence fails", async () => {
  const failure = new Error("lead persistence failed");
  let conversationCalls = 0;

  await assert.rejects(
    () =>
      processMessage(textInput(), {
        identifyOrCreateLead: async () => {
          throw failure;
        },
        getOrCreateConversationForLead: async () => {
          conversationCalls += 1;
          return { id: "conversation-should-not-exist" };
        },
      }),
    (error) => error === failure,
  );

  assert.equal(conversationCalls, 0);
});

test("processMessage rejects before responding when conversation persistence fails", async () => {
  const failure = new Error("conversation persistence failed");

  await assert.rejects(
    () =>
      processMessage(textInput(), {
        identifyOrCreateLead: async () => ({ id: "lead-8" }),
        getOrCreateConversationForLead: async () => {
          throw failure;
        },
      }),
    (error) => error === failure,
  );
});

test("voice behavior remains unsupported after successful persistence", async () => {
  const calls = [];

  const result = await processMessage(voiceInput(), {
    identifyOrCreateLead: async () => {
      calls.push("lead");
      return { id: "lead-voice" };
    },
    getOrCreateConversationForLead: async () => {
      calls.push("conversation");
      return { id: "conversation-voice" };
    },
  });

  assert.deepEqual(calls, ["lead", "conversation"]);
  assert.deepEqual(result, {
    status: "unsupported",
    reason: "voice-not-supported",
    messages: [],
  });
});
