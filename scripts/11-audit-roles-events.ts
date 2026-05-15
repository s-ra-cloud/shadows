import { db } from "../server/storage";
import { nodes } from "../shared/schema";
import { writeFileSync } from "fs";

const FAMILY_KEYWORDS = [
  "mother", "father", "sister", "brother", "son", "daughter",
  "husband", "wife", "spouse", "consort",
  "grandfather", "grandmother", "grandson", "granddaughter",
  "uncle", "aunt", "nephew", "niece", "cousin",
  "twin", "stepmother", "stepfather", "stepson", "stepdaughter",
  "stepsister", "stepbrother", "in-law", "father-in-law", "mother-in-law",
  "ancestor", "descendant", "progenitor", "offspring", "child",
  "half-sister", "half-brother", "half-sibling", "sibling",
];

const REL_KEYWORDS = [
  /^(?:the\s+)?mother\s+of\s+(.+)$/i,
  /^(?:the\s+)?father\s+of\s+(.+)$/i,
  /^(?:the\s+)?son\s+of\s+(.+)$/i,
  /^(?:the\s+)?daughter\s+of\s+(.+)$/i,
  /^(?:the\s+)?wife\s+of\s+(.+)$/i,
  /^(?:the\s+)?husband\s+of\s+(.+)$/i,
  /^(?:the\s+)?sister\s+of\s+(.+)$/i,
  /^(?:the\s+)?brother\s+of\s+(.+)$/i,
  /^(?:the\s+)?sibling\s+of\s+(.+)$/i,
  /^(?:the\s+)?consort\s+of\s+(.+)$/i,
  /^(?:the\s+)?spouse\s+of\s+(.+)$/i,
  /^(?:the\s+)?twin\s+(?:brother\s+|sister\s+)?of\s+(.+)$/i,
];

const REL_TO_BARE: Record<string, string> = {
  mother: "mother", father: "father", son: "son", daughter: "daughter",
  wife: "wife", husband: "husband", sister: "sister", brother: "brother",
  sibling: "sibling", consort: "consort", spouse: "spouse", twin: "twin",
};

function classifyFamilyRole(value: string, ctx: { domain: string; characterTrait: string; identification: string[] }): {
  action: "KEEP" | "STRIP_TO_BARE" | "TITLE_DUP" | "TITLE_MOVE" | "DELETE";
  bare?: string;             // when STRIP_TO_BARE
  ofWhom?: string;            // when STRIP_TO_BARE → who is the relation about
  duplicateIn?: string;       // when TITLE_DUP
  suggestMoveTo?: string;     // when TITLE_MOVE
  reason: string;
} {
  const v = value.trim();
  const lc = v.toLowerCase();

  // 1) Bare canonical kinship word
  if (FAMILY_KEYWORDS.includes(lc)) {
    return { action: "KEEP", reason: "bare kinship term" };
  }

  // 2) Relational pattern "X of Y" → strip to bare X
  for (const re of REL_KEYWORDS) {
    const m = v.match(re);
    if (m) {
      const word = re.source.match(/\?\:[^)]*\)\?(\w+)/)?.[1] || "?";
      // Determine the bare role from the regex itself
      let bare = "?";
      if (/mother/i.test(re.source)) bare = "mother";
      else if (/father/i.test(re.source)) bare = "father";
      else if (/son/i.test(re.source)) bare = "son";
      else if (/daughter/i.test(re.source)) bare = "daughter";
      else if (/wife/i.test(re.source)) bare = "wife";
      else if (/husband/i.test(re.source)) bare = "husband";
      else if (/sister/i.test(re.source)) bare = "sister";
      else if (/brother/i.test(re.source)) bare = "brother";
      else if (/sibling/i.test(re.source)) bare = "sibling";
      else if (/consort/i.test(re.source)) bare = "consort";
      else if (/spouse/i.test(re.source)) bare = "spouse";
      else if (/twin/i.test(re.source)) bare = "twin";
      return { action: "STRIP_TO_BARE", bare, ofWhom: m[1].trim(), reason: `"${bare} of X" pattern` };
    }
  }

  // 3) Title — check if the keyword is already in another field
  const targetFields: Array<{ name: string; text: string }> = [
    { name: "domain", text: ctx.domain || "" },
    { name: "character_trait", text: ctx.characterTrait || "" },
    { name: "identification", text: (ctx.identification || []).join(" | ") },
  ];
  // Extract dominant noun-phrase keyword (last 1-2 words)
  const tokens = lc.split(/[\s,;]+/).filter(t => t.length > 2);
  for (const tf of targetFields) {
    const tfText = tf.text.toLowerCase();
    if (!tfText) continue;
    if (tfText.includes(lc)) {
      return { action: "TITLE_DUP", duplicateIn: tf.name, reason: `full string already in ${tf.name}` };
    }
    // Try last 2-token phrase, then last 1-token
    for (let n = Math.min(2, tokens.length); n >= 1; n--) {
      const phrase = tokens.slice(-n).join(" ");
      if (phrase.length < 4) continue;
      if (tfText.includes(phrase)) {
        return { action: "TITLE_DUP", duplicateIn: tf.name, reason: `"${phrase}" already in ${tf.name}` };
      }
    }
  }
  // 4) Title not duplicated → suggest moving
  let target = "domain";
  if (/-god|-goddess|deity|lord|sovereign/i.test(lc)) target = "domain (or identification)";
  else if (/warrior|priest|king|queen|prince|princess|hero|sage|trickster/i.test(lc)) target = "character_trait";
  else if (/buddha|christ|messiah|emanation|aspect/i.test(lc)) target = "identification";
  return { action: "TITLE_MOVE", suggestMoveTo: target, reason: "title not present in any other field" };
}

function classifyEventType(value: string): {
  action: "KEEP" | "REVIEW" | "REJECT";
  bucket: "1-2 hyphens" | "3 hyphens" | "4+ hyphens" | "identity-keyword" | "the-prefix" | "no hyphen";
  reason: string;
} {
  const v = value.trim();
  const lc = v.toLowerCase();
  const hyphens = (v.match(/-/g) || []).length;
  const idKeywords = /\b(deity|sovereign|supreme|lord|identified|paralleled|state-cult|state-deity|primal-being|cosmic-primal|founder|principle)\b/i;

  // Reject: starts with "the-..."
  if (/^the-/i.test(v)) {
    return { action: "REJECT", bucket: "the-prefix", reason: "identity-statement disguised as event" };
  }
  // Reject: identity-keyword
  if (idKeywords.test(lc)) {
    return { action: "REJECT", bucket: "identity-keyword", reason: "contains identity keyword" };
  }
  // Reject: 4+ hyphens
  if (hyphens >= 4) {
    return { action: "REJECT", bucket: "4+ hyphens", reason: "too many hyphenated tokens (likely overspecific)" };
  }
  // Review: exactly 3 hyphens
  if (hyphens === 3) {
    return { action: "REVIEW", bucket: "3 hyphens", reason: "borderline — manual check" };
  }
  // Keep: 1-2 hyphens or no hyphen
  return { action: "KEEP", bucket: hyphens <= 1 ? "1-2 hyphens" : "1-2 hyphens", reason: "narrow event-type" };
}

(async () => {
  const all = await db.select().from(nodes);

  // ============ Family roles audit ============
  const fr: string[] = [
    "id\tname\ttradition\tvalue\taction\tbare\tof_whom\tduplicated_in\tsuggested_move_to\treason",
  ];
  const frStats = { KEEP: 0, STRIP_TO_BARE: 0, TITLE_DUP: 0, TITLE_MOVE: 0, DELETE: 0 };
  let frFigures = 0;

  for (const n of all) {
    const arr = (n.familyRoles as string[] | null) || [];
    if (!arr.length) continue;
    const nonCanonical = arr.filter(v => !["mother", "father", "sister", "brother"].includes(v.toLowerCase()));
    if (!nonCanonical.length) continue;
    frFigures++;
    for (const v of nonCanonical) {
      const c = classifyFamilyRole(v, {
        domain: n.domain || "",
        characterTrait: n.characterTrait || "",
        identification: (n.identification as string[] | null) || [],
      });
      frStats[c.action]++;
      fr.push([
        n.id, n.name, n.tradition || "",
        v.replace(/\t/g, " "),
        c.action, c.bare || "", c.ofWhom || "",
        c.duplicateIn || "", c.suggestMoveTo || "",
        c.reason,
      ].join("\t"));
    }
  }

  writeFileSync("scripts/reports/11a-family-roles.tsv", fr.join("\n"));
  console.log(`\n=== 11A — family_roles report ===`);
  console.log(`scripts/reports/11a-family-roles.tsv`);
  console.log(`Figures with non-canonical entries: ${frFigures}`);
  console.log(`Total non-canonical entries: ${frStats.KEEP + frStats.STRIP_TO_BARE + frStats.TITLE_DUP + frStats.TITLE_MOVE + frStats.DELETE}`);
  console.log(`  KEEP (bare kinship term beyond mother/father/sister/brother): ${frStats.KEEP}`);
  console.log(`  STRIP_TO_BARE ("X of Y" → "X" + create relationship edge): ${frStats.STRIP_TO_BARE}`);
  console.log(`  TITLE_DUP (already present in another field, safe to delete): ${frStats.TITLE_DUP}`);
  console.log(`  TITLE_MOVE (not present elsewhere, must be relocated first): ${frStats.TITLE_MOVE}`);

  // ============ Event types audit ============
  const et: string[] = [
    "id\tname\ttradition\tvalue\taction\tbucket\treason",
  ];
  const etStats = {
    KEEP: 0, REVIEW: 0, REJECT: 0,
    buckets: { "1-2 hyphens": 0, "3 hyphens": 0, "4+ hyphens": 0, "identity-keyword": 0, "the-prefix": 0, "no hyphen": 0 },
  };
  let etFigures = 0;

  for (const n of all) {
    const arr = (n.eventTypes as string[] | null) || [];
    if (!arr.length) continue;
    let figureCounted = false;
    for (const v of arr) {
      const c = classifyEventType(v);
      etStats[c.action]++;
      etStats.buckets[c.bucket]++;
      if (c.action !== "KEEP" && !figureCounted) { etFigures++; figureCounted = true; }
      et.push([n.id, n.name, n.tradition || "", v.replace(/\t/g, " "), c.action, c.bucket, c.reason].join("\t"));
    }
  }

  writeFileSync("scripts/reports/11b-event-types.tsv", et.join("\n"));
  console.log(`\n=== 11B — event_types report ===`);
  console.log(`scripts/reports/11b-event-types.tsv`);
  console.log(`Figures with at least one non-KEEP event_type: ${etFigures}`);
  console.log(`  KEEP: ${etStats.KEEP}`);
  console.log(`  REVIEW (3 hyphens — borderline): ${etStats.REVIEW}`);
  console.log(`  REJECT: ${etStats.REJECT}`);
  console.log(`  By bucket:`);
  for (const [k, v] of Object.entries(etStats.buckets)) console.log(`    ${k}: ${v}`);

  process.exit(0);
})();
