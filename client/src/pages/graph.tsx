import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import * as d3 from "d3";
import { X, Search, Filter, ArrowLeft, Network, Users, SlidersHorizontal, ChevronRight, ChevronDown, TreePine, Link2, Globe, Sparkles, Compass, Layers } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Slider } from "@/components/ui/slider";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Link } from "wouter";
import type { Node, Edge } from "@shared/schema";

const TRADITION_COLORS: Record<string, string> = {
  "Greek": "#8F00FF",
  "Chinese": "#E53935",
  "Egyptian": "#FFB800",
  "Roman": "#FF8A65",
  "Shinto": "#FF4081",
  "Norse": "#4A7BFF",
  "Aztec": "#00BCD4",
  "Hindu": "#FF6B35",
  "Mesopotamian": "#03FF9B",
  "Celtic": "#7FFF00",
  "Cross-cultural": "#C0C0C0",
  "Christian": "#FFD700",
  "Buddhist": "#9C27B0",
  "Phrygian": "#AB47BC",
  "Canaanite": "#F06292",
  "Gnostic": "#D4A574",
  "Abrahamic": "#FFCC80",
  "Balinese": "#26A69A",
  "Germanic": "#78909C",
  "Sumerian": "#00E676",
  "Mythological": "#B388FF",
  "Fairy Tale": "#F8BBD0",
  "Slavic": "#5C6BC0",
  "Finnish": "#80DEEA",
  "Arthurian": "#8D6E63",
  "Polynesian": "#FF7043",
  "African": "#FDD835",
  "Inuit": "#B0BEC5",
  "Persian": "#CE93D8",
  "Korean": "#EF5350",
  "Vietnamese": "#66BB6A",
};

const CATEGORY_COLORS: Record<string, string> = {
  gender: "#E0DCE6",
  domain: "#03FF9B",
  object: "#FFB800",
  animals: "#FF6B35",
  characterTrait: "#FF4081",
  physicalCharacteristics: "#4A7BFF",
  animalType: "#FF8A65",
  objectType: "#FFD700",
  significantEvent: "#8F00FF",
  eventTypes: "#E53935",
  birthTypes: "#00BCD4",
  deathTypes: "#B71C1C",
  familyRoles: "#F48FB1",
};

const CATEGORY_LABELS: Record<string, string> = {
  gender: "Gender",
  domain: "Domain",
  object: "Objects",
  animals: "Animals",
  characterTrait: "Character Traits",
  physicalCharacteristics: "Physical Characteristics",
  animalType: "Animal Type",
  objectType: "Object Type",
  eventTypes: "Event Type",
  birthTypes: "Birth Type",
  deathTypes: "Death Type",
  familyRoles: "Family Role",
};

const RELATION_TYPES = ["parent of", "child of", "sibling of", "married to", "trinity", "group", "identified with", "adversary of"] as const;
type RelationType = typeof RELATION_TYPES[number];

const RELATION_COLORS: Record<RelationType, string> = {
  "parent of": "#1565C0",
  "child of": "#42A5F5",
  "sibling of": "#B3E5FC",
  "married to": "#FF80AB",
  "trinity": "#FFD600",
  "group": "#FFB300",
  "identified with": "#26C6DA",
  "adversary of": "#EF5350",
};

const RELATION_LABELS: Record<RelationType, string> = {
  "parent of": "Parent Of",
  "child of": "Child Of",
  "sibling of": "Sibling Of",
  "married to": "Married To",
  "trinity": "Trinity",
  "group": "Group",
  "identified with": "Identified With",
  "adversary of": "Adversary Of",
};

const RELATION_GROUP_LABELS: Record<string, string> = {
  kinship: "Kinship",
  bond: "Bond",
  spiritual: "Spiritual",
  collective: "Collective",
  syncretism: "Syncretism",
  conflict: "Conflict",
};

const RELATION_GROUPS: Record<string, RelationType[]> = {
  kinship: ["parent of", "child of", "sibling of"],
  bond: ["married to"],
  spiritual: ["trinity"],
  collective: ["group"],
  syncretism: ["identified with"],
  conflict: ["adversary of"],
};

export interface RelationEdge {
  sourceId: string;
  targetId: string;
  relationType: RelationType;
}

function getTraditionColor(tradition: string | null) {
  if (!tradition) return "#8F00FF";
  return TRADITION_COLORS[tradition] || "#8F00FF";
}

const STOP_TOKENS = new Set([
  "in greek mythology", "in roman mythology", "in norse mythology",
  "in egyptian mythology", "in hindu mythology", "in celtic mythology",
  "in japanese mythology", "in aztec mythology", "in sumerian mythology",
  "in mesopotamian mythology", "in chinese mythology", "in slavic mythology",
  "in finnish mythology", "greek mythology", "roman mythology",
  "norse mythology", "egyptian mythology", "hindu mythology",
  "ancient greek", "ancient rome", "ancient egypt",
  "mythology", "according to", "also known as",
  "thebes", "athens", "sparta", "corinth", "argos", "mycenae", "troy",
  "thessaly", "thrace", "phthia", "iolcus", "iolcos", "megara", "seriphos",
  "crete", "delos", "delphi", "olympus", "olympia", "arcadia", "attica",
  "boeotia", "epirus", "dodona", "eleusis", "phocis", "locris", "achaea",
  "rhodes", "cyprus", "lemnos", "lesbos", "naxos", "ithaca", "mykonos",
  "plataea", "tiryns", "pylos", "calydon", "colchis", "lycia", "lydia",
  "phrygia", "troy", "ilium", "pergamon", "phoenicia", "assyria", "babylon",
  "persia", "india", "libya", "ethiopia", "sicily", "italy", "rome",
  "carthage", "gaul", "britannia", "germania", "scandinavia",
  "asgard", "midgard", "jotunheim", "niflheim", "muspelheim", "valhalla",
  "helheim", "svartalfheim", "alfheim", "mount olympus",
  "egypt", "nubia", "mesopotamia", "sumer", "akkad", "ur", "uruk",
  "nippur", "eridu", "lagash", "kish",
  "same name", "the same name", "long", "supported by two human-like feet",
]);

const STOP_PATTERNS = [
  /\bmytholog/i, /\bancient\b/i, /\breligion\b/i, /\bworship/i,
  /\bpantheon\b/i, /\btradition\b/i, /\bgreek\b/i, /\broman\b/i,
  /\bnorse\b/i, /\begypt\b/i, /\bhindu\b/i, /\bshinto\b/i,
  /\baztec\b/i, /\bceltic\b/i, /\bsumerian\b/i, /\bmesopotam/i,
  /\bvedic\b/i, /\bsanskrit\b/i, /\bjapanese\b/i, /\bchinese\b/i,
  /\bslavic\b/i, /\bfinnish\b/i, /\barthurian\b/i,
  /\baccording to\b/i, /\balso known\b/i, /\breferred to\b/i,
  /\bsee also\b/i, /\bvariant\b/i, /\bwas a\b/i, /\bwere\b/i,
  /\bmay refer\b/i, /\bcan refer\b/i, /\bthe name\b/i,
  /\blatin/i, /\betruscan/i, /\bphrygian/i, /\bthracian/i,
  /\bking of\b/i, /\bqueen of\b/i, /\bprince of\b/i, /\bprincess of\b/i,
  /\bkingdom\b/i, /\bcity\b/i, /\bisland\b/i, /\bregion\b/i,
  /\bpeninsula\b/i, /\bprovince\b/i, /\bmountain\b/i, /\briver\b/i,
  /\bvalley\b/i, /\bcoast\b/i, /\bplain\b/i,
  /\bsquare\b/i, /\bmeters?\b/i, /\bcovering\b/i, /\btotal area\b/i,
  /\bcentimeters?\b/i, /\bkilometers?\b/i, /\bfeet\b/i, /\binches\b/i,
  /\bstatue\b/i, /\bsculpture\b/i, /\btemple\b/i, /\bmuseum\b/i,
  /\bcentury\b/i, /\bbce?\b/i, /\bce\b/i, /\bad\b/i,
  /\bdoor god\b/i, /\btaoist\b/i, /\bbuddhist\b/i,
];

const SYNONYMS: Record<string, string> = {
  "serpent": "snake",
  "serpents": "snake",
  "snakes": "snake",
  "serpent/snake": "snake",
  "serpent/dragon": "dragon",
  "feathered serpent": "snake",
  "cobra": "snake",
  "serpentine": "snake",
  "tortoise": "turtle",
  "cock": "rooster",
  "hen": "rooster",
  "stag": "deer",
  "hare": "rabbit",
  "ox": "bull",
  "cow": "bull",
  "pig": "boar",
  "pig/sow": "boar",
  "sow": "boar",
  "panther": "jaguar",
  "raven": "crow",
  "hawk": "falcon",
  "arrows": "bow",
  "arrow": "bow",
  "a bow and arrows": "bow",
  "bow and arrows": "bow",
  "god of war": "war",
  "goddess of war": "war",
  "god of the sea": "sea",
  "goddess of the sea": "sea",
  "the sea": "sea",
  "god of death": "death",
  "goddess of death": "death",
  "god of the underworld": "underworld",
  "the underworld": "underworld",
  "god of fire": "fire",
  "goddess of fire": "fire",
  "god of love": "love",
  "goddess of love": "love",
  "god of wisdom": "wisdom",
  "goddess of wisdom": "wisdom",
  "god of the sun": "sun",
  "the sun": "sun",
  "sun disk": "sun",
  "god of the moon": "moon",
  "the moon": "moon",
  "crescent moon": "moon",
  "god of the sky": "sky",
  "the sky": "sky",
  "god of thunder": "thunder",
  "god of wine": "wine",
  "goddess of beauty": "beauty",
  "goddess of fertility": "fertility",
  "goddess of love and beauty": "love",
  "goddess of the hunt": "hunt",
  "the hunt": "hunt",
  "god of healing": "healing",
  "goddess of healing": "healing",
  "god of medicine": "medicine",
  "goddess of childbirth": "childbirth",
  "goddess of marriage": "marriage",
  "goddess of nature": "nature",
  "goddess of earth": "earth",
  "mother goddess": "motherhood",
  "earth mother": "earth",
  "great goddess": "motherhood",
  "good mother archetype": "motherhood",
  "god of nation-building": "kingship",
  "god of strength and heroesdivine protector of mankind and the patron of the gymnasium": "strength",
  "death-rebirth": "death",
  "death-dealing": "death",
  "dying-and-rising": "death",
  "terrible mother": "death",
  "lion-headed": "lion",
  "lion's head": "lion",
  "lion body": "lion",
  "lion (rides on lion)": "lion",
  "lion (throne)": "lion",
  "lions (throne)": "lion",
  "beasts of the zodiac on robe and crown": "zodiac",
  "bull (zeus in bull form)": "bull",
  "bull (cause of death)": "bull",
  "boar (cause of death)": "boar",
  "ravens": "crow",
  "wolves": "wolf",
  "eight-legged horse": "horse",
  "all wild animals": "wild animals",
  "wild animals": "wild animals",
  "dogs": "dog",
  "cats": "cat",
  "lions": "lion",
  "torches": "torch",
  "weapons": "weapon",
  "lioness": "lion",
  "grain": "agriculture",
  "great mother": "motherhood",
  "ostrich feather": "feather",
};

const ANIMAL_SUPERSETS: Record<string, string> = {
  snake: "Reptiles",
  serpent: "Reptiles",
  dragon: "Mythical Creatures",
  crocodile: "Reptiles",
  turtle: "Reptiles",
  tortoise: "Reptiles",
  lizard: "Reptiles",
  frog: "Amphibians",

  eagle: "Birds",
  falcon: "Birds",
  hawk: "Birds",
  vulture: "Birds",
  crane: "Birds",
  swan: "Birds",
  dove: "Birds",
  peacock: "Birds",
  raven: "Birds",
  crow: "Birds",
  heron: "Birds",
  owl: "Birds",
  sparrow: "Birds",
  rooster: "Birds",
  cock: "Birds",
  hen: "Birds",
  ibis: "Birds",
  quetzal: "Birds",
  hummingbird: "Birds",
  bird: "Birds",
  cuckoo: "Birds",
  kite: "Birds",

  horse: "Mammals",
  lion: "Mammals",
  bear: "Mammals",
  bull: "Mammals",
  cow: "Mammals",
  ox: "Mammals",
  dog: "Mammals",
  tiger: "Mammals",
  goat: "Mammals",
  ram: "Mammals",
  wolf: "Mammals",
  boar: "Mammals",
  monkey: "Mammals",
  cat: "Mammals",
  deer: "Mammals",
  stag: "Mammals",
  donkey: "Mammals",
  pig: "Mammals",
  elephant: "Mammals",
  rabbit: "Mammals",
  hare: "Mammals",
  jaguar: "Mammals",
  panther: "Mammals",
  whale: "Mammals",
  dolphin: "Mammals",
  jackal: "Mammals",
  hippopotamus: "Mammals",
  fox: "Mammals",
  leopard: "Mammals",
  gazelle: "Mammals",
  cattle: "Mammals",

  fish: "Fish",

  scorpion: "Insects & Arachnids",
  scarab: "Insects & Arachnids",
  bee: "Insects & Arachnids",
  ant: "Insects & Arachnids",
  butterfly: "Insects & Arachnids",
  spider: "Insects & Arachnids",
  cicada: "Insects & Arachnids",

  phoenix: "Mythical Creatures",
  centaur: "Mythical Creatures",
  cerberus: "Mythical Creatures",
  sphinx: "Mythical Creatures",
  minotaur: "Mythical Creatures",
  pegasus: "Mythical Creatures",
  griffin: "Mythical Creatures",
  chimera: "Mythical Creatures",
  hydra: "Mythical Creatures",
};

const OBJECT_SUPERSETS: Record<string, string> = {
  sword: "Weapons",
  spear: "Weapons",
  bow: "Weapons",
  arrow: "Weapons",
  trident: "Weapons",
  thunderbolt: "Weapons",
  mace: "Weapons",
  axe: "Weapons",
  dagger: "Weapons",
  knife: "Weapons",
  lance: "Weapons",
  flail: "Weapons",
  discus: "Weapons",
  hammer: "Weapons",
  javelin: "Weapons",
  club: "Weapons",
  whip: "Weapons",

  shield: "Armor & Protection",
  helmet: "Armor & Protection",
  aegis: "Armor & Protection",
  armor: "Armor & Protection",
  net: "Armor & Protection",
  breastplate: "Armor & Protection",

  crown: "Regalia & Authority",
  scepter: "Regalia & Authority",
  throne: "Regalia & Authority",
  chariot: "Regalia & Authority",
  cornucopia: "Regalia & Authority",
  caduceus: "Regalia & Authority",

  lyre: "Musical Instruments",
  flute: "Musical Instruments",
  drum: "Musical Instruments",
  lute: "Musical Instruments",
  conch: "Musical Instruments",
  sistrum: "Musical Instruments",

  staff: "Sacred & Ritual",
  ankh: "Sacred & Ritual",
  torch: "Sacred & Ritual",
  mirror: "Sacred & Ritual",
  chalice: "Sacred & Ritual",

  flower: "Nature & Fertility",
  fruit: "Nature & Fertility",
  grain: "Nature & Fertility",
  tree: "Nature & Fertility",
  wreath: "Nature & Fertility",
};

const ANIMAL_SUPERSET_COLORS: Record<string, string> = {
  "Mammals": "#FF6B35",
  "Birds": "#00BCD4",
  "Reptiles": "#7FFF00",
  "Fish": "#4A7BFF",
  "Insects & Arachnids": "#FFB800",
  "Amphibians": "#66BB6A",
  "Mythical Creatures": "#8F00FF",
};

const OBJECT_SUPERSET_COLORS: Record<string, string> = {
  "Weapons": "#E53935",
  "Armor & Protection": "#4A7BFF",
  "Regalia & Authority": "#FFD700",
  "Musical Instruments": "#CE93D8",
  "Sacred & Ritual": "#03FF9B",
  "Nature & Fertility": "#66BB6A",
};

const STRIP_PREFIXES = [
  /^goddess of /i,
  /^god of /i,
  /^the /i,
  /^patron(?:ess)? of /i,
  /^protector of /i,
  /^guardian of /i,
  /^personification of /i,
  /^spirit of /i,
  /^muse of /i,
  /^deity of /i,
];

function normalizeToken(token: string): string {
  let t = token.trim().toLowerCase();
  if (SYNONYMS[t]) return SYNONYMS[t];
  for (const p of STRIP_PREFIXES) {
    if (p.test(t)) {
      const stripped = t.replace(p, "").trim();
      if (stripped.length >= 2) t = stripped;
      break;
    }
  }
  if (SYNONYMS[t]) return SYNONYMS[t];
  // Strip a single trailing "s" for naive plural handling (gods → god, trees → tree).
  // Only do this when the result is at least 4 chars, to avoid mangling words ending
  // in -ness / -ess / -ous / -ess / etc. (forgiveness → forgivene was the old bug).
  if (t.length >= 4 && /s$/.test(t) && !/(ss|us|is|os|as)$/.test(t)) {
    const stripped = t.slice(0, -1);
    if (SYNONYMS[stripped]) return SYNONYMS[stripped];
    return stripped;
  }
  return t;
}

function tokenize(text: string | null): string[] {
  if (!text) return [];
  const seen = new Set<string>();
  return text
    .split(/[,;]+/)
    .map(s => s.trim().toLowerCase())
    .filter(s => {
      if (s.length <= 1 || s.length >= 60) return false;
      if (STOP_TOKENS.has(s)) return false;
      if (STOP_PATTERNS.some(p => p.test(s))) return false;
      return true;
    })
    .map(s => normalizeToken(s))
    .filter(s => {
      if (s.length <= 1) return false;
      if (seen.has(s)) return false;
      seen.add(s);
      return true;
    });
}

function formatTypeLabel(type: string): string {
  return type.replace(/_/g, " ");
}

interface GraphData {
  nodes: Node[];
  edges: Edge[];
}

interface TraitNode {
  id: string;
  label: string;
  category: string;
  count: number;
  isCharacter: false;
}

interface CharNode {
  id: string;
  nodeId: number;
  label: string;
  tradition: string | null;
  isCharacter: true;
  original: Node;
}

type GraphNode = TraitNode | CharNode;

interface GraphLink {
  source: string;
  target: string;
  category: string;
}

interface DirectLink {
  source: string;
  target: string;
  weight: number;
  commonTraits: string[];
}

const TRAIT_FIELDS: { key: keyof Node; category: string }[] = [
  { key: "gender", category: "gender" },
  { key: "domain", category: "domain" },
  { key: "object", category: "object" },
  { key: "animals", category: "animals" },
  { key: "characterTrait", category: "characterTrait" },
  { key: "physicalCharacteristics", category: "physicalCharacteristics" },
];

const ARRAY_TRAIT_FIELDS: { key: keyof Node; category: string }[] = [
  { key: "eventTypes", category: "eventTypes" },
  { key: "birthTypes", category: "birthTypes" },
  { key: "deathTypes", category: "deathTypes" },
  { key: "familyRoles", category: "familyRoles" },
];

function getTraitsForFigure(fig: Node, enabledCategories?: Set<string>, useSupersets?: Set<string>): string[] {
  const traits: string[] = [];
  const useAnimalSupersets = useSupersets?.has("animalType");
  const useObjectSupersets = useSupersets?.has("objectType");
  for (const field of TRAIT_FIELDS) {
    if (enabledCategories && !enabledCategories.has(field.category)) continue;
    const val = fig[field.key] as string | null;
    const tokens = tokenize(val);
    for (const token of tokens) {
      if (field.category === "animals" && useAnimalSupersets) {
        const superset = ANIMAL_SUPERSETS[token];
        traits.push(`animalType::${superset || "Other Animals"}`);
      } else if (field.category === "object" && useObjectSupersets) {
        const superset = OBJECT_SUPERSETS[token];
        traits.push(`objectType::${superset || "Other Objects"}`);
      
      } else {
        traits.push(`${field.category}::${token}`);
      }
    }
  }
  for (const field of ARRAY_TRAIT_FIELDS) {
    if (enabledCategories && !enabledCategories.has(field.category)) continue;
    const arr = fig[field.key] as string[] | null;
    if (arr && Array.isArray(arr)) {
      for (const item of arr) {
        traits.push(`${field.category}::${formatTypeLabel(item)}`);
      }
    }
  }
  const seen = new Set<string>();
  return traits.filter(t => {
    if (seen.has(t)) return false;
    seen.add(t);
    return true;
  });
}

function buildGraph(figures: Node[], minTraits = 3, selectedCharacterIds?: Set<number>, enabledCategories?: Set<string>, useSupersets?: Set<string>, minTraitFrequency = 1) {
  const traitCounts = new Map<string, { label: string; category: string; count: number }>();
  const figureTraits = new Map<number, string[]>();

  const effectiveFigures = selectedCharacterIds && selectedCharacterIds.size > 0
    ? figures.filter(f => selectedCharacterIds.has(f.id))
    : figures;

  for (const fig of effectiveFigures) {
    const traits = getTraitsForFigure(fig, enabledCategories, useSupersets);
    figureTraits.set(fig.id, traits);
    for (const traitId of traits) {
      const parts = traitId.split("::");
      const category = parts[0];
      const label = parts[1];
      const existing = traitCounts.get(traitId);
      if (existing) {
        existing.count++;
      } else {
        traitCounts.set(traitId, { label, category, count: 1 });
      }
    }
  }

  const qualifiedFigureIds = new Set<number>();
  for (const fig of effectiveFigures) {
    const traits = figureTraits.get(fig.id) || [];
    if (traits.length >= minTraits) qualifiedFigureIds.add(fig.id);
  }

  const effectiveMinFreq = Math.max(2, minTraitFrequency);
  const sharedTraits = new Map<string, { label: string; category: string; count: number }>();
  for (const [id, data] of traitCounts) {
    if (data.count >= effectiveMinFreq) {
      sharedTraits.set(id, data);
    }
  }

  const traitToFigures = new Map<string, Set<number>>();
  for (const fig of effectiveFigures) {
    if (!qualifiedFigureIds.has(fig.id)) continue;
    const traits = figureTraits.get(fig.id) || [];
    for (const traitId of traits) {
      if (sharedTraits.has(traitId)) {
        if (!traitToFigures.has(traitId)) traitToFigures.set(traitId, new Set());
        traitToFigures.get(traitId)!.add(fig.id);
      }
    }
  }

  const graphNodes: GraphNode[] = [];
  const graphLinks: GraphLink[] = [];

  const usedTraits = new Set<string>();

  for (const fig of effectiveFigures) {
    if (!qualifiedFigureIds.has(fig.id)) continue;
    const traits = figureTraits.get(fig.id) || [];
    for (const traitId of traits) {
      if (sharedTraits.has(traitId)) {
        const traitFigs = traitToFigures.get(traitId);
        const hasOtherQualified = traitFigs && [...traitFigs].some(id => id !== fig.id && qualifiedFigureIds.has(id));
        if (hasOtherQualified) {
          graphLinks.push({
            source: `fig-${fig.id}`,
            target: traitId,
            category: sharedTraits.get(traitId)!.category,
          });
          usedTraits.add(traitId);
        }
      }
    }
  }

  for (const fig of effectiveFigures) {
    if (qualifiedFigureIds.has(fig.id)) {
      graphNodes.push({
        id: `fig-${fig.id}`,
        nodeId: fig.id,
        label: fig.name,
        tradition: fig.tradition,
        isCharacter: true,
        original: fig,
      });
    }
  }

  for (const traitId of usedTraits) {
    const data = sharedTraits.get(traitId)!;
    const qualifiedCount = [...(traitToFigures.get(traitId) || [])].filter(id => qualifiedFigureIds.has(id)).length;
    graphNodes.push({
      id: traitId,
      label: data.label,
      category: data.category,
      count: qualifiedCount,
      isCharacter: false,
    });
  }

  return { graphNodes, graphLinks };
}

function buildDirectGraph(figures: Node[], minTraits: number, selectedCharacterIds?: Set<number>, enabledCategories?: Set<string>, useSupersets?: Set<string>, minSharedTraits = 2, focalCharacterId?: number | null): { nodes: CharNode[]; links: DirectLink[] } {
  const figureTraitSets = new Map<number, Set<string>>();
  for (const fig of figures) {
    figureTraitSets.set(fig.id, new Set(getTraitsForFigure(fig, enabledCategories, useSupersets)));
  }

  // Ego-centric mode: build graph centered on focal deity
  if (focalCharacterId != null) {
    const focal = figures.find(f => f.id === focalCharacterId);
    if (!focal) return { nodes: [], links: [] };
    const focalTraits = figureTraitSets.get(focal.id);
    if (!focalTraits) return { nodes: [], links: [] };

    const links: DirectLink[] = [];
    const neighborIds = new Set<number>();
    for (const other of figures) {
      if (other.id === focal.id) continue;
      const otherTraits = figureTraitSets.get(other.id);
      if (!otherTraits) continue;
      const common: string[] = [];
      for (const t of focalTraits) {
        if (otherTraits.has(t)) common.push(t);
      }
      if (common.length >= minSharedTraits) {
        links.push({
          source: `fig-${focal.id}`,
          target: `fig-${other.id}`,
          weight: common.length,
          commonTraits: common.map(t => t.split("::")[1]),
        });
        neighborIds.add(other.id);
      }
    }

    const nodes: CharNode[] = [
      {
        id: `fig-${focal.id}`,
        nodeId: focal.id,
        label: focal.name,
        tradition: focal.tradition,
        isCharacter: true,
        original: focal,
      },
      ...figures.filter(f => neighborIds.has(f.id)).map(f => ({
        id: `fig-${f.id}`,
        nodeId: f.id,
        label: f.name,
        tradition: f.tradition,
        isCharacter: true,
        original: f,
      } as CharNode)),
    ];

    return { nodes, links };
  }

  // Full-graph mode (legacy fallback, used when no focal selected)
  const effectiveFigures = selectedCharacterIds && selectedCharacterIds.size > 0
    ? figures.filter(f => selectedCharacterIds.has(f.id))
    : figures;

  const qualifiedIds = new Set<number>();
  for (const fig of effectiveFigures) {
    const traits = figureTraitSets.get(fig.id);
    if (traits && traits.size >= minTraits) qualifiedIds.add(fig.id);
  }

  const qualifiedFigures = effectiveFigures.filter(f => qualifiedIds.has(f.id));

  const directLinks: DirectLink[] = [];
  const connectedIds = new Set<number>();

  for (let i = 0; i < qualifiedFigures.length; i++) {
    for (let j = i + 1; j < qualifiedFigures.length; j++) {
      const a = qualifiedFigures[i];
      const b = qualifiedFigures[j];
      const traitsA = figureTraitSets.get(a.id)!;
      const traitsB = figureTraitSets.get(b.id)!;
      const common: string[] = [];
      for (const t of traitsA) {
        if (traitsB.has(t)) common.push(t);
      }
      if (common.length >= minSharedTraits) {
        directLinks.push({
          source: `fig-${a.id}`,
          target: `fig-${b.id}`,
          weight: common.length,
          commonTraits: common.map(t => t.split("::")[1]),
        });
        connectedIds.add(a.id);
        connectedIds.add(b.id);
      }
    }
  }

  const charNodes: CharNode[] = [];
  for (const fig of qualifiedFigures) {
    if (connectedIds.has(fig.id)) {
      charNodes.push({
        id: `fig-${fig.id}`,
        nodeId: fig.id,
        label: fig.name,
        tradition: fig.tradition,
        isCharacter: true,
        original: fig,
      });
    }
  }

  const qualifiedNodeIds = new Set(charNodes.map(n => n.id));
  const filteredLinks = directLinks.filter(l => qualifiedNodeIds.has(l.source) && qualifiedNodeIds.has(l.target));

  return { nodes: charNodes, links: filteredLinks };
}


interface DichotomyGroup {
  traitId: string;
  traitLabel: string;
  traitCategory: string;
  figures: Node[];
  children?: DichotomyGroup[];
}

function findDichotomies(
  figures: Node[],
  depth: number,
  threshold: number,
  enabledCategories?: Set<string>,
  useSupersets?: Set<string>
): DichotomyGroup[] {
  const figTraitSets = new Map<number, Set<string>>();
  const traitFigures = new Map<string, Set<number>>();

  for (const fig of figures) {
    const traits = getTraitsForFigure(fig, enabledCategories, useSupersets);
    figTraitSets.set(fig.id, new Set(traits));
    for (const t of traits) {
      if (!traitFigures.has(t)) traitFigures.set(t, new Set());
      traitFigures.get(t)!.add(fig.id);
    }
  }

  function splitGroup(groupFigs: Node[], remainingDepth: number, usedTraits: Set<string> = new Set()): DichotomyGroup[] {
    if (remainingDepth <= 0 || groupFigs.length < 4) return [];

    const localTraitFigs = new Map<string, Set<number>>();
    for (const fig of groupFigs) {
      const traits = figTraitSets.get(fig.id) || new Set<string>();
      for (const t of traits) {
        if (usedTraits.has(t)) continue;
        if (!localTraitFigs.has(t)) localTraitFigs.set(t, new Set());
        localTraitFigs.get(t)!.add(fig.id);
      }
    }

    const traitsBySize = Array.from(localTraitFigs.entries())
      .filter(([, ids]) => ids.size >= 3)
      .sort((a, b) => b[1].size - a[1].size);

    let bestPair: [string, string] | null = null;
    let bestScore = -1;

    for (let i = 0; i < Math.min(traitsBySize.length, 40); i++) {
      const [tA, idsA] = traitsBySize[i];
      for (let j = i + 1; j < Math.min(traitsBySize.length, 40); j++) {
        const [tB, idsB] = traitsBySize[j];
        let overlap = 0;
        for (const id of idsA) {
          if (idsB.has(id)) overlap++;
        }
        const exclusion = 1 - overlap / Math.min(idsA.size, idsB.size);
        if (exclusion >= threshold) {
          const union = idsA.size + idsB.size - overlap;
          const coverage = union / groupFigs.length;
          if (coverage < 0.1) continue;
          const balance = Math.min(idsA.size, idsB.size) / Math.max(idsA.size, idsB.size);
          const score = coverage * coverage * 10 + balance * 0.2;
          if (score > bestScore) {
            bestScore = score;
            bestPair = [tA, tB];
          }
        }
      }
    }

    if (!bestPair) return [];

    const [traitA, traitB] = bestPair;
    const idsA = localTraitFigs.get(traitA)!;
    const idsB = localTraitFigs.get(traitB)!;

    const groupAFigs: Node[] = [];
    const groupBFigs: Node[] = [];

    for (const f of groupFigs) {
      const inA = idsA.has(f.id);
      const inB = idsB.has(f.id);
      if (inA && !inB) {
        groupAFigs.push(f);
      } else if (inB && !inA) {
        groupBFigs.push(f);
      } else if (inA && inB) {
        if (groupAFigs.length <= groupBFigs.length) {
          groupAFigs.push(f);
        } else {
          groupBFigs.push(f);
        }
      }
    }

    const partsA = traitA.split("::");
    const partsB = traitB.split("::");

    const resultA: DichotomyGroup = {
      traitId: traitA,
      traitLabel: partsA[1],
      traitCategory: partsA[0],
      figures: groupAFigs,
    };
    const resultB: DichotomyGroup = {
      traitId: traitB,
      traitLabel: partsB[1],
      traitCategory: partsB[0],
      figures: groupBFigs,
    };

    if (remainingDepth > 1) {
      const nextUsed = new Set(usedTraits);
      nextUsed.add(traitA);
      nextUsed.add(traitB);
      resultA.children = splitGroup(groupAFigs, remainingDepth - 1, nextUsed);
      resultB.children = splitGroup(groupBFigs, remainingDepth - 1, nextUsed);
    }

    return [resultA, resultB];
  }

  return splitGroup(figures, depth);
}

function flattenDichotomyGroups(groups: DichotomyGroup[]): DichotomyGroup[] {
  const result: DichotomyGroup[] = [];
  function collect(g: DichotomyGroup[]) {
    for (const group of g) {
      if (group.children && group.children.length > 0) {
        collect(group.children);
      } else {
        result.push(group);
      }
    }
  }
  collect(groups);
  return result;
}

function NodePanel({ node, relatedNodes, edges, onClose }: { node: Node; relatedNodes: Node[]; edges: Edge[]; onClose: () => void }) {
  const detailFields: { key: keyof Node; label: string }[] = [
    { key: "tradition", label: "Tradition" },
    { key: "gender", label: "Gender" },
    { key: "domain", label: "Domain" },
    { key: "object", label: "Object" },
    { key: "animals", label: "Animals" },
    { key: "characterTrait", label: "Character Trait" },
    { key: "physicalCharacteristics", label: "Physical Characteristics" },
    { key: "significantEvent", label: "Significant Event" },
    { key: "birthCircumstances", label: "Circumstances of Birth" },
    { key: "deathCircumstances", label: "Circumstances of Death" },
  ];

  const arrayFields: { key: keyof Node; label: string; color: string }[] = [
    { key: "eventTypes", label: "Event Types", color: CATEGORY_COLORS.eventTypes },
    { key: "birthTypes", label: "Birth Types", color: CATEGORY_COLORS.birthTypes },
    { key: "deathTypes", label: "Death Types", color: CATEGORY_COLORS.deathTypes },
    { key: "familyRoles", label: "Family Roles", color: CATEGORY_COLORS.familyRoles },
  ];

  return (
    <div className="absolute top-0 right-0 h-full w-80 lg:w-96 bg-[#0B0626]/95 backdrop-blur-xl border-l border-[#350A8C]/30 z-20 overflow-hidden flex flex-col" data-testid="panel-node-detail">
      <div className="flex items-center justify-between p-4 border-b border-[#350A8C]/20">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-3 h-3 rounded-full flex-shrink-0 bg-[#E0DCE6]" />
          <h3 className="font-serif text-lg text-shadows-text truncate" data-testid="text-node-name">{node.name}</h3>
        </div>
        <button onClick={onClose} className="text-shadows-text/40 hover:text-shadows-text transition-colors flex-shrink-0" data-testid="button-close-panel">
          <X size={18} />
        </button>
      </div>
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4">
          {detailFields.map(({ key, label }) => {
            const value = node[key] as string | null;
            if (!value) return null;
            return (
              <div key={key}>
                <span className="text-xs uppercase tracking-wider text-shadows-text/40">{label}</span>
                <p className="text-sm text-shadows-text/80 mt-1 leading-relaxed">{value}</p>
              </div>
            );
          })}
          {arrayFields.map(({ key, label, color }) => {
            const arr = node[key] as string[] | null;
            if (!arr || !Array.isArray(arr) || arr.length === 0) return null;
            return (
              <div key={key}>
                <span className="text-xs uppercase tracking-wider text-shadows-text/40">{label}</span>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {arr.map((item) => (
                    <span key={item} className="px-2 py-0.5 rounded-full text-xs text-white/90" style={{ backgroundColor: color + "40", borderColor: color, borderWidth: 1 }}>
                      {formatTypeLabel(item)}
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
          {relatedNodes.length > 0 && (
            <div>
              <span className="text-xs uppercase tracking-wider text-shadows-text/40">Relationships</span>
              <div className="mt-2 space-y-2">
                {relatedNodes.map((rn) => {
                  const edge = edges.find(
                    (e) =>
                      (e.sourceNodeId === node.id && e.targetNodeId === rn.id) ||
                      (e.targetNodeId === node.id && e.sourceNodeId === rn.id)
                  );
                  return (
                    <div key={rn.id} className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full flex-shrink-0 bg-[#E0DCE6]" />
                      <span className="text-xs text-shadows-text/70">
                        {edge?.relationType ? `${edge.relationType} — ` : ""}{rn.name}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

function TraitPanel({ trait, allNodes, graphLinks, onClose, onSelectCharacter }: {
  trait: TraitNode;
  allNodes: Node[];
  graphLinks: GraphLink[];
  onClose: () => void;
  onSelectCharacter: (node: Node) => void;
}) {
  const connectedCharacters = useMemo(() => {
    const charIds = new Set<string>();
    for (const link of graphLinks) {
      if (link.source === trait.id) charIds.add(link.target);
      if (link.target === trait.id) charIds.add(link.source);
    }
    return allNodes.filter(n => charIds.has(`fig-${n.id}`));
  }, [trait, allNodes, graphLinks]);

  const aggregatedTraits = useMemo(() => {
    const traitCounts = new Map<string, { count: number; category: string }>();

    for (const char of connectedCharacters) {
      const allTraits = getTraitsForFigure(char);
      for (const traitId of allTraits) {
        const parts = traitId.split("::");
        const label = parts[1];
        const category = parts[0];
        if (label === trait.label) continue;
        const existing = traitCounts.get(label);
        if (existing) {
          existing.count++;
        } else {
          traitCounts.set(label, { count: 1, category });
        }
      }
    }

    return [...traitCounts.entries()]
      .filter(([, v]) => v.count >= 2)
      .sort((a, b) => b[1].count - a[1].count);
  }, [connectedCharacters, trait.label]);

  return (
    <div className="absolute top-0 right-0 h-full w-80 lg:w-96 bg-[#0B0626]/95 backdrop-blur-xl border-l border-[#350A8C]/30 z-20 overflow-hidden flex flex-col" data-testid="panel-trait-detail">
      <div className="flex items-center justify-between p-4 border-b border-[#350A8C]/20">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: CATEGORY_COLORS[trait.category] }} />
          <div className="min-w-0">
            <h3 className="font-serif text-lg text-shadows-text truncate" data-testid="text-trait-name">{trait.label}</h3>
            <span className="text-[10px] uppercase tracking-wider text-shadows-text/30">{CATEGORY_LABELS[trait.category] || trait.category}</span>
          </div>
        </div>
        <button onClick={onClose} className="text-shadows-text/40 hover:text-shadows-text transition-colors flex-shrink-0" data-testid="button-close-trait-panel">
          <X size={18} />
        </button>
      </div>
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-5">
          <div>
            <span className="text-xs uppercase tracking-wider text-shadows-text/40">
              Figures ({connectedCharacters.length})
            </span>
            <div className="mt-2 space-y-1.5">
              {connectedCharacters.map((char) => (
                <button
                  key={char.id}
                  onClick={() => onSelectCharacter(char)}
                  className="flex items-center gap-2 w-full text-left hover:bg-[#350A8C]/20 rounded px-2 py-1 transition-colors group"
                  data-testid={`button-trait-char-${char.id}`}
                >
                  <div className="w-2 h-2 rounded-full flex-shrink-0 bg-[#E0DCE6]" />
                  <span className="text-xs text-shadows-text/70 group-hover:text-shadows-text truncate">{char.name}</span>
                  {char.tradition && (
                    <span className="text-[9px] text-shadows-text/25 ml-auto flex-shrink-0">{char.tradition}</span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {aggregatedTraits.length > 0 && (
            <div>
              <span className="text-xs uppercase tracking-wider text-shadows-text/40">
                Shared traits across these figures
              </span>
              <div className="mt-2 space-y-1">
                {aggregatedTraits.map(([name, { count, category }]) => (
                  <div key={name} className="flex items-center gap-2 px-2 py-0.5">
                    <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: CATEGORY_COLORS[category] }} />
                    <span className="text-xs text-shadows-text/60 truncate">{name}</span>
                    <span className="text-[9px] text-shadows-text/25 ml-auto flex-shrink-0 font-mono">{count}/{connectedCharacters.length}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

interface HierarchyItem {
  id: number;
  categoryField: string;
  traitName: string;
  parentId: number | null;
  isLeaf: number;
}

interface HierarchyTreeNode {
  id: number;
  name: string;
  children: HierarchyTreeNode[];
  isLeaf: boolean;
  leafTraits: string[];
  figureCount: number;
}

const HIERARCHY_CATEGORY_MAP: Record<string, string> = {
  physical_characteristics: "physicalCharacteristics",
  object: "object",
  animals: "animals",
  domain: "domain",
  character_trait: "characterTrait",
  event_types: "eventTypes",
  death_types: "deathTypes",
  birth_types: "birthTypes",
};

const HIERARCHY_CATEGORY_LABELS: Record<string, string> = {
  physical_characteristics: "Physical Characteristics",
  object: "Objects",
  animals: "Animals",
  domain: "Domain",
  character_trait: "Character Traits",
  event_types: "Event Types",
  death_types: "Death Types",
  birth_types: "Birth Types",
  gender: "Gender",
};

const HIERARCHY_CATEGORY_ORDER = [
  "gender",
  "domain",
  "character_trait",
  "animals",
  "physical_characteristics",
  "object",
  "event_types",
  "birth_types",
  "death_types",
];

function buildHierarchyTrees(items: HierarchyItem[]): Map<string, HierarchyTreeNode[]> {
  const byCategory = new Map<string, HierarchyItem[]>();
  for (const item of items) {
    if (!byCategory.has(item.categoryField)) byCategory.set(item.categoryField, []);
    byCategory.get(item.categoryField)!.push(item);
  }
  const result = new Map<string, HierarchyTreeNode[]>();
  for (const [cat, catItems] of byCategory) {
    const byId = new Map<number, HierarchyItem>();
    for (const item of catItems) byId.set(item.id, item);
    const nodeMap = new Map<number, HierarchyTreeNode>();
    for (const item of catItems) {
      nodeMap.set(item.id, { id: item.id, name: item.traitName, children: [], isLeaf: item.isLeaf === 1, leafTraits: [], figureCount: 0 });
    }
    const roots: HierarchyTreeNode[] = [];
    for (const item of catItems) {
      const node = nodeMap.get(item.id)!;
      if (item.parentId === null) {
        roots.push(node);
      } else {
        const parent = nodeMap.get(item.parentId);
        if (parent) parent.children.push(node);
      }
    }
    function collectLeafs(n: HierarchyTreeNode): string[] {
      if (n.isLeaf) return [n.name];
      const leafs: string[] = [];
      for (const c of n.children) leafs.push(...collectLeafs(c));
      return leafs;
    }
    for (const node of nodeMap.values()) {
      node.leafTraits = collectLeafs(node);
    }
    result.set(cat, roots);
  }
  return result;
}

function filterTreeByFrequency(nodes: HierarchyTreeNode[], minFreq: number): HierarchyTreeNode[] {
  if (minFreq <= 1) return nodes;
  const result: HierarchyTreeNode[] = [];
  for (const node of nodes) {
    if (node.isLeaf) {
      if (node.figureCount >= minFreq) result.push(node);
    } else {
      const filteredChildren = filterTreeByFrequency(node.children, minFreq);
      if (filteredChildren.length > 0) {
        const filteredLeafTraits: string[] = [];
        function collectLeafs(n: HierarchyTreeNode) {
          if (n.isLeaf) filteredLeafTraits.push(n.name);
          else for (const c of n.children) collectLeafs(c);
        }
        for (const c of filteredChildren) collectLeafs(c);
        result.push({
          ...node,
          children: filteredChildren,
          leafTraits: filteredLeafTraits,
          figureCount: filteredChildren.reduce((s, c) => s + c.figureCount, 0),
        });
      }
    }
  }
  return result;
}

function HierarchyTreePicker({
  categoryField,
  roots,
  selectedLeafs,
  onToggleNode,
  categoryColor,
  minFrequency = 1,
}: {
  categoryField: string;
  roots: HierarchyTreeNode[];
  selectedLeafs: Set<string>;
  onToggleNode: (categoryField: string, leafTraits: string[], checked: boolean) => void;
  categoryColor: string;
  minFrequency?: number;
}) {
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [sectionOpen, setSectionOpen] = useState(false);

  const toggleExpand = useCallback((id: number) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const filteredRoots = useMemo(() => filterTreeByFrequency(roots, minFrequency), [roots, minFrequency]);

  const totalLeafs = useMemo(() => {
    const all: string[] = [];
    for (const r of filteredRoots) all.push(...r.leafTraits);
    return all;
  }, [filteredRoots]);

  const selectedCount = useMemo(() => {
    return totalLeafs.filter(l => selectedLeafs.has(l)).length;
  }, [totalLeafs, selectedLeafs]);

  const renderNode = (node: HierarchyTreeNode, depth: number) => {
    const isChecked = node.leafTraits.length > 0 && node.leafTraits.every(l => selectedLeafs.has(l));
    const isPartial = !isChecked && node.leafTraits.some(l => selectedLeafs.has(l));
    const hasChildren = node.children.length > 0;
    const isExpanded = expanded.has(node.id);

    return (
      <div key={node.id}>
        <div
          className="flex items-center gap-1 py-0.5 group"
          style={{ paddingLeft: `${depth * 12}px` }}
        >
          {hasChildren ? (
            <button
              onClick={() => toggleExpand(node.id)}
              className="w-3.5 h-3.5 flex items-center justify-center text-shadows-text/30 hover:text-shadows-text/60 flex-shrink-0"
              data-testid={`btn-expand-${categoryField}-${node.id}`}
            >
              {isExpanded ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
            </button>
          ) : (
            <span className="w-3.5 flex-shrink-0" />
          )}
          <Checkbox
            id={`hier-${categoryField}-${node.id}`}
            checked={isChecked}
            className={`border-[#350A8C]/40 h-3 w-3 ${isPartial ? "opacity-60" : ""} data-[state=checked]:bg-[#03FF9B] data-[state=checked]:border-[#03FF9B]`}
            onCheckedChange={() => onToggleNode(categoryField, node.leafTraits, !isChecked)}
            data-testid={`checkbox-hier-${categoryField}-${node.id}`}
          />
          <label
            htmlFor={`hier-${categoryField}-${node.id}`}
            className={`text-[10px] cursor-pointer truncate ${
              node.isLeaf ? "text-shadows-text/50" : "text-shadows-text/70 font-medium"
            }`}
          >
            {node.name}
          </label>
          <span className="text-[8px] text-shadows-text/25 ml-auto pr-1">{node.figureCount}</span>
        </div>
        {hasChildren && isExpanded && node.children.map(c => renderNode(c, depth + 1))}
      </div>
    );
  };

  const label = HIERARCHY_CATEGORY_LABELS[categoryField] || categoryField;

  return (
    <div>
      <button
        onClick={() => setSectionOpen(!sectionOpen)}
        className="flex items-center gap-1.5 w-full text-left py-1"
        data-testid={`btn-hier-section-${categoryField}`}
      >
        {sectionOpen ? <ChevronDown size={10} className="text-shadows-text/40" /> : <ChevronRight size={10} className="text-shadows-text/40" />}
        <span className="inline-block w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: categoryColor }} />
        <span className="text-[10px] text-shadows-text/60 uppercase tracking-wider">{label}</span>
        {selectedCount > 0 && (
          <span className="text-[9px] ml-auto px-1.5 py-0 rounded-full bg-[#03FF9B]/15 text-[#03FF9B] border border-[#03FF9B]/30">
            {selectedCount}
          </span>
        )}
      </button>
      {sectionOpen && (
        <div className="mt-0.5 mb-1">
          <div className="flex items-center justify-end mb-0.5">
            <button
              className="text-[8px] text-[#8F00FF]/50 hover:text-[#8F00FF] transition-colors"
              onClick={() => {
                const allSelected = totalLeafs.every(l => selectedLeafs.has(l));
                onToggleNode(categoryField, totalLeafs, !allSelected);
              }}
              data-testid={`btn-hier-toggle-all-${categoryField}`}
            >
              {totalLeafs.every(l => selectedLeafs.has(l)) ? "Clear all" : "Select all"}
            </button>
          </div>
          {filteredRoots.map(r => renderNode(r, 0))}
        </div>
      )}
    </div>
  );
}

function FilterSidebar({
  filters,
  activeFilters,
  onToggleFilter,
  isOpen,
  onToggle,
  nodeCount,
  totalCount,
  minConnections,
  onMinConnectionsChange,
  maxConnectionCount,
  allNodes,
  selectedCharacterIds,
  onToggleCharacter,
  onClearCharacters,
  characterSearch,
  onCharacterSearchChange,
  activeSupersets,
  onToggleSuperset,
  hierarchyTrees,
  hierarchySelections,
  onToggleHierarchyNode,
  onClearHierarchyFilter,
  minTraitFrequency,
  onMinTraitFrequencyChange,
  enabledRelationTypes,
  onToggleRelationType,
  allTraditions,
  selectedTraditions,
  onToggleTradition,
  onClearTraditionFilter,
}: {
  filters: { traditions: string[]; categories: string[] };
  activeFilters: Record<string, Set<string>>;
  onToggleFilter: (category: string, value: string) => void;
  isOpen: boolean;
  onToggle: () => void;
  nodeCount: number;
  totalCount: number;
  minConnections: number;
  onMinConnectionsChange: (val: number) => void;
  maxConnectionCount: number;
  allNodes: Node[];
  selectedCharacterIds: Set<number>;
  onToggleCharacter: (id: number) => void;
  onClearCharacters: () => void;
  characterSearch: string;
  onCharacterSearchChange: (val: string) => void;
  activeSupersets: Set<string>;
  onToggleSuperset: (key: string) => void;
  hierarchyTrees: Map<string, HierarchyTreeNode[]>;
  hierarchySelections: Map<string, Set<string>>;
  onToggleHierarchyNode: (categoryField: string, leafTraits: string[], checked: boolean) => void;
  onClearHierarchyFilter: () => void;
  minTraitFrequency: number;
  onMinTraitFrequencyChange: (val: number) => void;
  enabledRelationTypes: Set<RelationType>;
  onToggleRelationType: (rt: RelationType) => void;
  allTraditions: string[];
  selectedTraditions: Set<string> | null;
  onToggleTradition: (t: string) => void;
  onClearTraditionFilter: () => void;
}) {
  const filteredCharacters = useMemo(() => {
    if (!characterSearch.trim()) return [];
    const q = characterSearch.toLowerCase();
    return allNodes
      .filter(n => n.name.toLowerCase().includes(q))
      .slice(0, 30);
  }, [allNodes, characterSearch]);

  const selectedCharacters = useMemo(() => {
    return allNodes.filter(n => selectedCharacterIds.has(n.id));
  }, [allNodes, selectedCharacterIds]);

  const sections = [
    {
      key: "categories",
      label: "Attribute Category",
      values: filters.categories,
      getColor: (val: string) => CATEGORY_COLORS[val] || "#8F00FF",
    },
  ];

  return (
    <>
      <button
        className="absolute top-4 left-4 z-20 p-2 rounded-md bg-[#0B0626]/80 border border-[#350A8C]/30 text-shadows-text/60 hover:text-shadows-text transition-colors lg:hidden"
        onClick={onToggle}
        data-testid="button-toggle-filters"
      >
        <Filter size={18} />
      </button>

      <div
        className={`absolute top-0 left-0 h-full w-72 bg-[#0B0626]/95 backdrop-blur-xl border-r border-[#350A8C]/30 z-10 transition-transform duration-300 ${
          isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
        data-testid="panel-filters"
      >
        <div className="p-4 border-b border-[#350A8C]/20 flex items-center justify-between">
          <h3 className="font-serif text-sm text-shadows-text tracking-wider">Filters</h3>
          <Link href="/">
            <Button variant="ghost" size="sm" className="text-shadows-text/40 hover:text-shadows-text p-1 h-auto" data-testid="button-back-home">
              <ArrowLeft size={16} />
            </Button>
          </Link>
        </div>
        <div className="px-4 py-2 border-b border-[#350A8C]/10">
          <span className="text-[10px] text-shadows-text/30 font-mono">{nodeCount} figures shown / {totalCount} total</span>
        </div>
        <ScrollArea className="h-[calc(100%-90px)]">
          <div className="p-4 space-y-5">
            <div>
              <h4 className="text-xs uppercase tracking-wider text-shadows-text/40 mb-2 flex items-center gap-1.5">
                <SlidersHorizontal size={12} />
                Min. Traits
              </h4>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={minConnections}
                  onChange={(e) => {
                    const v = parseInt(e.target.value);
                    if (!isNaN(v) && v >= 1) onMinConnectionsChange(v);
                  }}
                  min={1}
                  max={maxConnectionCount}
                  className="w-16 h-7 px-2 text-xs font-mono text-center rounded border border-shadows-text/20 bg-shadows-bg text-shadows-text focus:outline-none focus:border-shadows-accent"
                  data-testid="input-min-traits"
                />
                <span className="text-[10px] text-shadows-text/40">/ {maxConnectionCount} max</span>
              </div>
            </div>

            <div>
              <h4 className="text-xs uppercase tracking-wider text-shadows-text/40 mb-2 flex items-center gap-1.5">
                <Users size={12} />
                Select Characters
              </h4>
              {selectedCharacters.length > 0 && (
                <div className="mb-2">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] text-shadows-text/30">{selectedCharacters.length} selected</span>
                    <button
                      onClick={onClearCharacters}
                      className="text-[10px] text-[#E53935]/60 hover:text-[#E53935] transition-colors"
                      data-testid="button-clear-characters"
                    >
                      Clear all
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1 mb-2">
                    {selectedCharacters.map((char) => (
                      <button
                        key={char.id}
                        onClick={() => onToggleCharacter(char.id)}
                        className="px-1.5 py-0.5 rounded text-[10px] bg-[#8F00FF]/20 border border-[#8F00FF]/30 text-shadows-text/70 hover:bg-[#E53935]/20 hover:border-[#E53935]/30 transition-colors"
                        data-testid={`button-remove-char-${char.id}`}
                      >
                        {char.name} ×
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-shadows-text/30" />
                <Input
                  type="search"
                  placeholder="Search to add..."
                  value={characterSearch}
                  onChange={(e) => onCharacterSearchChange(e.target.value)}
                  className="pl-7 h-7 text-xs bg-[#0B0626]/60 border-[#350A8C]/20 text-shadows-text focus:border-[#03FF9B]/50"
                  data-testid="input-character-search"
                />
              </div>
              {filteredCharacters.length > 0 && (
                <div className="mt-1.5 max-h-40 overflow-y-auto space-y-0.5 border border-[#350A8C]/15 rounded p-1">
                  {filteredCharacters.map((char) => (
                    <button
                      key={char.id}
                      onClick={() => {
                        onToggleCharacter(char.id);
                        onCharacterSearchChange("");
                      }}
                      className={`flex items-center gap-2 w-full text-left rounded px-2 py-1 transition-colors text-xs ${
                        selectedCharacterIds.has(char.id)
                          ? "bg-[#8F00FF]/20 text-shadows-text"
                          : "hover:bg-[#350A8C]/20 text-shadows-text/60"
                      }`}
                      data-testid={`button-add-char-${char.id}`}
                    >
                      <div className="w-2 h-2 rounded-full flex-shrink-0 bg-[#E0DCE6]" />
                      <span className="truncate">{char.name}</span>
                      {char.tradition && (
                        <span className="text-[9px] text-shadows-text/25 ml-auto flex-shrink-0">{char.tradition}</span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {hierarchyTrees.size > 0 && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs uppercase tracking-wider text-shadows-text/40 flex items-center gap-1.5">
                    <TreePine size={12} />
                    Filter Figures
                  </h4>
                  {Array.from(hierarchySelections.values()).some(s => s.size > 0) && (
                    <button
                      className="text-[9px] text-[#E53935]/60 hover:text-[#E53935] transition-colors"
                      onClick={onClearHierarchyFilter}
                      data-testid="btn-clear-hierarchy-filters"
                    >
                      Clear all
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-2 mb-2 mt-1">
                  <span className="text-[9px] text-shadows-text/40 whitespace-nowrap">Min. figures:</span>
                  <Slider
                    min={1}
                    max={20}
                    step={1}
                    value={[minTraitFrequency]}
                    onValueChange={([v]) => onMinTraitFrequencyChange(v)}
                    className="flex-1"
                    data-testid="slider-min-trait-frequency"
                  />
                  <span className="text-[9px] text-[#03FF9B] font-mono w-4 text-right" data-testid="text-min-trait-frequency">{minTraitFrequency}</span>
                </div>
                <div className="space-y-0.5">
                  {HIERARCHY_CATEGORY_ORDER.filter(cat => hierarchyTrees.has(cat)).map(catField => {
                    const roots = hierarchyTrees.get(catField)!;
                    const frontendCat = HIERARCHY_CATEGORY_MAP[catField];
                    const color = frontendCat ? CATEGORY_COLORS[frontendCat] || "#8F00FF" : "#8F00FF";
                    return (
                      <HierarchyTreePicker
                        key={catField}
                        categoryField={catField}
                        roots={roots}
                        selectedLeafs={hierarchySelections.get(catField) || new Set()}
                        onToggleNode={onToggleHierarchyNode}
                        categoryColor={color}
                        minFrequency={minTraitFrequency}
                      />
                    );
                  })}
                </div>
              </div>
            )}

            {allTraditions.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs uppercase tracking-wider text-shadows-text/40 flex items-center gap-1.5">
                    <Globe size={12} />
                    Traditions
                  </h4>
                  <div className="flex items-center gap-2">
                    {selectedTraditions && (
                      <button
                        className="text-[9px] text-[#E53935]/60 hover:text-[#E53935] transition-colors"
                        onClick={onClearTraditionFilter}
                        data-testid="button-clear-tradition-filter"
                      >
                        Reset
                      </button>
                    )}
                    <button
                      className="text-[9px] text-[#8F00FF]/60 hover:text-[#8F00FF] transition-colors"
                      onClick={() => {
                        const allEnabled = !selectedTraditions || allTraditions.every(t => selectedTraditions.has(t));
                        if (allEnabled) {
                          for (const t of allTraditions) onToggleTradition(t);
                        } else {
                          onClearTraditionFilter();
                        }
                      }}
                      data-testid="button-toggle-all-traditions"
                    >
                      {!selectedTraditions || allTraditions.every(t => selectedTraditions.has(t)) ? "Hide all" : "Show all"}
                    </button>
                  </div>
                </div>
                <div className="space-y-1 max-h-60 overflow-y-auto scrollbar-thin pr-1">
                  {allTraditions.map(t => (
                    <div key={t} className="flex items-center gap-2">
                      <Checkbox
                        id={`trad-main-${t}`}
                        checked={!selectedTraditions || selectedTraditions.has(t)}
                        onCheckedChange={() => onToggleTradition(t)}
                        className="border-[#350A8C]/40 data-[state=checked]:bg-[#8F00FF] data-[state=checked]:border-[#8F00FF]"
                        data-testid={`checkbox-tradition-${t.replace(/\s/g, "-")}`}
                      />
                      <Label
                        htmlFor={`trad-main-${t}`}
                        className="text-xs text-shadows-text/60 cursor-pointer flex items-center gap-1.5"
                      >
                        <span className="w-2 h-2 inline-block rounded-full flex-shrink-0" style={{ backgroundColor: TRADITION_COLORS[t] || "#E0DCE6" }} />
                        {t}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs uppercase tracking-wider text-shadows-text/40 flex items-center gap-1.5">
                  <Link2 size={12} />
                  Relationship Edges
                </h4>
                <button
                  className="text-[9px] text-[#8F00FF]/60 hover:text-[#8F00FF] transition-colors"
                  onClick={() => {
                    const allEnabled = RELATION_TYPES.every(rt => enabledRelationTypes.has(rt));
                    for (const rt of RELATION_TYPES) {
                      if (allEnabled) {
                        if (enabledRelationTypes.has(rt)) onToggleRelationType(rt);
                      } else {
                        if (!enabledRelationTypes.has(rt)) onToggleRelationType(rt);
                      }
                    }
                  }}
                  data-testid="button-toggle-all-relations"
                >
                  {RELATION_TYPES.every(rt => enabledRelationTypes.has(rt)) ? "Hide all" : "Show all"}
                </button>
              </div>
              <div className="space-y-1.5">
                {RELATION_TYPES.map(rt => (
                  <div key={rt} className="flex items-center gap-2">
                    <Checkbox
                      id={`rel-${rt}`}
                      checked={enabledRelationTypes.has(rt)}
                      onCheckedChange={() => onToggleRelationType(rt)}
                      className="border-[#350A8C]/40 data-[state=checked]:bg-[#8F00FF] data-[state=checked]:border-[#8F00FF]"
                      data-testid={`checkbox-relation-${rt.replace(/\s/g, "-")}`}
                    />
                    <Label
                      htmlFor={`rel-${rt}`}
                      className="text-xs text-shadows-text/60 cursor-pointer flex items-center gap-1.5"
                    >
                      <span className="inline-block w-4 h-[3px] rounded-full" style={{ backgroundColor: RELATION_COLORS[rt] }} />
                      {RELATION_LABELS[rt]}
                    </Label>
                  </div>
                ))}
              </div>
            </div>

            {sections.map((section) =>
              section.values.length > 0 ? (
                <div key={section.key}>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-xs uppercase tracking-wider text-shadows-text/40">{section.label}</h4>
                    <button
                      className="text-[9px] text-[#8F00FF]/60 hover:text-[#8F00FF] transition-colors"
                      onClick={() => {
                        const allChecked = section.values.every(v => activeFilters[section.key]?.has(v));
                        for (const v of section.values) {
                          if (allChecked) {
                            if (activeFilters[section.key]?.has(v)) onToggleFilter(section.key, v);
                          } else {
                            if (!activeFilters[section.key]?.has(v)) onToggleFilter(section.key, v);
                          }
                        }
                      }}
                      data-testid="button-toggle-all-categories"
                    >
                      {section.values.every(v => activeFilters[section.key]?.has(v)) ? "Clear all" : "Select all"}
                    </button>
                  </div>
                  <div className="space-y-1.5">
                    {section.values.map((val) => (
                      <div key={val}>
                        <div className="flex items-center gap-2">
                          <Checkbox
                            id={`${section.key}-${val}`}
                            checked={activeFilters[section.key]?.has(val) || false}
                            onCheckedChange={() => onToggleFilter(section.key, val)}
                            className="border-[#350A8C]/40 data-[state=checked]:bg-[#8F00FF] data-[state=checked]:border-[#8F00FF]"
                            data-testid={`checkbox-filter-${section.key}-${val}`}
                          />
                          <Label
                            htmlFor={`${section.key}-${val}`}
                            className="text-xs text-shadows-text/60 cursor-pointer flex items-center gap-1.5"
                          >
                            <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: section.getColor(val) }} />
                            {CATEGORY_LABELS[val] || val}
                          </Label>
                          {val === "animals" && (
                            <button
                              onClick={(e) => { e.stopPropagation(); e.preventDefault(); onToggleSuperset("animalType"); }}
                              className={`ml-auto text-[9px] px-1.5 py-0.5 rounded border transition-colors ${
                                activeSupersets.has("animalType")
                                  ? "bg-[#FF8A65]/20 border-[#FF8A65]/50 text-[#FF8A65]"
                                  : "border-[#350A8C]/30 text-shadows-text/30 hover:text-shadows-text/50"
                              }`}
                              data-testid="button-toggle-animal-supersets"
                            >
                              Group
                            </button>
                          )}
                          {val === "object" && (
                            <button
                              onClick={(e) => { e.stopPropagation(); e.preventDefault(); onToggleSuperset("objectType"); }}
                              className={`ml-auto text-[9px] px-1.5 py-0.5 rounded border transition-colors ${
                                activeSupersets.has("objectType")
                                  ? "bg-[#FFD700]/20 border-[#FFD700]/50 text-[#FFD700]"
                                  : "border-[#350A8C]/30 text-shadows-text/30 hover:text-shadows-text/50"
                              }`}
                              data-testid="button-toggle-object-supersets"
                            >
                              Group
                            </button>
                          )}
                        </div>
                        {val === "animals" && activeSupersets.has("animalType") && activeFilters[section.key]?.has(val) && (
                          <div className="ml-6 mt-1 flex flex-wrap gap-1">
                            {Object.entries(ANIMAL_SUPERSET_COLORS).map(([name, color]) => (
                              <span key={name} className="text-[9px] px-1.5 py-0.5 rounded-full border" style={{ borderColor: color + "60", color }}>
                                {name}
                              </span>
                            ))}
                          </div>
                        )}
                        {val === "object" && activeSupersets.has("objectType") && activeFilters[section.key]?.has(val) && (
                          <div className="ml-6 mt-1 flex flex-wrap gap-1">
                            {Object.entries(OBJECT_SUPERSET_COLORS).map(([name, color]) => (
                              <span key={name} className="text-[9px] px-1.5 py-0.5 rounded-full border" style={{ borderColor: color + "60", color }}>
                                {name}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ) : null
            )}
          </div>
        </ScrollArea>
      </div>
    </>
  );
}

function NetworkView({
  filteredGraphNodes,
  filteredLinks,
  onSelectNode,
  onSelectTrait,
  onHoverNode,
  hoveredNode,
  selectedNodeIds,
  relationEdges,
  searchQuery,
}: {
  filteredGraphNodes: GraphNode[];
  filteredLinks: GraphLink[];
  onSelectNode: (node: Node | null) => void;
  onSelectTrait: (trait: TraitNode | null) => void;
  onHoverNode: (node: any) => void;
  hoveredNode: any;
  selectedNodeIds: Set<number>;
  relationEdges: RelationEdge[];
  searchQuery: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const simulationRef = useRef<d3.Simulation<any, any> | null>(null);
  const transformRef = useRef(d3.zoomIdentity);
  const zoomBehaviorRef = useRef<d3.ZoomBehavior<HTMLCanvasElement, unknown> | null>(null);
  const simNodesRef = useRef<any[]>([]);
  const simLinksRef = useRef<any[]>([]);
  const drawRef = useRef<() => void>(() => {});
  const searchQueryRef = useRef(searchQuery);
  searchQueryRef.current = searchQuery;
  const onSelectNodeRef = useRef(onSelectNode);
  const onSelectTraitRef = useRef(onSelectTrait);
  const selectedNodeIdsRef = useRef(selectedNodeIds);
  const relationEdgesRef = useRef(relationEdges);
  onSelectNodeRef.current = onSelectNode;
  onSelectTraitRef.current = onSelectTrait;
  selectedNodeIdsRef.current = selectedNodeIds;
  relationEdgesRef.current = relationEdges;

  useEffect(() => {
    if (!canvasRef.current || filteredGraphNodes.length === 0) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const container = canvas.parentElement;
    if (!container) return;
    const dpr = window.devicePixelRatio || 1;
    const width = container.clientWidth;
    const height = container.clientHeight;

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = width + "px";
    canvas.style.height = height + "px";
    ctx.scale(dpr, dpr);

    const simNodes = filteredGraphNodes.map((n) => ({
      ...n,
      x: width / 2 + (Math.random() - 0.5) * width * 0.8,
      y: height / 2 + (Math.random() - 0.5) * height * 0.8,
    }));
    const simNodeMap = new Map<string, any>();
    simNodes.forEach((n) => simNodeMap.set(n.id, n));

    const simLinks = filteredLinks
      .map((l) => ({
        ...l,
        source: simNodeMap.get(l.source),
        target: simNodeMap.get(l.target),
      }))
      .filter((l) => l.source && l.target);

    simNodesRef.current = simNodes;
    simLinksRef.current = simLinks;

    const charCount = simNodes.filter(n => n.isCharacter).length;
    const totalNodes = simNodes.length;
    const isLarge = charCount > 400;
    const nodeR = isLarge ? 4 : charCount > 100 ? 5 : 6;

    const nodeDegree = new Map<string, number>();
    for (const l of simLinks) {
      const sid = typeof l.source === "object" ? l.source.id : l.source;
      const tid = typeof l.target === "object" ? l.target.id : l.target;
      nodeDegree.set(sid, (nodeDegree.get(sid) || 0) + 1);
      nodeDegree.set(tid, (nodeDegree.get(tid) || 0) + 1);
    }

    // For each character, count total trait-overlaps with OTHER characters.
    // For each trait node connected to the character, count (other characters sharing that trait).
    // Sum gives the total number of shared-trait incidences across all of this deity's traits.
    const charSharedCount = new Map<string, number>();
    for (const l of simLinks) {
      const s = typeof l.source === "object" ? l.source : simNodeMap.get(l.source);
      const t = typeof l.target === "object" ? l.target : simNodeMap.get(l.target);
      if (!s || !t) continue;
      const charNode = s.isCharacter ? s : t.isCharacter ? t : null;
      const traitNode = s.isCharacter ? t : s;
      if (!charNode || traitNode.isCharacter) continue;
      const traitDeg = nodeDegree.get(traitNode.id) || 1;
      const others = Math.max(0, traitDeg - 1); // other characters sharing this trait
      charSharedCount.set(charNode.id, (charSharedCount.get(charNode.id) || 0) + others);
    }

    let maxCharShared = 1;
    for (const v of charSharedCount.values()) if (v > maxCharShared) maxCharShared = v;
    // Attach normalized weight (0..1) to each character node for use in rendering
    for (const n of simNodes) {
      if (n.isCharacter) {
        const c = charSharedCount.get(n.id) || 0;
        n._sharedCount = c;
        n._sharedNorm = c / maxCharShared;
      }
    }

    const viewArea = width * height;
    const targetDensity = 0.15;
    const nodeArea = totalNodes * Math.PI * nodeR * nodeR;
    const desiredSpread = Math.sqrt(nodeArea / targetDensity);
    const chargeStr = -(viewArea / totalNodes) * 0.15;
    const clampedCharge = Math.max(-300, Math.min(-30, chargeStr));

    const simulation = d3.forceSimulation(simNodes)
      .force("link", d3.forceLink(simLinks).id((d: any) => d.id).distance(60).strength((l: any) => {
        const sd = nodeDegree.get(typeof l.source === "object" ? l.source.id : l.source) || 1;
        const td = nodeDegree.get(typeof l.target === "object" ? l.target.id : l.target) || 1;
        return Math.min(0.2, Math.max(0.02, 1 / Math.max(sd, td)));
      }))
      .force("charge", d3.forceManyBody().strength(clampedCharge))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collision", d3.forceCollide().radius(nodeR + 1))
      .alphaDecay(0.03)
      .velocityDecay(0.4);

    simulation.stop();
    for (let i = 0; i < 300; i++) simulation.tick();

    simulationRef.current = simulation;

    let currentHovered: any = null;

    function draw() {
      ctx.save();
      ctx.clearRect(0, 0, width, height);

      const grad = ctx.createLinearGradient(0, 0, width, height);
      grad.addColorStop(0, "#0B0626");
      grad.addColorStop(1, "#0C0042");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);

      const t = transformRef.current;
      ctx.translate(t.x, t.y);
      ctx.scale(t.k, t.k);

      const hoveredId = currentHovered?.id;
      const selIds = selectedNodeIdsRef.current;
      const hasSelection = selIds.size > 0;
      const selectedSimIds = new Set<string>();
      if (hasSelection) {
        for (const n of simNodes) {
          if (n.isCharacter && n.original && selIds.has(n.original.id)) selectedSimIds.add(n.id);
        }
      }
      const activeId = hoveredId;
      const connectedIds = new Set<string>();
      if (activeId) {
        for (const l of simLinks) {
          if (l.source.id === activeId) connectedIds.add(l.target.id);
          if (l.target.id === activeId) connectedIds.add(l.source.id);
        }
      }
      if (hasSelection) {
        for (const l of simLinks) {
          if (selectedSimIds.has(l.source.id)) connectedIds.add(l.target.id);
          if (selectedSimIds.has(l.target.id)) connectedIds.add(l.source.id);
        }
      }

      for (const l of simLinks) {
        const isHighlighted = (activeId && (l.source.id === activeId || l.target.id === activeId)) ||
          (hasSelection && (selectedSimIds.has(l.source.id) || selectedSimIds.has(l.target.id)));
        const color = CATEGORY_COLORS[l.category] || "#350A8C";
        ctx.beginPath();
        ctx.moveTo(l.source.x, l.source.y);
        ctx.lineTo(l.target.x, l.target.y);
        ctx.strokeStyle = color;
        ctx.globalAlpha = isHighlighted ? 0.7 : (activeId || hasSelection) ? 0.03 : 0.15;
        ctx.lineWidth = isHighlighted ? 1.5 : 0.5;
        ctx.stroke();
      }

      const nodeMap = new Map<string, any>();
      for (const n of simNodes) nodeMap.set(n.id, n);
      for (const re of relationEdgesRef.current) {
        const sn = nodeMap.get(re.sourceId);
        const tn = nodeMap.get(re.targetId);
        if (!sn || !tn || sn.x == null || tn.x == null) continue;
        const relHighlighted = (activeId && (sn.id === activeId || tn.id === activeId)) ||
          (hasSelection && (selectedSimIds.has(sn.id) || selectedSimIds.has(tn.id)));
        ctx.beginPath();
        ctx.moveTo(sn.x, sn.y);
        ctx.lineTo(tn.x, tn.y);
        ctx.strokeStyle = RELATION_COLORS[re.relationType];
        ctx.globalAlpha = relHighlighted ? 0.85 : (activeId || hasSelection) ? 0.08 : 0.35;
        ctx.lineWidth = relHighlighted ? 3 : 1.5;
        ctx.stroke();
      }

      ctx.globalAlpha = 1;

      const baseR = nodeR;
      const anyActive = activeId || hasSelection;
      const searchQ = (searchQueryRef.current || "").trim().toLowerCase();
      for (const n of simNodes) {
        const isHovered = n.id === hoveredId;
        const isSelected = n.isCharacter && n.original && selIds.has(n.original.id);
        const isConnected = connectedIds.has(n.id);
        const isSearchMatch = !!searchQ && n.isCharacter && n.label.toLowerCase().includes(searchQ);
        const dimmed = anyActive && !isHovered && !isSelected && !isConnected && !selectedSimIds.has(n.id);

        if (n.isCharacter) {
          // Size character nodes by total shared-trait count with other deities.
          // Wider range + gentler curve (^0.7) makes differences clearly perceptible:
          // the least-connected figures stay small while the most-connected pop dramatically.
          const norm = n._sharedNorm || 0;
          const minR = baseR * 0.3;
          const maxR = baseR * 3.5;
          const sizedR = minR + Math.pow(norm, 0.7) * (maxR - minR);
          const r = isHovered ? sizedR + 4 : isSelected ? sizedR + 2 : isSearchMatch ? sizedR + 3 : sizedR;
          ctx.beginPath();
          ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
          ctx.fillStyle = isSearchMatch ? "#03FF9B" : "#E0DCE6";
          ctx.globalAlpha = isSearchMatch ? 1 : dimmed ? 0.08 : 0.85;
          ctx.fill();
          if (isSearchMatch) {
            ctx.strokeStyle = "#03FF9B";
            ctx.lineWidth = 3;
            ctx.globalAlpha = 1;
            ctx.shadowColor = "#03FF9B";
            ctx.shadowBlur = 18;
            ctx.stroke();
            ctx.shadowBlur = 0;
          } else if (isSelected) {
            ctx.strokeStyle = "#FFD700";
            ctx.lineWidth = 2;
            ctx.globalAlpha = 0.9;
            ctx.stroke();
          } else if (isHovered || isConnected) {
            ctx.strokeStyle = "#8F00FF";
            ctx.lineWidth = 1.5;
            ctx.globalAlpha = 0.6;
            ctx.stroke();
          }
        } else {
          const color = CATEGORY_COLORS[n.category] || "#350A8C";
          const r = isHovered ? 5 : (baseR > 4 ? 3 : 2);
          ctx.beginPath();
          ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
          ctx.fillStyle = color;
          ctx.globalAlpha = dimmed ? 0.05 : 0.5;
          ctx.fill();
        }
      }

      ctx.globalAlpha = 1;

      const showLabels = t.k > 0.6 || anyActive;
      // Always render labels for search-matched character nodes, even when zoomed out
      if (searchQ) {
        for (const n of simNodes) {
          if (!n.isCharacter) continue;
          if (!n.label.toLowerCase().includes(searchQ)) continue;
          ctx.font = "bold 13px 'Cinzel Decorative', serif";
          ctx.fillStyle = "#03FF9B";
          ctx.globalAlpha = 1;
          ctx.textAlign = "center";
          ctx.shadowColor = "#0B0626";
          ctx.shadowBlur = 6;
          ctx.fillText(n.label, n.x, n.y - 16);
          ctx.shadowBlur = 0;
        }
      }
      if (showLabels) {
        for (const n of simNodes) {
          const isHovered = n.id === hoveredId;
          const isActive = n.id === activeId;
          const isSelected = n.isCharacter && n.original && selIds.has(n.original.id);
          const isConnected = connectedIds.has(n.id);
          const isSearchMatch = !!searchQ && n.isCharacter && n.label.toLowerCase().includes(searchQ);
          if (isSearchMatch) continue; // already rendered above
          const dimmed = anyActive && !isHovered && !isActive && !isSelected && !isConnected;

          if (n.isCharacter) {
            if (dimmed && !isConnected && !isSelected) continue;
            ctx.font = (isHovered || isSelected || isActive) ? "bold 11px 'Cinzel Decorative', serif" : "9px 'Cinzel Decorative', serif";
            ctx.fillStyle = isSelected ? "#FFD700" : "#E0DCE6";
            ctx.globalAlpha = (isHovered || isSelected || isActive) ? 1 : isConnected ? 0.9 : (t.k > 1.5 ? 0.7 : 0.4);
            ctx.textAlign = "center";
            ctx.fillText(n.label, n.x, n.y - (isHovered || isSelected || isActive ? 14 : 10));
          } else if (isHovered || isConnected) {
            ctx.font = "8px 'Sofia Pro Light', sans-serif";
            ctx.fillStyle = CATEGORY_COLORS[n.category] || "#E0DCE6";
            ctx.globalAlpha = 0.8;
            ctx.textAlign = "center";
            ctx.fillText(n.label, n.x, n.y - 7);
          }
        }
      }

      ctx.globalAlpha = 1;
      ctx.restore();
    }

    drawRef.current = draw;
    draw();
    simulation.on("tick", draw);
    simulation.alpha(0.01).restart();

    const zoomBehavior = d3.zoom<HTMLCanvasElement, unknown>()
      .scaleExtent([0.1, 8])
      .on("zoom", (event) => {
        transformRef.current = event.transform;
        draw();
      });
    zoomBehaviorRef.current = zoomBehavior;

    d3.select(canvas).call(zoomBehavior);

    function getNodeAt(px: number, py: number) {
      const t = transformRef.current;
      const x = (px - t.x) / t.k;
      const y = (py - t.y) / t.k;
      for (let i = simNodes.length - 1; i >= 0; i--) {
        const n = simNodes[i];
        const r = n.isCharacter ? 8 : 5;
        const dx = x - n.x;
        const dy = y - n.y;
        if (dx * dx + dy * dy < r * r * 4) return n;
      }
      return null;
    }

    canvas.onmousemove = (e) => {
      const rect = canvas.getBoundingClientRect();
      const node = getNodeAt(e.clientX - rect.left, e.clientY - rect.top);
      currentHovered = node;
      onHoverNode(node);
      canvas.style.cursor = node ? "pointer" : "default";
      draw();
    };

    canvas.onclick = (e) => {
      const rect = canvas.getBoundingClientRect();
      const node = getNodeAt(e.clientX - rect.left, e.clientY - rect.top);
      if (node?.isCharacter && node.original) {
        onSelectNodeRef.current(node.original);
      } else if (node && !node.isCharacter) {
        onSelectTraitRef.current(node as unknown as TraitNode);
      }
    };

    canvas.onmouseleave = () => {
      currentHovered = null;
      onHoverNode(null);
      draw();
    };

    return () => {
      simulation.stop();
      canvas.onmousemove = null;
      canvas.onclick = null;
      canvas.onmouseleave = null;
    };
  }, [filteredGraphNodes, filteredLinks]);

  useEffect(() => {
    if (!canvasRef.current || simNodesRef.current.length === 0) return;
    const sim = simulationRef.current;
    if (sim) sim.alpha(0).restart();
  }, [selectedNodeIds, relationEdges]);

  // When search query changes, pan and zoom to the matched character node so the user
  // can actually see the figure they searched for. Wait for the simulation to settle
  // a moment so the matched node has a meaningful position before centering.
  useEffect(() => {
    const q = (searchQuery || "").trim().toLowerCase();
    if (!q) return;
    const canvas = canvasRef.current;
    const zoomBehavior = zoomBehaviorRef.current;
    if (!canvas || !zoomBehavior) return;

    const tryCenter = () => {
      const nodes = simNodesRef.current;
      if (!nodes || nodes.length === 0) return false;
      const matches = nodes.filter((n: any) => n.isCharacter && n.label.toLowerCase().includes(q));
      if (matches.length === 0) return false;
      // Pick the shortest label match (closest to exact)
      matches.sort((a: any, b: any) => a.label.length - b.label.length);
      const target = matches[0];
      if (target.x == null || target.y == null) return false;
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      const k = matches.length === 1 ? 2.2 : 1.6;
      const tx = width / 2 - target.x * k;
      const ty = height / 2 - target.y * k;
      const transform = d3.zoomIdentity.translate(tx, ty).scale(k);
      d3.select(canvas)
        .transition()
        .duration(750)
        .call(zoomBehavior.transform as any, transform);
      return true;
    };

    // Try immediately, then retry a couple of times while the force simulation settles
    if (tryCenter()) return;
    const t1 = setTimeout(() => { if (!tryCenter()) {} }, 300);
    const t2 = setTimeout(() => { tryCenter(); }, 900);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [searchQuery, filteredGraphNodes]);

  return <canvas ref={canvasRef} className="w-full h-full" />;
}

function DirectView({
  charNodes,
  directLinks,
  onSelectNode,
  onHoverNode,
  selectedNodeIds,
  relationEdges,
  focalNodeId,
}: {
  charNodes: CharNode[];
  directLinks: DirectLink[];
  onSelectNode: (node: Node | null) => void;
  onHoverNode: (node: any) => void;
  selectedNodeIds: Set<number>;
  relationEdges: RelationEdge[];
  focalNodeId?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawRef = useRef<(() => void) | null>(null);
  const selectedNodeIdsRef = useRef(selectedNodeIds);
  const relationEdgesRef = useRef(relationEdges);
  selectedNodeIdsRef.current = selectedNodeIds;
  relationEdgesRef.current = relationEdges;

  useEffect(() => {
    if (!canvasRef.current || charNodes.length === 0) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const container = canvas.parentElement;
    if (!container) return;
    const dpr = window.devicePixelRatio || 1;
    const width = container.clientWidth;
    const height = container.clientHeight;

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = width + "px";
    canvas.style.height = height + "px";
    ctx.scale(dpr, dpr);

    const egoMode = !!focalNodeId && charNodes.some(n => n.id === focalNodeId);
    const simNodes = charNodes.map((n) => ({
      ...n,
      x: 0,
      y: 0,
      z: 0,
    }));
    const simNodeMap = new Map<string, any>();
    simNodes.forEach((n) => simNodeMap.set(n.id, n));

    const maxWeight = Math.max(1, ...directLinks.map(l => l.weight));

    const simLinks = directLinks
      .map((l) => ({
        ...l,
        source: simNodeMap.get(l.source),
        target: simNodeMap.get(l.target),
      }))
      .filter((l) => l.source && l.target);

    const nodeCount = simNodes.length;

    if (egoMode) {
      // Radial layout: focal at center, neighbors on concentric rings sorted by weight then tradition
      const focal = simNodeMap.get(focalNodeId!);
      const neighbors = simNodes.filter(n => n.id !== focalNodeId);

      // Bucket neighbors by weight (closer ring = stronger connection)
      const weightByNeighbor = new Map<string, number>();
      for (const l of simLinks) {
        const otherId = l.source.id === focalNodeId ? l.target.id : l.source.id;
        weightByNeighbor.set(otherId, l.weight);
      }

      // Continuous starburst layout: all neighbors get a unique angle around 360°
      // Radius is a smooth function of shared-trait weight (stronger = closer to center)
      // Sort by tradition so neighbors of the same culture cluster together angularly
      const sorted = [...neighbors].sort((a, b) => {
        const tA = (a.tradition || "").localeCompare(b.tradition || "");
        if (tA !== 0) return tA;
        const wA = weightByNeighbor.get(a.id) || 0;
        const wB = weightByNeighbor.get(b.id) || 0;
        return wB - wA;
      });

      const totalNeighbors = sorted.length;
      const weights = sorted.map(n => weightByNeighbor.get(n.id) || 1);
      const maxW = Math.max(...weights, 1);
      const minW = Math.min(...weights, maxW);
      const wRange = Math.max(1, maxW - minW);

      const innerRadius = Math.min(width, height) * 0.10;
      const outerRadius = Math.min(width, height) * 0.45;

      focal.x = 0; focal.y = 0; focal.z = 0;
      focal._weight = maxW;

      sorted.forEach((n, i) => {
        const w = weightByNeighbor.get(n.id) || 1;
        // Normalize: 1 for strongest, 0 for weakest
        const norm = (w - minW) / wRange;
        // Apply gentle curve so the strongest cluster doesn't pile up at the very center
        const t = Math.pow(1 - norm, 0.85);
        const radius = innerRadius + t * (outerRadius - innerRadius);
        const angle = (i / totalNeighbors) * Math.PI * 2;
        n.x = Math.cos(angle) * radius;
        n.y = Math.sin(angle) * radius;
        n.z = 0;
        n._angle = angle;
        n._weight = w;
      });
    } else {
      // Legacy 3D force-directed layout (used when no focal selected — kept for backwards compatibility)
      const spread = Math.min(width, height) * (nodeCount > 500 ? 0.6 : nodeCount > 200 ? 0.45 : 0.3);
      for (const n of simNodes) {
        n.x = (Math.random() - 0.5) * spread;
        n.y = (Math.random() - 0.5) * spread;
        n.z = (Math.random() - 0.5) * spread;
      }
      const baseDist = nodeCount > 500 ? 40 : nodeCount > 200 ? 50 : nodeCount > 100 ? 60 : nodeCount > 50 ? 90 : 120;
      const repulseStrength = nodeCount > 500 ? -200 : nodeCount > 200 ? -150 : nodeCount > 100 ? -80 : nodeCount > 50 ? -150 : -250;
      const iterations = nodeCount > 500 ? 300 : nodeCount > 200 ? 400 : 500;

      for (let iter = 0; iter < iterations; iter++) {
        const alpha = Math.max(0.001, 1 - iter / iterations);
        for (let i = 0; i < simNodes.length; i++) {
          for (let j = i + 1; j < simNodes.length; j++) {
            const a = simNodes[i], b = simNodes[j];
            let dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z;
            let dist = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;
            const repulse = repulseStrength * alpha / (dist * dist);
            const fx = dx / dist * repulse;
            const fy = dy / dist * repulse;
            const fz = dz / dist * repulse;
            a.x += fx; a.y += fy; a.z += fz;
            b.x -= fx; b.y -= fy; b.z -= fz;
          }
        }
        for (const l of simLinks) {
          const a = l.source, b = l.target;
          let dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z;
          let dist = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;
          const norm = l.weight / maxWeight;
          const targetDist = baseDist * (1 - norm * 0.85);
          const strength = (0.05 + norm * norm * 0.9) * alpha;
          const delta = (dist - targetDist) * strength * 0.5;
          const ux = dx / dist, uy = dy / dist, uz = dz / dist;
          a.x += ux * delta; a.y += uy * delta; a.z += uz * delta;
          b.x -= ux * delta; b.y -= uy * delta; b.z -= uz * delta;
        }
        for (const n of simNodes) {
          n.x *= 0.998; n.y *= 0.998; n.z *= 0.998;
        }
      }
    }

    let rotX = egoMode ? 0 : -0.3, rotY = egoMode ? 0 : 0.5;
    let panX = 0, panY = 0;
    let zoom = 1;
    let isDragging = false;
    let lastMx = 0, lastMy = 0;
    let currentHovered: { node: any; sx: number; sy: number } | null = null;
    let hoveredEdge: { link: any; sx: number; sy: number } | null = null;
    let pinnedEdge: { link: any; sx: number; sy: number } | null = null;

    function project(x3: number, y3: number, z3: number) {
      if (egoMode) {
        return {
          sx: width / 2 + panX + x3 * zoom,
          sy: height / 2 + panY + y3 * zoom,
          z: 0,
          scale: zoom,
        };
      }
      const cosX = Math.cos(rotX), sinX = Math.sin(rotX);
      const cosY = Math.cos(rotY), sinY = Math.sin(rotY);
      let y1 = y3 * cosX - z3 * sinX;
      let z1 = y3 * sinX + z3 * cosX;
      let x1 = x3 * cosY + z1 * sinY;
      let z2 = -x3 * sinY + z1 * cosY;
      const perspective = 800;
      const scale = perspective / (perspective + z2) * zoom;
      return {
        sx: width / 2 + x1 * scale,
        sy: height / 2 + y1 * scale,
        z: z2,
        scale,
      };
    }

    function draw() {
      ctx.save();
      ctx.clearRect(0, 0, width, height);

      const grad = ctx.createLinearGradient(0, 0, width, height);
      grad.addColorStop(0, "#0B0626");
      grad.addColorStop(1, "#0C0042");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);

      const selIds = selectedNodeIdsRef.current;
      const hasSelection = selIds.size > 0;
      const selectedSimIds = new Set<string>();
      if (hasSelection) {
        for (const n of simNodes) {
          if (n.original && selIds.has(n.original.id)) selectedSimIds.add(n.id);
        }
      }

      const hoveredId = currentHovered?.node?.id;
      const connectedIds = new Set<string>();
      if (hoveredId) {
        for (const l of simLinks) {
          if (l.source.id === hoveredId || l.target.id === hoveredId) {
            connectedIds.add(l.source.id);
            connectedIds.add(l.target.id);
          }
        }
      }
      if (hasSelection) {
        for (const l of simLinks) {
          if (selectedSimIds.has(l.source.id)) connectedIds.add(l.target.id);
          if (selectedSimIds.has(l.target.id)) connectedIds.add(l.source.id);
        }
      }
      const anyActive = hoveredId || hasSelection;

      let visibleMinW = Infinity, visibleMaxW = 0;
      for (const l of simLinks) {
        const isVis = !anyActive ||
          (hoveredId && (l.source.id === hoveredId || l.target.id === hoveredId)) ||
          (hasSelection && (selectedSimIds.has(l.source.id) || selectedSimIds.has(l.target.id)));
        if (isVis) {
          if (l.weight < visibleMinW) visibleMinW = l.weight;
          if (l.weight > visibleMaxW) visibleMaxW = l.weight;
        }
      }
      if (visibleMinW === Infinity) visibleMinW = 0;
      const wRange = visibleMaxW - visibleMinW || 1;

      function weightToColor(w: number): string {
        const t2 = (w - visibleMinW) / wRange;
        const r = Math.round(143 * (1 - t2) + 3 * t2);
        const g = Math.round(0 * (1 - t2) + 255 * t2);
        const b = Math.round(255 * (1 - t2) + 155 * t2);
        return `rgb(${r},${g},${b})`;
      }

      const projectedNodes = simNodes.map(n => {
        const p = project(n.x, n.y, n.z);
        return { ...p, node: n };
      });
      const nodeScreenMap = new Map<string, { sx: number; sy: number; z: number; scale: number }>();
      for (const pn of projectedNodes) {
        nodeScreenMap.set(pn.node.id, pn);
      }

      for (const l of simLinks) {
        const sp = nodeScreenMap.get(l.source.id);
        const tp = nodeScreenMap.get(l.target.id);
        if (!sp || !tp) continue;
        const isHighlighted = (hoveredId && (l.source.id === hoveredId || l.target.id === hoveredId)) ||
          (hasSelection && (selectedSimIds.has(l.source.id) || selectedSimIds.has(l.target.id)));
        const isEdgeActive = (hoveredEdge?.link === l || pinnedEdge?.link === l);
        const normalizedWeight = l.weight / maxWeight;
        ctx.beginPath();
        ctx.moveTo(sp.sx, sp.sy);
        ctx.lineTo(tp.sx, tp.sy);
        // In ego mode use a uniform muted color (size encodes strength on nodes); otherwise color by weight
        ctx.strokeStyle = egoMode ? "#8F00FF" : weightToColor(l.weight);
        if (isEdgeActive) {
          ctx.globalAlpha = 0.9;
          ctx.lineWidth = 3;
        } else if (egoMode) {
          ctx.globalAlpha = isHighlighted ? 0.85 : anyActive ? 0.05 : 0.42;
          ctx.lineWidth = isHighlighted ? 1.5 : 0.4;
        } else {
          ctx.globalAlpha = isHighlighted ? 0.4 + normalizedWeight * 0.4 : anyActive ? 0.02 : 0.04 + normalizedWeight * 0.12;
          ctx.lineWidth = isHighlighted ? 0.8 + normalizedWeight * 2.5 : 0.2 + normalizedWeight * 1.2;
        }
        ctx.stroke();
      }

      for (const re of relationEdgesRef.current) {
        const sp = nodeScreenMap.get(re.sourceId);
        const tp = nodeScreenMap.get(re.targetId);
        if (!sp || !tp) continue;
        const relHighlighted = (hoveredId && (re.sourceId === hoveredId || re.targetId === hoveredId)) ||
          (hasSelection && (selectedSimIds.has(re.sourceId) || selectedSimIds.has(re.targetId)));
        ctx.beginPath();
        ctx.moveTo(sp.sx, sp.sy);
        ctx.lineTo(tp.sx, tp.sy);
        ctx.strokeStyle = RELATION_COLORS[re.relationType];
        ctx.globalAlpha = relHighlighted ? 0.85 : anyActive ? 0.08 : 0.35;
        ctx.lineWidth = relHighlighted ? 3.5 : 2;
        ctx.stroke();
      }

      projectedNodes.sort((a, b) => b.z - a.z);

      // For ego mode: max weight to scale node sizes
      const maxNeighborWeight = egoMode ? Math.max(1, ...simNodes.filter(n => n.id !== focalNodeId).map(n => n._weight || 1)) : 1;

      for (const pn of projectedNodes) {
        const n = pn.node;
        const isHovered = n.id === hoveredId;
        const isSelected = n.original && selIds.has(n.original.id);
        const isConnected = connectedIds.has(n.id);
        const dimmed = anyActive && !isHovered && !isSelected && !isConnected;
        const isFocal = egoMode && n.id === focalNodeId;

        let baseR: number;
        if (isFocal) {
          baseR = 7;
        } else if (egoMode) {
          // Small uniform dots — ring distance encodes strength; edges create the starburst
          baseR = nodeCount > 300 ? 1.8 : nodeCount > 100 ? 2.5 : 3;
        } else {
          baseR = (nodeCount > 500 ? 1.5 : nodeCount > 200 ? 2 : 3) + pn.scale * (nodeCount > 500 ? 2 : 3);
        }
        const r = isHovered ? baseR + 3 : isSelected ? baseR + 2 : baseR;
        ctx.beginPath();
        ctx.arc(pn.sx, pn.sy, r, 0, Math.PI * 2);
        ctx.fillStyle = "#E0DCE6";
        ctx.globalAlpha = dimmed ? 0.06 : 0.85;
        ctx.fill();
        if (isSelected) {
          ctx.strokeStyle = "#FFD700";
          ctx.lineWidth = 2;
          ctx.globalAlpha = 0.9;
          ctx.stroke();
        } else if (isHovered || isConnected) {
          ctx.strokeStyle = isHovered ? "#03FF9B" : "#8F00FF";
          ctx.lineWidth = isHovered ? 2 : 1.5;
          ctx.globalAlpha = 0.7;
          ctx.stroke();
        }

        // In ego mode with many neighbors, only label the top (by weight). Always label hovered/selected/focal.
        let shouldLabel = !dimmed || isSelected;
        if (egoMode && !isFocal && !isHovered && !isSelected) {
          const w = n._weight || 1;
          const norm = w / maxNeighborWeight;
          // Show labels for nodes whose weight is at least 30% of max, or top tier
          shouldLabel = norm >= 0.3 || (nodeCount <= 80);
        }

        if (shouldLabel) {
          const labelSize = isFocal ? 14 : nodeCount > 500 ? Math.max(5, 7 * pn.scale) : Math.max(7, 10 * pn.scale);
          ctx.font = (isHovered || isSelected || isFocal) ? `bold ${isFocal ? 14 : 11}px 'Cinzel Decorative', serif` : `${labelSize}px 'Cinzel Decorative', serif`;
          ctx.fillStyle = isFocal ? "#03FF9B" : isSelected ? "#FFD700" : "#E0DCE6";
          ctx.globalAlpha = (isHovered || isSelected || isFocal) ? 1 : isConnected ? 0.95 : 0.85;

          if (egoMode && !isFocal && n._angle !== undefined) {
            // Place label radially outward from center to avoid overlap with rings
            const angle = n._angle as number;
            const labelOffset = r + 10;
            const lx = pn.sx + Math.cos(angle) * labelOffset;
            const ly = pn.sy + Math.sin(angle) * labelOffset;
            // Anchor based on angle: right half = left-anchor, left half = right-anchor
            const cosA = Math.cos(angle);
            ctx.textAlign = cosA > 0.3 ? "left" : cosA < -0.3 ? "right" : "center";
            ctx.textBaseline = "middle";
            ctx.fillText(n.label, lx, ly);
            ctx.textBaseline = "alphabetic";
          } else {
            ctx.textAlign = "center";
            ctx.fillText(n.label, pn.sx, pn.sy - r - 6);
          }
        }
      }

      const activeEdge = pinnedEdge || hoveredEdge;
      if (activeEdge && !currentHovered) {
        const al = activeEdge.link;
        const sp2 = nodeScreenMap.get(al.source.id);
        const tp2 = nodeScreenMap.get(al.target.id);
        if (sp2 && tp2) {
          const midSx = (sp2.sx + tp2.sx) / 2;
          const midSy = (sp2.sy + tp2.sy) / 2;
          const eColor = weightToColor(al.weight);
          const srcName = al.source.label || "?";
          const tgtName = al.target.label || "?";
          const srcTrad = (al.source.tradition || "").trim();
          const tgtTrad = (al.target.tradition || "").trim();
          const traits: string[] = al.commonTraits || [];
          const titleText = `${srcName}  ↔  ${tgtName}`;
          const traditionText = (srcTrad || tgtTrad) ? `${srcTrad || "—"}  ·  ${tgtTrad || "—"}` : "";
          const subtitleText = `${traits.length} shared trait${traits.length !== 1 ? "s" : ""}`;

          ctx.font = "bold 11px 'Cinzel Decorative', serif";
          const titleW = ctx.measureText(titleText).width;
          ctx.font = "italic 9px 'Sofia Pro Light', sans-serif";
          const tradW = traditionText ? ctx.measureText(traditionText).width : 0;
          ctx.font = "10px 'Sofia Pro Light', sans-serif";
          const subtitleW = ctx.measureText(subtitleText).width;
          const traitWidths = traits.map((tr: string) => ctx.measureText(`• ${tr}`).width);
          const maxTraitW = traitWidths.length > 0 ? Math.max(...traitWidths) : 0;
          const boxW = Math.max(titleW, tradW, subtitleW, maxTraitW) + 28;
          const lineH = 15;
          const displayCount = Math.min(traits.length, 15);
          const tradLineH = traditionText ? 12 : 0;
          const boxH = 38 + tradLineH + lineH + displayCount * lineH + (traits.length > 15 ? lineH : 0);
          let bx = midSx - boxW / 2;
          let by = midSy - boxH - 12;
          if (bx < 4) bx = 4;
          if (bx + boxW > width - 4) bx = width - boxW - 4;
          if (by < 4) by = midSy + 12;

          ctx.globalAlpha = 0.93;
          ctx.fillStyle = "#0B0626";
          ctx.strokeStyle = "#350A8C";
          ctx.lineWidth = 1;
          const cr2 = 6;
          ctx.beginPath();
          ctx.moveTo(bx + cr2, by);
          ctx.lineTo(bx + boxW - cr2, by);
          ctx.quadraticCurveTo(bx + boxW, by, bx + boxW, by + cr2);
          ctx.lineTo(bx + boxW, by + boxH - cr2);
          ctx.quadraticCurveTo(bx + boxW, by + boxH, bx + boxW - cr2, by + boxH);
          ctx.lineTo(bx + cr2, by + boxH);
          ctx.quadraticCurveTo(bx, by + boxH, bx, by + boxH - cr2);
          ctx.lineTo(bx, by + cr2);
          ctx.quadraticCurveTo(bx, by, bx + cr2, by);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();

          ctx.globalAlpha = 1;
          let ty = by + 18;
          ctx.font = "bold 11px 'Cinzel Decorative', serif";
          ctx.fillStyle = "#FFD700";
          ctx.textAlign = "center";
          ctx.fillText(titleText, bx + boxW / 2, ty);
          ty += 14;
          if (traditionText) {
            ctx.font = "italic 9px 'Sofia Pro Light', sans-serif";
            ctx.fillStyle = "#E0DCE6";
            ctx.globalAlpha = 0.55;
            ctx.fillText(traditionText, bx + boxW / 2, ty);
            ctx.globalAlpha = 1;
            ty += 12;
          }
          ctx.font = "10px 'Sofia Pro Light', sans-serif";
          ctx.fillStyle = eColor;
          ctx.fillText(subtitleText, bx + boxW / 2, ty);
          ty += 14;

          ctx.textAlign = "left";
          ctx.fillStyle = "#E0DCE6";
          ctx.font = "9px 'Sofia Pro Light', sans-serif";
          for (let i = 0; i < displayCount; i++) {
            ty += lineH;
            ctx.globalAlpha = 0.8;
            ctx.fillText(`• ${traits[i]}`, bx + 12, ty);
          }
          if (traits.length > 15) {
            ty += lineH;
            ctx.globalAlpha = 0.5;
            ctx.fillText(`  +${traits.length - 15} more...`, bx + 12, ty);
          }
        }
      }

      ctx.globalAlpha = 1;
      ctx.restore();
    }

    drawRef.current = draw;
    draw();

    function getNodeAt(px: number, py: number) {
      const projectedNodes = simNodes.map(n => {
        const p = project(n.x, n.y, n.z);
        return { ...p, node: n };
      });
      projectedNodes.sort((a, b) => a.z - b.z);
      for (const pn of projectedNodes) {
        const dx = px - pn.sx;
        const dy = py - pn.sy;
        const r = 3 + pn.scale * 3 + 4;
        if (dx * dx + dy * dy < r * r) return pn;
      }
      return null;
    }

    function getEdgeAt(px2: number, py2: number) {
      const threshold = 8;
      let bestDist = threshold;
      let bestLink: any = null;
      let bestMidSx = 0, bestMidSy = 0;
      for (const l of simLinks) {
        const sp = project(l.source.x, l.source.y, l.source.z);
        const tp = project(l.target.x, l.target.y, l.target.z);
        const ax = sp.sx, ay = sp.sy;
        const bx2 = tp.sx, by2 = tp.sy;
        const dx = bx2 - ax, dy = by2 - ay;
        const lenSq = dx * dx + dy * dy;
        if (lenSq === 0) continue;
        let t2 = ((px2 - ax) * dx + (py2 - ay) * dy) / lenSq;
        t2 = Math.max(0, Math.min(1, t2));
        const cx = ax + t2 * dx;
        const cy = ay + t2 * dy;
        const dist = Math.sqrt((px2 - cx) * (px2 - cx) + (py2 - cy) * (py2 - cy));
        if (dist < bestDist) {
          bestDist = dist;
          bestLink = l;
          bestMidSx = (ax + bx2) / 2;
          bestMidSy = (ay + by2) / 2;
        }
      }
      return bestLink ? { link: bestLink, sx: bestMidSx, sy: bestMidSy } : null;
    }

    canvas.onmousedown = (e) => {
      if (e.button === 0) {
        isDragging = true;
        lastMx = e.clientX;
        lastMy = e.clientY;
        canvas.style.cursor = "grabbing";
      }
    };

    canvas.onmousemove = (e) => {
      if (isDragging) {
        const dx = e.clientX - lastMx;
        const dy = e.clientY - lastMy;
        if (egoMode) {
          panX += dx;
          panY += dy;
        } else {
          rotY += dx * 0.005;
          rotX += dy * 0.005;
          rotX = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, rotX));
        }
        lastMx = e.clientX;
        lastMy = e.clientY;
        draw();
        return;
      }

      const rect = canvas.getBoundingClientRect();
      const px = e.clientX - rect.left;
      const py = e.clientY - rect.top;
      const nodeHit = getNodeAt(px, py);
      if (nodeHit) {
        currentHovered = nodeHit;
        hoveredEdge = null;
        onHoverNode(nodeHit.node);
        canvas.style.cursor = "pointer";
      } else {
        currentHovered = null;
        const edgeHit = getEdgeAt(px, py);
        hoveredEdge = edgeHit;
        onHoverNode(null);
        canvas.style.cursor = edgeHit ? "pointer" : "grab";
      }
      draw();
    };

    canvas.onmouseup = () => {
      isDragging = false;
      canvas.style.cursor = "grab";
    };

    canvas.onclick = (e) => {
      const rect = canvas.getBoundingClientRect();
      const px = e.clientX - rect.left;
      const py = e.clientY - rect.top;
      const nodeHit = getNodeAt(px, py);
      if (nodeHit?.node?.original) {
        pinnedEdge = null;
        onSelectNode(nodeHit.node.original);
      } else {
        const edgeHit = getEdgeAt(px, py);
        if (edgeHit) {
          pinnedEdge = pinnedEdge?.link === edgeHit.link ? null : edgeHit;
        } else {
          pinnedEdge = null;
        }
      }
      draw();
    };

    canvas.onwheel = (e) => {
      e.preventDefault();
      zoom *= e.deltaY > 0 ? 0.93 : 1.07;
      zoom = Math.max(egoMode ? 0.05 : 0.3, Math.min(5, zoom));
      draw();
    };

    canvas.onmouseleave = () => {
      isDragging = false;
      currentHovered = null;
      hoveredEdge = null;
      onHoverNode(null);
      draw();
    };

    canvas.style.cursor = "grab";

    return () => {
      canvas.onmousedown = null;
      canvas.onmousemove = null;
      canvas.onmouseup = null;
      canvas.onclick = null;
      canvas.onwheel = null;
      canvas.onmouseleave = null;
      drawRef.current = null;
    };
  }, [charNodes, directLinks]);

  useEffect(() => {
    if (drawRef.current) drawRef.current();
  }, [selectedNodeIds, relationEdges]);

  return <canvas ref={canvasRef} className="w-full h-full" />;
}

function d4ColorMap(t: number): string {
  const clamped = Math.max(0, Math.min(1, t));
  if (clamped < 0.25) {
    const f = clamped / 0.25;
    const r = Math.round(143 * (1 - f) + 3 * f);
    const g = Math.round(0 * (1 - f) + 255 * f);
    const b = Math.round(255 * (1 - f) + 155 * f);
    return `rgb(${r},${g},${b})`;
  } else if (clamped < 0.5) {
    const f = (clamped - 0.25) / 0.25;
    const r = Math.round(3 * (1 - f) + 224 * f);
    const g = Math.round(255 * (1 - f) + 220 * f);
    const b = Math.round(155 * (1 - f) + 230 * f);
    return `rgb(${r},${g},${b})`;
  } else if (clamped < 0.75) {
    const f = (clamped - 0.5) / 0.25;
    const r = Math.round(224 * (1 - f) + 255 * f);
    const g = Math.round(220 * (1 - f) + 184 * f);
    const b = Math.round(230 * (1 - f) + 0 * f);
    return `rgb(${r},${g},${b})`;
  } else {
    const f = (clamped - 0.75) / 0.25;
    const r = Math.round(255 * (1 - f) + 229 * f);
    const g = Math.round(184 * (1 - f) + 57 * f);
    const b = Math.round(0 * (1 - f) + 53 * f);
    return `rgb(${r},${g},${b})`;
  }
}


function FCAView({
  figures,
  onSelectNode,
  onHoverNode,
  selectedNodeIds,
  useSupersets,
  enabledCategories,
  minSupport,
  maxConcepts,
  onStatsComputed,
}: {
  figures: Node[];
  onSelectNode: (node: Node | null) => void;
  onHoverNode: (node: any) => void;
  selectedNodeIds: Set<number>;
  useSupersets?: Set<string>;
  enabledCategories?: Set<string>;
  minSupport: number;
  maxConcepts: number;
  onStatsComputed?: (stats: { total: number; shown: number; layers: number }) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const selectedNodeIdsRef = useRef(selectedNodeIds);
  selectedNodeIdsRef.current = selectedNodeIds;
  const [computing, setComputing] = useState(true);

  type Concept = {
    extent: number[];          // figure indices (sorted)
    intent: string[];          // trait keys
    extentKey: string;
    layer: number;             // intent size
    x: number; y: number;
    dominantCategory: string;  // most common trait category in intent
    categoryMix: { category: string; count: number }[]; // sorted desc
  };
  const [concepts, setConcepts] = useState<Concept[]>([]);
  const [usableFigures, setUsableFigures] = useState<Node[]>([]);
  const [hasseEdges, setHasseEdges] = useState<{ a: number; b: number }[]>([]);

  useEffect(() => {
    let cancelled = false;
    setComputing(true);
    const handle = setTimeout(() => {
      if (cancelled) return;

      const usable = figures.filter(f => getTraitsForFigure(f, enabledCategories, useSupersets).length > 0);
      if (usable.length < 4) {
        setConcepts([]); setUsableFigures([]); setHasseEdges([]);
        onStatsComputed?.({ total: 0, shown: 0, layers: 0 });
        setComputing(false); return;
      }
      const n = usable.length;
      const traitArr = usable.map(f => getTraitsForFigure(f, enabledCategories, useSupersets));
      const traitSet = traitArr.map(a => new Set(a));

      // Trait frequencies
      const freq = new Map<string, number>();
      traitArr.forEach(arr => arr.forEach(t => freq.set(t, (freq.get(t) || 0) + 1)));

      // Keep traits in [minSupport, n-1]
      const traits = [...freq.entries()]
        .filter(([_, c]) => c >= minSupport && c < n)
        .map(([t]) => t);
      if (traits.length === 0) {
        setConcepts([]); setUsableFigures(usable); setHasseEdges([]);
        onStatsComputed?.({ total: 0, shown: 0, layers: 0 });
        setComputing(false); return;
      }

      // Extent of a trait
      const traitExt = new Map<string, number[]>();
      for (const t of traits) {
        const ext: number[] = [];
        for (let i = 0; i < n; i++) if (traitSet[i].has(t)) ext.push(i);
        traitExt.set(t, ext);
      }

      // Closure: intent of an extent = traits shared by ALL figures in extent
      function closure(ext: number[]): string[] {
        if (ext.length === 0) return traits.slice();
        const first = traitSet[ext[0]];
        const cand: string[] = [];
        first.forEach(t => { if (freq.get(t)! < n) cand.push(t); }); // skip universal
        const result: string[] = [];
        for (const t of cand) {
          let ok = true;
          for (let k = 1; k < ext.length; k++) {
            if (!traitSet[ext[k]].has(t)) { ok = false; break; }
          }
          if (ok) result.push(t);
        }
        return result.sort();
      }

      function extentKey(ext: number[]): string {
        return ext.join(",");
      }

      const seen = new Map<string, Concept>();

      function makeConcept(ext: number[], intent: string[], key: string): Concept {
        const catCount = new Map<string, number>();
        for (const t of intent) {
          const cat = t.split("::")[0];
          catCount.set(cat, (catCount.get(cat) || 0) + 1);
        }
        const mix = [...catCount.entries()]
          .map(([category, count]) => ({ category, count }))
          .sort((a, b) => b.count - a.count);
        const dominantCategory = mix[0]?.category || "";
        return { extent: ext, intent, extentKey: key, layer: intent.length, x: 0, y: 0, dominantCategory, categoryMix: mix };
      }

      // Top concept (universe)
      const universe = Array.from({ length: n }, (_, i) => i);
      const topInt = closure(universe);
      seen.set(extentKey(universe), makeConcept(universe, topInt, extentKey(universe)));

      // Seed: singleton concepts for each kept trait
      for (const t of traits) {
        const ext = traitExt.get(t)!;
        if (ext.length < minSupport) continue;
        const key = extentKey(ext);
        if (seen.has(key)) continue;
        const intent = closure(ext);
        seen.set(key, makeConcept(ext, intent, key));
      }

      // Pairwise intersections (one round)
      const seedConcepts = [...seen.values()];
      const MAX_GENERATED = Math.max(maxConcepts * 6, 400);
      outer: for (let i = 0; i < seedConcepts.length; i++) {
        const ai = seedConcepts[i];
        for (let j = i + 1; j < seedConcepts.length; j++) {
          if (seen.size >= MAX_GENERATED) break outer;
          const bj = seedConcepts[j];
          // Intersection of sorted arrays
          const a = ai.extent, b = bj.extent;
          const inter: number[] = [];
          let p = 0, q = 0;
          while (p < a.length && q < b.length) {
            if (a[p] === b[q]) { inter.push(a[p]); p++; q++; }
            else if (a[p] < b[q]) p++; else q++;
          }
          if (inter.length < minSupport) continue;
          const key = extentKey(inter);
          if (seen.has(key)) continue;
          const intent = closure(inter);
          seen.set(key, makeConcept(inter, intent, key));
        }
      }

      // Pick top-N concepts by support (extent size), tie-break by intent size descending
      let all = [...seen.values()].sort((a, b) =>
        (b.extent.length - a.extent.length) || (b.intent.length - a.intent.length)
      );
      // Drop the bottom-most extent=0 if any slipped in
      all = all.filter(c => c.extent.length >= minSupport || c.extent.length === n);
      const picked = all.slice(0, maxConcepts);

      // Build subset relation: a ≤ b iff a.extent ⊆ b.extent (i.e., a more specific via intent superset)
      // Then transitive reduction → Hasse covering edges
      const M = picked.length;
      const subsetOf: number[][] = picked.map(() => []); // subsetOf[i] = indices j s.t. picked[i].ext ⊂ picked[j].ext (strict)
      const extSets = picked.map(c => new Set(c.extent));
      for (let i = 0; i < M; i++) {
        for (let j = 0; j < M; j++) {
          if (i === j) continue;
          if (picked[i].extent.length >= picked[j].extent.length) continue;
          // is picked[i].extent strict subset of picked[j].extent?
          let ok = true;
          for (const x of picked[i].extent) if (!extSets[j].has(x)) { ok = false; break; }
          if (ok) subsetOf[i].push(j);
        }
      }
      // Transitive reduction: keep only direct covers
      const edges: { a: number; b: number }[] = [];
      for (let i = 0; i < M; i++) {
        const supers = subsetOf[i];
        for (const j of supers) {
          let isCover = true;
          for (const k of supers) {
            if (k === j) continue;
            // if picked[k].extent ⊂ picked[j].extent then j is not direct cover of i
            if (picked[k].extent.length < picked[j].extent.length) {
              let ok = true;
              for (const x of picked[k].extent) if (!extSets[j].has(x)) { ok = false; break; }
              if (ok) { isCover = false; break; }
            }
          }
          if (isCover) edges.push({ a: i, b: j });
        }
      }

      // Layered layout by intent size; group identical layers, sort within layer by extent size desc
      const layers = new Map<number, number[]>();
      picked.forEach((c, i) => {
        if (!layers.has(c.layer)) layers.set(c.layer, []);
        layers.get(c.layer)!.push(i);
      });
      const sortedLayers = [...layers.keys()].sort((a, b) => a - b);
      sortedLayers.forEach(layerKey => {
        const ids = layers.get(layerKey)!;
        ids.sort((a, b) => picked[b].extent.length - picked[a].extent.length);
        const w = ids.length;
        ids.forEach((id, k) => {
          picked[id].x = (k + 1) / (w + 1); // 0..1
          picked[id].y = sortedLayers.indexOf(layerKey) / Math.max(1, sortedLayers.length - 1);
        });
      });

      if (cancelled) return;
      setUsableFigures(usable);
      setConcepts(picked);
      setHasseEdges(edges);
      onStatsComputed?.({ total: seen.size, shown: M, layers: sortedLayers.length });
      setComputing(false);
    }, 30);
    return () => { cancelled = true; clearTimeout(handle); };
  }, [figures, useSupersets, enabledCategories, minSupport, maxConcepts]);

  // Render
  useEffect(() => {
    if (!canvasRef.current || concepts.length === 0) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const container = canvas.parentElement;
    if (!container) return;

    const dpr = window.devicePixelRatio || 1;
    const W = container.clientWidth;
    const H = container.clientHeight;
    canvas.width = W * dpr; canvas.height = H * dpr;
    canvas.style.width = W + "px"; canvas.style.height = H + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const padX = 70, padY = 70;
    let zoom = 1, panX = 0, panY = 0;
    let isDragging = false, lastMx = 0, lastMy = 0, didDrag = false;
    let hovered: number | null = null;

    // Pre-compute ancestor/descendant sets for hover ripple highlighting
    const childrenOf: Set<number>[] = concepts.map(() => new Set());
    const parentsOf: Set<number>[] = concepts.map(() => new Set());
    for (const e of hasseEdges) {
      // edge a -> b means a's extent ⊂ b's extent (b is more general / parent in the lattice)
      parentsOf[e.a].add(e.b);
      childrenOf[e.b].add(e.a);
    }
    function ancestorsOf(i: number): Set<number> {
      const out = new Set<number>(); const stack = [...parentsOf[i]];
      while (stack.length) { const x = stack.pop()!; if (!out.has(x)) { out.add(x); parentsOf[x].forEach(p => stack.push(p)); } }
      return out;
    }
    function descendantsOf(i: number): Set<number> {
      const out = new Set<number>(); const stack = [...childrenOf[i]];
      while (stack.length) { const x = stack.pop()!; if (!out.has(x)) { out.add(x); childrenOf[x].forEach(p => stack.push(p)); } }
      return out;
    }

    // Twinkly background stars (deterministic per render)
    const STAR_COUNT = 60;
    const stars: { x: number; y: number; r: number; a: number }[] = [];
    let seed = 1337;
    const rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
    for (let i = 0; i < STAR_COUNT; i++) {
      stars.push({ x: rnd() * W, y: rnd() * H, r: rnd() * 1.2 + 0.3, a: rnd() * 0.5 + 0.1 });
    }

    function project(c: { x: number; y: number }) {
      const baseX = padX + c.x * (W - padX * 2);
      const baseY = padY + c.y * (H - padY * 2);
      return {
        sx: W / 2 + (baseX - W / 2) * zoom + panX,
        sy: H / 2 + (baseY - H / 2) * zoom + panY,
      };
    }

    function nodeRadius(c: typeof concepts[0]) {
      return Math.max(5, Math.min(28, 5 + Math.log10(c.extent.length + 1) * 6)) * Math.min(2, Math.max(0.7, zoom * 0.85));
    }
    function colorFor(c: typeof concepts[0]) {
      return CATEGORY_COLORS[c.dominantCategory] || "#8F00FF";
    }
    function hexToRgba(hex: string, a: number) {
      const h = hex.replace("#", "");
      const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
      return `rgba(${r},${g},${b},${a})`;
    }

    const selIds = selectedNodeIdsRef.current;
    const isUniverse = (c: typeof concepts[0]) => c.intent.length === 0 || c.extent.length === usableFigures.length;

    function draw() {
      // Background + radial vignette
      ctx.clearRect(0, 0, W, H);
      const bgGrad = ctx.createRadialGradient(W / 2, H * 0.4, 0, W / 2, H / 2, Math.max(W, H) * 0.8);
      bgGrad.addColorStop(0, "#150A3E");
      bgGrad.addColorStop(0.6, "#0C0042");
      bgGrad.addColorStop(1, "#06021C");
      ctx.fillStyle = bgGrad; ctx.fillRect(0, 0, W, H);

      // Stars
      for (const s of stars) {
        ctx.fillStyle = `rgba(224,220,230,${s.a})`;
        ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2); ctx.fill();
      }

      // Layer guide bands (very subtle horizontal stripes by intent size)
      const layerYs = new Set<number>();
      concepts.forEach(c => layerYs.add(Math.round(project(c).sy)));
      const sortedLayerYs = [...layerYs].sort((a, b) => a - b);
      ctx.strokeStyle = "rgba(143,0,255,0.05)";
      ctx.lineWidth = 1;
      for (const ly of sortedLayerYs) {
        ctx.beginPath(); ctx.moveTo(0, ly); ctx.lineTo(W, ly); ctx.stroke();
      }

      // ----- EDGES (curved bezier with category gradient) -----
      const hl = hovered;
      const hlAnc = hl !== null ? ancestorsOf(hl) : null;
      const hlDes = hl !== null ? descendantsOf(hl) : null;
      const hlSet = hl !== null ? new Set([hl, ...hlAnc!, ...hlDes!]) : null;

      ctx.lineCap = "round";
      for (const e of hasseEdges) {
        const a = project(concepts[e.a]);
        const b = project(concepts[e.b]);
        const onPath = hlSet ? (hlSet.has(e.a) && hlSet.has(e.b)) : false;
        const dim = hl !== null && !onPath;
        const colA = colorFor(concepts[e.a]);
        const colB = colorFor(concepts[e.b]);
        const grad = ctx.createLinearGradient(a.sx, a.sy, b.sx, b.sy);
        grad.addColorStop(0, hexToRgba(colA, dim ? 0.06 : (onPath ? 0.85 : 0.32)));
        grad.addColorStop(1, hexToRgba(colB, dim ? 0.06 : (onPath ? 0.85 : 0.32)));
        ctx.strokeStyle = grad;
        ctx.lineWidth = onPath ? 2.2 : 1.1;
        ctx.beginPath();
        ctx.moveTo(a.sx, a.sy);
        const midY = (a.sy + b.sy) / 2;
        ctx.bezierCurveTo(a.sx, midY, b.sx, midY, b.sx, b.sy);
        ctx.stroke();
      }
      ctx.lineCap = "butt";

      // ----- NODES -----
      for (let i = 0; i < concepts.length; i++) {
        const c = concepts[i];
        const { sx, sy } = project(c);
        const r = nodeRadius(c);
        const isHovered = hovered === i;
        const onPath = hlSet ? hlSet.has(i) : false;
        const dim = hl !== null && !isHovered && !onPath;
        const hasSelected = c.extent.some(idx => selIds.has(usableFigures[idx].id));
        const baseCol = colorFor(c);
        const universeRoot = isUniverse(c);

        // Soft halo (only on hover, on the universe root, or selected)
        if (isHovered || universeRoot || hasSelected) {
          const glowR = r * (universeRoot ? 2.4 : 1.8);
          const glow = ctx.createRadialGradient(sx, sy, r * 0.5, sx, sy, glowR);
          glow.addColorStop(0, hexToRgba(baseCol, universeRoot ? 0.35 : 0.4));
          glow.addColorStop(1, hexToRgba(baseCol, 0));
          ctx.fillStyle = glow;
          ctx.beginPath(); ctx.arc(sx, sy, glowR, 0, Math.PI * 2); ctx.fill();
        }

        // Body — light radial gradient for subtle depth
        const body = ctx.createRadialGradient(sx - r * 0.25, sy - r * 0.25, r * 0.1, sx, sy, r);
        body.addColorStop(0, hexToRgba(baseCol, dim ? 0.18 : 0.95));
        body.addColorStop(1, hexToRgba(baseCol, dim ? 0.12 : 0.7));
        ctx.fillStyle = body;
        ctx.beginPath(); ctx.arc(sx, sy, isHovered ? r * 1.1 : r, 0, Math.PI * 2); ctx.fill();

        // Thin ring
        ctx.strokeStyle = hexToRgba(baseCol, dim ? 0.25 : 0.9);
        ctx.lineWidth = isHovered ? 1.5 : 1;
        ctx.stroke();

        // Universe root: small white dot in center to mark it
        if (universeRoot && !dim) {
          ctx.fillStyle = "rgba(255,255,255,0.9)";
          ctx.beginPath(); ctx.arc(sx, sy, Math.max(2, r * 0.25), 0, Math.PI * 2); ctx.fill();
        }

        // Selection ring
        if (hasSelected) {
          ctx.strokeStyle = "#FFD700";
          ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.arc(sx, sy, r * 1.5, 0, Math.PI * 2); ctx.stroke();
        }
      }

      // ----- LAYER LABEL on right gutter -----
      const layerSet = new Map<number, number>(); // intent size -> count
      concepts.forEach(c => layerSet.set(c.intent.length, (layerSet.get(c.intent.length) || 0) + 1));
      ctx.font = "10px 'DM Sans', sans-serif";
      ctx.textAlign = "right"; ctx.textBaseline = "middle";
      const seenLayers = new Set<string>();
      for (const c of concepts) {
        const key = `${c.intent.length}`;
        if (seenLayers.has(key)) continue;
        seenLayers.add(key);
        const { sy } = project(c);
        ctx.fillStyle = "rgba(224,220,230,0.32)";
        ctx.fillText(`${c.intent.length} trait${c.intent.length === 1 ? "" : "s"}`, W - 8, sy);
      }

      // ----- HOVER TOOLTIP -----
      if (hovered !== null) {
        const c = concepts[hovered];
        const { sx, sy } = project(c);

        ctx.font = "11px 'DM Sans', sans-serif";
        const headerLine = `${c.extent.length} figure${c.extent.length === 1 ? "" : "s"}  ·  ${c.intent.length} trait${c.intent.length === 1 ? "" : "s"}`;
        const figLines = c.extent.slice(0, 8).map(idx => `▸ ${usableFigures[idx].name}  (${usableFigures[idx].tradition || "?"})`);
        const figMore = c.extent.length > 8 ? [`… +${c.extent.length - 8} more figures`] : [];
        // Group intent traits by category for colored pills
        const byCat = new Map<string, string[]>();
        for (const t of c.intent) {
          const [cat, ...rest] = t.split("::");
          const lbl = rest.join("::") || cat;
          if (!byCat.has(cat)) byCat.set(cat, []);
          byCat.get(cat)!.push(lbl);
        }

        // Measure
        const allTextLines = [headerLine, ...figLines, ...figMore];
        const widestText = Math.max(...allTextLines.map(l => ctx.measureText(l).width));
        const pillH = 18, pillPadX = 6, pillGap = 4;
        const headerH = 22;
        // Pre-measure pills per category line
        const pillRows: { cat: string; pills: { label: string; w: number; color: string }[] }[] = [];
        for (const [cat, labels] of byCat) {
          const color = CATEGORY_COLORS[cat] || "#8F00FF";
          const pills = labels.slice(0, 8).map(label => ({
            label, color, w: ctx.measureText(label).width + pillPadX * 2,
          }));
          if (labels.length > 8) pills.push({ label: `+${labels.length - 8}`, color, w: ctx.measureText(`+${labels.length - 8}`).width + pillPadX * 2 });
          pillRows.push({ cat, pills });
        }
        const naturalRowW = Math.max(widestText, ...pillRows.map(r => r.pills.reduce((s, p) => s + p.w + pillGap, 60)));
        const boxW = Math.min(380, naturalRowW + 24);
        const innerWrapW = boxW - 8; // wrap boundary inside the panel (right edge minus margin)
        const pillsTotalH = pillRows.reduce((s, r) => {
          let used = 60; let lines = 1;
          for (const p of r.pills) {
            if (used + p.w + pillGap > innerWrapW - 10) { used = 60; lines++; }
            used += p.w + pillGap;
          }
          return s + lines * (pillH + 4);
        }, 0);
        const figBlockH = (figLines.length + figMore.length) * 15;
        const boxH = headerH + pillsTotalH + 6 + figBlockH + 14;

        const bx = Math.min(W - boxW - 6, Math.max(6, sx + 14));
        const by = Math.min(H - boxH - 6, Math.max(6, sy - boxH / 2));

        // Frosted panel
        const panelGrad = ctx.createLinearGradient(bx, by, bx, by + boxH);
        panelGrad.addColorStop(0, "rgba(15,8,55,0.97)");
        panelGrad.addColorStop(1, "rgba(8,3,30,0.97)");
        ctx.fillStyle = panelGrad;
        ctx.fillRect(bx, by, boxW, boxH);
        ctx.strokeStyle = hexToRgba(colorFor(c), 0.7);
        ctx.lineWidth = 1.2;
        ctx.strokeRect(bx + 0.5, by + 0.5, boxW - 1, boxH - 1);

        // Header
        ctx.font = "12px 'DM Sans', sans-serif";
        ctx.fillStyle = "#03FF9B";
        ctx.textAlign = "left"; ctx.textBaseline = "middle";
        ctx.fillText(headerLine, bx + 10, by + 12);

        // Pills per category
        let yCursor = by + headerH + 4;
        ctx.font = "10px 'DM Sans', sans-serif";
        for (const row of pillRows) {
          let xCursor = bx + 10;
          // Category mini-label
          ctx.fillStyle = "rgba(224,220,230,0.45)";
          ctx.fillText(row.cat.toUpperCase().slice(0, 6), xCursor, yCursor + pillH / 2);
          xCursor = bx + 60;
          for (const p of row.pills) {
            if (xCursor + p.w > bx + boxW - 8) {
              yCursor += pillH + 4;
              xCursor = bx + 60;
            }
            // Pill background
            ctx.fillStyle = hexToRgba(p.color, 0.18);
            ctx.strokeStyle = hexToRgba(p.color, 0.7);
            ctx.lineWidth = 1;
            const rad = pillH / 2;
            ctx.beginPath();
            ctx.moveTo(xCursor + rad, yCursor);
            ctx.lineTo(xCursor + p.w - rad, yCursor);
            ctx.arc(xCursor + p.w - rad, yCursor + rad, rad, -Math.PI / 2, Math.PI / 2);
            ctx.lineTo(xCursor + rad, yCursor + pillH);
            ctx.arc(xCursor + rad, yCursor + rad, rad, Math.PI / 2, -Math.PI / 2);
            ctx.closePath();
            ctx.fill(); ctx.stroke();
            ctx.fillStyle = p.color;
            ctx.textAlign = "left"; ctx.textBaseline = "middle";
            ctx.fillText(p.label, xCursor + pillPadX, yCursor + pillH / 2);
            xCursor += p.w + pillGap;
          }
          yCursor += pillH + 4;
        }

        // Separator
        ctx.strokeStyle = "rgba(143,0,255,0.25)"; ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(bx + 10, yCursor + 2); ctx.lineTo(bx + boxW - 10, yCursor + 2);
        ctx.stroke();
        yCursor += 8;

        // Figure list
        ctx.font = "11px 'DM Sans', sans-serif";
        ctx.textAlign = "left"; ctx.textBaseline = "top";
        for (const line of figLines) {
          ctx.fillStyle = "#E0DCE6";
          ctx.fillText(line, bx + 10, yCursor);
          yCursor += 15;
        }
        for (const line of figMore) {
          ctx.fillStyle = "rgba(224,220,230,0.45)";
          ctx.fillText(line, bx + 10, yCursor);
          yCursor += 15;
        }
      }
    }
    draw();

    function findHover(mx: number, my: number) {
      let best = -1, bestD = Infinity;
      for (let i = 0; i < concepts.length; i++) {
        const { sx, sy } = project(concepts[i]);
        const r = nodeRadius(concepts[i]) + 4;
        const dx = sx - mx, dy = sy - my;
        const d = dx * dx + dy * dy;
        if (d < r * r && d < bestD) { best = i; bestD = d; }
      }
      return best === -1 ? null : best;
    }

    canvas.onmousedown = (e) => { isDragging = true; didDrag = false; lastMx = e.clientX; lastMy = e.clientY; };
    canvas.onmousemove = (e) => {
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left, my = e.clientY - rect.top;
      if (isDragging) {
        const dx = e.clientX - lastMx, dy = e.clientY - lastMy;
        if (Math.abs(dx) + Math.abs(dy) > 3) didDrag = true;
        panX += dx; panY += dy; lastMx = e.clientX; lastMy = e.clientY; draw();
      } else {
        const h = findHover(mx, my);
        if (h !== hovered) {
          hovered = h;
          onHoverNode(h !== null ? { isCharacter: false, label: `Concept (${concepts[h].extent.length} figures)`, category: "" } : null);
          draw();
        }
      }
    };
    canvas.onmouseup = () => { isDragging = false; };
    canvas.onmouseleave = () => { isDragging = false; hovered = null; onHoverNode(null); draw(); };
    canvas.onclick = (e) => {
      if (didDrag) return;
      const rect = canvas.getBoundingClientRect();
      const h = findHover(e.clientX - rect.left, e.clientY - rect.top);
      if (h !== null) {
        // Open the first figure of the concept's extent in the side panel
        const f = usableFigures[concepts[h].extent[0]];
        if (f) onSelectNode(f);
      }
    };
    canvas.onwheel = (e) => {
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.15 : 0.87;
      const newZoom = Math.max(0.4, Math.min(6, zoom * factor));
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left, my = e.clientY - rect.top;
      const cx = W / 2 + panX, cy = H / 2 + panY;
      panX = mx - (mx - cx) * (newZoom / zoom) - W / 2;
      panY = my - (my - cy) * (newZoom / zoom) - H / 2;
      zoom = newZoom; draw();
    };
    return () => {
      canvas.onmousedown = null; canvas.onmousemove = null; canvas.onmouseup = null;
      canvas.onmouseleave = null; canvas.onclick = null; canvas.onwheel = null;
    };
  }, [concepts, hasseEdges, usableFigures]);

  return (
    <div className="absolute inset-0">
      <canvas ref={canvasRef} className="w-full h-full" data-testid="canvas-fca" />
      {computing && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <span className="text-shadows-text/50 text-sm" data-testid="text-fca-computing">Computing concept lattice…</span>
        </div>
      )}
      {!computing && concepts.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <span className="text-shadows-text/40 text-sm" data-testid="text-fca-empty">No concepts found — try lowering min support or enabling more trait categories.</span>
        </div>
      )}
    </div>
  );
}


function MCAView({
  figures,
  onSelectNode,
  onHoverNode,
  selectedNodeIds,
  useSupersets,
  enabledCategories,
  axisX,
  axisY,
  minTraitFreq,
  showTraitLabels,
  onVarianceComputed,
}: {
  figures: Node[];
  onSelectNode: (node: Node | null) => void;
  onHoverNode: (node: any) => void;
  selectedNodeIds: Set<number>;
  useSupersets?: Set<string>;
  enabledCategories?: Set<string>;
  axisX: number;
  axisY: number;
  minTraitFreq: number;
  showTraitLabels: boolean;
  onVarianceComputed?: (variance: number[]) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawRef = useRef<(() => void) | null>(null);
  const selectedNodeIdsRef = useRef(selectedNodeIds);
  selectedNodeIdsRef.current = selectedNodeIds;

  const [computing, setComputing] = useState(true);
  type FigPoint = { figure: Node; coords: number[]; traits: Set<string> };
  type TraitPoint = { trait: string; category: string; label: string; coords: number[]; mass: number; figureIds: Set<number> };
  const [figurePoints, setFigurePoints] = useState<FigPoint[]>([]);
  const [traitPoints, setTraitPoints] = useState<TraitPoint[]>([]);

  useEffect(() => {
    let cancelled = false;
    setComputing(true);

    const handle = setTimeout(() => {
      if (cancelled) return;

      const usable = figures.filter(f => getTraitsForFigure(f, enabledCategories, useSupersets).length > 0);
      if (usable.length < 4) {
        setFigurePoints([]); setTraitPoints([]); setComputing(false);
        onVarianceComputed?.([]);
        return;
      }

      const traitSets = usable.map(f => new Set(getTraitsForFigure(f, enabledCategories, useSupersets)));

      // Count trait frequencies and filter rare traits
      const freq = new Map<string, number>();
      traitSets.forEach(s => s.forEach(t => freq.set(t, (freq.get(t) || 0) + 1)));
      const traitList = [...freq.entries()].filter(([_, c]) => c >= minTraitFreq).map(([t]) => t);
      if (traitList.length < 4) {
        setFigurePoints([]); setTraitPoints([]); setComputing(false);
        onVarianceComputed?.([]);
        return;
      }
      const traitIdx = new Map(traitList.map((t, i) => [t, i]));
      const n = usable.length, m = traitList.length;

      // Indicator matrix Z (n x m), flat
      const Z = new Float64Array(n * m);
      for (let i = 0; i < n; i++) {
        traitSets[i].forEach(t => {
          const j = traitIdx.get(t);
          if (j !== undefined) Z[i * m + j] = 1;
        });
      }

      // Row/col masses
      let total = 0;
      const rowSum = new Float64Array(n);
      const colSum = new Float64Array(m);
      for (let i = 0; i < n; i++) {
        const off = i * m;
        let rs = 0;
        for (let j = 0; j < m; j++) {
          const v = Z[off + j];
          if (v) { rs += v; colSum[j] += v; total += v; }
        }
        rowSum[i] = rs;
      }
      if (total === 0) {
        setFigurePoints([]); setTraitPoints([]); setComputing(false);
        onVarianceComputed?.([]); return;
      }

      const sqrtR = new Float64Array(n);
      const sqrtC = new Float64Array(m);
      const r = new Float64Array(n);
      const c = new Float64Array(m);
      for (let i = 0; i < n; i++) { r[i] = rowSum[i] / total; sqrtR[i] = Math.sqrt(r[i]); }
      for (let j = 0; j < m; j++) { c[j] = colSum[j] / total; sqrtC[j] = Math.sqrt(c[j]); }

      // Standardized residuals S[i,j] = (P[i,j] - r[i]*c[j]) / (sqrt(r[i])*sqrt(c[j]))
      const S = new Float64Array(n * m);
      for (let i = 0; i < n; i++) {
        if (sqrtR[i] === 0) continue;
        const off = i * m;
        const ri = r[i];
        const sri = sqrtR[i];
        for (let j = 0; j < m; j++) {
          if (sqrtC[j] === 0) continue;
          const Pij = Z[off + j] / total;
          S[off + j] = (Pij - ri * c[j]) / (sri * sqrtC[j]);
        }
      }

      // Power iteration with deflation for top-K singular triples
      const K = 5;
      const Us: Float64Array[] = [];
      const Vs: Float64Array[] = [];
      const sigmas: number[] = [];

      const ITERS = 60;
      const tmpU = new Float64Array(n);
      const tmpV = new Float64Array(m);

      function Sv(v: Float64Array, out: Float64Array) {
        out.fill(0);
        for (let i = 0; i < n; i++) {
          const off = i * m;
          let s = 0;
          for (let j = 0; j < m; j++) s += S[off + j] * v[j];
          out[i] = s;
        }
        for (let k = 0; k < sigmas.length; k++) {
          let dotVk = 0; const Vk = Vs[k];
          for (let j = 0; j < m; j++) dotVk += Vk[j] * v[j];
          const sk = sigmas[k]; const Uk = Us[k];
          for (let i = 0; i < n; i++) out[i] -= sk * Uk[i] * dotVk;
        }
      }
      function STu(u: Float64Array, out: Float64Array) {
        out.fill(0);
        for (let i = 0; i < n; i++) {
          const ui = u[i]; if (ui === 0) continue;
          const off = i * m;
          for (let j = 0; j < m; j++) out[j] += S[off + j] * ui;
        }
        for (let k = 0; k < sigmas.length; k++) {
          let dotUk = 0; const Uk = Us[k];
          for (let i = 0; i < n; i++) dotUk += Uk[i] * u[i];
          const sk = sigmas[k]; const Vk = Vs[k];
          for (let j = 0; j < m; j++) out[j] -= sk * Vk[j] * dotUk;
        }
      }
      function nrm(a: Float64Array) { let s = 0; for (let i = 0; i < a.length; i++) s += a[i] * a[i]; return Math.sqrt(s); }

      for (let k = 0; k < K; k++) {
        const v = new Float64Array(m);
        for (let j = 0; j < m; j++) v[j] = Math.random() - 0.5;
        let vn = nrm(v); if (vn === 0) break;
        for (let j = 0; j < m; j++) v[j] /= vn;
        const u = new Float64Array(n);
        let sigma = 0;
        for (let it = 0; it < ITERS; it++) {
          Sv(v, u);
          sigma = nrm(u);
          if (sigma < 1e-12) break;
          for (let i = 0; i < n; i++) u[i] /= sigma;
          STu(u, tmpV);
          vn = nrm(tmpV);
          if (vn < 1e-12) break;
          for (let j = 0; j < m; j++) v[j] = tmpV[j] / vn;
        }
        Sv(v, u);
        sigma = nrm(u);
        if (sigma < 1e-9) break;
        for (let i = 0; i < n; i++) u[i] /= sigma;
        sigmas.push(sigma);
        Us.push(u);
        Vs.push(v);
      }

      const sumSq = sigmas.reduce((a, b) => a + b * b, 0);
      const variance = sigmas.map(s => sumSq > 0 ? (s * s) / sumSq : 0);

      // Principal coords for figures (rows): F[i,k] = sigma[k] * U[k,i] / sqrt(r[i])
      // Principal coords for traits (cols): G[j,k] = sigma[k] * V[k,j] / sqrt(c[j])
      const figCoords: FigPoint[] = usable.map((f, i) => ({
        figure: f,
        traits: traitSets[i],
        coords: sigmas.map((s, k) => sqrtR[i] > 0 ? s * Us[k][i] / sqrtR[i] : 0),
      }));
      // Reverse-lookup: trait -> set of figure ids holding it
      const traitToFigIds = new Map<string, Set<number>>();
      for (let i = 0; i < usable.length; i++) {
        const fid = usable[i].id;
        traitSets[i].forEach(t => {
          let s = traitToFigIds.get(t);
          if (!s) { s = new Set(); traitToFigIds.set(t, s); }
          s.add(fid);
        });
      }
      const trCoords: TraitPoint[] = traitList.map((t, j) => {
        const parts = t.split("::");
        const category = parts[0];
        const label = parts.slice(1).join("::");
        return {
          trait: t,
          category,
          label,
          mass: c[j],
          figureIds: traitToFigIds.get(t) || new Set(),
          coords: sigmas.map((s, k) => sqrtC[j] > 0 ? s * Vs[k][j] / sqrtC[j] : 0),
        };
      });

      if (cancelled) return;
      setFigurePoints(figCoords);
      setTraitPoints(trCoords);
      onVarianceComputed?.(variance);
      setComputing(false);
    }, 30);

    return () => { cancelled = true; clearTimeout(handle); };
  }, [figures, useSupersets, enabledCategories, minTraitFreq]);

  // Render
  useEffect(() => {
    if (!canvasRef.current || figurePoints.length === 0) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const container = canvas.parentElement;
    if (!container) return;

    const dpr = window.devicePixelRatio || 1;
    const width = container.clientWidth;
    const height = container.clientHeight;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = width + "px";
    canvas.style.height = height + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Compute bounds across both figures and (top-mass) traits to keep them on the same scale
    const ax = axisX, ay = axisY;
    const allXs: number[] = [];
    const allYs: number[] = [];
    figurePoints.forEach(p => { allXs.push(p.coords[ax] || 0); allYs.push(p.coords[ay] || 0); });
    traitPoints.forEach(p => { allXs.push(p.coords[ax] || 0); allYs.push(p.coords[ay] || 0); });
    const minX = Math.min(...allXs), maxX = Math.max(...allXs);
    const minY = Math.min(...allYs), maxY = Math.max(...allYs);
    const padding = 80;
    const scaleX = (width - padding * 2) / (maxX - minX || 1);
    const scaleY = (height - padding * 2) / (maxY - minY || 1);
    const baseScale = Math.min(scaleX, scaleY);
    const offsetX = padding + ((width - padding * 2) - (maxX - minX) * baseScale) / 2;
    const offsetY = padding + ((height - padding * 2) - (maxY - minY) * baseScale) / 2;

    let zoom = 1;
    let panX = 0, panY = 0;
    let isDragging = false;
    let lastMx = 0, lastMy = 0;
    let didDrag = false;
    let hoveredFig: { figure: Node; sx: number; sy: number; traits: Set<string> } | null = null;
    let hoveredTrait: { trait: TraitPoint; sx: number; sy: number } | null = null;

    function project(cx: number, cy: number) {
      const baseX = offsetX + (cx - minX) * baseScale;
      const baseY = offsetY + (cy - minY) * baseScale;
      return {
        sx: width / 2 + (baseX - width / 2) * zoom + panX,
        sy: height / 2 + (baseY - height / 2) * zoom + panY,
      };
    }

    function draw() {
      ctx.clearRect(0, 0, width, height);
      const grad = ctx.createLinearGradient(0, 0, width, height);
      grad.addColorStop(0, "#0B0626");
      grad.addColorStop(1, "#0C0042");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);

      // Axes through origin (0,0 in MCA coordinate space)
      const origin = project(0, 0);
      ctx.strokeStyle = "rgba(143,0,255,0.18)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, origin.sy); ctx.lineTo(width, origin.sy);
      ctx.moveTo(origin.sx, 0); ctx.lineTo(origin.sx, height);
      ctx.stroke();

      // Axis labels
      ctx.fillStyle = "rgba(224,220,230,0.35)";
      ctx.font = "10px 'DM Sans', sans-serif";
      ctx.textAlign = "right"; ctx.textBaseline = "bottom";
      ctx.fillText(`Dim ${axisX + 1}`, width - 8, origin.sy - 4);
      ctx.textAlign = "left"; ctx.textBaseline = "top";
      ctx.fillText(`Dim ${axisY + 1}`, origin.sx + 6, 6);

      const selIds = selectedNodeIdsRef.current;
      const hasSelection = selIds.size > 0;
      const hoveredFigId = hoveredFig?.figure.id;
      const hoveredFigTraits = hoveredFig?.traits;
      const hoveredTr = hoveredTrait?.trait;
      const hoveredTrFigs = hoveredTr?.figureIds;
      const anyHover = !!(hoveredFig || hoveredTrait);

      // Connection rays from hovered figure to its traits (or hovered trait to its figures)
      if (hoveredFig && hoveredFigTraits) {
        ctx.strokeStyle = "rgba(255,215,0,0.18)";
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        for (const tr of traitPoints) {
          if (!hoveredFigTraits.has(tr.trait)) continue;
          const { sx, sy } = project(tr.coords[ax] || 0, tr.coords[ay] || 0);
          ctx.moveTo(hoveredFig.sx, hoveredFig.sy);
          ctx.lineTo(sx, sy);
        }
        ctx.stroke();
      } else if (hoveredTrait && hoveredTrFigs) {
        ctx.strokeStyle = "rgba(3,255,155,0.18)";
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        for (const p of figurePoints) {
          if (!hoveredTrFigs.has(p.figure.id)) continue;
          const { sx, sy } = project(p.coords[ax] || 0, p.coords[ay] || 0);
          ctx.moveTo(hoveredTrait.sx, hoveredTrait.sy);
          ctx.lineTo(sx, sy);
        }
        ctx.stroke();
      }

      // ----- TRAIT MARKERS (small dots) -----
      // Project all visible traits, store screen coords for hit-testing
      const traitScreen: { tr: TraitPoint; sx: number; sy: number; r: number }[] = [];
      for (const tr of traitPoints) {
        const { sx, sy } = project(tr.coords[ax] || 0, tr.coords[ay] || 0);
        if (sx < -30 || sx > width + 30 || sy < -30 || sy > height + 30) continue;
        const r = Math.max(2, Math.min(7, 2 + Math.log10(tr.mass * 1000 + 1) * 1.4));
        traitScreen.push({ tr, sx, sy, r });
      }
      // Draw trait dots
      for (const { tr, sx, sy, r } of traitScreen) {
        const color = CATEGORY_COLORS[tr.category] || "#FFD700";
        const isThis = hoveredTr?.trait === tr.trait;
        const inFigSet = hoveredFigTraits?.has(tr.trait);
        let alpha = 0.55;
        if (anyHover) alpha = isThis ? 1 : (inFigSet ? 0.95 : 0.10);
        ctx.globalAlpha = alpha;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(sx, sy, isThis ? r * 1.6 : r, 0, Math.PI * 2);
        ctx.fill();
        if (isThis || inFigSet) {
          ctx.globalAlpha = 0.9;
          ctx.strokeStyle = "rgba(11,6,38,0.85)";
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      }
      ctx.globalAlpha = 1;

      // ----- TRAIT LABELS with greedy collision avoidance -----
      if (showTraitLabels) {
        const placed: { x: number; y: number; w: number; h: number }[] = [];
        // Order: hovered/related first (always show), then by mass desc
        const ordered = [...traitScreen].sort((a, b) => {
          const aPri = (hoveredTr?.trait === a.tr.trait || hoveredFigTraits?.has(a.tr.trait)) ? 1 : 0;
          const bPri = (hoveredTr?.trait === b.tr.trait || hoveredFigTraits?.has(b.tr.trait)) ? 1 : 0;
          if (aPri !== bPri) return bPri - aPri;
          return b.tr.mass - a.tr.mass;
        });
        const maxLabels = Math.min(ordered.length, Math.floor(80 + zoom * 50));
        let drawn = 0;
        ctx.textBaseline = "middle";
        for (const item of ordered) {
          if (drawn >= maxLabels) break;
          const { tr, sx, sy, r } = item;
          const isPriority = hoveredTr?.trait === tr.trait || hoveredFigTraits?.has(tr.trait);
          if (anyHover && !isPriority) continue;
          const fontSize = Math.max(9, Math.min(13, 9 + Math.log10(tr.mass * 1000 + 1) * 1.5));
          ctx.font = `${fontSize}px 'Sofia Pro Light', sans-serif`;
          const tw = ctx.measureText(tr.label).width;
          const th = fontSize + 2;
          // Try right then left placement
          const candidates = [
            { x: sx + r + 4, y: sy - th / 2, align: "left" as CanvasTextAlign },
            { x: sx - r - 4 - tw, y: sy - th / 2, align: "left" as CanvasTextAlign },
            { x: sx - tw / 2, y: sy + r + 4, align: "left" as CanvasTextAlign },
            { x: sx - tw / 2, y: sy - r - th - 2, align: "left" as CanvasTextAlign },
          ];
          let chosen: { x: number; y: number; align: CanvasTextAlign } | null = null;
          for (const cnd of candidates) {
            const box = { x: cnd.x - 2, y: cnd.y - 1, w: tw + 4, h: th + 2 };
            let ok = true;
            for (const p of placed) {
              if (box.x < p.x + p.w && box.x + box.w > p.x && box.y < p.y + p.h && box.y + box.h > p.y) { ok = false; break; }
            }
            if (ok) { chosen = cnd; placed.push(box); break; }
          }
          if (!chosen) continue;
          const color = CATEGORY_COLORS[tr.category] || "#FFD700";
          ctx.fillStyle = color;
          ctx.globalAlpha = isPriority ? 1 : (anyHover ? 0.2 : 0.7);
          ctx.textAlign = chosen.align;
          ctx.fillText(tr.label, chosen.x, chosen.y + th / 2);
          drawn++;
        }
        ctx.globalAlpha = 1;
      }

      // ----- FIGURE DOTS -----
      const baseR = 3.5 * Math.min(2, Math.max(0.7, zoom * 0.85));
      const figScreen: { p: FigPoint; sx: number; sy: number; r: number }[] = [];
      for (const p of figurePoints) {
        const { sx, sy } = project(p.coords[ax] || 0, p.coords[ay] || 0);
        if (sx < -20 || sx > width + 20 || sy < -20 || sy > height + 20) continue;
        const importance = Math.log10((p.figure.mentionCount || 0) + 1);
        const r = baseR * (1 + Math.min(0.9, importance * 0.25));
        figScreen.push({ p, sx, sy, r });
      }
      for (const { p, sx, sy, r } of figScreen) {
        const isSelected = selIds.has(p.figure.id);
        const isHovered = hoveredFigId === p.figure.id;
        const sharesHoveredTrait = hoveredTrFigs?.has(p.figure.id);
        const dim = (hasSelection && !isSelected) || (anyHover && !isHovered && !sharesHoveredTrait);
        const color = TRADITION_COLORS[p.figure.tradition || ""] || "#E0DCE6";
        ctx.globalAlpha = dim ? 0.10 : 0.92;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(sx, sy, isHovered ? r * 1.8 : r, 0, Math.PI * 2);
        ctx.fill();
        if (!dim) {
          ctx.globalAlpha = 0.5;
          ctx.strokeStyle = "rgba(11,6,38,0.9)";
          ctx.lineWidth = 1;
          ctx.stroke();
        }
        if (isSelected) {
          ctx.globalAlpha = 1;
          ctx.strokeStyle = "#FFD700";
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(sx, sy, r * 2.2, 0, Math.PI * 2);
          ctx.stroke();
        }
      }
      ctx.globalAlpha = 1;

      // Names of figures sharing a hovered trait (top contributors)
      if (hoveredTrait && hoveredTrFigs) {
        const placed: { x: number; y: number; w: number; h: number }[] = [];
        const candidates = figScreen
          .filter(({ p }) => hoveredTrFigs.has(p.figure.id))
          .sort((a, b) => (b.p.figure.mentionCount || 0) - (a.p.figure.mentionCount || 0))
          .slice(0, 30);
        ctx.font = "10px 'DM Sans', sans-serif";
        ctx.textBaseline = "middle";
        ctx.textAlign = "left";
        for (const { p, sx, sy, r } of candidates) {
          const tw = ctx.measureText(p.figure.name).width;
          const box = { x: sx + r + 3, y: sy - 6, w: tw + 4, h: 12 };
          let ok = true;
          for (const q of placed) {
            if (box.x < q.x + q.w && box.x + box.w > q.x && box.y < q.y + q.h && box.y + box.h > q.y) { ok = false; break; }
          }
          if (!ok) continue;
          placed.push(box);
          ctx.fillStyle = "#E0DCE6";
          ctx.globalAlpha = 0.95;
          ctx.fillText(p.figure.name, sx + r + 4, sy);
        }
        ctx.globalAlpha = 1;
      }

      // ----- TOOLTIPS -----
      if (hoveredFig) {
        ctx.font = "12px 'DM Sans', sans-serif";
        const label = `${hoveredFig.figure.name} · ${hoveredFig.figure.tradition || ""}`;
        const w = ctx.measureText(label).width + 14;
        ctx.fillStyle = "rgba(11,6,38,0.97)";
        ctx.fillRect(hoveredFig.sx + 12, hoveredFig.sy - 24, w, 24);
        ctx.strokeStyle = "rgba(143,0,255,0.6)";
        ctx.lineWidth = 1;
        ctx.strokeRect(hoveredFig.sx + 12, hoveredFig.sy - 24, w, 24);
        ctx.fillStyle = "#E0DCE6";
        ctx.textAlign = "left"; ctx.textBaseline = "middle";
        ctx.fillText(label, hoveredFig.sx + 19, hoveredFig.sy - 12);
      } else if (hoveredTrait) {
        const tr = hoveredTrait.trait;
        ctx.font = "12px 'DM Sans', sans-serif";
        const label = `${tr.label}  ·  ${tr.category}  ·  ${tr.figureIds.size} figures`;
        const w = ctx.measureText(label).width + 14;
        const tx = Math.min(width - w - 4, hoveredTrait.sx + 12);
        const ty = Math.max(24, hoveredTrait.sy - 4);
        ctx.fillStyle = "rgba(11,6,38,0.97)";
        ctx.fillRect(tx, ty - 22, w, 24);
        ctx.strokeStyle = "rgba(255,215,0,0.5)";
        ctx.lineWidth = 1;
        ctx.strokeRect(tx, ty - 22, w, 24);
        ctx.fillStyle = "#E0DCE6";
        ctx.textAlign = "left"; ctx.textBaseline = "middle";
        ctx.fillText(label, tx + 7, ty - 10);
      }
    }
    drawRef.current = draw;
    draw();

    function findHoverFig(mx: number, my: number) {
      const r = 7 * Math.max(1, zoom);
      let best: { figure: Node; sx: number; sy: number; traits: Set<string>; d: number } | null = null;
      for (const p of figurePoints) {
        const { sx, sy } = project(p.coords[axisX] || 0, p.coords[axisY] || 0);
        const dx = sx - mx, dy = sy - my;
        const d = dx * dx + dy * dy;
        if (d < r * r && (!best || d < best.d)) best = { figure: p.figure, sx, sy, traits: p.traits, d };
      }
      return best ? { figure: best.figure, sx: best.sx, sy: best.sy, traits: best.traits } : null;
    }
    function findHoverTrait(mx: number, my: number) {
      const r = 8 * Math.max(1, zoom);
      let best: { trait: TraitPoint; sx: number; sy: number; d: number } | null = null;
      for (const tr of traitPoints) {
        const { sx, sy } = project(tr.coords[axisX] || 0, tr.coords[axisY] || 0);
        const dx = sx - mx, dy = sy - my;
        const d = dx * dx + dy * dy;
        if (d < r * r && (!best || d < best.d)) best = { trait: tr, sx, sy, d };
      }
      return best ? { trait: best.trait, sx: best.sx, sy: best.sy } : null;
    }

    canvas.onmousedown = (e) => { isDragging = true; didDrag = false; lastMx = e.clientX; lastMy = e.clientY; };
    canvas.onmousemove = (e) => {
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left, my = e.clientY - rect.top;
      if (isDragging) {
        const dx = e.clientX - lastMx, dy = e.clientY - lastMy;
        if (Math.abs(dx) + Math.abs(dy) > 3) didDrag = true;
        panX += dx; panY += dy;
        lastMx = e.clientX; lastMy = e.clientY;
        draw();
      } else {
        const hf = findHoverFig(mx, my);
        const ht = hf ? null : findHoverTrait(mx, my);
        const changed = hf?.figure.id !== hoveredFig?.figure.id || ht?.trait.trait !== hoveredTrait?.trait.trait;
        hoveredFig = hf;
        hoveredTrait = ht;
        if (changed) {
          onHoverNode(hf ? hf.figure : null);
          canvas.style.cursor = (hf || ht) ? "pointer" : "default";
          draw();
        }
      }
    };
    canvas.onmouseup = () => { isDragging = false; };
    canvas.onmouseleave = () => { isDragging = false; hoveredFig = null; hoveredTrait = null; onHoverNode(null); draw(); };
    canvas.onclick = (e) => {
      if (didDrag) return;
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left, my = e.clientY - rect.top;
      const hf = findHoverFig(mx, my);
      if (hf) { onSelectNode(hf.figure); return; }
    };
    canvas.onwheel = (e) => {
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.15 : 0.87;
      const newZoom = Math.max(0.3, Math.min(8, zoom * factor));
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left, my = e.clientY - rect.top;
      const cx = width / 2 + panX;
      const cy = height / 2 + panY;
      panX = mx - (mx - cx) * (newZoom / zoom) - width / 2;
      panY = my - (my - cy) * (newZoom / zoom) - height / 2;
      zoom = newZoom;
      draw();
    };

    return () => {
      canvas.onmousedown = null; canvas.onmousemove = null; canvas.onmouseup = null;
      canvas.onmouseleave = null; canvas.onclick = null; canvas.onwheel = null;
    };
  }, [figurePoints, traitPoints, axisX, axisY, showTraitLabels]);

  // Redraw when external selection changes (preserves zoom/pan via drawRef)
  useEffect(() => { drawRef.current?.(); }, [selectedNodeIds]);

  return (
    <div className="absolute inset-0">
      <canvas ref={canvasRef} className="w-full h-full" data-testid="canvas-mca" />
      {computing && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <span className="text-shadows-text/50 text-sm" data-testid="text-mca-computing">Computing MCA…</span>
        </div>
      )}
      {!computing && figurePoints.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <span className="text-shadows-text/40 text-sm" data-testid="text-mca-empty">Not enough data — try lowering the trait frequency threshold or enabling more categories.</span>
        </div>
      )}
    </div>
  );
}


function UMAPView({
  figures,
  onSelectNode,
  onHoverNode,
  selectedNodeIds,
  useSupersets,
  enabledCategories,
}: {
  figures: Node[];
  onSelectNode: (node: Node | null) => void;
  onHoverNode: (node: any) => void;
  selectedNodeIds: Set<number>;
  useSupersets?: Set<string>;
  enabledCategories?: Set<string>;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawRef = useRef<(() => void) | null>(null);
  const selectedNodeIdsRef = useRef(selectedNodeIds);
  selectedNodeIdsRef.current = selectedNodeIds;

  const [neighbors, setNeighbors] = useState(15);
  const [minDist, setMinDist] = useState(0.1);
  const [computing, setComputing] = useState(true);
  const [points, setPoints] = useState<{ figure: Node; x: number; y: number }[]>([]);
  const [showAllLabels, setShowAllLabels] = useState(false);
  const showAllLabelsRef = useRef(showAllLabels);
  showAllLabelsRef.current = showAllLabels;

  useEffect(() => {
    let cancelled = false;
    setComputing(true);
    setPoints([]);

    (async () => {
      const { UMAP } = await import("umap-js");

      const usable = figures.filter(f => {
        const traits = getTraitsForFigure(f, enabledCategories, useSupersets);
        return traits.length > 0;
      });
      if (usable.length < 4) {
        if (!cancelled) { setPoints([]); setComputing(false); }
        return;
      }

      const traitSets = usable.map(f => new Set(getTraitsForFigure(f, enabledCategories, useSupersets)));
      const allTraits = new Set<string>();
      traitSets.forEach(s => s.forEach(t => allTraits.add(t)));
      const traitList = [...allTraits];
      const traitIdx = new Map(traitList.map((t, i) => [t, i]));

      const data = traitSets.map(s => {
        const v = new Array(traitList.length).fill(0);
        s.forEach(t => { const i = traitIdx.get(t); if (i !== undefined) v[i] = 1; });
        return v;
      });

      function jaccardDistance(a: number[], b: number[]) {
        let inter = 0, uni = 0;
        for (let i = 0; i < a.length; i++) {
          if (a[i] || b[i]) {
            uni++;
            if (a[i] && b[i]) inter++;
          }
        }
        return uni === 0 ? 1 : 1 - inter / uni;
      }

      const umap = new UMAP({
        nComponents: 2,
        nNeighbors: Math.min(neighbors, usable.length - 1),
        minDist,
        distanceFn: jaccardDistance,
      });

      try {
        const embedding = await umap.fitAsync(data);
        if (cancelled) return;
        const result = embedding.map((coords, i) => ({
          figure: usable[i],
          x: coords[0],
          y: coords[1],
        }));
        setPoints(result);
      } finally {
        if (!cancelled) setComputing(false);
      }
    })();

    return () => { cancelled = true; };
  }, [figures, useSupersets, enabledCategories, neighbors, minDist]);

  useEffect(() => {
    if (!canvasRef.current || points.length === 0) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const container = canvas.parentElement;
    if (!container) return;

    const dpr = window.devicePixelRatio || 1;
    const width = container.clientWidth;
    const height = container.clientHeight;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = width + "px";
    canvas.style.height = height + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const xs = points.map(p => p.x);
    const ys = points.map(p => p.y);
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minY = Math.min(...ys), maxY = Math.max(...ys);
    const padding = 60;
    const scaleX = (width - padding * 2) / (maxX - minX || 1);
    const scaleY = (height - padding * 2) / (maxY - minY || 1);
    const scale = Math.min(scaleX, scaleY);
    const offsetX = padding + ((width - padding * 2) - (maxX - minX) * scale) / 2;
    const offsetY = padding + ((height - padding * 2) - (maxY - minY) * scale) / 2;

    let zoom = 1;
    let panX = 0, panY = 0;
    let isDragging = false;
    let lastMx = 0, lastMy = 0;
    let didDrag = false;
    let hovered: { p: typeof points[0]; sx: number; sy: number } | null = null;

    function project(p: { x: number; y: number }) {
      const baseX = offsetX + (p.x - minX) * scale;
      const baseY = offsetY + (p.y - minY) * scale;
      return {
        sx: width / 2 + (baseX - width / 2) * zoom + panX,
        sy: height / 2 + (baseY - height / 2) * zoom + panY,
      };
    }

    // Sort points by importance (mention count) for label priority
    const sortedByImportance = [...points].sort((a, b) =>
      (b.figure.mentionCount || 0) - (a.figure.mentionCount || 0)
    );

    function draw() {
      ctx.clearRect(0, 0, width, height);
      const grad = ctx.createLinearGradient(0, 0, width, height);
      grad.addColorStop(0, "#0B0626");
      grad.addColorStop(1, "#0C0042");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);

      const selIds = selectedNodeIdsRef.current;
      const hasSelection = selIds.size > 0;
      const baseR = 4.5 * Math.min(2, Math.max(0.7, zoom * 0.85));

      // Compute connected ids when hovering
      const hoveredId = hovered?.p.figure.id;

      // Draw points (dim when something is hovered/selected)
      for (const p of points) {
        const { sx, sy } = project(p);
        if (sx < -20 || sx > width + 20 || sy < -20 || sy > height + 20) continue;
        const isSelected = selIds.has(p.figure.id);
        const isHovered = hoveredId === p.figure.id;
        const dim = (hasSelection && !isSelected) || (hoveredId && !isHovered);
        // Make important figures slightly larger
        const importance = Math.log10((p.figure.mentionCount || 0) + 1);
        const r = baseR * (1 + Math.min(0.9, importance * 0.25));
        const color = TRADITION_COLORS[p.figure.tradition || ""] || "#E0DCE6";
        ctx.globalAlpha = dim ? 0.15 : 0.9;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(sx, sy, isHovered ? r * 1.8 : r, 0, Math.PI * 2);
        ctx.fill();
        // Subtle outline for visibility on dark bg
        if (!dim) {
          ctx.globalAlpha = 0.5;
          ctx.strokeStyle = "rgba(11,6,38,0.9)";
          ctx.lineWidth = 1;
          ctx.stroke();
        }
        if (isSelected) {
          ctx.globalAlpha = 1;
          ctx.strokeStyle = "#FFD700";
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(sx, sy, r * 2.2, 0, Math.PI * 2);
          ctx.stroke();
        }
      }
      ctx.globalAlpha = 1;

      // Greedy label placement: most-important first, skip if it would collide
      ctx.font = "11px 'DM Sans', sans-serif";
      ctx.textBaseline = "middle";
      const placedRects: { x: number; y: number; w: number; h: number }[] = [];
      const labelPad = 4;
      const labelOffset = 8;
      const labelH = 14;
      const maxLabels = showAllLabelsRef.current ? points.length : Math.min(150, Math.floor(80 + zoom * 40));
      let placed = 0;

      const candidates = hoveredId
        ? sortedByImportance.filter(p => p.figure.id === hoveredId)  // only show hovered tooltip below
        : sortedByImportance;

      for (const p of candidates) {
        if (placed >= maxLabels) break;
        const { sx, sy } = project(p);
        if (sx < 0 || sx > width || sy < 0 || sy > height) continue;
        const isSelected = selIds.has(p.figure.id);
        const dim = hasSelection && !isSelected;
        if (dim && !showAllLabelsRef.current) continue;

        const text = p.figure.name;
        const tw = ctx.measureText(text).width;
        // Try positions: right, left, top, bottom
        const positions = [
          { x: sx + labelOffset, y: sy },
          { x: sx - tw - labelOffset, y: sy },
          { x: sx - tw / 2, y: sy - labelOffset - labelH / 2 },
          { x: sx - tw / 2, y: sy + labelOffset + labelH / 2 },
        ];
        let placedRect: typeof placedRects[number] | null = null;
        for (const pos of positions) {
          const rect = { x: pos.x - labelPad, y: pos.y - labelH / 2 - labelPad, w: tw + labelPad * 2, h: labelH + labelPad * 2 };
          let collides = false;
          for (const existing of placedRects) {
            if (rect.x < existing.x + existing.w && rect.x + rect.w > existing.x &&
                rect.y < existing.y + existing.h && rect.y + rect.h > existing.y) {
              collides = true;
              break;
            }
          }
          if (!collides) { placedRect = { ...rect, ...pos } as any; (placedRect as any).labelX = pos.x; (placedRect as any).labelY = pos.y; break; }
        }
        if (!placedRect) continue;
        placedRects.push(placedRect);
        placed++;

        // Text only — no background pill (keeps the map clean)
        ctx.fillStyle = isSelected ? "#FFD700" : "rgba(224,220,230,0.92)";
        ctx.textAlign = "left";
        ctx.fillText(text, (placedRect as any).labelX, (placedRect as any).labelY);
      }

      // Hover tooltip (richer info)
      if (hovered) {
        ctx.font = "12px 'DM Sans', sans-serif";
        const label = `${hovered.p.figure.name} · ${hovered.p.figure.tradition || ""}`;
        const w = ctx.measureText(label).width + 14;
        ctx.fillStyle = "rgba(11,6,38,0.97)";
        ctx.fillRect(hovered.sx + 12, hovered.sy - 24, w, 24);
        ctx.strokeStyle = "rgba(143,0,255,0.6)";
        ctx.lineWidth = 1;
        ctx.strokeRect(hovered.sx + 12, hovered.sy - 24, w, 24);
        ctx.fillStyle = "#E0DCE6";
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        ctx.fillText(label, hovered.sx + 19, hovered.sy - 12);
      }
    }
    drawRef.current = draw;

    function findHover(mx: number, my: number) {
      const r = 6 * Math.max(1, zoom);
      let best: { p: typeof points[0]; sx: number; sy: number; d: number } | null = null;
      for (const p of points) {
        const { sx, sy } = project(p);
        const dx = sx - mx, dy = sy - my;
        const d = dx * dx + dy * dy;
        if (d < r * r && (!best || d < best.d)) best = { p, sx, sy, d };
      }
      return best ? { p: best.p, sx: best.sx, sy: best.sy } : null;
    }

    canvas.onmousedown = (e) => {
      isDragging = true;
      didDrag = false;
      lastMx = e.clientX;
      lastMy = e.clientY;
    };
    canvas.onmousemove = (e) => {
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      if (isDragging) {
        const dx = e.clientX - lastMx;
        const dy = e.clientY - lastMy;
        if (Math.abs(dx) + Math.abs(dy) > 3) didDrag = true;
        panX += dx; panY += dy;
        lastMx = e.clientX;
        lastMy = e.clientY;
        draw();
      } else {
        const h = findHover(mx, my);
        if (h?.p.figure.id !== hovered?.p.figure.id) {
          hovered = h;
          onHoverNode(h ? h.p.figure : null);
          draw();
        } else {
          hovered = h;
        }
      }
    };
    canvas.onmouseup = () => { isDragging = false; };
    canvas.onmouseleave = () => { isDragging = false; hovered = null; onHoverNode(null); draw(); };
    canvas.onclick = (e) => {
      if (didDrag) return;
      const rect = canvas.getBoundingClientRect();
      const h = findHover(e.clientX - rect.left, e.clientY - rect.top);
      if (h) onSelectNode(h.p.figure);
    };
    canvas.onwheel = (e) => {
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.15 : 0.87;
      const newZoom = Math.max(0.3, Math.min(8, zoom * factor));
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      // Zoom toward cursor
      const cx = width / 2 + panX;
      const cy = height / 2 + panY;
      panX = mx - (mx - cx) * (newZoom / zoom) - width / 2;
      panY = my - (my - cy) * (newZoom / zoom) - height / 2;
      zoom = newZoom;
      draw();
    };

    draw();
    return () => {
      canvas.onmousedown = null;
      canvas.onmousemove = null;
      canvas.onmouseup = null;
      canvas.onmouseleave = null;
      canvas.onclick = null;
      canvas.onwheel = null;
      drawRef.current = null;
    };
  }, [points, onHoverNode, onSelectNode]);

  useEffect(() => { if (drawRef.current) drawRef.current(); }, [selectedNodeIds, showAllLabels]);

  const visibleTraditions = useMemo(() => {
    const s = new Set<string>();
    points.forEach(p => { if (p.figure.tradition) s.add(p.figure.tradition); });
    return [...s].sort();
  }, [points]);

  return (
    <div className="relative w-full h-full">
      <canvas ref={canvasRef} className="w-full h-full" data-testid="canvas-umap" />
      {computing && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[#0B0626]/80 pointer-events-none">
          <div className="w-8 h-8 border-2 border-[#8F00FF]/30 border-t-[#03FF9B] rounded-full animate-spin" />
          <span className="text-shadows-text/60 text-xs">Computing similarity map…</span>
          <span className="text-shadows-text/30 text-[10px]">Projecting {figures.length} figures across shared traits</span>
        </div>
      )}
      <div className="absolute top-4 right-4 flex items-center gap-2 z-20" data-testid="panel-umap-controls">
        <div className="flex items-center gap-1 bg-black/60 border border-white/10 rounded px-2 py-1">
          <span className="text-[9px] text-shadows-text/50">Neighbors</span>
          <input
            type="range" min={5} max={50} step={1}
            value={neighbors}
            onChange={(e) => setNeighbors(parseInt(e.target.value))}
            className="w-20 accent-[#8F00FF]"
            data-testid="slider-umap-neighbors"
          />
          <span className="text-[9px] text-shadows-text/70 w-5 text-right">{neighbors}</span>
        </div>
        <div className="flex items-center gap-1 bg-black/60 border border-white/10 rounded px-2 py-1">
          <span className="text-[9px] text-shadows-text/50">Spread</span>
          <input
            type="range" min={1} max={50} step={1}
            value={Math.round(minDist * 100)}
            onChange={(e) => setMinDist(parseInt(e.target.value) / 100)}
            className="w-20 accent-[#8F00FF]"
            data-testid="slider-umap-mindist"
          />
          <span className="text-[9px] text-shadows-text/70 w-7 text-right">{minDist.toFixed(2)}</span>
        </div>
        <button
          onClick={() => setShowAllLabels(v => !v)}
          className={`px-2 py-1 rounded text-[9px] border transition-colors ${showAllLabels ? "bg-[#8F00FF]/30 border-[#8F00FF]/40 text-shadows-text/80" : "bg-black/40 border-white/10 text-shadows-text/40"}`}
          data-testid="button-umap-labels"
          title="When ON, every figure tries to show its name (overlapping ones are skipped). When OFF, only the most-mentioned figures are labeled."
        >
          {showAllLabels ? "All labels" : "Top labels"}
        </button>
      </div>
      {visibleTraditions.length > 0 && (
        <div className="absolute bottom-3 right-3 bg-black/60 border border-white/10 rounded px-2 py-2 max-w-[200px]" data-testid="legend-umap">
          <div className="text-[9px] text-shadows-text/50 mb-1 uppercase tracking-wider">Traditions</div>
          <div className="grid grid-cols-2 gap-x-2 gap-y-0.5">
            {visibleTraditions.map(t => (
              <div key={t} className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: TRADITION_COLORS[t] || "#E0DCE6" }} />
                <span className="text-[9px] text-shadows-text/60">{t}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

const DICHOTOMY_COLORS = [
  "#8F00FF", "#03FF9B", "#FFB800", "#FF4081",
  "#4A7BFF", "#FF6B35", "#00BCD4", "#B388FF",
  "#7FFF00", "#FF8A65", "#E53935", "#F48FB1",
  "#D4A574", "#FFD700", "#B71C1C", "#C0C0C0",
];

export function DichotomyView({
  figures,
  dichotomyDepth,
  dichotomyThreshold,
  onSelectNode,
  onHoverNode,
  selectedNodeIds,
  enabledCategories,
  useSupersets,
  relationEdges,
}: {
  figures: Node[];
  dichotomyDepth: number;
  dichotomyThreshold: number;
  onSelectNode: (n: Node) => void;
  onHoverNode: (n: any) => void;
  selectedNodeIds: Set<number>;
  enabledCategories?: Set<string>;
  useSupersets?: Set<string>;
  relationEdges: RelationEdge[];
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const transformRef = useRef({ x: 0, y: 0, k: 1 });
  const selectedNodeIdsRef = useRef(selectedNodeIds);
  const relationEdgesRef = useRef(relationEdges);
  const drawRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    selectedNodeIdsRef.current = selectedNodeIds;
  }, [selectedNodeIds]);
  relationEdgesRef.current = relationEdges;

  const dichotomyResult = useMemo(() => {
    if (!figures || figures.length === 0) return [];
    return findDichotomies(figures, dichotomyDepth, dichotomyThreshold, enabledCategories, useSupersets);
  }, [figures, dichotomyDepth, dichotomyThreshold, enabledCategories, useSupersets]);

  const leafGroups = useMemo(() => {
    return flattenDichotomyGroups(dichotomyResult);
  }, [dichotomyResult]);

  interface HierBox {
    group: DichotomyGroup;
    rect: { x: number; y: number; w: number; h: number };
    depth: number;
    color: string;
    children: HierBox[];
    leafIndex: number;
  }

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || dichotomyResult.length === 0) return;

    const container = canvas.parentElement;
    if (!container) return;
    const width = container.clientWidth;
    const height = container.clientHeight;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    const ctx = canvas.getContext("2d")!;
    canvas.style.width = width + "px";
    canvas.style.height = height + "px";
    ctx.scale(dpr, dpr);

    interface CellRect {
      x: number; y: number; w: number; h: number;
    }

    interface SimNode {
      id: string;
      nodeId: number;
      label: string;
      x: number;
      y: number;
      leafIdx: number;
      original: Node;
    }

    function countLeafFigures(g: DichotomyGroup): number {
      if (!g.children || g.children.length === 0) return g.figures.length;
      return g.children.reduce((sum, c) => sum + countLeafFigures(c), 0);
    }

    const allBoxes: HierBox[] = [];
    let leafCounter = { val: 0 };

    function buildHierarchy(
      groups: DichotomyGroup[],
      rect: CellRect,
      depth: number,
      colorIdx: { val: number }
    ) {
      if (groups.length === 0) return;

      if (groups.length === 1 && (!groups[0].children || groups[0].children.length === 0)) {
        const color = DICHOTOMY_COLORS[colorIdx.val % DICHOTOMY_COLORS.length];
        colorIdx.val++;
        const box: HierBox = {
          group: groups[0], rect: { ...rect }, depth, color, children: [],
          leafIndex: leafCounter.val++,
        };
        allBoxes.push(box);
        return;
      }

      if (groups.length === 2) {
        const a = groups[0];
        const b = groups[1];
        const aCount = countLeafFigures(a);
        const bCount = countLeafFigures(b);
        const ratio = aCount / Math.max(1, aCount + bCount);
        const gap = 8;
        const splitHorizontally = depth % 2 === 0;
        if (splitHorizontally) {
          const splitX = rect.x + rect.w * ratio;
          const rA: CellRect = { x: rect.x, y: rect.y, w: splitX - rect.x - gap / 2, h: rect.h };
          const rB: CellRect = { x: splitX + gap / 2, y: rect.y, w: rect.x + rect.w - splitX - gap / 2, h: rect.h };
          buildGroupHierarchy(a, rA, depth, colorIdx);
          buildGroupHierarchy(b, rB, depth, colorIdx);
        } else {
          const splitY = rect.y + rect.h * ratio;
          const rA: CellRect = { x: rect.x, y: rect.y, w: rect.w, h: splitY - rect.y - gap / 2 };
          const rB: CellRect = { x: rect.x, y: splitY + gap / 2, w: rect.w, h: rect.y + rect.h - splitY - gap / 2 };
          buildGroupHierarchy(a, rA, depth, colorIdx);
          buildGroupHierarchy(b, rB, depth, colorIdx);
        }
      }
    }

    function buildGroupHierarchy(g: DichotomyGroup, rect: CellRect, depth: number, colorIdx: { val: number }) {
      const color = DICHOTOMY_COLORS[colorIdx.val % DICHOTOMY_COLORS.length];
      const hasChildren = g.children && g.children.length > 0;

      if (hasChildren) {
        const headerH = Math.max(28, Math.min(36, rect.h * 0.08));
        const pad = 6;
        const box: HierBox = {
          group: g, rect: { ...rect }, depth, color, children: [],
          leafIndex: -1,
        };
        allBoxes.push(box);

        const innerRect: CellRect = {
          x: rect.x + pad,
          y: rect.y + headerH + pad / 2,
          w: rect.w - pad * 2,
          h: rect.h - headerH - pad * 1.5,
        };
        buildHierarchy(g.children!, innerRect, depth + 1, colorIdx);
      } else {
        colorIdx.val++;
        const box: HierBox = {
          group: g, rect: { ...rect }, depth, color, children: [],
          leafIndex: leafCounter.val++,
        };
        allBoxes.push(box);
      }
    }

    const rootRect: CellRect = { x: 8, y: 56, w: width - 16, h: height - 64 };
    buildHierarchy(dichotomyResult, rootRect, 0, { val: 0 });

    const parentBoxes = allBoxes.filter(b => b.leafIndex === -1);
    const leafBoxes = allBoxes.filter(b => b.leafIndex >= 0);

    const allSimNodes: SimNode[] = [];

    for (const box of leafBoxes) {
      const { rect } = box;
      const labelH = 32;
      const cx = rect.x + rect.w / 2;
      const cy = rect.y + labelH + (rect.h - labelH) / 2;
      const areaW = rect.w - 16;
      const areaH = rect.h - labelH - 8;
      const spread = Math.min(areaW, areaH) * 0.35;
      for (const fig of box.group.figures) {
        const angle = Math.random() * Math.PI * 2;
        const r = Math.sqrt(Math.random()) * spread;
        allSimNodes.push({
          id: `fig-${fig.id}`,
          nodeId: fig.id,
          label: fig.name,
          x: cx + Math.cos(angle) * r,
          y: cy + Math.sin(angle) * r,
          leafIdx: box.leafIndex,
          original: fig,
        });
      }
    }

    const nodeR = allSimNodes.length > 1000 ? 2.5 : allSimNodes.length > 500 ? 3 : 4;

    const leafRectMap = new Map<number, CellRect>();
    for (const b of leafBoxes) leafRectMap.set(b.leafIndex, b.rect);

    const simulation = d3.forceSimulation(allSimNodes as any)
      .force("charge", d3.forceManyBody().strength(-8))
      .force("collision", d3.forceCollide().radius(nodeR + 0.5))
      .force("x", d3.forceX((d: any) => {
        const r = leafRectMap.get(d.leafIdx)!;
        return r.x + r.w / 2;
      }).strength(0.6))
      .force("y", d3.forceY((d: any) => {
        const r = leafRectMap.get(d.leafIdx)!;
        return r.y + 32 + (r.h - 32) / 2;
      }).strength(0.6))
      .alphaDecay(0.04)
      .velocityDecay(0.45);

    simulation.stop();
    for (let i = 0; i < 200; i++) simulation.tick();

    for (const n of allSimNodes) {
      const r = leafRectMap.get(n.leafIdx)!;
      const nx = n as any;
      nx.x = Math.max(r.x + 8, Math.min(r.x + r.w - 8, nx.x));
      nx.y = Math.max(r.y + 36, Math.min(r.y + r.h - 6, nx.y));
    }

    let currentHovered: SimNode | null = null;

    function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, cr: number) {
      ctx.beginPath();
      ctx.moveTo(x + cr, y);
      ctx.lineTo(x + w - cr, y);
      ctx.quadraticCurveTo(x + w, y, x + w, y + cr);
      ctx.lineTo(x + w, y + h - cr);
      ctx.quadraticCurveTo(x + w, y + h, x + w - cr, y + h);
      ctx.lineTo(x + cr, y + h);
      ctx.quadraticCurveTo(x, y + h, x, y + h - cr);
      ctx.lineTo(x, y + cr);
      ctx.quadraticCurveTo(x, y, x + cr, y);
      ctx.closePath();
    }

    function draw() {
      ctx.save();
      ctx.clearRect(0, 0, width, height);

      const grad = ctx.createLinearGradient(0, 0, width, height);
      grad.addColorStop(0, "#0B0626");
      grad.addColorStop(1, "#0C0042");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);

      const t = transformRef.current;
      ctx.translate(t.x, t.y);
      ctx.scale(t.k, t.k);

      for (const box of parentBoxes) {
        const { rect, color, depth } = box;
        const cr = 12 - depth * 2;
        roundedRect(ctx, rect.x, rect.y, rect.w, rect.h, Math.max(4, cr));
        ctx.fillStyle = color;
        ctx.globalAlpha = 0.04 + depth * 0.01;
        ctx.fill();
        ctx.strokeStyle = color;
        ctx.globalAlpha = 0.25 - depth * 0.05;
        ctx.lineWidth = 2 - depth * 0.5;
        ctx.stroke();

        const fontSize = depth === 0
          ? Math.max(12, Math.min(22, rect.w / 14))
          : Math.max(10, Math.min(16, rect.w / 16));
        ctx.font = `bold ${fontSize}px 'Cinzel Decorative', serif`;
        ctx.fillStyle = color;
        ctx.globalAlpha = 0.85;
        ctx.textAlign = "left";

        let labelText = box.group.traitLabel.toUpperCase();
        const maxLabelW = rect.w - 24;
        if (ctx.measureText(labelText).width > maxLabelW) {
          while (labelText.length > 6 && ctx.measureText(labelText).width > maxLabelW) {
            labelText = labelText.slice(0, -3) + "…";
          }
        }
        ctx.fillText(labelText, rect.x + 12, rect.y + fontSize + 6);

        const totalFigs = countLeafFigures(box.group);
        ctx.font = `${Math.max(8, fontSize * 0.55)}px 'Sofia Pro Light', sans-serif`;
        ctx.globalAlpha = 0.4;
        ctx.fillText(`${totalFigs} figures`, rect.x + 12, rect.y + fontSize + 6 + fontSize * 0.65);
      }

      for (const box of leafBoxes) {
        const { rect, color } = box;
        roundedRect(ctx, rect.x, rect.y, rect.w, rect.h, 6);
        ctx.fillStyle = color;
        ctx.globalAlpha = 0.03;
        ctx.fill();
        ctx.strokeStyle = color;
        ctx.globalAlpha = 0.12;
        ctx.lineWidth = 1;
        ctx.stroke();

        const fontSize = Math.max(8, Math.min(13, rect.w / 14));
        ctx.font = `bold ${fontSize}px 'Cinzel Decorative', serif`;
        ctx.fillStyle = color;
        ctx.globalAlpha = 0.8;
        ctx.textAlign = "center";

        let labelText = box.group.traitLabel.toUpperCase();
        const maxLabelW = rect.w - 12;
        if (ctx.measureText(labelText).width > maxLabelW) {
          while (labelText.length > 6 && ctx.measureText(labelText).width > maxLabelW) {
            labelText = labelText.slice(0, -3) + "…";
          }
        }
        ctx.fillText(labelText, rect.x + rect.w / 2, rect.y + fontSize + 6);

        ctx.font = `${Math.max(7, fontSize * 0.6)}px 'Sofia Pro Light', sans-serif`;
        ctx.globalAlpha = 0.4;
        ctx.fillText(`${box.group.figures.length}`, rect.x + rect.w / 2, rect.y + fontSize + 6 + fontSize * 0.7);
      }

      ctx.globalAlpha = 1;

      const dicNodeMap = new Map<string, SimNode>();
      for (const n of allSimNodes) dicNodeMap.set(n.id, n);
      for (const re of relationEdgesRef.current) {
        const sn = dicNodeMap.get(re.sourceId);
        const tn = dicNodeMap.get(re.targetId);
        if (!sn || !tn) continue;
        const sx2 = (sn as any).x, sy2 = (sn as any).y;
        const tx2 = (tn as any).x, ty2 = (tn as any).y;
        if (sx2 == null || tx2 == null) continue;
        ctx.beginPath();
        ctx.moveTo(sx2, sy2);
        ctx.lineTo(tx2, ty2);
        ctx.strokeStyle = RELATION_COLORS[re.relationType];
        ctx.globalAlpha = 0.3;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      ctx.globalAlpha = 1;

      const hoveredId = currentHovered?.id;
      const dicSelIds = selectedNodeIdsRef.current;
      const dicHasSelection = dicSelIds.size > 0;

      for (const n of allSimNodes) {
        const nx = (n as any).x;
        const ny = (n as any).y;
        const isHovered = n.id === hoveredId;
        const isSelected = dicSelIds.has(n.nodeId);
        const leafBox = leafBoxes.find(b => b.leafIndex === n.leafIdx);
        const groupColor = leafBox?.color || "#8F00FF";
        const tradColor = getTraditionColor(n.original.tradition);
        const dimmed = dicHasSelection && !isSelected && !isHovered;

        const r = isHovered ? nodeR + 3 : isSelected ? nodeR + 2 : nodeR;
        ctx.beginPath();
        ctx.arc(nx, ny, r, 0, Math.PI * 2);
        ctx.fillStyle = tradColor;
        ctx.globalAlpha = dimmed ? 0.15 : isHovered || isSelected ? 1 : 0.7;
        ctx.fill();

        if (isSelected) {
          ctx.strokeStyle = "#FFD700";
          ctx.lineWidth = 2;
          ctx.globalAlpha = 0.9;
          ctx.stroke();
        } else if (isHovered) {
          ctx.strokeStyle = groupColor;
          ctx.lineWidth = 1.5;
          ctx.globalAlpha = 0.8;
          ctx.stroke();
        }

        if ((isHovered || isSelected) || (t.k > 1.5)) {
          if (isHovered || isSelected || t.k > 2) {
            ctx.font = (isHovered || isSelected) ? "bold 10px 'Cinzel Decorative', serif" : "8px 'Sofia Pro Light', sans-serif";
            ctx.fillStyle = isSelected ? "#FFD700" : tradColor;
            ctx.globalAlpha = dimmed ? 0 : (isHovered || isSelected) ? 1 : 0.5;
            ctx.textAlign = "center";
            ctx.fillText(n.label, nx, ny - r - 4);
          }
        }
      }

      ctx.globalAlpha = 1;
      ctx.restore();
    }

    drawRef.current = draw;
    draw();

    const zoomBehavior = d3.zoom<HTMLCanvasElement, unknown>()
      .scaleExtent([0.1, 8])
      .on("zoom", (event) => {
        transformRef.current = event.transform;
        draw();
      });

    d3.select(canvas).call(zoomBehavior);

    function getNodeAt(px: number, py: number): SimNode | null {
      const t = transformRef.current;
      const x = (px - t.x) / t.k;
      const y = (py - t.y) / t.k;
      for (let i = allSimNodes.length - 1; i >= 0; i--) {
        const n = allSimNodes[i];
        const dx = x - (n as any).x;
        const dy = y - (n as any).y;
        if (dx * dx + dy * dy < (nodeR + 4) * (nodeR + 4)) {
          return n;
        }
      }
      return null;
    }

    canvas.onmousemove = (e) => {
      const rect = canvas.getBoundingClientRect();
      const node = getNodeAt(e.clientX - rect.left, e.clientY - rect.top);
      if (node !== currentHovered) {
        currentHovered = node;
        onHoverNode(node ? { ...node, isCharacter: true } : null);
        canvas.style.cursor = node ? "pointer" : "default";
        draw();
      }
    };

    canvas.onclick = (e) => {
      const rect = canvas.getBoundingClientRect();
      const node = getNodeAt(e.clientX - rect.left, e.clientY - rect.top);
      if (node) {
        onSelectNode(node.original);
      }
    };

    canvas.onmouseleave = () => {
      currentHovered = null;
      onHoverNode(null);
      draw();
    };

    return () => {
      simulation.stop();
      canvas.onmousemove = null;
      canvas.onclick = null;
      canvas.onmouseleave = null;
      drawRef.current = null;
    };
  }, [leafGroups, dichotomyResult]);

  useEffect(() => {
    if (drawRef.current) drawRef.current();
  }, [selectedNodeIds, relationEdges]);

  if (dichotomyResult.length === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <p className="text-shadows-text/40 text-sm" data-testid="text-no-dichotomy">No dichotomies found at this threshold. Try lowering the exclusion threshold.</p>
      </div>
    );
  }

  return (
    <div className="w-full h-full relative">
      <canvas ref={canvasRef} className="w-full h-full" data-testid="canvas-dichotomy" />
    </div>
  );
}

function RelationsView({
  nodes,
  edges,
  onSelectNode,
  onHoverNode,
  selectedNodeIds,
}: {
  nodes: Node[];
  edges: Edge[];
  onSelectNode: (node: Node | null) => void;
  onHoverNode: (node: any) => void;
  selectedNodeIds: Set<number>;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawRef = useRef<(() => void) | null>(null);
  const selectedNodeIdsRef = useRef(selectedNodeIds);
  selectedNodeIdsRef.current = selectedNodeIds;
  const [relFilters, setRelFilters] = useState<Set<RelationType>>(() => new Set(RELATION_TYPES));
  const relFiltersRef = useRef(relFilters);
  relFiltersRef.current = relFilters;

  const allTraditions = useMemo(() => {
    const s = new Set<string>();
    nodes.forEach(n => { if (n.tradition) s.add(n.tradition); });
    return Array.from(s).sort();
  }, [nodes]);
  const [tradFilters, setTradFilters] = useState<Set<string>>(() => new Set(allTraditions));
  const tradFiltersRef = useRef(tradFilters);
  tradFiltersRef.current = tradFilters;

  useEffect(() => {
    setTradFilters(new Set(allTraditions));
  }, [allTraditions]);

  const toggleRelFilter = useCallback((rt: RelationType) => {
    setRelFilters(prev => {
      const next = new Set(prev);
      if (next.has(rt)) next.delete(rt); else next.add(rt);
      return next;
    });
  }, []);

  const toggleTradFilter = useCallback((t: string) => {
    setTradFilters(prev => {
      const next = new Set(prev);
      if (next.has(t)) next.delete(t); else next.add(t);
      return next;
    });
  }, []);

  useEffect(() => {
    if (!canvasRef.current) return;

    const allRelEdges = edges.filter(e => RELATION_TYPES.includes(e.relationType as RelationType));
    const allConnectedIds = new Set<number>();
    for (const e of allRelEdges) {
      allConnectedIds.add(e.sourceNodeId);
      allConnectedIds.add(e.targetNodeId);
    }
    const relNodes = nodes.filter(n => allConnectedIds.has(n.id));
    if (relNodes.length === 0) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const container = canvas.parentElement;
    if (!container) return;
    const dpr = window.devicePixelRatio || 1;
    const width = container.clientWidth;
    const height = container.clientHeight;

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = width + "px";
    canvas.style.height = height + "px";
    ctx.scale(dpr, dpr);

    const simNodes = relNodes.map(n => ({
      id: `fig-${n.id}`,
      label: n.name,
      original: n,
      tradition: n.tradition,
      x: 0,
      y: 0,
    }));
    const simNodeMap = new Map<string, any>();
    simNodes.forEach(n => simNodeMap.set(n.id, n));

    const allSimEdges = allRelEdges.map(e => ({
      source: simNodeMap.get(`fig-${e.sourceNodeId}`),
      target: simNodeMap.get(`fig-${e.targetNodeId}`),
      relationType: e.relationType as RelationType,
    })).filter(e => e.source && e.target);

    const deduped = new Map<string, typeof allSimEdges[0]>();
    for (const e of allSimEdges) {
      const key = [e.source.id, e.target.id].sort().join("|") + "|" + e.relationType;
      if (!deduped.has(key)) deduped.set(key, e);
    }
    const allUniqueEdges = Array.from(deduped.values());

    const parentMap = new Map<string, string>();
    for (const n of simNodes) parentMap.set(n.id, n.id);
    function find(x: string): string {
      while (parentMap.get(x) !== x) {
        parentMap.set(x, parentMap.get(parentMap.get(x)!)!);
        x = parentMap.get(x)!;
      }
      return x;
    }
    function union(a: string, b: string) {
      const ra = find(a), rb = find(b);
      if (ra !== rb) parentMap.set(ra, rb);
    }
    for (const e of allUniqueEdges) {
      union(e.source.id, e.target.id);
    }

    const components = new Map<string, typeof simNodes>();
    for (const n of simNodes) {
      const root = find(n.id);
      if (!components.has(root)) components.set(root, []);
      components.get(root)!.push(n);
    }
    const componentEdges = new Map<string, typeof allUniqueEdges>();
    for (const e of allUniqueEdges) {
      const root = find(e.source.id);
      if (!componentEdges.has(root)) componentEdges.set(root, []);
      componentEdges.get(root)!.push(e);
    }

    const componentList = Array.from(components.entries())
      .map(([root, cNodes]) => ({ root, nodes: cNodes, edges: componentEdges.get(root) || [] }))
      .sort((a, b) => b.nodes.length - a.nodes.length);

    for (const comp of componentList) {
      const cn = comp.nodes;
      const ce = comp.edges;
      const count = cn.length;
      const spread = Math.max(80, Math.sqrt(count) * 60);

      for (const n of cn) {
        n.x = (Math.random() - 0.5) * spread;
        n.y = (Math.random() - 0.5) * spread;
      }

      const baseDist = count > 20 ? 50 : count > 10 ? 65 : count > 4 ? 80 : 100;
      const iters = Math.min(600, 200 + count * 10);

      for (let iter = 0; iter < iters; iter++) {
        const alpha = Math.max(0.001, 1 - iter / iters);
        for (let i = 0; i < cn.length; i++) {
          for (let j = i + 1; j < cn.length; j++) {
            const a = cn[i], b = cn[j];
            let dx = b.x - a.x, dy = b.y - a.y;
            let dist = Math.sqrt(dx * dx + dy * dy) || 1;
            const repulse = (count > 20 ? -400 : count > 10 ? -600 : -900) * alpha / (dist * dist);
            const fx = dx / dist * repulse, fy = dy / dist * repulse;
            a.x += fx; a.y += fy;
            b.x -= fx; b.y -= fy;
          }
        }
        for (const e of ce) {
          const a = e.source, b = e.target;
          let dx = b.x - a.x, dy = b.y - a.y;
          let dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const strength = 0.12 * alpha;
          const delta = (dist - baseDist) * strength * 0.5;
          const ux = dx / dist, uy = dy / dist;
          a.x += ux * delta; a.y += uy * delta;
          b.x -= ux * delta; b.y -= uy * delta;
        }
        for (const n of cn) {
          n.x *= 0.998; n.y *= 0.998;
        }
      }
    }

    const compBounds = componentList.map(comp => {
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const n of comp.nodes) {
        minX = Math.min(minX, n.x);
        minY = Math.min(minY, n.y);
        maxX = Math.max(maxX, n.x);
        maxY = Math.max(maxY, n.y);
      }
      const pad = 30;
      return { comp, w: maxX - minX + pad * 2, h: maxY - minY + pad * 2, cx: (minX + maxX) / 2, cy: (minY + maxY) / 2 };
    });

    const gap = 60;
    const placed: { x: number; y: number; w: number; h: number }[] = [];

    for (const cb of compBounds) {
      let bestX = 0, bestY = 0, bestDist = Infinity;
      const spiralStep = Math.max(40, cb.w * 0.3);

      if (placed.length === 0) {
        bestX = 0; bestY = 0;
      } else {
        let found = false;
        for (let radius = 0; radius < 8000 && !found; radius += spiralStep) {
          const steps = Math.max(8, Math.floor(2 * Math.PI * radius / spiralStep));
          for (let s = 0; s < steps; s++) {
            const angle = (2 * Math.PI * s) / steps;
            const tx = Math.cos(angle) * radius;
            const ty = Math.sin(angle) * radius;
            let overlaps = false;
            for (const p of placed) {
              if (Math.abs(tx - p.x) < (cb.w + p.w) / 2 + gap &&
                  Math.abs(ty - p.y) < (cb.h + p.h) / 2 + gap) {
                overlaps = true;
                break;
              }
            }
            if (!overlaps) {
              const d = tx * tx + ty * ty;
              if (d < bestDist) {
                bestDist = d;
                bestX = tx; bestY = ty;
                found = true;
              }
            }
          }
        }
      }

      const offsetX = bestX - cb.cx;
      const offsetY = bestY - cb.cy;
      for (const n of cb.comp.nodes) {
        n.x += offsetX;
        n.y += offsetY;
      }
      placed.push({ x: bestX, y: bestY, w: cb.w, h: cb.h });
    }

    let panX = 0, panY = 0;
    let zoom = 1;
    let isDragging = false;
    let lastMx = 0, lastMy = 0;
    let currentHovered: { node: any; sx: number; sy: number } | null = null;
    let screenNodes: { sx: number; sy: number; node: any }[] = [];

    function toScreen(x: number, y: number) {
      return {
        sx: width / 2 + (x + panX) * zoom,
        sy: height / 2 + (y + panY) * zoom,
      };
    }

    function draw() {
      ctx.save();
      ctx.clearRect(0, 0, width, height);

      const grad = ctx.createLinearGradient(0, 0, width, height);
      grad.addColorStop(0, "#0B0626");
      grad.addColorStop(1, "#0C0042");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);

      const activeFilters = relFiltersRef.current;
      const activeTraditions = tradFiltersRef.current;
      const visibleEdges = allUniqueEdges.filter(e =>
        activeFilters.has(e.relationType) &&
        activeTraditions.has(e.source.tradition) &&
        activeTraditions.has(e.target.tradition)
      );

      const visibleNodeIds = new Set<string>();
      for (const e of visibleEdges) {
        visibleNodeIds.add(e.source.id);
        visibleNodeIds.add(e.target.id);
      }

      const selIds = selectedNodeIdsRef.current;
      const hasSelection = selIds.size > 0;
      const selectedSimIds = new Set<string>();
      if (hasSelection) {
        for (const n of simNodes) {
          if (n.original && selIds.has(n.original.id)) selectedSimIds.add(n.id);
        }
      }

      const hoveredId = currentHovered?.node?.id;
      const connectedIds = new Set<string>();
      if (hoveredId) {
        for (const e of visibleEdges) {
          if (e.source.id === hoveredId || e.target.id === hoveredId) {
            connectedIds.add(e.source.id);
            connectedIds.add(e.target.id);
          }
        }
      }
      if (hasSelection) {
        for (const e of visibleEdges) {
          if (selectedSimIds.has(e.source.id)) connectedIds.add(e.target.id);
          if (selectedSimIds.has(e.target.id)) connectedIds.add(e.source.id);
        }
      }
      const anyActive = !!hoveredId || hasSelection;

      screenNodes = simNodes
        .filter(n => visibleNodeIds.has(n.id))
        .map(n => {
          const s = toScreen(n.x, n.y);
          return { ...s, node: n };
        });
      const nodeScreenMap = new Map<string, { sx: number; sy: number }>();
      for (const sn of screenNodes) {
        nodeScreenMap.set(sn.node.id, sn);
      }

      const edgesByPair = new Map<string, typeof visibleEdges>();
      for (const e of visibleEdges) {
        const pairKey = [e.source.id, e.target.id].sort().join("|");
        if (!edgesByPair.has(pairKey)) edgesByPair.set(pairKey, []);
        edgesByPair.get(pairKey)!.push(e);
      }

      for (const [, pairEdges] of edgesByPair) {
        const count = pairEdges.length;
        pairEdges.forEach((e, idx) => {
          const sp = nodeScreenMap.get(e.source.id);
          const tp = nodeScreenMap.get(e.target.id);
          if (!sp || !tp) return;

          const isHighlighted = (hoveredId && (e.source.id === hoveredId || e.target.id === hoveredId)) ||
            (hasSelection && (selectedSimIds.has(e.source.id) || selectedSimIds.has(e.target.id)));

          ctx.beginPath();
          if (count > 1) {
            const dx = tp.sx - sp.sx, dy = tp.sy - sp.sy;
            const len = Math.sqrt(dx * dx + dy * dy) || 1;
            const nx = -dy / len, ny = dx / len;
            const offset = (idx - (count - 1) / 2) * 8;
            const cx = (sp.sx + tp.sx) / 2 + nx * offset * 3;
            const cy = (sp.sy + tp.sy) / 2 + ny * offset * 3;
            ctx.moveTo(sp.sx, sp.sy);
            ctx.quadraticCurveTo(cx, cy, tp.sx, tp.sy);
          } else {
            ctx.moveTo(sp.sx, sp.sy);
            ctx.lineTo(tp.sx, tp.sy);
          }

          ctx.strokeStyle = RELATION_COLORS[e.relationType];
          ctx.globalAlpha = isHighlighted ? 0.85 : anyActive ? 0.06 : 0.4;
          ctx.lineWidth = isHighlighted ? 2.5 : 1.2;
          ctx.stroke();

          if (isHighlighted && count <= 4) {
            const midX = count > 1
              ? (sp.sx + tp.sx) / 2 + (-((tp.sy - sp.sy) / (Math.sqrt((tp.sx-sp.sx)**2+(tp.sy-sp.sy)**2)||1))) * ((idx - (count-1)/2) * 8) * 3
              : (sp.sx + tp.sx) / 2;
            const midY = count > 1
              ? (sp.sy + tp.sy) / 2 + (((tp.sx - sp.sx) / (Math.sqrt((tp.sx-sp.sx)**2+(tp.sy-sp.sy)**2)||1))) * ((idx - (count-1)/2) * 8) * 3
              : (sp.sy + tp.sy) / 2;
            ctx.font = "8px 'Sofia Pro Light', sans-serif";
            ctx.fillStyle = RELATION_COLORS[e.relationType];
            ctx.globalAlpha = 0.85;
            ctx.textAlign = "center";
            ctx.fillText(RELATION_LABELS[e.relationType], midX, midY - 3);
          }
        });
      }

      for (const sn of screenNodes) {
        const n = sn.node;
        const isHovered = n.id === hoveredId;
        const isSelected = n.original && selIds.has(n.original.id);
        const isConnected = connectedIds.has(n.id);
        const dimmed = anyActive && !isHovered && !isSelected && !isConnected;

        const tradColor = TRADITION_COLORS[n.tradition] || "#E0DCE6";
        const baseR = 2.5 * zoom;
        const r = isHovered ? baseR + 2 : isSelected ? baseR + 1.5 : Math.max(1.5, baseR);

        ctx.beginPath();
        ctx.arc(sn.sx, sn.sy, r, 0, Math.PI * 2);
        ctx.fillStyle = tradColor;
        ctx.globalAlpha = dimmed ? 0.08 : 0.9;
        ctx.fill();

        if (isSelected) {
          ctx.strokeStyle = "#FFD700";
          ctx.lineWidth = 1.5;
          ctx.globalAlpha = 0.9;
          ctx.stroke();
        } else if (isHovered || isConnected) {
          ctx.strokeStyle = isHovered ? "#03FF9B" : "#8F00FF";
          ctx.lineWidth = isHovered ? 1.5 : 1;
          ctx.globalAlpha = 0.7;
          ctx.stroke();
        }

        const fontSize = isHovered || isSelected ? 10 : Math.max(7, 8 * zoom);
        if (!dimmed || isSelected) {
          ctx.font = (isHovered || isSelected) ? `bold ${fontSize}px 'Cinzel Decorative', serif` : `${fontSize}px 'Cinzel Decorative', serif`;
          ctx.fillStyle = isSelected ? "#FFD700" : "#E0DCE6";
          ctx.globalAlpha = (isHovered || isSelected) ? 1 : isConnected ? 0.85 : zoom > 0.6 ? 0.55 : 0;
          ctx.textAlign = "center";
          ctx.fillText(n.label, sn.sx, sn.sy - r - 3);
        }
      }

      if (activeFilters.has("trinity")) {
        const trinityEdges = visibleEdges.filter(e => e.relationType === "trinity");
        if (trinityEdges.length > 0) {
          const trinityNodeIds = new Set<string>();
          for (const e of trinityEdges) {
            trinityNodeIds.add(e.source.id);
            trinityNodeIds.add(e.target.id);
          }
          const trinityParent = new Map<string, string>();
          for (const id of trinityNodeIds) trinityParent.set(id, id);
          function tFind(x: string): string {
            while (trinityParent.get(x) !== x) { trinityParent.set(x, trinityParent.get(trinityParent.get(x)!)!); x = trinityParent.get(x)!; }
            return x;
          }
          for (const e of trinityEdges) {
            const ra = tFind(e.source.id), rb = tFind(e.target.id);
            if (ra !== rb) trinityParent.set(ra, rb);
          }
          const trinityGroups = new Map<string, string[]>();
          for (const id of trinityNodeIds) {
            const root = tFind(id);
            if (!trinityGroups.has(root)) trinityGroups.set(root, []);
            trinityGroups.get(root)!.push(id);
          }

          const TRINITY_NAMES: Record<string, string> = {};
          for (const sn of screenNodes) {
            const name = sn.node.label?.toLowerCase() || "";
            if (name === "badb" || name === "macha" || name === "nemain") {
              const root = tFind(sn.node.id);
              TRINITY_NAMES[root] = "The Morrígán";
            }
          }

          for (const [root, memberIds] of trinityGroups) {
            const memberScreens = screenNodes.filter(sn => memberIds.includes(sn.node.id));
            if (memberScreens.length < 2) continue;

            let cx = 0, cy = 0;
            let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
            for (const ms of memberScreens) {
              cx += ms.sx; cy += ms.sy;
              minX = Math.min(minX, ms.sx); minY = Math.min(minY, ms.sy);
              maxX = Math.max(maxX, ms.sx); maxY = Math.max(maxY, ms.sy);
            }
            cx /= memberScreens.length;
            cy /= memberScreens.length;

            const pad = 25 * zoom;
            ctx.beginPath();
            ctx.ellipse(cx, cy, (maxX - minX) / 2 + pad, (maxY - minY) / 2 + pad, 0, 0, Math.PI * 2);
            ctx.strokeStyle = RELATION_COLORS["trinity"];
            ctx.globalAlpha = 0.25;
            ctx.lineWidth = 1;
            ctx.setLineDash([4, 4]);
            ctx.stroke();
            ctx.setLineDash([]);

            const groupName = TRINITY_NAMES[root] || "Trinity";
            const labelSize = Math.max(9, 11 * zoom);
            ctx.font = `italic ${labelSize}px 'Cinzel Decorative', serif`;
            ctx.fillStyle = RELATION_COLORS["trinity"];
            ctx.globalAlpha = anyActive ? 0.15 : 0.55;
            ctx.textAlign = "center";
            ctx.fillText(groupName, cx, minY - pad - 4);
          }
        }
      }

      if (currentHovered) {
        const hn = currentHovered.node;
        const connEdges = visibleEdges.filter(e => e.source.id === hn.id || e.target.id === hn.id);
        if (connEdges.length > 0) {
          const tooltipLines = connEdges.map(e => {
            const other = e.source.id === hn.id ? e.target : e.source;
            return `${RELATION_LABELS[e.relationType]} → ${other.label}`;
          });

          ctx.font = "bold 10px 'Cinzel Decorative', serif";
          const titleW = ctx.measureText(hn.label).width;
          ctx.font = "9px 'Sofia Pro Light', sans-serif";
          const lineWidths = tooltipLines.map(l => ctx.measureText(l).width);
          const boxW = Math.max(titleW, ...lineWidths) + 20;
          const lineH = 14;
          const boxH = 26 + tooltipLines.length * lineH;

          let bx = currentHovered.sx - boxW / 2;
          let by = currentHovered.sy - boxH - 16;
          if (bx < 4) bx = 4;
          if (bx + boxW > width - 4) bx = width - boxW - 4;
          if (by < 4) by = currentHovered.sy + 16;

          ctx.globalAlpha = 0.92;
          ctx.fillStyle = "#0B0626";
          ctx.strokeStyle = "#350A8C";
          ctx.lineWidth = 1;
          const cr = 5;
          ctx.beginPath();
          ctx.moveTo(bx + cr, by);
          ctx.lineTo(bx + boxW - cr, by);
          ctx.quadraticCurveTo(bx + boxW, by, bx + boxW, by + cr);
          ctx.lineTo(bx + boxW, by + boxH - cr);
          ctx.quadraticCurveTo(bx + boxW, by + boxH, bx + boxW - cr, by + boxH);
          ctx.lineTo(bx + cr, by + boxH);
          ctx.quadraticCurveTo(bx, by + boxH, bx, by + boxH - cr);
          ctx.lineTo(bx, by + cr);
          ctx.quadraticCurveTo(bx, by, bx + cr, by);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();

          ctx.globalAlpha = 1;
          ctx.font = "bold 10px 'Cinzel Decorative', serif";
          ctx.fillStyle = "#E0DCE6";
          ctx.textAlign = "left";
          ctx.fillText(hn.label, bx + 10, by + 16);

          ctx.font = "9px 'Sofia Pro Light', sans-serif";
          tooltipLines.forEach((line, i) => {
            const relType = connEdges[i].relationType;
            ctx.fillStyle = RELATION_COLORS[relType];
            ctx.fillText(line, bx + 10, by + 30 + i * lineH);
          });
        }
      }

      ctx.restore();
    }

    drawRef.current = draw;
    draw();

    const handleMouseDown = (ev: MouseEvent) => {
      isDragging = true;
      lastMx = ev.clientX;
      lastMy = ev.clientY;
    };
    const handleMouseUp = () => { isDragging = false; };
    const handleMouseMove = (ev: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const mx = ev.clientX - rect.left;
      const my = ev.clientY - rect.top;

      if (isDragging) {
        const dx = ev.clientX - lastMx;
        const dy = ev.clientY - lastMy;
        panX += dx / zoom;
        panY += dy / zoom;
        lastMx = ev.clientX;
        lastMy = ev.clientY;
        draw();
        return;
      }

      let nearest: any = null;
      let nearestDist = 15;
      for (const sn of screenNodes) {
        const dx2 = sn.sx - mx, dy2 = sn.sy - my;
        const d = Math.sqrt(dx2 * dx2 + dy2 * dy2);
        if (d < nearestDist) {
          nearest = sn;
          nearestDist = d;
        }
      }

      if (nearest) {
        canvas.style.cursor = "pointer";
        currentHovered = { node: nearest.node, sx: nearest.sx, sy: nearest.sy };
        onHoverNode(nearest.node.original);
      } else {
        canvas.style.cursor = "grab";
        currentHovered = null;
        onHoverNode(null);
      }
      draw();
    };
    const handleClick = () => {
      if (currentHovered) {
        onSelectNode(currentHovered.node.original);
      }
    };
    const handleWheel = (ev: WheelEvent) => {
      ev.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const mx = ev.clientX - rect.left;
      const my = ev.clientY - rect.top;
      const wx = (mx - width / 2) / zoom - panX;
      const wy = (my - height / 2) / zoom - panY;
      const oldZoom = zoom;
      zoom *= ev.deltaY > 0 ? 0.92 : 1.08;
      zoom = Math.max(0.1, Math.min(10, zoom));
      panX -= wx * (1 / oldZoom - 1 / zoom) * (zoom - oldZoom);
      panY -= wy * (1 / oldZoom - 1 / zoom) * (zoom - oldZoom);
      draw();
    };

    canvas.addEventListener("mousedown", handleMouseDown);
    canvas.addEventListener("mouseup", handleMouseUp);
    canvas.addEventListener("mousemove", handleMouseMove);
    canvas.addEventListener("click", handleClick);
    canvas.addEventListener("wheel", handleWheel, { passive: false });

    return () => {
      canvas.removeEventListener("mousedown", handleMouseDown);
      canvas.removeEventListener("mouseup", handleMouseUp);
      canvas.removeEventListener("mousemove", handleMouseMove);
      canvas.removeEventListener("click", handleClick);
      canvas.removeEventListener("wheel", handleWheel);
    };
  }, [nodes, edges]);

  useEffect(() => {
    if (drawRef.current) drawRef.current();
  }, [selectedNodeIds, relFilters, tradFilters]);

  return (
    <div className="w-full h-full relative">
      <canvas ref={canvasRef} className="w-full h-full" data-testid="canvas-relations-view" />
      <div className="absolute top-4 right-4 z-20 bg-[#0B0626]/80 backdrop-blur-xl border border-[#350A8C]/30 rounded-md p-3 space-y-2 max-h-[85vh] overflow-y-auto scrollbar-thin" data-testid="relations-filter-panel">
        <div className="text-[10px] uppercase tracking-wider text-shadows-text/30 mb-1">Filter Relations</div>
        <div className="flex items-center gap-1 mb-1">
          <button
            className="text-[9px] text-shadows-text/40 hover:text-shadows-text/70 transition-colors"
            onClick={() => {
              const allEnabled = RELATION_TYPES.every(rt => relFilters.has(rt));
              setRelFilters(allEnabled ? new Set() : new Set(RELATION_TYPES));
            }}
            data-testid="button-relations-toggle-all"
          >
            {RELATION_TYPES.every(rt => relFilters.has(rt)) ? "Hide all" : "Show all"}
          </button>
        </div>
        {Object.entries(RELATION_GROUPS).map(([groupKey, types]) => (
          <div key={groupKey} className="space-y-0.5">
            <div className="text-[9px] text-white/25 uppercase tracking-wider">{RELATION_GROUP_LABELS[groupKey]}</div>
            {types.map(rt => (
              <label key={rt} className="flex items-center gap-2 cursor-pointer py-0.5">
                <Checkbox
                  checked={relFilters.has(rt)}
                  onCheckedChange={() => toggleRelFilter(rt)}
                  className="h-3 w-3 border-white/20"
                  data-testid={`checkbox-rel-${rt.replace(/\s/g, "-")}`}
                />
                <span className="w-3 h-[2px] inline-block rounded" style={{ backgroundColor: RELATION_COLORS[rt] }} />
                <span className="text-[10px] text-white/60">{RELATION_LABELS[rt]}</span>
              </label>
            ))}
          </div>
        ))}
        <div className="border-t border-white/10 pt-2 mt-2">
          <div className="text-[10px] uppercase tracking-wider text-shadows-text/30 mb-1">Filter Traditions</div>
          <div className="flex items-center gap-1 mb-1">
            <button
              className="text-[9px] text-shadows-text/40 hover:text-shadows-text/70 transition-colors"
              onClick={() => {
                const allEnabled = allTraditions.every(t => tradFilters.has(t));
                setTradFilters(allEnabled ? new Set() : new Set(allTraditions));
              }}
              data-testid="button-traditions-toggle-all"
            >
              {allTraditions.every(t => tradFilters.has(t)) ? "Hide all" : "Show all"}
            </button>
          </div>
          <div className="space-y-0.5">
            {allTraditions.map(t => (
              <label key={t} className="flex items-center gap-2 cursor-pointer py-0.5">
                <Checkbox
                  checked={tradFilters.has(t)}
                  onCheckedChange={() => toggleTradFilter(t)}
                  className="h-3 w-3 border-white/20"
                  data-testid={`checkbox-trad-${t.toLowerCase().replace(/\s/g, "-")}`}
                />
                <span className="w-2 h-2 inline-block rounded-full" style={{ backgroundColor: TRADITION_COLORS[t] || "#E0DCE6" }} />
                <span className="text-[10px] text-white/60">{t}</span>
              </label>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function GraphPage() {
  const { data, isLoading } = useQuery<GraphData>({
    queryKey: ["/api/graph"],
  });

  const { data: hierarchyData } = useQuery<HierarchyItem[]>({
    queryKey: ["/api/trait-hierarchy"],
  });

  const [selectedNodes, setSelectedNodes] = useState<Map<number, Node>>(new Map());
  const [lastSelectedNode, setLastSelectedNode] = useState<Node | null>(null);
  const [selectedTrait, setSelectedTrait] = useState<TraitNode | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [activeFilters, setActiveFilters] = useState<Record<string, Set<string>>>({
    categories: new Set(Object.keys(CATEGORY_LABELS).filter(k => k !== "animalType" && k !== "objectType")),
  });
  const [activeSupersets, setActiveSupersets] = useState<Set<string>>(new Set());
  const [hierarchySelections, setHierarchySelections] = useState<Map<string, Set<string>>>(new Map());
  const [hoveredNode, setHoveredNode] = useState<any>(null);
  const [selectedTraditions, setSelectedTraditions] = useState<Set<string> | null>(null);
  const [viewMode, setViewMode] = useState<"network" | "direct" | "umap" | "ca" | "fca" | "relations">("network");
  const [caAxisX, setCaAxisX] = useState(0);
  const [caAxisY, setCaAxisY] = useState(1);
  const [caMinTraitFreq, setCaMinTraitFreq] = useState(3);
  const [caShowTraitLabels, setCaShowTraitLabels] = useState(true);
  const [caVariance, setCaVariance] = useState<number[]>([]);
  const [fcaMinSupport, setFcaMinSupport] = useState(8);
  const [fcaMaxConcepts, setFcaMaxConcepts] = useState(60);
  const [fcaStats, setFcaStats] = useState<{ total: number; shown: number; layers: number }>({ total: 0, shown: 0, layers: 0 });
  const [minTraits, setMinTraits] = useState(2);
  const [minSharedTraits, setMinSharedTraits] = useState(4);
  const [focalCharacterId, setFocalCharacterId] = useState<number | null>(null);
  const [focalSearch, setFocalSearch] = useState("");
  const [minTraitFrequency, setMinTraitFrequency] = useState(1);
  const [selectedCharacterIds, setSelectedCharacterIds] = useState<Set<number>>(new Set());
  const [characterSearch, setCharacterSearch] = useState("");
  const [enabledRelationTypes, setEnabledRelationTypes] = useState<Set<RelationType>>(new Set());

  const cleanMode = useMemo(() => {
    if (typeof window === "undefined") return false;
    return new URLSearchParams(window.location.search).get("clean") === "1";
  }, []);

  const urlParamsApplied = useRef(false);

  useEffect(() => {
    if (urlParamsApplied.current) return;
    if (typeof window === "undefined") return;
    if (!data?.nodes) return;
    const params = new URLSearchParams(window.location.search);
    const view = params.get("view");
    const focalName = params.get("focal");
    const minShared = params.get("minShared");
    const validViews = ["network", "direct", "umap", "ca", "fca", "relations"] as const;
    if (view && (validViews as readonly string[]).includes(view)) {
      setViewMode(view as typeof validViews[number]);
    }
    if (minShared) {
      const n = parseInt(minShared, 10);
      if (!isNaN(n) && n >= 1 && n <= 10) setMinSharedTraits(n);
    }
    if (focalName) {
      const lower = focalName.toLowerCase();
      const found = data.nodes.find(n => n.name.toLowerCase() === lower)
        || data.nodes.find(n => n.name.toLowerCase().includes(lower));
      if (found) setFocalCharacterId(found.id);
    }
    urlParamsApplied.current = true;
  }, [data]);

  const handleGraphNodeSelect = useCallback((node: Node | null, trait?: TraitNode | null) => {
    if (trait) {
      setSelectedTrait(trait);
      setSelectedNodes(new Map());
      setLastSelectedNode(null);
    } else if (node) {
      setSelectedTrait(null);
      setSelectedNodes(prev => {
        const next = new Map(prev);
        if (next.has(node.id)) {
          next.delete(node.id);
        } else {
          next.set(node.id, node);
        }
        return next;
      });
      setLastSelectedNode(node);
    } else {
      setSelectedNodes(new Map());
      setLastSelectedNode(null);
    }
  }, []);

  const toggleCharacter = useCallback((id: number) => {
    setSelectedCharacterIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const clearCharacters = useCallback(() => {
    setSelectedCharacterIds(new Set());
  }, []);

  const toggleRelationType = useCallback((rt: RelationType) => {
    setEnabledRelationTypes(prev => {
      const next = new Set(prev);
      if (next.has(rt)) next.delete(rt);
      else next.add(rt);
      return next;
    });
  }, []);

  const allTraditions = useMemo(() => {
    if (!data?.nodes) return [];
    const set = new Set<string>();
    for (const n of data.nodes) {
      if (n.tradition && n.tradition !== "Cross-cultural") set.add(n.tradition);
    }
    return Array.from(set).sort();
  }, [data?.nodes]);

  const toggleTradition = useCallback((t: string) => {
    setSelectedTraditions(prev => {
      const current = prev || new Set(allTraditions);
      const next = new Set(current);
      if (next.has(t)) next.delete(t);
      else next.add(t);
      return next;
    });
  }, [allTraditions]);

  const clearTraditionFilter = useCallback(() => {
    setSelectedTraditions(null);
  }, []);

  const hierarchyTrees = useMemo(() => {
    const trees = (!hierarchyData || hierarchyData.length === 0)
      ? new Map<string, HierarchyTreeNode[]>()
      : buildHierarchyTrees(hierarchyData);

    if (data?.nodes) {
      const CATEGORY_FIELD_TO_NODE_KEY_LOCAL: Record<string, { key: keyof Node; isArray: boolean; isSingle?: boolean }> = {
        physical_characteristics: { key: "physicalCharacteristics", isArray: false },
        object: { key: "object", isArray: false },
        animals: { key: "animals", isArray: false },
        domain: { key: "domain", isArray: false },
        character_trait: { key: "characterTrait", isArray: false },
        event_types: { key: "eventTypes", isArray: true },
        death_types: { key: "deathTypes", isArray: true },
        birth_types: { key: "birthTypes", isArray: true },
        gender: { key: "gender", isArray: false, isSingle: true },
      };

      const traitFigureCounts = new Map<string, Map<string, number>>();
      for (const [catField, mapping] of Object.entries(CATEGORY_FIELD_TO_NODE_KEY_LOCAL)) {
        const counts = new Map<string, number>();
        for (const node of data.nodes) {
          let tokens: string[] = [];
          if (mapping.isSingle) {
            const val = node[mapping.key] as string | null;
            if (val) tokens = [val.trim().toLowerCase()];
          } else if (mapping.isArray) {
            const arr = node[mapping.key] as string[] | null;
            if (arr && Array.isArray(arr)) tokens = arr.map(t => t.trim().toLowerCase());
          } else {
            const val = node[mapping.key] as string | null;
            if (val) tokens = val.split(/[,;]+/).map(t => t.trim().toLowerCase()).filter(t => t.length > 0);
          }
          for (const t of tokens) {
            counts.set(t, (counts.get(t) || 0) + 1);
          }
        }
        traitFigureCounts.set(catField, counts);
      }

      function assignFigureCounts(node: HierarchyTreeNode, catField: string) {
        const counts = traitFigureCounts.get(catField);
        if (node.isLeaf) {
          node.figureCount = counts?.get(node.name.toLowerCase()) || 0;
        } else {
          for (const c of node.children) assignFigureCounts(c, catField);
          node.figureCount = node.children.reduce((sum, c) => sum + c.figureCount, 0);
        }
      }

      for (const [catField, roots] of trees) {
        for (const root of roots) assignFigureCounts(root, catField);
      }

      const genderValues = new Set<string>();
      const genderCounts = traitFigureCounts.get("gender") || new Map<string, number>();
      for (const n of data.nodes) {
        if (n.gender) genderValues.add(n.gender.toLowerCase());
      }
      const genderLeafs: HierarchyTreeNode[] = Array.from(genderValues).sort().map((g, i) => ({
        id: -1000 - i,
        name: g,
        children: [],
        isLeaf: true,
        leafTraits: [g],
        figureCount: genderCounts.get(g) || 0,
      }));
      trees.set("gender", genderLeafs);
    }

    return trees;
  }, [hierarchyData, data?.nodes]);

  const toggleHierarchyNode = useCallback((categoryField: string, leafTraits: string[], checked: boolean) => {
    setHierarchySelections(prev => {
      const next = new Map(prev);
      const current = new Set(next.get(categoryField) || []);
      for (const trait of leafTraits) {
        if (checked) current.add(trait);
        else current.delete(trait);
      }
      if (current.size === 0) next.delete(categoryField);
      else next.set(categoryField, current);
      return next;
    });
  }, []);

  const clearHierarchyFilter = useCallback(() => {
    setHierarchySelections(new Map());
  }, []);

  const hierarchyFilteredNodeIds = useMemo(() => {
    if (hierarchySelections.size === 0 || !data?.nodes) return null;

    const CATEGORY_FIELD_TO_NODE_KEY: Record<string, { key: keyof Node; isArray: boolean; isSingle?: boolean }> = {
      physical_characteristics: { key: "physicalCharacteristics", isArray: false },
      object: { key: "object", isArray: false },
      animals: { key: "animals", isArray: false },
      domain: { key: "domain", isArray: false },
      character_trait: { key: "characterTrait", isArray: false },
      event_types: { key: "eventTypes", isArray: true },
      death_types: { key: "deathTypes", isArray: true },
      birth_types: { key: "birthTypes", isArray: true },
      gender: { key: "gender", isArray: false, isSingle: true },
    };

    let matchingIds: Set<number> | null = null;

    for (const [catField, selectedLeafs] of hierarchySelections) {
      if (selectedLeafs.size === 0) continue;
      const mapping = CATEGORY_FIELD_TO_NODE_KEY[catField];
      if (!mapping) continue;

      const catMatchIds = new Set<number>();
      for (const node of data.nodes) {
        let nodeTraits: string[] = [];
        if (mapping.isSingle) {
          const val = node[mapping.key] as string | null;
          if (val) nodeTraits = [val.trim().toLowerCase()];
        } else if (mapping.isArray) {
          const arr = node[mapping.key] as string[] | null;
          if (arr && Array.isArray(arr)) {
            nodeTraits = arr.map(t => t.trim().toLowerCase());
          }
        } else {
          const val = node[mapping.key] as string | null;
          if (val) {
            nodeTraits = val.split(/[,;]+/).map(t => t.trim().toLowerCase()).filter(t => t.length > 0);
          }
        }
        const hasMatch = nodeTraits.some(t => selectedLeafs.has(t));
        if (hasMatch) catMatchIds.add(node.id);
      }

      if (matchingIds === null) {
        matchingIds = catMatchIds;
      } else {
        matchingIds = new Set([...matchingIds].filter(id => catMatchIds.has(id)));
      }
    }

    return matchingIds;
  }, [hierarchySelections, data?.nodes]);

  const enabledCategoriesSet = useMemo(() => {
    const catFilter = activeFilters["categories"];
    if (!catFilter || catFilter.size === 0) return undefined;
    const effective = new Set(catFilter);
    if (effective.has("animalType")) effective.add("animals");
    if (effective.has("objectType")) effective.add("object");
    return effective;
  }, [activeFilters]);

  const traitStats = useMemo(() => {
    if (!data?.nodes) return { max: 10 };
    const selIds = selectedCharacterIds.size > 0 ? selectedCharacterIds : undefined;
    const effectiveFigures = selIds ? data.nodes.filter((f: Node) => selIds.has(f.id)) : data.nodes;
    let max = 0;
    for (const fig of effectiveFigures) {
      const traits = getTraitsForFigure(fig, enabledCategoriesSet, activeSupersets);
      if (traits.length > max) max = traits.length;
    }
    return { max: max || 10 };
  }, [data?.nodes, selectedCharacterIds, enabledCategoriesSet, activeSupersets]);

  const effectiveNodes = useMemo(() => {
    if (!data?.nodes) return [];
    let nodes = data.nodes.filter(n => n.tradition !== "Cross-cultural");
    if (selectedTraditions) {
      nodes = nodes.filter(n => n.tradition && selectedTraditions.has(n.tradition));
    }
    if (hierarchyFilteredNodeIds) {
      nodes = nodes.filter(n => hierarchyFilteredNodeIds.has(n.id));
    }
    return nodes;
  }, [data?.nodes, hierarchyFilteredNodeIds, selectedTraditions]);

  const relationEdges = useMemo((): RelationEdge[] => {
    if (!data?.edges || enabledRelationTypes.size === 0) return [];
    const visibleIds = new Set(effectiveNodes.map(n => n.id));
    return data.edges
      .filter(e => RELATION_TYPES.includes(e.relationType as RelationType) && enabledRelationTypes.has(e.relationType as RelationType) && visibleIds.has(e.sourceNodeId) && visibleIds.has(e.targetNodeId))
      .map(e => ({ sourceId: `fig-${e.sourceNodeId}`, targetId: `fig-${e.targetNodeId}`, relationType: e.relationType as RelationType }));
  }, [data?.edges, effectiveNodes, enabledRelationTypes]);

  const { graphNodes, graphLinks } = useMemo(() => {
    if (!effectiveNodes.length) return { graphNodes: [], graphLinks: [] };
    return buildGraph(effectiveNodes, minTraits, selectedCharacterIds.size > 0 ? selectedCharacterIds : undefined, enabledCategoriesSet, activeSupersets, minTraitFrequency);
  }, [effectiveNodes, minTraits, selectedCharacterIds, enabledCategoriesSet, activeSupersets, minTraitFrequency]);

  const { directNodes, directLinks } = useMemo(() => {
    if (!effectiveNodes.length) return { directNodes: [], directLinks: [] };
    const result = buildDirectGraph(effectiveNodes, minTraits, selectedCharacterIds.size > 0 ? selectedCharacterIds : undefined, enabledCategoriesSet, activeSupersets, minSharedTraits, focalCharacterId);
    return { directNodes: result.nodes, directLinks: result.links };
  }, [effectiveNodes, minTraits, selectedCharacterIds, enabledCategoriesSet, activeSupersets, minSharedTraits, focalCharacterId]);

  const filters = useMemo(() => {
    const traditions: string[] = [];
    const categories = Object.keys(CATEGORY_LABELS).filter(k => k !== "animalType" && k !== "objectType");
    return { traditions, categories };
  }, []);

  const toggleFilter = useCallback((category: string, value: string) => {
    setActiveFilters((prev) => {
      const next = { ...prev };
      if (!next[category]) next[category] = new Set();
      const s = new Set(next[category]);
      if (s.has(value)) s.delete(value);
      else s.add(value);
      next[category] = s;
      return next;
    });
  }, []);

  // Search expansion: when the query matches nodes, keep them PLUS their immediate
  // neighborhood (1-hop neighbors and 2-hop characters via shared trait nodes).
  // This means searching "Athena" shows Athena + her trait nodes + every other character
  // who shares those traits with her — i.e. her actual context in the graph.
  const filteredGraphNodes = useMemo(() => {
    if (!searchQuery.trim()) return graphNodes;
    const q = searchQuery.toLowerCase();
    const directMatchIds = new Set(graphNodes.filter(n => n.label.toLowerCase().includes(q)).map(n => n.id));
    if (directMatchIds.size === 0) return [];

    // 1-hop: nodes connected to any direct match
    const oneHop = new Set<string>(directMatchIds);
    for (const l of graphLinks) {
      if (directMatchIds.has(l.source)) oneHop.add(l.target);
      if (directMatchIds.has(l.target)) oneHop.add(l.source);
    }
    // 2-hop: characters connected to the trait nodes brought in at 1-hop
    const keep = new Set<string>(oneHop);
    for (const l of graphLinks) {
      if (oneHop.has(l.source)) keep.add(l.target);
      if (oneHop.has(l.target)) keep.add(l.source);
    }
    return graphNodes.filter(n => keep.has(n.id));
  }, [graphNodes, graphLinks, searchQuery]);

  const filteredNodeIds = useMemo(() => new Set(filteredGraphNodes.map(n => n.id)), [filteredGraphNodes]);

  const filteredLinks = useMemo(() => {
    return graphLinks.filter(l => filteredNodeIds.has(l.source) && filteredNodeIds.has(l.target));
  }, [graphLinks, filteredNodeIds]);

  const selectedNodeIds = useMemo(() => {
    const ids = new Set(selectedNodes.keys());
    for (const id of selectedCharacterIds) ids.add(id);
    return ids;
  }, [selectedNodes, selectedCharacterIds]);

  useEffect(() => {
    if (selectedNodes.size > 0 && viewMode !== "ca") {
      const charIds = viewMode === "direct"
        ? new Set(directNodes.map(n => n.nodeId))
        : new Set(filteredGraphNodes.filter(n => n.isCharacter).map(n => n.original?.id));
      let changed = false;
      const next = new Map(selectedNodes);
      for (const id of next.keys()) {
        if (!charIds.has(id)) { next.delete(id); changed = true; }
      }
      if (changed) {
        setSelectedNodes(next);
        if (lastSelectedNode && !next.has(lastSelectedNode.id)) setLastSelectedNode(null);
      }
    }
  }, [filteredGraphNodes, directNodes, viewMode, selectedNodes, lastSelectedNode]);

  const relatedNodes = lastSelectedNode
    ? data?.nodes.filter((n) => {
        if (n.id === lastSelectedNode.id) return false;
        return data?.edges.some(
          (e) =>
            (e.sourceNodeId === lastSelectedNode.id && e.targetNodeId === n.id) ||
            (e.targetNodeId === lastSelectedNode.id && e.sourceNodeId === n.id)
        );
      }) || []
    : [];

  const charNodeCount = useMemo(() => {
    if (viewMode === "direct") return directNodes.length;
    return filteredGraphNodes.filter(n => n.isCharacter).length;
  }, [filteredGraphNodes, directNodes, viewMode]);

  if (isLoading) {
    return (
      <div className="h-screen bg-gradient-to-br from-[#0B0626] to-[#0C0042] flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-[#8F00FF] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-shadows-text/50 text-sm">Loading graph data...</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="h-screen bg-gradient-to-br from-[#0B0626] to-[#0C0042] flex items-center justify-center">
        <p className="text-shadows-text/40" data-testid="text-graph-not-found">No data available.</p>
      </div>
    );
  }

  return (
    <div className="h-screen relative overflow-hidden" data-testid="page-graph">
      {!cleanMode && (
      <div className="absolute top-4 left-16 lg:left-[19rem] z-30 flex items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="p-2 rounded-md bg-[#0B0626]/80 backdrop-blur-xl border border-[#350A8C]/30 text-shadows-text/80 hover:text-[#E0DCE6] hover:border-[#8F00FF]/50 transition-colors"
              title="Change view"
              data-testid="button-view-menu"
            >
              {viewMode === "network" ? <Network size={18} />
                : viewMode === "direct" ? <Users size={18} />
                : viewMode === "umap" ? <Sparkles size={18} />
                : viewMode === "ca" ? <Compass size={18} />
                : viewMode === "fca" ? <Layers size={18} />
                : <Link2 size={18} />}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="bg-[#0B0626]/95 backdrop-blur-xl border-[#350A8C]/40 text-shadows-text">
            <DropdownMenuItem onSelect={() => setViewMode("network")} data-testid="option-view-network">
              <Network size={14} className="mr-2" /> Network
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setViewMode("direct")} data-testid="option-view-direct">
              <Users size={14} className="mr-2" /> Direct connections
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setViewMode("umap")} data-testid="option-view-umap">
              <Sparkles size={14} className="mr-2" /> Similarity map
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setViewMode("ca")} data-testid="option-view-ca">
              <Compass size={14} className="mr-2" /> Correspondence (MCA)
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setViewMode("fca")} data-testid="option-view-fca">
              <Layers size={14} className="mr-2" /> Concept lattice (FCA)
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setViewMode("relations")} data-testid="option-view-relations">
              <Link2 size={14} className="mr-2" /> Relations
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      )}

      {!cleanMode && viewMode === "network" && (
        <div className={`absolute top-4 z-30 transition-[right] duration-200 ${(lastSelectedNode || selectedTrait) ? "right-[21rem] lg:right-[25rem]" : "right-4"}`}>
          <div className="relative w-64 lg:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-shadows-text/30" />
            <Input
              type="search"
              placeholder="Search figures or traits..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 bg-[#0B0626]/80 backdrop-blur-xl border-[#350A8C]/30 text-shadows-text text-sm focus:border-[#03FF9B]/50 focus:ring-[#03FF9B]/20 transition-all"
              data-testid="input-search-nodes"
            />
          </div>
        </div>
      )}

      {!cleanMode && viewMode === "direct" && (
      <div className="absolute top-4 right-4 z-20 flex flex-col gap-2 bg-[#0B0626]/60 backdrop-blur-sm rounded-md p-3 border border-[#350A8C]/15 max-h-[85vh] overflow-y-auto">
        <span className="text-[10px] uppercase tracking-wider text-shadows-text/30 mb-0.5">
          Direct Connections
        </span>
        {viewMode === "direct" && (
          <div className="mb-1 space-y-2 w-56">
            <p className="text-[9px] text-shadows-text/30 leading-tight">
              Pick a focal deity. Its direct connections (other figures sharing traits) will appear around it.
            </p>
            <div>
              <span className="text-[9px] text-shadows-text/40 block mb-1">Focal deity</span>
              {focalCharacterId != null ? (
                <div className="flex items-center justify-between gap-2 px-2 py-1 rounded bg-[#8F00FF]/20 border border-[#8F00FF]/30">
                  <span className="text-[11px] text-shadows-text truncate" data-testid="text-focal-deity">
                    {data?.nodes.find(n => n.id === focalCharacterId)?.name || "Unknown"}
                  </span>
                  <button
                    onClick={() => { setFocalCharacterId(null); setFocalSearch(""); }}
                    className="text-shadows-text/50 hover:text-[#E53935] transition-colors flex-shrink-0"
                    data-testid="button-clear-focal"
                    title="Clear focal deity"
                  >
                    <X size={12} />
                  </button>
                </div>
              ) : (
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-shadows-text/30" />
                  <Input
                    type="search"
                    placeholder="Search a deity…"
                    value={focalSearch}
                    onChange={(e) => setFocalSearch(e.target.value)}
                    className="pl-7 h-7 text-xs bg-[#0B0626]/60 border-[#350A8C]/20 text-shadows-text focus:border-[#03FF9B]/50"
                    data-testid="input-focal-search"
                  />
                </div>
              )}
              {focalCharacterId == null && focalSearch.trim().length > 0 && (
                <div className="mt-1.5 max-h-40 overflow-y-auto space-y-0.5 border border-[#350A8C]/15 rounded p-1 bg-[#0B0626]/60">
                  {(data?.nodes || [])
                    .filter(n => n.name.toLowerCase().includes(focalSearch.toLowerCase()))
                    .slice(0, 30)
                    .map(n => (
                      <button
                        key={n.id}
                        onClick={() => { setFocalCharacterId(n.id); setFocalSearch(""); }}
                        className="flex items-center gap-2 w-full text-left rounded px-2 py-1 hover:bg-[#350A8C]/20 text-shadows-text/70 text-xs"
                        data-testid={`button-pick-focal-${n.id}`}
                      >
                        <div className="w-2 h-2 rounded-full flex-shrink-0 bg-[#E0DCE6]" />
                        <span className="truncate">{n.name}</span>
                        {n.tradition && (
                          <span className="text-[9px] text-shadows-text/25 ml-auto flex-shrink-0">{n.tradition}</span>
                        )}
                      </button>
                    ))}
                </div>
              )}
            </div>
            <div>
              <span className="text-[9px] text-shadows-text/40 block mb-1">Min shared traits: {minSharedTraits}</span>
              <Slider
                min={1}
                max={10}
                step={1}
                value={[minSharedTraits]}
                onValueChange={([v]) => setMinSharedTraits(v)}
                className="w-full"
                data-testid="slider-min-shared-traits"
              />
              <div className="flex justify-between text-[8px] text-shadows-text/25 mt-0.5">
                <span>1</span><span>5</span><span>10</span>
              </div>
            </div>
            {focalCharacterId != null && (
              <div className="flex items-center justify-between text-[9px] text-shadows-text/30">
                <span>{Math.max(0, directNodes.length - 1)} neighbors</span>
                <span>{directLinks.length} connections</span>
              </div>
            )}
          </div>
        )}
        {viewMode === "direct" && focalCharacterId != null && (
          <div className="mt-1 text-[9px] text-shadows-text/40 leading-tight text-center">
            Closer to center = more shared traits<br />Farther = fewer
          </div>
        )}
      </div>)}

      {!cleanMode && viewMode === "fca" && (
        <div className="absolute top-4 right-4 z-20 flex flex-col gap-2 bg-[#0B0626]/60 backdrop-blur-sm rounded-md p-3 border border-[#350A8C]/15 max-h-[85vh] overflow-y-auto w-56">
          <span className="text-[10px] uppercase tracking-wider text-shadows-text/30 mb-0.5">Concept lattice (FCA)</span>
          <p className="text-[9px] text-shadows-text/35 leading-tight mb-1">
            Each node is a maximal pair (figures, traits) such that the figures share exactly those traits and only those figures share them. Edges show the subconcept (more general → more specific) relation. Node size = number of figures.
          </p>
          <div className="space-y-2">
            <div>
              <span className="text-[9px] text-shadows-text/40 block mb-1">Min support: {fcaMinSupport} figures</span>
              <Slider
                min={2}
                max={40}
                step={1}
                value={[fcaMinSupport]}
                onValueChange={([v]) => setFcaMinSupport(v)}
                className="w-full"
                data-testid="slider-fca-minsupport"
              />
              <p className="text-[8px] text-shadows-text/25 mt-0.5 leading-tight">Concepts must apply to at least this many figures.</p>
            </div>
            <div>
              <span className="text-[9px] text-shadows-text/40 block mb-1">Max concepts shown: {fcaMaxConcepts}</span>
              <Slider
                min={20}
                max={200}
                step={10}
                value={[fcaMaxConcepts]}
                onValueChange={([v]) => setFcaMaxConcepts(v)}
                className="w-full"
                data-testid="slider-fca-maxconcepts"
              />
            </div>
            {fcaStats.shown > 0 && (
              <div className="pt-1 border-t border-shadows-text/10 text-[10px] text-shadows-text/60 leading-tight">
                <div>Shown: <span className="text-shadows-text/85">{fcaStats.shown}</span> / generated {fcaStats.total}</div>
                <div>Layers: <span className="text-shadows-text/85">{fcaStats.layers}</span></div>
                <div className="text-[9px] text-shadows-text/35 mt-1">Hover a node to see its figures &amp; traits. Click to open the first figure in the side panel.</div>
              </div>
            )}
          </div>
        </div>
      )}

      {!cleanMode && viewMode === "ca" && (
        <div className="absolute top-4 right-4 z-20 flex flex-col gap-2 bg-[#0B0626]/60 backdrop-blur-sm rounded-md p-3 border border-[#350A8C]/15 max-h-[85vh] overflow-y-auto w-56">
          <span className="text-[10px] uppercase tracking-wider text-shadows-text/30 mb-0.5">Correspondence (MCA)</span>
          <p className="text-[9px] text-shadows-text/35 leading-tight mb-1">
            Biplot of figures and traits via correspondence analysis on the binary trait matrix. Figures and traits that lie in the same direction from the origin tend to co‑occur.
          </p>
          <div className="space-y-2">
            <div>
              <span className="text-[9px] text-shadows-text/40 block mb-1">X axis</span>
              <div className="flex gap-1" data-testid="ca-axis-x">
                {[0, 1, 2, 3, 4].map(k => (
                  <button
                    key={k}
                    onClick={() => setCaAxisX(k)}
                    disabled={k === caAxisY}
                    className={`flex-1 text-[10px] py-1 rounded border transition-colors ${
                      caAxisX === k
                        ? "bg-[#8F00FF]/30 border-[#8F00FF]/60 text-shadows-text"
                        : k === caAxisY
                          ? "border-shadows-text/10 text-shadows-text/20 cursor-not-allowed"
                          : "border-shadows-text/15 text-shadows-text/60 hover:border-[#8F00FF]/40"
                    }`}
                    data-testid={`button-ca-axisx-${k}`}
                  >{k + 1}</button>
                ))}
              </div>
            </div>
            <div>
              <span className="text-[9px] text-shadows-text/40 block mb-1">Y axis</span>
              <div className="flex gap-1" data-testid="ca-axis-y">
                {[0, 1, 2, 3, 4].map(k => (
                  <button
                    key={k}
                    onClick={() => setCaAxisY(k)}
                    disabled={k === caAxisX}
                    className={`flex-1 text-[10px] py-1 rounded border transition-colors ${
                      caAxisY === k
                        ? "bg-[#8F00FF]/30 border-[#8F00FF]/60 text-shadows-text"
                        : k === caAxisX
                          ? "border-shadows-text/10 text-shadows-text/20 cursor-not-allowed"
                          : "border-shadows-text/15 text-shadows-text/60 hover:border-[#8F00FF]/40"
                    }`}
                    data-testid={`button-ca-axisy-${k}`}
                  >{k + 1}</button>
                ))}
              </div>
            </div>
            <div>
              <span className="text-[9px] text-shadows-text/40 block mb-1">Min trait freq: {caMinTraitFreq}</span>
              <Slider
                min={1}
                max={20}
                step={1}
                value={[caMinTraitFreq]}
                onValueChange={([v]) => setCaMinTraitFreq(v)}
                className="w-full"
                data-testid="slider-ca-minfreq"
              />
              <p className="text-[8px] text-shadows-text/25 mt-0.5 leading-tight">
                Drop traits used by fewer than this many figures. Higher = cleaner axes, less noise.
              </p>
            </div>
            <label className="flex items-center gap-2 cursor-pointer text-[10px] text-shadows-text/70">
              <Checkbox
                checked={caShowTraitLabels}
                onCheckedChange={(v) => setCaShowTraitLabels(!!v)}
                data-testid="checkbox-ca-show-traits"
              />
              <span>Show trait labels</span>
            </label>
            {caVariance.length > 0 && (
              <div className="pt-1 border-t border-shadows-text/10">
                <span className="text-[9px] text-shadows-text/40 block mb-1">Inertia (% of top 5)</span>
                <div className="space-y-0.5">
                  {caVariance.map((v, k) => (
                    <div key={k} className="flex items-center gap-1.5 text-[9px]">
                      <span className={`w-3 ${k === caAxisX || k === caAxisY ? "text-[#03FF9B]" : "text-shadows-text/40"}`}>{k + 1}</span>
                      <div className="flex-1 h-1.5 bg-shadows-text/5 rounded overflow-hidden">
                        <div className="h-full bg-[#8F00FF]/60" style={{ width: `${(v * 100).toFixed(1)}%` }} />
                      </div>
                      <span className="text-shadows-text/50 w-10 text-right">{(v * 100).toFixed(1)}%</span>
                    </div>
                  ))}
                </div>
                <p className="text-[8px] text-shadows-text/25 mt-1 leading-tight">
                  With many sparse traits the first few axes may capture only a small share of total variation. Browse multiple axis pairs.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {hoveredNode && hoveredNode.isCharacter && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 bg-[#0B0626]/90 backdrop-blur-sm border border-[#350A8C]/30 rounded-lg px-4 py-2 pointer-events-none">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-[#E0DCE6]" />
            <span className="text-sm text-shadows-text font-serif">{hoveredNode.label}</span>
          </div>
          {hoveredNode.original?.domain && (
            <p className="text-[10px] text-shadows-text/50 mt-0.5 ml-5">{hoveredNode.original.domain}</p>
          )}
        </div>
      )}

      {hoveredNode && !hoveredNode.isCharacter && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 bg-[#0B0626]/90 backdrop-blur-sm border border-[#350A8C]/30 rounded-lg px-4 py-2 pointer-events-none">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: CATEGORY_COLORS[hoveredNode.category] || "#8F00FF" }} />
            <span className="text-sm text-shadows-text">{hoveredNode.label}</span>
            <span className="text-[10px] text-shadows-text/30">{CATEGORY_LABELS[hoveredNode.category] || hoveredNode.category}</span>
          </div>
        </div>
      )}

      {!cleanMode && (
      <FilterSidebar
        filters={filters}
        activeFilters={activeFilters}
        onToggleFilter={toggleFilter}
        isOpen={filtersOpen}
        onToggle={() => setFiltersOpen(!filtersOpen)}
        nodeCount={charNodeCount}
        totalCount={effectiveNodes.length}
        minConnections={minTraits}
        onMinConnectionsChange={setMinTraits}
        maxConnectionCount={traitStats.max}
        allNodes={effectiveNodes}
        selectedCharacterIds={selectedCharacterIds}
        onToggleCharacter={toggleCharacter}
        onClearCharacters={clearCharacters}
        characterSearch={characterSearch}
        onCharacterSearchChange={setCharacterSearch}
        activeSupersets={activeSupersets}
        onToggleSuperset={(key: string) => {
          setActiveSupersets(prev => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key);
            else next.add(key);
            return next;
          });
        }}
        hierarchyTrees={hierarchyTrees}
        hierarchySelections={hierarchySelections}
        onToggleHierarchyNode={toggleHierarchyNode}
        onClearHierarchyFilter={clearHierarchyFilter}

        minTraitFrequency={minTraitFrequency}
        onMinTraitFrequencyChange={setMinTraitFrequency}
        enabledRelationTypes={enabledRelationTypes}
        onToggleRelationType={toggleRelationType}
        allTraditions={allTraditions}
        selectedTraditions={selectedTraditions}
        onToggleTradition={toggleTradition}
        onClearTraditionFilter={clearTraditionFilter}
      />
      )}

      <div className={cleanMode ? "absolute inset-0" : "absolute inset-0 lg:left-72"}>
        {viewMode === "network" ? (
          <NetworkView
            filteredGraphNodes={filteredGraphNodes}
            filteredLinks={filteredLinks}
            onSelectNode={(n) => handleGraphNodeSelect(n)}
            onSelectTrait={(t) => handleGraphNodeSelect(null, t)}
            onHoverNode={setHoveredNode}
            hoveredNode={hoveredNode}
            selectedNodeIds={selectedNodeIds}
            relationEdges={relationEdges}
            searchQuery={searchQuery}
          />
        ) : viewMode === "direct" ? (
          focalCharacterId == null ? (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="text-center max-w-md px-6">
                <Users size={48} className="mx-auto mb-4 text-shadows-text/20" />
                <h3 className="text-lg text-shadows-text/60 mb-2" style={{ fontFamily: "'Cinzel Decorative', serif" }}>
                  Choose a focal deity
                </h3>
                <p className="text-[12px] text-shadows-text/40 leading-relaxed">
                  Search for a mythological figure in the panel on the right.<br />
                  Its direct connections — figures sharing traits with it — will appear around it.
                </p>
              </div>
            </div>
          ) : (
            <DirectView
              charNodes={directNodes}
              directLinks={directLinks}
              onSelectNode={(n) => {
                if (n && n.id !== focalCharacterId) {
                  setFocalCharacterId(n.id);
                } else {
                  handleGraphNodeSelect(n);
                }
              }}
              onHoverNode={setHoveredNode}
              selectedNodeIds={new Set([...selectedNodeIds, focalCharacterId])}
              relationEdges={relationEdges}
              focalNodeId={`fig-${focalCharacterId}`}
            />
          )
        ) : viewMode === "umap" ? (
          <UMAPView
            figures={effectiveNodes}
            onSelectNode={(n) => handleGraphNodeSelect(n)}
            onHoverNode={setHoveredNode}
            selectedNodeIds={selectedNodeIds}
            useSupersets={activeSupersets}
            enabledCategories={enabledCategoriesSet}
          />
        ) : viewMode === "ca" ? (
          <MCAView
            figures={effectiveNodes}
            onSelectNode={(n) => handleGraphNodeSelect(n)}
            onHoverNode={setHoveredNode}
            selectedNodeIds={selectedNodeIds}
            useSupersets={activeSupersets}
            enabledCategories={enabledCategoriesSet}
            axisX={caAxisX}
            axisY={caAxisY}
            minTraitFreq={caMinTraitFreq}
            showTraitLabels={caShowTraitLabels}
            onVarianceComputed={setCaVariance}
          />
        ) : viewMode === "fca" ? (
          <FCAView
            figures={effectiveNodes}
            onSelectNode={(n) => handleGraphNodeSelect(n)}
            onHoverNode={setHoveredNode}
            selectedNodeIds={selectedNodeIds}
            useSupersets={activeSupersets}
            enabledCategories={enabledCategoriesSet}
            minSupport={fcaMinSupport}
            maxConcepts={fcaMaxConcepts}
            onStatsComputed={setFcaStats}
          />
        ) : (
          <RelationsView
            nodes={effectiveNodes}
            edges={data?.edges || []}
            onSelectNode={(n) => handleGraphNodeSelect(n)}
            onHoverNode={setHoveredNode}
            selectedNodeIds={selectedNodeIds}
          />
        )}

        {viewMode !== "relations" && relationEdges.length > 0 && (
          <div className="absolute bottom-4 right-4 bg-[#0B0626]/90 border border-white/10 rounded-lg px-3 py-2 pointer-events-none" data-testid="relation-legend">
            <div className="text-[10px] text-white/50 uppercase tracking-wider mb-1">Relationships</div>
            {viewMode === "relations" ? (
              Object.entries(RELATION_GROUPS).map(([groupKey, types]) => (
                <div key={groupKey} className="mb-1.5">
                  <div className="text-[9px] text-white/30 uppercase tracking-wider mb-0.5">{RELATION_GROUP_LABELS[groupKey]}</div>
                  {types.map(rt => (
                    <div key={rt} className="flex items-center gap-2 py-0.5">
                      <span className="w-4 h-[2px] inline-block rounded" style={{ backgroundColor: RELATION_COLORS[rt] }} />
                      <span className="text-[11px] text-white/70">{RELATION_LABELS[rt]}</span>
                    </div>
                  ))}
                </div>
              ))
            ) : (
              RELATION_TYPES.filter(rt => enabledRelationTypes.has(rt)).map(rt => (
                <div key={rt} className="flex items-center gap-2 py-0.5">
                  <span className="w-4 h-[2px] inline-block rounded" style={{ backgroundColor: RELATION_COLORS[rt] }} />
                  <span className="text-[11px] text-white/70">{RELATION_LABELS[rt]}</span>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {lastSelectedNode && (
        <NodePanel
          node={lastSelectedNode}
          relatedNodes={relatedNodes}
          edges={data.edges}
          onClose={() => { setSelectedNodes(new Map()); setLastSelectedNode(null); }}
        />
      )}

      {selectedTrait && (
        <TraitPanel
          trait={selectedTrait}
          allNodes={data.nodes}
          graphLinks={graphLinks}
          onClose={() => setSelectedTrait(null)}
          onSelectCharacter={(char) => handleGraphNodeSelect(char)}
        />
      )}
    </div>
  );
}
