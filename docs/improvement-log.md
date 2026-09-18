# Source Hunter improvement log

One entry per weekly pass. Coverage is from `GET /api/bot/hunter/report`
for the `shadows-benchmark` list. See `docs/benchmark-loop.md`.

| Date | Benchmark run | Coverage | Improved / regressed | Failure class picked | Change | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| 2026-09-17 | none yet | n/a | n/a | screening cache collision, AI-lead Wikisource titles | PRs #2, #4 | Fixes came from reading runs 20 and 29 by hand; the benchmark list was created in this pass, so the first coverage number is the next run's. |
| 2026-09-18 | #31 (interrupted) | unmeasurable | n/a | interrupted run discards its per-item report | PR #8 | Run #31 was killed by a server restart after ~10 of 34 items (64 files, 124 blockers) and stored no per-item outcomes, so coverage could not be read. Fix: salvage the progress snapshot into a report on restart, let interrupted runs be retried, and cap corpus path length (one `fetch_failed` was ENAMETOOLONG). Also seen, not fixed: Gutenberg/Perseus title matching pulls unrelated works ("Epicoene", "Fasti", "Eclogues") that are downloaded then rights-locked, which is most of the run time; AI leads on unregistered hosts (7, the detail does not name the host); AI-guessed Wikisource subpages ("Theogony (Hesiod)/English") not found. Next candidates: discovery precision, then subpage fallback. |
| 2026-09-18 | #32 (1 item, stopped) + #33 (retry of #32, 33 items, completed) | first full pass; exact per-item report not yet read | n/a | works already in the corpus read as not fetched on a re-run | PR #9 | #33 produced 124 files (46 public, 78 locked) with 355 blockers; roughly 25 of 34 works reached the corpus, most into the locked partition awaiting rights review. Because #33 is a retry it is not a baseline under the rules; the first baseline is the next full `shadows-benchmark` run. Reading #33 showed that duplicate leads are never downloaded and an item only counted this run's downloads, so a second full run would have marked Gilgamesh and every other already-held work as not fetched. Fixed before it could corrupt the first comparison. Still open from #31: discovery precision (unrelated Gutenberg/Perseus matches downloaded then locked), unregistered-host detail, Wikisource subpage fallback. New in #33: a Wikimedia redirect to `/w/rest.php` refused as untrusted (Bhagavad Gita); Perseus reports `discovery_unsupported` for every non-classical work, which is noise. |

## List edits

| Date | Change | Why |
| --- | --- | --- |
| 2026-09-17 | Initial list: 34 works across 16 traditions | Draft for editorial review; Balinese and cross-cultural traditions have no freely available primary text to include. |
