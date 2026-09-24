import assert from "node:assert/strict";
import test from "node:test";

import {
  applyConfidenceCoverage,
  calculateConfidenceScore,
  createConfidenceStatePatch,
  createEmptyConfidenceState,
  evaluateDemoGate,
  getConfidenceRange,
  getConfidenceSnapshot,
  parseConfidenceState,
  passesNormalDemoConfidenceGate,
} from "../src/core/confidence/confidence-engine.ts";
import { CONFIDENCE_COVERAGE_ITEMS } from "../src/core/confidence/types.ts";

function qualifiedScore(overrides = {}) {
  return {
    course: 2,
    fees: 2,
    placement: 2,
    internship: 3,
    career: 0,
    support: 0,
    branches: 0,
    total: 11,
    ...overrides,
  };
}

test("empty ConfidenceState contains exactly 21 false coverage values", () => {
  const state = createEmptyConfidenceState();
  assert.equal(Object.values(state).flatMap(Object.values).length, 21);
  assert.ok(Object.values(state).flatMap(Object.values).every((value) => value === false));
});

test("null persisted confidence becomes an empty state", () => {
  assert.deepEqual(parseConfidenceState(null), createEmptyConfidenceState());
});

test("malformed persisted confidence cannot inflate score", () => {
  const state = parseConfidenceState([true, "course.structure"]);
  assert.equal(calculateConfidenceScore(state).total, 0);
});

test("string and number truthy values never count as covered", () => {
  const state = parseConfidenceState({
    course: { structure: "true", whatLearn: 1, howLearn: "yes", outcomes: true },
  });
  assert.deepEqual(state.course, {
    structure: false,
    whatLearn: false,
    howLearn: false,
    outcomes: true,
  });
});

test("partial valid persisted state preserves only literal true values", () => {
  const state = parseConfidenceState({
    fees: { feeBasics: true, installments: false, unexpected: true },
    support: { mentor: true },
  });
  assert.equal(state.fees.feeBasics, true);
  assert.equal(state.fees.totalClarity, false);
  assert.equal(state.support.mentor, true);
  assert.equal(calculateConfidenceScore(state).total, 2);
});

test("all 21 coverage items score exactly 21 with locked pool maximums", () => {
  const state = applyConfidenceCoverage(createEmptyConfidenceState(), CONFIDENCE_COVERAGE_ITEMS);
  assert.deepEqual(calculateConfidenceScore(state), {
    course: 4, fees: 4, placement: 4, internship: 3,
    career: 1, support: 2, branches: 3, total: 21,
  });
});

test("duplicate coverage items never add score twice", () => {
  const state = applyConfidenceCoverage(createEmptyConfidenceState(), [
    "fees.feeBasics", "fees.feeBasics", "fees.feeBasics",
  ]);
  assert.equal(calculateConfidenceScore(state).fees, 1);
});

test("already-covered items remain covered without a semantic score change", () => {
  const first = applyConfidenceCoverage(createEmptyConfidenceState(), ["placement.assistance"]);
  const second = applyConfidenceCoverage(first, ["placement.assistance"]);
  assert.equal(calculateConfidenceScore(first).total, calculateConfidenceScore(second).total);
  assert.equal(second.placement.assistance, true);
});

test("coverage updates are monotonic and return independent objects", () => {
  const current = applyConfidenceCoverage(createEmptyConfidenceState(), ["course.structure"]);
  const next = applyConfidenceCoverage(current, ["fees.feeBasics"]);
  assert.notStrictEqual(next, current);
  assert.notStrictEqual(next.course, current.course);
  assert.equal(next.course.structure, true);
  assert.equal(next.fees.feeBasics, true);
});

test("coverage updates do not mutate frozen input", () => {
  const current = Object.freeze({
    ...createEmptyConfidenceState(),
    course: Object.freeze({ ...createEmptyConfidenceState().course }),
    fees: Object.freeze({ ...createEmptyConfidenceState().fees }),
    placement: Object.freeze({ ...createEmptyConfidenceState().placement }),
    internship: Object.freeze({ ...createEmptyConfidenceState().internship }),
    career: Object.freeze({ ...createEmptyConfidenceState().career }),
    support: Object.freeze({ ...createEmptyConfidenceState().support }),
    branches: Object.freeze({ ...createEmptyConfidenceState().branches }),
  });
  const next = applyConfidenceCoverage(current, ["career.direction"]);
  assert.equal(current.career.direction, false);
  assert.equal(next.career.direction, true);
});

test("confidence ranges classify 0–6, 7–10, and 11+ deterministically", () => {
  assert.equal(getConfidenceRange(qualifiedScore({ total: 6 })), "information_trust_building");
  assert.equal(getConfidenceRange(qualifiedScore({ total: 7 })), "qualification_sales_conversation");
  assert.equal(getConfidenceRange(qualifiedScore()), "demo_may_be_appropriate");
});

test("total 11 with insufficient fees fails the normal confidence gate", () => {
  assert.equal(passesNormalDemoConfidenceGate(qualifiedScore({ fees: 1, internship: 4, total: 11 })), false);
});

test("the normal confidence gate requires all locked thresholds", () => {
  assert.equal(passesNormalDemoConfidenceGate(qualifiedScore()), true);
});

test("full demo gate blocks unavailable demos before confidence", () => {
  assert.deepEqual(evaluateDemoGate({
    confidence: qualifiedScore(), eligible: true, demoAvailable: false,
    strongDemoIntent: true, demoPushStatus: "NORMAL",
  }), { allowed: false, path: "blocked", reason: "demo_unavailable" });
});

test("full demo gate blocks ineligible students before confidence", () => {
  assert.equal(evaluateDemoGate({
    confidence: qualifiedScore(), eligible: false, demoAvailable: true,
    strongDemoIntent: true, demoPushStatus: "NORMAL",
  }).reason, "not_eligible");
});

test("strong intent bypasses score only when current stop rules allow it", () => {
  const allowed = evaluateDemoGate({
    confidence: calculateConfidenceScore(createEmptyConfidenceState()), eligible: true,
    demoAvailable: true, strongDemoIntent: true, demoPushStatus: "NORMAL",
  });
  assert.deepEqual(allowed, { allowed: true, path: "strong_intent", reason: "strong_intent_bypass" });
  for (const demoPushStatus of ["STOP_DEMO_PUSH", "STOP_ALL_SALES_PUSH"]) {
    assert.equal(evaluateDemoGate({
      confidence: qualifiedScore(), eligible: true, demoAvailable: true,
      strongDemoIntent: true, demoPushStatus,
    }).reason, "demo_push_stopped");
  }
});

test("normal full demo gate returns the confidence path only for eligible available demos", () => {
  assert.deepEqual(evaluateDemoGate({
    confidence: qualifiedScore(), eligible: true, demoAvailable: true,
    strongDemoIntent: false, demoPushStatus: "NORMAL",
  }), { allowed: true, path: "normal_confidence", reason: "normal_confidence_met" });
});

test("low normal confidence remains blocked", () => {
  assert.equal(evaluateDemoGate({
    confidence: calculateConfidenceScore(createEmptyConfidenceState()), eligible: true,
    demoAvailable: true, strongDemoIntent: false, demoPushStatus: "NORMAL",
  }).reason, "normal_confidence_not_met");
});

test("snapshot parsing is repeatable and retains no raw arbitrary JSON", () => {
  const raw = { course: { structure: true }, injected: { score: 999 } };
  assert.deepEqual(getConfidenceSnapshot(raw), getConfidenceSnapshot(raw));
  assert.equal("injected" in getConfidenceSnapshot(raw).state, false);
});

test("future confidence patch carries only trusted coverage state", () => {
  const state = applyConfidenceCoverage(createEmptyConfidenceState(), ["support.mentor"]);
  const patch = createConfidenceStatePatch(state);
  assert.deepEqual(patch, { confidence_state_json: state });
  assert.notStrictEqual(patch.confidence_state_json, state);
});
