# Hunter Bot API

This API gives a trusted autonomous agent editor-level access to the Source
Hunter and its complete corpus, including locked texts.

## Authentication

Set the secret `HUNTER_BOT_API_TOKEN` in SHADOWS and put the same value in the
agent's secure environment. Every request must send:

```http
Authorization: Bearer YOUR_TOKEN
```

Never put the token in a prompt, URL, source file, or chat message.

## Discover the API

```http
GET /api/bot/hunter
GET /api/bot/hunter/openapi.json
```

The second endpoint is an OpenAPI 3.1 document that Codex and other agents can
use as tool documentation.

## Typical agent workflow

1. Start a search:

   ```http
   POST /api/bot/hunter/search
   Content-Type: application/json

   {"query":"Epic of Gilgamesh","limit":10,"use_ai":true}
   ```

   `region_id` may be used with or instead of `query`. Search uses the same
   parameters and filters as the Hunter editor interface.

2. Poll the URL in `links.poll` until the run status is `completed` or
   `failed`. A completed run includes files and blockers.

3. List corpus texts:

   ```http
   GET /api/bot/hunter/texts?q=gilgamesh
   GET /api/bot/hunter/texts?partition=locked
   GET /api/bot/hunter/texts?language=en&source_id=source:internet-archive
   ```

   The inventory includes public and locked texts by default.

4. Read or download a text:

   ```http
   GET /api/bot/hunter/texts/12
   GET /api/bot/hunter/texts/12/content
   GET /api/bot/hunter/texts/12/download
   ```

   `/content` returns extracted Markdown when available, otherwise raw UTF-8
   text. Binary files without an extracted version return `415` and point to
   the download endpoint.

## Benchmark and progress report

The checked-in benchmark list (`data/hunter-benchmark/shadows-benchmark.csv`)
is how hunter progress is measured over time. See `docs/benchmark-loop.md`.

1. Launch a benchmark run (one at a time; `409` while one is in progress,
   `503` if the list file is missing or malformed):

   ```http
   POST /api/bot/hunter/benchmark
   Content-Type: application/json

   {"use_ai": true}
   ```

   Poll `links.poll` until the run is `completed` or `failed`. A full run
   over ~34 items takes on the order of an hour.

2. Read the report:

   ```http
   GET /api/bot/hunter/report
   GET /api/bot/hunter/report?list=shadows-benchmark&limit=5
   ```

   The response carries:
   - `runs`: the most recent runs for that list, newest first, each with
     per-status counts and `coverage` = (fetched + fetched_locked) / total.
     Retry runs are stored under a different list name and never appear.
     A run with `interrupted: true` was cut short by a server restart; its
     counts cover the items that ran and the rest are `skipped`.
   - `latest`: the most recent *completed* run compared with the previous
     completed one: `coverage_delta`, counts of `improved` / `regressed`
     items, and every item with `status`, `previous_status` and `change`
     (`improved`, `regressed`, `unchanged`, `new`).
   - `blockers`: the latest run's `hunter_blockers` rows grouped by reason
     and source, largest bucket first, each with an `owner` from `routing`.
   - `routing`: which kind of change each blocker reason needs: `code`
     (a fix in this repository), `adapter` (a new discovery strategy),
     `policy` (an editor's registry or robots decision) or `rights`
     (an editorial rights review, never code).

   An agent's weekly pass should pick the largest bucket whose owner is
   `code`, reproduce it with a test, and open a pull request citing the
   run id. Buckets owned by `policy` or `rights` are reported to the
   editor, not fixed.

## Safety

- The API accepts database IDs, never filesystem paths.
- Both public and locked texts are available because the Bearer token grants
  editor-level access.
- Treat locked texts according to the rights metadata returned with the text.
- Rotate `HUNTER_BOT_API_TOKEN` immediately if it is exposed.