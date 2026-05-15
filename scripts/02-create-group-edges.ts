import { db } from "../server/storage";
import { nodes, edges } from "../shared/schema";
import { eq, and, or } from "drizzle-orm";

const PROJECT_ID = 6;

const GROUPS: Array<{ name: string; tradition: string; members: string[] }> = [
  { name: "Eight Immortals", tradition: "Chinese", members: ["Lu Dongbin", "Cao Guojiu", "Lan Caihe", "He Xiangu", "Zhongli Quan", "Han Xiangzi", "Zhang Guolao", "Li Tieguai"] },
  { name: "Three Pure Ones", tradition: "Chinese", members: ["Yuanshi Tianzun", "Lingbao Tianzun", "Daode Tianzun"] },
  { name: "Three Sovereigns", tradition: "Chinese", members: ["Fuxi", "Shennong", "Nuwa", "Huangdi"] },
  { name: "Seven Lucky Gods", tradition: "Shinto", members: ["Ebisu", "Daikokuten", "Bishamonten", "Benzaiten", "Fukurokuju", "Jurojin", "Hotei"] },
  { name: "Four Heavenly Kings", tradition: "Buddhist", members: ["Vaisravana", "Dhrtarastra", "Virudhaka", "Virupaksha", "Bishamonten"] },
  { name: "Hermopolitan Ogdoad", tradition: "Egyptian", members: ["Amun", "Amunet", "Kuk", "Kauket", "Heh", "Hauhet", "Nun", "Naunet"] },
  { name: "Capitoline Triad", tradition: "Roman", members: ["Jupiter", "Juno", "Minerva"] },
  { name: "Archaic Triad", tradition: "Roman", members: ["Jupiter", "Mars", "Quirinus"] },
  { name: "Aventine Triad", tradition: "Roman", members: ["Ceres", "Liber", "Libera"] },
  { name: "eight Vasus", tradition: "Hindu", members: ["Agni", "Vasu"] },
  { name: "three Fates", tradition: "Greek", members: ["Clotho", "Lachesis", "Atropos", "Moirai"] },
  { name: "three virgin goddesses", tradition: "Greek", members: ["Athena", "Artemis", "Hestia"] },
  { name: "four Tezcatlipocas", tradition: "Aztec", members: ["Tezcatlipoca", "Quetzalcoatl", "Huitzilopochtli", "Xipe Totec", "Xipe-Totec"] },
  { name: "three brothers (Zeus-Poseidon-Hades)", tradition: "Greek", members: ["Zeus", "Poseidon", "Hades"] },
];

async function findNode(name: string, tradition: string, all: any[]) {
  const exactSame = all.find((n) => n.name === name && n.tradition === tradition);
  if (exactSame) return exactSame;
  const exactAny = all.find((n) => n.name === name);
  if (exactAny) return exactAny;
  const ci = all.find((n) => n.name.toLowerCase() === name.toLowerCase());
  return ci ?? null;
}

async function edgeExists(srcId: number, tgtId: number, rt: string) {
  const e = await db
    .select()
    .from(edges)
    .where(
      and(
        or(
          and(eq(edges.sourceNodeId, srcId), eq(edges.targetNodeId, tgtId)),
          and(eq(edges.sourceNodeId, tgtId), eq(edges.targetNodeId, srcId)),
        ),
        eq(edges.relationType, rt),
      ),
    );
  return e.length > 0;
}

async function main() {
  const dryRun = !process.argv.includes("--apply");
  console.log(`Mode: ${dryRun ? "DRY RUN" : "APPLY"}`);
  const all = await db.select().from(nodes);
  const report: string[] = ["group\tmember1\tmember2\taction"];
  let created = 0, skipped = 0, missing = 0;

  for (const g of GROUPS) {
    const resolved: any[] = [];
    const missingMembers: string[] = [];
    for (const m of g.members) {
      const found = await findNode(m, g.tradition, all);
      if (found) resolved.push(found);
      else missingMembers.push(m);
    }
    if (missingMembers.length > 0) {
      report.push(`${g.name}\t-\t-\tMISSING: ${missingMembers.join(", ")}`);
      missing += missingMembers.length;
    }
    // Pairwise edges
    for (let i = 0; i < resolved.length; i++) {
      for (let j = i + 1; j < resolved.length; j++) {
        const a = resolved[i], b = resolved[j];
        const exists = await edgeExists(a.id, b.id, "group");
        if (exists) {
          report.push(`${g.name}\t${a.name}\t${b.name}\tEXISTS`);
          skipped++;
        } else {
          if (!dryRun) {
            await db.insert(edges).values({
              projectId: PROJECT_ID,
              sourceNodeId: a.id,
              targetNodeId: b.id,
              relationType: "group",
              weight: 1,
            });
          }
          report.push(`${g.name}\t${a.name}\t${b.name}\tCREATED`);
          created++;
        }
      }
    }
  }

  const fs = await import("fs");
  fs.writeFileSync("scripts/reports/02-group-edges.tsv", report.join("\n"));
  console.log(`\nGroups: ${GROUPS.length}`);
  console.log(`Edges to create: ${created}`);
  console.log(`Already exist: ${skipped}`);
  console.log(`Missing members: ${missing}`);
  console.log("Report: scripts/reports/02-group-edges.tsv");
  if (dryRun) console.log(">>> DRY RUN — re-run with --apply");
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
