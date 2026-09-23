# SkillUp AI Sales Agent — Current Architecture

## 1. Architecture Snapshot

| Item | Current value |
|---|---|
| Repository | `https://github.com/exileautomate/skillup-sales-agent.git` |
| Branch | `main` |
| Committed SHA documented | `f5d6dfea8b87b0cd2fbba6bdef22bc58cb9e4a5a` |
| Current completed phase | Phase 3 — Input & Intelligence Foundation |
| Next planned module | Module 25 — Conversation State |
| Final committed regression | 172 passed, 0 failed |
| TypeScript/build at checkpoint | Passed / passed |
| Current inbound channel | Telegram |
| Current text output | Temporary deterministic Saleel placeholder |
| Current voice output | Unsupported after Lead/Conversation persistence |

The system currently has a working Telegram transport, persistent Lead and Conversation identity, conservative explicit-fact Lead Memory, structured course/branch data, two constrained OpenAI analysis stages, deterministic language resolution, deterministic source routing, and an orchestration handoff.

It does **not** yet have the Phase 4 business engine or a real student-facing AI answer pipeline.

## 2. Product / System Scope

Saleel is the SkillUp education sales agent persona. The current system can:

- authenticate and accept Telegram webhook updates;
- normalize Telegram text or voice metadata into a shared core input contract;
- identify or create a stable Lead;
- reuse or create a persistent Conversation;
- normalize text meaning into English while preserving uncertainty/entities;
- analyze what is happening in the current student turn;
- persist approved stable Lead facts conservatively after trusted TurnAnalysis;
- choose a response language deterministically;
- decide which trusted source categories are required;
- load available course and branch facts without making business conclusions;
- expose raw Lead/Conversation rows as read-only source material when routed;
- mark RAG and tool requirements as deferred;
- produce a typed internal `OrchestrationHandoff`.

The current system intentionally cannot yet:

- decide eligibility, qualification, sales actions, or confidence;
- update Conversation State;
- generate a factual student-facing business response;
- retrieve RAG knowledge;
- execute tools, check live availability, or create bookings;
- transcribe or synthesize voice;
- persist message history.

After successful text orchestration, `processMessage()` still returns:

```text
Hi, Saleel here from SkillUp. Eth course aan nokkunne?
```

This is a temporary phase boundary, not the output of the analysis handoff.

## 3. Technology Stack

### Installed and currently used

| Technology | Version/role |
|---|---|
| Next.js | `16.3.5`, App Router, webhook/health routes, production build |
| React | `19.2.8` |
| TypeScript | `^5`, strict, no emit, bundler resolution |
| Node test runner | Direct `.mjs` tests with `--conditions=react-server` |
| Tailwind CSS | `^4`, generic current web shell |
| Supabase JS | `^2.116.0`, server-side PostgreSQL access |
| PostgreSQL/Supabase | Structured business data and persistence |
| pgvector extension | Enabled; nullable dimensionless future embedding column only |
| OpenAI SDK | `^7.20.0`, Responses API for M18/M20 |
| Zod | `^4.6.5`, strict runtime structured-output validation |
| `server-only` | Protects provider/database/Telegram server modules |
| Telegram Bot API | Webhook input and plain-text `sendMessage` output |
| Vercel | Deployment foundation established in Phase 1 |

### Configured architecture details

- Source root: `src/`.
- Alias: `@/*` -> `./src/*`.
- Next configuration is intentionally minimal.
- There is no custom `vercel.json` in the repository.
- The default generated web page remains; the product runtime is presently the API/Telegram path.

### Planned/deferred, not implemented

- Sarvam STT/TTS is not installed or called.
- RAG execution, embeddings generation, and vector retrieval are absent.
- No n8n.
- No WhatsApp adapter.
- No external tool execution coordinator.

## 4. Development Phase Map

### Phase 1 — Foundation — COMPLETE

| Module | Name | Status | Current architectural result |
|---|---|---|---|
| 1 | Project Bootstrap | COMPLETE | Next.js App Router, React, TypeScript, lint/build foundation. |
| 2 | Environment & Config | COMPLETE | Central server environment access and ignored local env files. |
| 3 | Supabase Client Foundation | COMPLETE | Server-only Supabase client with auth-session persistence disabled. |
| 4 | Telegram Client / Adapter | COMPLETE | Safe plain-text Telegram `sendMessage` adapter. |
| 5 | Telegram Webhook | COMPLETE | Secret-authenticated POST route and safe HTTP responses. |
| 6 | Input Normalization | COMPLETE | Telegram payload -> `NormalizedInboundMessage`. |
| 7 | Health Endpoint | COMPLETE | Public, dependency-free health response. |
| 8 | `processMessage()` Skeleton | COMPLETE | Channel-independent processing boundary, later expanded in M14/15/23. |
| 9 | Foundation End-to-End Telegram Flow | COMPLETE | Normalized input -> processing -> Telegram delivery. |
| 10 | Vercel Deployment Foundation | COMPLETE | GitHub/Vercel/Telegram production foundation and initial round trip. |

Phase 1 also established structured safe logging, request IDs, and a small application error type as supporting infrastructure.

### Phase 2 — Database Foundation — COMPLETE FOR APPROVED DEMO SCOPE

| Module | Name | Status | Current architectural result |
|---|---|---|---|
| 11 | Core Database Schema | COMPLETE | Seven relational tables, enums, constraints, indexes, timestamps. |
| 12 | Course & Branch Seed Data | COMPLETE | Approved course, branch, and course-branch facts. |
| 13 | Database Repository Layer | COMPLETE | Function-based server-only repository boundary. |
| 14 | Lead Persistence | COMPLETE | Stable Lead identity from `channel + channel_user_id`. |
| 15 | Conversation Persistence | COMPLETE | Newest Lead/channel Conversation reuse or neutral creation. |
| 16 | Message Persistence | **INTENTIONALLY SKIPPED** | No `messages` table or recent-message history. |
| 17 | Database Security / RLS Baseline | **INTENTIONALLY SKIPPED** | No RLS; database access must stay server-side. |

### Phase 3 — Input & Intelligence Foundation — COMPLETE

| Module | Name | Status | Current architectural result |
|---|---|---|---|
| 18 | Language + Semantic Normalization | COMPLETE | Faithful normalized English, language, uncertainty, entities. |
| 19 | Language Resolver | COMPLETE | Deterministic response-language priority. |
| 20 | TurnAnalysis | COMPLETE | Strict current-turn analysis without answers/business decisions. |
| 21 | Structured Output Validation | COMPLETE | Zod parse/validation, one repair, safe fallback control result. |
| 22 | Query Router | COMPLETE | Deterministic intent-to-source plan and symbolic tool needs. |
| 23 | Orchestrator Expansion | COMPLETE | Current text pipeline coordination and source-load handoff. |

### Phase 4 — Business Logic, Memory, State & Confidence — ACTIVE

| Module | Name | Status | Current architectural result |
|---|---|---|---|
| 24 | Lead Memory | COMPLETE | Conservative explicit-fact Lead updates integrated after TurnAnalysis. |
| 25 | Conversation State | NEXT | Active current-demo scope. |
| 26 | Business / Sales Logic | PLANNED | Active current-demo scope. |
| 27 | Confidence Engine | PLANNED | Active current-demo scope. |
| 28 | Course Context Switching | **DEFERRED** | Out of current demo scope. |
| 29 | Demo Rejection / Nurture / Stop | **DEFERRED** | Out of current demo scope. |

## 5. Current End-to-End Runtime

### Telegram request path

```text
Telegram update
  -> POST src/app/api/telegram/webhook/route.ts
  -> secret header validation
  -> normalizeTelegramUpdate(update)
  -> processAndDeliverTelegramResponse(normalizedMessage, ...)
  -> processMessage(normalizedMessage)
  -> sendTelegramTextMessage(chatId, completed message)
```

The webhook:

1. creates a request ID;
2. validates `x-telegram-bot-api-secret-token` before parsing the body;
3. rejects malformed/invalid envelopes safely;
4. acknowledges unsupported normalization results without processing;
5. passes normalized messages to the delivery bridge;
6. returns a generic `502` if processing or outbound delivery throws;
7. does not expose the underlying failure or secret.

### Text processing path

`processMessage()` is defined in `src/core/process/process-message.ts`.

```text
NormalizedTextInboundMessage
  -> getOrCreateLeadByChannelIdentity(channel, channelUserId)
  -> getOrCreateConversationForLead(lead.id, channel)
  -> orchestrateTextTurn({ message, lead, conversation })
       -> normalizeSemanticMeaning(message.text)
       -> load current Conversation course read-only if present
       -> build minimal TurnAnalysis input/context
       -> analyzeTurn(...)
       -> applyLeadMemory(...) from explicit current-turn facts
       -> resolveLanguage(...)
       -> routeQuery(turnAnalysis)
       -> load structured sources / build deferred markers
       -> return OrchestrationHandoff
  -> temporary Saleel placeholder
  -> Telegram delivery bridge
  -> Telegram sendMessage
```

Important current detail: `processMessage()` awaits `orchestrateTextTurn()` but does not yet return or consume the handoff for business output. The handoff proves and establishes the internal pipeline for later phases.

### Voice processing path

```text
NormalizedVoiceInboundMessage
  -> getOrCreateLeadByChannelIdentity(...)
  -> getOrCreateConversationForLead(...)
  -> { status: "unsupported", reason: "voice-not-supported", messages: [] }
```

Voice does not call:

- OpenAI;
- semantic normalization;
- TurnAnalysis;
- language resolution;
- Query Router;
- source loading;
- STT/TTS;
- Telegram outbound delivery.

### Failure flow

- Lead lookup/create failure stops before Conversation persistence.
- Conversation lookup/create failure stops before orchestration.
- Semantic provider/output failure stops before TurnAnalysis.
- TurnAnalysis provider/output failure stops before language/routing/source loading.
- Required repository exceptions propagate and prevent placeholder success.
- `unresolved` and `deferred` source statuses are explicit handoff states, not exceptions or fake data.
- The Telegram route catches propagated processing/delivery failure at the outer boundary and returns a safe generic error.

## 6. Channel Architecture

### Shared inbound boundary

`src/core/input/types.ts` defines:

- `NormalizedTextInboundMessage`;
- `NormalizedVoiceInboundMessage`;
- `NormalizedInboundMessage`.

The common fields are:

- `channel` (currently the literal `telegram`);
- `channelUserId`;
- `chatId`;
- `messageId`;
- `updateId`;
- source `timestamp`;
- server `receivedAt`.

Text includes exact `text`. Voice includes Telegram file metadata and no transcript.

### Telegram adapter boundary

- `normalizeTelegramUpdate()` owns Telegram payload interpretation.
- `processAndDeliverTelegramResponse()` bridges normalized core output to channel delivery.
- `sendTelegramTextMessage()` owns Telegram Bot API transport.
- `processMessage()` and `orchestrateTextTurn()` import no Telegram client, webhook, or Vercel APIs.

This separation permits future channels to normalize into the same core contract without embedding channel rules in the intelligence pipeline.

## 7. Persistence Architecture

### Lead identity

Module 14 answers: **Who is this Lead?**

```text
stable identity = channel + channel_user_id
```

`getOrCreateLeadByChannelIdentity()`:

1. calls `findLeadByChannelUserId()`;
2. returns an existing Lead unchanged;
3. otherwise creates only `channel` and `channel_user_id`;
4. on the exact unique conflict, performs one targeted reread;
5. propagates unrelated errors.

Inbound messages do not overwrite stored Lead fields.

### Conversation identity

Module 15 answers: **Which persistent Conversation is this Lead using on this channel?**

`getOrCreateConversationForLead()`:

1. calls `findLatestConversationForLeadChannel()`;
2. reuses the newest matching record;
3. otherwise creates only `lead_id` and `channel`.

Newest ordering is `created_at DESC`, then `id DESC`. There is no uniqueness constraint for one Conversation per Lead/channel, so concurrent first-message duplication remains an accepted demo limitation.

### Current write boundary

The live processing path currently writes only through the existing get/create behavior:

- a new Lead may be inserted;
- a new Conversation may be inserted.

Module 23 does not update:

- Lead facts/preferences/status;
- Conversation course/stage/qualification/confidence/demo/pending/booking fields;
- courses or branches;
- bookings;
- knowledge records.

## 8. Database Schema Snapshot

The schema is created by `supabase/migrations/20260921014509_module_11_core_database_schema.sql` and seeded/fixed by the two Module 12 migrations.

### Tables

#### `courses`

Exact course catalog facts: canonical internal name, student-facing name, slug, durations, fees, GST, admission/total fees, eligibility summary, installments, class duration, batch rule, certificate, placement/laptop/demo facts, and timestamps.

Canonical current internal names seeded:

- `data_analytics`;
- `digital_marketing`;
- `accounting`.

Accounting is student-facing **Accounting**, not SAP/SAP FICO.

#### `branches`

Branch names, nullable address/map details, facilities, hostel facts, and timestamps.

Current seed names are Calicut, Mankave, Kochi, and Kannur. Application orchestration does not hard-code those names.

#### `course_branches`

Many-to-many course/branch mapping with `is_active` and a unique `(course_id, branch_id)` constraint.

#### `leads`

Stable identity and future memory fields:

- unique `(channel, channel_user_id)`;
- nullable name, phone, preferred language, qualification;
- nullable course-interest and branch-preference foreign keys;
- `lead_status` default `NEW`.

#### `conversations`

Lead/channel record and future workflow fields:

- nullable `current_course_id`;
- current sales stage;
- qualification status;
- confidence JSON;
- demo push state/rejection count;
- pending question;
- booking progress JSON.

Those fields exist in storage but no Conversation State engine currently updates them.

#### `demo_bookings`

Relational booking storage for Lead, Conversation, Course, Branch, student details, date/time, status, and tool reference. Repository primitives exist, but the current runtime does not create or confirm bookings.

#### `knowledge_base`

Future source-attributed RAG records: category, intent, content, knowledge class, metadata, optional course, optional nullable dimensionless vector, and source attribution. Current orchestration does not query it as a substitute for RAG.

### Absent table/security layer

- There is no `messages` table because M16 was intentionally skipped.
- There is no RLS baseline because M17 was intentionally skipped.
- Database access must stay server-side; do not describe the database as production-hardened for browser access.

### Database enums

- `lead_status`: `NEW`, `QUALIFYING`, `QUALIFIED`, `NURTURE`, `UNQUALIFIED`.
- `sales_stage`: `NEW`, `DISCOVERY`, `COURSE_EDUCATION`, `QUALIFICATION`, `OBJECTION`, `DEMO_READY`, `BOOKING`, `BOOKED`, `NURTURE`, `STOPPED`.
- `qualification_status`: `UNKNOWN`, `PENDING`, `QUALIFIED`, `UNQUALIFIED`.
- `demo_push_status`: `NORMAL`, `NURTURE`, `STOP_DEMO_PUSH`, `STOP_ALL_SALES_PUSH`.
- `booking_status`: `PENDING`, `CONFIRMED`, `CANCELLED`, `FAILED`.
- `knowledge_class`: `business_locked`, `demo_explanatory`, `tbd`.

Generic Conversation `status` remains nullable text.

## 9. Semantic Normalization

Module 18 is implemented by:

- contract: `src/core/types/semantic-normalization.ts`;
- prompt/schema: `src/services/openai/prompts/semantic-normalizer.prompt.ts`;
- service: `src/services/openai/semantic-normalizer.ts`;
- Zod schema: `src/core/validation/schemas/semantic-normalization.schema.ts`.

### Purpose

`normalizeSemanticMeaning(originalMessage)` faithfully expresses the student's meaning in English. It does not answer the student or make business decisions.

### Output

`SemanticNormalizationResult` contains exactly:

- `normalizedEnglish`;
- `detectedOriginalLanguage` (`english`, `malayalam`, `manglish`, `mixed`, `unclear`);
- `uncertainty[]` with text/reason/critical;
- `preservedEntities[]` with approved entity type/value.

### Provider behavior

- Model: `gpt-5.6-luna`.
- API: Responses API.
- Prompt version: `semantic_normalizer_v1`.
- Strict JSON Schema Structured Output.
- `store: false`.
- Student message is delimited and treated as untrusted data.
- Accounting naming, technical terms, negation, and uncertainty are protected by prompt rules.

### Validation/failure behavior

Initial output passes through Module 21's `semanticNormalizationResultSchema` and `validateWithOneRepair()`.

- Initial provider request failure -> `SemanticNormalizationProviderError`.
- Valid first output -> trusted result, zero repair calls.
- Invalid first output -> exactly one structured repair request.
- Valid repair -> trusted repaired result.
- Invalid repair -> `SemanticNormalizationOutputError` with `invalid_after_repair`.
- Repair request failure -> `SemanticNormalizationOutputError` with `repair_failed`.

No original-text fallback pretends normalization succeeded.

## 10. Language Resolution

Module 19 is pure deterministic TypeScript in `src/core/language/language-resolver.ts`.

`resolveLanguage(input)` applies this priority:

1. explicit `requestedResponseLanguage`;
2. clear current detected language, unless the turn should inherit context;
3. `recentLanguage`;
4. valid stored preferred language;
5. required default.

Resolved outputs are only:

- `english`;
- `malayalam`;
- `manglish`.

`mixed` and `unclear` never become response languages directly.

### Current integration values

- Requested language comes from TurnAnalysis.
- Current language comes from Semantic Normalization.
- `recentLanguage` is always `null` because M16/history is absent.
- Stored preference is accepted only if it matches a supported response language.
- Demo default is `manglish`.
- `ok`, `yes`, `fine`, and `hmm` (case/whitespace normalized) set `inheritCurrentLanguageContext = true`.

No LLM is used for language resolution or short-acknowledgement classification.

## 11. TurnAnalysis

Module 20 is implemented by:

- contract/vocabulary: `src/core/types/turn-analysis.ts`;
- prompt/schema: `src/services/openai/prompts/turn-analysis.prompt.ts`;
- service: `src/services/openai/turn-analysis.ts`;
- Zod schema: `src/core/validation/schemas/turn-analysis.schema.ts`.

### Responsibility

`analyzeTurn(input)` answers only: **What is happening in the student's current turn?**

Its output categories are:

- current language;
- explicitly requested response language;
- safely identified canonical course or `null`;
- all meaningful intents;
- current-turn explicit Lead facts;
- objection;
- sales signal;
- intent relationship;
- ambiguity.

It does not answer the student, decide eligibility, qualify a Lead, choose an action, execute a tool, update state, or generate a response.

### Important semantic invariants

- Course values are only `data_analytics`, `digital_marketing`, `accounting`, or `null`.
- Technical associations such as Power BI/Python/SEO do not establish course identity.
- Supplied read-only context may establish an active course only when safe.
- DTA ambiguity remains critical; it is not guessed as Data Analytics.
- Accounting never becomes SAP/SAP FICO.
- `leadFacts` includes only current-turn explicit name, qualification, branch preference, and contact.
- Multiple meaningful intents are preserved.
- One intent requires `intentRelationship = single`.
- More than one intent forbids `single`; the LLM chooses `independent`, `dependent`, or `mixed` semantically.
- Demo acceptance plus booking request is supported as a dependent multi-intent progression.

### Provider behavior

- Model: `gpt-5.6-luna`.
- API: Responses API.
- Prompt version: `turn_analysis_v1`.
- Strict JSON Schema Structured Output.
- `store: false`.
- Original text, normalized English, Lead context, Conversation context, and recent context are serialized as untrusted data.

### Validation/failure behavior

The production path uses Module 21's `turnAnalysisSchema` and `validateWithOneRepair()` with the same zero-or-one-repair semantics as M18.

Provider failures become `TurnAnalysisProviderError`. Final validation/repair failures become `TurnAnalysisOutputError` with a safe reason. Invalid analysis never reaches Query Router.

## 12. Structured Output Validation

Module 21 lives under `src/core/validation/` and is provider-independent.

### Schemas

- `semanticNormalizationResultSchema` exactly models M18.
- `turnAnalysisSchema` exactly models M20.
- Both use strict objects and reject extra fields.
- TurnAnalysis rejects empty/unknown intents and invalid enum/nested shapes.
- A schema-level refinement enforces the intent-count/relationship invariant.

### `validateStructuredOutput(rawOutput, schema)`

The validator:

1. requires a string;
2. rejects empty/whitespace-only output;
3. parses JSON;
4. validates with the supplied Zod schema;
5. returns either trusted typed data or concise issues.

Issue summaries are bounded to eight entries and contain only `path` and `code`. Raw stacks and large provider output are not returned as issues.

### `validateWithOneRepair({ rawOutput, schema, repair })`

```text
valid first output
  -> { status: "valid", value, repaired: false }

invalid first output
  -> call injected repair exactly once
  -> valid repair
       -> { status: "repaired", value, repaired: true }
  -> invalid repair
       -> { status: "fallback", value: null, reason: "invalid_after_repair" }
  -> repair throws
       -> { status: "fallback", value: null, reason: "repair_failed" }
```

There is no loop, recursion, second repair, provider client, or fabricated contract object inside the generic module.

### Production integration

M18 and M20 inject their existing provider callback into the generic repair workflow. They use the versioned `structured_output_repair_v1` prompt and convert final fallback control signals into their typed output errors.

## 13. Query Router

Module 22 is deterministic TypeScript:

- route types: `src/core/routing/types.ts`;
- complete intent mapping and router: `src/core/routing/query-router.ts`.

`routeQuery(turnAnalysis)` receives an already-valid `TurnAnalysis`. It does not receive raw text and does not call OpenAI.

### Output

`QueryRoute` contains only:

- `needsStructuredCourseFacts`;
- `needsBranchFacts`;
- `needsRag`;
- `needsMemory`;
- `needsState`;
- `toolRequests`.

### Mapping strategy

`INTENT_ROUTING_RULES` uses `satisfies Record<Intent, IntentRoutingRule>`, so adding an intent without a rule is a TypeScript error. Runtime tests also compare routed intent coverage against `TURN_INTENTS`.

For multi-intent turns, boolean requirements are unioned and equivalent tool requests are deduplicated. The router does not sequence dependent intents or make business decisions.

If an intent needs course context while `turnAnalysis.course` is `null`, the router requests State. It does not claim State resolves the course and does not remove critical ambiguity.

### Tool descriptors

Allowed symbolic descriptors are:

- `check_demo_availability`;
- `get_course_document` with `brochure`, `syllabus`, or `testimonial`;
- `get_branch_location`.

`create_demo_booking` is deliberately absent. A route is a source plan, not action authorization or success.

## 14. Orchestrator

Module 23 consists primarily of:

- `processMessage()` in `src/core/process/process-message.ts`;
- `orchestrateTextTurn()` in `src/core/orchestration/orchestrate-text-turn.ts`;
- handoff/source contracts in `src/core/orchestration/types.ts`.

### `processMessage()` responsibility

`processMessage()` manages the outer turn:

1. resolves the stable Lead;
2. resolves the Lead/channel Conversation;
3. stops voice as unsupported;
4. invokes text orchestration;
5. returns the temporary placeholder only after orchestration succeeds.

It does not inline semantic, routing, repository, or business rules.

### `orchestrateTextTurn()` responsibility

The orchestrator receives an already-normalized text message plus resolved Lead and Conversation. Production defaults are real services/repositories; narrow optional dependencies make focused tests deterministic.

It coordinates:

1. semantic normalization;
2. read-only existing-course context loading;
3. TurnAnalysis input assembly;
4. TurnAnalysis;
5. conservative Lead Memory update;
6. response-language resolution;
7. deterministic Query Router;
8. currently available source loading;
9. handoff construction.

It contains no eligibility, qualification, sales, confidence, objection, demo progression, booking progression, response-writing, or style rules.

### Read-only context assembly

- If `conversation.current_course_id` exists, `getCourseById()` resolves it.
- Only a row whose `internal_name` matches the canonical TurnAnalysis course enum becomes current-course context.
- Safe stored Lead fields may be supplied separately as `leadMemory` context.
- Stored Lead context is not copied into current-turn `leadFacts`.
- `recentConversation` is explicitly `null`.
- No course, history, memory, or state is invented.

## 15. OrchestrationHandoff

`OrchestrationHandoff` is an internal trusted package containing:

- the current persisted `lead` row after M24;
- the read-only `conversation` row;
- `semanticNormalization`;
- `turnAnalysis`;
- `resolvedLanguage`;
- `queryRoute`;
- `sources`.

The source bundle contains:

- `structuredCourseFacts`;
- `structuredBranchFacts`;
- `courseBranchMapping`;
- `memorySource`;
- `stateSource`;
- `rag`;
- `tools`.

Future business/response modules should consume this handoff instead of:

- reinterpreting raw student text;
- rerunning TurnAnalysis;
- rebuilding source routing;
- guessing canonical course/branch context;
- treating deferred source requirements as results.

The handoff is not student-facing, not a SalesDecision, and not a ResponsePlan.

## 16. Source Loading Architecture

### `SourceLoad<T>` states

| Status | Meaning |
|---|---|
| `not_required` | Router did not request this source; no load attempted. |
| `loaded` | Current implementation loaded truthful structured data. |
| `unresolved` | Source was required but the target could not be identified/resolved safely. |
| `deferred` | Source is required but its implementation belongs to a later module/phase. |

### Failure vs unresolved vs deferred

- **Failure**: a provider/repository operation throws; orchestration rejects.
- **Unresolved**: the source category is needed but safe identifiers/data are absent; the handoff records no data and continues.
- **Deferred**: the source need is valid but the source system/executor is not implemented; the handoff records no fake data.

### Structured course source

- Route does not need it -> `not_required`.
- Route needs it but TurnAnalysis course is `null` -> `unresolved: canonical_course_unavailable`.
- Canonical course exists -> reuse safe persisted course context when it matches, otherwise call `getCourseByInternalName()`.
- Missing course record -> `unresolved: course_record_not_found`.
- Repository exception -> propagate.

### Structured branch source

Branch loading uses repositories only:

- explicit named branch only -> `getBranchByName()`;
- canonical course -> `getActiveBranchesForCourse()`;
- neither name nor course -> `listBranches()`;
- no route need -> no query.

### Memory source

If routed, the current persisted Lead row after M24 is returned as `loaded`. The `leads` table is the current memory representation; no duplicate memory store exists.

### State source

If routed, the already-loaded Conversation row is returned as `loaded`. This is raw read-only workflow context, not an M25 state engine.

### RAG source

- No RAG need -> `not_required`.
- RAG need -> `deferred: rag_retrieval_not_implemented` with `data: null`.

The existing `knowledge_base` repository is not queried as fake RAG.

### Tool source

- No requests -> `not_required` and an empty request list.
- Requests exist -> `deferred: tool_execution_not_implemented` with copied symbolic descriptors.

No tool is called and no result/success is claimed.

## 17. Course / Branch Architecture

### Canonical course handling

TurnAnalysis produces only:

- `data_analytics`;
- `digital_marketing`;
- `accounting`;
- `null`.

Orchestration loads a persisted Conversation course only when its database `internal_name` is a canonical value. It never converts an ambiguous term such as DTA or a technical topic into a course.

### Course plus explicit branch

For a branch-fact route with a canonical course and an explicit branch preference, Module 23 preserves three factual pieces:

1. the canonical Course record/context;
2. the requested Branch row when found;
3. active branches returned for that Course.

`CourseBranchMappingEvidence` contains:

- `courseId`;
- `courseInternalName`;
- `requestedBranchName` or `null`;
- `activeBranches`.

This evidence lets later logic determine whether, for example, Data Analytics maps to Kochi. Module 23 does not add `isMapped`, `available`, `eligible`, or `bookable` decisions.

If a named branch exists but is not among the active course branches, both source facts remain truthful. Interpretation belongs later.

## 18. Memory vs State Boundary

### Current sources

| Concept | Current representation | Current permissions |
|---|---|---|
| Stable student context | Persisted `Lead` row updated conservatively by M24 | M24-approved writes; read-only handoff when routed |
| Workflow/session context | Raw persisted `Conversation` row | Read-only handoff when routed |

### Module boundary

- M25 will introduce Conversation State behavior.

M24 stores only explicit stable student facts and does not decide eligibility or mutate Conversation workflow fields. M25 is not implemented.

The current naming `memorySource` and `stateSource`, combined with `SourceLoad`, provides a replaceable boundary for those later capabilities without pretending they already exist.

## 19. Business Truth / Source Authority

The locked authority hierarchy is:

```text
1. Live Tool Result
2. Structured Database
3. Approved RAG
4. Conversation Memory / State context
```

LLM knowledge is outside this authority hierarchy and is never authoritative business truth.

Responsibilities:

- **Structured DB**: exact/mutable facts such as fees, GST, duration, eligibility facts, branch mappings, facilities, certificates, and demo flags.
- **Approved RAG**: deeper approved explanations such as learning methods, topic explanations, internship/placement process, and policies.
- **Memory**: stable student information such as name, qualification, preferred language, course interest, and branch preference.
- **State**: temporary workflow context such as current course, stage, pending question, qualification status, demo state, and booking progress.
- **Tools**: live checks, assets, and later actions.
- **LLM**: language understanding within strict contracts; never fee/eligibility/availability truth.

Current implementation loads structured DB facts, persists conservative M24 Lead memory, exposes updated Lead and raw Conversation context read-only in the handoff, and defers RAG/tools. It does not yet merge competing source results.

## 20. AI Service Architecture

### Shared client

`createOpenAIClient()` in `src/services/openai/client.ts`:

- imports `server-only`;
- reads `OPENAI_API_KEY` lazily through central environment access;
- creates no client until a real request is needed;
- retains no client/request state between calls;
- converts missing-key configuration into `OpenAIConfigurationError`.

### Current services

| Service | Function | Model | Prompt version | Schema name |
|---|---|---|---|---|
| Semantic Normalizer | `normalizeSemanticMeaning` | `gpt-5.6-luna` | `semantic_normalizer_v1` | `semantic_normalization` |
| TurnAnalysis | `analyzeTurn` | `gpt-5.6-luna` | `turn_analysis_v1` | `turn_analysis` |

Both services:

- call `client.responses.create(...)`;
- use non-streaming request shapes;
- use strict JSON Schema output;
- set `store: false`;
- extract `output_text`;
- validate through Module 21;
- reuse the same provider callback for the single repair request;
- expose injection only for deterministic provider tests.

### Prompt organization

`src/services/openai/prompts/` contains:

- `semantic-normalizer.prompt.ts`;
- `turn-analysis.prompt.ts`;
- `structured-output-repair.prompt.ts`.

Prompts define narrow responsibilities and treat student/context/previous output as untrusted data. They do not expose tools.

## 21. Error / Failure Architecture

### Provider and configuration failures

- Missing OpenAI configuration -> `OpenAIConfigurationError` when a real client is requested.
- Initial semantic provider failure -> `SemanticNormalizationProviderError`.
- Initial TurnAnalysis provider failure -> `TurnAnalysisProviderError`.

### Structured output failures

- Invalid output after one repair -> typed output error with `invalid_after_repair`.
- Repair callback/provider failure -> typed output error with `repair_failed`.
- No invalid or null analysis flows downstream.

### Persistence/source failures

- Lead/Conversation lookup/create failures propagate.
- Required course/branch repository exceptions propagate.
- Normal keyed absence becomes `null`; orchestration may convert it into an explicit `unresolved` source state.

### Non-failure control states

- `unresolved` means no safe source target/data, not loaded success.
- `deferred` means the required source executor does not yet exist, not loaded success.
- unsupported voice is a deliberate `ProcessMessageResult`, not a transcript/provider failure.

### Outer boundary

The current Telegram webhook intentionally returns a generic safe error on processing/delivery failure. Internal details and secret values are not returned to the caller.

## 22. Security / Secret Boundary

### Current controls

- `.env*` is ignored by Git.
- Direct `process.env` reads are centralized in `src/config/env.ts`.
- OpenAI, Supabase, and Telegram clients are server-side modules.
- Telegram webhook requests require the configured secret header.
- Sensitive logger metadata keys are redacted.
- Raw bodies, student text, tokens, authorization values, and voice file IDs are not intended for logs.
- OpenAI requests use `store: false`.

### Current limitations

- M17 RLS was intentionally skipped.
- The Supabase client uses the configured publishable key and has no auth session.
- Server-only application access is therefore an architectural requirement, not an optional style choice.
- Do not claim production-grade row-level database isolation.

No secret values belong in documentation, tests, logs, prompts, or committed files.

## 23. Test Architecture

### Current committed baseline

- Full suite: **172 passed, 0 failed**.
- TypeScript: passed.
- Production build: passed.
- Commit: `f5d6dfea8b87b0cd2fbba6bdef22bc58cb9e4a5a`.

### Test map

| Test file | Primary coverage |
|---|---|
| `tests/input-normalization.test.mjs` | Telegram text/voice normalization and unsupported payloads |
| `tests/logging-error-utilities.test.mjs` | Request IDs, AppError, structured log redaction |
| `tests/database-repositories.test.mjs` | Repository queries, absence, failures, booking/knowledge primitives |
| `tests/lead-persistence.test.mjs` | Stable identity, conflict reread, process ordering |
| `tests/conversation-persistence.test.mjs` | Reuse/create policy, ordering, process ordering |
| `tests/semantic-normalizer.test.mjs` | Request contract, prompt boundaries, real one-repair integration |
| `tests/language-resolver.test.mjs` | Priority, context inheritance, determinism/immutability |
| `tests/turn-analysis.test.mjs` | Contract, prompts, intents, ambiguity, one-repair integration |
| `tests/structured-output-validation.test.mjs` | Zod schemas, safe issues, one-repair/fallback behavior |
| `tests/query-router.test.mjs` | Complete intent routing, source authority, union/deduplication |
| `tests/orchestrator.test.mjs` | Ordering, context, language, source loading, deferral, failures |
| `tests/process-message.test.mjs` | Placeholder/voice core boundary and immutability |
| `tests/telegram-response-delivery.test.mjs` | Completed delivery, unsupported voice, outbound failure |

### Efficient future testing workflow

1. During implementation, run the focused test file for the changed module.
2. During verification, run targeted high-risk checks for provider/action/source boundaries.
3. During architecture audit, prefer static inspection unless a suspicious behavior requires a test.
4. At the final module checkpoint, run one complete suite, TypeScript, production build, and diff check.

High-risk business/action boundaries must still receive strong tests once implemented. Efficiency is not permission to weaken safety checks.

Standard full command:

```text
node --conditions=react-server --test tests/*.test.mjs
```

The known `MODULE_TYPELESS_PACKAGE_JSON` warning is non-failing.

## 24. Current Known Limitations

- The student-facing text response is still a fixed placeholder.
- `OrchestrationHandoff` is built internally but not yet consumed by business/response modules.
- Voice is unsupported after identity persistence.
- No STT/TTS or voice transcript exists.
- M16 was skipped: no message table, recent history, or persisted transcript.
- `recentLanguage` is always `null` in current orchestration.
- M17 was skipped: no RLS baseline.
- M25 Conversation State is next; M26 Business / Sales Logic and M27 Confidence Engine remain planned.
- Conversation State behavior/updates do not exist.
- No business/sales decision engine exists.
- No eligibility/qualification decision is made.
- No confidence engine exists.
- No course-switching behavior exists; M28 is deferred from the current demo.
- No demo rejection/nurture/stop engine exists; M29 is deferred from the current demo.
- RAG retrieval, embeddings generation, and vector search do not exist.
- Tool requests are symbolic/deferred only.
- No demo availability execution, document resolution, location resolution, or booking execution exists.
- No response planning, style engine, few-shot selection, generator, or verifier exists.
- The knowledge-base and booking repositories are storage primitives, not active runtime engines.
- Conversation first-message races may create duplicates because Lead/channel Conversation uniqueness is absent.
- The generated web UI remains a generic Next.js page.
- Advanced observability, queues, and production retry infrastructure are absent.

## 25. Planned Next Modules / Boundaries

The current Phase 4 scope is:

| Module | Scope status | Responsibility / boundary |
|---|---|---|
| M24 | COMPLETE | Stable student facts; do not mix with current-turn extraction or decisions. |
| M25 | NEXT | Temporary workflow context and controlled state updates. |
| M26 | PLANNED | Deterministic qualification/actions; use trusted handoff sources. |
| M27 | PLANNED | Explicit confidence handling separate from provider prose. |
| M28 | **DEFERRED** | Course Context Switching is out of current demo scope. |
| M29 | **DEFERRED** | Demo Rejection / Nurture / Stop is out of current demo scope. |

M24 is complete; the remaining rows do not authorize speculative fields, writes, or runtime behavior.

## 26. Codebase Navigation Map

```text
src/
  app/
    api/health/route.ts              deployment health boundary
    api/telegram/webhook/route.ts    Telegram HTTP boundary
  config/
    env.ts                           centralized server environment access
  core/
    input/                            normalized channel-independent input types
    lead/                             Lead identity persistence coordinator
    conversation/                     Conversation persistence coordinator
    language/                         deterministic response-language resolver
    types/                            semantic and TurnAnalysis contracts
    validation/                       Zod schemas and one-repair engine
    routing/                          deterministic source routing
    memory/                           conservative stable Lead Memory
    orchestration/                    text-turn coordination and handoff
    process/                          processMessage outer turn manager
  services/openai/
    client.ts                         shared lazy server-only OpenAI client
    prompts/                          versioned semantic/analysis/repair prompts
    semantic-normalizer.ts            M18 provider service
    turn-analysis.ts                  M20 provider service
  lib/
    db/repositories/                  server-only function repositories and row types
    supabase/server.ts                Supabase client factory
    telegram/                         normalize, delivery bridge, Bot API client
    logging/                           safe structured logger
    errors/                            small AppError utility
    request/                           request IDs

supabase/migrations/                  M11 schema and M12 seed/fix
tests/                                deterministic Node test suites
```

High-value navigation rule: start from the contract/function listed in root `AGENTS.md`; follow only the imports needed for the requested change.

## 27. Rules for Future Development

1. Current committed source overrides historical plans/reports.
2. Keep deterministic truth, business decisions, state mutation, and tool authorization outside the LLM.
3. Never use model knowledge as fee, eligibility, location, schedule, availability, or certificate truth.
4. Preserve the source hierarchy; RAG/memory must not override structured exact facts.
5. Never claim a tool/action succeeded before a real validated result exists.
6. Booking intent is not permission to create a booking.
7. Do not guess courses from technical terms or ambiguity.
8. Keep Accounting canonical and student-facing; do not introduce SAP aliases.
9. Keep current-turn Lead facts separate from stored Lead context.
10. Preserve all meaningful intents and validate structured outputs before use.
11. Keep Module 21 repair maximum at one unless an explicitly approved architecture change says otherwise.
12. Distinguish source `not_required`, `loaded`, `unresolved`, and `deferred` states.
13. Propagate required provider/repository failures; never substitute fake data or placeholder success.
14. Keep core orchestration independent of Telegram/Vercel/future channels.
15. Use existing repository/client/prompt/schema/type boundaries; do not create duplicates.
16. Do not mutate Lead, Conversation, stage outputs, route objects, or repository rows without an authorized later module.
17. Do not implement future modules opportunistically.
18. Keep secrets server-side and out of logs/reports.
19. Because RLS is absent, do not expose direct privileged database access to clients.
20. Add focused regression coverage for every authority/action boundary changed.

## 28. Architecture Maintenance

Update this document when:

- the end-to-end runtime pipeline changes;
- a module adds a major capability;
- an important contract or responsibility moves;
- database tables/relationships/security architecture change;
- source authority or source loading changes;
- a deferred system such as RAG/tool execution becomes real;
- a new external execution/channel path is added;
- the placeholder is replaced by the real response pipeline.

Do not update it for trivial refactors, formatting changes, test-only wording, or helper movement that does not affect architecture.

When updating:

1. verify current committed code first;
2. update root `AGENTS.md` only if its fast lookup map is materially affected;
3. preserve explicit current-versus-future labels;
4. avoid development-diary narrative;
5. revalidate every documented function/path and status claim.
