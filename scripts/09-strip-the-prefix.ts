import { db } from "../server/storage";
import { nodes } from "../shared/schema";
import { eq } from "drizzle-orm";
import { writeFileSync } from "fs";

const KEEP_LOWER = new Set(["nile"]);

function stripThe(value: string): string {
  return value.replace(/(^|[,;]\s*)the\s+([^,;]+)/gi, (match, sep, rest) => {
    const firstWord = rest.trimStart().split(/[\s\-]/)[0];
    const isCapitalized = /^[A-Z]/.test(firstWord);
    if (isCapitalized && !KEEP_LOWER.has(firstWord.toLowerCase())) return match;
    return sep + rest;
  });
}

async function run() {
  const dryRun = !process.argv.includes("--apply");
  const all = await db.select().from(nodes);
  const changes: Array<{ id: number; name: string; field: string; before: string; after: string }> = [];

  for (const n of all) {
    for (const field of ["domain", "object"] as const) {
      const v = (n as any)[field] as string | null;
      if (!v) continue;
      const out = stripThe(v);
      if (out !== v) changes.push({ id: n.id, name: n.name, field, before: v, after: out });
    }
  }

  const tsv = ["id\tname\tfield\tbefore\tafter"];
  for (const c of changes) tsv.push(`${c.id}\t${c.name}\t${c.field}\t${c.before}\t${c.after}`);
  writeFileSync("scripts/reports/09-strip-the.tsv", tsv.join("\n"));

  console.log(`Changes: ${changes.length} ${dryRun ? "(dry-run)" : "(APPLIED)"}`);
  console.log(`  domain: ${changes.filter(c => c.field === "domain").length}`);
  console.log(`  object: ${changes.filter(c => c.field === "object").length}`);
  console.log(`Report: scripts/reports/09-strip-the.tsv`);

  if (!dryRun) {
    for (const c of changes) {
      await db.update(nodes).set({ [c.field]: c.after } as any).where(eq(nodes.id, c.id));
    }
    console.log("DB updated.");
  }
  process.exit(0);
}
run().catch(e => { console.error(e); process.exit(1); });
