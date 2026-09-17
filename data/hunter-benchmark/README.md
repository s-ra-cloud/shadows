# Source Hunter benchmark list

`shadows-benchmark.csv` is the fixed list of primary sources the hunter is
measured against. Running it produces a corpus-list cycle named
`shadows-benchmark`; coverage is the share of items that end in `fetched`
or `fetched_locked`. Because the list never changes between runs, the
coverage number is comparable from one run to the next, and a per-item
diff shows exactly which works a code change fixed or broke.

## Editing the list

- Keep it to roughly 30–40 works. A corpus-list cycle takes 1–2 minutes
  per item, and long cycles are killed by autoscale redeploys.
- Two or three works per tradition, biased towards texts known to exist on
  the registered sources with automated discovery: Wikisource (via the
  Wikimedia Core REST API), Project Gutenberg, the Perseus GitHub corpora
  and the Internet Archive. `sacred-texts.com` and ToposText are
  manual-only and will always block.
- Columns the hunter reads: `title`, `author`, `language`, `url`.
  `tradition` and `notes` are for people and are ignored by the parser.
- Give a `url` only when the exact page is known (it must be `https://`).
  Without one, the hunter discovers the work from title, author and
  language, which is what the benchmark is mostly meant to exercise.
- Titles in the original script (`山海經`, `延喜式`) are fine; the
  `language` column tells the hunter which Wikisource to search.
- A few deliberately hard items (the Baal Cycle, the Pyramid Texts) are
  included so the rights and not-found paths are exercised too.

Changing an item changes what the coverage number means. Note list edits
in `docs/improvement-log.md` so a jump in coverage is not mistaken for a
code improvement.

## Running it

- Editor UI or `POST /api/hunter/cycles/benchmark` with an editor token.
- Agents: `POST /api/bot/hunter/benchmark` with the bot bearer token, then
  `GET /api/bot/hunter/report` for coverage, per-item deltas against the
  previous run, and blockers grouped by reason and source.

See `docs/benchmark-loop.md` for the weekly improvement loop built on it.
