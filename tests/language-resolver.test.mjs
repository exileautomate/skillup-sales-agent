import assert from "node:assert/strict";
import test from "node:test";

import {
  resolveLanguage,
} from "../src/core/language/language-resolver.ts";

function input(overrides = {}) {
  return {
    requestedResponseLanguage: null,
    currentDetectedLanguage: null,
    recentLanguage: null,
    storedPreferredLanguage: null,
    defaultLanguage: "english",
    inheritCurrentLanguageContext: false,
    ...overrides,
  };
}

test("explicit requested language beats every other signal", () => {
  assert.equal(
    resolveLanguage(
      input({
        requestedResponseLanguage: "malayalam",
        currentDetectedLanguage: "english",
        recentLanguage: "manglish",
        storedPreferredLanguage: "english",
        defaultLanguage: "manglish",
      }),
    ),
    "malayalam",
  );
});

test("clear current English wins without an explicit request", () => {
  assert.equal(
    resolveLanguage(
      input({
        currentDetectedLanguage: "english",
        recentLanguage: "malayalam",
        storedPreferredLanguage: "manglish",
      }),
    ),
    "english",
  );
});

test("clear current Malayalam wins without an explicit request", () => {
  assert.equal(
    resolveLanguage(input({ currentDetectedLanguage: "malayalam" })),
    "malayalam",
  );
});

test("clear current Manglish wins without an explicit request", () => {
  assert.equal(
    resolveLanguage(input({ currentDetectedLanguage: "manglish" })),
    "manglish",
  );
});

test("unclear current language falls back to recent language", () => {
  assert.equal(
    resolveLanguage(
      input({
        currentDetectedLanguage: "unclear",
        recentLanguage: "manglish",
        storedPreferredLanguage: "english",
      }),
    ),
    "manglish",
  );
});

test("mixed current language falls back to recent language", () => {
  assert.equal(
    resolveLanguage(
      input({
        currentDetectedLanguage: "mixed",
        recentLanguage: "malayalam",
        storedPreferredLanguage: "manglish",
      }),
    ),
    "malayalam",
  );
});

test("recent language beats stored preference", () => {
  assert.equal(
    resolveLanguage(
      input({
        recentLanguage: "malayalam",
        storedPreferredLanguage: "english",
        defaultLanguage: "manglish",
      }),
    ),
    "malayalam",
  );
});

test("stored preference beats the default", () => {
  assert.equal(
    resolveLanguage(
      input({
        storedPreferredLanguage: "malayalam",
        defaultLanguage: "manglish",
      }),
    ),
    "malayalam",
  );
});

test("default is used when no higher-priority signal exists", () => {
  assert.equal(
    resolveLanguage(input({ defaultLanguage: "manglish" })),
    "manglish",
  );
});

test("context-inheriting short turns skip the current language", () => {
  assert.equal(
    resolveLanguage(
      input({
        currentDetectedLanguage: "english",
        recentLanguage: "manglish",
        storedPreferredLanguage: "english",
        inheritCurrentLanguageContext: true,
      }),
    ),
    "manglish",
  );
});

test("an explicit request still wins for a context-inheriting turn", () => {
  assert.equal(
    resolveLanguage(
      input({
        requestedResponseLanguage: "malayalam",
        currentDetectedLanguage: "english",
        recentLanguage: "manglish",
        inheritCurrentLanguageContext: true,
      }),
    ),
    "malayalam",
  );
});

test("mixed never becomes resolved output", () => {
  const result = resolveLanguage(
    input({
      currentDetectedLanguage: "mixed",
      defaultLanguage: "manglish",
    }),
  );

  assert.notEqual(result, "mixed");
  assert.equal(result, "manglish");
});

test("unclear never becomes resolved output", () => {
  const result = resolveLanguage(
    input({
      currentDetectedLanguage: "unclear",
      defaultLanguage: "manglish",
    }),
  );

  assert.notEqual(result, "unclear");
  assert.equal(result, "manglish");
});

test("resolution is deterministic and does not mutate input", () => {
  const originalInput = input({
    currentDetectedLanguage: "unclear",
    recentLanguage: "manglish",
    storedPreferredLanguage: "english",
    defaultLanguage: "malayalam",
  });
  const snapshot = structuredClone(originalInput);

  const first = resolveLanguage(originalInput);
  const second = resolveLanguage(originalInput);

  assert.equal(first, "manglish");
  assert.equal(second, first);
  assert.deepEqual(originalInput, snapshot);
});
