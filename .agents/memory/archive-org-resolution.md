---
name: archive.org link resolution quirks
description: How archive.org answers metadata/search lookups, and which of its links are actually downloadable
---
- `archive.org/metadata/<id>` answers **200 with `{}`** for identifiers that do not exist — a missing item is never a 404, so an absent `metadata` key is the only not-found signal.
- Lending-restricted items still *list* an OCR text file, but the entry carries `private: "true"` and the download returns 401/403. Treat those (and `access-restricted-item` / `is_dark`) as unfixable, not retryable.
- Never assume `<identifier>_djvu.txt` exists. Real filenames contain spaces, apostrophes and `&`; percent-encoded `/download/<id>/<file>` URLs still work.
- `/download/` 302s to whichever regional node holds the file: `*.us.archive.org`, `*.eu.archive.org`, `*.ca.archive.org` (path `/N/items/…`). Trusting only US nodes silently fails a large share of downloads.
- `advancedsearch.php` **ANDs** the words inside `title:(…)`, so a title carrying qualifiers the catalog never uses ("complete text", "Vol. II") matches nothing; retry with the few most distinctive words. Bare OR queries return junk.
- Set-overlap title scoring under-rates true matches (catalog titles add subtitles, candidate titles add qualifiers); the longest *ordered* run of shared tokens survives both. The item's `volume` field — also an `fl[]` search field, and the `…0002…` identifier habit — is what keeps volume I and II apart.
- robots.txt disallows only `/control/` and `/report/`, so `/metadata/` and `/advancedsearch.php` lookups are permitted.

**Why:** an entire queue of archive.org links had been stored without ever being checked against the Archive; each point above was confirmed against the live service.
**How to apply:** resolve any archive.org URL against the item's real file list before storing or showing it, and report a precise reason (not found / restricted / no text file / no confident match) instead of substituting a guess.
