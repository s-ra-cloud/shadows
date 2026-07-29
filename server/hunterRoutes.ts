/**
 * REST API for the Source Hunter (rights-aware full-text collector).
 * Thin HTTP layer over the ported library in server/sourceHunter/.
 * All JSON payloads produced by the library keep the original snake_case
 * field names; DB rows use camelCase columns with a `data`/`record` jsonb.
 */
import type { Express, Request, Response, NextFunction } from "express";
import { promises as fs } from "node:fs";
import * as path from "node:path";
import { eq, desc } from "drizzle-orm";
import { db, storage } from "./storage";
import { hunterCandidates, hunterRuns, hunterCorpusFiles, hunterBlockers } from "@shared/schema";
import { runHuntingCycle, type CycleStore, type CycleScope } from "./hunterCycle";
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

export function registerHunterRoutes(
  app: Express,
  requireEditor: (req: Request, res: Response, next: NextFunction) => void,
) {
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
      // Transactional replace so a mid-write failure can't leave a partial mirror.
      await db.transaction(async (tx) => {
        await tx.delete(hunterCorpusFiles);
        for (const record of records) {
          const file = record.file as Record<string, unknown> | undefined;
          if (!file || !file.relative_path) continue;
          await tx
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

  // ---- Corpus -----------------------------------------------------------
  app.get("/api/hunter/corpus", async (_req, res) => {
    res.json(await db.select().from(hunterCorpusFiles).orderBy(hunterCorpusFiles.id));
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
      res.json({
        id: row.id,
        title: (record.title as string | undefined) ?? row.editionId,
        author: (record.author as string | undefined) ?? null,
        translator: (record.translator as string | undefined) ?? null,
        language: row.language,
        text,
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
    res.json(run);
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
