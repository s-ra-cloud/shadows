---
name: Extraction crawl principles
description: Durable rules for HTML→Markdown extraction crawls of public-domain text sites
---

- Scope index crawls to the index page's own directory path. **Why:** same-host site chrome (home page, shop, sibling works) otherwise ends up inside the compiled document. **How to apply:** filter every discovered link against the source URL's directory prefix before queueing.
- Judge whether a page is a table of contents by prose *outside* `<a>` elements, measured on raw HTML. **Why:** after Markdown conversion link texts/URLs masquerade as prose and detection silently breaks.
- Sites serve interstitials mid-crawl (meta-refresh stubs, anti-bot challenges). Count them as failures and abort when failures dominate — never save a fragment as a finished document.
- Turndown: later-added rules override earlier ones; keep all `<a>` handling in one rule.
- Public-domain archives rate-limit repeated full crawls within minutes; keep throttle ≥500 ms and avoid back-to-back re-crawls when testing.
- Sub-index pages carry breadcrumb links to their *next sibling* (plain book name, not "Next:" text). Never re-queue a URL already pending in the crawl queue — a deeper duplicate overtakes the depth-1 entry and silently flattens the whole book into link text.
- Filter nav-text links ("Next: …", "« Previous: …", "Index") at link-extraction time, not just at Markdown time, so they never become crawl children.
- CDN-fronted archives intermittently 403/5xx single pages mid-crawl; retry once after a pause, else a whole sub-index (book) drops with only a warning.
- A "complete-looking" extraction can still be a fragment because the *raw index download* itself was partial (e.g. a half-rendered page ending in valid </html>). Compare against the live index when a compiled document looks short.
