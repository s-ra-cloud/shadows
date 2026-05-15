import { db } from "../server/storage";
import { nodes } from "../shared/schema";
import { eq } from "drizzle-orm";
import fs from "fs";

const DT_REMAP: Record<string, string> = {
  "dying-and-rising god": "resurrection",
  "dying-and-returning god": "resurrection",
  "dying-and-rising — bodily resurrection (Christian theology)": "resurrection",
  "seasonal/dying-and-rising": "resurrection",
  "rebirth": "resurrection",
  "no death — raised alive (Islamic theology)": "apotheosis",
  "Assumption (Catholic dogma)": "apotheosis",
  "Dormition (Eastern tradition)": "apotheosis",
  "ascension to heaven on a dragon": "apotheosis",
  "ascension to immortality from a tavern": "apotheosis",
  "ascension to Vaikuṇṭha": "apotheosis",
  "died young and ascended to heaven; deified": "apotheosis",
  "apotheosis (disappearance and deification as Quirinus)": "apotheosis",
  "self-immolation in cosmic fire (transformation)": "apotheosis",
  "became immortal (consumed the elixir); ascended to the moon": "apotheosis",
  "killed in combat": "killed in battle",
  "killed in Ragnarök": "killed in battle",
  "death at Ragnarǫk": "killed in battle",
  "killed in Xibalba and self-restored; finally raised to the sky as the moon": "killed by god",
  "killed in Xibalba and self-restored; finally raised to the sky as the sun": "killed by god",
  "sacrificed": "sacrificed ritually",
  "sacrificed in Xibalba; later resurrected by the Hero Twins (the maize-cycle charter)": "resurrection",
  "self-restored": "resurrection",
  "mortal": "natural death",
  "mortal — natural death after long life": "natural death",
  "mortal death": "natural death",
  "old age": "natural death",
  "transformation at death": "transformation",
  "transformation of body": "transformation",
  "transformation into moon": "transformation",
  "transformation into star": "transformation",
  "agricultural transformation": "transformation",
};

const EV_REMAP: Record<string, string> = {
  "self-restored": "", // remove from eventTypes per plan
  "demon-slaying": "slays monster",
  "engendering-the-four-Tezcatlipocas": "world creation",
  "Shichifukujin-membership": "", // remove (group membership now an edge)
  "pre-cosmic-being": "primordial existence",
};

const BT_REMAP: Record<string, string> = {
  "uncreated-primordial": "primordial",
  "primordial-uncreated": "primordial",
  "uncreated-primordial-self-engendered": "primordial",
  "primordial — emerged from the meeting of fire and ice in Ginnungagap": "primordial",
  "primordial — emerged from the salt-ice": "primordial",
  "primordial — emerged from the melting rime-ice": "primordial",
  "primordial — fire-giant of Muspelheim": "primordial",
  "primordial — first of God's great works": "primordial",
  "primordial monster": "primordial",
  "primordial monster — created on the fifth day (rabbinic) ": "primordial",
  "primordial monster — created on the fifth day (rabbinic)": "primordial",
  "primordial-cosmic origin": "primordial",
  "primordial creator-deity": "primordial",
  "primordial creator-goddess": "primordial",
  "primordial supreme deity": "primordial",
  "primordial water-deity": "primordial",
  "primordial fire-deity; in some accounts descendant of Zhuanxu": "primordial",
  "primordial demon-goddess": "primordial",
  "primordial Buddha; the embodiment of reality itself": "primordial",
  "primordial sea-giantess": "primordial",
  "primordial Ogdoad-being": "primordial",
  "primordial cosmic-being (Hermopolitan tradition)": "primordial",
  "primordial — first of God's great works ": "primordial",
  "primordial earth-monster": "primordial",
  "primordial; self-existent before the cosmos": "primordial",
  "(primordial) uncreated": "primordial",
  "primordial-chaos": "primordial",
  "pre-cosmic chaos-being (uncreated, primordial)": "primordial",
  "primordial, self-existent before the cosmos": "primordial",
  "primordial-divine lineage": "primordial",
  "pre-cosmic-being": "primordial",
  "ancient primordial goddess": "primordial",
  "primordial Great Mother": "primordial",
  "the primordial Great Mother": "primordial",
  "primordial earth-mother": "primordial",
  "earth-mother goddess": "primordial",
  "ancient being": "primordial",
  "self-existent": "primordial",
  "uncreated; the first being": "primordial",
  "uncreated; one of the first primordials": "primordial",
  "the uncreated formless absolute": "primordial",
  "the uncreated, unknowable transcendent source": "primordial",
  "eternal cosmic principle": "primordial",
  "eternal cosmic form": "primordial",
  "cosmic principle": "primordial",
  "cosmic-eternal": "primordial",
  "eternal, beginningless": "primordial",
  "self-engendered": "primordial",
  "theogonic, primordial": "theogonic",
  "primordial, theogonic": "theogonic",
  "primordial goddess (Theban tradition)": "primordial",
  "Maya goddess": "divine parentage",
  "high astral deity": "divine parentage",
  "solar deity": "divine parentage",
  "rice- and fertility-goddess": "divine parentage",
  "vegetation- and maize-deity": "divine parentage",
  "underworld deity": "divine parentage",
  "primordial underworld-deity": "primordial",
  "monstrous being of the underworld": "divine parentage",
  "monstrous being of the age before the true sun": "divine parentage",
  "lord of the underworld": "divine parentage",
  "major Maya deity": "divine parentage",
  "an Anatolian lunar deity": "divine parentage",
  "a Phrygian-Thracian sky-deity": "divine parentage",
  "diseased god": "divine parentage",
  "proud wealthy god": "divine parentage",
  "Germanic coastal deity known from votive epigraphy": "divine parentage",
  "demon-queen; associated with the legendary witch-widow Calon Arang": "demonic",
  "personification of death and delusion": "demonic",
  "primordial demon-goddess": "primordial",
  "Aesir-goddess": "Aesir lineage",
  "Aesir-lineage": "Aesir lineage",
  "Vanir lineage": "divine parentage",
  "Jǫtunn": "Jötunn parentage",
  "giant-divine": "giant-divine parentage",
  "giant-divine (Magni)": "giant-divine parentage",
  "giant parentage": "giant-divine parentage",
  "elf-lineage (dawn-elf)": "divine parentage",
  "dwarf-lineage": "divine parentage",
  "daitya lineage": "divine parentage",
  "half-rākṣasa, half-brahmin lineage": "divine parentage",
  "Nereid (daughter of Nereus and Doris)": "divine parentage",
  "Oceanid (one of the 3,000)": "divine parentage",
  "ancient Mesoamerican rain-deity complex": "divine parentage",
  "ancient Mesoamerican deity-complex (back to Teotihuacan)": "divine parentage",
  "pre-Aztec Mesoamerican origin": "divine parentage",
  "mother-goddess complex": "divine parentage",
  "tutelary spirits": "divine parentage",
  "tutelary spirits (variable origin-narratives)": "divine parentage",
  "protective beast-spirit": "divine parentage",
  "an aeon of the Pleroma, emanated within the divine fullness": "emanation",
  "the first emanation of the unknowable Monad": "emanation",
  "wrathful emanation; derived from the Hindu Mahākāla": "emanation",
  "emanation; manifests as the historical Laozi": "emanation",
  "emanation from Ra (as Eye)": "emanation",
  "emanation of the primordial origin": "emanation",
  "emanated from combined divine tejas": "emanation",
  "the Buddhist form of the Vedic/Hindu Yama": "syncretic-import",
  "Chinese-Daoist-import": "syncretic-import",
  "Chinese-Daoist-import (from Shou-lao)": "syncretic-import",
  "syncretic-origin (Hindu-Buddhist Mahākāla absorbed into Shintō)": "syncretic-import",
  "syncretic Buddhist-import (from Vaiśravaṇa/Kubera)": "syncretic-import",
  "syncretic-origin (Hindu-Buddhist Mahākāla absorbed into Shintō)": "syncretic-import",
  "syncretic (Hiruko-or-Kotoshironushi origin)": "syncretic-import",
  "miraculous": "miraculous birth",
  "miraculous — born of nine mothers": "miraculous birth",
  "miraculous — born for vengeance": "miraculous birth",
  "miraculous — from spittle of two pantheons": "miraculous birth",
  "miraculous, of wind-god parentage": "miraculous birth",
  "miraculous, from Śiva's seed nurtured by Kṛttikās": "miraculous birth",
  "miraculous-armed-from-Coatlicue's-womb": "miraculous birth",
  "miraculous; in some accounts his mother conceived him after seeing a great flash of lightning around the Big Dipper": "miraculous birth",
  "miraculous (son of Mars by a Vestal)": "miraculous birth",
  "miraculous infant deliverance": "miraculous birth",
  "virginal conception": "miraculous conception",
  "immaculate conception (Catholic dogma)": "miraculous conception",
  "traditional miraculous conception (Protoevangelium)": "miraculous conception",
  "posthumous conception": "miraculous conception",
  "prophecy at birth": "miraculous birth",
  "divine call": "miraculous birth",
  "divine intercession": "divine parentage",
  "divine fatherhood": "divine parentage",
  "divine archer; sent down from heaven by Di Jun in some accounts": "divine parentage",
  "divine lineage": "divine parentage",
  "divine or elevated mortal": "divine parentage",
  "divine-human union": "divine-human parentage",
  "divine-human parentage": "divine parentage",
  "divine incarnation (in Christian theology)": "divine parentage",
  "semi-divine": "demigod birth",
  "joint iconic form": "divine parentage",
  "cosmic-iconic manifestation": "divine parentage",
  "cosmic-functional being": "divine parentage",
  "cosmic-iconic manifestation": "divine parentage",
  "cosmic ruler-power / archon": "divine parentage",
  "a cosmic ruler-power / archon": "divine parentage",
  "cosmic river": "divine parentage",
  "cosmic-iconic manifestation": "divine parentage",
  "young maize personification": "divine parentage",
  "deified mortal of indeterminate origin": "mortal-elevated to divine",
  "deified mortal (a Tang-dynasty woman who attained immortality)": "mortal-elevated to divine",
  "deified mortal (a Tang-dynasty scholar who attained immortality)": "mortal-elevated to divine",
  "deified mortal (a Han-dynasty general who attained immortality)": "mortal-elevated to divine",
  "deified mortal (a Song-dynasty imperial relative who attained immortality)": "mortal-elevated to divine",
  "deified mortal (the girl Lin Moniang)": "mortal-elevated to divine",
  "mortal woman who became immortal by consuming the elixir": "mortal-elevated to divine",
  "deified mortal (attained immortality after falling from a magical peach tree)": "mortal-elevated to divine",
  "transformed mortal": "mortal-elevated to divine",
  "possibly a transformed mortal (Elijah)": "mortal-elevated to divine",
  "originally Enoch (Genesis 5:24)": "mortal-elevated to divine",
  "historical-monk-deification": "mortal-elevated to divine",
  "born a human prince; in tradition, his birth attended by marvels": "miraculous birth",
  "various origin-legends; usually a deified or transformed mortal man": "mortal-elevated to divine",
  "variously narrated; in the Yuhuang Jing, born a prince who cultivated to divinity": "mortal-elevated to divine",
  "semi-legendary; in hagiography, born already old after a long gestation, or born from his mother's side": "miraculous birth",
  "commoner raised to the throne by virtue": "mortal-elevated to divine",
  "early sage-ruler; in some accounts son of a princess and a divine dragon": "mortal-elevated to divine",
  "sage-king": "mortal-elevated to divine",
  "culture-hero; in some accounts born of a princess and a divine dragon": "mortal-elevated to divine",
  "imperial-divine descent": "demigod birth",
  "indigenous Sabine origin; later identified with Romulus": "mortal-elevated to divine",
  "indigenous Italic origin": "divine parentage",
  "Etruscan origin (Voltumna)": "divine parentage",
  "self-engendered from the primordial waters": "primordial",
  "self-engendered from Viṣṇu's navel-lotus": "self-engendered",
  "born from cosmic egg": "primordial",
  "born from a stone egg on the Mountain of Flowers and Fruit": "miraculous birth",
  "born of the nymph Nana, impregnated by an almond from the body of Agdistis": "miraculous conception",
  "born from a tear of compassion of Avalokiteśvara": "miraculous birth",
  "born androgynous from the seed of Zeus fallen on the rock": "miraculous birth",
  "born from a ball of flesh after a 3.5-year pregnancy": "miraculous birth",
  "born from the body of his father Gun after Gun's execution": "born from body",
  "in some accounts, born from the body of his father Gun after Gun's execution": "born from body",
  "born from Jupiter's head (importing the Athena-Metis narrative)": "born from body",
  "born from the earth": "primordial emergence",
  "earth-born (terra editum)": "primordial emergence",
  "fashioned from clay": "primordial emergence",
  "clay-formed": "primordial emergence",
  "fashioned from Adam": "primordial emergence",
  "created from earth simultaneously with Adam": "primordial emergence",
  "created from mother's body-substance": "born from body",
  "emerged from blood (of Kagutsuchi)": "born from body",
  "emerged from Atum (with twin-sister Tefnut)": "primordial emergence",
  "emerged from Atum (with twin-brother Shu)": "primordial emergence",
  "emerged from Brahmā in self-engendered creation": "primordial emergence",
  "emerged from Chaos": "primordial emergence",
  "emerged from the churning of the cosmic ocean": "primordial emergence",
  "brought forth by the aeon Sophia alone, without a consort — a malformed offspring": "emanation",
  "child of Cronus and Rhea; swallowed and regurgitated": "divine parentage",
  "child of Saturn and Ops; swallowed and regurgitated": "divine parentage",
  "child of Saturn and Ops; swallowed and regurgitated (importing the Hesiodic narrative)": "divine parentage",
  "child of Saturn and Ops": "divine parentage",
  "child of Ouranos and Gaia": "divine parentage",
  "child of Geb and Nut": "divine parentage",
  "child of Pontus and Gaia": "divine parentage",
  "child of Gaia and Tartarus": "divine parentage",
  "child of Ptah and Sekhmet": "divine parentage",
  "child of Amun and Mut": "divine parentage",
  "child of Nephthys (by Osiris or Set)": "divine parentage",
  "child of Poseidon and Amphitrite": "divine parentage",
  "child of Shu and Tefnut": "divine parentage",
  "child of Zeus and Hera": "divine parentage",
  "child of Typhon and Echidna": "divine parentage",
  "(Olympian) son of Aphrodite": "divine parentage",
  "son of Ōkuninushi": "divine parentage",
  "son of Sūrya": "divine parentage",
  "son of the asura Rambha and a buffalo-cow": "divine parentage",
  "son of Juno (sometimes parthenogenetically); identified with Ares (son of Zeus and Hera)": "divine parentage",
  "son of the sage Śilāda; primordial mount-of-Śiva": "divine parentage",
  "son of the earth-born Tuisto": "divine parentage",
  "daughter of Ra": "divine parentage",
  "daughter of Adam and Eve, of the spiritual race": "mortal parentage",
  "daughter of Phorcys and Ceto": "divine parentage",
  "daughter of Sūrya": "divine parentage",
  "daughter of Coatlicue": "divine parentage",
  "daughter of Dyaus": "divine parentage",
  "daughter of Shu and Tefnut": "divine parentage",
  "daughter of the mountain": "divine parentage",
  "son of Aditi by Kaśyapa": "divine parentage",
  "descended from Kadrū and Kaśyapa": "divine parentage",
  "Aesir lineage": "divine parentage",
  "two traditions: parthenogenetic from Nyx; or daughters of Zeus and Themis": "divine parentage",
  "parthenogenetic from Nyx": "parthenogenesis",
  "parthenogenetic from Gaia": "parthenogenesis",
  "of the early divine generation of the Popol Vuh": "divine parentage",
  "Jötunn parentage": "Jötunn parentage",
  "heavenly king; linked with the Indian Kubera": "divine parentage",
  "heavenly maiden": "divine parentage",
  "conceived by the maiden Xquic, made pregnant by the spittle of the severed head of Hun Hunahpu": "miraculous conception",
  "bestial-conception (Pasiphae and the Cretan bull)": "miraculous conception",
  "consequence of bride-price": "divine parentage",
  "divine parentage (mother Sif) ": "divine parentage",
  "divine parentage (mother Sif)": "divine parentage",
  "angelic — created good, fell through pride (Christian theology)": "angelic — created",
  "created — from smokeless fire (jinn)": "angelic — created",
  "angelic": "angelic — created",
  "divinely-breathed": "miraculous birth",
  "divine breath": "miraculous birth",
  "miraculous creation": "miraculous birth",
  "Tecuciztecatl's self-immolation at Teotihuacan": "apotheosis",
  "Nanahuatzin's self-immolation in cosmic fire": "apotheosis",
  "attained Buddhahood as the monk Dharmākara": "mortal-elevated to divine",
  "attained Buddhahood through twelve healing vows": "mortal-elevated to divine",
  "bodhisattva awaiting a far-future final birth": "bodhisattva",
  "bodhisattva; in Nyingma, primordial Buddha": "bodhisattva",
  "bodhisattva; in the Miaoshan legend, born a human princess": "bodhisattva",
  "a yakṣiṇī (nature-spirit) converted by the Buddha": "bodhisattva",
  "born of the nymph Nana, impregnated by an almond from the body of Agdistis": "miraculous conception",
  "the uncreated formless absolute": "primordial",
  "Buddhist deity": "divine parentage",
  "avatar-manifestation": "avatar-incarnation",
  "avatar-emergence": "avatar-incarnation",
  "avatar-incarnation; divine-blessing-birth": "avatar-incarnation",
  "reincarnation of Satī": "avatar-incarnation",
  "half-divine (nephew of the Jade Emperor; in some traditions son of a mortal man and a celestial woman)": "demigod birth",
  "Jötunn parentage": "Jötunn parentage",
  "in some accounts, born from the body of his father Gun after Gun's execution": "born from body",
  "prison-birth": "mortal parentage",
  "theogonic genealogy": "theogonic",
  "theogonic; from the eye of Atri in one account": "theogonic",
  "primordial — first of God's great works": "primordial",
  // "identified with X" → divine parentage (no info about birth, just identification)
  "identified with Artemis": "divine parentage",
  "identified with Hermes (son of Zeus and Maia)": "divine parentage",
  "identified with Hephaestus": "divine parentage",
  "identified with Asclepius": "divine parentage",
  "identified with Helios": "divine parentage",
  "identified with sea-foam-born Aphrodite": "divine parentage",
  "identified with Heracles": "divine parentage",
  "identified with Eros": "divine parentage",
  "identified with Persephone": "divine parentage",
  "identified with Cronus (son of Caelus/Ouranos and Tellus/Gaia)": "divine parentage",
  "identified with Hades": "divine parentage",
  "identified with Dionysus": "divine parentage",
  "identified with Hestia; swallowed by Saturn": "divine parentage",
  "identified with Poseidon (child of Saturn and Ops)": "divine parentage",
};

function remapArray(arr: string[] | null, map: Record<string, string>): { out: string[]; changed: boolean } {
  if (!arr) return { out: [], changed: false };
  const out: string[] = [];
  let changed = false;
  for (const v of arr) {
    const trimmed = v.trim();
    if (trimmed in map) {
      const repl = map[trimmed];
      changed = true;
      if (repl && !out.includes(repl)) out.push(repl);
    } else {
      if (!out.includes(trimmed)) out.push(trimmed);
    }
  }
  return { out, changed };
}

async function main() {
  const dryRun = !process.argv.includes("--apply");
  console.log(`Mode: ${dryRun ? "DRY RUN" : "APPLY"}`);
  const all = await db.select().from(nodes);
  const report: string[] = ["id\tname\tfield\tbefore\tafter"];
  let updated = 0;
  const unmappedSingletons: { field: string; value: string; nodes: string[] }[] = [];

  // Pre-compute remaining singletons after remap
  const seen = { bt: new Map<string, string[]>(), dt: new Map<string, string[]>(), ev: new Map<string, string[]>() };

  for (const n of all) {
    const updates: Record<string, any> = {};
    for (const [field, src, map, key] of [
      ["birthTypes", n.birthTypes, BT_REMAP, "bt"],
      ["deathTypes", n.deathTypes, DT_REMAP, "dt"],
      ["eventTypes", n.eventTypes, EV_REMAP, "ev"],
    ] as const) {
      const { out, changed } = remapArray(src as string[] | null, map);
      if (changed) {
        report.push(`${n.id}\t${n.name}\t${field}\t${JSON.stringify(src)}\t${JSON.stringify(out)}`);
        updates[field] = out;
      }
      // Track for singleton detection
      const target = seen[key];
      for (const v of out) {
        if (!target.has(v)) target.set(v, []);
        target.get(v)!.push(n.name);
      }
    }
    if (Object.keys(updates).length > 0) {
      updated++;
      if (!dryRun) {
        await db.update(nodes).set(updates).where(eq(nodes.id, n.id));
      }
    }
  }

  // Singletons report (post-remap)
  const singletons: string[] = ["field\tvalue\tcount\tnodes"];
  for (const [key, label] of [["bt", "birthTypes"], ["dt", "deathTypes"], ["ev", "eventTypes"]] as const) {
    const m = seen[key];
    for (const [v, nodeNames] of Array.from(m.entries()).sort((a, b) => a[1].length - b[1].length)) {
      if (nodeNames.length === 1) {
        singletons.push(`${label}\t${v}\t1\t${nodeNames[0]}`);
      }
    }
  }

  fs.mkdirSync("scripts/reports", { recursive: true });
  fs.writeFileSync("scripts/reports/06-array-vocab-changes.tsv", report.join("\n"));
  fs.writeFileSync("scripts/reports/06-singletons-after-remap.tsv", singletons.join("\n"));

  const singletonCount = singletons.length - 1;
  console.log(`\nNodes updated: ${updated}`);
  console.log(`Total changes logged: ${report.length - 1}`);
  console.log(`Remaining singletons (post-remap): ${singletonCount}`);
  console.log(`Reports: scripts/reports/06-array-vocab-changes.tsv, 06-singletons-after-remap.tsv`);
  if (dryRun) console.log(">>> DRY RUN — re-run with --apply");
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
