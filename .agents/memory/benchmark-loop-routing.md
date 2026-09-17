---
name: Benchmark loop and fix-class routing
description: How Source Hunter progress is measured and which blocker classes an agent may fix in code versus hand to the editor
---
- Progress = coverage on the fixed benchmark list `data/hunter-benchmark/shadows-benchmark.csv`, run as a corpus-list cycle named exactly `shadows-benchmark` (retry runs are `… (retry)` and never count). `GET /api/bot/hunter/report` (bot token) gives coverage per run, the per-item diff against the previous completed run, and blockers grouped by reason × source with an `owner`. The builder is `server/hunterReport.ts`; the procedure is `docs/benchmark-loop.md`; every pass is logged in `docs/improvement-log.md`.
- Owners (`FIX_CLASS_ROUTING`): `not_found`, `fetch_failed`, `invalid_candidate`, `secondary_source`, `too_large` → **code** (test + fix + PR). `discovery_unsupported` → **adapter** (new discovery strategy, larger PR). `unregistered_source`, `download_not_authorized`, `robots_disallowed`, `requires_auth` → **policy** (editor's registry/robots decision; only propose). `rights_locked` → **rights** (editor review, never code).
- Pick ONE failure class per pass: the largest `code`-owned bucket. A regression in the item diff is investigated before any new fix.
- Never edit the benchmark list in the same PR as a hunter fix, and record list edits in the log — otherwise a coverage jump is unreadable.
- Benchmark runs take ~1–2 min per item (34 items ≈ an hour) and autoscale redeploys kill long cycles: keep the list ≤ 40 and do not deploy while one is running.

**Why:** the loop (Sept 2026) exists to make hunter fixes evidence-driven; without routing an agent will "fix" robots or rights blockers in code, which the project's safety boundary forbids.
**How to apply:** before touching hunter code, read the latest report and the log; cite the benchmark run id and the affected item titles in the PR.
