/**
 * Runs extraction recipes against corpus files and manages the readable
 * Markdown sibling that sits next to (never replaces) the raw download.
 *
 * Storage layout, for a raw file at <corpus>/<partition>/<work>/<edition>.<ext>:
 *   - <raw>.readable.md    — the extracted Markdown document
 *   - <raw>.readable.json  — provenance: recipe id + version, timestamp, report
 *
 * Extractions run as in-process background jobs (an index crawl can take
 * minutes); the jobs map lets the API poll progress.
 */

import { promises as fs } from "node:fs";
import * as fsSync from "node:fs";
import * as path from "node:path";
import { RECIPES, getRecipe, suggestRecipe, type ExtractionProgress } from "./recipes";

export interface ReadableProvenance {
  recipe_id: string;
  recipe_version: string;
  extracted_at: string;
  pages_fetched: number;
  warnings: string[];
  source_url: string | null;
  markdown_bytes: number;
}

export function readablePaths(rawAbsolutePath: string): { markdown: string; provenance: string } {
  return {
    markdown: `${rawAbsolutePath}.readable.md`,
    provenance: `${rawAbsolutePath}.readable.json`,
  };
}

export async function loadProvenance(rawAbsolutePath: string): Promise<ReadableProvenance | null> {
  try {
    const raw = await fs.readFile(readablePaths(rawAbsolutePath).provenance, "utf-8");
    return JSON.parse(raw) as ReadableProvenance;
  } catch {
    return null;
  }
}

export function hasReadable(rawAbsolutePath: string): boolean {
  return fsSync.existsSync(readablePaths(rawAbsolutePath).markdown);
}

export interface ExtractionJob {
  corpusFileId: number;
  recipeId: string;
  status: "running" | "done" | "error";
  startedAt: string;
  progress: ExtractionProgress | null;
  error: string | null;
  provenance: ReadableProvenance | null;
}

const jobs = new Map<number, ExtractionJob>();

export function getExtractionJob(corpusFileId: number): ExtractionJob | null {
  return jobs.get(corpusFileId) ?? null;
}

export interface StartExtractionInput {
  corpusFileId: number;
  rawAbsolutePath: string;
  recipeId?: string | null;
  contentType: string | null;
  sourceUrl: string | null;
  title: string | null;
  locked: boolean;
  fetchImpl?: typeof fetch;
}

/**
 * Start an extraction job. Resolves the recipe (explicit id or suggestion),
 * kicks off the run in the background and returns the initial job state.
 * Throws when a job is already running for this file or no recipe applies.
 */
export async function startExtraction(input: StartExtractionInput): Promise<ExtractionJob> {
  const existing = jobs.get(input.corpusFileId);
  if (existing?.status === "running") {
    throw new Error("An extraction is already running for this file.");
  }
  const payload = await fs.readFile(input.rawAbsolutePath);
  const recipe = input.recipeId
    ? getRecipe(input.recipeId)
    : suggestRecipe({ path: input.rawAbsolutePath, contentType: input.contentType, payload });
  if (!recipe) {
    throw new Error(
      input.recipeId
        ? `Unknown recipe: ${input.recipeId}`
        : "No extraction recipe applies to this file.",
    );
  }
  const job: ExtractionJob = {
    corpusFileId: input.corpusFileId,
    recipeId: recipe.id,
    status: "running",
    startedAt: new Date().toISOString(),
    progress: null,
    error: null,
    provenance: null,
  };
  jobs.set(input.corpusFileId, job);

  void (async () => {
    try {
      const output = await recipe.run({
        payload,
        contentType: input.contentType,
        sourceUrl: input.sourceUrl,
        title: input.title,
        fetchImpl: input.fetchImpl,
        reportProgress: (progress) => {
          job.progress = progress;
        },
      });
      const provenance: ReadableProvenance = {
        recipe_id: recipe.id,
        recipe_version: recipe.version,
        extracted_at: new Date().toISOString(),
        pages_fetched: output.pagesFetched,
        warnings: output.warnings,
        source_url: input.sourceUrl,
        markdown_bytes: Buffer.byteLength(output.markdown, "utf-8"),
      };
      const { markdown, provenance: provenancePath } = readablePaths(input.rawAbsolutePath);
      const mode = input.locked ? 0o600 : 0o644;
      await fs.mkdir(path.dirname(markdown), { recursive: true });
      await fs.writeFile(markdown, output.markdown, { encoding: "utf-8", mode });
      await fs.chmod(markdown, mode);
      await fs.writeFile(provenancePath, JSON.stringify(provenance, null, 2), {
        encoding: "utf-8",
        mode,
      });
      await fs.chmod(provenancePath, mode);
      job.provenance = provenance;
      job.status = "done";
    } catch (e) {
      job.status = "error";
      job.error = e instanceof Error ? e.message : String(e);
    }
  })();

  return job;
}

export function listRecipes() {
  return RECIPES.map((r) => ({
    id: r.id,
    version: r.version,
    label: r.label,
    description: r.description,
  }));
}

/** Suggested recipe id for a raw file already on disk, or null. */
export async function suggestRecipeForFile(
  rawAbsolutePath: string,
  contentType: string | null,
): Promise<string | null> {
  try {
    const payload = await fs.readFile(rawAbsolutePath);
    return suggestRecipe({ path: rawAbsolutePath, contentType, payload })?.id ?? null;
  } catch {
    return null;
  }
}
