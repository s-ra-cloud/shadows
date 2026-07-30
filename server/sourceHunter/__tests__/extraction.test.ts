import { describe, it, expect, beforeEach } from "vitest";
import {
  htmlToMarkdown,
  htmlTitle,
  extractContentLinks,
} from "../extraction/htmlToMarkdown";
import { cleanupTranscription, looksLikeOcrTranscription } from "../extraction/textCleanup";
import { RECIPES, getRecipe, suggestRecipe, looksLikeIndexPage, isInterstitialPage, ExtractionCancelledError } from "../extraction/recipes";
import { startExtraction, getExtractionJob, cancelExtraction } from "../extraction/run";
import { promises as fs } from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { clearRobotsCache } from "../robots";

function mockFetch(routes: Record<string, string | { status: number; body?: string; location?: string }>) {
  return (async (input: any) => {
    const url = String(input);
    const route = routes[url];
    if (route === undefined) {
      return new Response("not found", { status: 404 });
    }
    if (typeof route === "string") {
      return new Response(route, { status: 200, headers: { "content-type": "text/html" } });
    }
    return new Response(route.body ?? "", {
      status: route.status,
      headers: route.location ? { location: route.location } : {},
    });
  }) as typeof fetch;
}

describe("htmlToMarkdown", () => {
  it("strips scripts, styles and navigation and converts content", () => {
    const html = `<html><head><title>Genesis</title><script>evil()</script></head>
      <body><nav><a href="/x">Menu</a></nav>
      <h1>Genesis 1</h1><p>In the beginning God created the heaven and the earth.</p>
      <footer>Copyright</footer></body></html>`;
    const md = htmlToMarkdown(html);
    expect(md).toContain("# Genesis 1");
    expect(md).toContain("In the beginning");
    expect(md).not.toContain("evil");
    expect(md).not.toContain("Menu");
    expect(md).not.toContain("Copyright");
  });

  it("finds the page title", () => {
    expect(htmlTitle("<title>The Book</title>")).toBe("The Book");
    expect(htmlTitle("<h2>Chapter 3</h2>")).toBe("Chapter 3");
  });
});

describe("extractContentLinks", () => {
  it("keeps same-host content links in order, skipping images and off-host links", () => {
    const html = `
      <a href="gen.htm">Genesis</a>
      <a href="exo.htm">Exodus</a>
      <a href="https://other.example.com/x.htm">External</a>
      <a href="pic.jpg">Image</a>
      <a href="#top">Anchor</a>
      <a href="gen.htm">Genesis again</a>`;
    const links = extractContentLinks(html, "https://sacred-texts.example/bib/kjv/index.htm");
    expect(links.map((l) => l.url)).toEqual([
      "https://sacred-texts.example/bib/kjv/gen.htm",
      "https://sacred-texts.example/bib/kjv/exo.htm",
    ]);
    expect(links[0].text).toBe("Genesis");
  });
});

describe("cleanupTranscription", () => {
  it("removes page numbers, unwraps lines and repairs hyphenation", () => {
    const raw = [
      "the gods assembled in coun-",
      "cil and spoke of the great",
      "deep.",
      "",
      "42",
      "",
      "Then Marduk arose.",
    ].join("\n");
    const cleaned = cleanupTranscription(raw);
    expect(cleaned).toContain("council and spoke of the great deep.");
    expect(cleaned).not.toMatch(/^42$/m);
    expect(cleaned).toContain("Then Marduk arose.");
  });

  it("detects hard-wrapped OCR text", () => {
    const wrapped = Array.from({ length: 60 }, (_, i) => `line ${i} of a hard wrapped transcription without ending`).join("\n");
    expect(looksLikeOcrTranscription(wrapped)).toBe(true);
    expect(looksLikeOcrTranscription("A short clean text.")).toBe(false);
  });
});

describe("recipe suggestion", () => {
  const indexHtml =
    "<html><body>" +
    Array.from({ length: 20 }, (_, i) => `<a href="ch${i}.htm">Chapter ${i}</a>`).join(" ") +
    "</body></html>";
  const proseHtml =
    "<html><body><h1>Text</h1>" +
    `<p>${"In the beginning was the word and the word was long enough to count as prose. ".repeat(30)}</p>` +
    "</body></html>";

  it("suggests the index crawl for link-heavy pages and single-page for prose", () => {
    expect(looksLikeIndexPage(indexHtml, null)).toBe(true);
    expect(looksLikeIndexPage(proseHtml, null)).toBe(false);
    expect(
      suggestRecipe({ path: "a.html", contentType: "text/html", payload: Buffer.from(indexHtml) })?.id,
    ).toBe("html-index-crawl");
    expect(
      suggestRecipe({ path: "a.html", contentType: "text/html", payload: Buffer.from(proseHtml) })?.id,
    ).toBe("html-single-page");
  });

  it("suggests pdf and docx by shape", () => {
    expect(
      suggestRecipe({ path: "a.pdf", contentType: "application/pdf", payload: Buffer.from("%PDF-1.4") })?.id,
    ).toBe("pdf-text");
    expect(
      suggestRecipe({ path: "a.docx", contentType: null, payload: Buffer.from("PK") })?.id,
    ).toBe("docx");
  });

  it("exposes all six recipes", () => {
    expect(RECIPES.map((r) => r.id).sort()).toEqual(
      ["docx", "html-index-crawl", "html-single-page", "ocr-cleanup", "pdf-ocr", "pdf-text"].sort(),
    );
  });
});

describe("isInterstitialPage", () => {
  it("detects redirect stubs and challenge pages but not real content", () => {
    expect(isInterstitialPage('<meta http-equiv="refresh" content="0;url=/shop">')).toBe(true);
    expect(isInterstitialPage("<title>Just a moment...</title>")).toBe(true);
    expect(isInterstitialPage("<p>You are being redirected to the shop.</p>")).toBe(true);
    expect(isInterstitialPage("<h1>Genesis 1</h1><p>In the beginning...</p>")).toBe(false);
  });
});

describe("html-index-crawl recipe", () => {
  beforeEach(() => clearRobotsCache());

  const host = "https://texts.example";
  const chapter = (n: number) =>
    `<html><head><title>Genesis ${n}</title></head><body><p>${`Verse text for chapter ${n}. `.repeat(40)}</p></body></html>`;

  it("crawls a two-level index into one ordered markdown document", async () => {
    // Book pages carry long link texts (regression: link text is plain text
    // after Markdown conversion and must not count as prose when deciding
    // whether to descend into a sub-index).
    const bookPage =
      `<html><head><title>Genesis</title></head><body>` +
      `<a href="gen1.htm">Genesis Chapter 1 — The Creation of the World</a> ` +
      `<a href="gen2.htm">Genesis Chapter 2 — The Garden of Eden</a>` +
      `<a href="gen3.htm">Genesis Chapter 3 — The Fall of Man</a>` +
      `<a href="gen4.htm">Genesis Chapter 4 — Cain and Abel</a>` +
      `<a href="gen5.htm">Genesis Chapter 5 — The Generations of Adam</a></body></html>`;
    const routes: Record<string, string> = {
      [`${host}/robots.txt`]: "",
      // Home-page and shop links are out of the index's directory and must
      // never be crawled; the image must not survive into the document.
      [`${host}/kjv/index.htm`]:
        `<img src="banner.jpg" alt="Buy our DVD-ROM"><a href="/index.htm">Sacred Texts Home</a>` +
        `<a href="/shop/cd.htm">Shop</a><a href="gen.htm">Genesis</a>`,
      [`${host}/kjv/gen.htm`]: bookPage,
    };
    for (let n = 1; n <= 5; n += 1) routes[`${host}/kjv/gen${n}.htm`] = chapter(n);
    // robots.txt is fetched from the origin root.
    const fetchImpl = mockFetch(routes);
    const recipe = getRecipe("html-index-crawl")!;
    const output = await recipe.run({
      payload: Buffer.from(routes[`${host}/kjv/index.htm`]),
      contentType: "text/html",
      sourceUrl: `${host}/kjv/index.htm`,
      title: "The Holy Bible (KJV)",
      fetchImpl,
      reportProgress: () => {},
    });
    expect(output.markdown).toContain("# The Holy Bible (KJV)");
    expect(output.markdown).toContain("# Genesis");
    expect(output.markdown.indexOf("chapter 1")).toBeLessThan(output.markdown.indexOf("chapter 2"));
    expect(output.markdown).toContain("Verse text for chapter 5");
    expect(output.pagesFetched).toBe(6); // book page + 5 chapters; out-of-scope links skipped
    expect(output.markdown).not.toContain("Sacred Texts Home");
    expect(output.markdown).not.toContain("Shop");
    expect(output.markdown).not.toContain("banner.jpg");
  });

  it("does not let 'Next:' nav links on a sub-index swallow the following book (JPS regression)", async () => {
    // sacred-texts JPS structure: each book-index page carries both a
    // "Next: <next book> index »" nav link and a plain breadcrumb link to the
    // next book (just its name). Before the fix, either link re-queued
    // exo.htm as a depth-2 child of gen.htm; it overtook its own pending
    // depth-1 entry, was fetched as a leaf, and Exodus's chapters silently
    // vanished from the document.
    const bookIndex = (book: string, prefix: string, next: [string, string] | null) =>
      `<html><head><title>${book} index</title></head><body>` +
      `<a href="index.htm">Index</a>` +
      (next ? `<a href="${next[0]}.htm">${next[1]}</a>` : "") +
      [1, 2, 3, 4, 5].map((c) => `<a href="${prefix}00${c}.htm">${book} Chapter ${c}</a>`).join(" ") +
      (next ? `<a href="${next[0]}.htm" title="Go to next page">Next: ${next[1]} index &raquo;</a>` : "") +
      `</body></html>`;
    const routes: Record<string, string> = {
      [`${host}/robots.txt`]: "",
      [`${host}/jps/index.htm`]:
        `<a href="gen.htm">Genesis</a><a href="exo.htm">Exodus</a><a href="lev.htm">Leviticus</a>`,
      [`${host}/jps/gen.htm`]: bookIndex("Genesis", "gen", ["exo", "Exodus"]),
      [`${host}/jps/exo.htm`]: bookIndex("Exodus", "exo", ["lev", "Leviticus"]),
      [`${host}/jps/lev.htm`]: bookIndex("Leviticus", "lev", null),
    };
    for (const prefix of ["gen", "exo", "lev"]) {
      for (let c = 1; c <= 5; c += 1) {
        routes[`${host}/jps/${prefix}00${c}.htm`] =
          `<html><head><title>${prefix} ${c}</title></head><body><p>${`Verses of ${prefix} chapter ${c}. `.repeat(40)}</p></body></html>`;
      }
    }
    const recipe = getRecipe("html-index-crawl")!;
    const output = await recipe.run({
      payload: Buffer.from(routes[`${host}/jps/index.htm`]),
      contentType: "text/html",
      sourceUrl: `${host}/jps/index.htm`,
      title: "Tanakh",
      fetchImpl: mockFetch(routes),
      reportProgress: () => {},
    });
    // Every book's chapters are present, in canonical order.
    for (const prefix of ["gen", "exo", "lev"]) {
      for (let c = 1; c <= 5; c += 1) {
        expect(output.markdown).toContain(`Verses of ${prefix} chapter ${c}.`);
      }
    }
    expect(output.markdown.indexOf("gen chapter 5")).toBeLessThan(output.markdown.indexOf("exo chapter 1"));
    expect(output.markdown.indexOf("exo chapter 5")).toBeLessThan(output.markdown.indexOf("lev chapter 1"));
    expect(output.pagesFetched).toBe(18); // 3 book indexes + 15 chapters
    expect(output.warnings).toEqual([]);
  }, 20000);

  it("warns loudly when an index is nested deeper than the crawl follows", async () => {
    const routes: Record<string, string> = {
      [`${host}/robots.txt`]: "",
      [`${host}/w/index.htm`]: `<a href="a.htm">Part A</a>`,
      // Depth-1 sub-index → descend; its children are depth-2 indexes.
      [`${host}/w/a.htm`]:
        [1, 2, 3, 4, 5].map((i) => `<a href="a${i}.htm">Section ${i} of part A</a>`).join(" "),
    };
    for (let i = 1; i <= 5; i += 1) {
      routes[`${host}/w/a${i}.htm`] =
        [1, 2, 3, 4, 5, 6].map((j) => `<a href="a${i}x${j}.htm">Deep chapter ${i}.${j}</a>`).join(" ");
    }
    const recipe = getRecipe("html-index-crawl")!;
    await expect(
      recipe.run({
        payload: Buffer.from(routes[`${host}/w/index.htm`]),
        contentType: "text/html",
        sourceUrl: `${host}/w/index.htm`,
        title: null,
        fetchImpl: mockFetch(routes),
        reportProgress: () => {},
      }),
    ).rejects.toThrow(/aborting|almost no text/);
  });

  it("crawls a Perseus-style index whose links differ only by query string", async () => {
    // Perseus-style structure: every page lives at the same pathname
    // (/hopper/text) and chapters are distinguished purely by ?doc= query
    // parameters. Directory scoping and the visited-set must key on the full
    // URL (including query), or the crawl would collapse to a single page.
    const p = "https://perseus.example/hopper/text";
    const doc = (s: string) => `${p}?doc=Perseus%3Atext%3A1999.01.0133%3A${s}`;
    const card = (book: number, card: number) =>
      `<html><head><title>Theogony, book ${book}, card ${card}</title></head><body>` +
      `<p>${`Muses of Helicon sing, book ${book} card ${card}. `.repeat(40)}</p></body></html>`;
    const routes: Record<string, string> = {
      "https://perseus.example/robots.txt": "",
      [doc("toc")]:
        `<html><head><title>Theogony (Table of Contents)</title></head><body>` +
        `<nav><a href="/hopper/collection?collection=Greco-Roman">Greco-Roman Collection</a></nav>` +
        `<a href="${doc("book%3D1")}">Book 1</a>` +
        `<a href="${doc("book%3D2")}">Book 2</a></body></html>`,
      [doc("book%3D1")]:
        `<html><head><title>Theogony Book 1</title></head><body>` +
        [1, 2, 3, 4, 5].map((c) => `<a href="${doc(`book%3D1%3Acard%3D${c}`)}">Card ${c} of the first book</a>`).join(" ") +
        `</body></html>`,
      [doc("book%3D2")]: card(2, 1).replace("book 2, card 1", "book 2"),
      "https://perseus.example/hopper/collection?collection=Greco-Roman":
        `<html><body><p>Collection browse page that must never be crawled.</p></body></html>`,
    };
    for (let c = 1; c <= 5; c += 1) routes[doc(`book%3D1%3Acard%3D${c}`)] = card(1, c);
    const recipe = getRecipe("html-index-crawl")!;
    const output = await recipe.run({
      payload: Buffer.from(routes[doc("toc")]),
      contentType: "text/html",
      sourceUrl: doc("toc"),
      title: "Theogony",
      fetchImpl: mockFetch(routes),
      reportProgress: () => {},
    });
    expect(output.markdown).toContain("# Theogony");
    // Sub-index descent: book 1 lists its cards, all five cards are compiled in order.
    for (let c = 1; c <= 5; c += 1) expect(output.markdown).toContain(`book 1 card ${c}`);
    expect(output.markdown.indexOf("card 1")).toBeLessThan(output.markdown.indexOf("card 2"));
    expect(output.markdown.indexOf("card 5")).toBeLessThan(output.markdown.indexOf("book 2"));
    // Book 2 is a leaf prose page compiled directly.
    expect(output.markdown).toContain("Muses of Helicon sing, book 2");
    expect(output.pagesFetched).toBe(7); // book1 index + 5 cards + book2
    expect(output.markdown).not.toContain("Collection browse page");
  });

  it("suggests the index crawl for a Perseus-style TOC page", () => {
    const p = "https://perseus.example/hopper/text";
    const toc =
      "<html><body>" +
      Array.from(
        { length: 12 },
        (_, i) => `<a href="${p}?doc=Perseus%3Atext%3A1999.01.0133%3Acard%3D${i}">Card ${i}</a>`,
      ).join(" ") +
      "</body></html>";
    expect(looksLikeIndexPage(toc, p + "?doc=toc")).toBe(true);
    expect(
      suggestRecipe({ path: "text.html", contentType: "text/html", payload: Buffer.from(toc) })?.id,
    ).toBe("html-index-crawl");
  });

  it("refuses to fetch pages disallowed by robots or off the source host", async () => {
    const fetchImpl = mockFetch({
      [`${host}/robots.txt`]: "User-agent: *\nDisallow: /kjv/",
      [`${host}/kjv/index.htm`]: `<a href="gen.htm">Genesis</a>`,
    });
    const recipe = getRecipe("html-index-crawl")!;
    await expect(
      recipe.run({
        payload: Buffer.from(`<a href="gen.htm">Genesis</a>`),
        contentType: "text/html",
        sourceUrl: `${host}/kjv/index.htm`,
        title: null,
        fetchImpl,
        reportProgress: () => {},
      }),
    ).rejects.toThrow();
  });
});

describe("extraction cancellation", () => {
  beforeEach(() => clearRobotsCache());

  it("index crawl throws ExtractionCancelledError when the signal is already aborted", async () => {
    const recipe = getRecipe("html-index-crawl")!;
    const controller = new AbortController();
    controller.abort();
    const index = `<a href="a.htm">A</a><a href="b.htm">B</a><a href="c.htm">C</a>`;
    await expect(
      recipe.run({
        payload: Buffer.from(index),
        contentType: "text/html",
        sourceUrl: "https://texts.example/kjv/index.htm",
        title: null,
        fetchImpl: mockFetch({ "https://texts.example/robots.txt": "" }),
        reportProgress: () => {},
        signal: controller.signal,
      }),
    ).rejects.toThrow(ExtractionCancelledError);
  });

  it("cancelExtraction marks a running job cancelled, not error", async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "extract-cancel-"));
    const host = "https://texts.example";
    const routes: Record<string, string> = { [`${host}/robots.txt`]: "" };
    const index = Array.from({ length: 30 }, (_, i) => `<a href="ch${i + 1}.htm">Chapter ${i + 1}</a>`).join(" ");
    routes[`${host}/kjv/index.htm`] = index;
    for (let i = 1; i <= 30; i += 1) {
      routes[`${host}/kjv/ch${i}.htm`] =
        `<html><head><title>Ch ${i}</title></head><body><p>${"Verse text. ".repeat(60)}</p></body></html>`;
    }
    const base = mockFetch(routes);
    const slowFetch = (async (input: any, init?: any) => {
      await new Promise((r) => setTimeout(r, 30));
      return base(input, init);
    }) as typeof fetch;
    const rawPath = path.join(tmp, "index.htm");
    await fs.writeFile(rawPath, index);
    const job = await startExtraction({
      corpusFileId: 999901,
      rawAbsolutePath: rawPath,
      recipeId: "html-index-crawl",
      contentType: "text/html",
      sourceUrl: `${host}/kjv/index.htm`,
      title: null,
      locked: false,
      fetchImpl: slowFetch,
    });
    expect(job.status).toBe("running");
    await new Promise((r) => setTimeout(r, 80));
    const cancelled = cancelExtraction(999901);
    expect(cancelled?.status).toBe("cancelled");
    // Let the background loop unwind; the status must stay cancelled.
    await new Promise((r) => setTimeout(r, 200));
    const after = getExtractionJob(999901);
    expect(after?.status).toBe("cancelled");
    expect(after?.error).toBeNull();
    // No readable output was written for a cancelled run.
    await expect(fs.access(`${rawPath}.readable.md`)).rejects.toThrow();
    // Cancelling a non-running job is rejected loudly.
    expect(() => cancelExtraction(999901)).toThrow(/not running/);
    await fs.rm(tmp, { recursive: true, force: true });
  });
});

describe("resolveOcrLanguage", () => {
  it("validates explicit choices against installed packs, mapping ISO codes", async () => {
    const { resolveOcrLanguage } = await import("../extraction/pdfOcr");
    expect(await resolveOcrLanguage("grc", null)).toBe("grc");
    expect(await resolveOcrLanguage("el", null)).toBe("ell");
    expect(await resolveOcrLanguage("grc+lat", null)).toBe("grc+lat");
    await expect(resolveOcrLanguage("klingon", null)).rejects.toThrow(/not installed/);
    await expect(resolveOcrLanguage("grc; rm -rf /", null)).rejects.toThrow(/Invalid OCR language/);
  });

  it("auto-picks from work metadata and falls back to null when unmappable", async () => {
    const { resolveOcrLanguage } = await import("../extraction/pdfOcr");
    expect(await resolveOcrLanguage(null, "de")).toBe("deu");
    expect(await resolveOcrLanguage(null, "grc")).toBe("grc");
    expect(await resolveOcrLanguage(null, "xx-unknown")).toBeNull();
    expect(await resolveOcrLanguage(null, null)).toBeNull();
  });
});

describe("startExtraction OCR language wiring", () => {
  it("rejects an invalid explicit OCR language before the job starts", async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "extract-lang-"));
    const rawPath = path.join(tmp, "scan.pdf");
    await fs.writeFile(rawPath, "%PDF-1.4 dummy");
    await expect(
      startExtraction({
        corpusFileId: 999902,
        rawAbsolutePath: rawPath,
        recipeId: "pdf-ocr",
        contentType: "application/pdf",
        sourceUrl: null,
        title: null,
        locked: false,
        ocrLanguage: "klingon",
      }),
    ).rejects.toThrow(/not installed/);
    await fs.rm(tmp, { recursive: true, force: true });
  });
});
