/**
 * Turning caught exceptions into text an editor can read: driver noise
 * stripped, the real cause kept, length bounded.
 */
import { describe, it, expect } from "vitest";
import { cleanErrorText, truncateText, MAX_ERROR_TEXT } from "../errorText";

/** A drizzle/pg style failure: the statement plus every bound parameter. */
function driverError(params: string, cause?: unknown): Error {
  const error = new Error(
    `Failed query: update "hunter_runs" set "result" = $1 where "hunter_runs"."id" = $2\nparams: ${params},42`,
  );
  if (cause !== undefined) (error as { cause?: unknown }).cause = cause;
  return error;
}

describe("cleanErrorText", () => {
  it("reduces a driver exception to a short reason without SQL or parameters", () => {
    const params = JSON.stringify({ progress: { items: Array.from({ length: 400 }, (_, i) => ({ title: `Item ${i}`, detail: "x".repeat(200) })) } });
    const reason = cleanErrorText(driverError(params));
    expect(reason.length).toBeLessThanOrEqual(MAX_ERROR_TEXT);
    expect(reason).not.toMatch(/params:/);
    expect(reason).not.toMatch(/\$1/);
    expect(reason).not.toMatch(/Item 399/);
    expect(reason).toBe("Database query failed (update hunter_runs)");
  });

  it("keeps the innermost cause and discards the statement wrapper", () => {
    const reason = cleanErrorText(
      driverError('{"progress":"...huge..."}', new Error("connection terminated unexpectedly")),
    );
    expect(reason).toBe("connection terminated unexpectedly");
  });

  it("walks a multi-level cause chain to the actionable message", () => {
    const inner = new Error('duplicate key value violates unique constraint "hunter_candidates_edition_id_unique"');
    const middle = new Error("insert failed");
    (middle as { cause?: unknown }).cause = inner;
    expect(cleanErrorText(driverError("{}", middle))).toBe(inner.message);
  });

  it("names the statement kind for inserts, deletes and selects", () => {
    const insert = new Error('Failed query: insert into "hunter_blockers" ("run_id") values ($1)\nparams: 3');
    expect(cleanErrorText(insert)).toBe("Database query failed (insert into hunter_blockers)");
    const del = new Error('Failed query: delete from "hunter_runs" where id = $1\nparams: 3');
    expect(cleanErrorText(del)).toBe("Database query failed (delete from hunter_runs)");
    const select = new Error('Failed query: select "id" from "hunter_corpus_files"\nparams: ');
    expect(cleanErrorText(select)).toBe("Database query failed (select from hunter_corpus_files)");
  });

  it("collapses whitespace and truncates with an explicit marker", () => {
    const long = new Error(`Robots check failed:\n\n${"detail ".repeat(200)}`);
    const reason = cleanErrorText(long);
    expect(reason.length).toBeLessThanOrEqual(MAX_ERROR_TEXT);
    expect(reason).toMatch(/^Robots check failed: detail detail/);
    expect(reason.endsWith("… (truncated)")).toBe(true);
  });

  it("respects a caller-supplied maximum", () => {
    expect(cleanErrorText(new Error("y".repeat(500)), 50)).toHaveLength(50);
  });

  it("handles non-Error throwables", () => {
    expect(cleanErrorText("plain string failure")).toBe("plain string failure");
    expect(cleanErrorText({ code: "ECONNRESET" })).toBe('{"code":"ECONNRESET"}');
    expect(cleanErrorText(undefined)).toBe("Unknown error");
    expect(cleanErrorText(new Error("   "))).toBe("Unknown error");
  });

  it("drops a params dump trailing an otherwise readable cause", () => {
    const cause = new Error('null value in column "reason" violates not-null constraint\nparams: {"a":1}');
    expect(cleanErrorText(driverError("{}", cause))).toBe(
      'null value in column "reason" violates not-null constraint',
    );
  });
});

describe("truncateText", () => {
  it("leaves short text alone and caps long text once", () => {
    expect(truncateText("short reason")).toBe("short reason");
    const capped = truncateText("z".repeat(1000), 100);
    expect(capped).toHaveLength(100);
    expect(truncateText(capped, 100)).toBe(capped);
  });
});
