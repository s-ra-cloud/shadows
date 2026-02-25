import { storage } from "./storage";

export async function seedDatabase() {
  try {
    const existingProjects = await storage.getProjects();
    if (existingProjects.length > 0) return;

    console.log("Seeding database...");

    const proj = await storage.createProject({
      title: "Comparative Mythological Atlas",
      description: "An interactive network mapping mythological figures across world traditions, positioning them by attribute similarity.",
      slug: "atlas",
    });

    const zeus = await storage.createNode({ projectId: proj.id, name: "Zeus", tradition: "Greek", gender: "Male", domain: "Sky, thunder, justice, kingship", object: "Thunderbolt, aegis, scepter", animals: "Eagle, bull", characterTrait: "Authoritative, unfaithful, wrathful, protective", physicalCharacteristics: "Imposing, bearded, muscular", significantEvent: "Overthrew the Titans, swallowed by Kronos as infant", birthCircumstances: "Born to Kronos and Rhea, hidden in Crete to escape being swallowed", deathCircumstances: null });
    const odin = await storage.createNode({ projectId: proj.id, name: "Odin", tradition: "Norse", gender: "Male", domain: "Wisdom, war, death, poetry, magic", object: "Spear Gungnir, ring Draupnir", animals: "Ravens (Huginn & Muninn), wolves (Geri & Freki), horse Sleipnir", characterTrait: "Wise, cunning, self-sacrificing, wandering", physicalCharacteristics: "One-eyed, cloaked, old but powerful", significantEvent: "Sacrificed an eye at Mimir's well, hung on Yggdrasil for runes", birthCircumstances: "Son of Borr and Bestla", deathCircumstances: "Swallowed by Fenrir at Ragnarok" });
    const isis = await storage.createNode({ projectId: proj.id, name: "Isis", tradition: "Egyptian", gender: "Female", domain: "Magic, motherhood, healing, wisdom", object: "Tyet knot, throne headdress", animals: "Kite (bird), scorpion", characterTrait: "Devoted, cunning, powerful, nurturing", physicalCharacteristics: "Winged, crowned with throne symbol", significantEvent: "Reassembled Osiris's body, learned Ra's secret name", birthCircumstances: "Daughter of Geb (earth) and Nut (sky)", deathCircumstances: null });
    const amaterasu = await storage.createNode({ projectId: proj.id, name: "Amaterasu", tradition: "Shinto", gender: "Female", domain: "Sun, sovereignty, weaving", object: "Sacred mirror Yata no Kagami, jewel Yasakani no Magatama", animals: "Rooster", characterTrait: "Radiant, benevolent, withdrawn when offended", physicalCharacteristics: "Radiating light, luminous", significantEvent: "Withdrew into a cave plunging the world into darkness", birthCircumstances: "Born from Izanagi's left eye during purification", deathCircumstances: null });
    const thor = await storage.createNode({ projectId: proj.id, name: "Thor", tradition: "Norse", gender: "Male", domain: "Thunder, strength, protection of humanity", object: "Hammer Mjolnir, belt Megingjord, iron gloves", animals: "Goats (Tanngrisnir & Tanngnjóstr)", characterTrait: "Brave, hot-tempered, loyal, straightforward", physicalCharacteristics: "Red-bearded, massive, strongest of the gods", significantEvent: "Fishing for Jörmungandr, battles at Ragnarok", birthCircumstances: "Son of Odin and the giantess Jord", deathCircumstances: "Kills Jörmungandr at Ragnarok but dies from its venom" });
    const athena = await storage.createNode({ projectId: proj.id, name: "Athena", tradition: "Greek", gender: "Female", domain: "Wisdom, strategic warfare, crafts", object: "Aegis, shield with Medusa's head, olive tree", animals: "Owl, serpent", characterTrait: "Strategic, just, virginal, competitive", physicalCharacteristics: "Grey-eyed, helmeted, armored", significantEvent: "Won patronage of Athens over Poseidon, aided Perseus and Odysseus", birthCircumstances: "Born fully armored from Zeus's forehead", deathCircumstances: null });
    const vishnu = await storage.createNode({ projectId: proj.id, name: "Vishnu", tradition: "Hindu", gender: "Male", domain: "Preservation, cosmic order, protection", object: "Discus Sudarshana Chakra, conch Panchajanya, mace Kaumodaki, lotus", animals: "Eagle Garuda, serpent Shesha", characterTrait: "Benevolent, just, protective, patient", physicalCharacteristics: "Blue-skinned, four-armed", significantEvent: "Incarnates as avatars (Rama, Krishna) to restore cosmic order", birthCircumstances: "Self-existent, part of the Trimurti", deathCircumstances: null });
    const persephone = await storage.createNode({ projectId: proj.id, name: "Persephone", tradition: "Greek", gender: "Female", domain: "Spring, underworld, vegetation, death", object: "Pomegranate, torch, flowers", animals: "Deer", characterTrait: "Dual-natured, innocent yet fearsome, seasonal", physicalCharacteristics: "Youthful, beautiful, sometimes depicted with crown", significantEvent: "Abducted by Hades, ate pomegranate seeds binding her to underworld", birthCircumstances: "Daughter of Zeus and Demeter", deathCircumstances: null });
    const osiris = await storage.createNode({ projectId: proj.id, name: "Osiris", tradition: "Egyptian", gender: "Male", domain: "Afterlife, resurrection, agriculture, fertility", object: "Crook and flail, atef crown", animals: "Ram", characterTrait: "Just, merciful, civilizing", physicalCharacteristics: "Green or black skinned, mummiform", significantEvent: "Murdered and dismembered by Set, resurrected by Isis", birthCircumstances: "Son of Geb (earth) and Nut (sky)", deathCircumstances: "Murdered by his brother Set, dismembered into pieces" });
    const loki = await storage.createNode({ projectId: proj.id, name: "Loki", tradition: "Norse", gender: "Male (shape-shifter)", domain: "Trickery, fire, chaos", object: "None specific, uses cunning", animals: "Salmon, fly, mare (shape-shifted forms)", characterTrait: "Cunning, deceitful, unpredictable, witty", physicalCharacteristics: "Handsome, shape-shifting", significantEvent: "Caused Baldr's death, bound with serpent venom", birthCircumstances: "Son of giants Farbauti and Laufey", deathCircumstances: "Kills and is killed by Heimdall at Ragnarok" });
    const inanna = await storage.createNode({ projectId: proj.id, name: "Inanna", tradition: "Sumerian", gender: "Female", domain: "Love, war, fertility, political power", object: "Lapis lazuli necklace, me (divine powers)", animals: "Lion", characterTrait: "Ambitious, passionate, fierce, imperious", physicalCharacteristics: "Adorned with jewels, radiating power", significantEvent: "Descended to the underworld and returned", birthCircumstances: "Daughter of Nanna (moon god) or An (sky god)", deathCircumstances: "Died in the underworld but was resurrected" });
    const quetzalcoatl = await storage.createNode({ projectId: proj.id, name: "Quetzalcoatl", tradition: "Aztec", gender: "Male", domain: "Wind, learning, creation, morning star", object: "Conch shell, feathered headdress", animals: "Feathered serpent, quetzal bird", characterTrait: "Wise, civilizing, peaceful, penitent", physicalCharacteristics: "Feathered serpent or pale-skinned bearded man", significantEvent: "Created humanity from bones of the dead, self-exiled after being tricked", birthCircumstances: "Son of Ometecuhtli and Omecihuatl, or born from Coatlicue", deathCircumstances: "Self-immolated and became the morning star" });

    await storage.createEdge({ projectId: proj.id, sourceNodeId: zeus.id, targetNodeId: athena.id, relationType: "parent of", weight: 3 });
    await storage.createEdge({ projectId: proj.id, sourceNodeId: zeus.id, targetNodeId: persephone.id, relationType: "parent of", weight: 3 });
    await storage.createEdge({ projectId: proj.id, sourceNodeId: isis.id, targetNodeId: osiris.id, relationType: "married to", weight: 3 });
    await storage.createEdge({ projectId: proj.id, sourceNodeId: odin.id, targetNodeId: thor.id, relationType: "parent of", weight: 3 });
    await storage.createEdge({ projectId: proj.id, sourceNodeId: odin.id, targetNodeId: loki.id, relationType: "blood brother of", weight: 2 });
    await storage.createEdge({ projectId: proj.id, sourceNodeId: thor.id, targetNodeId: loki.id, relationType: "companion of", weight: 2 });
    await storage.createEdge({ projectId: proj.id, sourceNodeId: persephone.id, targetNodeId: osiris.id, relationType: "parallel (underworld ruler)", weight: 1 });
    await storage.createEdge({ projectId: proj.id, sourceNodeId: isis.id, targetNodeId: osiris.id, relationType: "resurrected", weight: 3 });
    await storage.createEdge({ projectId: proj.id, sourceNodeId: inanna.id, targetNodeId: persephone.id, relationType: "parallel (underworld descent)", weight: 2 });
    await storage.createEdge({ projectId: proj.id, sourceNodeId: inanna.id, targetNodeId: isis.id, relationType: "parallel (powerful goddess)", weight: 1 });
    await storage.createEdge({ projectId: proj.id, sourceNodeId: loki.id, targetNodeId: quetzalcoatl.id, relationType: "parallel (trickster/transformation)", weight: 1 });
    await storage.createEdge({ projectId: proj.id, sourceNodeId: vishnu.id, targetNodeId: osiris.id, relationType: "parallel (death and rebirth)", weight: 1 });
    await storage.createEdge({ projectId: proj.id, sourceNodeId: amaterasu.id, targetNodeId: zeus.id, relationType: "parallel (supreme sky deity)", weight: 1 });
    await storage.createEdge({ projectId: proj.id, sourceNodeId: athena.id, targetNodeId: inanna.id, relationType: "parallel (war goddess)", weight: 1 });

    await storage.createNews({
      title: "SHADOWS Atlas v2.0 Released with Enhanced Graph Engine",
      content: "We are pleased to announce the release of SHADOWS Atlas version 2.0, featuring a completely redesigned graph visualization engine. The new similarity-based layout algorithm positions mythological figures by shared attributes, revealing structural parallels across traditions. The update also introduces a new filtering system allowing researchers to isolate figures by tradition, domain, and other characteristics.",
    });
    await storage.createNews({
      title: "Keynote at Digital Humanities Conference 2026",
      content: "Laura Duparc will deliver the keynote address at the Digital Humanities Conference in Berlin, presenting the SHADOWS methodology for computational comparative mythology. The talk will demonstrate how similarity-based network analysis reveals previously unrecognized structural parallels between mythological traditions worldwide.",
    });
    await storage.createNews({
      title: "New Figures Added: Mesoamerican and Sumerian Traditions",
      content: "The SHADOWS team has expanded the atlas to include key figures from Mesoamerican and Sumerian mythological traditions. Quetzalcoatl and Inanna join the network, revealing fascinating parallels with figures from other traditions in terms of underworld descent narratives and civilizing hero motifs.",
    });

    await storage.createPublication({
      title: "Network Analysis of Mythological Structures Across World Traditions",
      authors: "Duparc, L., Bertrand, C., Nagai, A.",
      venue: "Journal of Digital Humanities, Vol. 12",
      abstract: "This paper presents a novel computational approach to comparative mythology, using attribute-based similarity metrics to position mythological figures in network space. Our analysis reveals statistically significant clustering patterns that illuminate shared structural motifs across geographically distant traditions.",
      doi: "10.1234/jdh.2025.0042",
    });
    await storage.createPublication({
      title: "Descent Narratives Across Cultures: A Computational Comparison",
      authors: "Bertrand, C., Duparc, L.",
      venue: "Comparative Mythology Review, Vol. 8",
      abstract: "An analysis of underworld descent narratives across Sumerian, Greek, Egyptian, and Mesoamerican traditions using graph-theoretic methods. We demonstrate that figures associated with death-and-return motifs occupy structurally homologous positions in the SHADOWS atlas.",
      doi: "10.1234/cmr.2025.0018",
    });
    await storage.createPublication({
      title: "Similarity Metrics for Cross-Cultural Mythological Comparison",
      authors: "Nagai, A., Duparc, L., Bertrand, C.",
      venue: "Digital Humanities Quarterly",
      abstract: "We propose a computational framework for measuring similarity between mythological figures based on categorical attributes including domain, gender, associated objects, animals, character traits, and narrative events. Our multi-dimensional similarity metric enables automated clustering and visualization of cross-cultural parallels.",
      doi: "10.1234/dhq.2024.0091",
    });

    console.log("Database seeded successfully.");
  } catch (error) {
    console.error("Seed error:", error);
  }
}
