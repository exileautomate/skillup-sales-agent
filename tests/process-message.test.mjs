import assert from "node:assert/strict";
import test from "node:test";

import { processMessage } from "../src/core/process/process-message.ts";

const GREETING = "Hi, Saleel here from SkillUp. Eth course aan nokkunne?";

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

function voiceInput() {
  return {
    channel: "telegram",
    channelUserId: "101",
    chatId: "-201",
    messageId: "302",
    updateId: "902",
    timestamp: "2024-03-09T16:00:01.000Z",
    receivedAt: "2026-09-18T10:30:01.000Z",
    messageType: "voice",
    text: null,
    voiceFileId: "voice-file-id",
    voiceFileUniqueId: "voice-unique-id",
    voiceDurationSeconds: 12,
  };
}

test("returns one structured text message for normalized text input", async () => {
  const result = await processMessage(textInput());

  assert.deepEqual(result, {
    status: "completed",
    messages: [{ type: "text", content: GREETING }],
  });
});

test("does not mutate normalized input", async () => {
  const input = textInput();
  const snapshot = structuredClone(input);

  await processMessage(input);

  assert.deepEqual(input, snapshot);
});

test("does not inspect extra raw-channel-shaped fields", async () => {
  const input = textInput({
    update_id: 999,
    message: { text: "raw Telegram data must be ignored" },
  });

  const result = await processMessage(input);

  assert.deepEqual(result, {
    status: "completed",
    messages: [{ type: "text", content: GREETING }],
  });
});

test("returns an explicit no-output result for voice without a transcript", async () => {
  const result = await processMessage(voiceInput());

  assert.deepEqual(result, {
    status: "unsupported",
    reason: "voice-not-supported",
    messages: [],
  });
  assert.equal("transcript" in result, false);
});

test("returns the same deterministic result for repeated text inputs", async () => {
  const first = await processMessage(textInput({ text: "First text" }));
  const second = await processMessage(textInput({ text: "Different text" }));

  assert.deepEqual(first, second);
  assert.equal(first.messages[0].content, GREETING);
});
