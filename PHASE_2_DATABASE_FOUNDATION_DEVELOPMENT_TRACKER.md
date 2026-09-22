# SkillUp — Phase 2 Database Foundation Development Tracker

## Phase Status

✅ Module 11 — Core Database Schema — COMPLETE  
✅ Module 12 — Course & Branch Seed Data — COMPLETE  
✅ Module 13 — Database Repository Layer — COMPLETE  
✅ Module 14 — Lead Persistence — COMPLETE  
✅ Module 15 — Conversation Persistence — COMPLETE  
❌ Module 16 — Message Persistence — INTENTIONALLY SKIPPED  
❌ Module 17 — Database Security / RLS Baseline — INTENTIONALLY SKIPPED

**Phase 2 final status: COMPLETE FOR APPROVED DEMO SCOPE**

## Phase 2 Goal

Phase 2 created the persistent database foundation for SkillUp: structured business data, stable leads, persistent conversations, a server-only repository boundary, and storage foundations for future booking and RAG work.

Message persistence and RLS were intentionally excluded from the reduced demo scope. Their absence is an approved scope decision, not unfinished Phase 2 implementation.

## Final Runtime Foundation

```text
Telegram webhook
↓
input normalization
↓
processMessage()
↓
identify/get-or-create stable lead
↓
load/get-or-create conversation
↓
existing response processing
```

Module 14 answers: **“Who is this user?”**  
Module 15 answers: **“Which persistent conversation is this user currently using?”**

Later modules answer what a message means, what the sales agent should do, and what state should be updated.

## Final Database Foundation

The seven application tables are:

- `courses` — approved course catalog facts, fees, eligibility, schedules, certificate and capability facts.
- `branches` — branch names, approved facilities, hostel facts, and nullable operational details.
- `course_branches` — active course/branch availability mappings with duplicate protection.
- `leads` — stable channel identity plus nullable student and preference memory.
- `conversations` — lead/channel conversation records and the future workflow-state fields.
- `demo_bookings` — future booking records tied to a lead, conversation, course, and branch.
- `knowledge_base` — future structured, source-attributed RAG content and optional embeddings.

There is no `messages` table: Module 16 is intentionally skipped. RLS is also intentionally deferred to Module 17. Database access remains server-side through the server-only Supabase client and repository layer; the public tables must not be treated as safe for direct browser access.

## Locked Database States

The final database enums are:

- `lead_status`: `NEW`, `QUALIFYING`, `QUALIFIED`, `NURTURE`, `UNQUALIFIED`
- `sales_stage`: `NEW`, `DISCOVERY`, `COURSE_EDUCATION`, `QUALIFICATION`, `OBJECTION`, `DEMO_READY`, `BOOKING`, `BOOKED`, `NURTURE`, `STOPPED`
- `qualification_status`: `UNKNOWN`, `PENDING`, `QUALIFIED`, `UNQUALIFIED`
- `demo_push_status`: `NORMAL`, `NURTURE`, `STOP_DEMO_PUSH`, `STOP_ALL_SALES_PUSH`
- `booking_status`: `PENDING`, `CONFIRMED`, `CANCELLED`, `FAILED`
- `knowledge_class`: `business_locked`, `demo_explanatory`, `tbd`

Generic conversation `status` remains unconstrained text. No invented `ACTIVE` or `CLOSED` values were introduced.

## Database Migrations

The final repository contains exactly these application migrations:

1. `20260921014509_module_11_core_database_schema.sql` — Module 11 schema, enums, relations, constraints, indexes, timestamps, and nullable model-agnostic vector storage.
2. `20260921085437_module_12_course_branch_seed_data.sql` — approved courses, branches, and active course/branch mappings.
3. `20260921092041_module_12_data_analytics_certificate_fix.sql` — the approved Data Analytics certificate correction only.

Module 11 initially had local filename version `20260921000000` while live migration history recorded `20260921014509`. The mismatch was corrected by renaming the repository migration without changing SQL or replaying the migration. Repository and live migration history now agree. Do not replay the schema migration unnecessarily.

## Module 11 — Core Database Schema

### Purpose

Create the minimum relational foundation without seed data, runtime persistence, sales logic, RAG retrieval, authentication, or security-policy work.

### Implemented

The migration creates the seven application tables, locked enums, UUID keys, foreign keys, relevant uniqueness/check constraints, timestamps, `set_updated_at()` triggers, and lookup indexes. `course_branches` protects unique mappings; leads are uniquely identified by `(channel, channel_user_id)`; nullable catalog references use `ON DELETE SET NULL`; workflow and booking references remain relationally required.

The `vector` extension is enabled in Supabase’s `extensions` schema and `knowledge_base.embedding` is nullable and dimensionless. No embedding model, dimension, vector index, embeddings, or retrieval behavior was invented.

The `messages` table is absent because Module 16 is skipped. RLS is absent because Module 17 is skipped. These are intentional reduced-demo decisions.

### Outcome and history

The schema audit passed with no required finding. The verified commit is:

`bdfd8901e1da06e1a9eab9e47db13ee2fcd34561` — `feat(db): add SkillUp core database schema`

## Module 12 — Course & Branch Seed Data

### Approved permanent facts

Courses are exactly:

- **Data Analytics** — 9 months (7 learning, 2 internship), base fee 38,000, 18% GST, 44,840 including GST, 2,000 admission, 46,840 total; degree required under the current rule; no prior programming/Python requirement; 180-minute classes; batch rule “2nd of every month”; placement, laptop, and demo available; certificate corrected to `SkillUp course-completion / BIDA certificate`.
- **Digital Marketing** — 8 months (6 learning, 2 internship), base fee 60,000, 18% GST, 70,800 including GST, 2,000 admission, 72,800 total; Plus Two/12th accepted; no prior Digital Marketing/coding/advanced technical requirement; 180-minute classes; batch rule “5th of every month”; placement, laptop, and demo available; certificate remains `NULL`.
- **Accounting** — 10 months (7 learning, 3 internship), base fee 40,000, GST percentage `NULL`, 47,200 including GST, 3,000 admission, 50,200 total; approved commerce/finance backgrounds; 300-minute classes; demo snapshot “next known batch 10 October 2026”; placement and laptop available; demo unavailable; approved course-completion certificate.

Accounting’s student-facing name is exactly **Accounting**. SAP/SAP FICO is not exposed as a student-facing course name. Unknown facts remain `NULL` rather than being inferred, including Accounting GST percentage, unsupported certificate wording, and unspecified facilities.

Branches are exactly **Calicut, Mankave, Kochi, and Kannur**. Addresses and Google Maps URLs remain `NULL`; Wi-Fi and parking are approved as true; unspecified computer lab, AC classroom, room types, and other facilities remain `NULL`. Approved hostel facts are stored consistently: boys’ hostel available, 10,000 fee, approximately 500 metres; girls’ hostel available, 10,000 fee, approximately 200 metres; both food fields state that food is available and approximately 10,000 extra per month.

Mappings are exactly:

- Data Analytics → Calicut, Mankave, Kochi, Kannur
- Digital Marketing → Calicut, Mankave
- Accounting → Calicut, Mankave, Kochi

The Module 12 audit passed. The verified commit is:

`c6781c66d5ccc166a1ec386013f5ca9be4c40b24` — `feat(db): seed SkillUp course and branch data`

## Module 13 — Database Repository Layer

The repository layer is a small server-only set of function-based modules under `src/lib/db/repositories/`, not an ORM or business service framework. `client.ts` centralizes server client acquisition and database-error helpers; `types.ts` contains schema-aligned types; repository modules cover courses, branches, leads, conversations, demo bookings, and the knowledge base.

The common behavior is:

- keyed absence → `null`
- empty lists → `[]`
- genuine query failures → throw an operation-context error
- create/update → select and return the affected row
- no business logic, state transitions, browser access, or raw client creation in application logic

The existing direct Node TypeScript test harness requires explicit `.ts` repository-internal imports; `allowImportingTsExtensions` is valid with `noEmit` and does not add runtime behavior. No messages repository exists.

The Module 13 audit passed. The verified commit is:

`72a19cbfee8650e571c656bad418a6934252b4d3` — `feat(db): add database repository layer`

## Module 14 — Lead Persistence

The permanent stable lead identity rule is:

```text
stable lead identity = channel + channel_user_id
```

An existing identity returns the same row untouched. A new identity creates only `channel` and `channel_user_id`; the database supplies `lead_status = NEW`, while unknown lead-memory fields remain `NULL`/default. An inbound message never overwrites existing lead memory merely because it arrived.

The database unique constraint is the final duplicate authority. On the exact channel-identity conflict, the service performs one targeted reread and returns the competing row when present. There is no generic retry framework.

Runtime placement is normalized inbound → lead persistence → later processing. Module 14 does not perform TurnAnalysis, qualification extraction/decisions, course or branch detection, language resolution, Lead Memory business logic, or sales logic.

The Module 14 audit passed. The verified commit is:

`f27f3b6e2e855a624cd58dd666c993a27a82097e` — `feat(db): add stable lead persistence`

## Module 15 — Conversation Persistence

The permanent controlled-demo policy is:

```text
same lead_id + same channel → reuse newest existing conversation
no matching conversation → create one
```

Newest selection is deterministic: `created_at DESC`, then `id DESC`. A new conversation explicitly inserts only `lead_id` and `channel`. Database defaults provide `current_sales_stage = NEW`, `qualification_status = UNKNOWN`, `demo_push_status = NORMAL`, and `demo_rejection_count = 0`; other unknown state fields remain `NULL`/default.

An existing conversation row is returned unchanged. Module 15 does not reset status, course, stage, qualification, confidence, demo, pending-question, or booking-progress fields. Runtime order is lead persistence → conversation persistence → existing response processing. Lookup/create failures propagate honestly, and the production webhook uses real persistence defaults.

The schema deliberately has no one-conversation-per-lead/channel uniqueness constraint. Concurrent first messages can therefore duplicate conversations; this is accepted for the controlled demo. No lock, transaction-only deduplication, mutex, retry framework, cleanup, or uniqueness migration was added.

Module 15 does not implement course decisions, sales-stage or qualification decisions, demo decisions, confidence, pending questions, booking progression, Conversation State logic, reset/lifecycle policy, TurnAnalysis, Lead Memory, or sales logic.

The Module 15 audit passed. The verified commit is:

`13500da916ded5842a7a440fe4686e5405cbdf1e` — `feat(db): add conversation persistence`

## Module 16 — Message Persistence — Skipped

**INTENTIONALLY SKIPPED FOR REDUCED DEMO SCOPE.**

There is no `messages` table, no inbound/outbound message persistence, and no raw transcript/message-history database layer from Module 16. This is an approved deferral, not forgotten work.

## Module 17 — Database Security / RLS Baseline — Skipped

**INTENTIONALLY SKIPPED FOR REDUCED DEMO SCOPE.**

No RLS baseline was added. The current requirement is server-side database access only; no browser privileged Supabase access is allowed. The project must not be described as having production-grade database security yet. This is an approved demo-scope deferral.

## Responsibility Boundaries After Phase 2

- Module 14: stable lead identity.
- Module 15: stable conversation persistence.
- Module 19 later: language resolution.
- Module 20 later: TurnAnalysis, message understanding, and explicit fact extraction.
- Module 24 later: Lead Memory.
- Module 25 later: Conversation State.
- Module 26 later: Business / Sales Logic.

These boundaries keep intelligence and business decisions out of persistence layers.

## Final Phase 2 Source-of-Truth Flow

```text
Live Tool Result
>
Structured Database
>
Approved RAG
>
Conversation Memory
```

The LLM is never the business source of truth. Phase 2 primarily established the Structured Database part of this architecture.

## Testing & Verification Summary

The final Module 15 baseline was independently verified as:

- complete automated suite: **52 passed, 0 failed, 0 skipped**
- TypeScript: `npx tsc --noEmit` passed
- production build: `npm run build` passed

Earlier module milestones also passed their reported suites: Module 11 baseline 23 tests, Module 13 baseline 31 tests, and Module 14 baseline 40 tests, all with zero failures/skips at their checkpoints. Direct Node runs emitted only the existing non-failing `MODULE_TYPELESS_PACKAGE_JSON` warning.

Controlled synthetic lead/conversation verification was performed during Modules 14/15 using synthetic identities only, then cleaned up. Final live counts returned to their original values: leads and conversations were zero; Module 12’s live seed state remained 3 courses, 4 branches, and 9 mappings. No synthetic IDs are retained here.

## Final Repository History

| Module | Commit SHA | Commit message | Status |
|---|---|---|---|
| 11 | `bdfd8901e1da06e1a9eab9e47db13ee2fcd34561` | `feat(db): add SkillUp core database schema` | COMPLETE |
| 12 | `c6781c66d5ccc166a1ec386013f5ca9be4c40b24` | `feat(db): seed SkillUp course and branch data` | COMPLETE |
| 13 | `72a19cbfee8650e571c656bad418a6934252b4d3` | `feat(db): add database repository layer` | COMPLETE |
| 14 | `f27f3b6e2e855a624cd58dd666c993a27a82097e` | `feat(db): add stable lead persistence` | COMPLETE |
| 15 | `13500da916ded5842a7a440fe4686e5405cbdf1e` | `feat(db): add conversation persistence` | COMPLETE |

## Phase 2 Final Architecture Decisions

- Stable lead identity is `channel + channel_user_id`.
- Conversation selection is `lead_id + channel`.
- The newest conversation wins for the current demo, ordered by `created_at DESC, id DESC`.
- No generic `ACTIVE`/`CLOSED` conversation status was invented.
- There is no `messages` table yet and no RLS yet.
- There is no one-conversation uniqueness constraint; concurrent first-message duplication is a known demo limitation.
- Unknown facts remain `NULL` rather than being invented.
- Deterministic business truth stays in code/database; the LLM does not own business truth.
- Database access stays behind the server-only repository boundary.
- No n8n, OpenAI, Sarvam, WhatsApp, or later intelligence integration was added.

## Known Demo Limitations

- Message persistence is deferred.
- RLS is deferred; only server-side database access is permitted in the current demo.
- Concurrent first-message conversation duplication is theoretically possible because no lead/channel uniqueness constraint exists.
- No conversation lifecycle/reset policy exists yet.
- Intelligence, state, memory, and sales engines belong to later approved modules.

These are accepted scope limitations, not immediate defects for the approved demo.

## Phase 2 Completion Statement

**PHASE 2 — DATABASE FOUNDATION**  
**COMPLETE FOR APPROVED SKILLUP DEMO SCOPE**

Development may proceed to the next approved phase only after this consolidation is complete. Phase 3 is not started by this tracker.
