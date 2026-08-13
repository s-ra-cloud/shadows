/**
 * Minimal robots.txt checker for sources with robots_mode "target_origin".
 * Fetches and caches the target origin's robots.txt, then evaluates the
 * User-agent: * group (plus any group matching our agent token) with
 * longest-match Allow/Disallow semantics (Google-style).
 *
 * Missing robots.txt (404 or unreachable) means allowed; a 401/403 on
 * robots.txt means disallowed (conservative, per RFC 9309).
 */

interface RobotsRule {
  allow: boolean;
  path: string;
}

export interface RobotsDecision {
  allowed: boolean;
  reason: string;
}

const cache = new Map<string, { rules: RobotsRule[] | null; reason: string }>();

/** Parse robots.txt content into rules applicable to `agentToken`. */
export function parseRobots(content: string, agentToken: string): RobotsRule[] {
  const token = agentToken.toLowerCase();
  const groups: { agents: string[]; rules: RobotsRule[] }[] = [];
  let current: { agents: string[]; rules: RobotsRule[] } | null = null;
  let lastWasAgent = false;
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*$/, "").trim();
    if (!line) continue;
    const idx = line.indexOf(":");
    if (idx === -1) continue;
    const field = line.slice(0, idx).trim().toLowerCase();
    const value = line.slice(idx + 1).trim();
    if (field === "user-agent") {
      if (!current || !lastWasAgent) {
        current = { agents: [], rules: [] };
        groups.push(current);
      }
      current.agents.push(value.toLowerCase());
      lastWasAgent = true;
    } else if (field === "allow" || field === "disallow") {
      lastWasAgent = false;
      if (!current) continue;
      if (value === "" && field === "disallow") continue; // empty disallow = allow all
      current.rules.push({ allow: field === "allow", path: value });
    } else {
      lastWasAgent = false;
    }
  }
  const specific = groups.filter((g) => g.agents.some((a) => a !== "*" && token.includes(a)));
  const chosen = specific.length > 0 ? specific : groups.filter((g) => g.agents.includes("*"));
  return chosen.flatMap((g) => g.rules);
}

function ruleMatches(rulePath: string, targetPath: string): number {
  // Supports * wildcards and $ end anchor; returns match length (specificity) or -1.
  let pattern = rulePath;
  let anchored = false;
  if (pattern.endsWith("$")) {
    anchored = true;
    pattern = pattern.slice(0, -1);
  }
  const parts = pattern.split("*").map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const regex = new RegExp("^" + parts.join(".*") + (anchored ? "$" : ""));
  return regex.test(targetPath) ? rulePath.length : -1;
}

/** Evaluate parsed rules for a URL path. Default allow. */
export function robotsRulesAllow(rules: RobotsRule[], targetPath: string): boolean {
  let bestLength = -1;
  let allowed = true;
  for (const rule of rules) {
    const length = ruleMatches(rule.path, targetPath);
    if (length > bestLength || (length === bestLength && rule.allow && !allowed)) {
      if (length >= 0) {
        bestLength = length;
        allowed = rule.allow;
      }
    }
  }
  return allowed;
}

/**
 * True when a 2xx /robots.txt response actually looks like a robots file.
 *
 * Markup is never a robots file (a redirect to an HTML documentation page is
 * the common case). Otherwise any body carrying robots directives counts —
 * whatever the content type — and an empty/comment-only body counts when the
 * server declared it as plain text.
 */
export function looksLikeRobotsTxt(body: string, contentType: string | null): boolean {
  const sample = body.slice(0, 4096);
  if (/^\s*(<!doctype|<html|<\?xml)/i.test(sample)) return false;
  if (/^\s*(user-agent|allow|disallow|sitemap|crawl-delay)\s*:/im.test(sample)) return true;
  const mediaType = (contentType ?? "").split(";")[0].trim().toLowerCase();
  return mediaType === "text/plain" && !/<\s*(html|body|head|div|p)\b/i.test(sample);
}

/** Check whether `url` may be fetched under the target origin's robots.txt. */
export async function robotsAllowsUrl(
  url: string,
  userAgent: string,
  options: { fetchImpl?: typeof fetch } = {},
): Promise<RobotsDecision> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const parsed = new URL(url);
  const origin = parsed.origin;
  let entry = cache.get(origin);
  if (!entry) {
    try {
      const response = await fetchImpl(origin + "/robots.txt", {
        headers: { "User-Agent": userAgent },
        redirect: "follow",
      });
      if (response.status >= 200 && response.status < 300) {
        const text = await response.text();
        const contentType = response.headers?.get?.("content-type") ?? null;
        if (looksLikeRobotsTxt(text, contentType)) {
          entry = { rules: parseRobots(text, userAgent), reason: "robots.txt fetched" };
        } else {
          // Some hosts redirect /robots.txt to an HTML documentation page
          // (api.wikimedia.org does). That is not a robots file, so parsing it
          // would invent rules; treat it as "no robots.txt" instead.
          entry = {
            rules: [],
            reason: "robots.txt did not return a plain-text robots file; default allow",
          };
        }
      } else if (response.status === 401 || response.status === 403) {
        entry = { rules: null, reason: `robots.txt returned ${response.status}` };
      } else {
        entry = { rules: [], reason: `robots.txt unavailable (${response.status}); default allow` };
      }
    } catch (e) {
      entry = {
        rules: [],
        reason: `robots.txt unreachable (${e instanceof Error ? e.message : String(e)}); default allow`,
      };
    }
    cache.set(origin, entry);
  }
  if (entry.rules === null) {
    return { allowed: false, reason: entry.reason };
  }
  const targetPath = parsed.pathname + parsed.search;
  const allowed = robotsRulesAllow(entry.rules, targetPath);
  return {
    allowed,
    reason: allowed ? "allowed by robots.txt" : `robots.txt disallows ${parsed.pathname}`,
  };
}

/** Clear the per-origin cache (tests). */
export function clearRobotsCache(): void {
  cache.clear();
}
