---
name: Source registry & robots gotchas
description: Non-obvious constraints when adding trusted full-text sources to the Source Hunter registry
---
- Downloader enforces `robots_mode: target_origin`, so registry entries only work if the site's robots.txt permits the exact path. Wikimedia robots.txt disallows `/wiki/Special:` and `/w/` — Wikisource Special:Export/api.php downloads will be robots-blocked despite being registry-allowed.
- raw.githubusercontent.com has no robots.txt (404 ⇒ allowed); Perseus GitHub raw files download cleanly end-to-end.
- Internet Archive `/download/...` URLs 302-redirect to mirror hosts (`iaNNN.us.archive.org`, path `/NN/items/...`); registry sources can declare `trusted_redirects` (hosts + path regex) and the downloader re-validates every hop (allow-list OR trusted rule) plus robots per hop. IA also returns 503 to datacenter IPs sometimes — a live failure may be rate-limiting, not a policy bug.
- Editors can override the bundled registry via `PUT /api/hunter/registry`, which writes `data/hunter-registry.json`; delete that file to fall back to the bundled default.
- Wikisource machine access must go through Wikimedia's Core REST API on `api.wikimedia.org` (`/core/v1/wikisource/<lang>/search/page`, `/page/<key>`): robots-permitted, per-language wikis only (the `mul` multilingual project is NOT served there), and the page endpoint returns wikitext in a bare `source` field, not a revisions envelope. `api.wikimedia.org/robots.txt` 301s to an HTML docs page, so a robots fetcher must sniff the body before parsing it as rules.
- Robots-permitted official routes (verified Aug 2026): Wikisource normal `/wiki/Title` pages are robots-allowed (only `/w/`, `/api/`, `Special:` blocked); gutenberg.org robots.txt only disallows `/ebooks/search`, so `/files/`, `/cache/epub/` ebook files are fine. archive.org `/stream/...` reader pages are NOT in the allowed `/download/` prefix — use `/download/` item-file URLs.

**Why:** first remote e2e test failed-path analysis (July 2026) showed robots, not the allow-list, is the practical gate.
**How to apply:** before adding a registry entry, curl the site's robots.txt for the intended path prefix.
