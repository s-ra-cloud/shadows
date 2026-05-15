import { db } from "../server/storage";
import { nodes, edges } from "../shared/schema";
import { and, eq } from "drizzle-orm";
import { writeFileSync } from "fs";

const PROJECT_ID = 6;

const PAIRS: Array<[string, string, string]> = [
  ["Bellerophon", "Chimera", "slays monster"],
  ["Theseus", "Minotaur", "slays monster"],
  ["Hunahpu", "Vucub Caquix", "slays monster"],
  ["Xbalanque", "Vucub Caquix", "slays monster"],
  ["Hunahpu", "Hun-Came", "defeats underworld lord"],
  ["Xbalanque", "Hun-Came", "defeats underworld lord"],
  ["Hunahpu", "Vucub-Came", "defeats underworld lord"],
  ["Xbalanque", "Vucub-Came", "defeats underworld lord"],
  ["Siddhartha Gautama", "Mara", "defeats tempter"],
  ["Nezha", "Dragon King", "slays son of"],
];

async function run() {
  const dryRun = !process.argv.includes("--apply");
  const allNodes = await db.select().from(nodes);
  const byName = new Map<string, number>();
  for (const n of allNodes) byName.set(n.name, n.id);

  const existing = await db.select().from(edges).where(eq(edges.relationType, "adversary of"));
  const existingPairs = new Set(existing.map(e => `${e.sourceNodeId}->${e.targetNodeId}`));

  const toCreate: Array<{ source: string; target: string; sourceId: number; targetId: number; reason: string; status: string }> = [];

  for (const [s, t, reason] of PAIRS) {
    const sId = byName.get(s);
    const tId = byName.get(t);
    if (!sId || !tId) {
      toCreate.push({ source: s, target: t, sourceId: sId ?? 0, targetId: tId ?? 0, reason, status: "MISSING_NODE" });
      continue;
    }
    if (existingPairs.has(`${sId}->${tId}`) || existingPairs.has(`${tId}->${sId}`)) {
      toCreate.push({ source: s, target: t, sourceId: sId, targetId: tId, reason, status: "ALREADY_EXISTS" });
      continue;
    }
    toCreate.push({ source: s, target: t, sourceId: sId, targetId: tId, reason, status: "NEW" });
  }

  const tsv = ["source\ttarget\treason\tstatus"];
  for (const r of toCreate) tsv.push(`${r.source}\t${r.target}\t${r.reason}\t${r.status}`);
  writeFileSync("scripts/reports/08-slay-adversary.tsv", tsv.join("\n"));

  const newOnes = toCreate.filter(r => r.status === "NEW");
  console.log(`Total candidates: ${toCreate.length}`);
  console.log(`  NEW: ${newOnes.length}`);
  console.log(`  ALREADY_EXISTS: ${toCreate.filter(r => r.status === "ALREADY_EXISTS").length}`);
  console.log(`  MISSING_NODE: ${toCreate.filter(r => r.status === "MISSING_NODE").length}`);
  console.log(`Report: scripts/reports/08-slay-adversary.tsv`);

  if (!dryRun && newOnes.length > 0) {
    for (const r of newOnes) {
      await db.insert(edges).values({
        projectId: PROJECT_ID,
        sourceNodeId: r.sourceId,
        targetNodeId: r.targetId,
        relationType: "adversary of",
        weight: 1,
      });
    }
    console.log(`Inserted ${newOnes.length} adversary edges.`);
  } else if (dryRun) {
    console.log("(dry-run — pass --apply to insert)");
  }
  process.exit(0);
}
run().catch(e => { console.error(e); process.exit(1); });
