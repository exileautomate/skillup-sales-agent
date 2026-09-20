import assert from "node:assert/strict";
import test from "node:test";

import { processMessage } from "../src/core/process/process-message.ts";
import { processAndDeliverTelegramResponse } from "../src/lib/telegram/process-and-deliver.ts";

const GREETING = "Hi, Saleel here from SkillUp. Eth course aan nokkunne?";

function textInput() {
  return {
    channel: "telegram",
    channelUserId: "101",
    chatId: "-201",
    messageId: "301",
    updateId: "901",
    timestamp: "2024-03-09T16:00:00.000Z",
    receivedAt: "2026-09-18T10:30:00.000Z",
    messageType: "text",
    text: "Hi",
    voiceFileId: null,
    voiceFileUniqueId: null,
    voiceDurationSeconds: null,
  };
}

function voiceInput() {
  return {
    ...textInput(),
    messageId: "302",
    updateId: "902",
    messageType: "voice",
    text: null,
    voiceFileId: "voice-file-id",
    voiceFileUniqueId: "voice-unique-id",
    voiceDurationSeconds: 10,
  };
}

test("processes normalized text and delivers the completed text result", async () => {
  const sent = [];
  const result = await processAndDeliverTelegramResponse(textInput(), {
    processMessage,
    sendTelegramTextMessage: async (chatId, text) => {
      sent.push({ chatId, text });
    },
  });

  assert.deepEqual(result, {
    status: "completed",
    messages: [{ type: "text", content: GREETING }],
  });
  assert.deepEqual(sent, [{ chatId: "-201", text: GREETING }]);
});

test("acknowledges the unsupported voice result without outbound delivery", async () => {
  const sent = [];
  const result = await processAndDeliverTelegramResponse(voiceInput(), {
    processMessage,
    sendTelegramTextMessage: async (chatId, text) => {
      sent.push({ chatId, text });
    },
  });

  assert.deepEqual(result, {
    status: "unsupported",
    reason: "voice-not-supported",
    messages: [],
  });
  assert.deepEqual(sent, []);
});

test("propagates an outbound delivery failure to the webhook boundary", async () => {
  await assert.rejects(
    processAndDeliverTelegramResponse(textInput(), {
      processMessage,
      sendTelegramTextMessage: async () => {
        throw new Error("synthetic outbound failure");
      },
    }),
    /synthetic outbound failure/,
  );
});
