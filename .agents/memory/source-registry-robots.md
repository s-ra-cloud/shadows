---
name: Source registry & robots gotchas
description: Non-obvious constraints when adding trusted full-text sources to the Source Hunter registry
---
- Downloader enforces `robots_mode: target_origin`, so registry entries only work if the site's robots.txt permits the exact path. Wikimedia robots.txt disallows `/wiki/Special:` and `/w/` — Wikisource Special:Export/api.php downloads will be robots-blocked despite being registry-allowed.
- raw.githubusercontent.com has no robots.txt (404 ⇒ allowed); Perseus GitHub raw files download cleanly end-to-end.
- Editors can override the bundled registry via `PUT /api/hunter/registry`, which writes `data/hunter-registry.json`; delete that file to fall back to the bundled default.

**Why:** first remote e2e test failed-path analysis (July 2026) showed robots, not the allow-list, is the practical gate.
**How to apply:** before adding a registry entry, curl the site's robots.txt for the intended path prefix.
