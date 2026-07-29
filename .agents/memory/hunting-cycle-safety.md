---
name: Hunting-cycle safety boundaries
description: Non-obvious invariants when the Source Hunter discovers/downloads texts autonomously (AI leads, redirects, robots)
---
- **AI-claimed rights must never enter rights-evidence fields.** The rights engine treats `rights.statement/license/license_url/rights_url` text as evidence (CC/PD markers unlock publication). Unverified AI claims go in `ai_claimed_*` keys instead; publication unlocks only via evidence embedded in the downloaded file or editor review.
- **Every outbound fetch must re-validate host + robots on each redirect hop** (`redirect: "manual"`). archive.org `/download/` redirects to `iaNNN.us.archive.org/<other-path>`, so path-prefix allow-lists fail on the final URL by design — recorded as a blocker, not bypassed.
- Blockers ledger (`hunter_blockers`) is the intended surface for anything the hunter can't do (robots, auth, unregistered hosts, rights locks); record and move on, never circumvent.

**Why:** code review of the hunting-cycle feature (July 2026) found the redirect hole; the AI-claim hole was found in live e2e when a sacred-texts lead nearly published on claim text alone.
**How to apply:** any new discovery strategy or lead source must route fetches through the pinned-host `fetchJson` and keep unverified claims out of evidence fields.
