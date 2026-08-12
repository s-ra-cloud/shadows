/**
 * Deterministic region inference for the Hunting World Map.
 *
 * Scores free text (cycle queries, work/edition metadata, source labels)
 * against each mythological region's discovery terms + label (plus a small
 * set of well-known aliases) and returns the single best match, or null when
 * no region stands out. Pure term matching — no AI — because the region is
 * display metadata only and must never look like a rights determination.
 */
import { HUNTER_REGIONS, type HunterRegion } from "./hunterRegions";

export interface InferredRegion {
  id: string;
  label: string;
}

/**
 * Words that appear across many regions' terms/labels and therefore carry no
 * discriminating signal (plus directions/continents from the labels).
 */
const GENERIC_WORDS = new Set([
  "mythology", "mythological", "myth", "myths", "folklore", "epic", "epics",
  "legend", "legends", "oral", "tradition", "traditions", "ancient",
  "classic", "classics", "text", "texts", "book", "dead", "the", "and", "of",
  "north", "south", "east", "west", "central", "near", "valley", "europe",
  "asia", "america", "islands",
]);

/**
 * Extra high-signal aliases per region: famous works, deities, and peoples
 * that commonly appear in queries and edition metadata but not in the short
 * seed-term strings. Purely additive — the 17-region catalogue is unchanged.
 */
const REGION_ALIASES: Record<string, string[]> = {
  mesopotamia: ["gilgamesh", "enuma", "elish", "inanna", "ishtar", "atrahasis", "sumer", "akkad", "babylon", "assyrian", "ugaritic"],
  egypt: ["osiris", "isis", "horus", "amduat", "nile", "coffin"],
  greece: ["homer", "homeric", "iliad", "odyssey", "hellenic", "orphic", "aegean", "apollodorus", "argonautica"],
  rome: ["aeneid", "virgil", "livy", "latin", "metamorphoses"],
  norse: ["odin", "thor", "voluspa", "snorri", "icelandic", "viking", "eddas", "heimskringla"],
  celtic: ["gaelic", "cuchulainn", "ulster", "arthurian", "breton"],
  slavic: ["russian", "polish", "lithuanian", "latvian", "koschei", "perun"],
  persia: ["iranian", "zend", "gathas", "ferdowsi", "bundahishn", "mithra"],
  india: ["sanskrit", "upanishads", "rigveda", "bhagavad", "gita", "krishna", "purana"],
  china: ["daoist", "confucian", "nuwa", "pangu", "shanhaijing"],
  japan: ["amaterasu", "izanagi", "susanoo", "yokai"],
  "southeast-asia": ["javanese", "thai", "khmer", "balinese", "ramakien", "vietnamese", "filipino"],
  africa: ["anansi", "dogon", "bantu", "swahili", "ifa", "orisha"],
  mesoamerica: ["quetzalcoatl", "nahuatl", "olmec", "toltec", "chilam", "mexica"],
  andes: ["quechua", "viracocha", "inti", "peruvian", "incan"],
  "north-america": ["navajo", "lakota", "hopi", "ojibwe", "cherokee", "haudenosaunee", "inuit"],
  oceania: ["samoan", "tahitian", "fijian", "aboriginal", "dreamtime", "maui", "tangaloa"],
};

function tokenize(text: string): string[] {
  return text.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
}

let keywordCache: Map<string, Set<string>> | null = null;

/** Distinctive keyword set per region, built once from terms + label + aliases. */
function regionKeywords(): Map<string, Set<string>> {
  if (keywordCache) return keywordCache;
  keywordCache = new Map();
  for (const region of HUNTER_REGIONS) {
    const words = new Set<string>();
    for (const token of tokenize(`${region.terms} ${region.label}`)) {
      if (token.length < 3 || GENERIC_WORDS.has(token)) continue;
      words.add(token);
    }
    for (const alias of REGION_ALIASES[region.id] ?? []) words.add(alias);
    keywordCache.set(region.id, words);
  }
  return keywordCache;
}

/**
 * Infer the best-matching region for the given text (or list of text
 * fragments — null/undefined entries are ignored).
 *
 * Returns null when nothing matches or when two regions tie for the top
 * score: a tie means the evidence is ambiguous and guessing wildly is worse
 * than leaving the run unassigned.
 */
export function inferRegion(
  input: string | Array<string | null | undefined>,
): InferredRegion | null {
  const text = Array.isArray(input) ? input.filter(Boolean).join(" ") : input;
  if (!text || !text.trim()) return null;
  const tokens = new Set(tokenize(text));
  let best: HunterRegion | null = null;
  let bestScore = 0;
  let tied = false;
  for (const region of HUNTER_REGIONS) {
    const keywords = regionKeywords().get(region.id)!;
    let score = 0;
    keywords.forEach((keyword) => {
      if (tokens.has(keyword)) score += 1;
    });
    if (score > bestScore) {
      best = region;
      bestScore = score;
      tied = false;
    } else if (score === bestScore && score > 0) {
      tied = true;
    }
  }
  if (!best || bestScore < 1 || tied) return null;
  return { id: best.id, label: best.label };
}
