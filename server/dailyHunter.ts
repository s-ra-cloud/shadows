/**
 * Durable daily Source Hunter routine.
 *
 * This module intentionally does not change source policy, rights evidence,
 * trusted sources, or files. It runs the existing cycle, records a
 * deterministic evidence review, and creates editor-approved engineering
 * briefs only.
 */
import type { Express, NextFunction, Request, Response } from "express";
import { timingSafeEqual } from "node:crypto";
import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import { ReplitConnectors } from "@replit/connectors-sdk";
import { db, pool } from "./storage";
import {
  dailyHunterExecutions,
  dailyHunterProposals,
  dailyHunterRoutines,
  hunterBlockers,
} from "@shared/schema";
import type { CycleScope, CycleSummary } from "./hunterCycle";
import { summarizeRun } from "./hunterReport";

const ROUTINE_ID = 1;
export const ROUTINE_MODES = ["query", "benchmark"] as const;
export type RoutineMode = (typeof ROUTINE_MODES)[number];
const DEFAULT_RECIPIENT = "duparclaura.pro@gmail.com";
const DEFAULT_TIME = "09:00";
const DEFAULT_TIMEZONE = "Europe/Paris";
const DAILY_HUNTER_LOCK_KEY = 71928401;
const DAILY_SCOPE: CycleScope = {
  query: "mythology primary source ancient text",
  limit: 10,
  useAi: true,
};

type MailResult = { messageId?: string | null };
export type DailyHunterMailSender = (input: {
  to: string;
  subject: string;
  text: string;
}) => Promise<MailResult>;

export type DailyCycleRunner = (scope: CycleScope) => Promise<{
  runId: number;
  summary: CycleSummary | null;
  error?: string;
}>;

/** Runs the checked-in benchmark list (see hunterRoutes.runBenchmarkCycle). */
export type DailyBenchmarkRunner = () => Promise<{
  runId: number;
  summary: CycleSummary | null;
  error?: string;
}>;

export interface DailyHunterDependencies {
  runCycle: DailyCycleRunner;
  runBenchmark?: DailyBenchmarkRunner;
  sendMail?: DailyHunterMailSender;
}

type DailyHunterLock = { release: () => Promise<void> };

/**
 * PostgreSQL advisory locks are session-scoped. Keeping the checked-out pool
 * client for the complete execution means another autoscale replica cannot
 * mistake this run for stale, or begin a second one. The lock is released
 * automatically if this process dies.
 */
async function acquireDailyHunterLock(): Promise<DailyHunterLock | null> {
  const client = await pool.connect();
  try {
    const result = await client.query<{ locked: boolean }>(
      "SELECT pg_try_advisory_lock($1) AS locked",
      [DAILY_HUNTER_LOCK_KEY],
    );
    if (!result.rows[0]?.locked) {
      client.release();
      return null;
    }
    return {
      release: async () => {
        try {
          await client.query("SELECT pg_advisory_unlock($1)", [DAILY_HUNTER_LOCK_KEY]);
        } finally {
          client.release();
        }
      },
    };
  } catch (error) {
    client.release();
    throw error;
  }
}

function safeError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.replace(/\s+/g, " ").trim().slice(0, 1200);
}

function workerTokenMatches(req: Request): boolean {
  const expected = process.env.DAILY_HUNTER_TRIGGER_TOKEN;
  const header = req.headers.authorization;
  if (!expected || !header?.startsWith("Bearer ")) return false;
  const supplied = header.slice("Bearer ".length).trim();
  const a = Buffer.from(expected);
  const b = Buffer.from(supplied);
  if (a.length !== b.length) return false;
  // Importing node:crypto only for this endpoint keeps this explicit
  // comparison timing-safe without exposing the configured token.
  return timingSafeEqual(a, b);
}

export function requireDailyHunterWorker(req: Request, res: Response, next: NextFunction) {
  if (workerTokenMatches(req)) return next();
  return res.status(401).json({
    error: { code: "unauthorized", message: "Provide the daily Hunter worker bearer token" },
  });
}

function validTime(value: unknown): value is string {
  return typeof value === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

function validTimezone(value: unknown): value is string {
  if (typeof value !== "string" || value.length > 100) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value }).format();
    return true;
  } catch {
    return false;
  }
}

function validRecipient(value: unknown): value is string {
  return typeof value === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 254;
}

export function validMode(value: unknown): value is RoutineMode {
  return typeof value === "string" && (ROUTINE_MODES as readonly string[]).includes(value);
}

/** null = every day; 0 (Sunday) … 6 (Saturday) = that local weekday only. */
export function validWeekday(value: unknown): value is number | null {
  return value === null || (typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 6);
}

const WEEKDAY_INDEX: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

export function localWeekday(timezone: string, now = new Date()): number {
  const name = new Intl.DateTimeFormat("en-US", { timeZone: timezone, weekday: "short" }).format(now);
  return WEEKDAY_INDEX[name] ?? new Date(now).getUTCDay();
}

function localDate(timezone: string, now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const part = (type: string) => parts.find((entry) => entry.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function localTime(timezone: string, now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const part = (type: string) => parts.find((entry) => entry.type === type)?.value ?? "";
  return `${part("hour")}:${part("minute")}`;
}

async function getRoutine() {
  await db
    .insert(dailyHunterRoutines)
    .values({
      id: ROUTINE_ID,
      enabled: 0,
      localTime: DEFAULT_TIME,
      timezone: DEFAULT_TIMEZONE,
      recipient: DEFAULT_RECIPIENT,
    })
    .onConflictDoNothing();
  const [routine] = await db
    .select()
    .from(dailyHunterRoutines)
    .where(eq(dailyHunterRoutines.id, ROUTINE_ID))
    .limit(1);
  if (!routine) throw new Error("Daily Hunter routine could not be initialized");
  return routine;
}

export async function timezoneEditPreservesExecutionDates(timezone: string): Promise<boolean> {
  const executions = await db.select({
    scheduledDate: dailyHunterExecutions.scheduledDate,
    startedAt: dailyHunterExecutions.startedAt,
  }).from(dailyHunterExecutions).where(eq(dailyHunterExecutions.routineId, ROUTINE_ID));
  // The invariant is based on the recorded instant, not on "today". This
  // prevents an editor changing timezones near midnight from turning an
  // already executed instant into a new calendar date and getting a second
  // daily key.
  return executions.every((execution) =>
    localDate(timezone, execution.startedAt) === execution.scheduledDate,
  );
}

function baseUrl(req: Request): string {
  const proto = (req.headers["x-forwarded-proto"] as string | undefined)?.split(",")[0]?.trim() || req.protocol || "https";
  const host = (req.headers["x-forwarded-host"] as string | undefined)?.split(",")[0]?.trim() || req.get("host");
  return host ? `${proto}://${host}` : "";
}

function countByReason(rows: Array<{ reason: string }>) {
  const counts = new Map<string, number>();
  for (const row of rows) counts.set(row.reason, (counts.get(row.reason) ?? 0) + 1);
  return Array.from(counts.entries())
    .map(([reason, count]) => ({ reason, count }))
    .sort((a, b) => b.count - a.count || a.reason.localeCompare(b.reason));
}

/**
 * Coverage block for a benchmark (corpus-list) run, or null for a query run.
 * Derived from the stored per-item outcomes exactly as GET /api/bot/hunter/report does.
 */
function benchmarkReview(runId: number, summary: CycleSummary) {
  const result = summary as unknown as Record<string, unknown>;
  if (!result.corpus_list || typeof result.corpus_list !== "object") return null;
  const run = summarizeRun({ id: runId, status: "completed", startedAt: null, finishedAt: null, result, error: null });
  return {
    list: String((result.corpus_list as Record<string, unknown>).name ?? ""),
    coverage: run.coverage,
    total: run.total,
    fetched: run.fetched,
    fetched_locked: run.fetched_locked,
    metadata_only: run.metadata_only,
    failed: run.failed,
    not_found: run.not_found,
    skipped: run.skipped,
    blocked_reasons: run.blocked_reasons,
  };
}

async function makeReview(executionId: number, runId: number, summary: CycleSummary, appUrl: string, mode: RoutineMode = "query") {
  const currentBlockers = await db
    .select()
    .from(hunterBlockers)
    .where(eq(hunterBlockers.runId, runId));
  const previousExecutions = await db
    .select({ hunterRunId: dailyHunterExecutions.hunterRunId })
    .from(dailyHunterExecutions)
    .where(and(eq(dailyHunterExecutions.routineId, ROUTINE_ID), eq(dailyHunterExecutions.status, "completed")))
    .orderBy(desc(dailyHunterExecutions.id))
    .limit(14);
  const previousRunIds = previousExecutions
    .map((row) => row.hunterRunId)
    .filter((id): id is number => typeof id === "number" && id !== runId);
  const historicalBlockers = previousRunIds.length
    ? await db.select().from(hunterBlockers).where(inArray(hunterBlockers.runId, previousRunIds))
    : [];
  const combinedCounts = countByReason([...currentBlockers, ...historicalBlockers]);
  const recurring = combinedCounts.filter((item) => item.count >= 2).slice(0, 3);
  const benchmark = mode === "benchmark" ? benchmarkReview(runId, summary) : null;
  const review = {
    generatedBy: "deterministic-evidence-review",
    mode,
    ...(benchmark ? { benchmark } : {}),
    usefulDiscoveries: {
      newCandidates: summary.created,
      downloadedPublic: summary.downloaded_public,
      downloadedLocked: summary.downloaded_locked,
      metadataOnly: summary.metadata_only,
    },
    outcomes: {
      discovered: summary.discovered,
      duplicates: summary.duplicates,
      invalid: summary.invalid,
      secondary: summary.secondary,
      failed: summary.failed,
      blockers: summary.blockers,
    },
    blockers: countByReason(currentBlockers),
    recurringBlockers: recurring,
    links: {
      run: `${appUrl}/api/hunter/runs/${runId}`,
      routine: `${appUrl}/daily-hunter`,
      ...(benchmark ? { report: `${appUrl}/api/bot/hunter/report` } : {}),
    },
    safety: "Evidence counts are derived from stored Hunter results. No rights, licensing, trusted-source policy, or code was changed.",
  };

  for (const recurringBlocker of recurring) {
    await db.insert(dailyHunterProposals).values({
      executionId,
      kind: "engineering_task",
      title: `Investigate recurring Hunter blocker: ${recurringBlocker.reason}`,
      summary: `${recurringBlocker.count} recorded occurrence(s) across recent daily runs. Approval creates only a reviewable engineering brief; it cannot change code, rights determinations, or source policy.`,
      evidence: {
        reason: recurringBlocker.reason,
        occurrences: recurringBlocker.count,
        currentRunId: runId,
        currentBlockerIds: currentBlockers
          .filter((blocker) => blocker.reason === recurringBlocker.reason)
          .map((blocker) => blocker.id),
      },
    });
  }
  return review;
}

function reportText(input: {
  date: string;
  timezone: string;
  runId: number;
  review: Record<string, any>;
  proposalIds: number[];
  appUrl: string;
}): string {
  const { review } = input;
  const findings = review.usefulDiscoveries;
  const outcomes = review.outcomes;
  const blockers = (review.blockers as Array<{ reason: string; count: number }>)
    .map((item) => `- ${item.reason}: ${item.count}`)
    .join("\n") || "- None";
  const proposalLinks = input.proposalIds.map((id) => `${input.appUrl}/api/hunter/daily/proposals/${id}/brief`).join("\n") || "None";
  const benchmark = review.benchmark as ReturnType<typeof benchmarkReview> | undefined;
  const benchmarkLines = benchmark
    ? [
        `Benchmark coverage — ${benchmark.list}`,
        `- Coverage: ${benchmark.coverage == null ? "n/a" : `${Math.round(benchmark.coverage * 100)}%`} (${benchmark.fetched} fetched + ${benchmark.fetched_locked} locked of ${benchmark.total})`,
        `- Metadata only: ${benchmark.metadata_only}; failed: ${benchmark.failed}; not found: ${benchmark.not_found}; skipped: ${benchmark.skipped}`,
        `- Per-item changes since the previous run: ${input.appUrl}/api/bot/hunter/report`,
        "",
      ]
    : [];
  return [
    `Daily Hunter review — ${input.date} (${input.timezone})`,
    "",
    `Hunter run: ${input.appUrl}/api/hunter/runs/${input.runId}`,
    `Routine history: ${input.appUrl}/daily-hunter`,
    "",
    ...benchmarkLines,
    "Useful discoveries",
    `- New candidates: ${findings.newCandidates}`,
    `- Public downloads: ${findings.downloadedPublic}`,
    `- Locked downloads awaiting rights review: ${findings.downloadedLocked}`,
    `- Metadata-only records: ${findings.metadataOnly}`,
    "",
    "Cycle outcome",
    `- Discovered: ${outcomes.discovered}; duplicates: ${outcomes.duplicates}; invalid: ${outcomes.invalid}; secondary: ${outcomes.secondary}; failed downloads: ${outcomes.failed}`,
    "",
    "Blockers",
    blockers,
    "",
    "Engineering proposals (editor approval required)",
    proposalLinks,
    "",
    "Safety boundary: this report is evidence-based. The routine did not alter application code, rights/licensing evidence, or trusted-source policy.",
  ].join("\n");
}

export async function gmailDailyHunterMail(input: {
  to: string;
  subject: string;
  text: string;
}): Promise<MailResult> {
  const raw = [
    `To: ${input.to}`,
    `Subject: ${input.subject}`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=UTF-8",
    "",
    input.text,
  ].join("\r\n");
  const response = await new ReplitConnectors().proxy(
    "google-mail",
    "/gmail/v1/users/me/messages/send",
    { method: "POST", headers: { "Content-Type": "application/json" }, body: { raw: Buffer.from(raw).toString("base64url") } },
  );
  if (!response.ok) throw new Error(`Gmail proxy returned ${response.status}`);
  const payload = await response.json().catch(() => ({})) as { id?: string };
  return { messageId: payload.id ?? null };
}

async function sendFailureReport(input: {
  dependencies: DailyHunterDependencies;
  executionId: number;
  recipient: string;
  date: string;
  timezone: string;
  appUrl: string;
  error: string;
  hunterRunId?: number | null;
}) {
  const runLink = input.hunterRunId
    ? `${input.appUrl}/api/hunter/runs/${input.hunterRunId}`
    : "No Hunter run was created.";
  // Claim delivery first. The idempotent execution key ensures this branch is
  // reached no more than once for a failed daily invocation.
  await db.update(dailyHunterExecutions).set({
    emailStatus: "sending",
    emailAttemptedAt: new Date(),
  }).where(eq(dailyHunterExecutions.id, input.executionId));
  try {
    const result = await (input.dependencies.sendMail ?? gmailDailyHunterMail)({
      to: input.recipient,
      subject: `Daily Hunter failure — ${input.date} (${input.timezone})`,
      text: [
        `Daily Hunter failure — ${input.date} (${input.timezone})`,
        "",
        `Execution: ${input.appUrl}/daily-hunter`,
        `Hunter run: ${runLink}`,
        "",
        `Failure: ${input.error}`,
        "",
        "No automatic retry will relaunch this daily execution. Review the visible execution record before any editor-approved follow-up.",
      ].join("\n"),
    });
    await db.update(dailyHunterExecutions).set({
      emailStatus: "sent",
      emailMessageId: result.messageId ?? null,
    }).where(eq(dailyHunterExecutions.id, input.executionId));
  } catch (error) {
    await db.update(dailyHunterExecutions).set({
      emailStatus: "unknown",
      error: `${input.error}; failure-report delivery outcome is unknown and will not be retried automatically: ${safeError(error)}`,
    }).where(eq(dailyHunterExecutions.id, input.executionId));
  }
}

async function sendCompletedReport(input: {
  dependencies: DailyHunterDependencies;
  executionId: number;
  recipient: string;
  date: string;
  timezone: string;
  runId: number;
  review: Record<string, any>;
  proposalIds: number[];
  appUrl: string;
}) {
  await db.update(dailyHunterExecutions).set({
    emailStatus: "sending",
    emailAttemptedAt: new Date(),
  }).where(eq(dailyHunterExecutions.id, input.executionId));
  try {
    const result = await (input.dependencies.sendMail ?? gmailDailyHunterMail)({
      to: input.recipient,
      subject: `Daily Hunter review — ${input.date} (${input.timezone})`,
      text: reportText(input),
    });
    await db.update(dailyHunterExecutions).set({
      emailStatus: "sent",
      emailMessageId: result.messageId ?? null,
    }).where(eq(dailyHunterExecutions.id, input.executionId));
  } catch (error) {
    await db.update(dailyHunterExecutions).set({
      emailStatus: "unknown",
      error: `Cycle completed; email delivery outcome is unknown and will not be retried automatically: ${safeError(error)}`,
    }).where(eq(dailyHunterExecutions.id, input.executionId));
  }
}

async function resumeKnownUnsentReportsWhileLocked(
  dependencies: DailyHunterDependencies,
  appUrl: string,
) {
  const pending = (await db.select().from(dailyHunterExecutions))
    .filter((execution) =>
      execution.emailStatus === "pending" &&
      (execution.status === "completed" || execution.status === "failed"),
    );
  for (const execution of pending) {
    if (execution.status === "failed") {
      await sendFailureReport({
        dependencies,
        executionId: execution.id,
        recipient: execution.recipient,
        date: execution.scheduledDate,
        timezone: execution.timezone,
        appUrl,
        error: execution.error ?? "A previous Daily Hunter execution failed before its report was delivered",
        hunterRunId: execution.hunterRunId,
      });
      continue;
    }
    if (execution.hunterRunId && execution.review && typeof execution.review === "object") {
      const proposals = await db
        .select({ id: dailyHunterProposals.id })
        .from(dailyHunterProposals)
        .where(eq(dailyHunterProposals.executionId, execution.id));
      await sendCompletedReport({
        dependencies,
        executionId: execution.id,
        recipient: execution.recipient,
        date: execution.scheduledDate,
        timezone: execution.timezone,
        runId: execution.hunterRunId,
        review: execution.review as Record<string, any>,
        proposalIds: proposals.map((proposal) => proposal.id),
        appUrl,
      });
      continue;
    }
    // This should be unreachable for rows written by this routine. Preserve
    // the safety boundary by stopping rather than inventing a report.
    await db.update(dailyHunterExecutions).set({
      emailStatus: "unknown",
      error: "Completed execution has no recoverable report payload; delivery was not retried automatically",
    }).where(eq(dailyHunterExecutions.id, execution.id));
  }
}

export async function executeDailyHunter(
  dependencies: DailyHunterDependencies,
  appUrl: string,
  now = new Date(),
): Promise<{ executionId: number; duplicate: boolean; status: string }> {
  const lock = await acquireDailyHunterLock();
  if (!lock) {
    // A live replica owns the session lock for its full cycle. Do not infer
    // that its execution is stale or start an overlapping hunt.
    return { executionId: 0, duplicate: false, status: "busy" };
  }
  try {
    await recoverInterruptedDailyHunterExecutionsWhileLocked();
    await resumeKnownUnsentReportsWhileLocked(dependencies, appUrl);
  const routine = await getRoutine();
  const date = localDate(routine.timezone, now);
  if (!routine.enabled) {
    // Pausing never consumes today's one execution. An editor can resume later
    // and the next five-minute worker invocation will honor the same schedule.
    return { executionId: 0, duplicate: false, status: "paused" };
  }
  if (localTime(routine.timezone, now) < routine.localTime) {
    // The worker intentionally runs frequently; only the persisted local
    // schedule decides when it may claim this calendar day's work.
    return { executionId: 0, duplicate: false, status: "not_due" };
  }
  if (routine.weekday != null && localWeekday(routine.timezone, now) !== routine.weekday) {
    // A weekly routine: other days never consume an execution key.
    return { executionId: 0, duplicate: false, status: "not_due" };
  }
  const mode: RoutineMode = validMode(routine.mode) ? routine.mode : "query";
  // Keep the key timezone-independent: an editor correcting the timezone
  // later in the day must not accidentally authorize a second daily hunt.
  const executionKey = `daily-hunter:${routine.id}:${date}`;
  const inserted = await db
    .insert(dailyHunterExecutions)
    .values({
      routineId: routine.id,
      executionKey,
      scheduledDate: date,
      timezone: routine.timezone,
      recipient: routine.recipient,
      status: "running",
    })
    .onConflictDoNothing()
    .returning({ id: dailyHunterExecutions.id, status: dailyHunterExecutions.status });
  if (inserted.length === 0) {
    const [existing] = await db
      .select({ id: dailyHunterExecutions.id, status: dailyHunterExecutions.status })
      .from(dailyHunterExecutions)
      .where(eq(dailyHunterExecutions.executionKey, executionKey))
      .limit(1);
    if (!existing) throw new Error("Daily Hunter execution conflict could not be loaded");
    return { executionId: existing.id, duplicate: true, status: existing.status };
  }
  const executionId = inserted[0].id;
  let cycleRunId: number | null = null;
  // Claim the singleton active slot before starting a network-heavy cycle.
  // If yesterday's execution remains active, this row is an auditable skipped
  // invocation rather than a second concurrent hunt.
  const claimed = await db.update(dailyHunterRoutines).set({
    activeExecutionId: executionId,
  }).where(and(
    eq(dailyHunterRoutines.id, ROUTINE_ID),
    isNull(dailyHunterRoutines.activeExecutionId),
  )).returning({ id: dailyHunterRoutines.id });
  if (claimed.length === 0) {
    await db.update(dailyHunterExecutions).set({
      status: "skipped",
      emailStatus: "skipped",
      error: "Another Daily Hunter execution is still active; this invocation did not launch a duplicate cycle",
      finishedAt: new Date(),
    }).where(eq(dailyHunterExecutions.id, executionId));
    return { executionId, duplicate: false, status: "skipped" };
  }

  try {
    if (mode === "benchmark" && !dependencies.runBenchmark) {
      throw new Error("Benchmark mode is configured but no benchmark runner is wired into the routine");
    }
    const cycle = mode === "benchmark"
      ? await dependencies.runBenchmark!()
      : await dependencies.runCycle({ ...DAILY_SCOPE });
    cycleRunId = cycle.runId;
    if (!cycle.summary) {
      const failure = cycle.error ?? "Hunter cycle did not produce a summary";
      await db.update(dailyHunterExecutions).set({
        status: "failed",
        hunterRunId: cycle.runId,
        error: failure,
        finishedAt: new Date(),
      }).where(eq(dailyHunterExecutions.id, executionId));
      await sendFailureReport({
        dependencies,
        executionId,
        recipient: routine.recipient,
        date,
        timezone: routine.timezone,
        appUrl,
        error: failure,
        hunterRunId: cycle.runId,
      });
      return { executionId, duplicate: false, status: "failed" };
    }
    const review = await makeReview(executionId, cycle.runId, cycle.summary, appUrl, mode);
    const proposals = await db
      .select({ id: dailyHunterProposals.id })
      .from(dailyHunterProposals)
      .where(eq(dailyHunterProposals.executionId, executionId));
    await db.update(dailyHunterExecutions).set({
      status: "completed",
      hunterRunId: cycle.runId,
      review,
      finishedAt: new Date(),
    }).where(eq(dailyHunterExecutions.id, executionId));

    await sendCompletedReport({
      dependencies,
      executionId,
      recipient: routine.recipient,
      date,
      timezone: routine.timezone,
      runId: cycle.runId,
      review,
      proposalIds: proposals.map((row) => row.id),
      appUrl,
    });
    return { executionId, duplicate: false, status: "completed" };
  } catch (error) {
    const failure = `Daily review failed: ${safeError(error)}`;
    await db.update(dailyHunterExecutions).set({
      status: "failed",
      error: failure,
      finishedAt: new Date(),
    }).where(eq(dailyHunterExecutions.id, executionId));
    await sendFailureReport({
      dependencies,
      executionId,
      recipient: routine.recipient,
      date,
      timezone: routine.timezone,
      appUrl,
      error: failure,
      hunterRunId: cycleRunId,
    });
    return { executionId, duplicate: false, status: "failed" };
  } finally {
    // Compare against this execution id so a future claimant can never be
    // cleared by an older invocation finishing late.
    await db.update(dailyHunterRoutines).set({
      activeExecutionId: null,
      updatedAt: new Date(),
    }).where(and(
      eq(dailyHunterRoutines.id, ROUTINE_ID),
      eq(dailyHunterRoutines.activeExecutionId, executionId),
    )).catch((error) => {
      // Do not replace a completed run/email outcome with a cleanup error.
      // Restart recovery will release a stale claim if this write failed.
      console.error("daily Hunter active-execution release failed:", safeError(error));
    });
  }
  } finally {
    await lock.release();
  }
}

/**
 * Called only while the singleton advisory lock is held. The lock proves that
 * no replica can be in executeDailyHunter, so retained claims have no live
 * owner and can be made visible as interrupted without a clock heuristic.
 */
async function recoverInterruptedDailyHunterExecutionsWhileLocked(): Promise<number> {
  const interrupted = await db.update(dailyHunterExecutions).set({
    status: "failed",
    // Delivery was never claimed, so this is known-unsent and can be resumed
    // once by the next lock holder.
    emailStatus: "pending",
    error: "Execution owner ended before completion; the daily key remains reserved to prevent a duplicate hunt",
    finishedAt: new Date(),
  }).where(eq(dailyHunterExecutions.status, "running"))
    .returning({ id: dailyHunterExecutions.id });
  // A completed cycle can be interrupted after claiming Gmail delivery but
  // before receiving a response. Treat that as ambiguous permanently; a
  // restart must never turn it into a blind resend opportunity.
  const ambiguousMail = await db.update(dailyHunterExecutions).set({
    emailStatus: "unknown",
    error: "Server restarted while Gmail delivery was in progress; delivery outcome is unknown and will not be retried automatically",
  }).where(eq(dailyHunterExecutions.emailStatus, "sending"))
    .returning({ id: dailyHunterExecutions.id });
  // A holder cannot race this reset because it must own the same advisory
  // lock. This also clears a completed claim whose cleanup was interrupted.
  await db.update(dailyHunterRoutines).set({ activeExecutionId: null })
    .where(eq(dailyHunterRoutines.id, ROUTINE_ID));
  return interrupted.length + ambiguousMail.length;
}

export async function recoverInterruptedDailyHunterExecutions(): Promise<number> {
  const lock = await acquireDailyHunterLock();
  if (!lock) return 0;
  try {
    return await recoverInterruptedDailyHunterExecutionsWhileLocked();
  } finally {
    await lock.release();
  }
}
export function registerDailyHunterRoutes(
  app: Express,
  requireEditor: (req: Request, res: Response, next: NextFunction) => void,
  dependencies: DailyHunterDependencies,
) {
  recoverInterruptedDailyHunterExecutions().catch((error) =>
    console.error("daily Hunter restart recovery failed:", safeError(error)),
  );
  app.get("/api/hunter/daily", requireEditor, async (_req, res) => {
    const routine = await getRoutine();
    const executions = await db.select().from(dailyHunterExecutions)
      .where(eq(dailyHunterExecutions.routineId, ROUTINE_ID))
      .orderBy(desc(dailyHunterExecutions.id))
      .limit(30);
    const ids = executions.map((row) => row.id);
    const proposals = ids.length
      ? await db.select().from(dailyHunterProposals).where(inArray(dailyHunterProposals.executionId, ids)).orderBy(desc(dailyHunterProposals.id))
      : [];
    res.json({ routine, executions, proposals, deploymentNote: "A separate Replit Scheduled Deployment should invoke the single-purpose worker every five minutes. The worker enforces this saved local time and timezone without replacing the web deployment." });
  });

  app.put("/api/hunter/daily", requireEditor, async (req, res) => {
    const enabled = req.body?.enabled;
    const localTime = req.body?.localTime;
    const timezone = req.body?.timezone;
    const recipient = req.body?.recipient;
    if (typeof enabled !== "boolean" || !validTime(localTime) || !validTimezone(timezone) || !validRecipient(recipient)) {
      return res.status(400).json({ message: "enabled, a 24-hour HH:MM time, an IANA timezone, and a valid recipient are required" });
    }
    // mode and weekday are optional so older clients keep working; when
    // present they must be valid.
    if (req.body?.mode !== undefined && !validMode(req.body.mode)) {
      return res.status(400).json({ message: `mode must be one of ${ROUTINE_MODES.join(", ")}` });
    }
    if (req.body?.weekday !== undefined && !validWeekday(req.body.weekday)) {
      return res.status(400).json({ message: "weekday must be null (every day) or an integer 0 (Sunday) to 6 (Saturday)" });
    }
    if (req.body?.mode === "benchmark" && !dependencies.runBenchmark) {
      return res.status(400).json({ message: "Benchmark mode is not available on this deployment" });
    }
    const lock = await acquireDailyHunterLock();
    if (!lock) {
      return res.status(409).json({
        message: "Schedule change deferred while a Daily Hunter cycle is active; retry after it completes",
      });
    }
    try {
      const existingRoutine = await getRoutine();
      const mode: RoutineMode = req.body?.mode === undefined ? (validMode(existingRoutine.mode) ? existingRoutine.mode : "query") : req.body.mode;
      const weekday: number | null = req.body?.weekday === undefined ? existingRoutine.weekday : req.body.weekday;
      if (timezone !== existingRoutine.timezone && !(await timezoneEditPreservesExecutionDates(timezone))) {
        return res.status(409).json({
          message: "Timezone change deferred: it would remap an existing execution instant to a different local date and could break daily idempotency",
        });
      }
      const [routine] = await db.update(dailyHunterRoutines).set({
        enabled: enabled ? 1 : 0,
        localTime,
        timezone,
        recipient,
        mode,
        weekday,
        updatedAt: new Date(),
      }).where(eq(dailyHunterRoutines.id, ROUTINE_ID)).returning();
      res.json(routine);
    } finally {
      await lock.release();
    }
  });

  app.post("/api/internal/daily-hunter/trigger", requireDailyHunterWorker, async (req, res) => {
    const result = await executeDailyHunter(dependencies, baseUrl(req));
    res.status(result.duplicate ? 200 : 202).json(result);
  });

  app.post("/api/hunter/daily/proposals/:id/:decision", requireEditor, async (req, res) => {
    const id = Number(req.params.id);
    const decision = req.params.decision;
    if (!Number.isInteger(id) || id <= 0 || (decision !== "approve" && decision !== "reject")) {
      return res.status(400).json({ message: "Invalid proposal decision" });
    }
    const [proposal] = await db.update(dailyHunterProposals).set({
      status: decision === "approve" ? "approved" : "rejected",
      decisionNote: typeof req.body?.note === "string" ? req.body.note.slice(0, 1000) : null,
      decidedAt: new Date(),
    }).where(eq(dailyHunterProposals.id, id)).returning();
    if (!proposal) return res.status(404).json({ message: "Proposal not found" });
    res.json(proposal);
  });

  app.get("/api/hunter/daily/proposals/:id/brief", requireEditor, async (req, res) => {
    const id = Number(req.params.id);
    const [proposal] = Number.isInteger(id)
      ? await db.select().from(dailyHunterProposals).where(eq(dailyHunterProposals.id, id)).limit(1)
      : [];
    if (!proposal) return res.status(404).json({ message: "Proposal not found" });
    if (proposal.status !== "approved") return res.status(409).json({ message: "Approve this proposal before exporting its engineering brief" });
    res.type("text/markdown").attachment(`daily-hunter-proposal-${proposal.id}.md`).send([
      `# ${proposal.title}`,
      "",
      "## Approved engineering brief",
      proposal.summary,
      "",
      "## Evidence",
      "```json",
      JSON.stringify(proposal.evidence, null, 2),
      "```",
      "",
      "## Safety boundary",
      "This brief is a review task only. It does not authorize code edits, rights/licensing determinations, or trusted-source policy changes.",
    ].join("\n"));
  });
}