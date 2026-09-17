/**
 * The checked-in benchmark corpus list.
 *
 * `data/hunter-benchmark/shadows-benchmark.csv` is a fixed list of primary
 * sources across the project's traditions. Hunting it on a schedule and
 * comparing the per-item outcomes run over run is how Source Hunter
 * progress is measured. The list is read from disk on every launch so an
 * edit merged to the repository takes effect on the next run without a
 * restart.
 */
import { promises as fs } from "node:fs";
import * as path from "node:path";
import { parseCorpusList, type CorpusList } from "./hunterCorpusList";

export const BENCHMARK_LIST_FILENAME = "shadows-benchmark.csv";

/** Cycle name every benchmark run is stored under (the file's base name). */
export const BENCHMARK_LIST_NAME = "shadows-benchmark";

/** Resolved at call time so tests that point `process.cwd()` at a temp dir see their own list. */
export function benchmarkListPath(): string {
  return path.resolve(process.cwd(), "data", "hunter-benchmark", BENCHMARK_LIST_FILENAME);
}

export class BenchmarkListUnavailableError extends Error {}

export async function loadBenchmarkList(): Promise<CorpusList> {
  const file = benchmarkListPath();
  let content: string;
  try {
    content = await fs.readFile(file, "utf8");
  } catch (e) {
    throw new BenchmarkListUnavailableError(
      `Benchmark list not found at ${path.relative(process.cwd(), file)}: ${e instanceof Error ? e.message : String(e)}`,
    );
  }
  const list = parseCorpusList(BENCHMARK_LIST_FILENAME, content);
  if (list.name !== BENCHMARK_LIST_NAME) {
    throw new BenchmarkListUnavailableError(
      `Benchmark list must be named ${BENCHMARK_LIST_NAME} (got ${list.name})`,
    );
  }
  return list;
}
