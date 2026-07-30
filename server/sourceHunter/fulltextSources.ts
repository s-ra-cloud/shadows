/**
 * Validation and access checks for full-text source definitions.
 * Faithful port of fulltext_sources.py.
 */

import { promises as fs } from "node:fs";

/** A full-text source definition (loosely typed). */
export type FullTextSource = Record<string, unknown>;

function sorted(values: Iterable<string>): string[] {
  return Array.from(values).sort();
}

/** Validate a full-text source registry; throws on any problem. */
export function validateFulltextRegistry(registry: Record<string, unknown>): void {
  if (registry.schema_version !== "1.0.0") {
    throw new Error("full-text registry schema_version must be 1.0.0");
  }
  const sources = registry.sources;
  if (!Array.isArray(sources)) {
    throw new Error("full-text registry sources must be an array");
  }
  const seen = new Set<string>();
  for (const source of sources) {
    if (!source || typeof source !== "object" || Array.isArray(source)) {
      throw new Error("full-text source must be an object");
    }
    const src = source as Record<string, unknown>;
    const required = [
      "source_id",
      "name",
      "local_only",
      "allowed_hosts",
      "automated_download_allowed",
      "terms_url",
      "robots_mode",
      "requests_per_second",
      "rights_notes",
    ];
    const missing = required.filter((f) => !(f in src));
    if (missing.length > 0) {
      throw new Error(`full-text source is missing: [${sorted(missing).map((m) => `'${m}'`).join(", ")}]`);
    }
    const sourceId = src.source_id;
    if (typeof sourceId !== "string" || !sourceId.startsWith("source:")) {
      throw new Error(`invalid full-text source_id: ${JSON.stringify(sourceId)}`);
    }
    if (seen.has(sourceId)) {
      throw new Error(`duplicate full-text source_id: ${sourceId}`);
    }
    seen.add(sourceId);
    if (typeof src.local_only !== "boolean") {
      throw new Error(`invalid local_only for ${sourceId}`);
    }
    if (typeof src.automated_download_allowed !== "boolean") {
      throw new Error(`invalid automated_download_allowed for ${sourceId}`);
    }
    if (
      !Array.isArray(src.allowed_hosts) ||
      src.allowed_hosts.some((host) => typeof host !== "string" || !host)
    ) {
      throw new Error(`invalid allowed_hosts for ${sourceId}`);
    }
    const prefixes = src.allowed_path_prefixes ?? [];
    if (
      !Array.isArray(prefixes) ||
      prefixes.some((prefix) => typeof prefix !== "string" || !prefix.startsWith("/"))
    ) {
      throw new Error(`invalid allowed_path_prefixes for ${sourceId}`);
    }
    if (!["not_applicable", "target_origin"].includes(src.robots_mode as string)) {
      throw new Error(`invalid robots_mode for ${sourceId}`);
    }
    const rate = src.requests_per_second;
    if (typeof rate !== "number" || rate <= 0) {
      throw new Error(`invalid requests_per_second for ${sourceId}`);
    }
    const trustedRedirects = src.trusted_redirects ?? [];
    if (!Array.isArray(trustedRedirects)) {
      throw new Error(`invalid trusted_redirects for ${sourceId}`);
    }
    for (const rule of trustedRedirects) {
      if (!rule || typeof rule !== "object" || Array.isArray(rule)) {
        throw new Error(`invalid trusted_redirects rule for ${sourceId}`);
      }
      const r = rule as Record<string, unknown>;
      if (
        !Array.isArray(r.hosts) ||
        r.hosts.length === 0 ||
        r.hosts.some((host) => typeof host !== "string" || !host)
      ) {
        throw new Error(`invalid trusted_redirects hosts for ${sourceId}`);
      }
      const patterns = r.path_patterns ?? [];
      if (!Array.isArray(patterns) || patterns.some((p) => typeof p !== "string" || !p)) {
        throw new Error(`invalid trusted_redirects path_patterns for ${sourceId}`);
      }
      for (const pattern of patterns as string[]) {
        try {
          new RegExp(pattern);
        } catch {
          throw new Error(`invalid trusted_redirects path pattern for ${sourceId}: ${pattern}`);
        }
      }
    }
  }
}

/** Load and validate a full-text registry from disk. */
export async function loadFulltextRegistry(path: string): Promise<Record<string, unknown>> {
  const registry = JSON.parse(await fs.readFile(path, "utf-8"));
  if (!registry || typeof registry !== "object" || Array.isArray(registry)) {
    throw new Error("full-text registry must be an object");
  }
  validateFulltextRegistry(registry);
  return registry;
}

/** Select a full-text source by id; throws if missing. */
export function selectFulltextSource(
  registry: Record<string, unknown>,
  sourceId: string,
): FullTextSource {
  for (const source of registry.sources as FullTextSource[]) {
    if (source.source_id === sourceId) {
      return source;
    }
  }
  throw new Error(`unknown full-text source_id: ${sourceId}`);
}

/** Error subclass marking a permission/robots failure (Python PermissionError). */
export class PermissionErrorLike extends Error {
  readonly isPermissionError = true;
}

/** Validate that a candidate is authorized to download from a source. */
export function validateCandidateAccess(
  candidate: Record<string, unknown>,
  source: FullTextSource,
): void {
  if (candidate.source_id !== source.source_id) {
    throw new Error("candidate/source source_id mismatch");
  }
  const access = candidate.access as Record<string, unknown>;
  if (!access.download_allowed) {
    throw new PermissionErrorLike("candidate metadata does not authorize download");
  }
  if (access.requires_auth) {
    throw new PermissionErrorLike(
      "authenticated or access-controlled retrieval is not supported",
    );
  }
  const localPath = candidate.local_path;
  if (localPath) {
    if (!source.local_only) {
      throw new Error("local_path candidate must use a local-only source");
    }
    return;
  }
  if (source.local_only) {
    throw new Error("local-only source cannot retrieve a remote URL");
  }
  if (!source.automated_download_allowed) {
    throw new PermissionErrorLike("source registry does not authorize automated download");
  }
  validateRemoteUrl(String(candidate.text_url), source);
}

/** Validate a remote URL against source host/path allow-lists (HTTPS only). */
export function validateRemoteUrl(url: string, source: FullTextSource): void {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new PermissionErrorLike("remote full-text URL must use HTTPS");
  }
  if (parsed.protocol !== "https:" || !parsed.host) {
    throw new PermissionErrorLike("remote full-text URL must use HTTPS");
  }
  const targetHost = (parsed.hostname || "").toLowerCase();
  const allowedHosts = (source.allowed_hosts as string[]).map((host) => String(host).toLowerCase());
  if (!allowedHosts.some((host) => targetHost === host || targetHost.endsWith("." + host))) {
    throw new PermissionErrorLike(`target host is not allowed for ${source.source_id}`);
  }
  const prefixes = (source.allowed_path_prefixes as string[]) ?? [];
  if (prefixes.length > 0 && !prefixes.some((prefix) => parsed.pathname.startsWith(prefix))) {
    throw new PermissionErrorLike(`target path is not allowed for ${source.source_id}`);
  }
}

/**
 * True when a redirect-target URL matches one of the source's declared
 * `trusted_redirects` rules (HTTPS only; host suffix match plus optional
 * path regex patterns). Sources without rules trust no redirect targets.
 */
export function redirectTargetTrusted(url: string, source: FullTextSource): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (parsed.protocol !== "https:" || !parsed.hostname) {
    return false;
  }
  const host = parsed.hostname.toLowerCase();
  const rules = (source.trusted_redirects as Record<string, unknown>[]) ?? [];
  for (const rule of rules) {
    const hosts = ((rule.hosts as string[]) ?? []).map((h) => h.toLowerCase());
    if (!hosts.some((h) => host === h || host.endsWith("." + h))) {
      continue;
    }
    const patterns = (rule.path_patterns as string[]) ?? [];
    if (patterns.length === 0 || patterns.some((p) => new RegExp(p).test(parsed.pathname))) {
      return true;
    }
  }
  return false;
}

/**
 * Validate one hop of a download redirect chain: the URL must satisfy the
 * source's primary host/path allow-list, or — for redirect hops only — one of
 * its declared trusted_redirects rules. Throws PermissionErrorLike otherwise.
 */
export function validateDownloadHop(
  url: string,
  source: FullTextSource,
  options: { isRedirect: boolean },
): void {
  try {
    validateRemoteUrl(url, source);
    return;
  } catch (error) {
    if (!options.isRedirect || !(error instanceof PermissionErrorLike)) {
      throw error;
    }
    if (!redirectTargetTrusted(url, source)) {
      throw new PermissionErrorLike(
        `redirect target is not a trusted redirect for ${source.source_id}: ${url}`,
      );
    }
  }
}
