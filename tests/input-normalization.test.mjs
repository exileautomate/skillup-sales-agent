import assert from "node:assert/strict";
import test from "node:test";

import { normalizeTelegramUpdate } from "../src/lib/telegram/normalize-update.ts";

const RECEIVED_AT = new Date("2026-09-18T10:30:00.000Z");
const TELEGRAM_DATE = 1_710_000_000;

function textUpdate(overrides = {}) {
  return {
    update_id: 901,
    message: {
      message_id: 301,
      date: TELEGRAM_DATE,
      from: { id: 101 },
      chat: { id: -201 },
      text: "Hello",
      ...overrides,
    },
  };
}

test("normalizes a valid Telegram text message", () => {
  const result = normalizeTelegramUpdate(textUpdate(), RECEIVED_AT);

  assert.deepEqual(result, {
    status: "normalized",
    message: {
      channel: "telegram",
      channelUserId: "101",
      chatId: "-201",
      messageId: "301",
      updateId: "901",
      messageType: "text",
      text: "Hello",
      voiceFileId: null,
      voiceFileUniqueId: null,
      voiceDurationSeconds: null,
      timestamp: "2024-03-09T16:00:00.000Z",
      receivedAt: "2026-09-18T10:30:00.000Z",
    },
  });
});

test("normalizes a valid Telegram voice message without transcribing it", () => {
  const result = normalizeTelegramUpdate(
    textUpdate({
      text: undefined,
      voice: {
        file_id: "voice-file-id",
        file_unique_id: "voice-unique-id",
        duration: 12,
      },
    }),
    RECEIVED_AT,
  );

  assert.equal(result.status, "normalized");
  assert.deepEqual(result.message, {
    channel: "telegram",
    channelUserId: "101",
    chatId: "-201",
    messageId: "301",
    updateId: "901",
    messageType: "voice",
    text: null,
    voiceFileId: "voice-file-id",
    voiceFileUniqueId: "voice-unique-id",
    voiceDurationSeconds: 12,
    timestamp: "2024-03-09T16:00:00.000Z",
    receivedAt: "2026-09-18T10:30:00.000Z",
  });
});

test("returns unsupported when a Telegram voice file ID is empty", () => {
  assert.deepEqual(
    normalizeTelegramUpdate(
      textUpdate({ text: undefined, voice: { file_id: "" } }),
      RECEIVED_AT,
    ),
    { status: "unsupported", reason: "unsupported-message" },
  );
});

test("returns unsupported for a non-message update", () => {
  assert.deepEqual(
    normalizeTelegramUpdate(
      { update_id: 902, callback_query: { id: "callback" } },
      RECEIVED_AT,
    ),
    { status: "unsupported", reason: "unsupported-update" },
  );
});

test("returns unsupported for a message containing unsupported media", () => {
  assert.deepEqual(
    normalizeTelegramUpdate(
      textUpdate({ text: undefined, photo: [{ file_id: "photo" }] }),
      RECEIVED_AT,
    ),
    { status: "unsupported", reason: "unsupported-message" },
  );
});

test("returns unsupported when sender ID is missing", () => {
  assert.deepEqual(
    normalizeTelegramUpdate(textUpdate({ from: undefined }), RECEIVED_AT),
    { status: "unsupported", reason: "missing-sender-id" },
  );
});

test("returns unsupported when chat ID is missing", () => {
  assert.deepEqual(
    normalizeTelegramUpdate(textUpdate({ chat: {} }), RECEIVED_AT),
    { status: "unsupported", reason: "missing-chat-id" },
  );
});

test("returns unsupported when message ID is missing", () => {
  assert.deepEqual(
    normalizeTelegramUpdate(textUpdate({ message_id: undefined }), RECEIVED_AT),
    { status: "unsupported", reason: "missing-message-id" },
  );
});

test("preserves exact text without trimming or rewriting", () => {
  const exactText = "  Hello, Saleel!\nSecond line.  ";
  const result = normalizeTelegramUpdate(
    textUpdate({ text: exactText }),
    RECEIVED_AT,
  );

  assert.equal(result.status, "normalized");
  assert.equal(result.message.text, exactText);
});

test("preserves the Telegram update ID", () => {
  const result = normalizeTelegramUpdate(
    { ...textUpdate(), update_id: 987_654 },
    RECEIVED_AT,
  );

  assert.equal(result.status, "normalized");
  assert.equal(result.message.updateId, "987654");
});

test("converts and preserves the Telegram timestamp", () => {
  const result = normalizeTelegramUpdate(textUpdate(), RECEIVED_AT);

  assert.equal(result.status, "normalized");
  assert.equal(result.message.timestamp, "2024-03-09T16:00:00.000Z");
  assert.equal(result.message.receivedAt, "2026-09-18T10:30:00.000Z");
});
