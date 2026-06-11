---
name: Session cookies must be SameSite=None inside the canvas iframe
description: Editor/admin login silently fails (login OK, next request 401) unless session cookie is SameSite=None; Secure
---

# Session cookies for iframe-embedded preview

Express session cookies for this app must be `secure: true` + `sameSite: "none"`, with `app.set("trust proxy", 1)`.

**Why:** The app is served over HTTPS behind Replit's proxy and is shown inside the
canvas preview **iframe** (cross-site context). A cookie with the default `SameSite=Lax`
is NOT sent by the browser on requests made from inside a cross-site iframe. Symptom:
`/api/database/login` returns success and the client flips into edit mode, but every
subsequent editor request (export, import, edits) returns 401 "Unauthorized" — even
immediately after entering the password. `SameSite=None` requires `Secure`, and
`Secure` cookies only get issued behind the proxy when `trust proxy` is set so Express
sees `x-forwarded-proto: https`.

**How to apply:** Set this in the `session(...)` config in `server/routes.ts`. Don't
revert to `secure:false`/no sameSite — it will break editor auth in the embedded preview.
When testing via curl over plain http, pass `-H "X-Forwarded-Proto: https"` or the
Secure cookie won't be set.
