# Module 6 — Input Normalization Hard Verification Report

## Verification Scope

This was an independent, read-only verification of the current Module 6 implementation. No source file was modified, no defect was fixed, and no Module 7+ functionality was implemented.

The verification evaluated the actual source, reran the committed tests, executed additional in-memory edge probes, exercised the real local webhook over HTTP, and reran lint and the production build.

## Files Actually Inspected

- `src/core/input/types.ts`
- `src/lib/telegram/normalize-update.ts`
- `src/app/api/telegram/webhook/route.ts`
- `src/lib/telegram/client.ts`
- `src/lib/supabase/server.ts`
- `src/config/env.ts`
- `tests/input-normalization.test.mjs`
- `package.json`
- `package-lock.json`
- `tsconfig.json`
- `eslint.config.mjs`
- `next.config.ts`
- Full file inventory under `src/`

## Input → Processing → Output Trace

### Valid Telegram text update

1. `src/app/api/telegram/webhook/route.ts` reads `X-Telegram-Bot-Api-Secret-Token` and compares it with the centralized `getTelegramWebhookSecret()` value.
2. Only after authentication succeeds, the route calls `request.json()`.
3. The route checks that the parsed payload is an object with a safe-integer `update_id`.
4. The route calls `normalizeTelegramUpdate(update)`.
5. `src/lib/telegram/normalize-update.ts` validates the update ID, regular `message` shape, sender ID, chat ID, message ID, and message date.
6. When `message.text` is a string, the normalizer returns `status: "normalized"` and a `NormalizedTextInboundMessage` from the contract in `src/core/input/types.ts`.
7. The webhook returns HTTP `200` with `{"ok":true,"normalized":true}`. It does not pass the message to business logic.

Verified normalized fields:

| Field | Verified behavior |
| --- | --- |
| `channel` | Literal `"telegram"` |
| `channelUserId` | Telegram `message.from.id`, intentionally converted to a string |
| `chatId` | Telegram `message.chat.id`, intentionally converted to a string |
| `messageId` | Telegram `message.message_id`, intentionally converted to a string |
| `updateId` | Telegram `update_id`, intentionally converted to a string |
| `messageType` | Literal `"text"` |
| `text` | Direct, exact copy of `message.text` |
| `timestamp` | Telegram Unix seconds converted to ISO-8601 UTC |
| `receivedAt` | Independently generated ISO-8601 normalization time |

### Valid Telegram voice update

The same authentication, parsing, envelope, and required-ID checks occur. When the message contains a voice object with a string `file_id`, the normalizer returns:

- `messageType: "voice"`
- `text: null`
- `voiceFileId` copied from `voice.file_id`
- `voiceFileUniqueId` copied when it is a string, otherwise `null`
- `voiceDurationSeconds` copied only when it is a non-negative safe integer, otherwise `null`
- Preserved sender, chat, message, update, timestamp, and receipt-time fields

The committed voice test passed with all metadata present. Independent probes also verified that omitted optional metadata becomes `null` and invalid optional metadata becomes `null` rather than causing a crash.

There is no fetch/download operation, transcript field, STT invocation, or Sarvam call in the core contract or normalizer.

## Text Verification

The implementation assigns `message.text` directly. It does not call `trim()`, change case, rewrite punctuation, normalize Unicode, infer language, or otherwise modify semantic content.

The committed harness passed a whitespace/newline preservation test. An independent probe used this exact mixed-language text:

```text
  Hello, SALEEL!
എനിക്ക് SkillUp course വേണം?  
```

The normalized output was byte-for-byte equal as a JavaScript string, including leading spaces, trailing spaces, newline, punctuation, mixed casing, Malayalam, and Manglish/English content.

Result: **verified**.

## Voice Verification

Verified behaviors:

- A valid voice update produces `messageType: "voice"`.
- `text` is explicitly `null`.
- A valid `file_id` is copied into `voiceFileId`.
- A present string `file_unique_id` is copied.
- Missing or non-string `file_unique_id` becomes `null`.
- A present non-negative integer duration is copied.
- Missing, negative, fractional, or non-number duration becomes `null`.
- Missing `file_id` produces `unsupported-message`.
- No audio download, STT, transcript, provider call, or outbound response occurs.

One malformed edge case is recorded under Findings: an empty-string `file_id` is currently accepted because the implementation checks only its TypeScript runtime type, not non-emptiness.

## Unsupported-Input Verification

The following cases were executed directly against `normalizeTelegramUpdate()` and returned typed unsupported results without throwing or inventing values:

| Input | Result |
| --- | --- |
| `callback_query` | `unsupported-update` |
| `edited_message` | `unsupported-update` |
| Photo-only message | `unsupported-message` |
| Service-message-like shape | `unsupported-message` |
| Missing sender ID | `missing-sender-id` |
| Missing chat ID | `missing-chat-id` |
| Missing message ID | `missing-message-id` |
| Missing date | `missing-message-date` |
| Negative date | `missing-message-date` |
| Fractional date | `missing-message-date` |
| String date | `missing-message-date` |
| Out-of-range date producing an invalid JavaScript date | `missing-message-date` |
| Missing update ID | `missing-update-id` |
| Fractional update ID | `missing-update-id` |
| String update ID | `missing-update-id` |
| Unsafe numeric update ID | `missing-update-id` |
| Missing voice file ID | `unsupported-message` |
| Primitive, null, undefined, and array payloads | `missing-update-id` |

The webhook additionally acknowledged ordinary callback and edited-message updates with HTTP `200` and `normalized:false`, preventing retry loops.

## Identifier Verification

`readTelegramId()` accepts only safe-integer JavaScript numbers and converts them with `String(value)`. The normalized contract declares all four external identifiers as strings, so downstream consumers are not expected to coerce them numerically.

An independent probe used `Number.MAX_SAFE_INTEGER` (`9007199254740991`) for the update, message, and user IDs and its negative value for the chat ID. All were preserved exactly as strings:

```text
updateId      = "9007199254740991"
messageId     = "9007199254740991"
channelUserId = "9007199254740991"
chatId        = "-9007199254740991"
```

Unsafe integers, fractional values, and string-shaped raw IDs are not silently coerced into valid normalized IDs.

Result: **verified**.

## Timestamp Verification

`readTelegramTimestamp()` treats Telegram `message.date` as Unix seconds, validates it as a non-negative safe integer, multiplies by 1,000, constructs a `Date`, checks for an invalid date, and returns ISO-8601 UTC.

Verified conversion:

```text
Telegram date: 1710000000
timestamp:     2024-03-09T16:00:00.000Z
```

An independently injected receipt time remained distinct:

```text
receivedAt: 2026-09-18T12:34:56.789Z
```

Negative, fractional, string, and out-of-range dates returned `missing-message-date`; they did not create misleading timestamps.

Result: **verified**.

## Webhook Integration Verification

Static execution order in `src/app/api/telegram/webhook/route.ts`:

1. Secret comparison (`getTelegramWebhookSecret()`)
2. JSON parsing (`request.json()`)
3. Minimal update-envelope validation
4. `normalizeTelegramUpdate(update)`
5. HTTP acknowledgement

The following real HTTP cases were executed against the local Next.js route:

```text
CASE=normalized-text STATUS=200 BODY={"ok":true,"normalized":true}
CASE=normalized-voice STATUS=200 BODY={"ok":true,"normalized":true}
CASE=callback-unsupported STATUS=200 BODY={"ok":true,"normalized":false}
CASE=edited-message-unsupported STATUS=200 BODY={"ok":true,"normalized":false}
CASE=malformed-json STATUS=400 BODY={"ok":false,"error":"Malformed JSON body"}
CASE=invalid-secret-before-malformed-json STATUS=401 BODY={"ok":false,"error":"Unauthorized"}
CASE=missing-secret STATUS=401 BODY={"ok":false,"error":"Unauthorized"}
CASE=invalid-envelope STATUS=400 BODY={"ok":false,"error":"Invalid Telegram update payload"}
```

The invalid-secret plus malformed-body case proves authentication occurs before JSON parsing or normalization. Source inspection found no `processMessage()` call and no outbound Telegram send from the route.

Result: **verified**.

## Architecture-Boundary Verification

Repository searches showed:

- `src/core/input/types.ts` contains types only: no runtime imports, environment access, network call, logging, database call, or business logic.
- Raw inbound Telegram parsing (`update_id`, `message_id`, `from`, `chat`, `voice.file_id`) is contained in `src/lib/telegram/normalize-update.ts`, with only the minimal `update_id` envelope check remaining in the Telegram-specific webhook route.
- The separate outbound adapter contains Telegram response parsing, as expected, but the normalizer does not import or call it.
- The normalizer's only import is a type-only import of `NormalizedInboundMessage`.
- The webhook imports only centralized secret configuration and the Telegram normalizer.
- No Module 6 file imports OpenAI, Sarvam, Supabase, or a business/core-processing module.
- No Module 6 file performs fetch, download, persistence, insert, upsert, response generation, language detection, intent/course/qualification logic, transcription, or outbound Telegram sending.
- No `processMessage()` implementation or call exists.

Result: **verified; no architecture leak found**.

## Tests and Commands Executed

### Existing Module 6 test harness

```text
& 'C:\nvm4w\nodejs\node.exe' --experimental-default-type=module --test tests/input-normalization.test.mjs
```

Exact summary:

```text
1..10
# tests 10
# suites 0
# pass 10
# fail 0
# cancelled 0
# skipped 0
# todo 0
```

### Additional in-memory edge probe

The probe was passed to Node over standard input and created no file. It covered 18 independently asserted cases.

Exact summary:

```text
SUMMARY passed=18 failed=0
```

### Adversarial empty voice-file-ID probe

The probe was passed to Node over standard input and created no file. It confirmed:

```json
{"status":"normalized","message":{"messageType":"voice","text":null,"voiceFileId":""}}
```

The displayed fragment omits unrelated already-verified fields for clarity; the actual probe returned the full normalized message.

### Lint

```text
& 'C:\nvm4w\nodejs\npm.cmd' run lint

> skillup-sales-agent@0.1.0 lint
> eslint
```

Result: passed with exit code 0 and no findings.

### Production build

```text
& 'C:\nvm4w\nodejs\npm.cmd' run build

> skillup-sales-agent@0.1.0 build
> next build

▲ Next.js 16.3.5 (Turbopack)
- Environments: .env.local
✓ Compiled successfully in 499ms
✓ Running TypeScript
✓ Generating static pages using 6 workers (5/5)

Route (app)
┌ ○ /
├ ○ /_not-found
└ ƒ /api/telegram/webhook
```

Result: passed with exit code 0. The webhook remains a dynamic server route.

## Findings by Severity

### CRITICAL

None.

### MAJOR

None.

### MINOR

#### M6-V1 — Empty Telegram voice `file_id` is accepted as normalized

Location: `src/lib/telegram/normalize-update.ts`

The voice branch checks `typeof message.voice.file_id === "string"` but does not require a non-empty string. A malformed payload with `file_id: ""` therefore returns `status: "normalized"` and an unusable empty `voiceFileId`.

Impact: downstream voice handling could receive a value that cannot identify or retrieve a Telegram file. Official compliant Telegram voice updates provide a real file ID, so this does not affect the verified normal Telegram path, but it weakens malformed-input handling at the normalization boundary.

No fix was made because this task was verification-only.

### OPTIONAL

- Add committed regression cases for edited messages, service-message shapes, invalid dates, maximum safe integer IDs, and empty voice file IDs. These behaviors were covered by temporary independent probes in this verification, but most are not represented in the current committed 10-test harness.

## Final Verdict

**PASS WITH MINOR FIXES**

The core contract, normal text and voice normalization, exact content preservation, ID and timestamp behavior, unsupported-update handling, webhook integration, and architecture boundaries all passed. The only defect found is the narrow empty-string voice file ID validation gap described as M6-V1.

## Architecture Audit Readiness

**Yes, with M6-V1 explicitly tracked.** Module 6 is ready for architecture-boundary audit because no layering or scope violation was found. For a clean functional sign-off, M6-V1 should be corrected and covered by a permanent regression test in a separate authorized change task.
