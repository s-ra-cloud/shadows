/**
 * Extraction recipes: reusable converters that turn a raw corpus download
 * into one clean, complete Markdown document.
 *
 * Each recipe handles a "shape" of raw material (HTML index page, single
 * HTML page, PDF, DOCX, OCR transcription...). Recipes are registered in
 * RECIPES; adding a new shape means adding one entry here.
 *
 * Recipes never modify the raw file — the raw bytes are rights evidence.
 */

import { htmlToMarkdown, htmlTitle, extractContentLinks, stripBoilerplate } from "./htmlToMarkdown";
import { cleanupTranscription, looksLikeOcrTranscription } from "./textCleanup";
import { PageFetcher } from "./crawl";
import { ocrPdf } from "./pdfOcr";

export interface ExtractionProgress {
  note: string;
  pagesFetched?: number;
  totalPages?: number;
}

export interface ExtractionContext {
  payload: Buffer;
  contentType: string | null;
  /** URL the raw file was downloaded from (null for local imports). */
  sourceUrl: string | null;
  title: string | null;
  fetchImpl?: typeof fetch;
  reportProgress: (progress: ExtractionProgress) => void;
}

export interface ExtractionOutput {
  markdown: string;
  pagesFetched: number;
  warnings: string[];
}

export interface ExtractionRecipe {
  id: string;
  version: string;
  label: string;
  description: string;
  /** Suitability score for a raw file; 0 = not applicable, higher wins. */
  suitability(input: { path: string; contentType: string | null; payload: Buffer }): number;
  run(ctx: ExtractionContext): Promise<ExtractionOutput>;
}

const MINIMUM_DOCUMENT_CHARS = 400;

function isHtml(input: { path: string; contentType: string | null }): boolean {
  return /\.html?$/i.test(input.path) || input.contentType === "text/html";
}

/**
 * Prose length of a page ignoring everything inside links: on an index or
 * chapter-list page nearly all text lives inside <a> elements, so what
 * remains outside them is the real measure of "is there content here".
 */
function nonLinkProseLength(html: string): number {
  return stripBoilerplate(html)
    .replace(/<a\b[^>]*>[\s\S]*?<\/a>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/&[a-z#0-9]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim().length;
}

/**
 * Detect redirect stubs and anti-bot challenge pages served instead of real
 * content (meta-refresh redirects, Cloudflare "Just a moment...", explicit
 * "you are being redirected" stubs).
 */
export function isInterstitialPage(html: string): boolean {
  return (
    /<meta[^>]+http-equiv=["']?refresh/i.test(html) ||
    /<title[^>]*>\s*Just a moment/i.test(html) ||
    /you are being redirected/i.test(html) ||
    /challenges\.cloudflare\.com/i.test(html)
  );
}

/** True when an HTML page is mostly links (a table of contents), not prose. */
export function looksLikeIndexPage(html: string, sourceUrl: string | null): boolean {
  // Without a known source URL (recipe suggestion time) the same-host filter
  // would drop every absolute link (Perseus-style TOCs), so count all hosts.
  const links = extractContentLinks(html, sourceUrl ?? "https://example.invalid/", {
    anyHost: sourceUrl === null,
  });
  if (links.length < 8) return false;
  return nonLinkProseLength(html) / links.length < 220;
}

// ---------------------------------------------------------------------------
// 1. HTML index page → crawl linked pages and compile them in order
// ---------------------------------------------------------------------------

const MAX_PAGES = 1500;

const htmlIndexRecipe: ExtractionRecipe = {
  id: "html-index-crawl",
  version: "1.0.0",
  label: "HTML index page (crawl linked chapters)",
  description:
    "For a table-of-contents page: follows every linked page on the same site (robots-checked, throttled), cleans each one and compiles the chapters into a single Markdown document in order.",
  suitability(input) {
    if (!isHtml(input)) return 0;
    const html = input.payload.toString("utf-8");
    return looksLikeIndexPage(html, null) ? 90 : 20;
  },
  async run(ctx) {
    if (!ctx.sourceUrl) {
      throw new Error("This recipe needs the original download URL to crawl linked pages.");
    }
    const html = ctx.payload.toString("utf-8");
    const fetcher = new PageFetcher({
      allowedHost: new URL(ctx.sourceUrl).hostname,
      fetchImpl: ctx.fetchImpl,
    });
    const warnings: string[] = [];
    const sections: string[] = [];
    let pagesFetched = 0;
    let failures = 0;

    // A crawl must not quietly succeed when failures dominate.
    const failIfDominant = () => {
      const processed = pagesFetched + failures;
      if (failures >= 8 && failures > processed / 3) {
        throw new Error(
          `Too many failed pages (${failures} of ${processed}); aborting instead of producing a fragment. The site may be blocking automated access — try again later.`,
        );
      }
      if (failures > 25 && failures > pagesFetched) {
        throw new Error(`Too many page failures (${failures}); aborting instead of producing a fragment.`);
      }
    };

    interface QueueItem {
      url: string;
      linkText: string;
      depth: number;
    }
    // Stay inside the work: only follow links under the index page's own
    // directory. Site-chrome links (home page, shop, other works) live
    // elsewhere on the host and must not end up in the document.
    const scopeDir = new URL(ctx.sourceUrl).pathname.replace(/[^/]*$/, "");
    const inScope = (url: string): boolean => {
      try {
        return new URL(url).pathname.startsWith(scopeDir);
      } catch {
        return false;
      }
    };
    const queue: QueueItem[] = extractContentLinks(html, ctx.sourceUrl)
      .filter((l) => inScope(l.url))
      .map((l) => ({
        url: l.url,
        linkText: l.text,
        depth: 1,
      }));
    if (queue.length === 0) {
      throw new Error("No linked pages found on the index page.");
    }
    const visited = new Set<string>([ctx.sourceUrl]);
    // Everything ever queued. A sub-index page often carries a breadcrumb
    // link to the *next* sibling (e.g. gen.htm → exo.htm on sacred-texts);
    // re-queueing it as a deeper child would overtake its own pending
    // depth-1 entry and silently flatten a whole book into link text.
    const enqueued = new Set(queue.map((i) => i.url));

    while (queue.length > 0) {
      if (pagesFetched >= MAX_PAGES) {
        warnings.push(`Stopped after the ${MAX_PAGES}-page safety cap; document may be incomplete.`);
        break;
      }
      const item = queue.shift()!;
      if (visited.has(item.url)) continue;
      visited.add(item.url);
      let pageHtml: string;
      try {
        pageHtml = await fetcher.fetchPage(item.url);
      } catch (e) {
        failures += 1;
        warnings.push(`${item.url}: ${e instanceof Error ? e.message : String(e)}`);
        failIfDominant();
        continue;
      }
      if (isInterstitialPage(pageHtml)) {
        // Redirect stubs, shop interstitials, anti-bot challenge pages: not
        // part of the work — skip them without polluting the document.
        failures += 1;
        warnings.push(`${item.url}: skipped a redirect/challenge page served instead of content`);
        failIfDominant();
        continue;
      }
      pagesFetched += 1;
      ctx.reportProgress({
        note: item.linkText || item.url,
        pagesFetched,
        totalPages: Math.min(pagesFetched + queue.length, MAX_PAGES),
      });
      const markdown = htmlToMarkdown(pageHtml);
      const allLinks = extractContentLinks(pageHtml, item.url);
      const proseLength = nonLinkProseLength(pageHtml);
      if (!markdown.trim() && allLinks.length === 0) {
        // Empty page served instead of the content: treat as a failure so a
        // blocked crawl aborts instead of silently producing a fragment.
        failures += 1;
        pagesFetched -= 1;
        warnings.push(`${item.url}: page returned no content (possibly blocked by the site)`);
        failIfDominant();
        continue;
      }
      const childLinks = allLinks.filter(
        (l) => inScope(l.url) && !visited.has(l.url) && !enqueued.has(l.url),
      );
      if (item.depth === 1 && proseLength < 600 && childLinks.length >= 5) {
        // The linked page is itself an index (e.g. a book page listing its
        // chapters): descend one more level, keeping document order.
        const heading = htmlTitle(pageHtml) ?? item.linkText;
        if (heading) sections.push(`# ${heading}`);
        for (const l of childLinks) enqueued.add(l.url);
        queue.unshift(...childLinks.map((l) => ({ url: l.url, linkText: l.text, depth: 2 })));
        continue;
      }
      if (item.depth >= 2 && proseLength < 600 && childLinks.length >= 5) {
        // An index page deeper than the crawl descends: compiling just its
        // link texts would silently drop everything it points at. Count it
        // as a failure so a structure we don't handle aborts loudly.
        failures += 1;
        pagesFetched -= 1;
        warnings.push(
          `${item.url}: linked page is itself an index nested deeper than the crawl follows; its chapters were NOT included`,
        );
        failIfDominant();
        continue;
      }
      if (!markdown.trim()) continue;
      const heading = htmlTitle(pageHtml) ?? item.linkText;
      sections.push(heading && !markdown.startsWith("#") ? `## ${heading}\n\n${markdown}` : markdown);
    }

    const body = sections.join("\n\n---\n\n").trim();
    if (body.replace(/\s+/g, " ").length < MINIMUM_DOCUMENT_CHARS) {
      throw new Error("Crawl produced almost no text; the linked pages may not contain the work.");
    }
    const title = ctx.title ?? htmlTitle(html);
    return {
      markdown: (title ? `# ${title}\n\n` : "") + body,
      pagesFetched,
      warnings,
    };
  },
};

// ---------------------------------------------------------------------------
// 2. Single HTML page → Markdown
// ---------------------------------------------------------------------------

const htmlSingleRecipe: ExtractionRecipe = {
  id: "html-single-page",
  version: "1.0.0",
  label: "Single HTML page",
  description: "Strips HTML markup, navigation and boilerplate from one page and converts the content to Markdown.",
  suitability(input) {
    if (!isHtml(input)) return 0;
    const html = input.payload.toString("utf-8");
    return looksLikeIndexPage(html, null) ? 30 : 80;
  },
  async run(ctx) {
    const html = ctx.payload.toString("utf-8");
    const markdown = htmlToMarkdown(html);
    if (markdown.replace(/\s+/g, " ").length < MINIMUM_DOCUMENT_CHARS) {
      throw new Error(
        "The page contains almost no text — it may be an index of links; try the index-crawl recipe.",
      );
    }
    const title = ctx.title ?? htmlTitle(html);
    return {
      markdown: title && !markdown.startsWith("#") ? `# ${title}\n\n${markdown}` : markdown,
      pagesFetched: 0,
      warnings: [],
    };
  },
};

// ---------------------------------------------------------------------------
// 3. PDF (text layer) → Markdown
// ---------------------------------------------------------------------------

function isPdf(input: { path: string; contentType: string | null; payload: Buffer }): boolean {
  return (
    /\.pdf$/i.test(input.path) ||
    input.contentType === "application/pdf" ||
    input.payload.subarray(0, 5).toString("latin1") === "%PDF-"
  );
}

/** Embedded text layer of a PDF, trimmed ("" when there is none). */
async function pdfTextLayer(payload: Buffer): Promise<string> {
  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({ data: new Uint8Array(payload) });
  try {
    const result = await parser.getText();
    return (result.text ?? "").trim();
  } finally {
    await parser.destroy?.().catch(() => {});
  }
}

/** OCR every page of a scanned PDF, reporting per-page progress. */
async function runPdfOcr(ctx: ExtractionContext, extraWarnings: string[] = []) {
  const { text, warnings } = await ocrPdf(ctx.payload, ({ page, totalPages }) => {
    ctx.reportProgress({
      note: `OCR page ${page} of ${totalPages}`,
      pagesFetched: page,
      totalPages,
    });
  });
  const markdown = cleanupTranscription(text);
  if (markdown.replace(/\s+/g, " ").length < MINIMUM_DOCUMENT_CHARS) {
    throw new Error("OCR produced almost no text — the scan may be too poor to read.");
  }
  return {
    markdown: ctx.title ? `# ${ctx.title}\n\n${markdown}` : markdown,
    pagesFetched: 0,
    warnings: [...extraWarnings, ...warnings],
  };
}

const pdfRecipe: ExtractionRecipe = {
  id: "pdf-text",
  version: "1.1.0",
  label: "PDF (text layer, OCR fallback)",
  description: "Extracts the embedded text layer from a PDF and reflows it into Markdown paragraphs. When the PDF is a scan with little or no text layer, it falls back to OCR (tesseract) page by page.",
  suitability(input) {
    if (/\.pdf$/i.test(input.path) || input.contentType === "application/pdf") return 90;
    return input.payload.subarray(0, 5).toString("latin1") === "%PDF-" ? 80 : 0;
  },
  async run(ctx) {
    const text = await pdfTextLayer(ctx.payload);
    if (text.replace(/\s+/g, " ").length < MINIMUM_DOCUMENT_CHARS) {
      // Image-only scan: fall back to per-page OCR.
      ctx.reportProgress({ note: "No usable text layer — starting OCR" });
      return runPdfOcr(ctx, ["The PDF had no usable text layer; the text was produced by OCR and may contain recognition errors."]);
    }
    const markdown = cleanupTranscription(text);
    return {
      markdown: ctx.title ? `# ${ctx.title}\n\n${markdown}` : markdown,
      pagesFetched: 0,
      warnings: [],
    };
  },
};

// ---------------------------------------------------------------------------
// 3b. Scanned PDF → OCR every page (explicit choice, skips the text layer)
// ---------------------------------------------------------------------------

const pdfOcrRecipe: ExtractionRecipe = {
  id: "pdf-ocr",
  version: "1.0.0",
  label: "PDF (OCR every page)",
  description: "Ignores any embedded text layer and runs OCR (tesseract) on every page of the PDF. Use for scans whose text layer is missing or garbled.",
  suitability(input) {
    // Never auto-suggested over pdf-text; available as an explicit choice.
    return isPdf(input) ? 10 : 0;
  },
  async run(ctx) {
    return runPdfOcr(ctx);
  },
};

// ---------------------------------------------------------------------------
// 4. Word document (.docx) → Markdown
// ---------------------------------------------------------------------------

const docxRecipe: ExtractionRecipe = {
  id: "docx",
  version: "1.0.0",
  label: "Word document (.docx)",
  description: "Converts a .docx Word document to Markdown, keeping headings and paragraphs.",
  suitability(input) {
    if (/\.docx$/i.test(input.path)) return 95;
    return input.contentType ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      ? 95
      : 0;
  },
  async run(ctx) {
    const mammoth = await import("mammoth");
    const result = await mammoth.convertToHtml({ buffer: ctx.payload });
    const markdown = htmlToMarkdown(result.value).trim();
    if (markdown.replace(/\s+/g, " ").length < MINIMUM_DOCUMENT_CHARS) {
      throw new Error("The Word document contains almost no text.");
    }
    return {
      markdown: ctx.title && !markdown.startsWith("#") ? `# ${ctx.title}\n\n${markdown}` : markdown,
      pagesFetched: 0,
      warnings: result.messages.map((m) => m.message),
    };
  },
};

// ---------------------------------------------------------------------------
// 5. Messy plain-text transcription (archive.org OCR) → Markdown
// ---------------------------------------------------------------------------

const ocrCleanupRecipe: ExtractionRecipe = {
  id: "ocr-cleanup",
  version: "1.0.0",
  label: "Messy transcription cleanup",
  description: "Cleans a hard-wrapped OCR transcription (archive.org style): removes page numbers and running headers, repairs hyphenation and rebuilds paragraphs.",
  suitability(input) {
    if (isHtml(input) || /\.(pdf|docx)$/i.test(input.path)) return 0;
    const text = input.payload.toString("utf-8");
    return looksLikeOcrTranscription(text) ? 85 : 25;
  },
  async run(ctx) {
    const markdown = cleanupTranscription(ctx.payload.toString("utf-8"));
    if (markdown.replace(/\s+/g, " ").length < MINIMUM_DOCUMENT_CHARS) {
      throw new Error("The transcription contains almost no text after cleanup.");
    }
    return {
      markdown: ctx.title ? `# ${ctx.title}\n\n${markdown}` : markdown,
      pagesFetched: 0,
      warnings: [],
    };
  },
};

export const RECIPES: ExtractionRecipe[] = [
  htmlIndexRecipe,
  htmlSingleRecipe,
  pdfRecipe,
  pdfOcrRecipe,
  docxRecipe,
  ocrCleanupRecipe,
];

export function getRecipe(id: string): ExtractionRecipe | undefined {
  return RECIPES.find((r) => r.id === id);
}

/** Best recipe suggestion for a raw file, or null when nothing applies. */
export function suggestRecipe(input: {
  path: string;
  contentType: string | null;
  payload: Buffer;
}): ExtractionRecipe | null {
  let best: ExtractionRecipe | null = null;
  let bestScore = 0;
  for (const recipe of RECIPES) {
    let score = 0;
    try {
      score = recipe.suitability(input);
    } catch {
      score = 0;
    }
    if (score > bestScore) {
      best = recipe;
      bestScore = score;
    }
  }
  return best;
}
