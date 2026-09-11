import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { NextFunction, Request, Response } from "express";

vi.mock("../storage", async () => {
  const { PGlite } = await import("@electric-sql/pglite");
  const { drizzle } = await import("drizzle-orm/pglite");
  const schema = await import("@shared/schema");
  const client = new PGlite();
  await client.exec(`
    CREATE TABLE hunter_runs (
      id serial PRIMARY KEY, kind text NOT NULL, status text NOT NULL DEFAULT 'running',
      started_at timestamp DEFAULT now() NOT NULL, finished_at timestamp, result jsonb, error text
    );
    CREATE TABLE hunter_blockers (
      id serial PRIMARY KEY, run_id integer REFERENCES hunter_runs(id), source_id text, url text,
      reason text NOT NULL, detail text, work_id text, edition_id text, status text NOT NULL DEFAULT 'open',
      resolved_url text, item_url text, repair_state text, repair_detail text,
      created_at timestamp DEFAULT now() NOT NULL, updated_at timestamp DEFAULT now() NOT NULL
    );
    CREATE TABLE daily_hunter_routines (
      id integer PRIMARY KEY, enabled integer NOT NULL DEFAULT 0, local_time text NOT NULL DEFAULT '09:00',
      timezone text NOT NULL DEFAULT 'Europe/Paris', recipient text NOT NULL DEFAULT 'duparclaura.pro@gmail.com',
      active_execution_id integer,
      updated_at timestamp DEFAULT now() NOT NULL
    );
    CREATE TABLE daily_hunter_executions (
      id serial PRIMARY KEY, routine_id integer NOT NULL REFERENCES daily_hunter_routines(id),
      execution_key text NOT NULL UNIQUE, scheduled_date text NOT NULL, timezone text NOT NULL,
      recipient text NOT NULL DEFAULT 'duparclaura.pro@gmail.com',
      status text NOT NULL DEFAULT 'running', hunter_run_id integer REFERENCES hunter_runs(id), review jsonb,
      email_status text NOT NULL DEFAULT 'pending', email_message_id text, email_attempted_at timestamp,
      error text, started_at timestamp DEFAULT now() NOT NULL, finished_at timestamp
    );
    CREATE TABLE daily_hunter_proposals (
      id serial PRIMARY KEY, execution_id integer NOT NULL REFERENCES daily_hunter_executions(id),
      kind text NOT NULL DEFAULT 'engineering_task', title text NOT NULL, summary text NOT NULL,
      evidence jsonb NOT NULL, status text NOT NULL DEFAULT 'pending', decision_note text,
      decided_at timestamp, created_at timestamp DEFAULT now() NOT NULL
    );
  `);
  let advisoryLocked = false;
  const pool = {
    connect: async () => ({
      query: async (sql: string) => {
        if (sql.includes("pg_try_advisory_lock")) {
          if (advisoryLocked) return { rows: [{ locked: false }] };
          advisoryLocked = true;
          return { rows: [{ locked: true }] };
        }
        if (sql.includes("pg_advisory_unlock")) {
          advisoryLocked = false;
          return { rows: [{ pg_advisory_unlock: true }] };
        }
        throw new Error(`Unexpected mock pool query: ${sql}`);
      },
      release: () => undefined,
    }),
  };
  return { db: drizzle(client, { schema }), pool, storage: {} };
});

import { db } from "../storage";
import { executeDailyHunter, requireDailyHunterWorker, timezoneEditPreservesExecutionDates } from "../dailyHunter";
import { dailyHunterExecutions, dailyHunterProposals, dailyHunterRoutines, hunterBlockers, hunterRuns } from "@shared/schema";

const now = new Date("2026-06-15T08:00:00.000Z");
const summary = {
  scope: { query: "mythology primary source ancient text" },
  discovered: 4, created: 2, duplicates: 1, invalid: 0, secondary: 0,
  downloaded_public: 1, downloaded_locked: 0, metadata_only: 0, failed: 0,
  blockers: 2, entries: [], discovery: [],
} as any;

beforeAll(async () => {
  await db.insert(hunterRuns).values({ id: 88, kind: "cycle", status: "completed" });
});

beforeEach(async () => {
  await db.delete(dailyHunterProposals);
  await db.delete(dailyHunterExecutions);
  await db.delete(dailyHunterRoutines);
  await db.delete(hunterBlockers);
});

describe("daily Hunter durable execution", () => {
  it("starts paused without consuming the day's execution key or running the cycle", async () => {
    const runCycle = vi.fn();
    const result = await executeDailyHunter({ runCycle }, "https://app.example", now);
    expect(result).toMatchObject({ duplicate: false, status: "paused", executionId: 0 });
    expect(runCycle).not.toHaveBeenCalled();
    const rows = await db.select().from(dailyHunterExecutions);
    expect(rows).toHaveLength(0);
  });

  it("does not claim work before the configured local time", async () => {
    await db.insert(dailyHunterRoutines).values({
      id: 1, enabled: 1, localTime: "11:00", timezone: "Europe/Paris", recipient: "duparclaura.pro@gmail.com",
    });
    const runCycle = vi.fn();
    const result = await executeDailyHunter({ runCycle }, "https://app.example", now);
    expect(result).toMatchObject({ status: "not_due", executionId: 0 });
    expect(runCycle).not.toHaveBeenCalled();
    expect(await db.select().from(dailyHunterExecutions)).toHaveLength(0);
  });

  it("rejects a timezone edit that would move a near-midnight executed instant to another local date", async () => {
    await db.insert(dailyHunterRoutines).values({
      id: 1, enabled: 0, localTime: "09:00", timezone: "Europe/Paris", recipient: "duparclaura.pro@gmail.com",
    });
    await db.insert(dailyHunterExecutions).values({
      routineId: 1,
      executionKey: "daily-hunter:1:2026-06-15",
      scheduledDate: "2026-06-15",
      timezone: "Europe/Paris",
      recipient: "duparclaura.pro@gmail.com",
      status: "completed",
      startedAt: new Date("2026-06-15T00:30:00.000Z"),
    });
    expect(await timezoneEditPreservesExecutionDates("Europe/Paris")).toBe(true);
    expect(await timezoneEditPreservesExecutionDates("America/Los_Angeles")).toBe(false);
  });

  it("uses one local-day key for duplicate worker delivery and does not send twice", async () => {
    await db.insert(dailyHunterRoutines).values({
      id: 1, enabled: 1, localTime: "09:00", timezone: "Europe/Paris", recipient: "duparclaura.pro@gmail.com",
    });
    const runCycle = vi.fn().mockResolvedValue({ runId: 88, summary });
    const sendMail = vi.fn().mockResolvedValue({ messageId: "gmail-1" });
    const first = await executeDailyHunter({ runCycle, sendMail }, "https://app.example", now);
    const second = await executeDailyHunter({ runCycle, sendMail }, "https://app.example", now);
    expect(first.duplicate).toBe(false);
    expect(second).toMatchObject({ duplicate: true, executionId: first.executionId });
    expect(runCycle).toHaveBeenCalledTimes(1);
    expect(sendMail).toHaveBeenCalledTimes(1);
    expect(sendMail.mock.calls[0][0].subject).toContain("Europe/Paris");
  });

  it("marks an ambiguous mail result unknown and does not retry it on duplicate delivery", async () => {
    await db.insert(dailyHunterRoutines).values({
      id: 1, enabled: 1, localTime: "09:00", timezone: "Europe/Paris", recipient: "duparclaura.pro@gmail.com",
    });
    const sendMail = vi.fn().mockRejectedValue(new Error("socket closed after request"));
    await executeDailyHunter({ runCycle: vi.fn().mockResolvedValue({ runId: 88, summary }), sendMail }, "https://app.example", now);
    await executeDailyHunter({ runCycle: vi.fn(), sendMail }, "https://app.example", now);
    const [execution] = await db.select().from(dailyHunterExecutions);
    expect(execution.emailStatus).toBe("unknown");
    expect(execution.error).toContain("will not be retried automatically");
    expect(sendMail).toHaveBeenCalledTimes(1);
  });

  it("sends exactly one claimed failure report when the Hunter cycle fails", async () => {
    await db.insert(dailyHunterRoutines).values({
      id: 1, enabled: 1, localTime: "09:00", timezone: "Europe/Paris", recipient: "duparclaura.pro@gmail.com",
    });
    const sendMail = vi.fn().mockResolvedValue({ messageId: "failure-mail-1" });
    const runCycle = vi.fn().mockResolvedValue({ runId: 88, summary: null, error: "provider unavailable" });
    const first = await executeDailyHunter({ runCycle, sendMail }, "https://app.example", now);
    const second = await executeDailyHunter({ runCycle, sendMail }, "https://app.example", now);
    expect(first.status).toBe("failed");
    expect(second.duplicate).toBe(true);
    expect(sendMail).toHaveBeenCalledTimes(1);
    expect(sendMail.mock.calls[0][0].subject).toContain("failure");
    const [execution] = await db.select().from(dailyHunterExecutions);
    expect(execution).toMatchObject({ status: "failed", emailStatus: "sent" });
  });

  it("resumes a known-unsent completed report using its execution recipient after restart window", async () => {
    await db.insert(dailyHunterRoutines).values({
      id: 1, enabled: 0, localTime: "09:00", timezone: "Europe/Paris", recipient: "new-config@example.com",
    });
    await db.insert(dailyHunterExecutions).values({
      routineId: 1, executionKey: "daily-hunter:1:2026-06-14", scheduledDate: "2026-06-14",
      timezone: "Europe/Paris", recipient: "snapshot@example.com", status: "completed", hunterRunId: 88,
      review: {
        usefulDiscoveries: { newCandidates: 1, downloadedPublic: 0, downloadedLocked: 0, metadataOnly: 0 },
        outcomes: { discovered: 1, duplicates: 0, invalid: 0, secondary: 0, failed: 0, blockers: 0 },
        blockers: [],
      },
    });
    const sendMail = vi.fn().mockResolvedValue({ messageId: "recovered-completed" });
    await executeDailyHunter({ runCycle: vi.fn(), sendMail }, "https://app.example", now);
    expect(sendMail).toHaveBeenCalledTimes(1);
    expect(sendMail.mock.calls[0][0]).toMatchObject({ to: "snapshot@example.com", subject: expect.stringContaining("review") });
    const [execution] = await db.select().from(dailyHunterExecutions);
    expect(execution.emailStatus).toBe("sent");
  });

  it("resumes a known-unsent failed report using its execution recipient after restart window", async () => {
    await db.insert(dailyHunterRoutines).values({
      id: 1, enabled: 0, localTime: "09:00", timezone: "Europe/Paris", recipient: "new-config@example.com",
    });
    await db.insert(dailyHunterExecutions).values({
      routineId: 1, executionKey: "daily-hunter:1:2026-06-14", scheduledDate: "2026-06-14",
      timezone: "Europe/Paris", recipient: "snapshot@example.com", status: "failed",
      error: "prior failure before report claim",
    });
    const sendMail = vi.fn().mockResolvedValue({ messageId: "recovered-failed" });
    await executeDailyHunter({ runCycle: vi.fn(), sendMail }, "https://app.example", now);
    expect(sendMail).toHaveBeenCalledTimes(1);
    expect(sendMail.mock.calls[0][0]).toMatchObject({ to: "snapshot@example.com", subject: expect.stringContaining("failure") });
    const [execution] = await db.select().from(dailyHunterExecutions);
    expect(execution.emailStatus).toBe("sent");
  });

  it("creates evidence-only recurring proposals without changing Hunter policy or rights data", async () => {
    await db.insert(dailyHunterRoutines).values({
      id: 1, enabled: 1, localTime: "09:00", timezone: "Europe/Paris", recipient: "duparclaura.pro@gmail.com",
    });
    await db.insert(hunterBlockers).values([
      { runId: 88, reason: "robots_disallowed" },
      { runId: 88, reason: "robots_disallowed" },
    ]);
    await executeDailyHunter({ runCycle: vi.fn().mockResolvedValue({ runId: 88, summary }), sendMail: vi.fn() }, "https://app.example", now);
    const proposals = await db.select().from(dailyHunterProposals);
    expect(proposals).toHaveLength(1);
    expect(proposals[0]).toMatchObject({ kind: "engineering_task", status: "pending" });
    expect(proposals[0].summary).toContain("cannot change code, rights determinations, or source policy");
  });
});

describe("daily Hunter worker authentication", () => {
  const original = process.env.DAILY_HUNTER_TRIGGER_TOKEN;
  afterEach(() => {
    if (original === undefined) delete process.env.DAILY_HUNTER_TRIGGER_TOKEN;
    else process.env.DAILY_HUNTER_TRIGGER_TOKEN = original;
  });

  function invoke(authorization?: string) {
    let status = 200;
    let nextCalled = false;
    const req = { headers: authorization ? { authorization } : {} } as Request;
    const res = {
      status(code: number) { status = code; return this; },
      json() { return this; },
    } as unknown as Response;
    requireDailyHunterWorker(req, res, (() => { nextCalled = true; }) as NextFunction);
    return { status, nextCalled };
  }

  it("fails closed without the dedicated scheduled-worker bearer token", () => {
    process.env.DAILY_HUNTER_TRIGGER_TOKEN = "worker-secret";
    expect(invoke()).toMatchObject({ status: 401, nextCalled: false });
    expect(invoke("Bearer wrong")).toMatchObject({ status: 401, nextCalled: false });
    expect(invoke("Bearer worker-secret")).toMatchObject({ status: 200, nextCalled: true });
  });
});