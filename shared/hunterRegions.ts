/**
 * Mythological world regions used by Source Hunter hunting cycles.
 * Coordinates are [longitude, latitude] centroids for map markers.
 * `terms` seed the discovery query when the editor launches a cycle
 * scoped to the region without typing a query.
 */
export interface HunterRegion {
  id: string;
  label: string;
  coordinates: [number, number];
  terms: string;
}

export const HUNTER_REGIONS: HunterRegion[] = [
  { id: "mesopotamia", label: "Mesopotamia & Near East", coordinates: [44.4, 33.3], terms: "Mesopotamian Sumerian Akkadian Babylonian mythology epic" },
  { id: "egypt", label: "Egypt & Nile Valley", coordinates: [31.2, 26.8], terms: "ancient Egyptian mythology Book of the Dead pyramid texts" },
  { id: "greece", label: "Greece & Aegean", coordinates: [23.7, 38.5], terms: "Greek mythology Homeric hymns Hesiod theogony" },
  { id: "rome", label: "Rome & Italy", coordinates: [12.5, 42.5], terms: "Roman mythology Ovid metamorphoses Virgil" },
  { id: "norse", label: "Scandinavia & Norse", coordinates: [15.0, 62.0], terms: "Norse mythology Edda saga Scandinavian" },
  { id: "celtic", label: "Celtic Europe", coordinates: [-6.5, 53.0], terms: "Celtic Irish Welsh mythology Mabinogion Tain" },
  { id: "slavic", label: "Slavic & Baltic Europe", coordinates: [30.0, 52.0], terms: "Slavic Baltic mythology folklore byliny" },
  { id: "persia", label: "Persia & Central Asia", coordinates: [53.0, 32.5], terms: "Persian Zoroastrian mythology Avesta Shahnameh" },
  { id: "india", label: "India & South Asia", coordinates: [78.5, 22.0], terms: "Hindu Vedic mythology Ramayana Mahabharata puranas" },
  { id: "china", label: "China & East Asia", coordinates: [104.0, 35.0], terms: "Chinese mythology classic of mountains and seas Taoist" },
  { id: "japan", label: "Japan", coordinates: [138.0, 36.5], terms: "Japanese mythology Kojiki Nihon Shoki Shinto" },
  { id: "southeast-asia", label: "Southeast Asia", coordinates: [105.0, 12.0], terms: "Southeast Asian mythology Hindu Buddhist epic folklore" },
  { id: "africa", label: "Sub-Saharan Africa", coordinates: [20.0, 2.0], terms: "African mythology Yoruba Zulu Ashanti oral tradition" },
  { id: "mesoamerica", label: "Mesoamerica", coordinates: [-92.0, 17.0], terms: "Maya Aztec mythology Popol Vuh codex" },
  { id: "andes", label: "Andes & South America", coordinates: [-72.0, -13.0], terms: "Inca Andean mythology Huarochiri" },
  { id: "north-america", label: "North America (Indigenous)", coordinates: [-100.0, 45.0], terms: "Native American Indigenous mythology legends oral tradition" },
  { id: "oceania", label: "Oceania & Polynesia", coordinates: [172.0, -15.0], terms: "Polynesian Maori Hawaiian mythology oral tradition" },
];

export function getHunterRegion(id: string): HunterRegion | undefined {
  return HUNTER_REGIONS.find((r) => r.id === id);
}
