# Module 5 — Telegram Webhook Implementation Report

## Module Objective

Create a minimal Next.js App Router endpoint that receives Telegram webhook POST requests, authenticates them with Telegram's secret-token header, safely parses the request body, validates only the Telegram update envelope needed at this stage, and leaves a clean handoff point for Module 6.

This module does not normalize input, run application logic, send replies, register a webhook, or implement any later module.

## Repository State Before Implementation

The repository contained the completed Module 2 environment helper, Module 3 Supabase server client, and Module 4 outbound Telegram adapter. No route files existed under `src/app`, and there was no inbound Telegram webhook handling.

The ignored root `.env.local` was checked by variable presence only. Both `TELEGRAM_BOT_TOKEN` and `TELEGRAM_WEBHOOK_SECRET` were present and non-empty. Neither value was printed or copied into source.

The working tree already contained uncommitted artifacts from Modules 2–4 and dependency changes from Module 3. Those existing changes were preserved.

## Files Inspected

- `AGENTS.md`
- `src/config/env.ts`
- `src/lib/telegram/client.ts`
- `src/lib/supabase/server.ts`
- Existing files under `src/app/`
- `.env.local` (presence-only checks; no secret values output)
- `.gitignore`
- `package.json`
- `package-lock.json`
- `tsconfig.json`
- `eslint.config.mjs`
- `next.config.ts`
- Existing Module 2, Module 3, and Module 4 implementation reports
- Installed Next.js 16 Route Handler documentation

## Files Created

- `src/app/api/telegram/webhook/route.ts`
- `MODULE_5_TELEGRAM_WEBHOOK_IMPLEMENTATION_REPORT.md`

## Files Modified

- `src/config/env.ts`

The configuration change adds only `getTelegramWebhookSecret()`, which delegates to the existing required server-environment reader.

## Dependencies Added or Changed

None. Module 5 uses the Web `Request`, `Response`, and `Headers` behavior supported by Next.js Route Handlers. No Telegram SDK, validation library, or test framework was installed.

`package.json` and `package-lock.json` were not modified by Module 5.

## Environment and Configuration Changes

`src/config/env.ts` now exports:

```ts
getTelegramWebhookSecret(): string
```

It reads `TELEGRAM_WEBHOOK_SECRET` through the existing `getRequiredServerEnv` helper. The variable is unprefixed and therefore is not exposed through a `NEXT_PUBLIC_` browser bundle.

The route does not use `TELEGRAM_BOT_TOKEN` to authenticate webhook requests. No environment value was added, changed, printed, logged, or copied into the report.

## Exact Webhook Route Path

Source file:

```text
src/app/api/telegram/webhook/route.ts
```

Application route:

```text
/api/telegram/webhook
```

The production build lists it as a dynamic, server-rendered route.

## Secret-Header Validation Behavior

The POST handler reads the case-insensitive HTTP header named:

```text
X-Telegram-Bot-Api-Secret-Token
```

It compares that header value with `getTelegramWebhookSecret()`. A missing or incorrect value returns the same generic `401 Unauthorized` JSON response:

```json
{"ok":false,"error":"Unauthorized"}
```

Secret validation occurs before body parsing. The route contains no logging statements and does not return either the received or configured secret.

## JSON Parsing Behavior

After successful secret validation, the handler calls `request.json()` inside a `try`/`catch`. Invalid JSON returns status `400` with:

```json
{"ok":false,"error":"Malformed JSON body"}
```

The route does not crash or expose parsing details.

## Telegram Update Handling Behavior

The route defines only a minimal `TelegramUpdateEnvelope` type. A payload is accepted when it is a non-array object with a numeric safe-integer `update_id`.

No message, text, chat, sender, callback, media, or normalized-message fields are required. Consequently, valid non-message Telegram update shapes are acknowledged without crashing. Accepted data is not persisted, normalized, dispatched, or replied to.

The code contains an explicit comment marking the post-validation handoff point for Module 6, but Module 6 logic itself is absent.

## HTTP Status Behavior

| Request case | Status | Response behavior |
| --- | ---: | --- |
| Valid secret + valid Telegram-like message update | `200` | `{"ok":true}` |
| Missing secret | `401` | Generic unauthorized JSON |
| Invalid secret | `401` | Generic unauthorized JSON |
| Malformed JSON | `400` | Malformed JSON error JSON |
| Valid non-message update | `200` | `{"ok":true}` |
| Invalid envelope without `update_id` | `400` | Invalid Telegram update payload JSON |
| Unsupported `GET` method | `405` | Next.js method-not-allowed response |

## Tests Executed

The application was started locally on port `3105`, and real HTTP requests were sent to `/api/telegram/webhook`. The configured secret was read locally for request construction but was never included in command output.

Focused cases and exact results:

```text
CASE=valid-message STATUS=200 BODY={"ok":true}
CASE=missing-secret STATUS=401 BODY={"ok":false,"error":"Unauthorized"}
CASE=invalid-secret STATUS=401 BODY={"ok":false,"error":"Unauthorized"}
CASE=malformed-json STATUS=400 BODY={"ok":false,"error":"Malformed JSON body"}
CASE=non-message-update STATUS=200 BODY={"ok":true}
CASE=invalid-envelope STATUS=400 BODY={"ok":false,"error":"Invalid Telegram update payload"}
CASE=unsupported-method STATUS=405 BODY=
```

The local development server was stopped after testing.

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
✓ Compiled successfully in 1004ms
✓ Running TypeScript
✓ Generating static pages using 6 workers (5/5)

Route (app)
┌ ○ /
├ ○ /_not-found
└ ƒ /api/telegram/webhook
```

Result: passed with exit code 0. The webhook route was included as a dynamic server route.

## Warnings or Unresolved Issues

- The first PowerShell test-harness attempt at the optional GET case passed an empty `ContentType` argument and failed before sending that GET request. The GET case was immediately rerun with a simpler command and returned the expected `405`. This was a test-harness issue, not an application failure.
- Git emitted a non-blocking warning while trying to read the user-global ignore file at `C:\Users\Ishan Elite/.config/git/ignore`. The repository's own `.gitignore` still protects `.env.local`.
- `git diff --check` emitted existing line-ending normalization notices for `package.json` and `package-lock.json` but found no whitespace errors.

No Module 5 implementation issue remains unresolved.

## Telegram Webhook Registration Confirmation

Telegram webhook registration was **not** performed. No `setWebhook` request, deployment, public URL configuration, Telegram polling, or `getUpdates` request occurred.

## Module 6+ Scope Confirmation

No Module 6+ functionality was implemented. The route does not normalize input, call `processMessage()`, generate Saleel responses, orchestrate outbound replies, access Supabase, persist data, call OpenAI or Sarvam, perform RAG, or implement bookings or business logic.

## Module 5 Completion Evidence

| Module 5 requirement | Concrete repository evidence |
| --- | --- |
| App Router webhook route | `src/app/api/telegram/webhook/route.ts` exists, and `next build` lists `/api/telegram/webhook`. |
| POST-only handling | `src/app/api/telegram/webhook/route.ts` exports only `POST`; the HTTP GET test returned `405`. |
| Centralized webhook-secret access | `src/config/env.ts` exports `getTelegramWebhookSecret()`, which delegates to `getRequiredServerEnv("TELEGRAM_WEBHOOK_SECRET")`. |
| Correct Telegram secret header | `src/app/api/telegram/webhook/route.ts` reads `x-telegram-bot-api-secret-token` through `request.headers`. Header names are case-insensitive. |
| Missing and invalid secrets rejected | Local HTTP tests returned `401` for both missing and invalid secret cases. |
| Bot token not used for validation | The webhook route imports only `getTelegramWebhookSecret`; it does not import or reference `getTelegramBotToken`. |
| Safe JSON parsing | `request.json()` is wrapped in `try`/`catch`; malformed JSON returned `400` during the local HTTP test. |
| Minimal envelope validation | The local `TelegramUpdateEnvelope` requires only an object containing a safe-integer `update_id`. |
| Non-message updates handled gracefully | A callback-query-shaped payload with a valid `update_id` returned `200`. |
| Invalid envelopes rejected | A JSON object without `update_id` returned `400`. |
| No secret logging | The route contains no `console` or logging call and returns only generic authentication errors. |
| No unnecessary dependencies | `package.json` is unchanged by Module 5; native Request/Response APIs are used. |
| No webhook registration | Source audit found no `setWebhook` or `getUpdates` reference, and no external registration request was made. |
| No Module 6+ implementation | The route ends after validating the envelope and returning acknowledgement; the source audit found no normalization or `processMessage` implementation. |
| Quality verification | `npm run lint`, the focused HTTP cases, and `npm run build` all passed. |
