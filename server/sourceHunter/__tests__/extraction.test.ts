import { describe, it, expect, beforeEach } from "vitest";
import {
  htmlToMarkdown,
  htmlTitle,
  extractContentLinks,
} from "../extraction/htmlToMarkdown";
import { cleanupTranscription, looksLikeOcrTranscription } from "../extraction/textCleanup";
import { RECIPES, getRecipe, suggestRecipe, looksLikeIndexPage, isInterstitialPage } from "../extraction/recipes";
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

  it("exposes all five recipes", () => {
    expect(RECIPES.map((r) => r.id).sort()).toEqual(
      ["docx", "html-index-crawl", "html-single-page", "ocr-cleanup", "pdf-text"].sort(),
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
