---
name: Auth inside the canvas iframe — cookies can't be relied on, use a header token
description: Editor/admin login silently fails (login OK, next request 401) inside the cross-site preview iframe; the durable fix is a token in an x-editor-token header, not cookies
---

# Auth for iframe-embedded preview

**Don't rely on session cookies for editor/admin auth in this app.** The app is shown
inside the canvas preview **iframe** (cross-site context). Modern browsers (Safari
always, recent Chrome under third-party-cookie phase-out) block third-party cookies
entirely, so even a correctly configured `SameSite=None; Secure` cookie is dropped.
Symptom: `/api/database/login` (or `/api/admin/login`) returns success and the client
flips into edit mode, but every subsequent authed request (export, import, edits)
returns 401 "Unauthorized" — even immediately after entering the password.

**The working fix: a bearer token sent in an `x-editor-token` header.**
- Server derives deterministic tokens from `SESSION_SECRET`:
  `EDITOR_TOKEN = HMAC-SHA256(SESSION_SECRET, "editor")`, `ADMIN_TOKEN = ...("admin")`.
  Deterministic so the token survives server restarts (client keeps it in localStorage)
  and needs no server-side store.
- `requireEditor`/`requireAdmin`/`auth-status` accept **either** a valid session cookie
  **or** a matching `x-editor-token` header (`hasEditor`/`hasAdmin` helpers).
- Login routes return `{ success, token }`; client stores it in localStorage and clears
  it on logout/401.
- Client sends the header automatically from `apiRequest` + `getQueryFn` (via an
  `authHeaders()` helper in `client/src/lib/queryClient.ts`). **Raw `fetch()` calls and
  `window.location.href` downloads bypass that** — every authed raw fetch (the two
  `/api/export` + `/api/suggestions/export` buttons, admin "Download DB") must add
  `headers: authHeaders()` and use a blob download instead of `window.location.href`
  (a navigation can't carry a custom header).

**Why deterministic-token security is acceptable here:** the whole app uses a single
shared editor/admin password (admin password literally *is* `SESSION_SECRET`). A token
derived from `SESSION_SECRET` is no weaker than the password itself, as long as
`SESSION_SECRET` is set (it is, 88 chars). Do NOT over-build per-user expiry/revocation
for this shared-password model. The in-code dev fallbacks (`shadows-dev-secret`, etc.)
only apply when env vars are unset and match the app's existing posture.

**Cookie config is still set** (`secure:true, sameSite:"none"`, `app.set("trust proxy",1)`)
as a best-effort for non-iframe/direct-tab use, but never depend on it inside the iframe.
When testing via curl over plain http, pass `-H "X-Forwarded-Proto: https"`.
