import { db } from "../server/storage";
import { nodes, edges } from "../shared/schema";
import { eq, sql } from "drizzle-orm";
import { readFileSync, writeFileSync } from "fs";

const REPORT = "scripts/reports/10-domain-syncretism.tsv";
const APPLY_LOG = "scripts/reports/10b-applied.tsv";
const APPLY = process.argv.includes("--apply");

const TRIGGERS = [
  /\bidentified\s+with\b/i,
  /\bequated\s+with\b/i,
  /\bequivalent\s+(of|to)\b/i,
  /\bsynonymous\s+with\b/i,
  /\bcognate\s+(of|with)\b/i,
  /\bthe\s+(greek|roman|egyptian|norse|hindu|chinese|japanese|mesopotamian|sumerian|akkadian|babylonian|canaanite|phoenician|carthaginian|punic|celtic|gallic|germanic|aztec|maya|mayan|shinto|buddhist|gnostic|abrahamic|christian|jewish|islamic|muslim|persian|phrygian|balinese|etruscan|sabine|latin|olympian)\s+(form|version|equivalent|counterpart|name|aspect|interpretation|interpretatio)\b/i,
  /\binterpretatio\s+(graeca|romana|germanica|christiana|latina)\b/i,
  /\banother\s+name\s+for\b/i,
  /\balso\s+known\s+as\b/i,
  /\bsame\s+as\b/i,
  /\bassimilated\s+(to|with)\b/i,
  /\bcorresponds?\s+to\b/i,
  /\bmerged\s+with\b/i,
  /\bidentif(ied|ication)\b/i,
  /\b(roman|greek|latin|sumerian|akkadian|egyptian)\s+name\s+for\b/i,
];

function hasTrigger(text: string): boolean {
  return TRIGGERS.some(r => r.test(text));
}

type Row = {
  id: number; name: string; tradition: string;
  old_domain: string; new_domain: string;
  edge_ids: number[]; edge_names: string[];
  identifications: string[];
};

const lines = readFileSync(REPORT, "utf-8").split("\n").slice(1).filter(l => l.trim());
const rows: Row[] = lines.map(ln => {
  const c = ln.split("\t");
  return {
    id: parseInt(c[0]), name: c[1], tradition: c[2],
    old_domain: c[3] || "", new_domain: c[4] || "",
    edge_ids: c[5] ? c[5].split("|").filter(Boolean).map(Number) : [],
    edge_names: c[6] ? c[6].split("|").filter(Boolean) : [],
    identifications: c[7] ? c[7].split("|").filter(Boolean) : [],
  };
});

let domainChanges = 0;
let edgesKept = 0, edgesRejected = 0;
let idsKept = 0, idsRejected = 0;
const applied: string[] = ["id\tname\told_domain\tnew_domain\ttrigger\tedges_kept\tids_kept\tedges_rejected\tids_rejected"];

(async () => {
  // Load existing edges to avoid duplicates
  const existingEdges = await db.select().from(edges).where(eq(edges.relationType, "identified with"));
  const edgeSet = new Set(existingEdges.map(e => `${e.sourceNodeId}->${e.targetNodeId}`));
  const reverseSet = new Set(existingEdges.map(e => `${e.targetNodeId}->${e.sourceNodeId}`));

  for (const r of rows) {
    const trigger = hasTrigger(r.old_domain);
    const keptEdges: Array<{ id: number; name: string }> = [];
    const rejectedEdges: string[] = [];
    const keptIds: string[] = [];
    const rejectedIds: string[] = [];
    if (trigger) {
      for (let i = 0; i < r.edge_ids.length; i++) {
        keptEdges.push({ id: r.edge_ids[i], name: r.edge_names[i] || "?" });
      }
      for (const idn of r.identifications) keptIds.push(idn);
      edgesKept += keptEdges.length;
      idsKept += keptIds.length;
    } else {
      for (let i = 0; i < r.edge_ids.length; i++) rejectedEdges.push(r.edge_names[i] || "?");
      for (const idn of r.identifications) rejectedIds.push(idn);
      edgesRejected += rejectedEdges.length;
      idsRejected += rejectedIds.length;
    }

    if (r.new_domain && r.new_domain !== r.old_domain) domainChanges++;

    applied.push([
      r.id, r.name,
      r.old_domain.slice(0, 80),
      r.new_domain,
      trigger ? "Y" : "N",
      keptEdges.map(e => e.name).join("|"),
      keptIds.join("|"),
      rejectedEdges.join("|"),
      rejectedIds.join("|"),
    ].join("\t"));

    if (!APPLY) continue;

    // Apply: domain rewrite (always)
    if (r.new_domain && r.new_domain !== r.old_domain) {
      await db.update(nodes).set({ domain: r.new_domain }).where(eq(nodes.id, r.id));
    }
    // Apply: edges (only if trigger)
    for (const e of keptEdges) {
      const k1 = `${r.id}->${e.id}`, k2 = `${e.id}->${r.id}`;
      if (edgeSet.has(k1) || reverseSet.has(k1) || edgeSet.has(k2) || reverseSet.has(k2)) continue;
      await db.insert(edges).values({
        sourceNodeId: r.id, targetNodeId: e.id,
        relationType: "identified with", weight: 1, projectId: 6,
      });
      edgeSet.add(k1);
    }
    // Apply: identifications (only if trigger) — append to text[] uniquely
    if (keptIds.length > 0) {
      const node = await db.select().from(nodes).where(eq(nodes.id, r.id));
      const cur = (node[0]?.identification as string[] | null) || [];
      const norm = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
      const have = new Set(cur.map(norm));
      const merged = [...cur];
      for (const idn of keptIds) {
        if (!have.has(norm(idn))) {
          merged.push(idn);
          have.add(norm(idn));
        }
      }
      if (merged.length !== cur.length) {
        await db.update(nodes).set({ identification: merged }).where(eq(nodes.id, r.id));
      }
    }
  }

  writeFileSync(APPLY_LOG, applied.join("\n"));
  console.log(`Report: ${APPLY_LOG}`);
  console.log(`Domain rewrites: ${domainChanges}/${rows.length}`);
  console.log(`Edges kept: ${edgesKept} | rejected: ${edgesRejected}`);
  console.log(`Identifications kept: ${idsKept} | rejected: ${idsRejected}`);
  console.log(APPLY ? "APPLIED to DB" : "(dry-run — pass --apply)");
  process.exit(0);
})();
