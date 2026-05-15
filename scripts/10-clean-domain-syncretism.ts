import { db } from "../server/storage";
import { nodes, edges } from "../shared/schema";
import { eq, sql } from "drizzle-orm";
import OpenAI from "openai";
import { writeFileSync, existsSync, readFileSync, appendFileSync } from "fs";

const PROJECT_ID = 6;
const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

function normName(s: string): string {
  return s
    .replace(/^(greek|roman|egyptian|hindu|chinese|japanese|norse|germanic|aztec|maya|mayan|celtic|sumerian|akkadian|babylonian|canaanite|hittite|hellenized|latin|sumero-akkadian|deified|the|olympian|chthonic|vedic|hindu-buddhist|sumero|ugaritic|mahayana|vajrayana|theravada|buddhist|christian|islamic|jewish|kabbalistic|gnostic|phrygian|patrician|plebeian|primordial)\s+/i, "")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9 ]/g, "").toLowerCase().trim();
}

const TRADITION_HINT: Record<string, string> = {
  Roman: "Greek", Greek: "Roman",
  Buddhist: "Hindu", Chinese: "Hindu", Shinto: "Hindu/Buddhist/Chinese",
  Canaanite: "Mesopotamian", Mesopotamian: "Canaanite",
  Phrygian: "Roman/Greek", Aztec: "Maya",
  Abrahamic: "various", Gnostic: "Abrahamic",
};

type Result = {
  new_domain: string[];
  identifications: string[];
  notes?: string;
};

async function gptClean(name: string, tradition: string, domain: string): Promise<Result> {
  const prompt = `You are cleaning the "domain" field of mythological figure "${name}" (tradition: ${tradition}).
Current domain text: """${domain}"""

The "domain" field should contain ONLY a SHORT list (≤6) of bare keyword domains/spheres-of-influence. Examples of valid domains: war, love, wisdom, fertility, sea, underworld, kingship, fire, healing, justice, prophecy, marriage, harvest, weaving, smithing, magic, hunting, motherhood.

Return STRICT JSON with two fields:
1. "new_domain": array of ≤6 SHORT keyword domains (lowercase preferred, multi-word OK if it's a real sphere like "death-and-rebirth" or "sea-trade"). Strip ALL syncretism claims, narrative descriptions, epithets, historical context, etymology. Keep only true spheres of influence.
2. "identifications": array of OTHER deity NAMES that this figure is syncretically identified/equated with (interpretatio, "identified with X", "counterpart of X", "the Y form of X", "cognate of X", "the [tradition] X"). Use bare proper names ONLY (e.g. "Asclepius", "Heracles"), not phrases. EXCLUDE: family members, foils, opponents, cultural-context names that are not identifications. EXCLUDE epithets of the same figure (e.g. "Iuppiter Optimus Maximus" for Jupiter). EXCLUDE generic phrases like "Maya Maize God" UNLESS it is the standard scholarly identification.

Return ONLY the JSON object. No prose.`;

  const resp = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
    temperature: 0,
    response_format: { type: "json_object" },
  });
  const txt = resp.choices[0].message.content || "{}";
  const parsed = JSON.parse(txt);
  return {
    new_domain: Array.isArray(parsed.new_domain) ? parsed.new_domain.filter((x: any) => typeof x === "string" && x.trim()) : [],
    identifications: Array.isArray(parsed.identifications) ? parsed.identifications.filter((x: any) => typeof x === "string" && x.trim()) : [],
  };
}

async function run() {
  const dryRun = !process.argv.includes("--apply");
  const targets = await db.execute(sql`
    SELECT id, name, tradition, domain, identification FROM nodes
    WHERE domain ~* '(identified with|equivalent of|counterpart of|same as|cognate of|the (greek|roman|egyptian|hindu|chinese|japanese|sumerian|akkadian|babylonian|hellenized|latin|norse|germanic|aztec|mayan|buddhist|canaanite|phrygian|gnostic) [A-Z])'
       OR length(domain) > 100
    ORDER BY name
  `);
  const rows = (targets as any).rows as Array<{ id: number; name: string; tradition: string; domain: string; identification: string[] | null }>;

  // Index existing nodes by normalized name
  const allNodes = await db.select().from(nodes);
  const byNorm = new Map<string, { id: number; name: string }>();
  for (const n of allNodes) byNorm.set(normName(n.name), { id: n.id, name: n.name });

  const existingEdges = await db.select().from(edges).where(eq(edges.relationType, "identified with"));
  const edgeSet = new Set(existingEdges.map(e => `${e.sourceNodeId}->${e.targetNodeId}`));

  type Plan = {
    id: number; name: string; tradition: string;
    old_domain: string;
    new_domain: string;
    new_edges: Array<{ targetId: number; targetName: string }>;
    new_identifications: string[];
    skipped_self: string[];
  };

  const REPORT = "scripts/reports/10-domain-syncretism.tsv";
  const HEADER = "id\tname\ttradition\told_domain\tnew_domain\tnew_edges_ids\tnew_edges_names\tnew_identifications\tskipped";
  const done = new Set<number>();
  if (existsSync(REPORT)) {
    const lines = readFileSync(REPORT, "utf-8").split("\n").slice(1);
    for (const ln of lines) {
      const id = parseInt(ln.split("\t")[0]);
      if (!isNaN(id)) done.add(id);
    }
    console.log(`Resuming: ${done.size} already done`);
  } else {
    writeFileSync(REPORT, HEADER + "\n");
  }

  console.log(`Processing ${rows.length} figures via GPT...`);
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    if (done.has(r.id)) continue;
    process.stdout.write(`[${i + 1}/${rows.length}] ${r.name}... `);
    let res: Result;
    try {
      res = await gptClean(r.name, r.tradition, r.domain);
    } catch (e: any) {
      console.log(`ERROR: ${e.message}`);
      continue;
    }
    const newDomain = Array.from(new Set(res.new_domain.map(s => s.trim()).filter(Boolean))).slice(0, 6).join(", ");
    const newEdges: Array<{ targetId: number; targetName: string }> = [];
    const newIds: string[] = [];
    const skipped: string[] = [];
    const selfNorm = normName(r.name);
    for (const idName of res.identifications) {
      const norm = normName(idName);
      if (!norm || norm === selfNorm) { skipped.push(idName); continue; }
      const found = byNorm.get(norm);
      if (found && found.id !== r.id) {
        if (!edgeSet.has(`${r.id}->${found.id}`) && !edgeSet.has(`${found.id}->${r.id}`)) {
          newEdges.push({ targetId: found.id, targetName: found.name });
          edgeSet.add(`${r.id}->${found.id}`);
        }
      } else {
        const existingIds = r.identification || [];
        if (!existingIds.some(x => normName(x) === norm)) newIds.push(idName);
      }
    }
    const row = [
      r.id, r.name, r.tradition,
      r.domain.replace(/\t/g, " "),
      newDomain,
      newEdges.map(e => e.targetId).join("|"),
      newEdges.map(e => e.targetName).join("|"),
      newIds.join("|"),
      skipped.join("|"),
    ].join("\t");
    appendFileSync(REPORT, row + "\n");
    console.log(`domain→${newDomain.length}c | edges:${newEdges.length} | ids:${newIds.length}`);
  }
  console.log(`\nReport: ${REPORT}`);

  if (!process.argv.includes("--apply")) {
    console.log("(dry-run — pass --apply to write)");
    process.exit(0);
  }

  // APPLY from full report (not just this run)
  const lines = readFileSync(REPORT, "utf-8").split("\n").slice(1).filter(l => l.trim());
  const plans: Plan[] = lines.map(ln => {
    const c = ln.split("\t");
    return {
      id: parseInt(c[0]), name: c[1], tradition: c[2],
      old_domain: c[3], new_domain: c[4],
      new_edges: c[5] && c[6] ? c[5].split("|").map((id, idx) => ({ targetId: parseInt(id), targetName: c[6].split("|")[idx] })) : [],
      new_identifications: c[7] ? c[7].split("|").filter(Boolean) : [],
      skipped_self: c[8] ? c[8].split("|").filter(Boolean) : [],
    };
  });
  console.log(`Applying ${plans.length} plans from report...`);

  if (!dryRun) {
    for (const p of plans) {
      await db.update(nodes).set({ domain: p.new_domain }).where(eq(nodes.id, p.id));
      if (p.new_identifications.length) {
        await db.execute(sql`
          UPDATE nodes SET identification = COALESCE(identification, ARRAY[]::text[]) || ${p.new_identifications}::text[]
          WHERE id = ${p.id}
        `);
      }
      for (const e of p.new_edges) {
        await db.insert(edges).values({
          projectId: PROJECT_ID, sourceNodeId: p.id, targetNodeId: e.targetId,
          relationType: "identified with", weight: 1,
        });
      }
    }
    console.log("DB updated.");
  } else {
    console.log("(dry-run — pass --apply to write)");
  }
  process.exit(0);
}
run().catch(e => { console.error(e); process.exit(1); });
