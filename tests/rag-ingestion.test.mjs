import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  countRagWords,
  ingestSkillUpRagDocument,
  parseRagMarkdown,
} from "../src/core/rag/rag-ingestion.ts";

const fixture = `# 3. SkillUp Learning Philosophy

**Knowledge class:** BUSINESS-LOCKED + DEMO-EXPLANATORY

Practical learning keeps explanation and projects together.

# 9. Course Deep Dive — Data Analytics

**Knowledge class:** BUSINESS-LOCKED + DEMO-EXPLANATORY

## DA-07 — Power BI

Power BI is used for dashboards and reports.

## DA-10 — Practical Data Analytics tasks

**Demo-explanatory examples**

Representative practical tasks preserve this safety warning.

# 10. Course Deep Dive — Digital Marketing

**Knowledge class:** BUSINESS-LOCKED + DEMO-EXPLANATORY

## DM-04 — SEO

SEO covers organic visibility.

# 11. Course Deep Dive — Accounting

**Knowledge class:** BUSINESS-LOCKED + DEMO-EXPLANATORY

## AC-10 — GST and Taxation

Accounting remains the student-facing course name.

# 12. Course Comparison Knowledge

**Knowledge class:** DEMO-EXPLANATORY + BUSINESS-LOCKED where facts are explicit

## CMP-01 — Data Analytics vs Digital Marketing

Compare the learning focus without guarantees.

# 27. Current Known Gaps

## Current live batches

Should come from current data.

# 14. Fee and Payment Explanation Knowledge

**Knowledge class:** BUSINESS-LOCKED

## FEE-01 — Why fees should be shown clearly

Exact current values should come from structured data.`;

function chunkBySection(chunks, sourceSection) {
  const chunk = chunks.find((candidate) => candidate.sourceSection === sourceSection);
  assert.ok(chunk, `missing ${sourceSection}`);
  return chunk;
}

test("parses natural H1/H2/H3 heading hierarchy", () => {
  const parsed = parseRagMarkdown("# One\n\n## Two\n\n### Three\n\nText");
  assert.equal(parsed.sections[0].title, "One");
  assert.equal(parsed.sections[0].children[0].title, "Two");
  assert.equal(parsed.sections[0].children[0].children[0].title, "Three");
});

test("DA, DM, and AC sections derive course only from heading context", () => {
  const chunks = ingestSkillUpRagDocument(fixture);
  assert.equal(chunkBySection(chunks, "DA-07").course, "data_analytics");
  assert.equal(chunkBySection(chunks, "DM-04").course, "digital_marketing");
  assert.equal(chunkBySection(chunks, "AC-10").course, "accounting");
});

test("comparison sections use all-course metadata", () => {
  const chunk = chunkBySection(ingestSkillUpRagDocument(fixture), "CMP-01");
  assert.equal(chunk.course, "all");
  assert.equal(chunk.category, "course_comparison");
});

test("general sections retain safe general metadata", () => {
  const chunk = chunkBySection(ingestSkillUpRagDocument(fixture), "FEE-01");
  assert.equal(chunk.course, null);
  assert.equal(chunk.category, "fee_explanation");
  assert.ok(chunk.metadata.tags.includes("fee_explanation"));
});

test("source section, heading path, and chunk ID are deterministic", () => {
  const chunk = chunkBySection(ingestSkillUpRagDocument(fixture), "DA-07");
  assert.equal(chunk.chunkId, "skillup-rag-v1-da-07");
  assert.deepEqual(chunk.metadata.headingPath, ["9. Course Deep Dive — Data Analytics", "DA-07 — Power BI"]);
  assert.equal(chunk.metadata.sourceSectionId, "DA-07");
});

test("repeat ingestion returns identical order, IDs, and source content", () => {
  assert.deepEqual(ingestSkillUpRagDocument(fixture), ingestSkillUpRagDocument(fixture));
});

test("chunk content preserves source text and attached safety wording", () => {
  const chunk = chunkBySection(ingestSkillUpRagDocument(fixture), "DA-10");
  assert.match(chunk.content, /Representative practical tasks preserve this safety warning\./);
  assert.match(chunk.content, /Demo-explanatory examples/);
});

test("explicit business-locked and demo-explanatory labels are both preserved", () => {
  const chunk = chunkBySection(ingestSkillUpRagDocument(fixture), "DA-07");
  assert.deepEqual(chunk.knowledgeClasses, ["business_locked", "demo_explanatory"]);
});

test("explicit demo-explanatory child context preserves the mixed parent classes", () => {
  const chunk = chunkBySection(ingestSkillUpRagDocument(fixture), "DA-10");
  assert.deepEqual(chunk.knowledgeClasses, ["business_locked", "demo_explanatory"]);
});

test("TBD-only known-gap chunks remain traceable but are excluded from normal retrieval", () => {
  const chunk = chunkBySection(ingestSkillUpRagDocument(fixture), "Current live batches");
  assert.equal(chunk.normalRetrievalEligible, false);
  assert.equal(chunk.studentFacing, false);
  assert.ok(chunk.knowledgeClasses.includes("tbd"));
  assert.match(chunk.content, /Should come from current data\./);
});

test("unclassified structural guidance is excluded from the storage corpus", () => {
  const chunks = ingestSkillUpRagDocument("# 99. Unclassified\n\nPlain source text.");
  assert.deepEqual(chunks, []);
});

test("classified business, demo, mixed, and TBD chunks remain in the storage corpus", () => {
  const chunks = ingestSkillUpRagDocument(`${fixture}

# 18. Demo Knowledge

**Knowledge class:** DEMO-EXPLANATORY

Demo explanation.`);
  assert.deepEqual(chunkBySection(chunks, "FEE-01").knowledgeClasses, ["business_locked"]);
  assert.deepEqual(chunkBySection(chunks, "18. Demo Knowledge").knowledgeClasses, ["demo_explanatory"]);
  assert.deepEqual(chunkBySection(chunks, "DA-07").knowledgeClasses, [
    "business_locked",
    "demo_explanatory",
  ]);
  assert.ok(chunkBySection(chunks, "Current live batches").knowledgeClasses.includes("tbd"));
});

test("actual Doc 02 storage corpus contains only classified chunks and retains the accepted tag limitation", async () => {
  const source = await readFile(
    fileURLToPath(new URL("../../02_SkillUp_RAG_Deep_Course_Knowledge.md", import.meta.url)),
    "utf8",
  );
  const chunks = ingestSkillUpRagDocument(source);
  const eligible = chunks.filter((chunk) => chunk.normalRetrievalEligible);

  assert.equal(chunks.length, 104);
  assert.equal(eligible.length, 96);
  assert.equal(chunks.length - eligible.length, 8);
  assert.ok(chunks.every((chunk) => chunk.knowledgeClasses.length > 0));
  assert.ok(chunks.some((chunk) =>
    chunk.course === "data_analytics" && chunk.metadata.tags.includes("marketing_analytics"),
  ));
});

test("word counting is deterministic", () => {
  assert.equal(countRagWords(" one\n two   three "), 3);
  assert.equal(countRagWords("   "), 0);
});

test("a long section splits only between paragraphs and repeats its heading", () => {
  const paragraph = "word ".repeat(360).trim();
  const chunks = ingestSkillUpRagDocument(`# 31. Long section\n\n**Knowledge class:** BUSINESS-LOCKED\n\n${paragraph}\n\n${paragraph}`);
  assert.equal(chunks.length, 2);
  assert.match(chunks[0].content, /^# 31\. Long section/);
  assert.match(chunks[1].content, /^# 31\. Long section/);
  assert.equal(chunks[0].chunkId, "skillup-rag-v1-31-long-section-part-1");
  assert.equal(chunks[1].chunkId, "skillup-rag-v1-31-long-section-part-2");
});

test("a short self-contained section is not padded or merged", () => {
  const chunks = ingestSkillUpRagDocument("# 32. Short section\n\n**Knowledge class:** BUSINESS-LOCKED\n\nShort source text.");
  assert.equal(chunks.length, 1);
  assert.match(chunks[0].content, /Short source text\./);
});

test("child heading chunks under one coded section receive distinct stable IDs", () => {
  const chunks = ingestSkillUpRagDocument(`# 9. Course Deep Dive — Data Analytics

**Knowledge class:** BUSINESS-LOCKED

## DA-03 — Journey

### Stage 1 — Foundation

First stage.

### Stage 2 — Practice

Second stage.`);
  assert.deepEqual(chunks.filter((chunk) => chunk.metadata.sourceSectionId === "DA-03").map((chunk) => chunk.chunkId), [
    "skillup-rag-v1-da-03-stage-1-foundation",
    "skillup-rag-v1-da-03-stage-2-practice",
  ]);
});

test("repeated untitled source subheadings receive deterministic occurrence suffixes", () => {
  const chunks = ingestSkillUpRagDocument(`# 22. Retrieval Rules

**Knowledge class:** BUSINESS-LOCKED

### Student asks:

First example.

### Student asks:

Second example.`);
  assert.deepEqual(chunks.filter((chunk) => chunk.title === "Student asks:").map((chunk) => chunk.chunkId), [
    "skillup-rag-v1-22-retrieval-rules-student-asks",
    "skillup-rag-v1-22-retrieval-rules-student-asks-part-2",
  ]);
});

test("the pure ingestion API has no provider dependency and does not mutate input", () => {
  const markdown = "# 33. Pure\n\n**Knowledge class:** BUSINESS-LOCKED\n\nOriginal text.";
  const frozen = Object.freeze(markdown);
  const chunks = ingestSkillUpRagDocument(frozen);
  assert.equal(markdown, frozen);
  chunks[0].metadata.tags.push?.("not-possible");
  assert.equal(ingestSkillUpRagDocument(markdown)[0].metadata.tags.includes("not-possible"), false);
});
