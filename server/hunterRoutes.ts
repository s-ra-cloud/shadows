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
import { and, eq, desc, inArray, isNull, like, lt, sql } from "drizzle-orm";
import { db, storage } from "./storage";
import { hunterCandidates, hunterRuns, hunterCorpusFiles, hunterBlockers, hunterRightsReviews, hunterScreenVerdicts } from "@shared/schema";
import {
  runHuntingCycle,
  blockerFromRecord,
  CYCLE_USER_AGENT,
  type CycleStore,
  type CycleScope,
} from "./hunterCycle";
import { runCorpusListCycle } from "./hunterCorpusCycle";
import * as http from "node:http";
import * as https from "node:https";
import type { IncomingMessage } from "node:http";
import { lookup as dnsLookup } from "node:dns/promises";
import { isIP } from "node:net";

/** Upload cap for corpus LISTS (indexes of titles/URLs, never full texts). */
const MAX_CORPUS_LIST_BYTES = 512 * 1024;
import { parseCorpusList, CorpusListParseError } from "./hunterCorpusList";
import { cleanErrorText, truncateText, MAX_ERROR_TEXT } from "./errorText";
import { robotsAllowsUrl } from "./sourceHunter/robots";
import { INTERNET_ARCHIVE_SOURCE_ID, repairArchiveDownload } from "./sourceHunter/archiveRepair";
import { isArchiveUrl } from "./sourceHunter/archiveResolver";
import { getHunterRegion } from "@shared/hunterRegions";
import { inferRegion } from "@shared/regionInference";
import { traditionForWork, chronologyForWork, familyForTradition } from "@shared/traditions";
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
  listExtractionJobs,
  cancelExtraction,
  recoverInterruptedJobs,
  listRecipes,
  suggestRecipeForFile,
  hasReadable,
  loadProvenance,
  readablePaths,
} from "./sourceHunter/extraction/run";
import { listOcrLanguages } from "./sourceHunter/extraction/pdfOcr";

const CORPUS_ROOT = path.resolve(process.cwd(), "data", "hunter-corpus");

/**
 * Run IDs of corpus-list cycles that are currently executing.
 * Used by the stop endpoint to reject stop requests aimed at non-corpus runs.
 */
const activeCorpusRunIds = new Set<number>();

/**
 * Run IDs for corpus-list cycles that an editor has requested to stop.
 * The cycle loop checks this set before each item and exits early when its
 * run ID is present, recording remaining items as "skipped".
 */
const corpusStopRequests = new Set<number>();

/**
 * Normalized retry-list names that are currently being processed.
 * Added BEFORE any await in the retry handler so that two concurrent
 * requests for the same parent run on the same event-loop tick both hit
 * the same synchronous check — no race window.
 */
const activeRetryNames = new Set<string>();

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
  // Strip surrounding brackets (e.g. from URL.hostname for IPv6 literals).
  let ip = address.replace(/^\[|\]$/g, "");

  // Normalize IPv4-mapped / IPv4-compatible IPv6 addresses to dotted-decimal
  // before classification, so every form is caught by the IPv4 checks below.
  //
  // Case 1 — dotted-decimal mapped: ::ffff:127.0.0.1 or ::127.0.0.1
  ip = ip.replace(/^::(?:ffff:)?(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/i, "$1");
  // Case 2 — two hex groups: ::ffff:7f00:1 (= 127.0.0.1) or ::0a00:0001 (= 10.0.0.1)
  //   Node.js skips the custom lookup option for IP literals, so a URL like
  //   http://[::ffff:7f00:1]/ would bypass safeLookup without this preflight fix.
  const hexMapped = ip.match(/^::(?:ffff:)?([0-9a-f]{1,4}):([0-9a-f]{1,4})$/i);
  if (hexMapped) {
    const hi = parseInt(hexMapped[1], 16);
    const lo = parseInt(hexMapped[2], 16);
    ip = `${(hi >> 8) & 0xff}.${hi & 0xff}.${(lo >> 8) & 0xff}.${lo & 0xff}`;
  }

  if (ip.includes(":")) {
    // Pure IPv6 — block all non-global-unicast ranges.
    const lower = ip.toLowerCase();
    // Parse the first 16-bit group to test prefix-based ranges.
    const firstGroupHex = (lower.split(":")[0] || "0").padStart(4, "0");
    const first16 = parseInt(firstGroupHex, 16);
    return (
      lower === "::1" || // ::1/128 — loopback
      lower === "::" || // ::/128 — unspecified
      // fe80::/10 — link-local (fe80:: through febf::, i.e. first 10 bits = 1111111010)
      (first16 >= 0xfe80 && first16 <= 0xfebf) ||
      // fc00::/7 — unique local (fc:: and fd::)
      lower.startsWith("fc") ||
      lower.startsWith("fd") ||
      // ff00::/8 — multicast
      lower.startsWith("ff") ||
      // fec0::/10 — deprecated site-local (fec0:: through feff::)
      (first16 >= 0xfec0 && first16 <= 0xfeff) ||
      // 100::/64 — IETF protocol discard prefix
      lower.startsWith("100:")
    );
  }

  // IPv4 — cover all IANA special-use ranges (RFC 6890 and successors).
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n) || n < 0 || n > 255)) return true;
  const [a, b, c] = parts;
  return (
    a === 0 || // 0.0.0.0/8 — "this" network
    a === 10 || // 10.0.0.0/8 — RFC 1918
    a === 127 || // 127.0.0.0/8 — loopback
    a >= 240 || // 240.0.0.0/4 — reserved; covers 255.255.255.255 too
    (a === 100 && b >= 64 && b <= 127) || // 100.64.0.0/10 — CGNAT
    (a === 169 && b === 254) || // 169.254.0.0/16 — link-local / cloud metadata
    (a === 172 && b >= 16 && b <= 31) || // 172.16.0.0/12 — RFC 1918
    (a === 192 && b === 0 && c === 0) || // 192.0.0.0/24 — IETF protocol assignments
    (a === 192 && b === 0 && c === 2) || // 192.0.2.0/24 — TEST-NET-1
    (a === 192 && b === 168) || // 192.168.0.0/16 — RFC 1918
    (a === 198 && b >= 18 && b <= 19) || // 198.18.0.0/15 — benchmarking
    (a === 198 && b === 51 && c === 100) || // 198.51.100.0/24 — TEST-NET-2
    (a === 203 && b === 0 && c === 113) // 203.0.113.0/24 — TEST-NET-3
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

/**
 * Human-readable text for a caught exception: driver noise stripped, cause
 * chain reduced to the actionable innermost message, length capped.
 * Everything that reaches an editor (HTTP error bodies, stored run errors,
 * blocker details) goes through this.
 */
function errMessage(e: unknown): string {
  return cleanErrorText(e);
}

/**
 * After a run downloads new files, queue readable extraction automatically
 * using each file's suggested recipe. Extraction runs as the existing
 * background jobs (pollable via /api/hunter/corpus/:id/extract/status), so
 * long crawls never block the run. Failures to queue are reported in the run
 * summary instead of throwing. Raw files are never modified — extraction only
 * writes the .readable.md/.readable.json siblings.
 */
export interface AutoExtractionSummary {
  queued: number;
  skipped: number;
  failed: { edition_id: string; error: string }[];
}

export async function autoExtractDownloaded(
  records: Record<string, unknown>[],
): Promise<AutoExtractionSummary> {
  const summary: AutoExtractionSummary = { queued: 0, skipped: 0, failed: [] };
  for (const record of records) {
    if (record.download_status !== "downloaded") continue;
    const file = record.file as Record<string, unknown> | undefined;
    if (!file?.relative_path) continue;
    const editionId = String(record.edition_id ?? file.relative_path);
    try {
      const rawPath = path.resolve(CORPUS_ROOT, String(file.relative_path));
      const rel = path.relative(CORPUS_ROOT, rawPath);
      if (rel.startsWith("..") || path.isAbsolute(rel)) {
        summary.failed.push({ edition_id: editionId, error: "Invalid corpus path" });
        continue;
      }
      // Freshly re-downloaded files may already have a readable sibling from
      // a previous extraction — leave it alone.
      if (hasReadable(rawPath)) {
        summary.skipped += 1;
        continue;
      }
      const [row] = await db
        .select()
        .from(hunterCorpusFiles)
        .where(eq(hunterCorpusFiles.path, String(file.relative_path)))
        .limit(1);
      if (!row) {
        summary.failed.push({ edition_id: editionId, error: "File not found in corpus table" });
        continue;
      }
      const existingJob = getExtractionJob(row.id);
      if (existingJob?.status === "running") {
        summary.skipped += 1;
        continue;
      }
      const sourceReference = (record.source_reference as string | undefined) ?? null;
      await startExtraction({
        corpusFileId: row.id,
        rawAbsolutePath: rawPath,
        recipeId: null, // use the suggested recipe
        contentType: (file.content_type as string | undefined) ?? null,
        sourceUrl: sourceReference && /^https:\/\//.test(sourceReference) ? sourceReference : null,
        title: (record.title as string | undefined) ?? null,
        locked: row.partition === "locked",
        // Auto-picks the OCR language from the work's metadata for scans.
        workLanguage: row.language ?? ((record.language as string | undefined) ?? null),
      });
      summary.queued += 1;
    } catch (e) {
      summary.failed.push({ edition_id: editionId, error: errMessage(e) });
    }
  }
  return summary;
}

/**
 * True when stored corpus bytes are markup (HTML/XML/JSON) rather than plain
 * readable text. Readers must never see markup — such files need an extracted
 * readable sibling first.
 */
export function looksLikeMarkup(relativePath: string, content: string): boolean {
  if (/\.(html?|xml|json|epub|pdf|docx)$/i.test(relativePath)) return true;
  const head = content.slice(0, 2000).trimStart();
  if (/^(<!doctype|<html|<\?xml|<head|<body)/i.test(head)) return true;
  if (/^[\[{]/.test(head)) {
    try {
      JSON.parse(content);
      return true;
    } catch {
      /* not JSON after all */
    }
  }
  // Tag-dense content (script soup) even without a DOCTYPE.
  const tags = (head.match(/<[a-z!/][^>]*>/gi) ?? []).length;
  return tags >= 10;
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

/**
 * The DB-backed CycleStore shared by standard and corpus-list cycles.
 * `mirroredRecords` accumulates every corpus record mirrored during the run
 * (used afterwards for auto-extraction).
 */
function makeCycleStore(runId: number, mirroredRecords: Record<string, unknown>[], scope?: CycleScope): CycleStore {
  return {
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
    async updateCandidate(candidate) {
      // Same edition, corrected URL/rights evidence (automatic link repair).
      await db
        .update(hunterCandidates)
        .set({ data: candidate })
        .where(eq(hunterCandidates.editionId, String(candidate.edition_id)));
    },
    async addBlocker(b) {
      // Bookkeeping must never take a cycle down: a failed blocker insert is
      // logged and swallowed, otherwise the driver's error (which quotes the
      // whole statement and its parameters) becomes the run's failure text.
      try {
        await db.insert(hunterBlockers).values({
          runId,
          sourceId: b.sourceId ?? null,
          url: b.url ?? null,
          reason: b.reason,
          detail: b.detail ? truncateText(b.detail, MAX_ERROR_TEXT) : null,
          workId: b.workId ?? null,
          editionId: b.editionId ?? null,
          resolvedUrl: b.resolvedUrl ?? null,
          itemUrl: b.itemUrl ?? null,
          repairState: b.repairState ?? null,
          repairDetail: b.repairDetail ?? null,
        });
      } catch (e) {
        console.error(`run ${runId}: could not record blocker:`, cleanErrorText(e));
      }
    },
    async updateProgress(progress) {
      // Merge scope into every progress write so the region is never lost
      // even while the cycle is mid-flight. Progress is advisory — a failed
      // write is logged, never surfaced as the reason the run failed.
      try {
        await db
          .update(hunterRuns)
          .set({ result: { ...(scope ? { scope } : {}), progress } })
          .where(eq(hunterRuns.id, runId));
      } catch (e) {
        console.error(`run ${runId}: could not store progress:`, cleanErrorText(e));
      }
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
      mirroredRecords.push(...records);
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
}

async function createRun(kind: string): Promise<number> {
  const [row] = await db
    .insert(hunterRuns)
    .values({ kind, status: "running" })
    .returning({ id: hunterRuns.id });
  return row.id;
}

async function finishRun(id: number, ok: boolean, result: unknown, error?: string) {
  // Whatever went wrong, the stored reason stays short and readable.
  const reason = error ? truncateText(error, MAX_ERROR_TEXT) : null;
  try {
    await db
      .update(hunterRuns)
      .set({
        status: ok ? "completed" : "failed",
        finishedAt: new Date(),
        result: result ?? null,
        error: reason,
      })
      .where(eq(hunterRuns.id, id));
  } catch (e) {
    // The result payload itself may be what the database rejected. Retry
    // without it so the run still reaches a final state with a reason.
    const writeError = cleanErrorText(e);
    console.error(`run ${id}: could not store run result:`, writeError);
    await db
      .update(hunterRuns)
      .set({
        status: ok ? "completed" : "failed",
        finishedAt: new Date(),
        result: null,
        error: reason ?? `Run result could not be stored: ${writeError}`,
      })
      .where(eq(hunterRuns.id, id));
  }
}

/**
 * Passed as the `lookup` option to every http/https.request call made by the
 * check-url probe. Node.js calls this once per connection, right before
 * opening the TCP socket, so the IP used for validation IS the IP used to
 * connect — closing the DNS-rebinding window that exists when validation and
 * connection are two separate DNS queries.
 *
 * Node may request ALL addresses (options.all === true) — e.g. when
 * autoSelectFamily is enabled — and then expects an ARRAY of
 * { address, family } objects. Returning a plain string in that case makes
 * Node read `.address` off it, get undefined, and fail with
 * "Invalid IP address: undefined". Both callback shapes are handled here.
 * Exported for tests.
 */
export const safeLookup = (
  hostname: string,
  opts: unknown,
  cb: (err: Error | null, address: unknown, family?: number) => void,
): void => {
  const clean = hostname.replace(/^\[|\]$/g, "");
  const family = (a: string) => (a.includes(":") ? 6 : 4);
  const p = isIP(clean)
    ? Promise.resolve([{ address: clean, family: family(clean) }])
    : dnsLookup(clean, { all: true });
  p.then((addrs) => {
    if (addrs.length === 0) {
      cb(new Error(`No addresses found for ${clean}`), "", 0);
      return;
    }
    for (const { address } of addrs) {
      if (isPrivateAddress(address)) {
        cb(new Error("URL resolves to a private or internal address"), "", 0);
        return;
      }
    }
    if (opts && typeof opts === "object" && (opts as { all?: boolean }).all) {
      cb(null, addrs.map((a) => ({ address: a.address, family: family(a.address) })));
      return;
    }
    const a = addrs[0].address;
    cb(null, a, family(a));
  }).catch((err) => cb(err, "", 0));
};

/**
 * Mark hunter runs orphaned by a previous process as failed.
 * Runs execute entirely in-process, so any "running" row present when the
 * server boots cannot still be executing.
 */
async function failOrphanedRuns() {
  // Only touch runs started before this process booted, so a run created
  // right after startup can never be caught by this cleanup.
  const bootTime = new Date();
  const rows = await db
    .update(hunterRuns)
    .set({
      status: "failed",
      finishedAt: new Date(),
      error: "Interrupted by a server restart",
    })
    .where(and(eq(hunterRuns.status, "running"), lt(hunterRuns.startedAt, bootTime)))
    .returning({ id: hunterRuns.id });
  if (rows.length > 0) {
    console.log(`Marked ${rows.length} orphaned hunter run(s) as failed after restart`);
  }
  // Link repairs also run in-process and claim a blocker by setting
  // repairState = "in_progress". A restart mid-repair would otherwise leave
  // the card stuck on "Checking this link…" forever, because the claim only
  // takes rows whose repairState is null. Release those claims.
  const released = await db
    .update(hunterBlockers)
    .set({ repairState: null, updatedAt: new Date() })
    .where(eq(hunterBlockers.repairState, "in_progress"))
    .returning({ id: hunterBlockers.id });
  if (released.length > 0) {
    console.log(`Released ${released.length} interrupted link repair claim(s) after restart`);
  }
}

async function loadCandidateRows() {
  return db.select().from(hunterCandidates).orderBy(hunterCandidates.id);
}

function candidateFromRow(row: { data: unknown }): Candidate {
  return row.data as Candidate;
}

/**
 * Minimal candidate for a blocker whose candidate row is gone: enough for the
 * resolver to identify the Archive item, whose metadata then fills in the
 * title, author, language and licence evidence.
 */
function candidateFromBlocker(row: typeof hunterBlockers.$inferSelect): Candidate | null {
  if (!row.url || !isArchiveUrl(row.url)) return null;
  const slug = (row.url.split("/").filter(Boolean).pop() ?? "item")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return {
    work_id: row.workId ?? `work:archive-${slug}`,
    edition_id: row.editionId ?? `edition:internet-archive-${slug}`,
    title: "",
    author: null,
    translator: null,
    source_id: INTERNET_ARCHIVE_SOURCE_ID,
    language: "",
    language_role: "unknown",
    format: "txt",
    text_url: row.url,
    rights: { status_claim: "unknown", basis: "unknown", statement: "" },
    access: { download_allowed: true, requires_auth: false },
  } as unknown as Candidate;
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
  // Automatic link-repair state on blockers (Internet Archive auto-repair):
  // the confirmed download URL, the item's page and the repair outcome.
  await db.execute(sql`
    ALTER TABLE hunter_blockers
    ADD COLUMN IF NOT EXISTS resolved_url text,
    ADD COLUMN IF NOT EXISTS item_url text,
    ADD COLUMN IF NOT EXISTS repair_state text,
    ADD COLUMN IF NOT EXISTS repair_detail text
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

/** Blocker reasons surfaced in the Manual Fetch queue. */
const MANUAL_ONLY_REASONS = ["robots_disallowed", "download_not_authorized", "requires_auth"];
/**
 * Startup backfill: assign a mythological region to cycle runs that were
 * created without one (legacy runs, free-query cycles, corpus-list cycles).
 *
 * Idempotent: runs that already carry `scope.region` or a previous inference
 * verdict (`scope.regionInference`) are skipped. Runs whose region genuinely
 * cannot be inferred are marked "unresolved" — not guessed — so the next boot
 * skips them too.
 */
export async function backfillCycleRegionAssignments(): Promise<{
  scanned: number;
  assigned: number;
  unresolved: number;
  skipped: number;
}> {
  const runs = await db.select().from(hunterRuns).where(eq(hunterRuns.kind, "cycle"));
  let assigned = 0;
  let unresolved = 0;
  let skipped = 0;
  for (const run of runs) {
    const result = (run.result ?? {}) as Record<string, unknown>;
    const scope = (result.scope ?? {}) as Record<string, unknown>;
    const region = scope.region as { id?: string } | undefined;
    if (region?.id || scope.regionInference) {
      skipped += 1;
      continue;
    }
    // Evidence: the run's own scope text plus metadata of texts it downloaded.
    const targetWork = scope.targetWork as Record<string, unknown> | undefined;
    const parts: (string | null | undefined)[] = [
      scope.query as string | undefined,
      scope.corpusList as string | undefined,
      targetWork?.title as string | undefined,
      targetWork?.author as string | undefined,
    ];
    const files = await db
      .select({ record: hunterCorpusFiles.record })
      .from(hunterCorpusFiles)
      .where(eq(hunterCorpusFiles.runId, run.id));
    for (const file of files) {
      const record = file.record as Record<string, unknown> | null;
      if (!record) continue;
      parts.push(
        record.title as string | undefined,
        record.author as string | undefined,
        record.source_id as string | undefined,
      );
    }
    const inferred = inferRegion(parts);
    const newScope = inferred
      ? { ...scope, region: inferred, regionInferred: true, regionInference: "inferred" }
      : { ...scope, regionInference: "unresolved" };
    await db
      .update(hunterRuns)
      .set({ result: { ...result, scope: newScope } })
      .where(eq(hunterRuns.id, run.id));
    if (inferred) assigned += 1;
    else unresolved += 1;
  }
  return { scanned: runs.length, assigned, unresolved, skipped };
}
/**
 * Re-queue extraction jobs that were interrupted by a server restart, when it
 * is safe to do so: the raw file still exists and has no readable sibling yet.
 * Called once at startup, fire-and-forget (failures are logged, not thrown).
 */
async function reQueueInterruptedJobs(
  recoveredJobs: import("./sourceHunter/extraction/run").ExtractionJob[],
): Promise<void> {
  if (recoveredJobs.length === 0) return;
  const ids = recoveredJobs.map((j) => j.corpusFileId);
  let rows: (typeof hunterCorpusFiles.$inferSelect)[];
  try {
    rows = await db
      .select()
      .from(hunterCorpusFiles)
      .where(inArray(hunterCorpusFiles.id, ids));
  } catch (e) {
    console.error("reQueueInterruptedJobs: DB lookup failed:", errMessage(e));
    return;
  }
  const rowById = new Map(rows.map((r) => [r.id, r]));
  for (const job of recoveredJobs) {
    const row = rowById.get(job.corpusFileId);
    if (!row) {
      console.warn(
        `reQueueInterruptedJobs: corpus file ${job.corpusFileId} not found in DB, skipping`,
      );
      continue;
    }
    const rawPath = path.resolve(CORPUS_ROOT, row.path);
    // Safety check: only re-queue when the raw file is present and there is
    // no readable sibling yet (i.e., the extraction never finished).
    try {
      await fs.access(rawPath);
    } catch {
      console.warn(
        `reQueueInterruptedJobs: raw file missing for corpus ${job.corpusFileId}, skipping`,
      );
      continue;
    }
    if (hasReadable(rawPath)) {
      // Extraction completed (perhaps by another process) — just mark done.
      continue;
    }
    const record = row.record as Record<string, unknown> | null | undefined;
    const file = record?.file as Record<string, unknown> | undefined;
    const sourceReference = (record?.source_reference as string | undefined) ?? null;
    try {
      await startExtraction({
        corpusFileId: row.id,
        rawAbsolutePath: rawPath,
        recipeId: job.recipeId,
        contentType: (file?.content_type as string | undefined) ?? null,
        sourceUrl: sourceReference && /^https:\/\//.test(sourceReference) ? sourceReference : null,
        title: (record?.title as string | undefined) ?? null,
        locked: row.partition === "locked",
        workLanguage: row.language ?? null,
      });
      console.log(
        `reQueueInterruptedJobs: re-queued extraction for corpus file ${job.corpusFileId}`,
      );
    } catch (e) {
      console.error(
        `reQueueInterruptedJobs: failed to re-queue corpus file ${job.corpusFileId}:`,
        errMessage(e),
      );
    }
  }
}

export function registerHunterRoutes(
  app: Express,
  requireEditor: (req: Request, res: Response, next: NextFunction) => void,
) {
  // Surface extraction jobs stranded by a previous process as "interrupted"
  // so the status endpoint reports something honest instead of a 404.
  // Then automatically re-queue jobs whose raw file still exists and has no
  // readable sibling — they can be finished without editor intervention.
  const recoveredJobs = recoverInterruptedJobs();
  reQueueInterruptedJobs(recoveredJobs).catch((e) =>
    console.error("reQueueInterruptedJobs failed:", errMessage(e)),
  );
  // Backfill readable siblings for files downloaded before extraction existed
  // (throttled, one job at a time). Runs in the background at startup so the
  // library becomes readable without editors re-extracting files one by one.
  if (process.env.NODE_ENV !== "test") {
    backfillMissingReadables()
      .then((summary) => {
        if (summary.queued > 0 || summary.failed.length > 0) {
          console.log(
            `readable backfill: queued ${summary.queued}, skipped ${summary.skipped}, failed ${summary.failed.length}`,
          );
        }
      })
      .catch((e) => console.error("readable backfill failed:", errMessage(e)));
  }
  // Best-effort schema upgrade so pre-provenance databases don't 500, then
  // backfill map regions for cycle runs created before region inference
  // existed (runs after run_id exists so downloaded texts count as evidence).
  ensureHunterProvenanceSchema()
    .catch((e) => console.error("hunter provenance schema upgrade failed:", errMessage(e)))
    .then(() => backfillCycleRegionAssignments())
    .then(({ scanned, assigned, unresolved }) => {
      if (assigned || unresolved) {
        console.log(
          `hunter region backfill: ${scanned} cycle runs scanned, ${assigned} assigned, ${unresolved} unresolved`,
        );
      }
    })
    .catch((e) => console.error("hunter region backfill failed:", errMessage(e)));
  // Repair the Archive links already queued in Manual Fetch, in the
  // background, once the blocker columns are guaranteed to exist.
  if (process.env.NODE_ENV !== "test") {
    ensureHunterProvenanceSchema()
      .then(() => ensureArchiveBacklogRepair())
      .then(({ scanned, repaired, unrepairable }) => {
        if (scanned > 0) {
          console.log(
            `archive link repair: ${scanned} queued entries, ${repaired} repaired, ${unrepairable} still blocked`,
          );
        }
      })
      .catch((e) => console.error("archive link repair failed:", errMessage(e)));
  }
  // Runs execute in-process, so any row still marked "running" at startup was
  // orphaned by a previous process (restart/redeploy). Mark them failed so the
  // UI doesn't show a phantom "Running" cycle with a Stop button that 409s.
  failOrphanedRuns().catch((e) =>
    console.error("failOrphanedRuns failed:", errMessage(e)),
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
      const autoExtraction = await autoExtractDownloaded(
        records as unknown as Record<string, unknown>[],
      );
      const summary = {
        records: records.length,
        downloaded: records.filter((r) => r.download_status === "downloaded").length,
        already_present: records.filter((r) => r.download_status === "already_present").length,
        metadata_only: records.filter((r) => r.download_status === "metadata_only").length,
        failed: records.filter((r) => r.download_status === "failed").length,
        auto_extraction: autoExtraction,
        entries: records,
      };
      await finishRun(runId, true, summary);
    } catch (e) {
      await finishRun(runId, false, null, errMessage(e));
    }
  });

  // ---- Hunting cycles ----------------------------------------------------
  const launchCycleHandler = async (req: Request, res: Response) => {
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
    // Free-query launches get a best-effort inferred region so they show up
    // on the world map without editor action (left off when ambiguous).
    const inferredRegion = region ? null : inferRegion(query);
    const scope: CycleScope = {
      query,
      limit: Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, 25) : 10,
      useAi: req.body?.use_ai !== false,
      ...(region
        ? { region: { id: region.id, label: region.label } }
        : inferredRegion
          ? { region: inferredRegion, regionInferred: true }
          : {}),
    };
    const runId = await createRun("cycle");
    // Seed the result with scope immediately so region is never lost even on failure.
    await db.update(hunterRuns).set({ result: { scope } }).where(eq(hunterRuns.id, runId));
    // Long operation: respond immediately; the UI polls the run until done.
    res.json({
      run: { id: runId, status: "running" },
      ...(req.path.startsWith("/api/bot/")
        ? { links: { poll: `/api/bot/hunter/runs/${runId}` } }
        : {}),
    });
    try {
      const policy = await loadActivePolicy();
      validatePolicy(policy);
      const registry = await loadActiveRegistry();
      const mirroredRecords: Record<string, unknown>[] = [];
      // Pass scope so updateProgress always preserves the region in the result.
      const store = makeCycleStore(runId, mirroredRecords, scope);
      const summary = await runHuntingCycle({
        scope,
        policy,
        registry,
        corpusRoot: CORPUS_ROOT,
        store,
      });
      const autoExtraction = await autoExtractDownloaded(mirroredRecords);
      // Include scope in the final result so the map can read result.scope.region
      // even without consulting the seeded row.
      await finishRun(runId, true, { ...summary, scope, auto_extraction: autoExtraction });
    } catch (e) {
      // Preserve scope on failure so the region remains visible on the map.
      await finishRun(runId, false, { scope }, errMessage(e));
    }
  };
  app.post("/api/hunter/cycles", requireEditor, launchCycleHandler);
  // The bot API reuses exactly the same search implementation and accepted
  // filters as the editor UI.
  app.post("/api/bot/hunter/search", launchCycleHandler);

  /**
   * Scope for a corpus-list cycle: standard query/corpusList fields plus a
   * region inferred from the list name and item titles/authors when the
   * evidence is unambiguous.
   */
  function buildCorpusListScope(list: {
    name: string;
    items: { title: string; author?: string | null }[];
  }): CycleScope {
    const inferred = inferRegion([
      list.name,
      ...list.items.map((item) => `${item.title} ${item.author ?? ""}`),
    ]);
    return {
      query: `Corpus list: ${list.name}`,
      corpusList: list.name,
      ...(inferred ? { region: inferred, regionInferred: true } : {}),
    };
  }

  /**
   * Corpus-list hunting cycle: the editor uploads a list of sources
   * (.csv/.json/.txt). The file name becomes the cycle name; the hunter tries
   * to fetch every listed source — complete and in English when possible,
   * otherwise in an AI-translatable language — and the run's result carries a
   * per-item fetched/not-fetched report.
   * Body: { filename: string, content: string, use_ai?: boolean }
   */
  app.post("/api/hunter/cycles/corpus", requireEditor, async (req, res) => {
    const filename = String(req.body?.filename ?? "").trim();
    const content = typeof req.body?.content === "string" ? req.body.content : "";
    if (!filename) return res.status(400).json({ message: "Provide the uploaded file's name" });
    if (!content.trim()) return res.status(400).json({ message: "The file is empty" });
    // A corpus LIST is a small index of titles/URLs, never the texts
    // themselves — cap it well below the global JSON body limit so a huge
    // upload can't tie up the parser.
    if (Buffer.byteLength(content, "utf8") > MAX_CORPUS_LIST_BYTES) {
      return res.status(413).json({
        message: `Corpus lists are capped at ${Math.floor(MAX_CORPUS_LIST_BYTES / 1024)} KB — this file looks like it contains full texts, not a list of sources.`,
      });
    }
    let list;
    try {
      list = parseCorpusList(filename, content);
    } catch (e) {
      if (e instanceof CorpusListParseError) {
        return res.status(400).json({ message: e.message });
      }
      throw e;
    }
    const runId = await createRun("cycle");
    // `scope` keeps the run shape compatible with the standard cycle contract
    // the UI reads. Region is inferred from the list name and item metadata so
    // corpus cycles appear on the world map without editor action.
    const scope: CycleScope = buildCorpusListScope(list);
    // Seed the result with scope immediately so the map sees the region while
    // the cycle is still running and even if it fails.
    await db.update(hunterRuns).set({ result: { scope } }).where(eq(hunterRuns.id, runId));
    // Long operation: respond immediately; the UI polls the run until done.
    res.json({
      run: { id: runId, status: "running" },
      corpus_list: { name: list.name, items: list.items.length },
    });
    activeCorpusRunIds.add(runId);
    try {
      const policy = await loadActivePolicy();
      validatePolicy(policy);
      const registry = await loadActiveRegistry();
      const mirroredRecords: Record<string, unknown>[] = [];
      const store = makeCycleStore(runId, mirroredRecords, scope);
      const result = await runCorpusListCycle({
        list,
        policy,
        registry,
        corpusRoot: CORPUS_ROOT,
        store,
        useAi: req.body?.use_ai !== false,
        shouldStop: () => corpusStopRequests.has(runId),
      });
      corpusStopRequests.delete(runId);
      activeCorpusRunIds.delete(runId);
      const autoExtraction = await autoExtractDownloaded(mirroredRecords);
      await finishRun(runId, true, {
        scope,
        corpus_list: result.corpus_list,
        ...result.summary,
        auto_extraction: autoExtraction,
      });
    } catch (e) {
      corpusStopRequests.delete(runId);
      activeCorpusRunIds.delete(runId);
      // Preserve scope on failure so the region remains visible on the map.
      await finishRun(runId, false, { scope }, errMessage(e));
    }
  });

  /**
   * Request a graceful stop for a running corpus-list cycle.
   * The cycle finishes its current item, marks remaining items as "skipped",
   * and completes the run normally so the partial report is preserved.
   *
   * Only corpus-list cycles support stopping (standard hunts are short-lived
   * and don't expose shouldStop). Requests targeting any other run type are
   * rejected with 409 so the UI doesn't give a false confirmation.
   */
  app.post("/api/hunter/cycles/:id/stop", requireEditor, async (req, res) => {
    const id = parseInt(String(req.params.id));
    if (!Number.isInteger(id)) return res.status(400).json({ message: "Invalid run id" });
    // Gate on the in-process active-corpus registry first (no DB round-trip
    // needed for the common case of a live corpus-list cycle).
    if (!activeCorpusRunIds.has(id)) {
      // Fall back to the DB to give a more precise error (not found vs wrong type).
      const [run] = await db
        .select({ id: hunterRuns.id, status: hunterRuns.status })
        .from(hunterRuns)
        .where(eq(hunterRuns.id, id))
        .limit(1);
      if (!run) return res.status(404).json({ message: "Run not found" });
      // Either the run already finished or it is not a corpus-list cycle.
      if (run.status !== "running") {
        return res.status(409).json({ message: "Run is not currently running" });
      }
      // Live non-corpus runs are never in activeCorpusRunIds, and we cannot
      // distinguish them from orphaned rows here, so keep the 409. Orphaned
      // "running" rows are cleaned up by failOrphanedRuns() at startup.
      return res.status(409).json({ message: "This run is not a corpus-list cycle and cannot be stopped via this endpoint" });
    }
    corpusStopRequests.add(id);
    res.json({ ok: true, message: "Stop requested; the cycle will finish its current item then stop." });
  });

  /**
   * Retry only the missing/failed sources from a completed corpus-list run.
   * Reads the original run's per-item report, filters for retryable statuses
   * (not_found, failed, metadata_only), and launches a new corpus-list cycle
   * containing only those items.
   */
  app.post("/api/hunter/cycles/corpus/:runId/retry", requireEditor, async (req, res) => {
    const runId = Number(req.params.runId);
    if (!Number.isFinite(runId)) return res.status(400).json({ message: "Invalid run id" });

    const [existingRun] = await db
      .select()
      .from(hunterRuns)
      .where(eq(hunterRuns.id, runId))
      .limit(1);
    if (!existingRun) return res.status(404).json({ message: "Run not found" });
    if (existingRun.status !== "completed") {
      return res.status(400).json({ message: "Can only retry a completed corpus-list run" });
    }
    const existingResult = existingRun.result as Record<string, unknown> | null;
    const corpusList = existingResult?.corpus_list as Record<string, unknown> | null | undefined;
    if (!corpusList || !Array.isArray(corpusList.items)) {
      return res.status(400).json({ message: "This run does not have a corpus-list report" });
    }

    const RETRYABLE = new Set(["not_found", "failed", "metadata_only"]);
    const outcomes = corpusList.items as Record<string, unknown>[];
    // Use the original uploaded items (which carry url and language) when
    // available, falling back to the outcome fields for older runs.
    const originals = Array.isArray(corpusList.original_items)
      ? (corpusList.original_items as Record<string, unknown>[])
      : null;

    const retryItems = outcomes
      .map((outcome, i) => {
        const orig = originals?.[i] ?? outcome;
        return { outcome, orig };
      })
      .filter(({ outcome }) => RETRYABLE.has(String(outcome.status ?? "")))
      .map(({ outcome, orig }) => {
        const item: { title: string; author?: string; language?: string; url?: string } = {
          title: String(orig.title ?? outcome.title ?? ""),
        };
        const author = orig.author ?? outcome.author;
        if (author) item.author = String(author);
        const language = orig.language;
        if (language) item.language = String(language);
        const url = orig.url;
        if (url) item.url = String(url);
        return item;
      })
      .filter((item) => item.title);

    if (retryItems.length === 0) {
      return res.status(400).json({ message: "All sources were already fetched — nothing to retry" });
    }

    const originalName = String(corpusList.name ?? `run-${runId}`);
    const retryName = originalName.endsWith(" (retry)")
      ? originalName
      : `${originalName} (retry)`;
    const list = { name: retryName, items: retryItems };

    // Atomic synchronous guard — no await between the check and the add, so
    // two concurrent requests on the same event-loop tick both hit the same
    // Set state and exactly one is rejected. The outer try/finally guarantees
    // the name is released after the run reaches its final state, covering
    // every exit path: run-creation error, scope-setup error, cycle failure,
    // and normal completion (including post-cycle auto-extraction).
    if (activeRetryNames.has(retryName)) {
      return res.status(409).json({
        message: `A retry for "${retryName}" is already running — wait for it to finish before launching another.`,
      });
    }
    activeRetryNames.add(retryName);

    try {
      const newRunId = await createRun("cycle");

      // Same region seeding as a fresh corpus-list cycle, but prefer the
      // original run's region (explicit or inferred) when it has one.
      const originalScope = (existingResult?.scope ?? {}) as Record<string, unknown>;
      const originalRegion = originalScope.region as { id: string; label: string } | undefined;
      const retryScope: CycleScope = originalRegion?.id
        ? {
            ...buildCorpusListScope(list),
            region: originalRegion,
            ...(originalScope.regionInferred ? { regionInferred: true } : {}),
          }
        : buildCorpusListScope(list);
      await db.update(hunterRuns).set({ result: { scope: retryScope } }).where(eq(hunterRuns.id, newRunId));
      res.json({
        run: { id: newRunId, status: "running" },
        corpus_list: { name: list.name, items: list.items.length },
      });

      activeCorpusRunIds.add(newRunId);
      try {
        const policy = await loadActivePolicy();
        validatePolicy(policy);
        const registry = await loadActiveRegistry();
        const mirroredRecords: Record<string, unknown>[] = [];
        const store = makeCycleStore(newRunId, mirroredRecords, retryScope);
        const result = await runCorpusListCycle({
          list,
          policy,
          registry,
          corpusRoot: CORPUS_ROOT,
          store,
          useAi: req.body?.use_ai !== false,
          shouldStop: () => corpusStopRequests.has(newRunId),
        });
        corpusStopRequests.delete(newRunId);
        activeCorpusRunIds.delete(newRunId);
        const autoExtraction = await autoExtractDownloaded(mirroredRecords);
        await finishRun(newRunId, true, {
          scope: retryScope,
          corpus_list: result.corpus_list,
          ...result.summary,
          auto_extraction: autoExtraction,
        });
      } catch (e) {
        corpusStopRequests.delete(newRunId);
        activeCorpusRunIds.delete(newRunId);
        // Preserve scope on failure so the region remains visible on the map.
        await finishRun(newRunId, false, { scope: retryScope }, errMessage(e));
      }
    } finally {
      // Always release the reservation so a future retry can be launched once
      // this run (and its post-cycle steps) has fully completed or failed.
      activeRetryNames.delete(retryName);
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

  // Map endpoint: returns ALL cycle runs (no row limit) with only the scalar
  // summary fields the world map needs, plus per-region counts of downloaded
  // corpus texts (region taken from the provenance run when it has one,
  // otherwise inferred from the text's own record metadata). Payload stays
  // small even for hundreds of runs because bulky per-record entries are
  // never included.
  app.get("/api/hunter/map", async (_req, res) => {
    const runs = await db
      .select()
      .from(hunterRuns)
      .where(eq(hunterRuns.kind, "cycle"))
      .orderBy(desc(hunterRuns.id));
    // region lookup: run id -> region id (explicit or inferred).
    const regionByRun = new Map<number, string>();
    for (const run of runs) {
      const result = run.result as Record<string, unknown> | null;
      const scope = result?.scope as Record<string, unknown> | undefined;
      const region = scope?.region as { id?: string } | undefined;
      if (region?.id) regionByRun.set(run.id, region.id);
    }
    const files = await db
      .select({
        runId: hunterCorpusFiles.runId,
        record: hunterCorpusFiles.record,
      })
      .from(hunterCorpusFiles);
    const regionTexts: Record<string, number> = {};
    for (const file of files) {
      let regionId = file.runId != null ? regionByRun.get(file.runId) : undefined;
      if (!regionId) {
        const record = file.record as Record<string, unknown> | null;
        regionId = inferRegion([
          record?.title as string | undefined,
          record?.author as string | undefined,
          record?.source_id as string | undefined,
        ])?.id;
      }
      if (regionId) regionTexts[regionId] = (regionTexts[regionId] ?? 0) + 1;
    }
    res.json({
      runs: runs.map((run) => {
        const result = run.result as Record<string, unknown> | null;
        // Extract only the fields the map needs; drop entries and other bulk.
        const { scope, downloaded_public, downloaded_locked, metadata_only, failed, invalid } =
          (result ?? {}) as Record<string, unknown>;
        return {
          id: run.id,
          status: run.status,
          result: result
            ? { scope, downloaded_public, downloaded_locked, metadata_only, failed, invalid }
            : null,
        };
      }),
      region_texts: regionTexts,
    });
  });

  // ---- Blocker ledger ----------------------------------------------------
  app.get("/api/hunter/blockers", async (_req, res) => {
    res.json(await db.select().from(hunterBlockers).orderBy(desc(hunterBlockers.id)).limit(500));
  });

  /**
   * The "assisted manual fetch" queue: texts the hunter cannot download by
   * automation at all — the source's robots.txt forbids it, the source is
   * marked manual-only, or the page requires a login. Excludes anything whose
   * work already has a file in the corpus (a fallback edition succeeded), and
   * dedupes by URL keeping the newest blocker.
   */
  app.get("/api/hunter/manual-fetch", requireEditor, async (_req, res) => {
    // Archive links that have never been checked are repaired in the
    // background; this never blocks the page load.
    if (process.env.NODE_ENV !== "test") void ensureArchiveBacklogRepair();
    const rows = await db
      .select()
      .from(hunterBlockers)
      .where(and(eq(hunterBlockers.status, "open"), inArray(hunterBlockers.reason, MANUAL_ONLY_REASONS)))
      .orderBy(desc(hunterBlockers.id))
      .limit(500);

    // Two set-based lookups (no per-row queries): which of these works were
    // already fetched via another edition, and candidate metadata by edition.
    const workIds = Array.from(new Set(rows.map((b) => b.workId).filter((w): w is string => !!w)));
    const fetchedWorkIds = new Set(
      workIds.length === 0
        ? []
        : (
            await db
              .selectDistinct({ workId: hunterCorpusFiles.workId })
              .from(hunterCorpusFiles)
              .where(inArray(hunterCorpusFiles.workId, workIds))
          ).map((r) => r.workId),
    );
    const editionIds = Array.from(
      new Set(rows.map((b) => b.editionId).filter((e): e is string => !!e)),
    );
    const candidatesByEdition = new Map(
      editionIds.length === 0
        ? []
        : (
            await db
              .select()
              .from(hunterCandidates)
              .where(inArray(hunterCandidates.editionId, editionIds))
          ).map((row) => [row.editionId, candidateFromRow(row) as Record<string, unknown>] as const),
    );

    const seenUrls = new Set<string>();
    const items: Record<string, unknown>[] = [];
    for (const b of rows) {
      if (b.workId && fetchedWorkIds.has(b.workId)) continue;
      // URL-less blockers (source-level notices) recur every run — collapse
      // them to one row per source+reason+detail.
      const urlKey = b.url ?? `${b.sourceId ?? ""}|${b.reason}|${b.detail ?? ""}`;
      if (seenUrls.has(urlKey)) continue;
      seenUrls.add(urlKey);

      const c = b.editionId ? candidatesByEdition.get(b.editionId) : undefined;
      items.push({
        ...b,
        title: typeof c?.title === "string" ? c.title : null,
        language: typeof c?.language === "string" ? c.language : null,
        can_upload: Boolean(b.editionId),
      });
    }
    res.json(items);
  });

  /**
   * Server-side reachability probe for a Manual Fetch URL.
   *
   * Accepts a blocker ID; obtains the URL from the database so callers cannot
   * inject arbitrary targets. DNS resolution and private-address validation
   * happen inside the `lookup` callback supplied to Node's http/https module,
   * which is called by the runtime exactly once at connect time. The validated
   * address is therefore the address used for the TCP connection — preventing
   * DNS rebinding attacks. Each redirect hop goes through the same validation.
   * Tries HEAD first, falls back to GET on 405, caps at 5 redirects.
   * Returns { status, ok, redirected, finalUrl, error }.
   */
  app.get("/api/hunter/check-url", requireEditor, async (req, res) => {
    const rawId = String(req.query.id ?? "").trim();
    const blockerId = parseInt(rawId, 10);
    if (!rawId || isNaN(blockerId)) {
      return res.status(400).json({ error: "id parameter required (blocker ID)" });
    }

    const MANUAL_REASONS = ["robots_disallowed", "download_not_authorized", "requires_auth"];
    const [blocker] = await db
      .select()
      .from(hunterBlockers)
      .where(and(eq(hunterBlockers.id, blockerId), inArray(hunterBlockers.reason, MANUAL_REASONS)))
      .limit(1);

    if (!blocker) return res.status(404).json({ error: "Blocker not found or not a manual-fetch blocker" });
    // Probe the link the editor is actually shown: a repaired blocker carries
    // a resolved URL that supersedes the original broken one.
    const target = blocker.resolvedUrl ?? blocker.url;
    if (!target) return res.status(400).json({ error: "This blocker has no URL to probe" });

    const raw = target;
    let originalHost: string;
    try {
      const parsed = new URL(raw);
      if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
        throw new Error("Only http:// and https:// URLs are allowed");
      }
      originalHost = parsed.hostname;
    } catch (err: any) {
      return res.json({ status: null, ok: false, redirected: false, finalUrl: raw, error: err.message });
    }

    const TIMEOUT_MS = 10_000;
    const MAX_REDIRECTS = 5;

    type ProbeOutcome = {
      status: number | null; ok: boolean; redirected: boolean; finalUrl: string; error: string | null;
    };
    type HopResult = { status: number; ok: boolean; location: string | null } | { error: string };

    const runProbe = async (method: "HEAD" | "GET"): Promise<ProbeOutcome> => {
      let currentStr = raw;
      let redirected = false;

      for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
        let currentUrl: URL;
        try {
          currentUrl = new URL(currentStr);
        } catch {
          return { status: null, ok: false, redirected, finalUrl: currentStr, error: "Invalid redirect URL" };
        }
        if (currentUrl.protocol !== "https:" && currentUrl.protocol !== "http:") {
          return { status: null, ok: false, redirected, finalUrl: currentStr, error: "Only http:// and https:// URLs are allowed" };
        }

        // Preflight: reject IP-literal private addresses BEFORE opening any socket.
        // Node's http(s).request skips the custom `lookup` option when the hostname
        // is already a numeric IP, so safeLookup would never be called for literals
        // such as 127.0.0.1 or 169.254.169.254.
        const rawHostname = currentUrl.hostname.replace(/^\[|\]$/g, "");
        if (isIP(rawHostname) && isPrivateAddress(rawHostname)) {
          return { status: null, ok: false, redirected, finalUrl: currentStr, error: "URL resolves to a private or internal address" };
        }

        const port = currentUrl.port
          ? parseInt(currentUrl.port, 10)
          : currentUrl.protocol === "https:" ? 443 : 80;
        const reqFn = currentUrl.protocol === "https:" ? https.request : http.request;

        const hopResult = await new Promise<HopResult>((resolve) => {
          const req = reqFn(
            {
              method,
              hostname: currentUrl.hostname,
              port,
              path: (currentUrl.pathname || "/") + currentUrl.search,
              headers: { Host: currentUrl.host, "User-Agent": CYCLE_USER_AGENT },
              ...(currentUrl.protocol === "https:" ? { servername: currentUrl.hostname } : {}),
              lookup: safeLookup,
            } as any,
            (incoming: IncomingMessage) => {
              clearTimeout(timer);
              incoming.resume();
              resolve({
                status: incoming.statusCode!,
                ok: incoming.statusCode! >= 200 && incoming.statusCode! < 300,
                location: (incoming.headers.location as string | undefined) ?? null,
              });
            },
          );
          const timer = setTimeout(() => { req.destroy(); resolve({ error: "Timed out after 10 s" }); }, TIMEOUT_MS);
          req.on("error", (err: Error) => { clearTimeout(timer); resolve({ error: err.message }); });
          req.end();
        });

        if ("error" in hopResult) {
          return { status: null, ok: false, redirected, finalUrl: currentStr, error: hopResult.error };
        }
        if (hopResult.status >= 300 && hopResult.status < 400) {
          if (hop === MAX_REDIRECTS) {
            return { status: null, ok: false, redirected, finalUrl: currentStr, error: "Too many redirects" };
          }
          if (!hopResult.location) {
            return { status: hopResult.status, ok: false, redirected, finalUrl: currentStr, error: "Redirect without Location header" };
          }
          const nextStr = new URL(hopResult.location, currentStr).toString();
          let nextHost: string;
          try { nextHost = new URL(nextStr).hostname; } catch { nextHost = originalHost; }
          if (nextHost !== originalHost) redirected = true;
          currentStr = nextStr;
          continue;
        }
        return { status: hopResult.status, ok: hopResult.ok, redirected, finalUrl: currentStr, error: null };
      }
      return { status: null, ok: false, redirected, finalUrl: currentStr, error: "Too many redirects" };
    };

    let outcome = await runProbe("HEAD");
    if (outcome.status === 405) outcome = await runProbe("GET");
    return res.json(outcome);
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

      const autoExtraction = await autoExtractDownloaded(
        records as unknown as Record<string, unknown>[],
      );
      const summary = {
        retried_blocker_id: blocker.id,
        edition_id: candidateRow.editionId,
        download_status: status,
        outcome,
        new_blocker_reason: newBlocker?.reason ?? null,
        auto_extraction: autoExtraction,
        entries: records,
      };
      await finishRun(runId, true, summary);
      res.json({ run: { id: runId, status: "completed" }, ...summary });
    } catch (e) {
      const message = errMessage(e);
      // Recording the fresh blocker is bookkeeping — if that write fails too,
      // the run must still reach a final state with the original reason.
      try {
        await db.insert(hunterBlockers).values({
          runId,
          sourceId: blocker.sourceId,
          url: blocker.url,
          reason: "fetch_failed",
          detail: truncateText(`Retry of blocker #${blocker.id} failed: ${message}`, MAX_ERROR_TEXT),
          workId: blocker.workId,
          editionId: blocker.editionId,
        });
      } catch (writeError) {
        console.error(`run ${runId}: could not record retry blocker:`, cleanErrorText(writeError));
      }
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
          const tradition = traditionForWork(row.workId);
          return {
            ...row,
            title: typeof record.title === "string" && record.title.trim() ? record.title : null,
            tradition: { id: tradition.id, label: tradition.label, order: tradition.order },
            family: (() => {
              const family = familyForTradition(tradition.id);
              return { id: family.id, label: family.label, order: family.order };
            })(),
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

  // Bulk status for all extraction jobs (auto-started ones included) so the
  // corpus list can show running extractions without opening the modal.
  app.get("/api/hunter/extraction/jobs", requireEditor, (_req, res) => {
    res.json(listExtractionJobs());
  });

  // Tesseract language packs installed on this machine, for the OCR picker.
  app.get("/api/hunter/extraction/ocr-languages", async (_req, res) => {
    try {
      res.json(await listOcrLanguages());
    } catch (e) {
      res.status(500).json({ message: errMessage(e) });
    }
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
        ocrLanguage: req.body?.ocr_language ? String(req.body.ocr_language) : null,
        workLanguage: row.language ?? ((record.language as string | undefined) ?? null),
      });
      res.json(job);
    } catch (e) {
      res.status(422).json({ message: errMessage(e) });
    }
  });

  // Cancel a running extraction (e.g. a long OCR run on a big scan). The
  // job is marked "cancelled" immediately; the OCR/crawl loop stops promptly.
  app.post("/api/hunter/corpus/:id/extract/cancel", requireEditor, (req, res) => {
    const id = parseInt(String(req.params.id));
    if (!Number.isInteger(id)) return res.status(400).json({ message: "Invalid id" });
    try {
      const job = cancelExtraction(id);
      if (!job) return res.status(404).json({ message: "No extraction has been started for this file" });
      res.json(job);
    } catch (e) {
      res.status(409).json({ message: errMessage(e) });
    }
  });

  // Editor action: scan the corpus for files with no readable sibling and
  // queue extraction for them (throttled, one at a time). Responds when the
  // pass completes — with the default limit this stays a bounded batch.
  app.post("/api/hunter/extraction/backfill", requireEditor, async (req, res) => {
    try {
      const rawLimit = Number(req.body?.limit);
      const limit = Number.isInteger(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, 100) : undefined;
      res.json(await backfillMissingReadables({ limit }));
    } catch (e) {
      res.status(500).json({ message: errMessage(e) });
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
        const tradition = traditionForWork(row.workId);
        const family = familyForTradition(tradition.id);
        const chronology = chronologyForWork(row.workId);
        return {
          tradition: tradition.id,
          traditionLabel: tradition.label,
          family: family.id,
          familyLabel: family.label,
          compositionYear: chronology?.year ?? null,
          eraLabel: chronology?.era ?? null,
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
      // download stays available as a fallback for genuine plain text only.
      const markdown = hasReadable(resolved)
        ? await fs.readFile(readablePaths(resolved).markdown, "utf-8").catch(() => null)
        : null;
      const base = {
        id: row.id,
        title: (record.title as string | undefined) ?? row.editionId,
        author: (record.author as string | undefined) ?? null,
        translator: (record.translator as string | undefined) ?? null,
        language: row.language,
      };
      if (markdown !== null) {
        return res.json({ ...base, text: null, markdown, readable_status: "ready" });
      }
      if (!looksLikeMarkup(row.path, text)) {
        // Genuine plain text: safe to show the raw bytes directly.
        return res.json({ ...base, text, markdown: null, readable_status: "plain" });
      }
      // Markup (HTML/JSON/XML...) with no readable sibling: never show the
      // raw bytes to readers. Queue extraction in the background so the
      // readable version appears shortly, and tell the client to poll.
      const status = await queueReaderExtraction(row, resolved);
      return res.json({ ...base, text: null, markdown: null, ...status });
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

  // ---- Screen-verdict management -----------------------------------------

  /** List all cached AI screening verdicts, newest first. */
  app.get("/api/hunter/screen-verdicts", requireEditor, async (_req, res) => {
    const rows = await db
      .select()
      .from(hunterScreenVerdicts)
      .orderBy(desc(hunterScreenVerdicts.id));
    res.json(rows);
  });

  /**
   * Delete a cached verdict so the next cycle re-screens the title fresh.
   */
  app.delete("/api/hunter/screen-verdicts/:id", requireEditor, async (req, res) => {
    const id = parseInt(String(req.params.id), 10);
    if (isNaN(id)) return res.status(400).json({ message: "Invalid id" });
    const [row] = await db
      .delete(hunterScreenVerdicts)
      .where(eq(hunterScreenVerdicts.id, id))
      .returning();
    if (!row) return res.status(404).json({ message: "Verdict not found" });
    res.json({ deleted: true, id });
  });

  /**
   * Flip a verdict's classification (primary ↔ secondary) so the next cycle
   * honours the correction without going back to the model.
   */
  app.patch("/api/hunter/screen-verdicts/:id", requireEditor, async (req, res) => {
    const id = parseInt(String(req.params.id), 10);
    if (isNaN(id)) return res.status(400).json({ message: "Invalid id" });
    const classification = String(req.body?.classification ?? "");
    if (classification !== "primary" && classification !== "secondary") {
      return res.status(400).json({ message: "classification must be primary or secondary" });
    }
    const justification = req.body?.justification
      ? String(req.body.justification)
      : `Manually overridden by editor`;
    const [row] = await db
      .update(hunterScreenVerdicts)
      .set({ classification, justification })
      .where(eq(hunterScreenVerdicts.id, id))
      .returning();
    if (!row) return res.status(404).json({ message: "Verdict not found" });
    res.json(row);
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

export interface ReadableBackfillSummary {
  scanned: number;
  queued: number;
  skipped: number;
  failed: { id: number; path: string; error: string }[];
}

/**
 * Queue a background extraction for a corpus file a reader requested that has
 * no readable sibling yet. Reuses the existing extraction job machinery.
 * Returns the readable status to report to the reader:
 *   - preparing: an extraction is running (just started or already in flight)
 *   - failed:    the last extraction errored, or no recipe applies
 */
async function queueReaderExtraction(
  row: typeof hunterCorpusFiles.$inferSelect,
  rawAbsolutePath: string,
): Promise<{ readable_status: "preparing" | "failed"; readable_error: string | null }> {
  const existing = getExtractionJob(row.id);
  if (existing?.status === "running") {
    return { readable_status: "preparing", readable_error: null };
  }
  if (existing?.status === "error" || existing?.status === "cancelled" || existing?.status === "interrupted") {
    // Don't retry automatically in a loop; editors can re-extract manually.
    return {
      readable_status: "failed",
      readable_error: existing.error ?? "The last extraction did not finish.",
    };
  }
  const record = (row.record ?? {}) as Record<string, unknown>;
  const file = (record.file ?? {}) as Record<string, unknown>;
  const sourceReference = (record.source_reference as string | undefined) ?? null;
  try {
    await startExtraction({
      corpusFileId: row.id,
      rawAbsolutePath,
      recipeId: null,
      contentType: (file.content_type as string | undefined) ?? null,
      sourceUrl: sourceReference && /^https:\/\//.test(sourceReference) ? sourceReference : null,
      title: (record.title as string | undefined) ?? null,
      locked: row.partition === "locked",
      workLanguage: row.language ?? ((record.language as string | undefined) ?? null),
    });
    return { readable_status: "preparing", readable_error: null };
  } catch (e) {
    return { readable_status: "failed", readable_error: errMessage(e) };
  }
}

/**
 * Backfill readable siblings for corpus files downloaded before auto
 * extraction existed (including `already_present` re-downloads that
 * auto-extraction skips). Plain-text files need no sibling and are skipped.
 * Jobs run one at a time — each extraction is awaited before the next is
 * queued — so a large library never floods the process or remote sites.
 */
export async function backfillMissingReadables(
  options: { limit?: number } = {},
): Promise<ReadableBackfillSummary> {
  const limit = options.limit ?? 25;
  const summary: ReadableBackfillSummary = { scanned: 0, queued: 0, skipped: 0, failed: [] };
  const rows = await db.select().from(hunterCorpusFiles).orderBy(hunterCorpusFiles.id);
  for (const row of rows) {
    if (summary.queued >= limit) break;
    summary.scanned += 1;
    try {
      const resolved = path.resolve(CORPUS_ROOT, row.path);
      const rel = path.relative(CORPUS_ROOT, resolved);
      if (rel.startsWith("..") || path.isAbsolute(rel)) {
        summary.skipped += 1;
        continue;
      }
      if (hasReadable(resolved)) {
        summary.skipped += 1;
        continue;
      }
      const content = await fs.readFile(resolved, "utf-8").catch(() => null);
      if (content === null) {
        // Binary or missing: binary formats (PDF/DOCX) still need extraction,
        // missing files should fail loudly below via startExtraction.
        const stat = await fs.stat(resolved).catch(() => null);
        if (!stat) {
          summary.skipped += 1;
          continue;
        }
      } else if (!looksLikeMarkup(row.path, content)) {
        summary.skipped += 1; // genuine plain text reads fine as-is
        continue;
      }
      const existing = getExtractionJob(row.id);
      if (existing?.status === "running") {
        summary.skipped += 1;
        continue;
      }
      const status = await queueReaderExtraction(row, resolved);
      if (status.readable_status === "failed") {
        summary.failed.push({ id: row.id, path: row.path, error: status.readable_error ?? "unknown" });
        continue;
      }
      summary.queued += 1;
      // Throttle: wait for this job to settle before queuing the next one.
      for (;;) {
        const job = getExtractionJob(row.id);
        if (!job || job.status !== "running") break;
        await new Promise((r) => setTimeout(r, 1000));
      }
    } catch (e) {
      summary.failed.push({ id: row.id, path: row.path, error: errMessage(e) });
    }
  }
  return summary;
}

/**
 * Work through the open Archive blockers, resolving each link against the
 * item's real file list and retrying the download once. Each blocker is
 * attempted exactly once — the claim is written to the row before any network
 * request, so a crash or a second pass cannot loop on the same entry.
 *
 * Bounded concurrency; the resolver itself honours the source's request rate.
 */
export async function repairArchiveBacklog(
  options: { concurrency?: number } = {},
): Promise<ArchiveBacklogSummary> {
  const rows = await db
    .select()
    .from(hunterBlockers)
    .where(
      and(
        eq(hunterBlockers.status, "open"),
        inArray(hunterBlockers.reason, MANUAL_ONLY_REASONS),
        isNull(hunterBlockers.repairState),
        like(hunterBlockers.url, "%archive.org/%"),
      ),
    )
    .orderBy(desc(hunterBlockers.id))
    .limit(200);
  const summary: ArchiveBacklogSummary = { scanned: 0, repaired: 0, unrepairable: 0 };
  if (rows.length === 0) return summary;

  // One repair per URL: duplicate blockers for the same link share the outcome
  // instead of hitting the Archive again.
  const groups = new Map<string, typeof rows>();
  for (const row of rows) {
    const key = row.url ?? `#${row.id}`;
    const group = groups.get(key);
    if (group) group.push(row);
    else groups.set(key, [row]);
  }

  const policy = await loadActivePolicy();
  const registry = await loadActiveRegistry();
  const runId = await createRun("archive-repair");
  const queue = Array.from(groups.values());
  const workerCount = Math.max(1, Math.min(options.concurrency ?? 2, 4));

  const worker = async () => {
    while (queue.length > 0) {
      const group = queue.shift();
      if (!group) break;
      try {
        const repaired = await repairArchiveBlockerGroup(group, { policy, registry, runId });
        summary.scanned += 1;
        if (repaired) summary.repaired += 1;
        else summary.unrepairable += 1;
      } catch (e) {
        summary.scanned += 1;
        summary.unrepairable += 1;
        console.error("archive repair failed for blocker group:", errMessage(e));
      }
    }
  };
  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  await finishRun(runId, true, summary);
  return summary;
}

let archiveBacklogPass: Promise<ArchiveBacklogSummary> | null = null;

export interface ArchiveBacklogSummary {
  scanned: number;
  repaired: number;
  unrepairable: number;
}

/** Repair one group of blockers that all point at the same Archive URL. */
async function repairArchiveBlockerGroup(
  group: (typeof hunterBlockers.$inferSelect)[],
  context: { policy: Policy; registry: Record<string, unknown>; runId: number },
): Promise<boolean> {
  const primary = group[0];
  // Claim the row before any network work so this entry is attempted once.
  const claimed = await db
    .update(hunterBlockers)
    .set({ repairState: "in_progress", updatedAt: new Date() })
    .where(
      and(
        inArray(
          hunterBlockers.id,
          group.map((row) => row.id),
        ),
        isNull(hunterBlockers.repairState),
      ),
    )
    .returning({ id: hunterBlockers.id });
  if (claimed.length === 0) return false;

  const ids = group.map((row) => row.id);
  const finish = async (fields: {
    repairState: string;
    repairDetail: string;
    resolvedUrl?: string | null;
    itemUrl?: string | null;
    status?: string;
  }) => {
    await db
      .update(hunterBlockers)
      .set({
        repairState: fields.repairState,
        repairDetail: fields.repairDetail,
        resolvedUrl: fields.resolvedUrl ?? null,
        itemUrl: fields.itemUrl ?? null,
        ...(fields.status ? { status: fields.status } : {}),
        updatedAt: new Date(),
      })
      .where(inArray(hunterBlockers.id, ids));
  };

  // Find the candidate this blocker points at: by edition first, then by URL.
  const rows = await loadCandidateRows();
  let candidateRow = primary.editionId
    ? rows.find((r) => r.editionId === primary.editionId)
    : undefined;
  if (!candidateRow && primary.url) {
    candidateRow = rows.find(
      (r) => String((r.data as Record<string, unknown> | null)?.text_url ?? "") === primary.url,
    );
  }
  // Entries recorded before their candidate existed (or whose candidate row was
  // since removed) are still repairable: the Archive item's own metadata
  // supplies the title, author and language the download needs.
  const candidate = candidateRow
    ? candidateFromRow(candidateRow)
    : candidateFromBlocker(primary);
  if (!candidate) {
    await finish({
      repairState: "not_repairable",
      repairDetail:
        "Auto-repair tried and failed: this entry has no Internet Archive link to check. Fetch the text by hand and upload it, or re-run a hunting cycle for this source.",
    });
    return false;
  }
  const outcome = await repairArchiveDownload(candidate, {
    policy: context.policy,
    registry: context.registry,
    corpusRoot: CORPUS_ROOT,
    userAgent: CYCLE_USER_AGENT,
    robotsCheck: async (url) => robotsAllowsUrl(url, CYCLE_USER_AGENT),
  });

  if (outcome.candidate) {
    if (candidateRow) {
      await db
        .update(hunterCandidates)
        .set({ data: outcome.candidate })
        .where(eq(hunterCandidates.editionId, candidateRow.editionId));
    } else if (outcome.repaired) {
      // Reconstructed from the item itself: keep it so the edition has a
      // candidate for future retries and uploads.
      await db
        .insert(hunterCandidates)
        .values({
          workId: String(outcome.candidate.work_id),
          editionId: String(outcome.candidate.edition_id),
          data: outcome.candidate,
        })
        .onConflictDoNothing();
    }
  }

  const record = outcome.record;
  if (record) {
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
          runId: context.runId,
        })
        .onConflictDoNothing();
    }
    // Rights review is unchanged: a locked download stays locked, and the
    // rights-lock blocker is recorded exactly as a normal cycle would.
    const followUp = outcome.repaired ? blockerFromRecord(record) : null;
    if (followUp && followUp.reason === "rights_locked") {
      await db.insert(hunterBlockers).values({
        runId: context.runId,
        sourceId: followUp.sourceId ?? null,
        url: outcome.resolvedUrl ?? followUp.url ?? null,
        reason: followUp.reason,
        detail: followUp.detail ?? null,
        workId: followUp.workId ?? null,
        editionId: followUp.editionId ?? null,
        itemUrl: outcome.itemUrl ?? null,
      });
    }
    await autoExtractDownloaded([record]);
  }

  await finish({
    repairState: outcome.repaired ? "repaired" : "not_repairable",
    repairDetail: outcome.detail,
    resolvedUrl: outcome.resolvedUrl,
    itemUrl: outcome.itemUrl,
    ...(outcome.repaired ? { status: "resolved" } : {}),
  });
  return outcome.repaired;
}

/**
 * Start (or join) a background pass over the Archive entries already sitting
 * in Manual Fetch. Never blocks the caller: page loads fire this and return
 * immediately, and the queue refreshes as entries resolve.
 */
export function ensureArchiveBacklogRepair(): Promise<ArchiveBacklogSummary> {
  if (!archiveBacklogPass) {
    archiveBacklogPass = repairArchiveBacklog()
      .catch((e) => {
        console.error("archive backlog repair failed:", errMessage(e));
        return { scanned: 0, repaired: 0, unrepairable: 0 };
      })
      .finally(() => {
        archiveBacklogPass = null;
      }) as Promise<ArchiveBacklogSummary>;
  }
  return archiveBacklogPass;
}
