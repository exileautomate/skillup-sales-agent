# Module 6 — Input Normalization Architecture Audit

## Audit Scope

Read-only architecture audit of the current Module 6 implementation after the M6-V1 empty voice-file-ID correction. No source code, configuration, dependency, or test implementation was changed during this audit.

The audit assessed responsibility separation, normalized-contract quality, dependency direction, data integrity, unsupported handling, future-module compatibility, coupling, test quality, scope creep, and demo/MVP appropriateness.

## Files Inspected

- `src/core/input/types.ts`
- `src/lib/telegram/normalize-update.ts`
- `src/app/api/telegram/webhook/route.ts`
- `tests/input-normalization.test.mjs`
- `src/lib/telegram/client.ts`
- `src/config/env.ts`
- `src/lib/supabase/server.ts`
- `package.json`
- `package-lock.json`
- `tsconfig.json`
- `eslint.config.mjs`
- `next.config.ts`
- Full `src/` source inventory and import graph

## Architecture Trace

```text
Telegram webhook POST
  → validate webhook secret
  → parse JSON
  → validate minimal update envelope
  → normalizeTelegramUpdate(raw update)
  → NormalizedInboundMessage | typed unsupported result
  → acknowledge HTTP request only
```

Dependency direction is correct:

```text
Telegram webhook → Telegram normalizer → shared core input type
```

The core contract has no runtime imports. The normalizer has only a type-only import from the core contract. The webhook imports the normalizer and centralized secret configuration. There is no reverse dependency or circular dependency.

## Responsibility Separation

### Shared core contract

`src/core/input/types.ts` contains only TypeScript types. It performs no raw Telegram parsing, environment access, HTTP call, logging, persistence, or business behavior.

### Telegram normalizer

`src/lib/telegram/normalize-update.ts` owns Telegram field extraction and structural validation: update, message, sender, chat, message, date, text, and voice metadata. It maps those values into the shared contract or returns a typed unsupported result.

### Webhook boundary

`src/app/api/telegram/webhook/route.ts` remains a narrow HTTP/channel boundary. It validates the secret before body parsing, parses JSON, checks the minimal envelope, calls the normalizer, and acknowledges the result. It has no business decision or response behavior.

### Outbound adapter

`src/lib/telegram/client.ts` is separate from the normalizer and webhook intake flow. The normalizer does not import or call the outbound adapter.

Result: **responsibility separation passes**.

## Core Contract Assessment

`NormalizedInboundMessage` is a clear discriminated union with explicit text and voice variants.

- Shared fields have stable, readable names: `channel`, `channelUserId`, `chatId`, `messageId`, `updateId`, `timestamp`, and `receivedAt`.
- `messageType` is the discriminant.
- Text messages have exact `text` and null voice fields.
- Voice messages have null `text`, required `voiceFileId`, and nullable lightweight voice metadata.
- External IDs are strings, avoiding downstream numeric assumptions.
- The contract exposes no raw Telegram payload object.

The current literal `channel: "telegram"` is appropriate for the only supported channel. The remaining field names are conceptually channel-independent enough for a future WhatsApp adapter to map into the same business-facing shape by extending the channel union later. No generic multi-channel framework is prematurely introduced.

Result: **contract quality passes**.

## Data Integrity Assessment

- Text is assigned directly from `message.text`; it is not trimmed, rewritten, translated, lowercased, or semantically normalized.
- Telegram numeric IDs are accepted only as safe integers and stringified exactly.
- Source `message.date` is treated as Unix seconds and converted to ISO-8601 UTC.
- `receivedAt` is independently created from the normalization time.
- Voice metadata is copied without audio download or transcription.
- The corrected voice branch requires a non-empty string `voice.file_id`; empty and missing IDs return `unsupported-message`.
- Required fields are never guessed or filled with fallback values.

Result: **data integrity passes**.

## Failure and Unsupported Handling

The normalizer returns an explicit discriminated result:

```ts
{ status: "normalized", message: NormalizedInboundMessage }
| { status: "unsupported", reason: TelegramUnsupportedReason }
```

The typed reasons cover missing update, sender, chat, message, and date identifiers, plus unsupported update/message shapes. Ordinary Telegram shapes such as callback queries and edited messages do not throw; they become typed unsupported results.

The webhook treats ordinary unsupported payloads as successfully delivered HTTP work and responds with `200` plus `normalized:false`. This is appropriate for the demo because Telegram will not repeatedly retry known-but-unsupported update shapes. Invalid secret, malformed JSON, and invalid top-level envelopes retain clear 401/400 handling before normalizer invocation.

Result: **failure handling passes**.

## Future Module Compatibility

Module 8 can consume `NormalizedInboundMessage` without accessing raw Telegram objects for the supported text and voice paths. It receives stable identity, source-time, receipt-time, content-type, text, and voice-file metadata fields.

A future WhatsApp adapter can produce the same conceptual fields, allowing future Saleel business logic to branch on normalized message type rather than on Telegram payload structure. This does not require designing WhatsApp now.

Result: **future compatibility passes**.

## Coupling and Complexity Assessment

The small duplicate `update_id` validation in the route and normalizer is intentional and proportionate:

- The route needs an HTTP-level malformed-envelope response.
- The normalizer remains safe when used directly outside the route.

No unnecessary abstraction, dependency, service coupling, raw payload propagation, or backwards dependency was found. `src/core` does not depend on Telegram. The normalizer does not depend on config, Supabase, outbound Telegram delivery, or the webhook.

Result: **coupling and complexity pass**.

## Test Quality Assessment

The permanent Node test harness contains 11 focused tests covering:

- Valid text normalization
- Valid voice normalization
- Empty voice file ID regression
- Unsupported non-message update
- Unsupported media message
- Missing sender, chat, and message IDs
- Exact text preservation
- Update ID preservation
- Timestamp and received-time preservation

This is appropriate deterministic coverage for the current demo/MVP scope. The post-fix suite passed 11/11.

## Scope-Creep Assessment

Searches across the Module 6 core, normalizer, and webhook found no references to:

- `processMessage()`
- OpenAI or Sarvam
- Supabase
- STT, transcription, or download work
- Outbound Telegram delivery
- Persistence, insert, or upsert operations
- Language, intent, course, qualification, booking, RAG, or business-rule logic
- Console logging

Result: **no Module 7+ scope creep found**.

## Commands and Results

### Permanent normalization suite

```text
& 'C:\nvm4w\nodejs\node.exe' --experimental-default-type=module --test tests/input-normalization.test.mjs
```

```text
1..11
# tests 11
# pass 11
# fail 0
# cancelled 0
# skipped 0
# todo 0
```

### Lint

```text
& 'C:\nvm4w\nodejs\npm.cmd' run lint

> skillup-sales-agent@0.1.0 lint
> eslint
```

Result: passed with no ESLint findings.

### Production build

```text
& 'C:\nvm4w\nodejs\npm.cmd' run build
```

```text
▲ Next.js 16.3.5 (Turbopack)
✓ Compiled successfully in 486ms
✓ Running TypeScript
✓ Generating static pages using 6 workers (5/5)
└ ƒ /api/telegram/webhook
```

Result: passed. The webhook remains a dynamic server route.

## Findings by Severity

### CRITICAL

None.

### MAJOR

None.

### MINOR

None.

### OPTIONAL

Add permanent regression tests for `edited_message`, service-message-like payloads, and invalid/missing dates. These behaviors are already handled by the current normalizer and were covered by prior independent verification, so this is a coverage-hardening recommendation only. It is not required before Module 7.

## Final Verdict

**PASS**

## Completion Decision

**Module 6 may be marked COMPLETE.** It is architecturally correct, maintainable, appropriately scoped for the SkillUp demo/MVP, and safe to become a stable dependency for later modules.
