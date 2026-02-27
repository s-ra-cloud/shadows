import { BookOpen, GitBranch, Globe, Users, Layers, Search, Network, Compass } from "lucide-react";
import logoPath from "@assets/logo(1)_1772195419087.png";

const PRINCIPLES = [
  "Contextualized comparison grounded in primary sources",
  "Attention to historical transmission and transformation",
  "Documentation of symbolic parallels and divergences",
  "Exploration of narrative structures and myth cycles",
  "Cross-cultural circulation and reinterpretation of figures and motifs",
];

const ATTRIBUTES = [
  "Cultural and textual origin",
  "Domains, functions, and symbolic associations",
  "Physical descriptions and iconographic traits",
  "Narrative roles and major myth cycles",
  "Relationships with other figures (genealogical, adversarial, syncretic, etc.)",
  "Associated animals, objects, and symbols",
  "Key events, transformations, or episodes",
];

const METHODS = [
  { icon: BookOpen, label: "Comparative mythology and religious studies" },
  { icon: Layers, label: "Philology and textual scholarship" },
  { icon: Globe, label: "History of religions and cultural transmission" },
  { icon: Network, label: "Digital humanities and knowledge graph modeling" },
  { icon: Users, label: "Collaborative international research" },
];

const FUTURE = [
  "Expansion of textual and iconographic corpora",
  "Advanced filtering and thematic exploration tools",
  "Comparative pathways focused on specific motifs or narrative structures",
  "Integration of multilingual sources and translations",
  "Development of pedagogical and research-oriented interfaces",
];

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-[#0B0626] pt-24 pb-16">
      <div className="max-w-4xl mx-auto px-6">

        <header className="mb-20">
          <div className="flex items-center gap-6 mb-6">
            <img src={logoPath} alt="SHADOWS" className="h-24 w-auto" data-testid="img-project-logo" />
            <div>
              <h1 className="font-serif text-4xl md:text-5xl text-shadows-text tracking-wide mb-2" data-testid="text-about-title">
                The Project
              </h1>
              <p className="text-[#8F00FF]/70 text-sm uppercase tracking-widest" data-testid="text-about-subtitle">
                A Comparative Mythology Research Platform
              </p>
            </div>
          </div>
          <div className="space-y-5 text-shadows-text/60 leading-relaxed text-justify">
            <p>
              Shadows is a digital humanities research project dedicated to the comparative study of mythological figures, symbolic motifs, and narrative structures across cultures and historical periods. The project aims to create a dynamic research environment where mythological traditions can be explored relationally rather than in isolation, allowing meaningful connections and divergences to emerge through structured comparison.
            </p>
            <p>
              By combining rigorous scholarship with advanced digital tools, Shadows seeks to provide an innovative platform for researchers, students, and the wider public interested in the global history of myths, religions, and symbolic systems.
            </p>
          </div>
        </header>

        <section className="mb-20">
          <div className="flex items-center gap-3 mb-6">
            <Compass size={20} className="text-[#03FF9B]" />
            <h2 className="font-serif text-2xl text-shadows-text tracking-wide" data-testid="text-section-vision">
              Research Vision
            </h2>
          </div>
          <div className="space-y-5 text-shadows-text/60 leading-relaxed text-justify">
            <p>
              Across cultures and historical periods, mythological corpora encode structured systems of entities, attributes, and relations that articulate cosmology, social order, and symbolic logic. Yet these systems are rarely studied through formal, large-scale comparative models capable of revealing deep structural correspondences. Comparative mythology has long sought to identify and analyze these patterns, from early philological approaches to contemporary interdisciplinary research.
            </p>
            <p>
              Shadows builds upon this tradition by offering a research infrastructure designed to document, contextualize, and visualize relationships between mythological entities across cultures. Rather than proposing simplistic equivalences, the project emphasizes:
            </p>
          </div>
          <ul className="mt-6 space-y-3">
            {PRINCIPLES.map((p, i) => (
              <li key={i} className="flex items-start gap-3 text-shadows-text/60 text-sm">
                <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-[#03FF9B] shrink-0" />
                {p}
              </li>
            ))}
          </ul>
          <p className="mt-6 text-shadows-text/60 leading-relaxed text-justify">
            The objective is not to homogenize traditions, but to provide tools that make structured comparison possible at scale while preserving cultural specificity.
          </p>
        </section>

        <section className="mb-20">
          <div className="flex items-center gap-3 mb-6">
            <GitBranch size={20} className="text-[#03FF9B]" />
            <h2 className="font-serif text-2xl text-shadows-text tracking-wide" data-testid="text-section-graph">
              A Graph-Based Knowledge Environment
            </h2>
          </div>
          <div className="space-y-5 text-shadows-text/60 leading-relaxed text-justify">
            <p>
              At the core of Shadows is an interactive graph-based platform that enables users to navigate mythological data through relational visualization.
            </p>
            <p>
              Each entity in the database -- whether a deity, legendary figure, creature, symbolic object, or narrative motif -- is described through structured attributes such as:
            </p>
          </div>
          <div className="mt-6 rounded-md border border-[#350A8C]/15 bg-[#0C0042]/20 p-6">
            <ul className="space-y-3">
              {ATTRIBUTES.map((a, i) => (
                <li key={i} className="flex items-start gap-3 text-shadows-text/50 text-sm">
                  <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-[#8F00FF] shrink-0" />
                  {a}
                </li>
              ))}
            </ul>
          </div>
          <div className="mt-6 space-y-5 text-shadows-text/60 leading-relaxed text-justify">
            <p>
              These entities are interconnected within a semantic graph that allows users to explore connections across traditions. For example, users may trace recurring narrative patterns, examine shared symbolic attributes, or analyze how a specific motif appears in different cultural contexts.
            </p>
            <p>
              This relational visualization supports new forms of comparative analysis by making large-scale patterns perceptible while preserving the complexity of individual traditions.
            </p>
          </div>
        </section>

        <section className="mb-20">
          <div className="flex items-center gap-3 mb-6">
            <Search size={20} className="text-[#03FF9B]" />
            <h2 className="font-serif text-2xl text-shadows-text tracking-wide" data-testid="text-section-methods">
              Methodological Foundations
            </h2>
          </div>
          <p className="text-shadows-text/60 leading-relaxed mb-6 text-justify">
            Shadows is grounded in an interdisciplinary methodology combining:
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {METHODS.map((m, i) => (
              <div
                key={i}
                className="flex items-center gap-3 rounded-md border border-[#350A8C]/15 bg-[#0C0042]/20 px-4 py-3"
              >
                <m.icon size={16} className="text-[#8F00FF]/60 shrink-0" />
                <span className="text-shadows-text/50 text-sm">{m.label}</span>
              </div>
            ))}
          </div>
          <p className="mt-6 text-shadows-text/60 leading-relaxed text-justify">
            All entries are linked to identifiable textual, archaeological, or scholarly sources whenever possible. The platform is designed to support academically rigorous comparison rather than speculative or purely analogical associations.
          </p>
        </section>

        <section className="mb-20">
          <div className="flex items-center gap-3 mb-6">
            <Users size={20} className="text-[#03FF9B]" />
            <h2 className="font-serif text-2xl text-shadows-text tracking-wide" data-testid="text-section-collaborative">
              A Collaborative and Evolving Project
            </h2>
          </div>
          <div className="space-y-5 text-shadows-text/60 leading-relaxed text-justify">
            <p>
              Shadows is conceived as a living research infrastructure. The database and graph expand progressively through the integration of new corpora, traditions, and scholarly contributions. The project is open to collaboration with specialists in different cultural areas who wish to contribute structured data, expertise, or critical perspectives.
            </p>
            <p>Future developments include:</p>
          </div>
          <ul className="mt-4 space-y-3">
            {FUTURE.map((f, i) => (
              <li key={i} className="flex items-start gap-3 text-shadows-text/60 text-sm">
                <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-[#03FF9B] shrink-0" />
                {f}
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-md border border-[#350A8C]/15 bg-[#0C0042]/20 p-8">
          <div className="flex items-center gap-3 mb-4">
            <Compass size={20} className="text-[#03FF9B]" />
            <h2 className="font-serif text-2xl text-shadows-text tracking-wide" data-testid="text-section-exploration">
              A Space for Comparative Exploration
            </h2>
          </div>
          <div className="space-y-5 text-shadows-text/60 leading-relaxed text-justify">
            <p>
              By combining structured scholarship with interactive visualization, Shadows provides a new way to explore mythological traditions across cultures and time. The platform enables users to identify patterns, examine transformations, and better understand how mythological figures and narratives circulate, evolve, and interact across the global history of human cultures.
            </p>
            <p>
              Shadows is both a research tool and a comparative observatory: a space where mythological knowledge can be mapped, connected, and explored in depth.
            </p>
          </div>
        </section>

      </div>
    </div>
  );
}
