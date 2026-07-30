/**
 * OCR support for scanned-image PDFs: renders each page to an image with
 * pdftoppm (poppler) and reads it with tesseract, reporting per-page
 * progress. Used as the fallback when a PDF has no usable text layer.
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

export interface OcrProgress {
  page: number;
  totalPages: number;
}

/** Number of pages in a PDF, via pdfinfo. */
async function pdfPageCount(pdfPath: string): Promise<number> {
  const { stdout } = await execFileAsync("pdfinfo", [pdfPath]);
  const match = stdout.match(/^Pages:\s+(\d+)/m);
  if (!match) throw new Error("Could not determine the PDF's page count.");
  return parseInt(match[1], 10);
}

/**
 * OCR a PDF page by page. Returns the concatenated raw text (one blank line
 * between pages) plus warnings for pages that failed.
 */
export async function ocrPdf(
  payload: Buffer,
  reportProgress: (progress: OcrProgress) => void,
): Promise<{ text: string; totalPages: number; warnings: string[] }> {
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
    const pageTexts: string[] = [];
    let failedPages = 0;
    for (let page = 1; page <= pages; page++) {
      reportProgress({ page, totalPages: pages });
      const imgPrefix = path.join(tmpDir, "page");
      try {
        await execFileAsync("pdftoppm", [
          "-f", String(page),
          "-l", String(page),
          "-r", String(OCR_DPI),
          "-gray",
          "-png",
          pdfPath,
          imgPrefix,
        ]);
        const files = (await fs.readdir(tmpDir)).filter(
          (f) => f.startsWith("page") && f.endsWith(".png"),
        );
        if (files.length === 0) throw new Error("page rendering produced no image");
        const imgPath = path.join(tmpDir, files[0]);
        const { stdout } = await execFileAsync(
          "tesseract",
          [imgPath, "stdout", "--dpi", String(OCR_DPI)],
          { maxBuffer: 16 * 1024 * 1024 },
        );
        pageTexts.push(stdout.trim());
        await fs.unlink(imgPath).catch(() => {});
      } catch (e) {
        failedPages += 1;
        warnings.push(`Page ${page}: OCR failed (${e instanceof Error ? e.message : String(e)})`);
        // A run where failures dominate must abort, not produce a fragment.
        if (failedPages >= 5 && failedPages > page / 3) {
          throw new Error(
            `OCR failed on ${failedPages} of the first ${page} pages; aborting instead of producing a fragment.`,
          );
        }
      }
    }
    return { text: pageTexts.join("\n\n").trim(), totalPages: pages, warnings };
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }
}
