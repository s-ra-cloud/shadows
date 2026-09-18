# Source Hunter improvement loop

A weekly loop that measures the hunter against a fixed benchmark list,
fixes the largest failure class, and records the coverage delta. It keeps
the existing boundary: the agent proposes code in pull requests, humans
merge and deploy, and rights and source-policy decisions stay with editors.

## Pieces

| Piece | Where |
| --- | --- |
| Benchmark list | `data/hunter-benchmark/shadows-benchmark.csv` (see its README) |
| Launch a benchmark run | `POST /api/hunter/cycles/benchmark` (editor) or `POST /api/bot/hunter/benchmark` (bot token) |
| Progress report | `GET /api/bot/hunter/report` (bot token), documented in `docs/hunter-bot-api.md` |
| Improvement log | `docs/improvement-log.md` |
| Fix-class routing | `FIX_CLASS_ROUTING` in `server/hunterReport.ts`, echoed in every report |

Coverage is `(fetched + fetched_locked) / total` on the benchmark list.
Only runs named exactly `shadows-benchmark` count; retry runs
(`shadows-benchmark (retry)`) are excluded so a retry cannot inflate the
number.

## Weekly pass

1. Make sure a benchmark run has completed since the last merged fix
   (launch one if not; a full run takes about an hour for 34 items).
2. `git pull`, then `GET /api/bot/hunter/report`.
3. Read `docs/improvement-log.md` and `.agents/memory/`.
4. Record this week's coverage and the per-item improved/regressed counts
   in the log. A regression is investigated before anything else.
5. Pick one failure class: the largest `blockers` bucket whose `owner` is
   `code` (or `adapter`, for a larger change). Buckets owned by `policy`
   or `rights` are written up as a short note for the editor, never fixed
   in code.
6. Write a failing test that reproduces it, fix it, run `npm test`, open a
   pull request that cites the benchmark run id and the affected items.
7. Human: review, merge, pull in Replit, publish. The next scheduled run
   produces the evidence for step 4 of the following week.

## Routing

| Blocker reason | Owner | Action |
| --- | --- | --- |
| `not_found`, `fetch_failed`, `invalid_candidate`, `secondary_source`, `too_large` | code | test + fix in a pull request |
| `discovery_unsupported` | adapter | new discovery strategy, larger pull request |
| `unregistered_source`, `download_not_authorized`, `robots_disallowed`, `requires_auth` | policy | proposal to the editor; registry or robots decision |
| `rights_locked` | rights | editor rights review; never code |

## Keeping the number honest

- Do not edit the benchmark list in the same pull request as a hunter fix.
- Note every list edit in the improvement log with the date.
- Compare against the previous *completed* run only; a failed or stopped
  run is listed in the report but is not a baseline.
- A run interrupted by a server restart keeps the outcomes of the items
  that ran (`interrupted: true` in the report, remaining items `skipped`)
  and can be resumed with Retry missing. Its coverage is over the full
  list, so it reads low; use it to inspect blockers, not to measure.
- Do not publish a deployment while a benchmark run is in progress: an
  autoscale redeploy kills the cycle.
- A work the corpus already holds counts as fetched on every later run,
  even though its editions are skipped as duplicates and not downloaded
  again (the item's detail says "already held from an earlier run"). So
  coverage measures what the hunter *can* find, cumulatively; it does not
  drop when discovery merely rediscovers a known edition. To measure
  discovery from scratch, run the list against an empty corpus.
