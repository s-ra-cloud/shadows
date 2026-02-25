import { storage, db } from "./storage";
import { projects, nodes, edges, news, publications } from "@shared/schema";
import { sql } from "drizzle-orm";

export async function seedDatabase() {
  try {
    const existingProjects = await storage.getProjects();
    if (existingProjects.length > 0) return;

    console.log("Seeding database...");

    const proj1 = await storage.createProject({
      title: "Archetypal Pantheon Network",
      description: "An interactive graph mapping the archetypal relationships between major deities, heroes, and mythological figures across Indo-European, Mesopotamian, and East Asian traditions. Reveals structural homologies in divine hierarchies and hero cycles.",
      slug: "archetypal-pantheon",
    });

    const proj2 = await storage.createProject({
      title: "Shadow & Symbol in Pop Culture",
      description: "Tracing the re-emergence of Jungian archetypes in contemporary popular culture — from comic book superheroes to cinematic mythologies. Maps the symbolic DNA connecting ancient gods to modern icons.",
      slug: "shadow-pop-culture",
    });

    const n1 = await storage.createNode({ projectId: proj1.id, name: "The Hero", type: "archetype", culture: "Universal", period: "Timeless", tradition: "Cross-cultural", domain: "Transformation", description: "The central archetypal figure of the monomyth. Represents the ego's journey through trials toward individuation.", sources: "Campbell, The Hero with a Thousand Faces", bibliography: "Campbell, J. (1949). The Hero with a Thousand Faces. Pantheon Books." });
    const n2 = await storage.createNode({ projectId: proj1.id, name: "The Shadow", type: "archetype", culture: "Universal", period: "Timeless", tradition: "Jungian", domain: "Unconscious", description: "The repressed, dark side of the personality. Appears as antagonists, monsters, and tricksters in mythology.", sources: "Jung, Aion", bibliography: "Jung, C.G. (1951). Aion: Researches into the Phenomenology of the Self." });
    const n3 = await storage.createNode({ projectId: proj1.id, name: "The Anima", type: "archetype", culture: "Universal", period: "Timeless", tradition: "Jungian", domain: "Psyche", description: "The feminine aspect of the male psyche. Manifests as goddesses, enchantresses, and muse figures.", sources: "Jung, The Archetypes and the Collective Unconscious" });
    const n4 = await storage.createNode({ projectId: proj1.id, name: "Zeus", type: "deity", culture: "Greek", period: "Classical Antiquity", tradition: "Hellenic polytheism", domain: "Sky / Sovereignty", description: "King of the Olympian gods. Embodies the archetype of the divine father and celestial sovereign.", sources: "Hesiod, Theogony" });
    const n5 = await storage.createNode({ projectId: proj1.id, name: "Odin", type: "deity", culture: "Norse", period: "Viking Age", tradition: "Norse polytheism", domain: "Wisdom / War", description: "Allfather of the Norse pantheon. A complex figure combining the Wise Old Man and Trickster archetypes.", sources: "Poetic Edda, Prose Edda" });
    const n6 = await storage.createNode({ projectId: proj1.id, name: "Amaterasu", type: "deity", culture: "Japanese", period: "Ancient", tradition: "Shinto", domain: "Sun / Sovereignty", description: "Sun goddess and supreme deity of Shinto. Represents solar sovereignty and divine feminine authority.", sources: "Kojiki, Nihon Shoki" });
    const n7 = await storage.createNode({ projectId: proj1.id, name: "Isis", type: "deity", culture: "Egyptian", period: "Ancient", tradition: "Egyptian polytheism", domain: "Magic / Motherhood", description: "The Great Mother goddess of Egypt. Embodies magical wisdom, devotion, and regenerative power.", sources: "Plutarch, De Iside et Osiride" });
    const n8 = await storage.createNode({ projectId: proj1.id, name: "The Trickster", type: "archetype", culture: "Universal", period: "Timeless", tradition: "Cross-cultural", domain: "Chaos / Creativity", description: "The boundary-crosser and rule-breaker. Disrupts established order to catalyze transformation.", sources: "Radin, The Trickster" });
    const n9 = await storage.createNode({ projectId: proj1.id, name: "Loki", type: "deity", culture: "Norse", period: "Viking Age", tradition: "Norse polytheism", domain: "Chaos / Fire", description: "Shape-shifting trickster of Norse mythology. Embodies creative destruction and ambiguity.", sources: "Prose Edda, Lokasenna" });
    const n10 = await storage.createNode({ projectId: proj1.id, name: "Hermes", type: "deity", culture: "Greek", period: "Classical Antiquity", tradition: "Hellenic polytheism", domain: "Communication / Boundaries", description: "Messenger of the gods and psychopomp. The divine trickster who crosses between worlds.", sources: "Homeric Hymn to Hermes" });
    const n11 = await storage.createNode({ projectId: proj1.id, name: "The World Tree", type: "motif", culture: "Indo-European", period: "Ancient", tradition: "Cross-cultural", domain: "Cosmology", description: "The axis mundi connecting heaven, earth, and underworld. Yggdrasil in Norse, Ashvattha in Hindu tradition.", sources: "Eliade, The Sacred and the Profane" });
    const n12 = await storage.createNode({ projectId: proj1.id, name: "The Serpent", type: "motif", culture: "Universal", period: "Timeless", tradition: "Cross-cultural", domain: "Transformation / Knowledge", description: "Universal symbol of transformation, wisdom, and the chthonic powers. The ouroboros, kundalini, and the Edenic serpent.", sources: "Mundkur, The Cult of the Serpent" });

    const n13 = await storage.createNode({ projectId: proj2.id, name: "Superman", type: "pop-culture", culture: "American", period: "20th Century", tradition: "Comics", domain: "Heroism", description: "The archetypal modern superhero. A solar hero figure combining the Messiah and the Hero archetypes in American popular mythology.", sources: "Fingeroth, Superman on the Couch" });
    const n14 = await storage.createNode({ projectId: proj2.id, name: "Darth Vader", type: "pop-culture", culture: "American", period: "20th Century", tradition: "Cinema", domain: "Shadow", description: "The fallen father-figure of Star Wars. A direct embodiment of the Jungian Shadow integrated into the Hero's journey.", sources: "Lucas, Star Wars; Campbell correspondence" });
    const n15 = await storage.createNode({ projectId: proj2.id, name: "The Joker", type: "pop-culture", culture: "American", period: "20th Century", tradition: "Comics", domain: "Chaos", description: "Batman's nemesis as modern Trickster. Represents the anarchic, shadow-trickster at the boundary of civilization.", sources: "Morrison, Arkham Asylum" });
    const n16 = await storage.createNode({ projectId: proj2.id, name: "Wonder Woman", type: "pop-culture", culture: "American", period: "20th Century", tradition: "Comics", domain: "Divine Feminine", description: "Amazon warrior-princess modeled on classical goddess archetypes. A modern Athena/Artemis synthesis.", sources: "Marston, Sensation Comics" });
    const n17 = await storage.createNode({ projectId: proj2.id, name: "The Hero (Campbell)", type: "archetype", culture: "Universal", period: "Timeless", tradition: "Jungian", domain: "Transformation", description: "The monomythic hero as theorized by Joseph Campbell. The template underlying Luke Skywalker, Neo, and countless modern protagonists." });
    const n18 = await storage.createNode({ projectId: proj2.id, name: "The Mentor", type: "archetype", culture: "Universal", period: "Timeless", tradition: "Cross-cultural", domain: "Wisdom", description: "The Wise Old Man archetype as it appears in popular culture: Gandalf, Obi-Wan Kenobi, Dumbledore, Morpheus." });

    await storage.createEdge({ projectId: proj1.id, sourceNodeId: n1.id, targetNodeId: n2.id, relationType: "opposition", weight: 3 });
    await storage.createEdge({ projectId: proj1.id, sourceNodeId: n1.id, targetNodeId: n3.id, relationType: "complementarity", weight: 2 });
    await storage.createEdge({ projectId: proj1.id, sourceNodeId: n4.id, targetNodeId: n1.id, relationType: "embodies", weight: 2 });
    await storage.createEdge({ projectId: proj1.id, sourceNodeId: n5.id, targetNodeId: n1.id, relationType: "embodies", weight: 2 });
    await storage.createEdge({ projectId: proj1.id, sourceNodeId: n4.id, targetNodeId: n5.id, relationType: "homology", weight: 3 });
    await storage.createEdge({ projectId: proj1.id, sourceNodeId: n6.id, targetNodeId: n7.id, relationType: "homology", weight: 2 });
    await storage.createEdge({ projectId: proj1.id, sourceNodeId: n7.id, targetNodeId: n3.id, relationType: "embodies", weight: 2 });
    await storage.createEdge({ projectId: proj1.id, sourceNodeId: n8.id, targetNodeId: n2.id, relationType: "overlap", weight: 2 });
    await storage.createEdge({ projectId: proj1.id, sourceNodeId: n9.id, targetNodeId: n8.id, relationType: "embodies", weight: 3 });
    await storage.createEdge({ projectId: proj1.id, sourceNodeId: n10.id, targetNodeId: n8.id, relationType: "embodies", weight: 3 });
    await storage.createEdge({ projectId: proj1.id, sourceNodeId: n9.id, targetNodeId: n10.id, relationType: "homology", weight: 2 });
    await storage.createEdge({ projectId: proj1.id, sourceNodeId: n5.id, targetNodeId: n11.id, relationType: "association", weight: 2 });
    await storage.createEdge({ projectId: proj1.id, sourceNodeId: n12.id, targetNodeId: n2.id, relationType: "symbolizes", weight: 2 });
    await storage.createEdge({ projectId: proj1.id, sourceNodeId: n12.id, targetNodeId: n11.id, relationType: "opposition", weight: 1 });
    await storage.createEdge({ projectId: proj1.id, sourceNodeId: n6.id, targetNodeId: n1.id, relationType: "embodies", weight: 1 });
    await storage.createEdge({ projectId: proj1.id, sourceNodeId: n4.id, targetNodeId: n6.id, relationType: "homology", weight: 2 });

    await storage.createEdge({ projectId: proj2.id, sourceNodeId: n13.id, targetNodeId: n17.id, relationType: "embodies", weight: 3 });
    await storage.createEdge({ projectId: proj2.id, sourceNodeId: n14.id, targetNodeId: n17.id, relationType: "inversion", weight: 2 });
    await storage.createEdge({ projectId: proj2.id, sourceNodeId: n15.id, targetNodeId: n17.id, relationType: "opposition", weight: 2 });
    await storage.createEdge({ projectId: proj2.id, sourceNodeId: n16.id, targetNodeId: n17.id, relationType: "embodies", weight: 2 });
    await storage.createEdge({ projectId: proj2.id, sourceNodeId: n14.id, targetNodeId: n13.id, relationType: "opposition", weight: 1 });
    await storage.createEdge({ projectId: proj2.id, sourceNodeId: n15.id, targetNodeId: n14.id, relationType: "parallel", weight: 1 });
    await storage.createEdge({ projectId: proj2.id, sourceNodeId: n18.id, targetNodeId: n17.id, relationType: "guides", weight: 3 });
    await storage.createEdge({ projectId: proj2.id, sourceNodeId: n16.id, targetNodeId: n18.id, relationType: "complements", weight: 1 });

    await storage.createNews({
      title: "SHADOWS Atlas v2.0 Released with Enhanced Graph Engine",
      content: "We are pleased to announce the release of SHADOWS Atlas version 2.0, featuring a completely redesigned graph visualization engine. The new force-directed layout algorithm provides improved clustering of culturally related nodes, while the enhanced hover mechanics reveal edge semantics and connection weights. The update also introduces a new filtering system allowing researchers to isolate nodes by cultural tradition, historical period, and symbolic domain.",
    });
    await storage.createNews({
      title: "Keynote at Digital Humanities Conference 2026",
      content: "Dr. Elena Vasquez will deliver the keynote address at the Digital Humanities Conference in Berlin, presenting the SHADOWS methodology for computational comparative mythology. The talk will demonstrate how network graph analysis reveals previously unrecognized structural parallels between Mesopotamian and Mesoamerican mythological systems, with implications for theories of independent cultural evolution versus diffusionist models.",
    });
    await storage.createNews({
      title: "New Research Module: Pop Culture Archetypes",
      content: "The SHADOWS team has launched a new research module tracing the survival and transformation of classical archetypes in contemporary popular culture. From the Jungian Shadow in Darth Vader to the Trickster archetype in the Joker, this module maps the symbolic DNA connecting ancient mythological figures to modern cinematic and literary icons. The module is now available for interactive exploration.",
    });

    await storage.createPublication({
      title: "Network Analysis of Archetypal Structures in Indo-European Mythology",
      authors: "Vasquez, E., Tanaka, A., Chen, M.",
      venue: "Journal of Digital Humanities, Vol. 12",
      abstract: "This paper presents a novel computational approach to comparative mythology, applying force-directed graph algorithms to model the structural relationships between archetypal figures across Indo-European mythological traditions. Our analysis reveals statistically significant clustering patterns that support the hypothesis of a shared archetypal substrate underlying diverse cultural mythologies.",
      doi: "10.1234/jdh.2025.0042",
    });
    await storage.createPublication({
      title: "The Trickster Graph: Mapping Boundary-Crossing Figures Across World Mythologies",
      authors: "Osei, A., Vasquez, E.",
      venue: "Comparative Mythology Review, Vol. 8",
      abstract: "An analysis of trickster figures across African, European, and Asian mythological traditions using graph-theoretic methods. We demonstrate that trickster archetypes occupy structurally homologous positions in otherwise disparate mythological networks, suggesting a universal cognitive template for boundary-transgression narratives.",
      doi: "10.1234/cmr.2025.0018",
    });
    await storage.createPublication({
      title: "Jung in the Machine: Computational Approaches to the Collective Unconscious",
      authors: "Chen, M., Petrov, S., Tanaka, A.",
      venue: "Digital Psychology Quarterly",
      abstract: "We propose a computational framework for modeling Jungian archetypes as emergent properties of mythological network structures. Using spectral clustering on a graph of 500+ mythological figures, we identify archetypal 'attractors' that correspond closely to Jung's theoretical taxonomy of the collective unconscious.",
      doi: "10.1234/dpq.2024.0091",
    });

    console.log("Database seeded successfully.");
  } catch (error) {
    console.error("Seed error:", error);
  }
}
