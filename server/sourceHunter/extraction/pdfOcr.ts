/**
 * OCR support for scanned-image PDFs: renders each page to an image with
 * pdftoppm (poppler) and reads it with tesseract, reporting per-page
 * progress. Used as the fallback when a PDF has no usable text layer.
 *
 * Pages are OCRed a few at a time (OCR_CONCURRENCY) to cut wall-clock time
 * on big scans; progress is still reported in page order. A caller-supplied
 * AbortSignal cancels the run promptly (in-flight child processes are
 * killed) and the temp directory is always cleaned up.
 *
 * Both binaries are system dependencies; failures are loud, never silent.
 */

import { promises as fs } from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const MAX_OCR_PAGES = 800;
/** 200 dpi grayscale is a good speed/accuracy tradeoff for book scans. */
const OCR_DPI = 200;
/** Pages OCRed at the same time; each one spawns pdftoppm + tesseract. */
const OCR_CONCURRENCY = 3;

export interface OcrProgress {
  page: number;
  totalPages: number;
}

/**
 * ISO 639-1 (and a few common variants) → tesseract traineddata codes.
 * Corpus metadata uses two-letter codes ("en", "de", "el"); tesseract wants
 * its own three-letter codes ("eng", "deu", "ell").
 */
const ISO_TO_TESSERACT: Record<string, string> = {
  en: "eng", de: "deu", el: "ell", fr: "fra", es: "spa", it: "ita",
  la: "lat", he: "heb", ru: "rus", ar: "ara", pt: "por", nl: "nld",
  pl: "pol", sv: "swe", da: "dan", no: "nor", fi: "fin", cs: "ces",
  hu: "hun", tr: "tur", ja: "jpn", zh: "chi_sim", ko: "kor", sa: "san",
  hi: "hin", yi: "yid", uk: "ukr", ro: "ron", bg: "bul", sr: "srp",
  hr: "hrv", ca: "cat", eu: "eus", ga: "gle", cy: "cym", is: "isl",
  lt: "lit", lv: "lav", et: "est", fa: "fas", ur: "urd", ta: "tam",
  te: "tel", bn: "ben", th: "tha", vi: "vie", id: "ind", ms: "msa",
  sw: "swa", am: "amh", ka: "kat", hy: "hye", az: "aze", sq: "sqi",
  mk: "mkd", sl: "slv", sk: "slk", be: "bel", bo: "bod", sy: "syr",
};

/** Thrown when the caller's AbortSignal fires mid-run. */
export class OcrCancelledError extends Error {
  constructor() {
    super("OCR was cancelled.");
    this.name = "OcrCancelledError";
  }
}

function throwIfAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted) throw new OcrCancelledError();
}

/** Number of pages in a PDF, via pdfinfo. */
async function pdfPageCount(pdfPath: string): Promise<number> {
  const { stdout } = await execFileAsync("pdfinfo", [pdfPath]);
  const match = stdout.match(/^Pages:\s+(\d+)/m);
  if (!match) throw new Error("Could not determine the PDF's page count.");
  return parseInt(match[1], 10);
}

/** Render one page to a PNG and read it with tesseract. */
async function ocrOnePage(
  tmpDir: string,
  pdfPath: string,
  page: number,
  signal: AbortSignal | undefined,
  /** Tesseract language code(s), e.g. "grc" or "grc+lat". Null = tesseract default (eng). */
  language: string | null = null,
): Promise<string> {
  // Unique per-page prefix: pages render concurrently in the same directory.
  const imgPrefix = path.join(tmpDir, `page-${page}`);
  try {
    await execFileAsync(
      "pdftoppm",
      [
        "-f", String(page),
        "-l", String(page),
        "-r", String(OCR_DPI),
        "-gray",
        "-png",
        pdfPath,
        imgPrefix,
      ],
      { signal },
    );
    const files = (await fs.readdir(tmpDir)).filter(
      (f) =>
        f.endsWith(".png") &&
        (f.startsWith(`page-${page}-`) || f === `page-${page}.png`),
    );
    if (files.length === 0) throw new Error("page rendering produced no image");
    const imgPath = path.join(tmpDir, files[0]);
    try {
      const { stdout } = await execFileAsync(
        "tesseract",
        [imgPath, "stdout", "--dpi", String(OCR_DPI), ...(language ? ["-l", language] : [])],
        { maxBuffer: 16 * 1024 * 1024, signal },
      );
      return stdout.trim();
    } finally {
      await fs.unlink(imgPath).catch(() => {});
    }
  } catch (e) {
    // execFile surfaces an aborted signal as an AbortError — normalize it so
    // cancellation is never mistaken for a page failure.
    if (signal?.aborted) throw new OcrCancelledError();
    throw e;
  }
}

/**
 * OCR a PDF page by page (OCR_CONCURRENCY pages at a time). Returns the
 * concatenated raw text (one blank line between pages) plus warnings for
 * pages that failed. Progress is reported in page order. Throws
 * OcrCancelledError when the signal aborts.
 */
export async function ocrPdf(
  payload: Buffer,
  reportProgress: (progress: OcrProgress) => void,
  signal?: AbortSignal,
  /** Tesseract language code(s), e.g. "grc" or "grc+lat". Null = tesseract default (eng). */
  language: string | null = null,
): Promise<{ text: string; totalPages: number; warnings: string[] }> {
  throwIfAborted(signal);
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "pdf-ocr-"));
  try {
    const pdfPath = path.join(tmpDir, "input.pdf");
    await fs.writeFile(pdfPath, payload);
    const totalPages = await pdfPageCount(pdfPath);
    if (totalPages < 1) throw new Error("The PDF has no pages.");
    const pages = Math.min(totalPages, MAX_OCR_PAGES);
    const warnings: string[] = [];
    if (totalPages > MAX_OCR_PAGES) {
      warnings.push(
        `PDF has ${totalPages} pages; OCR stopped at the ${MAX_OCR_PAGES}-page safety cap, so the document is incomplete.`,
      );
    }

    const pageTexts: (string | null)[] = new Array(pages).fill(null);
    const pageWarnings: (string | null)[] = new Array(pages).fill(null);
    let failedPages = 0;
    let processedPages = 0;
    let reportedThrough = 0;
    const done = new Set<number>();
    let nextPage = 1;
    let fatal: Error | null = null;

    // Report pages in order even though they finish out of order: advance a
    // contiguous high-water mark over the completed set.
    const reportInOrder = () => {
      while (done.has(reportedThrough + 1)) {
        reportedThrough += 1;
        reportProgress({ page: reportedThrough, totalPages: pages });
      }
    };

    const worker = async () => {
      while (fatal === null) {
        throwIfAborted(signal);
        const page = nextPage;
        if (page > pages) return;
        nextPage += 1;
        try {
          pageTexts[page - 1] = await ocrOnePage(tmpDir, pdfPath, page, signal, language);
        } catch (e) {
          if (e instanceof OcrCancelledError) throw e;
          failedPages += 1;
          pageWarnings[page - 1] =
            `Page ${page}: OCR failed (${e instanceof Error ? e.message : String(e)})`;
          // A run where failures dominate must abort, not produce a fragment.
          if (failedPages >= 5 && failedPages > (processedPages + 1) / 3) {
            fatal = new Error(
              `OCR failed on ${failedPages} of the first ${processedPages + 1} pages; aborting instead of producing a fragment.`,
            );
            throw fatal;
          }
        }
        processedPages += 1;
        done.add(page);
        reportInOrder();
      }
    };

    const workers = Array.from(
      { length: Math.min(OCR_CONCURRENCY, pages) },
      () => worker(),
    );
    try {
      await Promise.all(workers);
    } catch (e) {
      // Let every worker settle before the finally block removes tmpDir.
      await Promise.allSettled(workers);
      throw fatal ?? e;
    }

    for (const w of pageWarnings) if (w !== null) warnings.push(w);
    return {
      text: pageTexts.filter((t): t is string => t !== null).join("\n\n").trim(),
      totalPages: pages,
      warnings,
    };
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }
}

/** Tesseract language packs installed on this machine (cached). */
export async function listOcrLanguages(): Promise<string[]> {
  if (cachedLangs) return cachedLangs;
  const { stdout, stderr } = await execFileAsync("tesseract", ["--list-langs"]);
  const lines = `${stdout}\n${stderr}`
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => /^[a-z]{3}(_[a-z_]+)?$/.test(l) && l !== "osd");
  if (lines.length === 0) throw new Error("tesseract reported no installed languages.");
  cachedLangs = lines.sort();
  return cachedLangs;
}

/**
 * Resolve the tesseract language for an OCR run.
 * - `explicit` (editor's choice, possibly "grc+lat"): every part must be an
 *   installed pack — unknown languages fail loudly, never fall back silently.
 * - Otherwise the work's language metadata is mapped when possible; when it
 *   can't be mapped or isn't installed, returns null (tesseract default, eng).
 */
export async function resolveOcrLanguage(
  explicit: string | null | undefined,
  workLanguage: string | null | undefined,
): Promise<string | null> {
  const installed = new Set(await listOcrLanguages());
  if (explicit) {
    const cleaned = explicit.trim().toLowerCase();
    if (!/^[a-z0-9_+]+$/.test(cleaned)) {
      throw new Error(`Invalid OCR language: ${explicit}`);
    }
    const parts = cleaned.split("+").filter(Boolean);
    if (parts.length === 0) throw new Error(`Invalid OCR language: ${explicit}`);
    const resolved = parts.map((p) => ISO_TO_TESSERACT[p] ?? p);
    const missing = resolved.filter((p) => !installed.has(p));
    if (missing.length > 0) {
      throw new Error(
        `OCR language pack(s) not installed: ${missing.join(", ")}. Pick from the installed tesseract languages.`,
      );
    }
    return resolved.join("+");
  }
  if (workLanguage) {
    const code = workLanguage.trim().toLowerCase();
    const candidate = ISO_TO_TESSERACT[code] ?? (installed.has(code) ? code : null);
    if (candidate && installed.has(candidate)) return candidate;
  }
  return null;
}

let cachedLangs: string[] | null = null;
