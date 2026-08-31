import { afterEach, describe, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { resolveSafeCorpusPath } from "../hunterBotRoutes";

const corpusRoot = path.resolve(process.cwd(), "data", "hunter-corpus");
const cleanup: string[] = [];

afterEach(async () => {
  await Promise.all(cleanup.splice(0).map((entry) => fs.rm(entry, { recursive: true, force: true })));
});

describe("Hunter bot corpus paths", () => {
  it("accepts an existing file inside the corpus root", async () => {
    const dir = await fs.mkdtemp(path.join(corpusRoot, ".bot-api-test-"));
    cleanup.push(dir);
    const file = path.join(dir, "inside.txt");
    await fs.writeFile(file, "safe");
    await expect(resolveSafeCorpusPath(path.relative(corpusRoot, file))).resolves.toBe(file);
  });

  it("rejects traversal and absolute paths", async () => {
    await expect(resolveSafeCorpusPath("../../etc/passwd")).resolves.toBeNull();
    await expect(resolveSafeCorpusPath("/etc/passwd")).resolves.toBeNull();
  });

  it("rejects a symlink whose target is outside the corpus root", async () => {
    const dir = await fs.mkdtemp(path.join(corpusRoot, ".bot-api-test-"));
    const outside = await fs.mkdtemp(path.join(os.tmpdir(), "hunter-bot-outside-"));
    cleanup.push(dir, outside);
    const secret = path.join(outside, "outside.txt");
    const link = path.join(dir, "escape.txt");
    await fs.writeFile(secret, "must not escape");
    await fs.symlink(secret, link);
    await expect(resolveSafeCorpusPath(path.relative(corpusRoot, link))).resolves.toBeNull();
  });
});