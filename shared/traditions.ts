/**
 * Curated classification of corpus works by religious tradition.
 *
 * This is the single editable place for tradition assignments: when a new
 * work is downloaded, add its work id (without the "work:" prefix) to
 * WORK_TRADITIONS to have it grouped correctly on the Corpus tab. Works not
 * listed here fall into the "Unclassified" group.
 */

export interface TraditionInfo {
  /** Stable key used by the API and UI grouping. */
  id: string;
  /** Human-readable section header. */
  label: string;
  /** Emoji shown next to the section header. */
  emoji: string;
  /** Display order on the Corpus tab (lower = earlier). */
  order: number;
}

export interface TraditionFamilyInfo {
  /** Stable key used by the API and UI grouping. */
  id: string;
  /** Human-readable family header. */
  label: string;
  /** Emoji shown next to the family header. */
  emoji: string;
  /** Display order across families (lower = earlier). */
  order: number;
}

/**
 * Higher-level grouping of traditions into families. Each tradition below
 * belongs to exactly one family via TRADITION_FAMILIES.
 */
export const FAMILIES: Record<string, TraditionFamilyInfo> = {
  "ancient-near-east-mediterranean": {
    id: "ancient-near-east-mediterranean",
    label: "Ancient Near East & Mediterranean",
    emoji: "🏺",
    order: 1,
  },
  abrahamic: { id: "abrahamic", label: "Abrahamic", emoji: "🕊️", order: 2 },
  dharmic: { id: "dharmic", label: "Dharmic", emoji: "🕉️", order: 3 },
  japanese: { id: "japanese", label: "Japanese", emoji: "🗾", order: 4 },
  scholarly: { id: "scholarly", label: "Scholarly", emoji: "🔍", order: 5 },
  unclassified: { id: "unclassified", label: "Unclassified", emoji: "❓", order: 99 },
};

export const UNCLASSIFIED_FAMILY = FAMILIES.unclassified;

/** Map from tradition key to family key. Every tradition must appear here. */
export const TRADITION_FAMILIES: Record<string, string> = {
  mesopotamian: "ancient-near-east-mediterranean",
  greek: "ancient-near-east-mediterranean",
  judaism: "abrahamic",
  christianity: "abrahamic",
  islam: "abrahamic",
  buddhism: "dharmic",
  shinto: "japanese",
  ainu: "japanese",
  "japanese-historical": "japanese",
  scholarly: "scholarly",
  unclassified: "unclassified",
};

export const TRADITIONS: Record<string, TraditionInfo> = {
  mesopotamian: { id: "mesopotamian", label: "Ancient Mesopotamian", emoji: "𒀭", order: 1 },
  greek: { id: "greek", label: "Ancient Greek", emoji: "🏛️", order: 2 },
  judaism: { id: "judaism", label: "Judaism", emoji: "✡️", order: 3 },
  christianity: { id: "christianity", label: "Christianity", emoji: "✝️", order: 4 },
  islam: { id: "islam", label: "Islam", emoji: "☪️", order: 5 },
  buddhism: { id: "buddhism", label: "Buddhism", emoji: "☸️", order: 6 },
  shinto: { id: "shinto", label: "Shinto / Japanese Mythology", emoji: "⛩️", order: 7 },
  ainu: { id: "ainu", label: "Ainu", emoji: "🐻", order: 8 },
  "japanese-historical": { id: "japanese-historical", label: "Japanese Historical Literature", emoji: "📜", order: 9 },
  scholarly: { id: "scholarly", label: "Scholarly / Comparative", emoji: "🔍", order: 10 },
  unclassified: { id: "unclassified", label: "Unclassified", emoji: "❓", order: 99 },
};

export const UNCLASSIFIED_TRADITION = TRADITIONS.unclassified;

/**
 * Map from work id (without "work:" prefix) to tradition key.
 * Keep alphabetized within each tradition block.
 */
export const WORK_TRADITIONS: Record<string, string> = {
  // Ancient Mesopotamian
  "city-goddess-hymn": "mesopotamian",
  "enuma-elish-the-babylonian-epic-of-creation-seven-tablets-of-creation": "mesopotamian",

  // Ancient Greek
  "hesiod-theogony": "greek",

  // Judaism
  "babylonian-talmud": "judaism",
  "tanakh-jewish-publication-society-1917": "judaism",
  "the-book-of-enoch-1-enoch": "judaism",
  "the-book-of-enoch-charles-translation": "judaism",
  "the-book-of-enoch-complete": "judaism",

  // Christianity
  "bible-king-james": "christianity",
  "biblia-sacra-vulgata-latin-vulgate": "christianity",
  "didache": "christianity",
  "gospel-of-nicodemus-acts-of-pilate": "christianity",
  "the-apocrypha-king-james-version": "christianity",
  "the-gospel-of-thomas": "christianity",
  "the-holy-bible-king-james-version": "christianity",
  "the-holy-bible-king-james-version-kjv-index-ot-nt": "christianity",

  // Islam
  "quran-arabic-text": "islam",
  "the-koran-rodwell": "islam",
  "the-meaning-of-the-glorious-koran": "islam",
  "the-qur-an-palmer": "islam",

  // Buddhism
  "konjaku-monogatarishu": "buddhism",
  "sutra-of-golden-light": "buddhism",

  // Shinto / Japanese Mythology
  "engishiki-books-110-within-the-complete-engishiki": "shinto",
  "kojiki": "shinto",
  "manyoshu": "shinto",
  "nihon-shoki": "shinto",
  "nihongi-chronicles-of-japan-from-the-earliest-times-to-a-d-697-aston-complete": "shinto",
  "the-kojiki-records-of-ancient-matters": "shinto",

  // Ainu
  "aino-folk-tales": "ainu",

  // Japanese Historical Literature
  "gikeiki": "japanese-historical",

  // Scholarly / Comparative
  "why-omnipotence-does-not-hide-behind-syncretic-texts": "scholarly",
};

export interface WorkChronology {
  /** Sortable approximate composition year (negative = BCE). */
  year: number;
  /** Human-readable era label shown on library cards. */
  era: string;
}

/**
 * Curated approximate composition dates for known works, keyed by work id
 * (without the "work:" prefix). This is the single editable place for
 * chronology: when adding a work to WORK_TRADITIONS, also add its
 * approximate composition date here so the Library can sort it. Works not
 * listed sort last within their tradition.
 * Keep alphabetized within each tradition block, mirroring WORK_TRADITIONS.
 */
export const WORK_CHRONOLOGY: Record<string, WorkChronology> = {
  // Ancient Mesopotamian
  "city-goddess-hymn": { year: -1800, era: "c. 18th century BCE" },
  "enuma-elish-the-babylonian-epic-of-creation-seven-tablets-of-creation": { year: -1750, era: "c. 18th century BCE" },

  // Ancient Greek
  "hesiod-theogony": { year: -700, era: "c. 8th century BCE" },

  // Judaism
  "babylonian-talmud": { year: 500, era: "c. 6th century CE" },
  "tanakh-jewish-publication-society-1917": { year: -600, era: "c. 12th–2nd century BCE" },
  "the-book-of-enoch-1-enoch": { year: -300, era: "c. 3rd century BCE" },
  "the-book-of-enoch-charles-translation": { year: -300, era: "c. 3rd century BCE" },
  "the-book-of-enoch-complete": { year: -300, era: "c. 3rd century BCE" },

  // Christianity
  "bible-king-james": { year: 100, era: "c. 1st century CE" },
  "biblia-sacra-vulgata-latin-vulgate": { year: 400, era: "c. 400 CE" },
  "didache": { year: 90, era: "c. late 1st century CE" },
  "gospel-of-nicodemus-acts-of-pilate": { year: 350, era: "c. 4th century CE" },
  "the-apocrypha-king-james-version": { year: -200, era: "c. 2nd century BCE" },
  "the-gospel-of-thomas": { year: 140, era: "c. 2nd century CE" },
  "the-holy-bible-king-james-version": { year: 100, era: "c. 1st century CE" },
  "the-holy-bible-king-james-version-kjv-index-ot-nt": { year: 100, era: "c. 1st century CE" },

  // Islam
  "quran-arabic-text": { year: 632, era: "c. 7th century CE" },
  "the-koran-rodwell": { year: 632, era: "c. 7th century CE" },
  "the-meaning-of-the-glorious-koran": { year: 632, era: "c. 7th century CE" },
  "the-qur-an-palmer": { year: 632, era: "c. 7th century CE" },

  // Buddhism
  "konjaku-monogatarishu": { year: 1120, era: "c. 1120 CE" },
  "sutra-of-golden-light": { year: 400, era: "c. 5th century CE" },

  // Shinto / Japanese Mythology
  "engishiki-books-110-within-the-complete-engishiki": { year: 927, era: "927 CE" },
  "kojiki": { year: 712, era: "712 CE" },
  "manyoshu": { year: 759, era: "c. 759 CE" },
  "nihon-shoki": { year: 720, era: "720 CE" },
  "nihongi-chronicles-of-japan-from-the-earliest-times-to-a-d-697-aston-complete": { year: 720, era: "720 CE" },
  "the-kojiki-records-of-ancient-matters": { year: 712, era: "712 CE" },

  // Ainu
  "aino-folk-tales": { year: 1888, era: "1888 CE" },

  // Japanese Historical Literature
  "gikeiki": { year: 1400, era: "c. 15th century CE" },

  // Scholarly / Comparative
  "why-omnipotence-does-not-hide-behind-syncretic-texts": { year: 2020, era: "Contemporary" },
};

/**
 * Resolve a work id (with or without the "work:" prefix) to its curated
 * composition chronology, or null when the work has no known date.
 */
export function chronologyForWork(workId: string | null | undefined): WorkChronology | null {
  if (!workId) return null;
  const bare = workId.startsWith("work:") ? workId.slice("work:".length) : workId;
  return WORK_CHRONOLOGY[bare] ?? null;
}

/** Resolve a work id (with or without the "work:" prefix) to its tradition. */
export function traditionForWork(workId: string | null | undefined): TraditionInfo {
  if (!workId) return UNCLASSIFIED_TRADITION;
  const bare = workId.startsWith("work:") ? workId.slice("work:".length) : workId;
  const key = WORK_TRADITIONS[bare];
  return (key && TRADITIONS[key]) || UNCLASSIFIED_TRADITION;
}

/** Resolve a tradition id to its family. */
export function familyForTradition(traditionId: string | null | undefined): TraditionFamilyInfo {
  if (!traditionId) return UNCLASSIFIED_FAMILY;
  const key = TRADITION_FAMILIES[traditionId];
  return (key && FAMILIES[key]) || UNCLASSIFIED_FAMILY;
}

/** Resolve a work id (with or without the "work:" prefix) to its tradition family. */
export function familyForWork(workId: string | null | undefined): TraditionFamilyInfo {
  return familyForTradition(traditionForWork(workId).id);
}
