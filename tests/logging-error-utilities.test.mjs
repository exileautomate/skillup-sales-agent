import assert from "node:assert/strict";
import test from "node:test";

import { AppError, isAppError } from "../src/lib/errors/app-error.ts";
import { logger } from "../src/lib/logging/logger.ts";
import { createRequestId } from "../src/lib/request/request-id.ts";

test("creates non-empty, distinct UUID request IDs", () => {
  const first = createRequestId();
  const second = createRequestId();
  const uuidPattern =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  assert.notEqual(first, "");
  assert.notEqual(first, second);
  assert.match(first, uuidPattern);
  assert.match(second, uuidPattern);
});

test("AppError preserves its stable fields and optional cause", () => {
  const cause = new Error("internal cause");
  const error = new AppError({
    code: "INVALID_INPUT",
    message: "Input was invalid.",
    statusCode: 400,
    cause,
  });

  assert.equal(error.name, "AppError");
  assert.equal(error.code, "INVALID_INPUT");
  assert.equal(error.message, "Input was invalid.");
  assert.equal(error.statusCode, 400);
  assert.equal(error.cause, cause);
  assert.equal(error instanceof Error, true);
  assert.equal(isAppError(error), true);
  assert.equal(isAppError(new Error("not an app error")), false);
});

test("logger emits a structured safe record", () => {
  const entries = [];
  const originalInfo = console.info;
  console.info = (entry) => entries.push(entry);

  try {
    logger.info("telegram_webhook_processed", {
      requestId: "request-123",
      metadata: { normalized: true, messageType: "text" },
    });
  } finally {
    console.info = originalInfo;
  }

  assert.equal(entries.length, 1);
  const record = JSON.parse(entries[0]);

  assert.match(record.timestamp, /^\d{4}-\d{2}-\d{2}T/);
  assert.equal(record.level, "info");
  assert.equal(record.event, "telegram_webhook_processed");
  assert.equal(record.requestId, "request-123");
  assert.deepEqual(record.metadata, { normalized: true, messageType: "text" });
});

test("logger redacts sensitive metadata keys", () => {
  const entries = [];
  const originalWarn = console.warn;
  console.warn = (entry) => entries.push(entry);

  try {
    logger.warn("safe_test_event", {
      requestId: "request-456",
      metadata: {
        telegramBotToken: "test-secret-value",
        text: "private student message",
        normalized: false,
      },
    });
  } finally {
    console.warn = originalWarn;
  }

  assert.equal(entries.length, 1);
  const output = entries[0];
  const record = JSON.parse(output);

  assert.equal(output.includes("test-secret-value"), false);
  assert.equal(output.includes("private student message"), false);
  assert.deepEqual(record.metadata, {
    telegramBotToken: "[REDACTED]",
    text: "[REDACTED]",
    normalized: false,
  });
});
