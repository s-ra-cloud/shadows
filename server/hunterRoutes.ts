/**
 * REST API for the Source Hunter (rights-aware full-text collector).
 * Thin HTTP layer over the ported library in server/sourceHunter/.
 * All JSON payloads produced by the library keep the original snake_case
 * field names; DB rows use camelCase columns with a `data`/`record` jsonb.
 */
import express from "express";
import type { Express, Request, Response, NextFunction } from "express";
import { promises as fs } from "node:fs";
import * as path from "node:path";
import { eq, desc, inArray, sql } from "drizzle-orm";
import { db, storage } from "./storage";
import { hunterCandidates, hunterRuns, hunterCorpusFiles, hunterBlockers, hunterRightsReviews, hunterScreenVerdicts } from "@shared/schema";
import {
  runHuntingCycle,
  blockerFromRecord,
  CYCLE_USER_AGENT,
  type CycleStore,
  type CycleScope,
} from "./hunterCycle";
import { robotsAllowsUrl } from "./sourceHunter/robots";
import { getHunterRegion } from "@shared/hunterRegions";
import {
  loadDefaultPolicy,
  DATA_DIR,
  planCandidates,
  collectFulltexts,
  verifyCorpus,
  loadFulltextRegistry,
  validateFulltextRegistry,
  validateCandidate,
  validatePolicy,
  fetchPayload,
  runSample,
  promoteLockedFile,
  PlainTextAdapter,
  LegacyJsonlAdapter,
  TeiAdapter,
  OaiDcAdapter,
  IiifAdapter,
  MediaWikiAdapter,
  entityFromMapping,
  type Entity,
  type Candidate,
  type Policy,
  type SourceAdapter,
} from "./sourceHunter/index";
import { FullTextValidationError } from "./sourceHunter/fulltextValidation";
import {
  startExtraction,
  getExtractionJob,
  listRecipes,
  suggestRecipeForFile,
  hasReadable,
  loadProvenance,
  readablePaths,
} from "./sourceHunter/extraction/run";

const CORPUS_ROOT = path.resolve(process.cwd(), "data", "hunter-corpus");

/**
 * SSRF guard for ad-hoc catalog fetches: HTTPS only, and the hostname must
 * not resolve to loopback, private, link-local, or cloud-metadata addresses.
 */
async function assertSafeExternalUrl(rawUrl: string): Promise<URL> {
  const url = new URL(rawUrl);
  if (url.protocol !== "https:") {
    throw new Error("Only https:// URLs are allowed");
  }
  const { lookup } = await import("node:dns/promises");
  const { isIP } = await import("node:net");
  // URL.hostname keeps brackets around IPv6 literals; strip them for isIP.
  const hostname = url.hostname.replace(/^\[|\]$/g, "");
  const addresses = isIP(hostname)
    ? [{ address: hostname }]
    : await lookup(hostname, { all: true });
  for (const { address } of addresses) {
    if (isPrivateAddress(address)) {
      throw new Error("URL resolves to a private or internal address");
    }
  }
  return url;
}

function isPrivateAddress(address: string): boolean {
  const ip = address.replace(/^::ffff:/i, "");
  if (ip.includes(":")) {
    const lower = ip.toLowerCase();
    return (
      lower === "::1" ||
      lower === "::" ||
      lower.startsWith("fe80:") || // link-local
      lower.startsWith("fc") || // unique local fc00::/7
      lower.startsWith("fd")
    );
  }
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n))) return true;
  const [a, b] = parts;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) || // CGNAT
    (a === 169 && b === 254) || // link-local / cloud metadata
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168)
  );
}
const POLICY_OVERRIDE_PATH = path.resolve(process.cwd(), "data", "hunter-policy.json");
const REGISTRY_OVERRIDE_PATH = path.resolve(process.cwd(), "data", "hunter-registry.json");
const REGISTRY_DEFAULT_PATH = path.join(DATA_DIR, "sources", "fulltext-registry.json");

/** Editor-saved registry override if present, otherwise the bundled default. */
async function loadActiveRegistry(): Promise<Record<string, unknown>> {
  try {
    await fs.access(REGISTRY_OVERRIDE_PATH);
    return await loadFulltextRegistry(REGISTRY_OVERRIDE_PATH);
  } catch {
    return await loadFulltextRegistry(REGISTRY_DEFAULT_PATH);
  }
}

async function loadActivePolicy(): Promise<Policy> {
  try {
    const text = await fs.readFile(POLICY_OVERRIDE_PATH, "utf-8");
    return JSON.parse(text) as Policy;
  } catch {
    return await loadDefaultPolicy();
  }
}

function errMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

const ADAPTERS: Record<string, () => SourceAdapter> = {
  plain_text: () => new PlainTextAdapter(),
  legacy_jsonl: () => new LegacyJsonlAdapter(),
  tei: () => new TeiAdapter(),
  oai_dc: () => new OaiDcAdapter(),
  iiif: () => new IiifAdapter(),
  mediawiki: () => new MediaWikiAdapter(),
};

/** Build the entity catalog from the site's own deity database. */
async function loadEntitiesFromDatabase(): Promise<Entity[]> {
  const allNodes = await storage.getNodes();
  const entities: Entity[] = [];
  for (const node of allNodes) {
    try {
      entities.push(
        entityFromMapping({
          name: (node as any).name,
          tradition: (node as any).tradition,
          gender: (node as any).gender,
          alternativeNames: (node as any).alternativeNames,
        }),
      );
    } catch {
      // Skip nodes without a usable name.
    }
  }
  return entities;
}

async function createRun(kind: string): Promise<number> {
  const [row] = await db
    .insert(hunterRuns)
    .values({ kind, status: "running" })
    .returning({ id: hunterRuns.id });
  return row.id;
}

async function finishRun(id: number, ok: boolean, result: unknown, error?: string) {
  await db
    .update(hunterRuns)
    .set({
      status: ok ? "completed" : "failed",
      finishedAt: new Date(),
      result: result ?? null,
      error: error ?? null,
    })
    .where(eq(hunterRuns.id, id));
}

async function loadCandidateRows() {
  return db.select().from(hunterCandidates).orderBy(hunterCandidates.id);
}

function candidateFromRow(row: { data: unknown }): Candidate {
  return row.data as Candidate;
}

/**
 * Idempotent upgrade for databases created before run provenance existed:
 * adds hunter_corpus_files.run_id (FK to hunter_runs) if it is missing.
 */
export async function ensureHunterProvenanceSchema(): Promise<void> {
  await db.execute(sql`
    ALTER TABLE hunter_corpus_files
    ADD COLUMN IF NOT EXISTS run_id integer REFERENCES hunter_runs(id)
  `);
  // Rights-review audit table (editor rights determinations) — created here
  // too so pre-existing databases don't 500 on the review endpoints.
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS hunter_rights_reviews (
      id serial PRIMARY KEY,
      corpus_file_id integer REFERENCES hunter_corpus_files(id),
      work_id text NOT NULL,
      edition_id text NOT NULL,
      decision text NOT NULL,
      determined_status text,
      basis text NOT NULL,
      notes text,
      previous_status text,
      created_at timestamp DEFAULT now() NOT NULL
    )
  `);
}
export function registerHunterRoutes(
  app: Express,
  requireEditor: (req: Request, res: Response, next: NextFunction) => void,
) {
  // Best-effort schema upgrade so pre-provenance databases don't 500.
  ensureHunterProvenanceSchema().catch((e) =>
    console.error("hunter provenance schema upgrade failed:", errMessage(e)),
  );
  // ---- Candidates -------------------------------------------------------
  app.get("/api/hunter/candidates", async (_req, res) => {
    res.json(await loadCandidateRows());
  });

  app.post("/api/hunter/candidates", requireEditor, async (req, res) => {
    try {
      const data = req.body?.data;
      validateCandidate(data);
      const [row] = await db
        .insert(hunterCandidates)
        .values({ workId: String(data.work_id), editionId: String(data.edition_id), data })
        .returning();
      res.json(row);
    } catch (e) {
      res.status(e instanceof FullTextValidationError ? 400 : 500).json({ message: errMessage(e) });
    }
  });

  app.put("/api/hunter/candidates/:id", requireEditor, async (req, res) => {
    try {
      const data = req.body?.data;
      validateCandidate(data);
      const [row] = await db
        .update(hunterCandidates)
        .set({
          workId: String(data.work_id),
          editionId: String(data.edition_id),
          data,
          updatedAt: new Date(),
        })
        .where(eq(hunterCandidates.id, parseInt(String(req.params.id))))
        .returning();
      if (!row) return res.status(404).json({ message: "Candidate not found" });
      res.json(row);
    } catch (e) {
      res.status(e instanceof FullTextValidationError ? 400 : 500).json({ message: errMessage(e) });
    }
  });

  app.delete("/api/hunter/candidates/:id", requireEditor, async (req, res) => {
    await db.delete(hunterCandidates).where(eq(hunterCandidates.id, parseInt(String(req.params.id))));
    res.json({ success: true });
  });

  // ---- Policy -----------------------------------------------------------
  app.get("/api/hunter/policy", async (_req, res) => {
    try {
      res.json(await loadActivePolicy());
    } catch (e) {
      res.status(500).json({ message: errMessage(e) });
    }
  });

  app.put("/api/hunter/policy", requireEditor, async (req, res) => {
    try {
      const policy = req.body as Policy;
      validatePolicy(policy);
      await fs.mkdir(path.dirname(POLICY_OVERRIDE_PATH), { recursive: true });
      await fs.writeFile(POLICY_OVERRIDE_PATH, JSON.stringify(policy, null, 2) + "\n");
      res.json(policy);
    } catch (e) {
      res.status(e instanceof FullTextValidationError ? 400 : 500).json({ message: errMessage(e) });
    }
  });

  // ---- Full-text source registry ----------------------------------------
  app.get("/api/hunter/registry", async (_req, res) => {
    try {
      res.json(await loadActiveRegistry());
    } catch (e) {
      res.status(500).json({ message: errMessage(e) });
    }
  });

  app.put("/api/hunter/registry", requireEditor, async (req, res) => {
    try {
      const registry = req.body as Record<string, unknown>;
      validateFulltextRegistry(registry);
      await fs.mkdir(path.dirname(REGISTRY_OVERRIDE_PATH), { recursive: true });
      await fs.writeFile(REGISTRY_OVERRIDE_PATH, JSON.stringify(registry, null, 2) + "\n");
      res.json(registry);
    } catch (e) {
      // Validation throws plain Errors; treat any failure to validate as a 400.
      const message = errMessage(e);
      const status = e instanceof Error && !("code" in e) ? 400 : 500;
      res.status(status).json({ message });
    }
  });

  // ---- Plan (rights assessment) ----------------------------------------
  app.post("/api/hunter/plan", requireEditor, async (_req, res) => {
    const runId = await createRun("plan");
    try {
      const rows = await loadCandidateRows();
      const policy = await loadActivePolicy();
      validatePolicy(policy);
      const plans = planCandidates(rows.map(candidateFromRow), policy);
      await finishRun(runId, true, { entries: plans });
      res.json({ run: { id: runId, status: "completed" }, entries: plans });
    } catch (e) {
      await finishRun(runId, false, null, errMessage(e));
      res.status(500).json({ message: errMessage(e) });
    }
  });

  app.get("/api/hunter/plan/latest", async (_req, res) => {
    const [run] = await db
      .select()
      .from(hunterRuns)
      .where(eq(hunterRuns.kind, "plan"))
      .orderBy(desc(hunterRuns.id))
      .limit(1);
    if (!run) return res.json({ run: null, entries: [] });
    const entries = (run.result as any)?.entries ?? [];
    res.json({ run, entries });
  });

  // ---- Download ---------------------------------------------------------
  app.post("/api/hunter/download", requireEditor, async (req, res) => {
    const runId = await createRun("download");
    // Long operation: respond immediately, continue in background; the UI
    // polls /api/hunter/runs until this run completes.
    res.json({ run: { id: runId, status: "running" } });
    try {
      const rows = await loadCandidateRows();
      const policy = await loadActivePolicy();
      validatePolicy(policy);
      const registry = await loadActiveRegistry();
      const selectionMode = req.body?.selection_mode === "all" ? "all" : "preferred";
      const records = await collectFulltexts(
        rows.map(candidateFromRow),
        policy,
        registry,
        CORPUS_ROOT,
        { selectionMode },
      );
      // Mirror downloaded files into the corpus table for browsing.
      // Provenance rule: run_id points at the run that actually downloaded
      // the bytes. Freshly downloaded files get this run's id (including
      // re-downloads of an existing path); files that were already present
      // keep their original run_id so history stays accurate.
      await db.transaction(async (tx) => {
        for (const record of records) {
          const file = record.file as Record<string, unknown> | undefined;
          if (!file || !file.relative_path) continue;
          const values = {
            workId: String(record.work_id ?? ""),
            editionId: String(record.edition_id ?? ""),
            language: (record.language as string | undefined) ?? null,
            partition: file.locked ? "locked" : "public",
            path: String(file.relative_path),
            byteCount: Number(file.bytes ?? 0),
            sha256: (file.sha256 as string | undefined) ?? null,
            record,
            runId,
          };
          if (record.download_status === "downloaded") {
            const { path: _path, ...update } = values;
            await tx
              .insert(hunterCorpusFiles)
              .values(values)
              .onConflictDoUpdate({ target: hunterCorpusFiles.path, set: update });
          } else {
            // already_present / metadata_only: never steal provenance.
            await tx.insert(hunterCorpusFiles).values(values).onConflictDoNothing();
          }
        }
      });
      const summary = {
        records: records.length,
        downloaded: records.filter((r) => r.download_status === "downloaded").length,
        already_present: records.filter((r) => r.download_status === "already_present").length,
        metadata_only: records.filter((r) => r.download_status === "metadata_only").length,
        failed: records.filter((r) => r.download_status === "failed").length,
        entries: records,
      };
      await finishRun(runId, true, summary);
    } catch (e) {
      await finishRun(runId, false, null, errMessage(e));
    }
  });

  // ---- Hunting cycles ----------------------------------------------------
  app.post("/api/hunter/cycles", requireEditor, async (req, res) => {
    let query = String(req.body?.query ?? "").trim();
    const regionId = req.body?.region_id ? String(req.body.region_id) : null;
    const region = regionId ? getHunterRegion(regionId) : undefined;
    if (regionId && !region) {
      return res.status(400).json({ message: "Unknown region" });
    }
    // A region-scoped launch may omit the query; the region's seed terms fill in.
    if (!query && region) query = region.terms;
    if (!query) return res.status(400).json({ message: "Provide a search query for the cycle" });
    const limitRaw = Number(req.body?.limit);
    const scope: CycleScope = {
      query,
      limit: Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, 25) : 10,
      useAi: req.body?.use_ai !== false,
      ...(region ? { region: { id: region.id, label: region.label } } : {}),
    };
    const runId = await createRun("cycle");
    // Long operation: respond immediately; the UI polls the run until done.
    res.json({ run: { id: runId, status: "running" } });
    try {
      const policy = await loadActivePolicy();
      validatePolicy(policy);
      const registry = await loadActiveRegistry();
      const store: CycleStore = {
        async existingEditionIds() {
          const rows = await db
            .select({ editionId: hunterCandidates.editionId })
            .from(hunterCandidates);
          return new Set(rows.map((r) => r.editionId));
        },
        async insertCandidate(candidate) {
          await db
            .insert(hunterCandidates)
            .values({
              workId: String(candidate.work_id),
              editionId: String(candidate.edition_id),
              data: candidate,
            })
            .onConflictDoNothing();
        },
        async addBlocker(b) {
          await db.insert(hunterBlockers).values({
            runId,
            sourceId: b.sourceId ?? null,
            url: b.url ?? null,
            reason: b.reason,
            detail: b.detail ?? null,
            workId: b.workId ?? null,
            editionId: b.editionId ?? null,
          });
        },
        async updateProgress(progress) {
          await db
            .update(hunterRuns)
            .set({ result: { progress } })
            .where(eq(hunterRuns.id, runId));
        },
        async getScreenVerdicts(keys) {
          const verdicts = new Map();
          if (keys.length === 0) return verdicts;
          const rows = await db
            .select()
            .from(hunterScreenVerdicts)
            .where(inArray(hunterScreenVerdicts.titleKey, keys));
          for (const row of rows) {
            if (row.classification !== "primary" && row.classification !== "secondary") continue;
            verdicts.set(row.titleKey, {
              classification: row.classification,
              justification: `${row.justification} (cached from a previous cycle)`,
            });
          }
          return verdicts;
        },
        async saveScreenVerdicts(entries) {
          for (const entry of entries) {
            await db
              .insert(hunterScreenVerdicts)
              .values({
                titleKey: entry.key,
                title: entry.title,
                classification: entry.verdict.classification,
                justification: entry.verdict.justification,
              })
              .onConflictDoNothing();
          }
        },
        async mirrorCorpusRecords(records) {
          for (const record of records) {
            const file = record.file as Record<string, unknown> | undefined;
            if (!file || !file.relative_path) continue;
            await db
              .insert(hunterCorpusFiles)
              .values({
                workId: String(record.work_id ?? ""),
                editionId: String(record.edition_id ?? ""),
                language: (record.language as string | undefined) ?? null,
                partition: file.locked ? "locked" : "public",
                path: String(file.relative_path),
                byteCount: Number(file.bytes ?? 0),
                sha256: (file.sha256 as string | undefined) ?? null,
                record,
                runId,
              })
              .onConflictDoNothing();
          }
        },
      };
      const summary = await runHuntingCycle({
        scope,
        policy,
        registry,
        corpusRoot: CORPUS_ROOT,
        store,
      });
      await finishRun(runId, true, summary);
    } catch (e) {
      await finishRun(runId, false, null, errMessage(e));
    }
  });

  app.get("/api/hunter/cycles", async (_req, res) => {
    const runs = await db
      .select()
      .from(hunterRuns)
      .where(eq(hunterRuns.kind, "cycle"))
      .orderBy(desc(hunterRuns.id))
      .limit(25);
    // Keep the listing light: drop bulky per-record entries (fetch a single
    // run via /api/hunter/runs/:id for full detail).
    res.json(
      runs.map((run) => {
        const result = run.result as Record<string, unknown> | null;
        if (result && "entries" in result) {
          const { entries, ...rest } = result;
          void entries;
          return { ...run, result: rest };
        }
        return run;
      }),
    );
  });

  // ---- Blocker ledger ----------------------------------------------------
  app.get("/api/hunter/blockers", async (_req, res) => {
    res.json(await db.select().from(hunterBlockers).orderBy(desc(hunterBlockers.id)).limit(500));
  });

  app.patch("/api/hunter/blockers/:id", requireEditor, async (req, res) => {
    const status = String(req.body?.status ?? "");
    if (!["open", "resolved", "dismissed"].includes(status)) {
      return res.status(400).json({ message: "status must be open, resolved or dismissed" });
    }
    const [row] = await db
      .update(hunterBlockers)
      .set({ status, updatedAt: new Date() })
      .where(eq(hunterBlockers.id, parseInt(String(req.params.id))))
      .returning();
    if (!row) return res.status(404).json({ message: "Blocker not found" });
    res.json(row);
  });

  /**
   * Manual rescue for a blocked download: a human downloads the text from the
   * source page themselves and uploads it here. The file goes through the
   * exact same rights pipeline as any other candidate (assessment, public vs
   * locked partitioning), so an upload can never bypass rights review.
   * Body: raw text (text/plain, html or xml). Requires the blocker to carry
   * an edition_id so we know which candidate the text belongs to.
   */
  app.post(
    "/api/hunter/blockers/:id/upload",
    requireEditor,
    express.text({ type: () => true, limit: "25mb" }),
    async (req, res) => {
      try {
        const [blocker] = await db
          .select()
          .from(hunterBlockers)
          .where(eq(hunterBlockers.id, parseInt(String(req.params.id))));
        if (!blocker) return res.status(404).json({ message: "Blocker not found" });
        if (!blocker.editionId) {
          return res.status(400).json({
            message: "This blocker has no candidate attached; add the text via Candidates instead.",
          });
        }
        const text = typeof req.body === "string" ? req.body : "";
        if (!text.trim()) {
          return res.status(400).json({ message: "Upload the text file's content as the request body" });
        }
        const [candidateRow] = await db
          .select()
          .from(hunterCandidates)
          .where(eq(hunterCandidates.editionId, blocker.editionId));
        if (!candidateRow) {
          return res.status(404).json({ message: `No candidate found for ${blocker.editionId}` });
        }
        const original = candidateFromRow(candidateRow) as Record<string, unknown>;

        // Stage the uploaded text as a local file for the rights pipeline.
        const uploadsDir = path.join(DATA_DIR, "hunter-uploads");
        await fs.mkdir(uploadsDir, { recursive: true });
        const format = String(original.format ?? "txt");
        const ext = format === "html" ? "html" : format === "xml" || format === "tei" ? "xml" : "txt";
        const safeName = String(blocker.editionId).replace(/[^a-zA-Z0-9_-]+/g, "-");
        const localPath = path.join(uploadsDir, `${safeName}.${ext}`);
        await fs.writeFile(localPath, text, "utf-8");

        const candidate = {
          ...original,
          source_id: "source:local-import",
          local_path: localPath,
          text_url: undefined,
          access: { download_allowed: true, requires_auth: false },
          rights: {
            ...(original.rights as Record<string, unknown> | undefined),
            manual_upload: true,
            manual_upload_from: blocker.url ?? null,
          },
        } as Candidate;

        const policy = await loadActivePolicy();
        validatePolicy(policy);
        const registry = await loadActiveRegistry();
        const records = await collectFulltexts([candidate], policy, registry, CORPUS_ROOT, {
          selectionMode: "all",
        });
        const record = records[0] as Record<string, unknown> | undefined;
        const file = record?.file as Record<string, unknown> | undefined;
        if (!record || !file?.relative_path) {
          const error = (record?.error as string | undefined) ?? "text was not ingested";
          return res.status(422).json({ message: `Upload rejected by the rights pipeline: ${error}` });
        }
        await db
          .insert(hunterCorpusFiles)
          .values({
            workId: String(record.work_id ?? ""),
            editionId: String(record.edition_id ?? ""),
            language: (record.language as string | undefined) ?? null,
            partition: file.locked ? "locked" : "public",
            path: String(file.relative_path),
            byteCount: Number(file.bytes ?? 0),
            sha256: (file.sha256 as string | undefined) ?? null,
            record,
          })
          .onConflictDoNothing();
        const [updated] = await db
          .update(hunterBlockers)
          .set({
            status: "resolved",
            detail: `${blocker.detail ?? ""} — resolved by manual upload (${file.locked ? "locked" : "public"} partition)`.trim(),
            updatedAt: new Date(),
          })
          .where(eq(hunterBlockers.id, blocker.id))
          .returning();
        res.json({ blocker: updated, partition: file.locked ? "locked" : "public", record });
      } catch (e) {
        res.status(500).json({ message: errMessage(e) });
      }
    },
  );

  // Retry a resolved blocker: re-attempt the download for the specific
  // candidate this blocker points at. Success keeps the blocker resolved and
  // mirrors the file into the corpus; failure records a fresh blocker with
  // the new error so the ledger reflects the latest attempt.
  app.post("/api/hunter/blockers/:id/retry", requireEditor, async (req, res) => {
    const id = parseInt(String(req.params.id));
    if (!Number.isInteger(id)) return res.status(400).json({ message: "Invalid blocker id" });
    const [blocker] = await db
      .select()
      .from(hunterBlockers)
      .where(eq(hunterBlockers.id, id))
      .limit(1);
    if (!blocker) return res.status(404).json({ message: "Blocker not found" });

    // Find the candidate to retry: by edition first, then by URL.
    const rows = await loadCandidateRows();
    let candidateRow = blocker.editionId
      ? rows.find((r) => r.editionId === blocker.editionId)
      : undefined;
    if (!candidateRow && blocker.url) {
      candidateRow = rows.find(
        (r) => String((r.data as Record<string, unknown> | null)?.text_url ?? "") === blocker.url,
      );
    }
    if (!candidateRow) {
      return res.status(422).json({
        message:
          "No candidate matches this blocker; re-run a hunting cycle for this source instead.",
      });
    }

    const runId = await createRun("retry");
    try {
      const policy = await loadActivePolicy();
      validatePolicy(policy);
      const registry = await loadActiveRegistry();
      const records = await collectFulltexts(
        [candidateFromRow(candidateRow)],
        policy,
        registry,
        CORPUS_ROOT,
        {
          selectionMode: "all",
          userAgent: CYCLE_USER_AGENT,
          robotsCheck: async (url) => robotsAllowsUrl(url, CYCLE_USER_AGENT),
        },
      );
      const record = records[0] ?? null;
      if (!record) throw new Error("Retry produced no download record");

      // Mirror any downloaded file into the corpus table (same as cycles).
      const file = record.file as Record<string, unknown> | undefined;
      if (file?.relative_path) {
        await db
          .insert(hunterCorpusFiles)
          .values({
            workId: String(record.work_id ?? ""),
            editionId: String(record.edition_id ?? ""),
            language: (record.language as string | undefined) ?? null,
            partition: file.locked ? "locked" : "public",
            path: String(file.relative_path),
            byteCount: Number(file.bytes ?? 0),
            sha256: (file.sha256 as string | undefined) ?? null,
            record,
            runId,
          })
          .onConflictDoNothing();
      }

      const status = String(record.download_status ?? "unknown");
      const newBlocker = blockerFromRecord(record);
      let outcome: "downloaded" | "locked" | "blocked";
      if (newBlocker) {
        // Failure (or rights lock): record a fresh blocker with the new error.
        await db.insert(hunterBlockers).values({
          runId,
          sourceId: newBlocker.sourceId ?? null,
          url: newBlocker.url ?? null,
          reason: newBlocker.reason,
          detail: `Retry of blocker #${blocker.id}: ${newBlocker.detail ?? ""}`.trim(),
          workId: newBlocker.workId ?? null,
          editionId: newBlocker.editionId ?? null,
        });
        outcome = newBlocker.reason === "rights_locked" ? "locked" : "blocked";
      } else {
        outcome = "downloaded";
      }
      // The retried blocker is cleared (kept resolved) either way — the fresh
      // blocker, if any, now carries the current state.
      await db
        .update(hunterBlockers)
        .set({ status: "resolved", updatedAt: new Date() })
        .where(eq(hunterBlockers.id, blocker.id));

      const summary = {
        retried_blocker_id: blocker.id,
        edition_id: candidateRow.editionId,
        download_status: status,
        outcome,
        new_blocker_reason: newBlocker?.reason ?? null,
        entries: records,
      };
      await finishRun(runId, true, summary);
      res.json({ run: { id: runId, status: "completed" }, ...summary });
    } catch (e) {
      const message = errMessage(e);
      await db.insert(hunterBlockers).values({
        runId,
        sourceId: blocker.sourceId,
        url: blocker.url,
        reason: "fetch_failed",
        detail: `Retry of blocker #${blocker.id} failed: ${message}`,
        workId: blocker.workId,
        editionId: blocker.editionId,
      });
      await finishRun(runId, false, null, message);
      res.status(500).json({ message });
    }
  });

  // ---- Corpus -----------------------------------------------------------
  app.get("/api/hunter/corpus", async (_req, res) => {
    const rows = await db.select().from(hunterCorpusFiles).orderBy(hunterCorpusFiles.id);
    res.json(
      await Promise.all(
        rows.map(async (row) => {
          const record = (row.record ?? {}) as Record<string, unknown>;
          const file = (record.file ?? {}) as Record<string, unknown>;
          const rawPath = path.resolve(CORPUS_ROOT, row.path);
          const readable = hasReadable(rawPath) ? await loadProvenance(rawPath) : null;
          return {
            ...row,
            readable,
            suggested_recipe: readable
              ? null
              : await suggestRecipeForFile(rawPath, (file.content_type as string | undefined) ?? null),
          };
        }),
      ),
    );
  });

  // ---- Extraction (raw download → readable Markdown) ---------------------
  // Recipes turn a raw corpus file into a clean Markdown sibling. The raw
  // file is rights evidence and is never modified.
  app.get("/api/hunter/extraction/recipes", (_req, res) => {
    res.json(listRecipes());
  });

  app.post("/api/hunter/corpus/:id/extract", requireEditor, async (req, res) => {
    try {
      const id = parseInt(String(req.params.id));
      if (!Number.isInteger(id)) return res.status(400).json({ message: "Invalid id" });
      const [row] = await db
        .select()
        .from(hunterCorpusFiles)
        .where(eq(hunterCorpusFiles.id, id))
        .limit(1);
      if (!row) return res.status(404).json({ message: "Corpus file not found" });
      const record = (row.record ?? {}) as Record<string, unknown>;
      const file = (record.file ?? {}) as Record<string, unknown>;
      const rawPath = path.resolve(CORPUS_ROOT, row.path);
      const rel = path.relative(CORPUS_ROOT, rawPath);
      if (rel.startsWith("..") || path.isAbsolute(rel)) {
        return res.status(400).json({ message: "Invalid corpus path" });
      }
      const sourceReference = (record.source_reference as string | undefined) ?? null;
      const job = await startExtraction({
        corpusFileId: id,
        rawAbsolutePath: rawPath,
        recipeId: req.body?.recipe_id ? String(req.body.recipe_id) : null,
        contentType: (file.content_type as string | undefined) ?? null,
        sourceUrl: sourceReference && /^https:\/\//.test(sourceReference) ? sourceReference : null,
        title: (record.title as string | undefined) ?? null,
        locked: row.partition === "locked",
      });
      res.json(job);
    } catch (e) {
      res.status(422).json({ message: errMessage(e) });
    }
  });

  app.get("/api/hunter/corpus/:id/extract/status", requireEditor, (req, res) => {
    const id = parseInt(String(req.params.id));
    if (!Number.isInteger(id)) return res.status(400).json({ message: "Invalid id" });
    const job = getExtractionJob(id);
    if (!job) return res.status(404).json({ message: "No extraction has been started for this file" });
    res.json(job);
  });

  // Readable Markdown for any corpus file (editors only — covers locked too).
  app.get("/api/hunter/corpus/:id/readable", requireEditor, async (req, res) => {
    try {
      const id = parseInt(String(req.params.id));
      if (!Number.isInteger(id)) return res.status(400).json({ message: "Invalid id" });
      const [row] = await db
        .select()
        .from(hunterCorpusFiles)
        .where(eq(hunterCorpusFiles.id, id))
        .limit(1);
      if (!row) return res.status(404).json({ message: "Corpus file not found" });
      const rawPath = path.resolve(CORPUS_ROOT, row.path);
      if (!hasReadable(rawPath)) {
        return res.status(404).json({ message: "No readable version has been extracted yet" });
      }
      const markdown = await fs.readFile(readablePaths(rawPath).markdown, "utf-8");
      res.json({ id: row.id, markdown, provenance: await loadProvenance(rawPath) });
    } catch (e) {
      res.status(500).json({ message: errMessage(e) });
    }
  });

  // ---- Rights review (locked → public) -----------------------------------
  // Editors inspect a corpus file's rights assessment before deciding.
  // Unverified AI claims (ai_claimed_*) are surfaced separately as hints only.
  app.get("/api/hunter/corpus/:id/rights", requireEditor, async (req, res) => {
    try {
      const id = parseInt(String(req.params.id));
      if (!Number.isInteger(id)) return res.status(400).json({ message: "Invalid id" });
      const [row] = await db
        .select()
        .from(hunterCorpusFiles)
        .where(eq(hunterCorpusFiles.id, id))
        .limit(1);
      if (!row) return res.status(404).json({ message: "Corpus file not found" });
      const record = (row.record ?? {}) as Record<string, unknown>;
      const rights = (record.rights ?? {}) as Record<string, unknown>;
      const reviews = await db
        .select()
        .from(hunterRightsReviews)
        .where(eq(hunterRightsReviews.corpusFileId, id))
        .orderBy(desc(hunterRightsReviews.id));
      // Pull unverified AI claims out of the candidate rights evidence so the
      // UI can show them as hints, clearly separated from real evidence.
      let aiClaims: Record<string, unknown> | null = null;
      const candidateRows = await db
        .select()
        .from(hunterCandidates)
        .where(eq(hunterCandidates.editionId, row.editionId))
        .limit(1);
      const candidateRights =
        ((candidateRows[0]?.data as Record<string, unknown> | undefined)?.rights ?? null) as
          | Record<string, unknown>
          | null;
      if (candidateRights && (candidateRights.ai_claimed_statement || candidateRights.ai_claimed_license_url)) {
        aiClaims = {
          statement: candidateRights.ai_claimed_statement ?? null,
          license_url: candidateRights.ai_claimed_license_url ?? null,
        };
      }
      res.json({
        id: row.id,
        workId: row.workId,
        editionId: row.editionId,
        partition: row.partition,
        title: (record.title as string | undefined) ?? row.editionId,
        author: (record.author as string | undefined) ?? null,
        sourceReference: (record.source_reference as string | undefined) ?? null,
        rights,
        aiClaims,
        reviews,
      });
    } catch (e) {
      res.status(500).json({ message: errMessage(e) });
    }
  });

  // Record a manual rights determination. `approve_public` promotes the file
  // out of the locked partition; `keep_locked` only records the audit entry.
  app.post("/api/hunter/corpus/:id/review", requireEditor, async (req, res) => {
    try {
      const id = parseInt(String(req.params.id));
      if (!Number.isInteger(id)) return res.status(400).json({ message: "Invalid id" });
      const decision = String(req.body?.decision ?? "");
      if (!["approve_public", "keep_locked"].includes(decision)) {
        return res.status(400).json({ message: "decision must be approve_public or keep_locked" });
      }
      const basis = String(req.body?.basis ?? "").trim();
      if (!basis) {
        return res.status(400).json({ message: "A basis for the determination is required" });
      }
      const notes = req.body?.notes ? String(req.body.notes) : null;
      const determinedStatus = String(req.body?.status ?? "public_domain");
      if (decision === "approve_public" && !["public_domain", "open_license"].includes(determinedStatus)) {
        return res.status(400).json({ message: "status must be public_domain or open_license" });
      }

      const [row] = await db
        .select()
        .from(hunterCorpusFiles)
        .where(eq(hunterCorpusFiles.id, id))
        .limit(1);
      if (!row) return res.status(404).json({ message: "Corpus file not found" });
      if (row.partition !== "locked") {
        return res.status(400).json({ message: "Only locked files can be reviewed" });
      }
      const record = (row.record ?? {}) as Record<string, unknown>;
      const previousStatus =
        (((record.rights ?? {}) as Record<string, unknown>).status as string | undefined) ?? null;

      if (decision === "approve_public") {
        // Move the file public on disk first; only persist DB changes if that
        // succeeds so the corpus table never claims a public file that is
        // still locked on disk.
        const updatedRecord = await promoteLockedFile(CORPUS_ROOT, record, {
          status: determinedStatus as "public_domain" | "open_license",
          basis,
          notes,
        });
        const newFile = updatedRecord.file as Record<string, unknown>;
        await db.transaction(async (tx) => {
          await tx
            .update(hunterCorpusFiles)
            .set({
              partition: "public",
              path: String(newFile.relative_path),
              record: updatedRecord,
            })
            .where(eq(hunterCorpusFiles.id, id));
          await tx.insert(hunterRightsReviews).values({
            corpusFileId: id,
            workId: row.workId,
            editionId: row.editionId,
            decision,
            determinedStatus,
            basis,
            notes,
            previousStatus,
          });
        });
        return res.json({ success: true, partition: "public" });
      }

      await db.insert(hunterRightsReviews).values({
        corpusFileId: id,
        workId: row.workId,
        editionId: row.editionId,
        decision,
        determinedStatus: null,
        basis,
        notes,
        previousStatus,
      });
      res.json({ success: true, partition: "locked" });
    } catch (e) {
      res.status(500).json({ message: errMessage(e) });
    }
  });

  // ---- Library (public corpus reading) ----------------------------------
  // Lists only public-partition files; locked material is never exposed.
  app.get("/api/hunter/library", async (_req, res) => {
    const rows = await db
      .select()
      .from(hunterCorpusFiles)
      .where(eq(hunterCorpusFiles.partition, "public"))
      .orderBy(hunterCorpusFiles.id);
    res.json(
      rows.map((row) => {
        const record = (row.record ?? {}) as Record<string, unknown>;
        return {
          id: row.id,
          workId: row.workId,
          editionId: row.editionId,
          language: row.language,
          byteCount: row.byteCount,
          title: (record.title as string | undefined) ?? row.editionId,
          author: (record.author as string | undefined) ?? null,
          translator: (record.translator as string | undefined) ?? null,
          format: (record.format as string | undefined) ?? null,
        };
      }),
    );
  });

  app.get("/api/hunter/library/:id/text", async (req, res) => {
    try {
      const id = parseInt(String(req.params.id));
      if (!Number.isInteger(id)) return res.status(400).json({ message: "Invalid id" });
      const [row] = await db
        .select()
        .from(hunterCorpusFiles)
        .where(eq(hunterCorpusFiles.id, id))
        .limit(1);
      if (!row || row.partition !== "public") {
        return res.status(404).json({ message: "Text not found" });
      }
      const record = (row.record ?? {}) as Record<string, unknown>;
      const file = (record.file ?? {}) as Record<string, unknown>;
      if (file.locked === true) {
        return res.status(404).json({ message: "Text not found" });
      }
      // Path-traversal guard: resolved path must stay inside the public partition.
      const publicRoot = path.join(CORPUS_ROOT, "public");
      const resolved = path.resolve(CORPUS_ROOT, row.path);
      const rel = path.relative(publicRoot, resolved);
      if (rel === "" || rel.startsWith("..") || path.isAbsolute(rel)) {
        return res.status(404).json({ message: "Text not found" });
      }
      const text = await fs.readFile(resolved, "utf-8").catch(() => null);
      if (text === null) return res.status(404).json({ message: "Text not found" });
      // Prefer the extracted readable Markdown when one exists; the raw
      // download stays available as a fallback.
      const markdown = hasReadable(resolved)
        ? await fs.readFile(readablePaths(resolved).markdown, "utf-8").catch(() => null)
        : null;
      res.json({
        id: row.id,
        title: (record.title as string | undefined) ?? row.editionId,
        author: (record.author as string | undefined) ?? null,
        translator: (record.translator as string | undefined) ?? null,
        language: row.language,
        text,
        markdown,
      });
    } catch (e) {
      res.status(500).json({ message: errMessage(e) });
    }
  });

  // ---- Verification -----------------------------------------------------
  app.post("/api/hunter/verify", requireEditor, async (_req, res) => {
    const runId = await createRun("verify");
    try {
      let report: Record<string, unknown>;
      try {
        const counts = await verifyCorpus(CORPUS_ROOT);
        report = { ok: true, counts };
      } catch (e) {
        report = { ok: false, problems: [errMessage(e)] };
      }
      await finishRun(runId, true, report);
      res.json({ run: { id: runId, status: "completed" }, report });
    } catch (e) {
      await finishRun(runId, false, null, errMessage(e));
      res.status(500).json({ message: errMessage(e) });
    }
  });

  app.get("/api/hunter/verify/latest", async (_req, res) => {
    const [run] = await db
      .select()
      .from(hunterRuns)
      .where(eq(hunterRuns.kind, "verify"))
      .orderBy(desc(hunterRuns.id))
      .limit(1);
    if (!run) return res.json({ run: null, report: null });
    res.json({ run, report: run.result ?? null });
  });

  // ---- Runs history ------------------------------------------------------
  app.get("/api/hunter/runs", async (_req, res) => {
    const runs = await db.select().from(hunterRuns).orderBy(desc(hunterRuns.id)).limit(50);
    // Keep the payload light: omit bulky results in the listing.
    res.json(
      runs.map(({ result, ...rest }) => ({
        ...rest,
        hasResult: result != null,
      })),
    );
  });

  app.get("/api/hunter/runs/:id", async (req, res) => {
    const [run] = await db
      .select()
      .from(hunterRuns)
      .where(eq(hunterRuns.id, parseInt(String(req.params.id))))
      .limit(1);
    if (!run) return res.status(404).json({ message: "Run not found" });
    // Provenance: the corpus files this run produced and the blockers it hit.
    const files = await db
      .select({
        id: hunterCorpusFiles.id,
        workId: hunterCorpusFiles.workId,
        editionId: hunterCorpusFiles.editionId,
        language: hunterCorpusFiles.language,
        partition: hunterCorpusFiles.partition,
        path: hunterCorpusFiles.path,
        byteCount: hunterCorpusFiles.byteCount,
        downloadedAt: hunterCorpusFiles.downloadedAt,
      })
      .from(hunterCorpusFiles)
      .where(eq(hunterCorpusFiles.runId, run.id))
      .orderBy(hunterCorpusFiles.id);
    const blockers = await db
      .select()
      .from(hunterBlockers)
      .where(eq(hunterBlockers.runId, run.id))
      .orderBy(hunterBlockers.id);
    res.json({ ...run, files, blockers });
  });

  // ---- Catalog builder ---------------------------------------------------
  app.post("/api/hunter/catalog", requireEditor, async (req, res) => {
    const runId = await createRun("catalog");
    try {
      const { format, url, payload } = req.body ?? {};
      const makeAdapter = ADAPTERS[String(format)];
      if (!makeAdapter) {
        await finishRun(runId, false, null, `Unknown format: ${format}`);
        return res.status(400).json({ message: `Unknown format: ${format}` });
      }
      let bytes: Buffer;
      if (typeof payload === "string" && payload.trim()) {
        bytes = Buffer.from(payload, "utf-8");
      } else if (typeof url === "string" && url.trim()) {
        const policy = await loadActivePolicy();
        const safeUrl = await assertSafeExternalUrl(url);
        const host = safeUrl.hostname;
        const fetched = await fetchPayload(
          url,
          {
            source_id: "source:adhoc-catalog",
            source_family: format,
            allowed_hosts: [host],
            access: { review_status: "reviewed" },
          },
          { maxBytes: Number(policy.maximum_file_bytes ?? 50_000_000) },
        );
        bytes = fetched.payload;
      } else {
        await finishRun(runId, false, null, "Provide a url or payload");
        return res.status(400).json({ message: "Provide a url or payload" });
      }
      const entities = await loadEntitiesFromDatabase();
      const sourceDef = {
        source_id: "source:adhoc-catalog",
        name: "Ad-hoc catalog build",
        source_family: format,
        endpoint_url: url || "about:blank",
        resource_types: ["text_excerpt", "art_description", "museum_object"],
        defaults: { corpus: "adhoc", origin: "primary_source" },
        access: { review_status: "reviewed" },
      };
      const records = runSample(makeAdapter(), sourceDef, bytes, entities, new Date());
      await finishRun(runId, true, { records: records.length, entries: records });
      res.json({ run: { id: runId, status: "completed" }, records });
    } catch (e) {
      await finishRun(runId, false, null, errMessage(e));
      res.status(500).json({ message: errMessage(e) });
    }
  });
}
