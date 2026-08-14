#!/usr/bin/env tsx
/**
 * check-wikisource-api.ts
 *
 * Opt-in live smoke-test for the Wikimedia Core REST API endpoints that
 * `discoverWikisource` in server/hunterCycle.ts depends on.
 *
 * Run manually whenever you want to verify Wikimedia has not changed their
 * API in a way that would silently break Wikisource discovery:
 *
 *   npx tsx scripts/check-wikisource-api.ts
 *
 * Or via npm:
 *
 *   npm run check:wikisource-api
 *
 * WHY THIS EXISTS
 * ---------------
 * All unit tests stub the network. A renamed field, a moved endpoint, or a
 * new robots policy on Wikimedia's side would only surface as "zero results"
 * during a real discovery run — hard to notice, easy to ignore. This script
 * deliberately fails loudly so the problem is found in minutes, not weeks.
 *
 * WHAT IT CHECKS
 * --------------
 * 1. robots.txt for api.wikimedia.org — must still allow the hunter agent.
 * 2. robots.txt for wikisource.org/w/ — must still be disallowed (we must
 *    never regress to the legacy /w/api.php path).
 * 3. The Core REST search endpoint returns `pages[]` and each page has the
 *    `id`, `key`, and `title` fields the hunter reads.
 * 4. The Core REST page endpoint for the first search result returns a
 *    `source` field (the raw wikitext the hunter stores as the text payload).
 *
 * WHAT TO DO WHEN IT FAILS
 * ------------------------
 * A failure means Wikimedia changed something the hunter depends on. Fix it
 * before the next discovery run:
 *
 *   robots check failed → Wikimedia changed their robots policy.
 *     - Re-read https://api.wikimedia.org/robots.txt.
 *     - If api.wikimedia.org is now disallowed: find the new permitted
 *       endpoint and update WIKIMEDIA_API_HOST / WIKISOURCE_API_BASE in
 *       server/hunterCycle.ts.
 *     - If wikisource.org/w/ is now allowed: that is fine — do nothing. The
 *       check is conservative; we stay on the Core REST API regardless.
 *
 *   search field missing → Wikimedia renamed or removed a field.
 *     - Open: https://api.wikimedia.org/core/v1/wikisource/en/search/page?q=Beowulf&limit=1
 *     - Identify the new field names and update `discoverWikisource` in
 *       server/hunterCycle.ts (the `title`, `key`, `id` reads on `page`).
 *     - Update this script's EXPECTED_SEARCH_FIELDS accordingly.
 *     - Update the matching stub in
 *       server/sourceHunter/__tests__/huntingCycle.test.ts.
 *
 *   page field missing → Wikimedia renamed or removed the wikitext field.
 *     - Open: https://api.wikimedia.org/core/v1/wikisource/en/page/Beowulf
 *     - Identify the new field name for the raw wikitext and update
 *       `discoverWikisource` / the download path in server/hunterCycle.ts.
 *     - Update EXPECTED_PAGE_FIELDS in this script to match.
 *
 *   network error → transient; re-run the script before making code changes.
 */

import { robotsAllowsUrl, clearRobotsCache } from "../server/sourceHunter/robots";
import { fetchJson, WIKIMEDIA_API_HOST, CYCLE_USER_AGENT } from "../server/hunterCycle";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

/**
 * Stable English Wikisource page used as the probe. "Beowulf" has existed on
 * English Wikisource since the project's earliest days and its page key is
 * unlikely to be renamed. Change it here (and nowhere else) if it disappears.
 */
const PROBE_QUERY = "Beowulf";
const PROBE_LANGUAGE = "en";
const WIKISOURCE_API_BASE = `https://${WIKIMEDIA_API_HOST}/core/v1/wikisource/`;

/**
 * Fields the hunter reads from each item in the search `pages[]` array.
 * If any of these disappear the hunter will silently produce empty/wrong
 * candidates.
 */
const EXPECTED_SEARCH_FIELDS: Array<keyof Record<string, unknown>> = ["id", "key", "title"];

/**
 * Field the hunter relies on for the raw wikitext in a page response.
 * (The Core REST API returns wikitext in `source`.)
 */
const EXPECTED_PAGE_FIELDS: string[] = ["source"];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function pass(msg: string) {
  console.log(`  ✓  ${msg}`);
}

function fail(msg: string, detail?: string): never {
  console.error(`  ✗  ${msg}`);
  if (detail) console.error(`     ${detail}`);
  process.exit(1);
}

function section(title: string) {
  console.log(`\n── ${title}`);
}

// ---------------------------------------------------------------------------
// Checks
// ---------------------------------------------------------------------------

async function checkRobots() {
  section("robots.txt checks");
  clearRobotsCache();

  // 1a. api.wikimedia.org — must allow the hunter agent on the Core REST paths.
  const searchUrl = `${WIKISOURCE_API_BASE}${PROBE_LANGUAGE}/search/page?q=test&limit=1`;
  const apiDecision = await robotsAllowsUrl(searchUrl, CYCLE_USER_AGENT);
  if (!apiDecision.allowed) {
    fail(
      `api.wikimedia.org now blocks the hunter agent on the Core REST search path.`,
      `robots reason: ${apiDecision.reason}\n` +
        `     Check https://${WIKIMEDIA_API_HOST}/robots.txt and update ` +
        `WIKIMEDIA_API_HOST / WIKISOURCE_API_BASE in server/hunterCycle.ts if the ` +
        `endpoint has moved.`,
    );
  }
  pass(`api.wikimedia.org/core/v1/wikisource/ is robots-allowed for the hunter agent`);

  clearRobotsCache();

  // 1b. wikisource.org/w/ — must remain disallowed (the legacy path we avoid).
  const legacyUrl = "https://wikisource.org/w/api.php?action=query&list=search&srsearch=test";
  const legacyDecision = await robotsAllowsUrl(legacyUrl, CYCLE_USER_AGENT);
  if (legacyDecision.allowed) {
    // Not a fatal failure — the Core REST API is still the right choice — but
    // worth noting: the original reason we moved away may have changed.
    console.warn(
      `  ⚠  wikisource.org/w/ is now robots-allowed. ` +
        `The hunter still uses api.wikimedia.org (the officially supported ` +
        `public endpoint), so no code change is needed. But you may want to ` +
        `re-read https://wikisource.org/robots.txt to understand what changed.`,
    );
  } else {
    pass(`wikisource.org/w/ is robots-disallowed (legacy path correctly avoided)`);
  }

  clearRobotsCache();
}

async function checkSearchEndpoint(): Promise<Record<string, unknown>> {
  section(`Search endpoint — query: "${PROBE_QUERY}", language: ${PROBE_LANGUAGE}`);

  const searchUrl =
    `${WIKISOURCE_API_BASE}${PROBE_LANGUAGE}/search/page` +
    `?limit=1&q=${encodeURIComponent(PROBE_QUERY)}`;

  let doc: Record<string, unknown>;
  try {
    doc = await fetchJson(searchUrl, [WIKIMEDIA_API_HOST], fetch);
  } catch (e) {
    fail(
      `Search request failed — transient network error or endpoint moved.`,
      `URL: ${searchUrl}\nError: ${e instanceof Error ? e.message : String(e)}\n` +
        `Re-run the script before making code changes. If it keeps failing, ` +
        `check https://api.wikimedia.org/core/v1/wikisource/en/search/page?q=Beowulf&limit=1 ` +
        `in a browser.`,
    );
  }

  // Top-level structure: must have a `pages` array.
  if (!Array.isArray(doc.pages)) {
    fail(
      `Search response missing top-level "pages" array.`,
      `Got keys: ${Object.keys(doc).join(", ")}\n` +
        `Update discoverWikisource in server/hunterCycle.ts to read the new ` +
        `response shape and update EXPECTED_SEARCH_FIELDS in this script.`,
    );
  }

  const pages = doc.pages as Record<string, unknown>[];
  if (pages.length === 0) {
    fail(
      `Search returned zero results for "${PROBE_QUERY}".`,
      `The probe query may no longer match any page. Change PROBE_QUERY in ` +
        `this script to a work that exists on English Wikisource.`,
    );
  }

  pass(`pages[] array present with ${pages.length} result(s)`);

  // Per-page fields: id, key, title.
  const firstPage = pages[0];
  for (const field of EXPECTED_SEARCH_FIELDS) {
    if (!(field in firstPage)) {
      fail(
        `Search page result is missing field "${field}".`,
        `Present keys: ${Object.keys(firstPage).join(", ")}\n` +
          `Update the title/key/id reads in discoverWikisource ` +
          `(server/hunterCycle.ts) to use the new field name, and update ` +
          `EXPECTED_SEARCH_FIELDS in this script.`,
      );
    }
    pass(`page.${field} = ${JSON.stringify(firstPage[field])}`);
  }

  return firstPage;
}

async function checkPageEndpoint(firstPage: Record<string, unknown>) {
  section("Page content endpoint");

  const key = String(firstPage.key ?? firstPage.title ?? PROBE_QUERY);
  const pageUrl = `${WIKISOURCE_API_BASE}${PROBE_LANGUAGE}/page/${encodeURIComponent(key)}`;

  let page: Record<string, unknown>;
  try {
    page = await fetchJson(pageUrl, [WIKIMEDIA_API_HOST], fetch);
  } catch (e) {
    fail(
      `Page content request failed — transient network error or endpoint moved.`,
      `URL: ${pageUrl}\nError: ${e instanceof Error ? e.message : String(e)}\n` +
        `Re-run the script before making code changes. If it keeps failing, ` +
        `open the URL in a browser to see what Wikimedia returns now.`,
    );
  }

  for (const field of EXPECTED_PAGE_FIELDS) {
    if (!(field in page)) {
      fail(
        `Page response is missing field "${field}" (the raw wikitext the hunter stores).`,
        `Present keys: ${Object.keys(page).join(", ")}\n` +
          `Find the new wikitext field name and update discoverWikisource / the ` +
          `download path in server/hunterCycle.ts. Update EXPECTED_PAGE_FIELDS ` +
          `in this script to match.`,
      );
    }
  }

  const sourceSnippet = String(page.source ?? "").slice(0, 80).replace(/\n/g, " ");
  pass(`page.source present (${String(page.source ?? "").length} chars): "${sourceSnippet}…"`);
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

async function main() {
  console.log("Wikisource API compatibility check");
  console.log("===================================");
  console.log(`User-Agent : ${CYCLE_USER_AGENT}`);
  console.log(`API host   : ${WIKIMEDIA_API_HOST}`);

  await checkRobots();
  const firstPage = await checkSearchEndpoint();
  await checkPageEndpoint(firstPage);

  console.log("\n✓ All checks passed — Wikisource discovery fields are intact.\n");
}

main().catch((err) => {
  console.error("\nUnexpected error:", err);
  process.exit(1);
});
