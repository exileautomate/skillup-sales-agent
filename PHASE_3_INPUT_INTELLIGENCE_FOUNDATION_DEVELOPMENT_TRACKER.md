# Phase 3 — Input & Intelligence Foundation Development Tracker

## 1. Phase Objective

Phase 3 establishes the intelligence foundation needed to understand a student's current message before later business or sales decisions are made. It covers semantic normalization, response-language resolution, TurnAnalysis, structured-output validation, source routing, and orchestration.

Phase 3 does **not** implement the business or sales engine.

## 2. Phase Final Status

**Phase 3 — COMPLETE**

- M18 ✅
- M19 ✅
- M20 ✅
- M21 ✅
- M22 ✅
- M23 ✅

Next planned module: **M24 — Lead Memory**.

## 3. Starting State

Phase 3 began from the Phase 2 database foundation. Stable Lead persistence and Conversation persistence already existed. Module 16 message persistence and Module 17 RLS were intentionally skipped, so there was no message-history layer, `recentLanguage` source, or RLS baseline. No current-turn intelligence pipeline yet existed.

## 4. Module 18 — Language + Semantic Normalization

**Purpose:** faithfully understand the student's meaning before downstream analysis.

The final normalizer uses OpenAI to produce faithful normalized English, detected original language, uncertainty, and preserved entities. It does not make business decisions or generate an answer. Prompt-injection boundaries and strict structured output keep student input untrusted. Its production path now uses the Module 21 schema and one-repair workflow.

At Module 18 close, the unresolved-DTA criticality issue was consciously accepted as a demo limitation. Ambiguity is preserved rather than guessed; this tracker does not represent that earlier criticality choice as a later fix.

Final module commit: `cc51b48c3965636f815f2cd5de2372a0b3978b46` — `feat(ai): add semantic normalization foundation`.

The module checkpoint recorded 9 focused tests and 61 total tests passing, plus TypeScript, build, and `git diff --check` passing; it closed with the accepted demo limitation noted above.

## 5. Module 19 — Language Resolver

**Purpose:** deterministically select the response language without OpenAI.

Final priority order:

1. Explicit requested response language
2. Clear current language
3. Recent language
4. Stored preferred language
5. Default

Short neutral turns can inherit context by bypassing the current detected-language signal while still honoring an explicit request. `recentLanguage` remains `null` because Module 16 was skipped.

Final module commit: `df89bd553688f99a8824196b60335a5d14a3752a` — `feat(ai): add deterministic language resolver`.

The final checkpoint recorded 14 focused tests and 75 total tests passing, with TypeScript, build, and `git diff --check` passing. The audit had no findings.

## 6. Module 20 — TurnAnalysis

**Purpose:** determine what is happening in the **current** student turn.

Its strict contract covers language, requested response language, canonical course, intents, current-turn Lead facts, objection, sales signal, intent relationship, and ambiguity. It preserves important safeguards:

- Technical terms alone do not establish a course; no course is guessed.
- DTA ambiguity remains ambiguity.
- `Accounting` is never converted to SAP or SAP FICO.
- All meaningful intents are retained.
- Current-turn facts remain distinct from stored Lead context.
- Booking or tool success is never claimed.
- It makes no business decision.

The production path now uses Module 21 schema validation and the one-repair workflow.

Final module commit: `1a4bf5841c59fc9ffb80c2123f7e20b270f00fb2` — `feat(ai): add structured turn analysis`.

The final checkpoint recorded 25 focused tests and 100 total tests passing, TypeScript/build/`git diff --check` passing, a successful final live retest for the dependent demo-acceptance plus booking-request case, and a passing demo audit.

## 7. Module 21 — Structured Output Validation

**Purpose:** provide reusable, provider-independent structured-output validation.

Module 21 supplies Zod schemas, `validateStructuredOutput()`, and `validateWithOneRepair()`. It permits at most one repair, emits a safe fallback control signal rather than fabricating data, and treats the previous provider output as untrusted data in the repair prompt.

It was intentionally infrastructure-only during Module 21 itself and was not then wired into M18/M20. Its actual production integration occurred in Module 23.

Final module commit: `2ab737196cbffc516d967b883b915ea6840d9ba4` — `feat(ai): add structured output validation`.

The module checkpoint passed its focused and regression evidence, TypeScript, build, and `git diff --check`; its audit had no findings.

## 8. Module 22 — Query Router

**Purpose:** deterministically identify which trusted source categories are required.

The route can require structured course facts, branch facts, RAG, Memory, State, and symbolic tool requests. Routing does not answer the student or execute sources. Multi-intent source needs are unioned, missing course context never causes guessing, a tool request is neither execution nor success, and it never authorizes `create_demo_booking`.

The Hard Audit found that `internship_certificate` needed Structured Database authority in addition to RAG. That routing rule was corrected and reverified.

Final module commit: `6ab4a3160eb49427a596b686ca4b3f7fc2237424` — `feat(ai): add deterministic query routing`.

The final hard-verification, re-verification, and final checkpoint evidence passed after the correction.

## 9. Module 23 — Orchestrator Expansion

**Purpose:** coordinate the completed Phase 3 modules and the sources available now.

Final text pipeline:

```text
Lead persistence
→ Conversation persistence
→ Semantic Normalization
→ read-only context
→ TurnAnalysis
→ Language Resolution
→ Query Router
→ structured/deferred source loading
→ OrchestrationHandoff
→ temporary Saleel placeholder
```

Voice remains:

```text
Lead → Conversation → unsupported
```

Source loads explicitly report `not_required`, `loaded`, `unresolved`, or `deferred`. A raw Lead can be a read-only memory source and a raw Conversation a read-only state source. RAG and tools are deferred; there is no booking execution, business logic, Lead Memory mutation, or Conversation State mutation.

## 10. Module 23 Architecture Corrections

### Module 21 production integration

Initial Module 23 integration still allowed M18/M20 local guards to throw before the Module 21 one-repair workflow. The correction integrated the Module 21 Zod schemas and `validateWithOneRepair()` into the real Semantic Normalizer and TurnAnalysis production paths.

Final behavior:

```text
valid first output → no repair
invalid first output → exactly one repair
valid repair → trusted result
invalid repair / repair failure → controlled typed failure
```

There are no recursive retries.

### Course + named branch mapping evidence

Initial named-branch loading could prove that a branch existed without proving its active mapping to the course. The correction retains canonical course identity, the requested branch row, and active branches for the course as factual `CourseBranchMappingEvidence`. Module 23 does not turn that evidence into an availability or business conclusion.

## 11. Module 23 Verification / Audit

Hard Verification: **PASS — MODULE 23 HARD VERIFICATION PASSED**.

- Orchestrator: 29 passed, 0 failed
- Semantic Normalizer: 13 passed, 0 failed
- TurnAnalysis: 29 passed, 0 failed
- Structured Output Validation: 12 passed, 0 failed
- TypeScript: passed
- `git diff --check`: passed

Hard Audit: **PASS — module is good enough for the SkillUp demo**. It reported no CRITICAL, MAJOR, MINOR, or OPTIONAL findings.

## 12. Module 23 Final Checkpoint

Previous baseline: `6ab4a3160eb49427a596b686ca4b3f7fc2237424`.

Final Module 23 commit: `f5d6dfea8b87b0cd2fbba6bdef22bc58cb9e4a5a` — `feat(ai): integrate Phase 3 orchestration pipeline`.

Final full regression at that commit:

- 172 passed, 0 failed
- TypeScript: PASS
- Production build: PASS
- `git diff --check`: PASS

Final status: **MODULE_23_REPOSITORY_CHECK_PASS**.

## 13. Phase 3 Final Architecture

| Module | Final responsibility |
|---|---|
| M18 | Understand meaning |
| M19 | Choose response language |
| M20 | Understand the current turn |
| M21 | Validate and repair structured LLM output |
| M22 | Choose required source categories |
| M23 | Coordinate stages and available sources |

No Phase 4 business engine exists yet.

## 14. Source Authority

The locked authority hierarchy is:

1. Live Tool Result
2. Structured Database
3. Approved RAG
4. Conversation Memory / State context

LLM knowledge is not business truth. Currently, structured course/branch reads and persistence are available; RAG and tool execution are deferred. Raw Lead and Conversation rows may only be supplied as read-only context until their respective engines exist.

## 15. Important Phase 3 Decisions

- Deterministic TypeScript owns business truth, routing, state transitions, and tool authority; the LLM has constrained language-understanding responsibility only.
- Course identity is never guessed, and current-turn facts are separate from stored context.
- One repair is the maximum; invalid outputs never cause fabricated data or recursive retries.
- Query Router selects sources but does not execute them; the Orchestrator coordinates but makes no business decisions.
- RAG and tools remain deferred, and the temporary placeholder response remains until a later response pipeline.
- Because M16 is absent, there is no message history and no populated `recentLanguage`.
- Core processing remains channel-independent; Telegram is only an outer adapter.

## 16. Final Known Limitations

These are planned boundaries at Phase 3 close, not presented as defects:

- No Lead Memory engine or Conversation State engine
- No business/sales logic, confidence engine, or course-switching behavior
- No demo rejection, nurture, or stop engine
- No RAG retrieval, tool execution, or booking execution
- No real response generation or verifier
- No STT/TTS; voice remains unsupported
- Fixed temporary text placeholder
- No message history
- No RLS

## 17. Permanent Phase 3 Commits

| Module | Commit SHA | Commit message |
|---|---|---|
| M18 | `cc51b48c3965636f815f2cd5de2372a0b3978b46` | `feat(ai): add semantic normalization foundation` |
| M19 | `df89bd553688f99a8824196b60335a5d14a3752a` | `feat(ai): add deterministic language resolver` |
| M20 | `1a4bf5841c59fc9ffb80c2123f7e20b270f00fb2` | `feat(ai): add structured turn analysis` |
| M21 | `2ab737196cbffc516d967b883b915ea6840d9ba4` | `feat(ai): add structured output validation` |
| M22 | `6ab4a3160eb49427a596b686ca4b3f7fc2237424` | `feat(ai): add deterministic query routing` |
| M23 | `f5d6dfea8b87b0cd2fbba6bdef22bc58cb9e4a5a` | `feat(ai): integrate Phase 3 orchestration pipeline` |

## 18. Phase Closure

**PHASE 3 — COMPLETE**

Final committed application baseline: `f5d6dfea8b87b0cd2fbba6bdef22bc58cb9e4a5a`.

Architecture context files created after Phase 3:

- `AGENTS.md`
- `docs/CURRENT_ARCHITECTURE.md`

Next development: **PHASE 4 — MODULE 24: LEAD MEMORY**. Module 24 is not implemented by this tracker.
