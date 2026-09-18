/**
 * Download complete source texts into public/locked corpus partitions.
 * Faithful port of fulltext.py.
 */

import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import * as fsSync from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import type { FullTextSource } from "./fulltextSources.js";
import {
  PermissionErrorLike,
  selectFulltextSource,
  validateCandidateAccess,
  validateDownloadHop,
} from "./fulltextSources.js";
import { guessContentType } from "./fetch.js";
import { slug } from "./normalization.js";
import { planCandidates, type CandidatePlan, type PlanSelection } from "./planning.js";
import { assessRights, extractEmbeddedNotice, type Candidate, type Policy } from "./rights.js";
import { pyJsonDumpsCompact } from "./records.js";
import { coerceAssessedAt, isoFormat } from "./dateUtil.js";

export const DEFAULT_USER_AGENT =
  "ReligiousMythologyResourceHunter/0.2 (rights-aware research corpus collector)";

const EXTENSIONS: Record<string, string> = {
  txt: ".txt",
  tei_xml: ".xml",
  xml: ".xml",
  html: ".html",
  epub: ".epub",
  pdf: ".pdf",
  json: ".json",
};

class Throttle {
  private lastRequest = new Map<string, number>();

  async wait(source: FullTextSource): Promise<void> {
    const sourceId = String(source.source_id);
    const interval = 1.0 / Number(source.requests_per_second);
    const previous = this.lastRequest.get(sourceId);
    const now = performance.now() / 1000;
    if (previous !== undefined) {
      const remaining = interval - (now - previous);
      if (remaining > 0) {
        await new Promise((resolve) => setTimeout(resolve, Math.min(remaining, 60.0) * 1000));
      }
    }
    this.lastRequest.set(sourceId, performance.now() / 1000);
  }
}

function downloadId(candidate: Candidate): string {
  const identity = [
    String(candidate.work_id),
    String(candidate.edition_id),
    String(candidate.text_url ?? candidate.local_path),
  ].join("|");
  return "download:" + createHash("sha256").update(identity, "utf-8").digest("hex").slice(0, 16);
}

function checksum(payload: Buffer): string {
  return "sha256:" + createHash("sha256").update(payload).digest("hex");
}

/** Optional robots checker: return allowed=false to block a URL fetch. */
export type RobotsCheck = (
  url: string,
  source: FullTextSource,
) => Promise<{ allowed: boolean; reason: string }>;

async function readCandidatePayload(
  candidate: Candidate,
  source: FullTextSource,
  options: {
    userAgent: string;
    maximumBytes: number;
    throttle: Throttle;
    robotsCheck?: RobotsCheck;
    fetchImpl?: typeof fetch;
  },
): Promise<{ payload: Buffer; contentType: string | null }> {
  validateCandidateAccess(candidate, source);
  if (candidate.local_path) {
    const p = String(candidate.local_path);
    const stat = await fs.stat(p).catch(() => null);
    if (!stat || !stat.isFile()) {
      throw new Error(`local full text does not exist: ${p}`);
    }
    if (stat.size > options.maximumBytes) {
      throw new Error("local full text exceeds maximum_file_bytes");
    }
    const payload = await fs.readFile(p);
    const guessed = guessContentType(p);
    return { payload, contentType: guessed || null };
  }

  // Follow redirects manually so every hop is re-validated: each URL must
  // satisfy the source's primary allow-list or (for redirect hops only) one of
  // its declared trusted_redirects rules, and robots.txt is re-checked per hop.
  const fetchImpl = options.fetchImpl ?? fetch;
  const maximumRedirects = 5;
  let current = String(candidate.text_url);
  let response: Response | null = null;
  for (let hop = 0; hop <= maximumRedirects; hop += 1) {
    validateDownloadHop(current, source, { isRedirect: hop > 0 });
    if (options.robotsCheck && source.robots_mode === "target_origin") {
      const decision = await options.robotsCheck(current, source);
      if (!decision.allowed) {
        throw new PermissionErrorLike(`robots policy disallows download: ${decision.reason}`);
      }
    }
    await options.throttle.wait(source);
    const hopResponse = await fetchImpl(current, {
      headers: {
        Accept:
          "text/plain, application/xml, text/xml, text/html, application/epub+zip, application/pdf, application/json",
        "User-Agent": options.userAgent,
      },
      redirect: "manual",
    });
    if (hopResponse.status >= 300 && hopResponse.status < 400) {
      const location = hopResponse.headers.get("location");
      if (!location) {
        throw new Error(`redirect without location (${hopResponse.status})`);
      }
      current = new URL(location, current).toString();
      continue;
    }
    if (!hopResponse.ok) {
      throw new Error(`download failed (${hopResponse.status})`);
    }
    response = hopResponse;
    break;
  }
  if (!response) {
    throw new Error("too many redirects during download");
  }
  const payload = Buffer.from(await response.arrayBuffer());
  if (payload.length > options.maximumBytes) {
    throw new Error("remote full text exceeds maximum_file_bytes");
  }
  const contentType = (response.headers.get("content-type") || "").split(";")[0].trim() || null;
  return { payload, contentType };
}

/**
 * Longest slug used as one path component. Filesystems cap a single name at
 * 255 bytes; the edition component also carries an extension and the
 * ".rights.json" / ".LOCK.json" suffixes, and the temp file lives beside it.
 * Work titles copied from library catalogues routinely exceed this.
 */
export const MAX_PATH_COMPONENT = 160;

/**
 * Shorten an over-long slug to fit in one path component while keeping it
 * unique: the head of the slug (cut at a word boundary) plus a short hash of
 * the full value. Slugs within the limit are returned unchanged, so existing
 * corpus paths are unaffected.
 */
export function safePathComponent(value: string, max = MAX_PATH_COMPONENT): string {
  if (value.length <= max) return value;
  const digest = createHash("sha256").update(value, "utf-8").digest("hex").slice(0, 10);
  let head = value.slice(0, max - digest.length - 1);
  const cut = head.lastIndexOf("-");
  if (cut > max / 2) head = head.slice(0, cut);
  return `${head}-${digest}`;
}

export function editionPaths(
  corpusRoot: string,
  candidate: Candidate,
  locked: boolean,
): { textPath: string; rightsPath: string; lockPath: string | null } {
  const workComponent = safePathComponent(
    slug(String(candidate.work_id).split(":").slice(1).join(":") || String(candidate.work_id)),
  );
  const editionRaw = String(candidate.edition_id);
  const editionComponent = safePathComponent(
    slug(editionRaw.includes(":") ? editionRaw.slice(editionRaw.indexOf(":") + 1) : editionRaw),
  );
  const extension = EXTENSIONS[String(candidate.format)];
  const partition = locked ? "locked" : "public";
  const textPath = path.join(corpusRoot, partition, workComponent, `${editionComponent}${extension}`);
  const rightsPath = path.join(corpusRoot, "rights", workComponent, `${editionComponent}.rights.json`);
  const lockPath = locked ? textPath + ".LOCK.json" : null;
  return { textPath, rightsPath, lockPath };
}

async function atomicWrite(filePath: string, payload: Buffer, mode: number): Promise<string> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const desired = checksum(payload);
  if (fsSync.existsSync(filePath)) {
    const existing = await fs.readFile(filePath);
    if (checksum(existing) !== desired) {
      throw new Error(`refusing to overwrite different existing file: ${filePath}`);
    }
    await fs.chmod(filePath, mode);
    return "already_present";
  }
  const tempPath = path.join(path.dirname(filePath), `.partial-${uniqueSuffix()}`);
  await fs.writeFile(tempPath, payload);
  await fs.chmod(tempPath, mode);
  await fs.rename(tempPath, filePath);
  return "downloaded";
}

async function writeJson(
  filePath: string,
  value: Record<string, unknown>,
  mode: number,
): Promise<void> {
  const payload = Buffer.from(JSON.stringify(value, null, 2) + "\n", "utf-8");
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  if (fsSync.existsSync(filePath)) {
    const existing = await fs.readFile(filePath);
    if (existing.equals(payload)) {
      await fs.chmod(filePath, mode);
      return;
    }
  }
  const tempPath = path.join(path.dirname(filePath), `.metadata-${uniqueSuffix()}`);
  await fs.writeFile(tempPath, payload);
  await fs.chmod(tempPath, mode);
  await fs.rename(tempPath, filePath);
}

let counter = 0;
function uniqueSuffix(): string {
  counter += 1;
  return `${process.pid}-${Date.now()}-${counter}-${Math.random().toString(36).slice(2)}`;
}

function relative(filePath: string | null, root: string): string | null {
  if (filePath === null) {
    return null;
  }
  return path.relative(root, filePath);
}

function baseRecord(plan: CandidatePlan, selection: PlanSelection): Record<string, unknown> {
  const candidate = plan.candidate;
  return {
    schema_version: "1.0.0",
    download_id: downloadId(candidate),
    work_id: candidate.work_id,
    edition_id: candidate.edition_id,
    title: candidate.title,
    author: candidate.author ?? null,
    translator: candidate.translator ?? null,
    language: candidate.language,
    language_role: candidate.language_role,
    original_language: candidate.original_language ?? null,
    source_id: candidate.source_id,
    source_reference: String(candidate.text_url ?? candidate.local_path),
    format: candidate.format,
    selection: { ...selection },
    rights: plan.rights_assessment,
    download_status: "not_selected",
    file: null,
    error: null,
    retrieved_at: null,
  };
}

async function writeCorpusReadme(root: string): Promise<void> {
  const filePath = path.join(root, "README.txt");
  const content = Buffer.from(
    "FULL-TEXT CORPUS\n\n" +
      "public/ contains editions whose explicit rights evidence permits publication under the configured policy.\n" +
      "locked/ contains research copies that MUST NOT be republished. Every locked file has a .LOCK.json marker and restrictive local permissions.\n" +
      "rights/ contains the per-edition decision and evidence. corpus.jsonl is the machine-readable index.\n\n" +
      "A lock is a safety control, not a legal determination or DRM.\n",
    "utf-8",
  );
  if (fsSync.existsSync(filePath)) {
    const existing = await fs.readFile(filePath);
    if (existing.equals(content)) {
      return;
    }
    throw new Error(`refusing to overwrite corpus README: ${filePath}`);
  }
  await atomicWrite(filePath, content, 0o644);
}

/**
 * Plan the candidates, then download the selected editions into a public/locked
 * corpus partition under `corpusRoot`, writing rights sidecars, lock markers and
 * the corpus.jsonl manifest exactly like the Python tool.
 * `assessedAt` accepts an ISO string or Date (defaults to now).
 */
export async function collectFulltexts(
  candidates: Iterable<Candidate>,
  policy: Policy,
  registry: Record<string, unknown>,
  corpusRoot: string,
  options: {
    assessedAt?: string | Date;
    selectionMode?: string;
    userAgent?: string;
    robotsCheck?: RobotsCheck;
    fetchImpl?: typeof fetch;
  } = {},
): Promise<Record<string, unknown>[]> {
  const selectionMode = options.selectionMode ?? "preferred";
  const userAgent = options.userAgent ?? DEFAULT_USER_AGENT;
  const assessedAt = coerceAssessedAt(options.assessedAt);
  if (!["preferred", "all"].includes(selectionMode)) {
    throw new Error("selection_mode must be preferred or all");
  }
  const plans = planCandidates(candidates, policy, { assessedAt });
  await fs.mkdir(corpusRoot, { recursive: true });
  await writeCorpusReadme(corpusRoot);
  const throttle = new Throttle();
  const records: Record<string, unknown>[] = [];
  for (const plan of plans) {
    const candidate = plan.candidate;
    const access = candidate.access as Record<string, unknown>;
    let selection: PlanSelection = { ...plan.selection };
    if (selectionMode === "all" && access.download_allowed) {
      selection = { selected: true, reason: "all_authorized_editions", rank: 50 };
    }
    const record = baseRecord(plan, selection);
    if (!selection.selected) {
      records.push(record);
      continue;
    }
    if (!access.download_allowed || access.requires_auth) {
      record.download_status = "metadata_only";
      records.push(record);
      continue;
    }
    try {
      const source = selectFulltextSource(registry, String(candidate.source_id));
      const { payload, contentType } = await readCandidatePayload(candidate, source, {
        userAgent,
        maximumBytes: Number(policy.maximum_file_bytes),
        throttle,
        robotsCheck: options.robotsCheck,
        fetchImpl: options.fetchImpl,
      });
      const embeddedNotice = extractEmbeddedNotice(payload, String(candidate.format));
      const finalRights = assessRights(candidate, policy, { embeddedNotice, assessedAt });
      record.rights = finalRights;
      const { textPath, rightsPath, lockPath } = editionPaths(
        corpusRoot,
        candidate,
        finalRights.locked,
      );
      const status = await atomicWrite(textPath, payload, finalRights.locked ? 0o600 : 0o644);
      const rightsDocument = {
        schema_version: "1.0.0",
        work_id: candidate.work_id,
        edition_id: candidate.edition_id,
        source_id: candidate.source_id,
        source_reference: record.source_reference,
        rights: finalRights,
        candidate_rights_evidence: candidate.rights,
        file_sha256: checksum(payload),
      };
      await writeJson(rightsPath, rightsDocument, finalRights.locked ? 0o600 : 0o644);
      if (lockPath) {
        const lockDocument = {
          locked: true,
          do_not_publish: true,
          work_id: candidate.work_id,
          edition_id: candidate.edition_id,
          rights_status: finalRights.status,
          reasons: finalRights.reasons,
          rights_record: relative(rightsPath, corpusRoot),
        };
        await writeJson(lockPath, lockDocument, 0o600);
      }
      record.download_status = status;
      record.retrieved_at = isoFormat(assessedAt);
      record.file = {
        relative_path: relative(textPath, corpusRoot),
        bytes: payload.length,
        sha256: checksum(payload),
        content_type: contentType,
        locked: finalRights.locked,
        lock_path: relative(lockPath, corpusRoot),
        rights_path: relative(rightsPath, corpusRoot),
      };
    } catch (error) {
      if (error instanceof PermissionErrorLike) {
        record.download_status = "metadata_only";
        record.error = error.message;
      } else {
        record.download_status = "failed";
        record.error = error instanceof Error ? error.message : String(error);
      }
    }
    records.push(record);
  }
  await writeCorpusManifest(path.join(corpusRoot, "corpus.jsonl"), records);
  return records;
}

/**
 * Editor-approved manual rights determination used to promote a locked file.
 * This is the ONLY path from the locked partition to public: it requires an
 * explicit human decision (never AI claims) and leaves an auditable trail in
 * the rights sidecar.
 */
export interface ManualDetermination {
  status: "public_domain" | "open_license";
  basis: string;
  notes?: string | null;
  reviewer?: string | null;
  determinedAt?: string | Date;
}
/** Write the corpus.jsonl manifest (compact JSON lines, mode 0644). */
export async function writeCorpusManifest(
  filePath: string,
  records: Iterable<Record<string, unknown>>,
): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const lines: string[] = [];
  for (const record of Array.from(records)) {
    lines.push(pyJsonDumpsCompact(record));
  }
  const payload = Buffer.from(lines.length > 0 ? lines.join("\n") + "\n" : "", "utf-8");
  const tempPath = path.join(path.dirname(filePath), `.manifest-${uniqueSuffix()}`);
  await fs.writeFile(tempPath, payload);
  await fs.chmod(tempPath, 0o644);
  await fs.rename(tempPath, filePath);
}

/** Read the corpus.jsonl manifest into record objects. */
export async function iterCorpusManifest(filePath: string): Promise<Record<string, unknown>[]> {
  const text = await fs.readFile(filePath, "utf-8");
  const out: Record<string, unknown>[] = [];
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (!line.trim()) {
      continue;
    }
    const value = JSON.parse(line);
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new Error(`${filePath}:${i + 1}: corpus record is not an object`);
    }
    out.push(value as Record<string, unknown>);
  }
  return out;
}

/** Counts returned by verifyCorpus (keys match the Python verify-corpus output). */
export interface CorpusCounts {
  records: number;
  downloaded: number;
  public: number;
  locked: number;
  metadata_only: number;
  not_selected: number;
  failed: number;
}

async function fileMode(p: string): Promise<number> {
  const stat = await fs.stat(p);
  return stat.mode;
}

/**
 * Verify a corpus: byte counts, checksums, partitions, permissions and lock
 * markers, mirroring the Python verify-corpus command. Throws on any problem.
 */
export async function verifyCorpus(corpusRoot: string): Promise<CorpusCounts> {
  const manifestPath = path.join(corpusRoot, "corpus.jsonl");
  const counts: CorpusCounts = {
    records: 0,
    downloaded: 0,
    public: 0,
    locked: 0,
    metadata_only: 0,
    not_selected: 0,
    failed: 0,
  };
  const root = path.resolve(corpusRoot);
  for (const record of await iterCorpusManifest(manifestPath)) {
    counts.records += 1;
    const status = record.download_status as string;
    if (status === "downloaded" || status === "already_present") {
      counts.downloaded += 1;
      const fileInfo = record.file;
      if (!fileInfo || typeof fileInfo !== "object" || Array.isArray(fileInfo)) {
        throw new Error("downloaded corpus record has no file");
      }
      const info = fileInfo as Record<string, unknown>;
      const p = path.resolve(corpusRoot, String(info.relative_path));
      if (!isInside(root, p)) {
        throw new Error("corpus file escapes corpus root");
      }
      const stat = await fs.stat(p).catch(() => null);
      if (!stat || !stat.isFile()) {
        throw new Error(`missing corpus file: ${p}`);
      }
      const payload = await fs.readFile(p);
      if (payload.length !== info.bytes) {
        throw new Error(`byte count mismatch: ${p}`);
      }
      if (checksum(payload) !== info.sha256) {
        throw new Error(`checksum mismatch: ${p}`);
      }
      const rightsRelative = info.rights_path;
      if (!rightsRelative) {
        throw new Error(`corpus file has no rights record: ${p}`);
      }
      const rightsPath = path.resolve(corpusRoot, String(rightsRelative));
      if (!isInside(root, rightsPath)) {
        throw new Error("rights record escapes corpus root");
      }
      const rightsStat = await fs.stat(rightsPath).catch(() => null);
      if (!rightsStat || !rightsStat.isFile()) {
        throw new Error(`missing rights record: ${rightsPath}`);
      }
      const rightsDocument = JSON.parse(await fs.readFile(rightsPath, "utf-8"));
      if (rightsDocument.edition_id !== record.edition_id) {
        throw new Error(`rights record edition mismatch: ${rightsPath}`);
      }
      if (rightsDocument.file_sha256 !== info.sha256) {
        throw new Error(`rights record checksum mismatch: ${rightsPath}`);
      }
      const recordRights = record.rights as Record<string, unknown>;
      if (info.locked) {
        counts.locked += 1;
        if (!info.lock_path) {
          throw new Error(`locked file has no lock marker: ${p}`);
        }
        const lockPath = path.resolve(corpusRoot, String(info.lock_path));
        if (!isInside(root, lockPath)) {
          throw new Error("lock marker escapes corpus root");
        }
        const lockStat = await fs.stat(lockPath).catch(() => null);
        if (!lockStat || !lockStat.isFile()) {
          throw new Error(`missing lock marker: ${lockPath}`);
        }
        const lockDocument = JSON.parse(await fs.readFile(lockPath, "utf-8"));
        if (!lockDocument.do_not_publish || lockDocument.edition_id !== record.edition_id) {
          throw new Error(`invalid lock marker: ${lockPath}`);
        }
        if (
          ((await fileMode(p)) & 0o077) !== 0 ||
          ((await fileMode(lockPath)) & 0o077) !== 0 ||
          ((await fileMode(rightsPath)) & 0o077) !== 0
        ) {
          throw new PermissionErrorLike(`locked material permissions are too broad: ${p}`);
        }
        if (recordRights.publication_allowed) {
          throw new Error(`locked file marked publishable: ${p}`);
        }
      } else {
        counts.public += 1;
        if (!recordRights.publication_allowed) {
          throw new Error(`public file is not cleared for publication: ${p}`);
        }
      }
    } else if (status in counts) {
      (counts as unknown as Record<string, number>)[status] += 1;
    } else {
      throw new Error(`unsupported download_status: ${status}`);
    }
  }
  return counts;
}

function isInside(root: string, target: string): boolean {
  const rel = path.relative(root, target);
  return rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel));
}

// Keep os import referenced for potential temp-dir consumers.
void os;

/**
 * Promote a locked corpus file to the public partition after an editor's
 * manual rights determination. Moves the text out of locked/, relaxes
 * permissions, removes the .LOCK.json marker, rewrites the rights sidecar
 * with the manual determination appended, and updates the corpus.jsonl
 * manifest. Returns the updated corpus record.
 */
export async function promoteLockedFile(
  corpusRoot: string,
  record: Record<string, unknown>,
  determination: ManualDetermination,
): Promise<Record<string, unknown>> {
  const root = path.resolve(corpusRoot);
  const file = record.file as Record<string, unknown> | undefined;
  if (!file || !file.relative_path) {
    throw new Error("corpus record has no downloaded file");
  }
  if (!file.locked) {
    throw new Error("file is not locked");
  }
  const lockedPath = path.resolve(root, String(file.relative_path));
  const lockedRoot = path.join(root, "locked");
  const relFromLocked = path.relative(lockedRoot, lockedPath);
  if (relFromLocked === "" || relFromLocked.startsWith("..") || path.isAbsolute(relFromLocked)) {
    throw new Error("locked file path escapes the locked partition");
  }
  const stat = await fs.stat(lockedPath).catch(() => null);
  if (!stat || !stat.isFile()) {
    throw new Error(`locked file is missing: ${lockedPath}`);
  }
  const payload = await fs.readFile(lockedPath);
  if (file.sha256 && checksum(payload) !== file.sha256) {
    throw new Error("locked file checksum mismatch; refusing to promote");
  }

  const publicPath = path.join(root, "public", relFromLocked);
  if (fsSync.existsSync(publicPath)) {
    throw new Error(`public file already exists: ${publicPath}`);
  }

  const determinedAt = isoFormat(coerceAssessedAt(determination.determinedAt));
  const priorRights = (record.rights ?? {}) as Record<string, unknown>;
  const manualDetermination = {
    status: determination.status,
    basis: determination.basis,
    notes: determination.notes ?? null,
    reviewer: determination.reviewer ?? null,
    determined_at: determinedAt,
    previous_status: priorRights.status ?? null,
    previous_reasons: priorRights.reasons ?? [],
  };
  const newRights: Record<string, unknown> = {
    ...priorRights,
    status: determination.status,
    confidence: "high",
    basis: "manual",
    statement: determination.basis,
    publication_allowed: true,
    locked: false,
    do_not_publish: false,
    review_required: false,
    territory_covered: true,
    reasons: [`editor manual determination: ${determination.basis}`],
    assessed_at: determinedAt,
    manual_determination: manualDetermination,
    not_legal_advice: true,
  };

  // Move the text into the public partition.
  await fs.mkdir(path.dirname(publicPath), { recursive: true });
  await fs.rename(lockedPath, publicPath);
  await fs.chmod(publicPath, 0o644);

  // Remove the lock marker.
  const lockRelative = file.lock_path ? String(file.lock_path) : null;
  if (lockRelative) {
    const lockPath = path.resolve(root, lockRelative);
    if (path.relative(root, lockPath).startsWith("..")) {
      throw new Error("lock marker escapes corpus root");
    }
    await fs.rm(lockPath, { force: true });
  }

  // Rewrite the rights sidecar with the manual determination and open perms.
  const rightsRelative = file.rights_path ? String(file.rights_path) : null;
  if (rightsRelative) {
    const rightsPath = path.resolve(root, rightsRelative);
    if (path.relative(root, rightsPath).startsWith("..")) {
      throw new Error("rights record escapes corpus root");
    }
    let rightsDocument: Record<string, unknown> = {};
    try {
      rightsDocument = JSON.parse(await fs.readFile(rightsPath, "utf-8"));
    } catch {
      // Sidecar missing or unreadable: recreate it below.
      rightsDocument = {
        schema_version: "1.0.0",
        work_id: record.work_id,
        edition_id: record.edition_id,
        source_id: record.source_id,
        source_reference: record.source_reference,
        candidate_rights_evidence: null,
        file_sha256: checksum(payload),
      };
    }
    rightsDocument.rights = newRights;
    await fs.rm(rightsPath, { force: true });
    await writeJson(rightsPath, rightsDocument, 0o644);
  }

  const newRelativePath = path.join("public", relFromLocked);
  const updatedRecord: Record<string, unknown> = {
    ...record,
    rights: newRights,
    file: {
      ...file,
      relative_path: newRelativePath,
      locked: false,
      lock_path: null,
    },
  };

  // Update the corpus.jsonl manifest so verifyCorpus stays consistent.
  const manifestPath = path.join(root, "corpus.jsonl");
  try {
    const manifest = await iterCorpusManifest(manifestPath);
    let replaced = false;
    const updatedManifest = manifest.map((entry) => {
      const entryFile = entry.file as Record<string, unknown> | undefined;
      if (
        entry.edition_id === record.edition_id &&
        entryFile &&
        String(entryFile.relative_path) === String(file.relative_path)
      ) {
        replaced = true;
        return updatedRecord;
      }
      return entry;
    });
    if (!replaced) updatedManifest.push(updatedRecord);
    await writeCorpusManifest(manifestPath, updatedManifest);
  } catch {
    // No manifest yet (cycle-only corpus); write one with just this record.
    await writeCorpusManifest(manifestPath, [updatedRecord]);
  }

  return updatedRecord;
}
