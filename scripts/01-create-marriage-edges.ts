import { db } from "../server/storage";
import { nodes, edges } from "../shared/schema";
import { sql, eq, and, or } from "drizzle-orm";

const DEFAULT_PROJECT_ID = 6;

interface SpouseMention {
  nodeId: number;
  nodeName: string;
  tradition: string;
  rawValue: string;
  spouseHints: string[];
  alsoSibling: boolean;
}

function extractSpouseHints(raw: string): { hints: string[]; alsoSibling: boolean } {
  const lower = raw.toLowerCase().trim();
  let alsoSibling = false;
  if (/\(.*sister.*\)|\(.*brother.*\)|sister-brother|brother-sister|wife-sister|husband-brother/.test(lower)) {
    alsoSibling = true;
  }
  let body = raw
    .replace(/^(wife of |husband of |wife-sister of |husband-brother of |sister-brother to |brother-sister to )/i, "")
    .replace(/^(former wife of |former husband of )/i, "");
  body = body.replace(/\([^)]*\)/g, " ").trim();
  const married3 = raw.match(/married\s+\w+\s+times?\s*\(([^)]+)\)/i);
  if (married3) {
    return {
      hints: married3[1].split(/,|;|\sand\s/).map((s) => s.trim()).filter(Boolean),
      alsoSibling: false,
    };
  }
  const parts = body.split(/\s+and\s+|,|;|\s*\/\s*/).map((s) => s.trim()).filter(Boolean);
  const cleaned = parts
    .map((p) => p.replace(/^the\s+/i, "").replace(/^cowherd\s+/i, "").replace(/^archer\s+/i, "").trim())
    .filter((p) => p.length > 1 && !/^(his|her|in homer|in hesiod|then separated|after |importing |with sons? |with daughters? |in some|popular tradition|by .* in )/i.test(p) || /^[A-ZÀ-Ÿ]/.test(p));
  return { hints: cleaned, alsoSibling };
}

function stripDiacritics(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/ṣ/g, "s").replace(/ṛ/g, "r").replace(/ṇ/g, "n").replace(/ṭ/g, "t").replace(/ḍ/g, "d").replace(/ñ/g, "n").replace(/ś/g, "s").replace(/ṃ/g, "m").replace(/ḥ/g, "h").replace(/ǫ/g, "o").replace(/ø/g, "o").replace(/ð/g, "d").replace(/þ/g, "th").replace(/ḷ/g, "l").replace(/ḻ/g, "l").toLowerCase();
}

const MANUAL_ALIASES: Record<string, string> = {
  "queen mother of the west": "Xiwangmu",
};

function normVariants(s: string): string[] {
  const base = stripDiacritics(s);
  const sanskrit = s.toLowerCase().replace(/ṣ/g, "sh").replace(/ś/g, "sh").replace(/ṛ/g, "ri").replace(/ṇ/g, "n").replace(/ṭ/g, "t").replace(/ḍ/g, "d").replace(/ñ/g, "n").replace(/ṃ/g, "m").replace(/ḥ/g, "h").replace(/ḷ/g, "l").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const vw = base.replace(/v/g, "w");
  const wv = base.replace(/w/g, "v");
  const sanV = sanskrit.replace(/v/g, "w");
  const sanW = sanskrit.replace(/w/g, "v");
  return Array.from(new Set([base, sanskrit, vw, wv, sanV, sanW]));
}

let allNodesCache: any[] | null = null;
async function loadAll() {
  if (!allNodesCache) allNodesCache = await db.select().from(nodes);
  return allNodesCache!;
}

async function findCandidate(name: string, tradition: string) {
  const all = await loadAll();
  const aliasKey = name.toLowerCase().trim();
  if (MANUAL_ALIASES[aliasKey]) name = MANUAL_ALIASES[aliasKey];
  const exactSame = all.filter((n) => n.name === name && n.tradition === tradition);
  if (exactSame.length === 1) return { match: exactSame[0], confidence: "exact-same-tradition" };
  const exactAny = all.filter((n) => n.name === name);
  if (exactAny.length === 1) return { match: exactAny[0], confidence: "exact-other-tradition" };
  if (exactAny.length > 1) {
    const sameTrad = exactAny.find((n) => n.tradition === tradition);
    if (sameTrad) return { match: sameTrad, confidence: "exact-same-tradition" };
    return { match: null as any, confidence: "ambiguous-multiple", candidates: exactAny.map((n: any) => `${n.name} (${n.tradition})`) };
  }
  const targets = normVariants(name);
  const diac = all.filter((n) => {
    const cands = normVariants(n.name);
    return cands.some((c) => targets.includes(c));
  });
  if (diac.length === 1) return { match: diac[0], confidence: "diacritic-match" };
  if (diac.length > 1) {
    const sameTrad = diac.find((n) => n.tradition === tradition);
    if (sameTrad) return { match: sameTrad, confidence: "diacritic-same-tradition" };
    return { match: null as any, confidence: "ambiguous-diacritic", candidates: diac.map((n: any) => `${n.name} (${n.tradition})`) };
  }
  // Loose: name appears as prefix of a node name (e.g. "Persephone" matches "Persephone (Kore)")
  const loose = all.filter((n) => {
    const a = stripDiacritics(n.name);
    return targets.some((t) => a === t || a.startsWith(t + " ") || a.startsWith(t + "(") || a.startsWith(t + "-"));
  });
  if (loose.length === 1) return { match: loose[0], confidence: "loose-prefix-match" };
  if (loose.length > 1) {
    const sameTrad = loose.find((n) => n.tradition === tradition);
    if (sameTrad) return { match: sameTrad, confidence: "loose-prefix-same-tradition" };
  }
  return { match: null as any, confidence: "not-found" };
}

async function edgeExists(srcId: number, tgtId: number, relation: string) {
  const e = await db
    .select()
    .from(edges)
    .where(
      and(
        or(
          and(eq(edges.sourceNodeId, srcId), eq(edges.targetNodeId, tgtId)),
          and(eq(edges.sourceNodeId, tgtId), eq(edges.targetNodeId, srcId)),
        ),
        eq(edges.relationType, relation),
      ),
    );
  return e.length > 0;
}

async function main() {
  const dryRun = !process.argv.includes("--apply");
  console.log(`Mode: ${dryRun ? "DRY RUN (no DB changes)" : "APPLY"}`);

  const all = await db.select().from(nodes);
  const mentions: SpouseMention[] = [];
  for (const n of all) {
    if (!n.familyRoles) continue;
    for (const role of n.familyRoles) {
      if (
        /^(wife of|husband of|wife-sister of|husband-brother of|sister-brother to|brother-sister to|former wife of|former husband of)/i.test(
          role,
        ) ||
        /^married\s+\w+\s+times?/i.test(role)
      ) {
        const { hints, alsoSibling } = extractSpouseHints(role);
        mentions.push({ nodeId: n.id, nodeName: n.name, tradition: n.tradition, rawValue: role, spouseHints: hints, alsoSibling });
      }
    }
  }

  console.log(`\nMentions detectees: ${mentions.length}`);

  const reportRows: string[] = [];
  reportRows.push("nodeName\ttradition\trawValue\tspouseHint\tmatch\tconfidence\taction");

  let created = 0;
  let skippedExisting = 0;
  let notFound = 0;
  let ambiguous = 0;

  for (const m of mentions) {
    if (m.spouseHints.length === 0) {
      reportRows.push(`${m.nodeName}\t${m.tradition}\t${m.rawValue}\t(no hint)\t-\tno-hint\tSKIP`);
      notFound++;
      continue;
    }
    for (const hint of m.spouseHints) {
      const result = await findCandidate(hint, m.tradition);
      if (!result.match) {
        const detail = result.confidence === "ambiguous-multiple" ? `[${(result as any).candidates?.join(" | ")}]` : "";
        reportRows.push(`${m.nodeName}\t${m.tradition}\t${m.rawValue}\t${hint}\t${detail}\t${result.confidence}\tSKIP`);
        if (result.confidence === "ambiguous-multiple") ambiguous++;
        else notFound++;
        continue;
      }
      const target = result.match;
      if (target.id === m.nodeId) {
        reportRows.push(`${m.nodeName}\t${m.tradition}\t${m.rawValue}\t${hint}\t${target.name}\tself-match\tSKIP`);
        continue;
      }
      const hasMarried = await edgeExists(m.nodeId, target.id, "married to");
      if (hasMarried) {
        reportRows.push(`${m.nodeName}\t${m.tradition}\t${m.rawValue}\t${hint}\t${target.name} (${target.tradition})\t${result.confidence}\tEXISTS`);
        skippedExisting++;
      } else {
        if (!dryRun) {
          await db.insert(edges).values({
            projectId: DEFAULT_PROJECT_ID,
            sourceNodeId: m.nodeId,
            targetNodeId: target.id,
            relationType: "married to",
            weight: 1,
          });
        }
        reportRows.push(`${m.nodeName}\t${m.tradition}\t${m.rawValue}\t${hint}\t${target.name} (${target.tradition})\t${result.confidence}\tCREATED-MARRIED`);
        created++;
      }
      if (m.alsoSibling) {
        const hasSib = await edgeExists(m.nodeId, target.id, "sibling of");
        if (!hasSib) {
          if (!dryRun) {
            await db.insert(edges).values({
              projectId: DEFAULT_PROJECT_ID,
              sourceNodeId: m.nodeId,
              targetNodeId: target.id,
              relationType: "sibling of",
              weight: 1,
            });
          }
          reportRows.push(`${m.nodeName}\t${m.tradition}\t${m.rawValue}\t${hint}\t${target.name} (${target.tradition})\t${result.confidence}\tCREATED-SIBLING`);
          created++;
        }
      }
    }
  }

  const fs = await import("fs");
  fs.writeFileSync("scripts/reports/01-marriage-edges.tsv", reportRows.join("\n"));
  console.log(`\n=== SUMMARY ===`);
  console.log(`  Mentions: ${mentions.length}`);
  console.log(`  Edges to create: ${created}`);
  console.log(`  Already exist: ${skippedExisting}`);
  console.log(`  Not found: ${notFound}`);
  console.log(`  Ambiguous (multi-match): ${ambiguous}`);
  console.log(`\nReport: scripts/reports/01-marriage-edges.tsv`);
  if (dryRun) console.log(`\n>>> DRY RUN — no changes applied. Re-run with --apply to commit.`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
