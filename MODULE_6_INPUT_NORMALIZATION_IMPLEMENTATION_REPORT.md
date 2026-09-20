# Module 6 — Input Normalization Implementation Report

## Module Objective

Create a channel-independent inbound-message contract and a Telegram-specific normalizer that converts supported Telegram text and voice updates into that stable internal shape. Unsupported updates must return an explicit safe result without crashing, while all interpretation, response generation, persistence, transcription, and later-module behavior remain out of scope.

## Repository State Before Implementation

The repository contained completed environment/config, Supabase client, outbound Telegram adapter, and Telegram webhook modules. The webhook authenticated requests, parsed JSON, checked for an integer `update_id`, and acknowledged accepted payloads, but it did not normalize Telegram messages.

There was no `src/core/` directory, normalized inbound-message contract, Telegram update normalizer, `processMessage()` implementation, or existing test framework. The working tree already contained uncommitted artifacts from Modules 2–5; they were preserved.

## Files Inspected

- `AGENTS.md`
- `src/config/env.ts`
- `src/lib/telegram/client.ts`
- `src/lib/supabase/server.ts`
- `src/app/api/telegram/webhook/route.ts`
- Existing source files under `src/app/`
- `package.json`
- `package-lock.json`
- `tsconfig.json`
- `eslint.config.mjs`
- `next.config.ts`
- Existing Module 2–5 implementation reports
- Installed Next.js 16 Route Handler documentation

## Files Created

- `src/core/input/types.ts`
- `src/lib/telegram/normalize-update.ts`
- `tests/input-normalization.test.mjs`
- `MODULE_6_INPUT_NORMALIZATION_IMPLEMENTATION_REPORT.md`

## Files Modified

- `src/app/api/telegram/webhook/route.ts`

No environment, dependency, Supabase, outbound Telegram, or UI file was modified for Module 6.

## Dependencies Added or Changed

None. The focused test harness uses Node.js 22's built-in `node:test` and `node:assert/strict` modules. No test framework, Telegram package, validation package, or other dependency was installed.

`package.json` and `package-lock.json` were not modified by Module 6.

## Final Normalized Inbound-Message TypeScript Contract

The shared contract is defined in `src/core/input/types.ts` as a discriminated union:

```ts
type NormalizedInboundMessageBase = {
  channel: "telegram";
  channelUserId: string;
  chatId: string;
  messageId: string;
  updateId: string;
  timestamp: string;
  receivedAt: string;
};

type NormalizedTextInboundMessage = NormalizedInboundMessageBase & {
  messageType: "text";
  text: string;
  voiceFileId: null;
  voiceFileUniqueId: null;
  voiceDurationSeconds: null;
};

type NormalizedVoiceInboundMessage = NormalizedInboundMessageBase & {
  messageType: "voice";
  text: null;
  voiceFileId: string;
  voiceFileUniqueId: string | null;
  voiceDurationSeconds: number | null;
};

type NormalizedInboundMessage =
  | NormalizedTextInboundMessage
  | NormalizedVoiceInboundMessage;
```

IDs are represented as strings so downstream core code does not depend on Telegram's numeric identifier representation. The discriminated union prevents text/voice confusion: text messages always have text and null voice fields; voice messages always have a voice file ID and null text.

## Telegram Text Normalization Behavior

`normalizeTelegramUpdate()` in `src/lib/telegram/normalize-update.ts` reads the Telegram update, message, sender, chat, message ID, and source timestamp. For a message whose `text` property is a string, it returns:

```ts
{
  status: "normalized",
  message: NormalizedTextInboundMessage
}
```

The text value is copied exactly. It is not trimmed, lowercased, rewritten, interpreted, or otherwise semantically changed. A focused test preserves leading spaces, trailing spaces, punctuation, and a newline exactly.

## Telegram Voice Normalization Behavior

For a message containing a Telegram `voice` object with a string `file_id`, the normalizer returns a `NormalizedVoiceInboundMessage` containing:

- `messageType: "voice"`
- `text: null`
- `voiceFileId`
- `voiceFileUniqueId` when supplied, otherwise `null`
- Non-negative integer `voiceDurationSeconds` when supplied, otherwise `null`
- The same sender, chat, message, update, timestamp, and received-at fields used by text messages

The normalizer does not download audio, inspect audio bytes, call STT, create a transcript, or call Sarvam.

## Unsupported-Update Behavior

The Telegram-specific result is another discriminated union:

```ts
type TelegramNormalizationResult =
  | { status: "normalized"; message: NormalizedInboundMessage }
  | { status: "unsupported"; reason: TelegramUnsupportedReason };
```

Ordinary unsupported shapes return `status: "unsupported"`; they do not throw. Typed reasons cover:

- `missing-update-id`
- `unsupported-update`
- `missing-sender-id`
- `missing-chat-id`
- `missing-message-id`
- `missing-message-date`
- `unsupported-message`

`callback_query`, `edited_message`, and other updates without a regular `message` return `unsupported-update`. Messages with unsupported media or service-message fields but no text or supported voice return `unsupported-message`.

## Missing-Field Behavior

The normalizer requires safe-integer Telegram update, sender, chat, and message identifiers, plus a valid non-negative integer Telegram message date. Missing or invalid required fields return the corresponding typed unsupported reason.

No ID, timestamp, content, transcript, or fallback value is invented. Focused tests cover missing sender ID, chat ID, and message ID.

## Timestamp Handling

Telegram's `message.date` Unix timestamp in seconds is multiplied by 1,000 and converted to an ISO-8601 UTC string. Invalid, negative, or non-integer source timestamps produce the typed `missing-message-date` unsupported result.

`receivedAt` records when normalization occurs and is also stored as an ISO-8601 UTC string. The normalizer accepts an optional `Date` argument so tests can provide a deterministic receipt time; production callers use the current time by default.

The timestamp test verified that Telegram value `1710000000` becomes `2024-03-09T16:00:00.000Z` and that the injected receipt time is preserved independently.

## Exact Webhook Integration Behavior

After Module 5's secret validation, JSON parsing, and minimal `update_id` envelope validation, `src/app/api/telegram/webhook/route.ts` now calls:

```ts
const normalization = normalizeTelegramUpdate(update);
```

It acknowledges both outcomes with HTTP `200`:

- Supported text/voice: `{"ok":true,"normalized":true}`
- Unsupported update/message: `{"ok":true,"normalized":false}`

This prevents Telegram from repeatedly retrying ordinary unsupported updates. The route does not pass the message to core business logic, persist it, call `processMessage()`, or send an outbound reply.

Module 5's authentication and malformed-envelope behavior remains unchanged.

## STT Confirmation

No speech-to-text operation occurred. No audio was downloaded, no voice file was fetched, no transcript field was introduced, and neither Sarvam nor any other STT provider was called.

## External Service and Business-Logic Confirmation

Module 6 added no OpenAI, Sarvam, Supabase, database, intent detection, course detection, qualification, booking, RAG, response generation, persistence, or outbound Telegram behavior. The normalizer is deterministic and depends only on its input update and receipt time.

## Tests Executed

### Deterministic normalization harness

Command:

```text
& 'C:\nvm4w\nodejs\node.exe' --experimental-default-type=module --test tests/input-normalization.test.mjs
```

Covered cases:

1. Valid text message
2. Valid voice message
3. Unsupported non-message callback update
4. Message with unsupported photo media
5. Missing sender ID
6. Missing chat ID
7. Missing message ID
8. Exact text preservation
9. Update ID preservation
10. Source timestamp and receipt-time preservation

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

### Webhook integration checks

The running local Next.js application received two real POST requests using the configured secret without printing it:

```text
CASE=webhook-normalized-text STATUS=200 BODY={"ok":true,"normalized":true}
CASE=webhook-unsupported-update STATUS=200 BODY={"ok":true,"normalized":false}
```

These checks prove the webhook calls the normalizer and that an unsupported update does not crash or trigger retries.

## Exact Lint Result

Command:

```text
& 'C:\nvm4w\nodejs\npm.cmd' run lint
```

Output:

```text
> skillup-sales-agent@0.1.0 lint
> eslint
```

Result: passed with exit code 0 and no ESLint findings.

## Exact Build Result

Command:

```text
& 'C:\nvm4w\nodejs\npm.cmd' run build
```

Relevant output:

```text
> skillup-sales-agent@0.1.0 build
> next build

▲ Next.js 16.3.5 (Turbopack)
- Environments: .env.local
✓ Compiled successfully in 701ms
✓ Running TypeScript
✓ Generating static pages using 6 workers (5/5)

Route (app)
┌ ○ /
├ ○ /_not-found
└ ƒ /api/telegram/webhook
```

Result: passed with exit code 0. The webhook remains a dynamic server route.

## CORE Boundary Review

- Telegram raw-field parsing is confined to `src/lib/telegram/normalize-update.ts`.
- The core contract in `src/core/input/types.ts` contains types only and no Telegram parsing, network access, persistence, or business logic.
- Exact text is assigned directly from `message.text`; no trim or rewrite operation is applied.
- Sender, chat, message, and update IDs are all required and preserved as strings.
- Telegram source time and normalization receipt time are distinct ISO-8601 fields.
- Text and voice variants are mutually explicit through `messageType` and null counterpart fields.
- Unsupported inputs return typed results rather than crashing.
- No dependency on `processMessage()` or any future module exists.
- The implementation introduces only one core contract, one Telegram normalizer, a small route handoff, and a lightweight test harness.

## Warnings or Unresolved Issues

- An attempted second development server detected an already-running project server on port 3000 and exited. The existing local server was reused successfully for the two integration checks and was no longer running when cleanup was checked.
- Git continued to emit the pre-existing warning that the user-global ignore file at `C:\Users\Ishan Elite/.config/git/ignore` was inaccessible. This did not affect implementation or verification.
- `git diff --check` continued to show pre-existing line-ending normalization notices for `package.json` and `package-lock.json`; no Module 6 whitespace error was reported.

No Module 6 implementation issue remains unresolved.

## Module 7+ Scope Confirmation

No Module 7 or later functionality was implemented. In particular, there is no language detection, transcription, `processMessage()` skeleton, business orchestration, AI provider call, persistence, reply generation, or outbound message send from the webhook.

## Module 6 Completion Evidence

| Requirement | Concrete repository evidence |
| --- | --- |
| Shared normalized type | `src/core/input/types.ts` defines and exports the `NormalizedInboundMessage` discriminated union. |
| Telegram-specific parsing is separate | `src/lib/telegram/normalize-update.ts` alone reads raw Telegram fields such as `update_id`, `message_id`, `from`, `chat`, and `voice.file_id`. |
| Required common fields | `src/core/input/types.ts` requires `channel`, `channelUserId`, `chatId`, `messageId`, `updateId`, `messageType`, `text`, `voiceFileId`, `timestamp`, and `receivedAt`. |
| Channel-independent identifiers | The normalized contract stores all external IDs as strings rather than exposing Telegram numeric assumptions downstream. |
| Text/voice distinction | `src/core/input/types.ts` uses `messageType: "text" | "voice"` as a discriminant with mutually explicit text and voice fields. |
| Text normalization | `src/lib/telegram/normalize-update.ts` copies `message.text` directly; test 1 verifies a valid text result. |
| Exact text preservation | Test 8 in `tests/input-normalization.test.mjs` verifies whitespace, newline, punctuation, and casing are unchanged. |
| Voice normalization | `src/lib/telegram/normalize-update.ts` preserves `file_id`, optional `file_unique_id`, and optional duration; test 2 verifies the voice result and null transcript/text. |
| ID preservation | The normalizer requires and converts Telegram sender, chat, message, and update IDs; tests 1 and 9 verify their output. |
| Timestamp preservation | `readTelegramTimestamp()` converts Telegram seconds to ISO UTC; test 10 verifies both `timestamp` and `receivedAt`. |
| Unsupported non-message update | The normalizer returns `unsupported-update`; test 3 verifies a callback-query update. |
| Unsupported media | The normalizer returns `unsupported-message`; test 4 verifies a photo-only message. |
| Missing sender/chat/message IDs | Tests 5–7 verify explicit `missing-sender-id`, `missing-chat-id`, and `missing-message-id` results. |
| No unsupported-input crash | All unsupported cases return typed union values; the 10-test harness completed with zero failures. |
| Webhook calls normalizer | `src/app/api/telegram/webhook/route.ts` imports and calls `normalizeTelegramUpdate`; the text integration request returned `normalized:true`. |
| Unsupported webhook acknowledgement | The callback integration request returned HTTP 200 with `normalized:false`. |
| No content logging | The source audit found no logging statements under `src`; the route returns only normalization status, never message content. |
| No STT/audio work | `src/lib/telegram/normalize-update.ts` only copies voice metadata and contains no fetch, download, transcription, or provider call. |
| No external service/business logic | The new core and normalization files import no Supabase, OpenAI, Sarvam, Telegram sender, or business module. |
| No unnecessary dependency | `package.json` is unchanged by Module 6; tests use Node's built-in runner. |
| Build quality | The normalization harness, route integration checks, `npm run lint`, and `npm run build` all passed. |
| No Module 7+ scope creep | Source inspection found no `processMessage`, AI, STT, persistence, reply, or business-logic implementation in the Module 6 files. |
