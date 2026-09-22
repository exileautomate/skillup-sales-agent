import assert from "node:assert/strict";
import test from "node:test";

import { processMessage } from "../src/core/process/process-message.ts";
import { getOrCreateLeadByChannelIdentity } from "../src/core/lead/lead-persistence.ts";

function textInput(overrides = {}) {
  return {
    channel: "telegram",
    channelUserId: "101",
    chatId: "-201",
    messageId: "301",
    updateId: "901",
    timestamp: "2024-03-09T16:00:00.000Z",
    receivedAt: "2026-09-18T10:30:00.000Z",
    messageType: "text",
    text: "Hello",
    voiceFileId: null,
    voiceFileUniqueId: null,
    voiceDurationSeconds: null,
    ...overrides,
  };
}

test("returns an existing lead without creating or overwriting it", async () => {
  const existingLead = {
    id: "lead-1",
    channel: "telegram",
    channel_user_id: "101",
    qualification: "B.Com",
    current_course_interest_id: "course-1",
    lead_status: "QUALIFIED",
  };
  let createCalls = 0;

  const result = await getOrCreateLeadByChannelIdentity("telegram", "101", {
    findLeadByChannelUserId: async () => existingLead,
    createLead: async () => {
      createCalls += 1;
      throw new Error("createLead should not be called");
    },
  });

  assert.strictEqual(result, existingLead);
  assert.equal(createCalls, 0);
});

test("creates a new lead with only the stable identity fields", async () => {
  let receivedInput;
  const createdLead = {
    id: "lead-2",
    channel: "whatsapp",
    channel_user_id: "user-2",
    lead_status: "NEW",
  };

  const result = await getOrCreateLeadByChannelIdentity("whatsapp", "user-2", {
    findLeadByChannelUserId: async () => null,
    createLead: async (input) => {
      receivedInput = input;
      return createdLead;
    },
  });

  assert.strictEqual(result, createdLead);
  assert.deepEqual(receivedInput, {
    channel: "whatsapp",
    channel_user_id: "user-2",
  });
});

test("repeated identity resolution returns the same lead without duplication", async () => {
  const leads = new Map();
  let createCalls = 0;
  const dependencies = {
    findLeadByChannelUserId: async (channel, channelUserId) =>
      leads.get(`${channel}:${channelUserId}`) ?? null,
    createLead: async (input) => {
      createCalls += 1;
      const lead = {
        id: "lead-3",
        ...input,
        lead_status: "NEW",
      };
      leads.set(`${input.channel}:${input.channel_user_id}`, lead);
      return lead;
    },
  };

  const first = await getOrCreateLeadByChannelIdentity(
    "telegram",
    "repeat-user",
    dependencies,
  );
  const second = await getOrCreateLeadByChannelIdentity(
    "telegram",
    "repeat-user",
    dependencies,
  );

  assert.strictEqual(second, first);
  assert.equal(createCalls, 1);
});

test("propagates a genuine lookup failure", async () => {
  const failure = new Error("database unavailable");

  await assert.rejects(
    () =>
      getOrCreateLeadByChannelIdentity("telegram", "101", {
        findLeadByChannelUserId: async () => {
          throw failure;
        },
        createLead: async () => {
          throw new Error("createLead should not be called");
        },
      }),
    (error) => error === failure,
  );
});

test("propagates a genuine create failure", async () => {
  const failure = new Error("insert failed");

  await assert.rejects(
    () =>
      getOrCreateLeadByChannelIdentity("telegram", "101", {
        findLeadByChannelUserId: async () => null,
        createLead: async () => {
          throw failure;
        },
      }),
    (error) => error === failure,
  );
});

test("resolves a channel-identity unique conflict with one re-read", async () => {
  const racedLead = {
    id: "lead-raced",
    channel: "telegram",
    channel_user_id: "raced-user",
    lead_status: "NEW",
  };
  let lookupCalls = 0;
  let createCalls = 0;
  const conflict = new Error(
    'Database lead creation failed: duplicate key violates "leads_channel_channel_user_id_key"',
  );
  Object.assign(conflict, { code: "23505" });

  const result = await getOrCreateLeadByChannelIdentity(
    "telegram",
    "raced-user",
    {
      findLeadByChannelUserId: async () => {
        lookupCalls += 1;
        return lookupCalls === 1 ? null : racedLead;
      },
      createLead: async () => {
        createCalls += 1;
        throw conflict;
      },
    },
  );

  assert.strictEqual(result, racedLead);
  assert.equal(lookupCalls, 2);
  assert.equal(createCalls, 1);
});

test("does not swallow an unrelated create failure", async () => {
  const failure = new Error(
    'Database lead creation failed: duplicate key violates "other_unique_key"',
  );
  let lookupCalls = 0;

  await assert.rejects(
    () =>
      getOrCreateLeadByChannelIdentity("telegram", "101", {
        findLeadByChannelUserId: async () => {
          lookupCalls += 1;
          return null;
        },
        createLead: async () => {
          throw failure;
        },
      }),
    (error) => error === failure,
  );

  assert.equal(lookupCalls, 1);
});

test("processMessage identifies the normalized lead before preserving its response", async () => {
  const calls = [];

  const result = await processMessage(textInput(), {
    identifyOrCreateLead: async (channel, channelUserId) => {
      calls.push({ channel, channelUserId });
      return { id: "lead-4" };
    },
    getOrCreateConversationForLead: async () => ({ id: "conversation-1" }),
    orchestrateTextTurn: async () => ({}),
  });

  assert.deepEqual(calls, [{ channel: "telegram", channelUserId: "101" }]);
  assert.deepEqual(result, {
    status: "completed",
    messages: [
      { type: "text", content: "Hi, Saleel here from SkillUp. Eth course aan nokkunne?" },
    ],
  });
});

test("processMessage stops when lead persistence fails", async () => {
  const failure = new Error("lead persistence failed");

  await assert.rejects(
    () =>
      processMessage(textInput(), {
        identifyOrCreateLead: async () => {
          throw failure;
        },
      }),
    (error) => error === failure,
  );
});
