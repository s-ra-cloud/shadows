---
name: Stored error text for hunter runs
description: Why every caught exception must be normalised before it is written to a run error, blocker detail or progress payload.
---

Any caught exception that ends up in the database (run `error`, blocker
`detail`, corpus-item outcome `detail`) must first be reduced to a short,
human-readable reason, and text embedded in the run-progress payload must be
length-capped.

**Why:** the Postgres driver wraps failures in a `Failed query: <statement>
params: <every bound value>` envelope. One of the bound values for a hunter run
is the whole run-progress JSON, so a single failed progress write produced tens
of kilobytes of text. Storing that text as a blocker detail fed it back into the
next progress payload, so each subsequent failure in the same run was larger
than the last — the run record grew multiplicatively across a corpus list. The
actionable part is the innermost cause (connection dropped, constraint
violated), never the statement text.

**How to apply:**
- Route caught exceptions through the shared error-text helper before storing or
  returning them; do not hand-roll `e instanceof Error ? e.message : String(e)`
  for anything persisted.
- Bookkeeping writes (blocker inserts, progress updates) are advisory: log and
  swallow their failures. If they throw, the cycle re-enters its failure path
  and the driver's envelope becomes the run's reason — the exact cascade above.
- Machine-written error text can be one long unbroken line; UI that shows it
  needs a summary line plus a scrollable, word-breaking details block.
