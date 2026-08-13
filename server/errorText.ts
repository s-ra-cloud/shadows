/**
 * Turning caught exceptions into text an editor can read.
 *
 * Database driver errors are hostile to humans: the driver wraps the real
 * cause in a `Failed query: <the whole statement> params: <every bound value>`
 * envelope. For hunter runs one of those bound values is the run-progress
 * JSON, so a single failed progress write yields tens of kilobytes of text.
 * Storing that text as a blocker detail then feeds it back into the next
 * progress payload, and each subsequent failure is bigger than the last.
 *
 * Every place where a caught exception becomes a stored run error, blocker
 * detail or item outcome must go through `cleanErrorText` (or `truncateText`
 * for text that is already human-written), so stored text stays bounded and
 * says what actually went wrong.
 */

/** Default cap for a stored run error / blocker detail. */
export const MAX_ERROR_TEXT = 400;
/** Tighter cap for text embedded in the run-progress payload (per item). */
export const MAX_DETAIL_TEXT = 240;

const TRUNCATION_MARKER = "… (truncated)";

/** Collapse all whitespace runs to single spaces and trim. */
function collapseWhitespace(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

/** Cap `text` at `maxLength`, marking explicitly when something was cut. */
export function truncateText(text: string, maxLength = MAX_ERROR_TEXT): string {
  const compact = collapseWhitespace(text);
  if (compact.length <= maxLength) return compact;
  const keep = Math.max(0, maxLength - TRUNCATION_MARKER.length);
  return `${compact.slice(0, keep).trimEnd()}${TRUNCATION_MARKER}`;
}

/** True when a message is a driver "Failed query: … params: …" envelope. */
function isDriverEnvelope(message: string): boolean {
  return /^failed query:/i.test(message.trimStart());
}

/**
 * Name the statement that failed without reproducing it: an editor gets
 * "insert into hunter_blockers" rather than the SQL text and every parameter.
 */
function summariseStatement(sql: string): string {
  const s = collapseWhitespace(sql);
  const insert = /^insert\s+into\s+"?([a-zA-Z0-9_]+)"?/i.exec(s);
  if (insert) return `insert into ${insert[1]}`;
  const update = /^update\s+"?([a-zA-Z0-9_]+)"?/i.exec(s);
  if (update) return `update ${update[1]}`;
  const del = /^delete\s+from\s+"?([a-zA-Z0-9_]+)"?/i.exec(s);
  if (del) return `delete from ${del[1]}`;
  if (/^select\b/i.test(s)) {
    const from = /\bfrom\s+"?([a-zA-Z0-9_]+)"?/i.exec(s);
    if (from) return `select from ${from[1]}`;
    return "select";
  }
  return "";
}

/** Replace a driver envelope with a one-line description of the statement. */
function describeDriverEnvelope(message: string): string {
  const body = message.trimStart().replace(/^failed query:\s*/i, "");
  const sql = body.split(/\n\s*params\s*:/i)[0];
  const statement = summariseStatement(sql);
  return statement ? `Database query failed (${statement})` : "Database query failed";
}

/** Every message in an error's cause chain, outermost first. */
function causeChain(error: unknown): string[] {
  const messages: string[] = [];
  const seen = new Set<unknown>();
  let current: unknown = error;
  while (current !== undefined && current !== null && !seen.has(current)) {
    seen.add(current);
    const message =
      current instanceof Error
        ? current.message
        : typeof current === "string"
          ? current
          : "";
    if (message.trim()) messages.push(message);
    current = current instanceof Error ? (current as { cause?: unknown }).cause : undefined;
  }
  if (messages.length === 0 && error !== undefined && error !== null && !(error instanceof Error)) {
    // Non-Error throwables (objects, numbers) still need something printable.
    const fallback = typeof error === "object" ? safeStringify(error) : String(error);
    if (fallback.trim()) messages.push(fallback);
  }
  return messages;
}

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value) ?? String(value);
  } catch {
    return String(value);
  }
}

/**
 * Reduce a caught exception to a short, human-readable reason.
 *
 * - Prefers the innermost cause (a connection or constraint problem is the
 *   actionable part; the driver's statement wrapper is not).
 * - Rewrites the driver's `Failed query: … params: …` envelope into a short
 *   description of the statement, never the SQL or the bound parameters.
 * - Collapses whitespace and truncates with an explicit marker.
 */
export function cleanErrorText(error: unknown, maxLength = MAX_ERROR_TEXT): string {
  const chain = causeChain(error);
  if (chain.length === 0) return "Unknown error";

  // Innermost non-envelope message first — that is the real cause.
  let chosen = "";
  for (let i = chain.length - 1; i >= 0; i -= 1) {
    if (!isDriverEnvelope(chain[i])) {
      chosen = chain[i];
      break;
    }
  }
  // Nothing but envelopes: describe the outermost statement instead.
  if (!chosen) chosen = describeDriverEnvelope(chain[0]);

  // A cause message can itself carry a trailing params dump; drop it.
  const withoutParams = chosen.split(/\n\s*params\s*:/i)[0];
  return truncateText(withoutParams, maxLength) || "Unknown error";
}
