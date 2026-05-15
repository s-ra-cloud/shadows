import { db } from "../server/storage";
import { nodes, edges } from "../shared/schema";
import { writeFileSync } from "fs";
import { eq } from "drizzle-orm";

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

function parseTargets(rest: string): string[] {
  // strip parenthetical, split on " and " / "," / ";"
  const cleaned = rest.replace(/\([^)]*\)/g, "").trim();
  return cleaned.split(/\s+and\s+|,|;/).map(s => s.trim()).filter(s => s.length >= 2 && s.length <= 60);
}

(async () => {
  const all = await db.select().from(nodes);
  const byNorm = new Map<string, { id: number; name: string }>();
  for (const n of all) byNorm.set(normName(n.name), { id: n.id, name: n.name });

  const allEdges = await db.select().from(edges);
  const edgeKey = (a: number, b: number, rt: string) => `${a}-${b}-${rt}`;
  const edgeSet = new Set<string>();
  for (const e of allEdges) {
    edgeSet.add(edgeKey(e.sourceNodeId, e.targetNodeId, e.relationType));
    edgeSet.add(edgeKey(e.targetNodeId, e.sourceNodeId, e.relationType));
  }

  // ============== 11A — family_roles ==============
  const md11a: string[] = ["# 11A — family_roles cleanup proposal\n"];
  let figures11a = 0;
  let stats = { kept: 0, stripped: 0, dup_deleted: 0, manual_move: 0, edges_to_create: 0, edges_skipped_no_node: 0 };

  for (const n of all) {
    const arr = ((n.familyRoles as string[] | null) || []).filter(Boolean);
    const nonCanonical = arr.filter(v => !["mother", "father", "sister", "brother"].includes(v.toLowerCase()));
    if (!nonCanonical.length) continue;
    figures11a++;

    const kept: string[] = [];
    const removed: Array<{ value: string; reason: string }> = [];
    const newEdges: Array<{ rel: string; targetName: string; targetId: number | null }> = [];
    const manual: Array<{ value: string; suggestion: string }> = [];

    for (const v of arr) {
      const lc = v.toLowerCase().trim();
      // Canonical 4 → keep silently
      if (["mother", "father", "sister", "brother"].includes(lc)) {
        kept.push(lc);
        continue;
      }
      // Bare extended kin
      if (CANONICAL_KIN.has(lc)) {
        kept.push(lc);
        stats.kept++;
        continue;
      }
      // "X of Y" pattern
      let matched = false;
      for (const p of REL_PATTERNS) {
        const m = v.match(p.re);
        if (m) {
          matched = true;
          if (!kept.includes(p.bare)) kept.push(p.bare);
          stats.stripped++;
          const targets = parseTargets(m[1]);
          for (const t of targets) {
            const found = byNorm.get(normName(t));
            if (found && found.id !== n.id) {
              const k = edgeKey(n.id, found.id, p.relType);
              if (!edgeSet.has(k)) {
                newEdges.push({ rel: p.relType, targetName: found.name, targetId: found.id });
                edgeSet.add(k);
                edgeSet.add(edgeKey(found.id, n.id, p.relType));
                stats.edges_to_create++;
              }
            } else {
              newEdges.push({ rel: p.relType, targetName: t, targetId: null });
              stats.edges_skipped_no_node++;
            }
          }
          removed.push({ value: v, reason: `→ "${p.bare}"` + (targets.length > 0 ? ` + edge candidates [${targets.join(", ")}]` : "") });
          break;
        }
      }
      if (matched) continue;

      // Title check: present elsewhere?
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
        // try last 2 tokens
        const toks = lc.split(/[\s,;]+/).filter(t => t.length > 2);
        if (toks.length >= 2) {
          const phrase = toks.slice(-2).join(" ");
          if (lcDom.includes(phrase)) dupIn = `domain (phrase "${phrase}")`;
          else if (lcCT.includes(phrase)) dupIn = `character_trait (phrase "${phrase}")`;
          else if (lcSym.includes(phrase)) dupIn = `symbolism (phrase "${phrase}")`;
        }
      }
      if (dupIn) {
        removed.push({ value: v, reason: `already in ${dupIn}` });
        continue;
      }
      // Suggest target
      let target = "domain or identification";
      if (/-god$|-goddess$|deity|sovereign|lord|king|queen|emperor|prince|princess/i.test(v)) target = "domain";
      else if (/warrior|priest|hero|sage|trickster|consort|husband|wife|spouse/i.test(v)) target = "character_trait";
      else if (/buddha|christ|messiah|emanation|aspect|incarnation|avatar/i.test(v)) target = "identification";
      else if (/from|of|by|with|in/i.test(v)) target = "domain (narrative — likely DELETE if covered)";
      manual.push({ value: v, suggestion: target });
      stats.manual_move++;
    }

    // Render block
    md11a.push(`## ${n.name} [${n.tradition}]`);
    md11a.push(`- **BEFORE**: \`[${arr.join(", ")}]\``);
    md11a.push(`- **AFTER**: \`[${kept.join(", ") || "(empty)"}]\``);
    if (removed.length) {
      md11a.push(`- **REMOVED**:`);
      for (const r of removed) md11a.push(`    - \`${r.value}\` — ${r.reason}`);
    }
    if (newEdges.length) {
      md11a.push(`- **NEW EDGES proposed**:`);
      for (const e of newEdges) {
        const tag = e.targetId ? `→ **${e.targetName}** (id ${e.targetId}) ✅` : `→ ${e.targetName} ❌ no DB node`;
        md11a.push(`    - \`${e.rel}\` ${tag}`);
      }
    }
    if (manual.length) {
      md11a.push(`- **NEEDS MANUAL DECISION**:`);
      for (const m of manual) md11a.push(`    - \`${m.value}\` — suggested target: ${m.suggestion}`);
    }
    md11a.push("");
  }

  md11a.unshift("");
  md11a.unshift(`Stats: ${figures11a} figures, ${stats.kept} extended-kin kept, ${stats.stripped} "X of Y" stripped, ${stats.edges_to_create} edges to create (target IS a DB node), ${stats.edges_skipped_no_node} edge candidates with no DB node target, ${stats.manual_move} manual decisions needed`);
  md11a.unshift("");
  md11a.unshift("# 11A — family_roles cleanup proposal");
  writeFileSync("scripts/reports/11a-detailed.md", md11a.join("\n"));
  console.log(`11A: scripts/reports/11a-detailed.md (${figures11a} figures)`);

  // ============== 11B — event_types ==============
  const md11b: string[] = ["# 11B — event_types cleanup proposal\n"];
  let figures11b = 0;
  const stats11b = { kept: 0, review_3hyph: 0, rejected: 0 };

  for (const n of all) {
    const arr = ((n.eventTypes as string[] | null) || []).filter(Boolean);
    if (!arr.length) continue;

    const kept: string[] = [];
    const review: string[] = [];
    const rejected: Array<{ value: string; reason: string; suggestion: string }> = [];

    for (const v of arr) {
      const hyphens = (v.match(/-/g) || []).length;
      const idKw = /\b(deity|sovereign|supreme|lord|identified|paralleled|state-cult|state-deity|primal-being|cosmic-primal|principle)\b/i;
      if (/^the-/i.test(v)) {
        rejected.push({ value: v, reason: "the-prefix (identity statement)", suggestion: "→ identification or DELETE" });
        stats11b.rejected++;
      } else if (idKw.test(v)) {
        rejected.push({ value: v, reason: "identity keyword", suggestion: "→ domain or DELETE" });
        stats11b.rejected++;
      } else if (hyphens >= 4) {
        rejected.push({ value: v, reason: `${hyphens} hyphens (overspecific)`, suggestion: "DELETE (likely covered elsewhere)" });
        stats11b.rejected++;
      } else if (hyphens === 3) {
        review.push(v);
        stats11b.review_3hyph++;
      } else {
        kept.push(v);
        stats11b.kept++;
      }
    }

    if (review.length === 0 && rejected.length === 0) continue;
    figures11b++;

    md11b.push(`## ${n.name} [${n.tradition}]`);
    md11b.push(`- **BEFORE** (${arr.length}): \`[${arr.join(", ")}]\``);
    const after = [...kept, ...review];
    md11b.push(`- **AFTER auto-apply** (${after.length}): \`[${after.join(", ") || "(empty)"}]\``);
    if (rejected.length) {
      md11b.push(`- **REJECTED** (${rejected.length}):`);
      for (const r of rejected) md11b.push(`    - \`${r.value}\` — ${r.reason} — ${r.suggestion}`);
    }
    if (review.length) {
      md11b.push(`- **3-hyphens REVIEW** (kept by default; flag any to remove):`);
      for (const v of review) md11b.push(`    - \`${v}\``);
    }
    md11b.push("");
  }

  md11b.unshift("");
  md11b.unshift(`Stats: ${figures11b} figures with at least one non-KEEP entry. Globally: ${stats11b.kept} KEEP, ${stats11b.review_3hyph} 3-hyph REVIEW, ${stats11b.rejected} REJECT.`);
  md11b.unshift("");
  md11b.unshift("# 11B — event_types cleanup proposal");
  writeFileSync("scripts/reports/11b-detailed.md", md11b.join("\n"));
  console.log(`11B: scripts/reports/11b-detailed.md (${figures11b} figures)`);
  console.log(`\n11A stats: ${JSON.stringify(stats)}`);
  console.log(`11B stats: ${JSON.stringify(stats11b)}`);
  process.exit(0);
})();
