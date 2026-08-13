/**
 * Automatic repair of blocked Internet Archive downloads.
 *
 * Wraps the archive item resolver in the one operation the hunter actually
 * needs: given a candidate whose archive.org download was refused (the link
 * points at a viewer path, an invented identifier, or a filename the item does
 * not have), find the file the item really has and download it once through
 * the normal collection pipeline — rights assessment included.
 *
 * The repair never bypasses rights review: it re-runs `collectFulltexts`, so
 * the text lands in the public or locked partition exactly as it would have
 * done had the original URL been correct. Licence evidence is taken from the
 * resolved item's own catalog metadata, never from the previous (wrong) item
 * and never from a model's claim.
 */

import { collectFulltexts, type RobotsCheck } from "./fulltext.js";
import type { Candidate, Policy } from "./rights.js";
import {
  ARCHIVE_FAILURE_MESSAGES,
  isArchiveUrl,
  repairArchiveUrl,
  type ArchiveFailureReason,
  type ArchiveLookupOptions,
  type ArchiveResolution,
} from "./archiveResolver.js";

export const INTERNET_ARCHIVE_SOURCE_ID = "source:internet-archive";

/**
 * Download errors that mean "the URL was wrong", i.e. the ones a resolver can
 * plausibly fix: an unauthorized path (viewer/stream link), a redirect to a
 * node we do not trust, or a file the item does not have (404).
 */
const REPAIRABLE_ERROR = /target path is not allowed|not a trusted redirect|download failed \(404\)/i;

/** True when this download record is an Archive failure worth auto-repairing. */
export function isRepairableArchiveFailure(record: Record<string, unknown>): boolean {
  const status = String(record.download_status ?? "");
  if (status !== "metadata_only" && status !== "failed") return false;
  const sourceId = String(record.source_id ?? "");
  const reference = String(record.source_reference ?? "");
  if (sourceId !== INTERNET_ARCHIVE_SOURCE_ID && !isArchiveUrl(reference)) return false;
  return REPAIRABLE_ERROR.test(String(record.error ?? ""));
}

export interface ArchiveRepairContext {
  policy: Policy;
  registry: Record<string, unknown>;
  corpusRoot: string;
  userAgent?: string;
  fetchImpl?: typeof fetch;
  robotsCheck?: RobotsCheck;
  /** Overrides the source's configured lookup rate (tests). */
  requestsPerSecond?: number;
}

export interface ArchiveRepairOutcome {
  /** True when the resolver found a real file for this candidate. */
  resolved: boolean;
  /** True when the repaired URL downloaded successfully. */
  repaired: boolean;
  resolvedUrl: string | null;
  itemUrl: string | null;
  /** Failure reason code when the repair did not produce a download. */
  reason: ArchiveFailureReason | "download_failed" | null;
  /** Plain-language explanation for editors. */
  detail: string;
  /** Download record produced by the retry (null when nothing was retried). */
  record: Record<string, unknown> | null;
  /** The corrected candidate (null when nothing could be resolved). */
  candidate: Candidate | null;
}

/** Rate limit configured for the Internet Archive source, if registered. */
export function archiveLookupOptions(
  context: ArchiveRepairContext,
  extra: ArchiveLookupOptions = {},
): ArchiveLookupOptions {
  const sources = (context.registry?.sources as Record<string, unknown>[]) ?? [];
  const source = sources.find((s) => s.source_id === INTERNET_ARCHIVE_SOURCE_ID);
  return {
    fetchImpl: context.fetchImpl,
    userAgent: context.userAgent,
    requestsPerSecond:
      context.requestsPerSecond ?? (source ? Number(source.requests_per_second) : undefined),
    maxBytes: Number(context.policy?.maximum_file_bytes) || undefined,
    ...extra,
  };
}

/**
 * Build the corrected candidate: the verified file URL plus licence evidence
 * read from the resolved item's own catalog metadata. Any evidence carried
 * over from the previous (wrong) item is replaced, not merged.
 */
export function applyArchiveResolution(
  candidate: Candidate,
  resolution: ArchiveResolution,
): Candidate {
  const priorRights = (candidate.rights ?? {}) as Record<string, unknown>;
  const licenseUrl = resolution.item.licenseUrl;
  const rights: Record<string, unknown> = {
    status_claim: "unknown",
    basis: "source_metadata",
    statement: licenseUrl
      ? `Internet Archive item licence: ${licenseUrl}`
      : "Internet Archive item; no explicit licence statement found in catalog metadata.",
    license_url: licenseUrl,
    rights_url: resolution.itemUrl,
    archive_item_identifier: resolution.identifier,
    archive_repair: {
      previous_url: candidate.text_url ?? null,
      resolved_via: resolution.viaSearch ? "catalog_search" : "item_metadata",
      possible_copyright_status: resolution.item.possibleCopyrightStatus,
    },
  };
  // Unverified model claims stay in their own keys (never rights evidence).
  if (priorRights.ai_claimed_statement !== undefined) {
    rights.ai_claimed_statement = priorRights.ai_claimed_statement;
  }
  if (priorRights.ai_claimed_license_url !== undefined) {
    rights.ai_claimed_license_url = priorRights.ai_claimed_license_url;
  }
  // A blocker recorded before its candidate existed carries no title or
  // language; the resolved item's own catalog metadata supplies them.
  const title = String(candidate.title ?? "").trim();
  const language = String(candidate.language ?? "").trim();
  return {
    ...candidate,
    title: title || resolution.item.title || resolution.identifier,
    author: candidate.author ?? resolution.item.creator ?? null,
    language: language || archiveLanguageCode(resolution.item.language),
    source_id: INTERNET_ARCHIVE_SOURCE_ID,
    format: resolution.format,
    text_url: resolution.downloadUrl,
    access: { download_allowed: true, requires_auth: false },
    rights,
  } as Candidate;
}

/** Map an Archive `language` value onto a candidate language code. */
function archiveLanguageCode(value: string | null): string {
  const raw = (value ?? "").trim().toLowerCase();
  if (!raw) return "und";
  const named: Record<string, string> = {
    english: "eng", german: "deu", french: "fra", spanish: "spa", italian: "ita",
    latin: "lat", greek: "grc", hebrew: "heb", arabic: "ara", japanese: "jpn",
    chinese: "zho", sanskrit: "san", russian: "rus",
  };
  if (named[raw]) return named[raw];
  return /^[a-z]{2,3}$/.test(raw) ? raw : "und";
}

/**
 * Resolve a candidate's archive.org URL against the item's real file list and,
 * on success, download it once through the normal rights pipeline.
 * Performs at most one resolution and one download attempt.
 */
export async function repairArchiveDownload(
  candidate: Candidate,
  context: ArchiveRepairContext,
): Promise<ArchiveRepairOutcome> {
  const year =
    typeof candidate.publication_year === "number" ? candidate.publication_year : null;
  const resolution = await repairArchiveUrl(
    {
      url: candidate.text_url ? String(candidate.text_url) : null,
      title: candidate.title ? String(candidate.title) : null,
      author: candidate.author ? String(candidate.author) : null,
      year,
    },
    archiveLookupOptions(context),
  );
  if (!resolution.ok) {
    return {
      resolved: false,
      repaired: false,
      resolvedUrl: null,
      itemUrl: resolution.itemUrl,
      reason: resolution.reason,
      detail: `Auto-repair tried and failed: ${resolution.detail}`,
      record: null,
      candidate: null,
    };
  }

  const corrected = applyArchiveResolution(candidate, resolution);
  let record: Record<string, unknown> | null = null;
  try {
    const records = await collectFulltexts(
      [corrected],
      context.policy,
      context.registry,
      context.corpusRoot,
      {
        selectionMode: "all",
        userAgent: context.userAgent,
        robotsCheck: context.robotsCheck,
        fetchImpl: context.fetchImpl,
      },
    );
    record = records[0] ?? null;
  } catch (e) {
    return {
      resolved: true,
      repaired: false,
      resolvedUrl: resolution.downloadUrl,
      itemUrl: resolution.itemUrl,
      reason: "download_failed",
      detail: `Auto-repair found the item's real file but the download failed: ${
        e instanceof Error ? e.message : String(e)
      }`,
      record: null,
      candidate: corrected,
    };
  }

  const status = String(record?.download_status ?? "");
  const repaired = status === "downloaded" || status === "already_present";
  return {
    resolved: true,
    repaired,
    resolvedUrl: resolution.downloadUrl,
    itemUrl: resolution.itemUrl,
    reason: repaired ? null : "download_failed",
    detail: repaired
      ? `Auto-repaired: downloaded ${resolution.fileName} from the Internet Archive item ${resolution.identifier}${
          resolution.viaSearch ? " (found by searching the catalog)" : ""
        }.`
      : `Auto-repair found the item's real file (${resolution.fileName}) but the download was refused: ${
          record?.error ?? "unknown error"
        }`,
    record,
    candidate: corrected,
  };
}

/** Human-readable label for a resolver failure reason. */
export function archiveFailureLabel(reason: string): string {
  return (
    ARCHIVE_FAILURE_MESSAGES[reason as ArchiveFailureReason] ??
    "Auto-repair could not fix this link."
  );
}
