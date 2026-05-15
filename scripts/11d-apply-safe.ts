import { db } from "../server/storage";
import { nodes, edges } from "../shared/schema";
import { writeFileSync } from "fs";
import { eq } from "drizzle-orm";

const PROJECT_ID = 6;
const DRY_RUN = process.argv.includes("--dry-run");

const CANONICAL_KIN = new Set([
  "mother", "father", "sister", "brother", "son", "daughter",
  "husband", "wife", "spouse", "consort",
  "grandfather", "grandmother", "grandson", "granddaughter",
  "uncle", "aunt", "nephew", "niece", "cousin",
  "twin", "stepmother", "stepfather", "stepson", "stepdaughter",
  "stepsister", "stepbrother", "in-law",
  "ancestor", "descendant", "progenitor", "offspring", "child", "sibling",
  "half-sister", "half-brother", "half-sibling",
]);

const REL_PATTERNS: Array<{ re: RegExp; bare: string; relType: string }> = [
  { re: /^(?:the\s+)?mother\s+of\s+(.+)$/i, bare: "mother", relType: "parent of" },
  { re: /^(?:the\s+)?father\s+of\s+(.+)$/i, bare: "father", relType: "parent of" },
  { re: /^(?:the\s+)?son\s+of\s+(.+)$/i, bare: "son", relType: "child of" },
  { re: /^(?:the\s+)?daughter\s+of\s+(.+)$/i, bare: "daughter", relType: "child of" },
  { re: /^(?:the\s+)?wife\s+of\s+(.+)$/i, bare: "wife", relType: "married to" },
  { re: /^(?:the\s+)?husband\s+of\s+(.+)$/i, bare: "husband", relType: "married to" },
  { re: /^(?:the\s+)?consort\s+of\s+(.+)$/i, bare: "consort", relType: "married to" },
  { re: /^(?:the\s+)?spouse\s+of\s+(.+)$/i, bare: "spouse", relType: "married to" },
  { re: /^(?:the\s+)?sister\s+of\s+(.+)$/i, bare: "sister", relType: "sibling of" },
  { re: /^(?:the\s+)?brother\s+of\s+(.+)$/i, bare: "brother", relType: "sibling of" },
  { re: /^(?:the\s+)?sibling\s+of\s+(.+)$/i, bare: "sibling", relType: "sibling of" },
  { re: /^(?:the\s+)?(?:twin\s+brother|twin\s+sister|twin)\s+(?:brother\s+|sister\s+)?of\s+(.+)$/i, bare: "twin", relType: "sibling of" },
  { re: /^(?:the\s+)?grandfather\s+of\s+(.+)$/i, bare: "grandfather", relType: "ancestor of" },
  { re: /^(?:the\s+)?grandmother\s+of\s+(.+)$/i, bare: "grandmother", relType: "ancestor of" },
];

function normName(s: string): string {
  return s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
}
const GENERIC_TARGET_BLOCKLIST = new Set([
  "men", "women", "gods", "goddesses", "people", "humans", "humanity", "mankind",
  "mortals", "believers", "all", "all things", "everything", "world", "earth",
  "heaven", "sky", "sea", "sun", "moon", "stars", "life", "death", "day", "night",
  "light", "darkness", "fire", "water", "wind", "time", "souls", "spirits",
  "children", "sons", "daughters", "humans and gods", "gods and men",
]);
function parseTargets(rest: string): string[] {
  const cleaned = rest.replace(/\([^)]*\)/g, "").trim();
  return cleaned
    .split(/\s+and\s+|,|;/)
    .map(s => s.replace(/^(?:the|a|an)\s+/i, "").trim())
    .filter(s => s.length >= 2 && s.length <= 60)
    .filter(s => !GENERIC_TARGET_BLOCKLIST.has(s.toLowerCase()));
}

(async () => {
  const all = await db.select().from(nodes);
  const byNorm = new Map<string, { id: number; name: string }>();
  for (const n of all) byNorm.set(normName(n.name), { id: n.id, name: n.name });

  const allEdges = await db.select().from(edges);
  const edgeSet = new Set<string>();
  for (const e of allEdges) {
    edgeSet.add(`${e.sourceNodeId}-${e.targetNodeId}-${e.relationType}`);
    edgeSet.add(`${e.targetNodeId}-${e.sourceNodeId}-${e.relationType}`);
  }

  const log: string[] = ["figure_id\tfigure_name\taction\tdetail"];
  let figuresUpdated = 0;
  let stripped = 0, dupRemoved = 0, edgesCreated = 0, manualKept = 0, kinKept = 0;

  for (const n of all) {
    const arr = ((n.familyRoles as string[] | null) || []).filter(Boolean);
    if (!arr.length) continue;

    const newRoles: string[] = [];
    const seen = new Set<string>();
    let changed = false;
    const figureEdges: Array<{ rel: string; targetId: number; targetName: string }> = [];

    for (const v of arr) {
      const lc = v.toLowerCase().trim();

      // Canonical 4 + extended kin → keep
      if (CANONICAL_KIN.has(lc)) {
        if (!seen.has(lc)) { newRoles.push(lc); seen.add(lc); }
        if (!["mother","father","sister","brother"].includes(lc)) kinKept++;
        continue;
      }

      // "X of Y" pattern → strip + edge
      let matched = false;
      for (const p of REL_PATTERNS) {
        const m = v.match(p.re);
        if (m) {
          matched = true;
          changed = true;
          if (!seen.has(p.bare)) { newRoles.push(p.bare); seen.add(p.bare); }
          stripped++;
          log.push(`${n.id}\t${n.name}\tSTRIP\t"${v}" → "${p.bare}"`);
          const targets = parseTargets(m[1]);
          for (const t of targets) {
            const found = byNorm.get(normName(t));
            if (found && found.id !== n.id) {
              const k = `${n.id}-${found.id}-${p.relType}`;
              if (!edgeSet.has(k)) {
                figureEdges.push({ rel: p.relType, targetId: found.id, targetName: found.name });
                edgeSet.add(k);
                edgeSet.add(`${found.id}-${n.id}-${p.relType}`);
              }
            }
          }
          break;
        }
      }
      if (matched) continue;

      // TITLE_DUP check
      const lcDom = (n.domain || "").toLowerCase();
      const lcCT = (n.characterTrait || "").toLowerCase();
      const lcSym = (n.symbolism || "").toLowerCase();
      const lcId = ((n.identification as string[] | null) || []).join(" | ").toLowerCase();
      let dupIn: string | null = null;
      if (lcDom.includes(lc)) dupIn = "domain";
      else if (lcCT.includes(lc)) dupIn = "character_trait";
      else if (lcSym.includes(lc)) dupIn = "symbolism";
      else if (lcId.includes(lc)) dupIn = "identification";
      else {
        const toks = lc.split(/[\s,;]+/).filter(t => t.length > 2);
        if (toks.length >= 2) {
          const phrase = toks.slice(-2).join(" ");
          if (lcDom.includes(phrase)) dupIn = `domain (phrase "${phrase}")`;
          else if (lcCT.includes(phrase)) dupIn = `character_trait (phrase "${phrase}")`;
          else if (lcSym.includes(phrase)) dupIn = `symbolism (phrase "${phrase}")`;
        }
      }
      if (dupIn) {
        changed = true;
        dupRemoved++;
        log.push(`${n.id}\t${n.name}\tDUP_REMOVE\t"${v}" already in ${dupIn}`);
        continue;
      }

      // Otherwise keep as-is (manual decision)
      if (!seen.has(v)) { newRoles.push(v); seen.add(v); }
      manualKept++;
    }

    if (changed || figureEdges.length) {
      figuresUpdated++;
      if (!DRY_RUN) {
        await db.update(nodes).set({ familyRoles: newRoles }).where(eq(nodes.id, n.id));
        for (const e of figureEdges) {
          await db.insert(edges).values({
            projectId: PROJECT_ID,
            sourceNodeId: n.id,
            targetNodeId: e.targetId,
            relationType: e.rel,
            weight: 1,
          });
          edgesCreated++;
          log.push(`${n.id}\t${n.name}\tNEW_EDGE\t${e.rel} → ${e.targetName} (${e.targetId})`);
        }
      } else {
        for (const e of figureEdges) {
          edgesCreated++;
          log.push(`${n.id}\t${n.name}\tNEW_EDGE\t${e.rel} → ${e.targetName} (${e.targetId})`);
        }
      }
    }
  }

  writeFileSync("scripts/reports/11d-applied.tsv", log.join("\n"));
  console.log(`\n=== 11D — applied (${DRY_RUN ? "DRY-RUN" : "LIVE"}) ===`);
  console.log(`Figures updated: ${figuresUpdated}`);
  console.log(`Strip operations: ${stripped}`);
  console.log(`Dup removed: ${dupRemoved}`);
  console.log(`New edges: ${edgesCreated}`);
  console.log(`Extended-kin kept: ${kinKept}`);
  console.log(`Manual entries left untouched: ${manualKept}`);
  console.log(`Report: scripts/reports/11d-applied.tsv`);
  process.exit(0);
})();
