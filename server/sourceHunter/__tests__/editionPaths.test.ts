import { describe, expect, it } from "vitest";
import * as path from "node:path";
import { editionPaths, safePathComponent, MAX_PATH_COMPONENT } from "../fulltext";

// The work title that broke benchmark run #31 with ENAMETOOLONG: 200+
// characters copied from an Internet Archive catalogue record.
const LONG_TITLE =
  "the-seven-tablets-of-creation-or-the-babylonian-and-assyrian-legends-concerning-the-creation-of-the-world-and-of-mankind-vol-ii-supplementary-texts-and-a-study-of-the-evolution-of-the-babylonian-cosmogony-1902";

describe("safePathComponent", () => {
  it("returns short slugs unchanged so existing corpus paths keep resolving", () => {
    expect(safePathComponent("hesiod-theogony")).toBe("hesiod-theogony");
    expect(safePathComponent("a".repeat(MAX_PATH_COMPONENT))).toBe("a".repeat(MAX_PATH_COMPONENT));
  });

  it("shortens over-long slugs at a word boundary and keeps them unique", () => {
    const short = safePathComponent(LONG_TITLE);
    expect(short.length).toBeLessThanOrEqual(MAX_PATH_COMPONENT);
    expect(short.startsWith("the-seven-tablets-of-creation")).toBe(true);
    expect(short).toMatch(/-[0-9a-f]{10}$/);
    expect(short).not.toMatch(/--/);
    // A different long title with the same head gets a different hash.
    const sibling = safePathComponent(`${LONG_TITLE}-second-printing`);
    expect(sibling).not.toBe(short);
    expect(sibling.slice(0, 40)).toBe(short.slice(0, 40));
    // Deterministic.
    expect(safePathComponent(LONG_TITLE)).toBe(short);
  });
});

describe("editionPaths", () => {
  it("keeps every path component under the filesystem name limit", () => {
    const candidate = {
      work_id: `work:${LONG_TITLE}`,
      edition_id: `edition:internet-archive-${LONG_TITLE}`,
      format: "pdf",
    };
    const paths = editionPaths("/corpus", candidate, true);
    for (const p of [paths.textPath, paths.rightsPath, paths.lockPath!]) {
      for (const component of p.split(path.sep)) {
        expect(Buffer.byteLength(component)).toBeLessThanOrEqual(255);
      }
    }
    expect(paths.textPath).toMatch(/\/corpus\/locked\/the-seven-tablets-of-creation[^/]*\/internet-archive-the-seven-tablets[^/]*\.pdf$/);
    expect(paths.lockPath).toBe(`${paths.textPath}.LOCK.json`);
  });

  it("is unchanged for ordinary ids", () => {
    const paths = editionPaths("/corpus", { work_id: "work:kojiki", edition_id: "edition:wikisource-en-1", format: "json" }, false);
    expect(paths.textPath).toBe("/corpus/public/kojiki/wikisource-en-1.json");
    expect(paths.rightsPath).toBe("/corpus/rights/kojiki/wikisource-en-1.rights.json");
    expect(paths.lockPath).toBeNull();
  });
});
