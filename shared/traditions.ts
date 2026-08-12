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

/** Resolve a work id (with or without the "work:" prefix) to its tradition. */
export function traditionForWork(workId: string | null | undefined): TraditionInfo {
  if (!workId) return UNCLASSIFIED_TRADITION;
  const bare = workId.startsWith("work:") ? workId.slice("work:".length) : workId;
  const key = WORK_TRADITIONS[bare];
  return (key && TRADITIONS[key]) || UNCLASSIFIED_TRADITION;
}
