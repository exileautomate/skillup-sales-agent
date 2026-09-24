<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# SkillUp AI Sales Agent — Codex Repository Guide

This is the fast operating manual for future Codex work. Read it before opening source files. Use [docs/CURRENT_ARCHITECTURE.md](docs/CURRENT_ARCHITECTURE.md) only when the task needs deeper system context.

## 1. Project Purpose

SkillUp is building **Saleel**, an AI-assisted education sales agent. The current runtime accepts Telegram updates, normalizes them into a channel-independent message, persists Lead and Conversation identity, analyzes text turns with OpenAI, resolves response language, routes and loads required sources, runs deterministic Business / Sales Logic, persists approved Lead status and Conversation state changes, and creates an internal orchestration handoff.

The real business-response pipeline does not exist yet. Successful text processing still returns the temporary deterministic Saleel message:

`Hi, Saleel here from SkillUp. Eth course aan nokkunne?`

Voice metadata is normalized and identity is persisted, but voice remains unsupported because STT is not implemented.

## 2. Current Development Status

| Phase | Scope | Status |
|---|---|---|
| Phase 1 | Foundation, Telegram, deployment | COMPLETE |
| Phase 2 | Database foundation | COMPLETE FOR APPROVED DEMO SCOPE |
| Phase 3 | Input and intelligence foundation | COMPLETE |
| Phase 4 | Business logic, memory, state, and confidence | ACTIVE — M24 COMPLETE; M25 COMPLETE; M26 COMPLETE; M27 COMPLETE |

Last committed M24 checkpoint: `7676b4b65542a26de459691a9630a6053aa3bebf`.

Phase 5 scope: **M30 RAG Ingestion / Chunking - COMPLETE WITH ACCEPTED DEMO LIMITATION; M31 Embeddings / Storage - PLANNED; M32 RAG Retrieval - PLANNED; M33 Structured DB / RAG Context Merge - PLANNED**.

Permanent Phase 4 history: `PHASE_4_BUSINESS_LOGIC_MEMORY_STATE_CONFIDENCE_DEVELOPMENT_TRACKER.md`.

Active Phase 4 scope: **M24 Lead Memory — COMPLETE; M25 Conversation State — COMPLETE; M26 Business / Sales Logic — COMPLETE; M27 Confidence Engine — COMPLETE**.

Deferred from the current demo: **M28 Course Context Switching, M29 Demo Rejection / Nurture / Stop**.

- Module 16 — Message Persistence: **INTENTIONALLY SKIPPED**.
- Module 17 — Database Security / RLS Baseline: **INTENTIONALLY SKIPPED**.

## 3. Golden Rules

- TypeScript owns deterministic truth, routing, validation, state transitions, business rules, and tool/action authorization.
- LLMs own language understanding and constrained natural-language intelligence only.
- The LLM is never the source of business truth.
- Never invent fees, eligibility, schedules, locations, mappings, availability, course identity, lead facts, or tool results.
- A symbolic tool request is not a tool result or permission to execute.
- Booking intent is not booking authorization, confirmation, or success.
- Preserve all meaningful current-turn intents.
- Keep current-turn `leadFacts` separate from stored Lead data.
- Ambiguity must remain ambiguity; never guess a course such as `DTA`.
- `Accounting` remains `accounting`; never convert it to SAP or SAP FICO.
- Preserve module boundaries; do not silently implement future modules.
- Core processing remains channel-independent. Telegram is an outer adapter.
- No n8n.
- Secrets are server-side only. Never log, print, report, or commit secret values.
- Do not mutate raw input, trusted stage outputs, repository records, or static routing rules unexpectedly.
- Propagate real provider/repository failures. Do not convert failures into fake success or the placeholder response.
- Read exact/current facts from structured data. Use RAG only for approved explanation when implemented.

## 4. Runtime Pipeline

Telegram entry path:

```text
POST /api/telegram/webhook
src/app/api/telegram/webhook/route.ts
  -> normalizeTelegramUpdate(...)
  -> processAndDeliverTelegramResponse(...)
  -> processMessage(...)
```

Current text path:

```text
processMessage(message)
src/core/process/process-message.ts
  -> getOrCreateLeadByChannelIdentity(channel, channelUserId)
  -> getOrCreateConversationForLead(lead.id, channel)
  -> orchestrateTextTurn({ message, lead, conversation })
       -> normalizeSemanticMeaning(message.text)
       -> resolve persisted current-course context read-only
       -> analyzeTurn({ originalMessage, normalizedEnglish, safe context })
       -> applyLeadMemory(...) using explicit current-turn facts
       -> applyConversationState(...) using only safe initial-course establishment
       -> resolveLanguage(...)
       -> routeQuery(turnAnalysis)
       -> load available structured sources / mark deferred sources
       -> parse persisted M27 confidence coverage and derive score/range
       -> decideSalesAction(...) from trusted analysis, memory, state, and sources
       -> persist the approved Lead status and M25 Conversation state patch
       -> return OrchestrationHandoff
  -> return temporary Saleel placeholder
```

`processMessage()` currently awaits but does not expose the handoff. Later phases will consume it for business logic and response generation.

Current voice path:

```text
lead persistence -> conversation persistence -> unsupported
```

Voice does not call semantic normalization, TurnAnalysis, routing, RAG, tools, or STT.

## 5. Function / File Map

| Responsibility | Main function/type | File | Notes |
|---|---|---|---|
| Core inbound contract | `NormalizedInboundMessage` | `src/core/input/types.ts` | Text/voice discriminated union; currently Telegram channel only. |
| Telegram normalization | `normalizeTelegramUpdate` | `src/lib/telegram/normalize-update.ts` | Preserves text exactly; voice is metadata only. |
| Core turn entry | `processMessage` | `src/core/process/process-message.ts` | Lead -> Conversation -> voice/text branch -> orchestration -> placeholder. |
| Lead identity | `getOrCreateLeadByChannelIdentity` | `src/core/lead/lead-persistence.ts` | Stable key: `channel + channel_user_id`; one conflict reread. |
| Conversation selection | `getOrCreateConversationForLead` | `src/core/conversation/conversation-persistence.ts` | Reuses newest Lead/channel conversation or creates neutral default. |
| Semantic normalization | `normalizeSemanticMeaning` | `src/services/openai/semantic-normalizer.ts` | OpenAI + strict schema + one repair. |
| Semantic contract | `SemanticNormalizationResult` | `src/core/types/semantic-normalization.ts` | Normalized English, detected language, uncertainty, preserved entities. |
| Language resolution | `resolveLanguage` | `src/core/language/language-resolver.ts` | Deterministic priority resolver. |
| Current-turn analysis | `analyzeTurn` | `src/services/openai/turn-analysis.ts` | OpenAI + strict schema + one repair. |
| Lead Memory | `deriveLeadMemoryUpdate`, `applyLeadMemory` | `src/core/memory/lead-memory.ts` | Conservative explicit-fact memory; one combined Lead update maximum. |
| Conversation State | `getConversationState`, `persistConversationStatePatch`, `applyConversationState` | `src/core/state/conversation-state.ts` | Typed workflow snapshot, one-write controlled patches, and conservative initial-course establishment only. |
| Turn contract/vocabulary | `TurnAnalysis`, `TURN_INTENTS` | `src/core/types/turn-analysis.ts` | Current-turn facts only; no business decisions. |
| Generic raw validation | `validateStructuredOutput` | `src/core/validation/structured-output.ts` | JSON parse + Zod; concise bounded issues. |
| One-repair workflow | `validateWithOneRepair` | `src/core/validation/structured-output.ts` | Zero or one injected repair; fallback control signal. |
| Zod schemas | `semanticNormalizationResultSchema`, `turnAnalysisSchema` | `src/core/validation/schemas/` | Strict; TurnAnalysis enforces intent-count relationship. |
| Query routing | `routeQuery`, `INTENT_ROUTING_RULES` | `src/core/routing/query-router.ts` | Deterministic union of source needs; no retrieval/action. |
| Route contract | `QueryRoute`, `QueryToolRequest` | `src/core/routing/types.ts` | Six-field source plan. |
| Text orchestration | `orchestrateTextTurn` | `src/core/orchestration/orchestrate-text-turn.ts` | Coordinates stages and currently available sources. |
| Handoff/source types | `OrchestrationHandoff`, `SourceLoad` | `src/core/orchestration/types.ts` | Trusted internal handoff; explicit source status. |
| Business / Sales Logic | `decideSalesAction`, `SalesDecision` | `src/core/sales-logic/decide-sales-action.ts`, `src/core/sales-logic/sales-types.ts` | Pure deterministic obligations, permissions, qualification, demo, and booking-preparation decisions. |
| Confidence Engine | `getConfidenceSnapshot`, `evaluateDemoGate` | `src/core/confidence/confidence-engine.ts` | Pure unique delivered-information coverage, derived score/range, and demo gate math. |
| RAG ingestion / chunking | `ingestSkillUpRagDocument`, `RagChunk` | `src/core/rag/rag-ingestion.ts`, `src/core/rag/types.ts` | Pure Doc 02 heading chunks with provenance and TBD retrieval exclusion; no embeddings, writes, or retrieval. |
| Course reads | `getCourseById`, `getCourseByInternalName`, `listCourses` | `src/lib/db/repositories/courses.ts` | Exact structured course facts. |
| Branch reads | `getBranchByName`, `listBranches`, `getActiveBranchesForCourse` | `src/lib/db/repositories/branches.ts` | Branch and course-branch mapping evidence. |
| Lead repository | `findLeadByChannelUserId`, `createLead`, `updateLead` | `src/lib/db/repositories/leads.ts` | Repository primitives; Module 23 does not update Lead. |
| Conversation repository | `findLatestConversationForLeadChannel`, `createConversation`, `updateConversation` | `src/lib/db/repositories/conversations.ts` | Repository primitives used by Conversation persistence and the M25 state boundary. |
| Booking repository | `createDemoBookingRecord` and reads/updates | `src/lib/db/repositories/demo-bookings.ts` | Exists as data primitive; not called by current runtime. |
| Knowledge repository | `listKnowledgeBaseRecords` | `src/lib/db/repositories/knowledge-base.ts` | Exists; current orchestrator deliberately does not use it as RAG. |
| Repository client boundary | `getRepositoryClient` | `src/lib/db/repositories/client.ts` | Server-only lazy Supabase client acquisition. |
| Supabase client | `createSupabaseServerClient` | `src/lib/supabase/server.ts` | Server-only, publishable-key client; no auth session persistence. |
| Shared OpenAI client | `createOpenAIClient` | `src/services/openai/client.ts` | Lazy, server-only, existing `OPENAI_API_KEY`. |
| AI prompts | prompt builders/constants | `src/services/openai/prompts/` | Semantic v1, TurnAnalysis v1, repair v1. |
| Telegram delivery bridge | `processAndDeliverTelegramResponse` | `src/lib/telegram/process-and-deliver.ts` | Delivers only completed core text results. |
| Telegram API adapter | `sendTelegramTextMessage` | `src/lib/telegram/client.ts` | Server-only Bot API `sendMessage`. |
| Telegram webhook | `POST` | `src/app/api/telegram/webhook/route.ts` | Secret check, normalize, process/deliver, safe HTTP boundary. |
| Health endpoint | `GET` | `src/app/api/health/route.ts` | Dependency-free health response. |
| Environment access | `getRequiredServerEnv` | `src/config/env.ts` | Central direct `process.env` boundary. |
| Safe logs | `logger`, `createLogRecord` | `src/lib/logging/logger.ts` | Structured metadata with sensitive-key redaction. |

## 6. Module Responsibility Map

| Module | Name | Current result |
|---|---|---|
| M1 | Project Bootstrap | Next.js App Router/TypeScript foundation. |
| M2 | Environment & Config | Central server environment access; `.env*` ignored. |
| M3 | Supabase Client Foundation | Server-only Supabase client infrastructure. |
| M4 | Telegram Client / Adapter | Plain-text Telegram `sendMessage` adapter. |
| M5 | Telegram Webhook | Authenticated POST transport boundary. |
| M6 | Input Normalization | Telegram -> `NormalizedInboundMessage`. |
| M7 | Health Endpoint | Public dependency-free health probe. |
| M8 | `processMessage()` Skeleton | Channel-independent core boundary; now expanded by M14/15/23. |
| M9 | Foundation End-to-End Telegram Flow | Normalize -> process -> deliver bridge. |
| M10 | Vercel Deployment Foundation | GitHub/Vercel/Telegram production foundation. |
| M11 | Core Database Schema | Seven tables, enums, relationships, constraints, indexes. |
| M12 | Course & Branch Seed Data | Approved courses, branches, and active mappings. |
| M13 | Database Repository Layer | Server-only function repositories; no ORM/business logic. |
| M14 | Lead Persistence | Resolves WHO the Lead is from stable channel identity. |
| M15 | Conversation Persistence | Resolves WHICH conversation belongs to Lead/channel. |
| M16 | Message Persistence | **SKIPPED**; no messages table/history. |
| M17 | Database Security / RLS Baseline | **SKIPPED**; server-only access is mandatory. |
| M18 | Language + Semantic Normalization | Faithful English meaning, language, uncertainty, entities. |
| M19 | Language Resolver | Deterministic response-language choice. |
| M20 | TurnAnalysis | What is happening in the current student turn. |
| M21 | Structured Output Validation | Strict Zod validation, one repair, safe fallback signal. |
| M22 | Query Router | Which trusted source categories are needed. |
| M23 | Orchestrator Expansion | Coordinates intelligence and available source loading. |
| M24 | Lead Memory | **COMPLETE**; persists approved stable explicit facts only. |
| M25 | Conversation State | COMPLETE; typed workflow snapshot, controlled persistence, and initial-course establishment only. |
| M26 | Business / Sales Logic | **COMPLETE**; deterministic decision and persistence integration complete. |
| M27 | Confidence Engine | **COMPLETE**; unique delivered-information coverage, derived score/range, and demo gate math. |
| M28 | Course Context Switching | **DEFERRED** from the current demo. |
| M29 | Demo Rejection / Nurture / Stop | **DEFERRED** from the current demo. |
| M30 | RAG Ingestion / Chunking | **COMPLETE WITH ACCEPTED DEMO LIMITATION**; pure Doc 02 heading chunks with provenance and TBD retrieval exclusion. |
| M31 | Embeddings / Storage | **PLANNED**; owns embeddings and knowledge-base storage. |
| M32 | RAG Retrieval | **PLANNED**; owns retrieval and source loading. |
| M33 | Structured DB / RAG Context Merge | **PLANNED**; preserves structured-truth authority at context assembly. |

## 7. Important Contracts / Types

- `NormalizedInboundMessage` — `src/core/input/types.ts`: channel-normalized text/voice input.
- `SemanticNormalizationResult` — `src/core/types/semantic-normalization.ts`: faithful normalized meaning.
- `ResolvedLanguage` and `LanguageResolverInput` — `src/core/language/language-resolver.ts`: allowed output language and priority signals.
- `TurnAnalysis` / `TurnAnalysisInput` — `src/core/types/turn-analysis.ts`: strict current-turn analysis and safe read-only context input.
- `StructuredOutputValidationResult<T>` — `src/core/validation/structured-output.ts`: `valid`, `repaired`, or `fallback` control result.
- `QueryRoute` / `QueryToolRequest` — `src/core/routing/types.ts`: source requirements only.
- `SourceLoad<T>` — `src/core/orchestration/types.ts`: `not_required`, `loaded`, `unresolved`, or `deferred`.
- `CourseBranchMappingEvidence` — same file: course identity, optional requested branch name, and active course branches; no availability conclusion.
- `OrchestrationHandoff` — same file: Lead, Conversation, normalized meaning, analysis, language, route, and source loads.
- `SalesDecision` / `QualificationDecision` / `DemoBookingProgress` — `src/core/sales-logic/sales-types.ts`: trusted deterministic business output; never student-facing wording.
- `ConversationState` / `ConversationStateUpdatePatch` — `src/core/state/conversation-state.ts`: typed temporary workflow state and approved-field-only persistence boundary.
- Database row/input types — `src/lib/db/repositories/types.ts`: schema-aligned `Course`, `Branch`, `Lead`, `Conversation`, `DemoBooking`, and `KnowledgeBaseRecord`.

## 8. Source-of-Truth Rules

Authority order:

```text
Live Tool Result
  > Structured Database
  > Approved RAG
  > Conversation Memory / State context
```

LLM knowledge is outside this authority hierarchy and is never business truth.

| Source | Responsibility | Current status |
|---|---|---|
| Live tools | Live checks, assets, actions | Symbolic requests only; execution deferred. |
| Structured DB | Exact/mutable facts | Implemented for course/branch reads and persistence. |
| Approved RAG | Deep approved explanations | Deferred; route/source marker only. |
| Memory | Stable student information | M24 persists approved explicit Lead facts; the updated Lead may be handed off read-only. |
| State | Temporary workflow context | M25 exposes a typed snapshot; controlled persistence is available for future trusted decisions. |

M27 parses persisted coverage read-only, derives its 21-point score/range, and supplies M26's normal demo gate. Coverage is informational coverage already delivered to the student, never purchase probability; no current runtime path marks coverage because verified response delivery does not exist. Future verified delivery may use M27's M25-compatible confidence patch. Course switching remains deferred to M28. Persistent nurture/rejection/stop transitions remain deferred to M29. Booking and tool execution remain absent.

## 9. Database / Persistence Map

Current tables:

- `courses` — exact course catalog/business facts.
- `branches` — branch, facility, and hostel facts.
- `course_branches` — active course-to-branch mappings.
- `leads` — stable channel identity and future student memory fields.
- `conversations` — Lead/channel record and future workflow fields.
- `demo_bookings` — booking storage foundation; not executed by current runtime.
- `knowledge_base` — future source-attributed RAG storage; not retrieved by current runtime.

There is no `messages` table. RLS is not implemented. Browser-side privileged database access is prohibited.

Migrations live in `supabase/migrations/`. Repository functions live in `src/lib/db/repositories/`. Normal keyed absence returns `null`, empty collections return `[]`, and database failures throw.

## 10. AI / Provider Rules

- Shared lazy client: `src/services/openai/client.ts`.
- Current model for both M18 and M20: `gpt-5.6-luna`.
- API: OpenAI Responses API.
- Requests use strict JSON Schema Structured Outputs and `store: false`.
- M18 and M20 validate with their Module 21 Zod schemas.
- Valid initial output causes zero repair calls.
- Invalid initial output causes exactly one repair request using `structured_output_repair_v1`.
- Valid repair returns trusted typed data; invalid repair or repair failure throws a controlled typed output error.
- There is no recursion, repair loop, or fabricated fallback object.
- Student/context/previous provider output is serialized as untrusted data.
- Prompt files: `src/services/openai/prompts/semantic-normalizer.prompt.ts`, `turn-analysis.prompt.ts`, and `structured-output-repair.prompt.ts`.
- `OPENAI_API_KEY` is lazy, server-only, ignored locally, and must never be logged.

## 11. Testing Map

Current M25 pre-commit baseline: **198 passed, 0 failed**; TypeScript and production build passed.

| Area | Focused test |
|---|---|
| Input normalization | `tests/input-normalization.test.mjs` |
| Logging/error utilities | `tests/logging-error-utilities.test.mjs` |
| Repository layer | `tests/database-repositories.test.mjs` |
| Lead persistence | `tests/lead-persistence.test.mjs` |
| Conversation persistence | `tests/conversation-persistence.test.mjs` |
| Semantic normalization | `tests/semantic-normalizer.test.mjs` |
| Language resolver | `tests/language-resolver.test.mjs` |
| TurnAnalysis | `tests/turn-analysis.test.mjs` |
| Lead Memory | `tests/lead-memory.test.mjs` |
| Conversation State | `tests/conversation-state.test.mjs` |
| Business / Sales Logic | `tests/sales-logic.test.mjs` |
| RAG ingestion / chunking | `tests/rag-ingestion.test.mjs` |
| Structured validation/repair | `tests/structured-output-validation.test.mjs` |
| Query Router | `tests/query-router.test.mjs` |
| Orchestration/source loading | `tests/orchestrator.test.mjs` |
| Core output boundary | `tests/process-message.test.mjs` |
| Telegram delivery bridge | `tests/telegram-response-delivery.test.mjs` |

Standard commands:

```text
node --conditions=react-server --test tests/<focused>.test.mjs
node --conditions=react-server --test tests/*.test.mjs
npx tsc --noEmit
npm run build
git diff --check
```

The Node test runner may emit the known non-failing `MODULE_TYPELESS_PACKAGE_JSON` warning.

## 12. Current Deferred / Not Implemented

- Message persistence and recent-message history; `recentLanguage` is currently always `null`.
- RLS/database security baseline.
- M27 Confidence Engine is complete. It derives unique delivered-information coverage (maximum 21), not purchase probability; the normal demo gate requires total 11, course 2, fees 2, and placement 2, while strong intent bypasses confidence only.
- No current path automatically marks coverage because response generation, delivery verification, and a real student-facing answer remain absent.
- Course Context Switching behavior (M28 deferred from current demo).
- Demo rejection/nurture/stop behavior (M29 deferred from current demo).
- M30 RAG ingestion/chunking is complete with an accepted demo limitation: only Doc 02 is parsed by natural headings, with provenance/class preservation and TBD-only retrieval exclusion. The generic `/analytics/i` metadata rule currently leaks `marketing_analytics` into Data Analytics chunks; this may reduce future retrieval metadata precision, correction is deferred, and M32 must not assume that metadata is perfectly isolated.
- Natural heading boundaries take priority over the approximate 300–700 word guidance.
- Embeddings/storage (M31), runtime retrieval (M32), and structured DB/RAG context merge (M33) remain unimplemented.
- Tool execution, demo availability execution, document/location execution, and booking creation.
- Real response planning/generation, Saleel style engine, few-shot selection, and verifier.
- STT/TTS and voice intelligence; voice is unsupported after persistence.
- WhatsApp or other channel adapters.
- Message queues, production retry orchestration, advanced observability, and admin UI.

## 13. How Future Codex Should Work

1. Read this `AGENTS.md` first.
2. Read `docs/CURRENT_ARCHITECTURE.md` only when detailed architectural context is needed.
3. Do not scan the entire repository by default.
4. Open only files relevant to the requested module/change.
5. Follow imports only when needed to verify a boundary or contract.
6. Reuse existing functions, constants, schemas, types, prompts, clients, and repositories.
7. Before adding a helper, check the Function / File Map above.
8. Never redesign a completed module unless the task explicitly authorizes it.
9. Preserve phase/module boundaries; do not “helpfully” implement the next module.
10. Treat current committed source as authority over historical reports.
11. Keep deterministic source selection and business truth in TypeScript/DB, not prompts.
12. Maintain dependency injection at narrow provider/repository boundaries for deterministic tests.
13. Run focused tests during implementation.
14. Run the full suite/build normally at the final module checkpoint, unless the task specifically requests them earlier.
15. Do not call live services unless the task explicitly requires live verification.
16. Inspect Git diff/status before staging; preserve unrelated user files and untracked reports.

## 14. Documentation Maintenance Rule

Update this file only when one of these changes:

- an important function or path changes;
- a new module adds a major architectural capability;
- an existing responsibility moves;
- a major public/internal contract changes;
- the runtime pipeline changes.

Do not rewrite this guide for trivial implementation details. Keep it compact and point deeper architectural explanations to `docs/CURRENT_ARCHITECTURE.md`.
