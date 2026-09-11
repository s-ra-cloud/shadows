# Daily Hunter routine

The Daily Hunter routine is a durable, editor-controlled review loop. Its
configuration lives in `daily_hunter_routines`; every invocation gets one
unique `daily_hunter_executions` row keyed by the routine and local date (the
timezone is recorded with the execution). It is **paused by default**, with a default schedule of `09:00
Europe/Paris` and report recipient `duparclaura.pro@gmail.com`.

## Safety contract

- A run calls the same `runNormalHunterCycle` entry point as the normal Hunter
  API. It therefore retains the active policy, trusted-source registry,
  robots, rights, provenance, blocker, and automatic extraction controls.
- A second invocation for the same local date returns the existing execution.
  It cannot launch a second cycle after a timeout, retry, overlap, or restart.
- A PostgreSQL session advisory lock is held for the entire cycle and report
  delivery. It prevents cross-replica overlap; retained running claims are
  recovered only after that same lock proves no live owner exists.
- The scheduled worker may run every five minutes. The authenticated trigger
  refuses to claim or launch work before the saved local time, and performs at
  most one post-time execution per local date. This lets an editor change the
  saved schedule without editing a deployment cron.
- The post-run review is deterministic: it summarizes stored cycle counts and
  stored blockers, comparing recent daily runs only. It does not make
  unsupported rights or source-policy claims.
- Recurring blockers may produce an `engineering_task` proposal. Proposals
  are not executable. Approval only allows the editor to export a Markdown
  engineering brief; it never writes project files, changes rights evidence,
  or changes trusted-source policy.
- Email delivery is claimed as `sending` before the Gmail request. Any
  network/proxy uncertainty becomes `unknown` and is never automatically
  resent, avoiding duplicate reports. A failed cycle receives one analogous
  failure report through the same claim protocol. A finalized `pending`
  execution (for example, a process loss after finalization but before the
  delivery claim) is known-unsent and is resumed once under the advisory lock,
  using its saved recipient/timezone snapshot rather than current settings.

## Editor controls

Open `/daily-hunter` and authenticate as an editor. Editors can change and
save the pause state, 24-hour local time, IANA timezone, and recipient; inspect
the latest 30 executions and their run links; and approve or reject
evidence-backed proposals. Only approved proposals expose the engineering
brief export endpoint.

The saved time is the routine contract and is included in its history. It does
not programmatically change a deployed scheduler. A timezone edit is rejected
when it would reinterpret any recorded execution instant as a different local
date, since allowing that edit could create a second idempotency key around a
date boundary.

## Scheduled deployment setup

This app remains a web deployment. Replit Scheduled Deployments are a separate
deployment target and cannot also host the web app. Create a **second,
single-purpose Scheduled Deployment** from the same repository with:

```text
run: npm run daily-hunter:scheduled
```

Schedule that deployment every five minutes. The worker uses the time and
timezone saved in `/daily-hunter` and will only claim one execution after that
local time each day, so editor schedule changes take effect without a second
deployment edit.
Set these production secrets on both deployments:

- `DAILY_HUNTER_TRIGGER_TOKEN`: a high-entropy shared bearer secret.
- `DAILY_HUNTER_APP_URL`: the HTTPS URL of the web deployment (on the scheduled
  worker only).
- `DAILY_HUNTER_PROJECT_PROTECTION_TOKEN`: an optional Replit Production
  external-access token for a private web deployment (on the worker only).

The worker makes exactly one authenticated `POST` request to
`/api/internal/daily-hunter/trigger`. That endpoint has no editor-session
fallback and fails closed when the token is absent. If the web deployment is
private, set the external access token as
`DAILY_HUNTER_PROJECT_PROTECTION_TOKEN` on the scheduled worker in addition to
this application bearer token. The worker awaits that long request through
cycle completion and report delivery; it does not launch a background task
that can be discarded when a scheduled process exits.

The Gmail connection is used through `@replit/connectors-sdk` with connector
`google-mail` and proxy path `/gmail/v1/users/me/messages/send`. It sends from
the connected account only; no arbitrary sender address is accepted.

## Schema and rollback

Apply the development schema with `npm run db:push`. Publishing applies the
schema diff to production through the normal Replit Publish flow; do not add
startup DDL or hand-run production migrations. To stop future work immediately,
pause the routine in `/daily-hunter` and disable the separate scheduled
deployment. Existing execution and proposal records remain available for audit.