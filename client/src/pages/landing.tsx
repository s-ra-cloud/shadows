import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, BookOpen, Network } from "lucide-react";
import { Button } from "@/components/ui/button";
import heroImage from "@assets/hero_1772030235687.jpeg";
import type { Project } from "@shared/schema";

function HeroSection() {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden" data-testid="section-hero">
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: `url(${heroImage})` }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-[#0B0626]/85 via-[#0B0626]/60 to-[#0B0626]" />
      <div className="absolute inset-0 bg-gradient-to-r from-[#0C0042]/40 to-transparent" />

      <div className="relative z-10 text-center px-6 max-w-4xl mx-auto">
        <h1
          className="font-serif text-5xl sm:text-6xl md:text-7xl lg:text-8xl tracking-[0.2em] text-shadows-text mb-6 animate-fade-in-up"
          style={{ animationDelay: "0.1s" }}
          data-testid="text-hero-title"
        >
          SHADOWS
        </h1>
        <p
          className="font-serif text-lg sm:text-xl md:text-2xl text-shadows-text/80 tracking-wider mb-4 animate-fade-in-up"
          style={{ animationDelay: "0.3s" }}
          data-testid="text-hero-subtitle"
        >
          A Comparative Archetypal Atlas of Myth and Symbol
        </p>
        <p
          className="text-shadows-text/50 text-sm sm:text-base max-w-2xl mx-auto leading-relaxed mb-10 animate-fade-in-up"
          style={{ animationDelay: "0.5s" }}
          data-testid="text-hero-description"
        >
          Exploring the universal patterns that connect deities, archetypes, and symbolic motifs
          across world religions and popular culture through interactive network visualizations
          grounded in Jungian analytical psychology.
        </p>
        <div className="animate-fade-in-up" style={{ animationDelay: "0.7s" }}>
          <Link href="/projects">
            <Button
              variant="outline"
              size="lg"
              className="border-[#8F00FF] text-shadows-text hover:border-[#03FF9B] hover:text-[#03FF9B] transition-all duration-300 px-8 tracking-wider no-default-hover-elevate no-default-active-elevate"
              data-testid="button-explore-atlas"
            >
              Explore the Atlas
              <ArrowRight className="ml-2 w-4 h-4" />
            </Button>
          </Link>
        </div>
      </div>

      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-[#0B0626] to-transparent" />
    </section>
  );
}

function AboutSection() {
  return (
    <section className="py-24 bg-[#0B0626]" data-testid="section-about">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          <div>
            <h2 className="font-serif text-3xl md:text-4xl text-shadows-text tracking-wide mb-6">
              About the Project
            </h2>
            <div className="space-y-4 text-shadows-text/60 leading-relaxed">
              <p>
                SHADOWS is a digital humanities initiative that maps the archetypal structures underlying
                world mythologies. Drawing on Carl Jung's theory of the collective unconscious, this project
                constructs interactive network graphs revealing the hidden connections between deities,
                heroes, tricksters, and symbolic motifs across cultures and epochs.
              </p>
              <p>
                Our methodology integrates comparative mythology, depth psychology, and computational
                graph analysis. Each node in our atlas represents a mythological figure, archetype, or
                symbolic motif, while edges encode relationships of transformation, opposition,
                complementarity, and cultural diffusion.
              </p>
              <p>
                The result is an evolving, navigable map of humanity's mythological imagination — from
                the ancient pantheons of Mesopotamia, Greece, and India to the archetypal figures that
                re-emerge in contemporary popular culture.
              </p>
            </div>
          </div>

          <div className="flex items-center justify-center">
            <svg viewBox="0 0 400 400" className="w-72 h-72 md:w-96 md:h-96 opacity-40">
              <circle cx="200" cy="200" r="180" fill="none" stroke="#350A8C" strokeWidth="0.5" />
              <circle cx="200" cy="200" r="140" fill="none" stroke="#8F00FF" strokeWidth="0.5" />
              <circle cx="200" cy="200" r="100" fill="none" stroke="#350A8C" strokeWidth="0.5" />
              <circle cx="200" cy="200" r="60" fill="none" stroke="#8F00FF" strokeWidth="0.5" />
              <line x1="200" y1="20" x2="200" y2="380" stroke="#350A8C" strokeWidth="0.3" />
              <line x1="20" y1="200" x2="380" y2="200" stroke="#350A8C" strokeWidth="0.3" />
              <line x1="73" y1="73" x2="327" y2="327" stroke="#350A8C" strokeWidth="0.3" />
              <line x1="327" y1="73" x2="73" y2="327" stroke="#350A8C" strokeWidth="0.3" />
              <circle cx="200" cy="20" r="4" fill="#8F00FF" className="animate-pulse-glow" />
              <circle cx="200" cy="380" r="4" fill="#03FF9B" className="animate-pulse-glow" />
              <circle cx="20" cy="200" r="4" fill="#8F00FF" className="animate-pulse-glow" />
              <circle cx="380" cy="200" r="4" fill="#03FF9B" className="animate-pulse-glow" />
              <circle cx="73" cy="73" r="3" fill="#E0DCE6" className="animate-pulse-glow" />
              <circle cx="327" cy="327" r="3" fill="#E0DCE6" className="animate-pulse-glow" />
              <circle cx="327" cy="73" r="3" fill="#350A8C" />
              <circle cx="73" cy="327" r="3" fill="#350A8C" />
              <circle cx="200" cy="200" r="6" fill="#8F00FF" />
              <text x="200" y="205" textAnchor="middle" fill="#E0DCE6" fontSize="8" fontFamily="serif">Self</text>
              <text x="200" y="14" textAnchor="middle" fill="#E0DCE6" fontSize="7" fontFamily="serif">Animus</text>
              <text x="200" y="396" textAnchor="middle" fill="#E0DCE6" fontSize="7" fontFamily="serif">Anima</text>
              <text x="14" y="204" textAnchor="middle" fill="#E0DCE6" fontSize="7" fontFamily="serif" transform="rotate(-90 14 204)">Shadow</text>
              <text x="386" y="204" textAnchor="middle" fill="#E0DCE6" fontSize="7" fontFamily="serif" transform="rotate(90 386 204)">Persona</text>
            </svg>
          </div>
        </div>
      </div>
    </section>
  );
}

function ResearchModulesSection() {
  const { data: projects } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
  });

  return (
    <section className="py-24 bg-gradient-to-b from-[#0B0626] to-[#0C0042]" data-testid="section-modules">
      <div className="max-w-7xl mx-auto px-6">
        <h2 className="font-serif text-3xl md:text-4xl text-shadows-text tracking-wide text-center mb-4">
          Research Modules
        </h2>
        <p className="text-shadows-text/50 text-center max-w-xl mx-auto mb-16">
          Interactive graph explorations mapping archetypal patterns across mythological traditions.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          {projects && projects.length > 0 ? (
            projects.map((project) => (
              <div
                key={project.id}
                className="group relative rounded-md border border-[#350A8C]/30 bg-[#0B0626]/50 p-8 transition-all duration-300 hover:border-[#8F00FF]/60"
                data-testid={`card-project-${project.slug}`}
              >
                <div className="absolute inset-0 rounded-md opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
                  style={{ boxShadow: "inset 0 0 30px rgba(143, 0, 255, 0.05)" }}
                />
                <div className="mb-6">
                  <Network className="w-10 h-10 text-[#8F00FF]/60 group-hover:text-[#8F00FF] transition-colors" />
                </div>
                <h3 className="font-serif text-xl text-shadows-text mb-3">{project.title}</h3>
                <p className="text-shadows-text/50 text-sm leading-relaxed mb-6">
                  {project.description}
                </p>
                <Link href={`/projects/${project.slug}`}>
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-[#8F00FF]/40 text-shadows-text/80 hover:border-[#03FF9B] hover:text-[#03FF9B] no-default-hover-elevate no-default-active-elevate transition-all duration-300"
                    data-testid={`button-open-graph-${project.slug}`}
                  >
                    Open Graph
                    <ArrowRight className="ml-2 w-3 h-3" />
                  </Button>
                </Link>
              </div>
            ))
          ) : (
            [1, 2].map((i) => (
              <div key={i} className="rounded-md border border-[#350A8C]/20 bg-[#0B0626]/50 p-8">
                <div className="mb-6">
                  {i === 1 ? (
                    <Network className="w-10 h-10 text-[#8F00FF]/40" />
                  ) : (
                    <BookOpen className="w-10 h-10 text-[#8F00FF]/40" />
                  )}
                </div>
                <div className="h-5 w-40 bg-[#350A8C]/20 rounded mb-3 animate-pulse" />
                <div className="h-3 w-full bg-[#350A8C]/10 rounded mb-2 animate-pulse" />
                <div className="h-3 w-3/4 bg-[#350A8C]/10 rounded mb-6 animate-pulse" />
                <div className="h-8 w-28 bg-[#350A8C]/10 rounded animate-pulse" />
              </div>
            ))
          )}
        </div>
      </div>
    </section>
  );
}

function TeamPreview() {
  const teamMembers = [
    { name: "Dr. Elena Vasquez", role: "Principal Investigator", institution: "University of Zurich" },
    { name: "Prof. Akira Tanaka", role: "Computational Mythologist", institution: "Kyoto University" },
    { name: "Dr. Amara Osei", role: "Comparative Religion Scholar", institution: "SOAS London" },
    { name: "Dr. Marcus Chen", role: "Graph Theory & Data Visualization", institution: "MIT Media Lab" },
  ];

  return (
    <section className="py-24 bg-[#0C0042]" data-testid="section-team-preview">
      <div className="max-w-7xl mx-auto px-6">
        <h2 className="font-serif text-3xl md:text-4xl text-shadows-text tracking-wide text-center mb-4">
          Research Team
        </h2>
        <p className="text-shadows-text/50 text-center max-w-xl mx-auto mb-16">
          An interdisciplinary team of scholars bridging mythology, psychology, and computational analysis.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 max-w-5xl mx-auto">
          {teamMembers.map((member, i) => (
            <div key={i} className="text-center group" data-testid={`card-team-member-${i}`}>
              <div className="w-24 h-24 mx-auto mb-4 rounded-full bg-gradient-to-br from-[#350A8C] to-[#8F00FF]/30 border border-[#8F00FF]/20 flex items-center justify-center">
                <span className="font-serif text-2xl text-shadows-text/60">
                  {member.name.split(" ").map(n => n[0]).join("")}
                </span>
              </div>
              <h3 className="font-serif text-base text-shadows-text mb-1">{member.name}</h3>
              <p className="text-[#8F00FF]/80 text-xs mb-1">{member.role}</p>
              <p className="text-shadows-text/40 text-xs">{member.institution}</p>
            </div>
          ))}
        </div>

        <div className="text-center mt-12">
          <Link href="/team">
            <Button
              variant="outline"
              size="sm"
              className="border-[#350A8C]/40 text-shadows-text/60 hover:border-[#03FF9B] hover:text-[#03FF9B] no-default-hover-elevate no-default-active-elevate transition-all duration-300"
              data-testid="button-view-team"
            >
              View Full Team
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
}

function PartnersPreview() {
  const partners = [
    { name: "Jung Institute Zurich", desc: "Jungian research foundation" },
    { name: "Digital Humanities Lab", desc: "Stanford University" },
    { name: "Mythology Archive", desc: "British Museum" },
    { name: "Archetype Foundation", desc: "Vienna, Austria" },
  ];

  return (
    <section className="py-24 bg-gradient-to-b from-[#0C0042] to-[#0B0626]" data-testid="section-partners">
      <div className="max-w-7xl mx-auto px-6">
        <h2 className="font-serif text-3xl md:text-4xl text-shadows-text tracking-wide text-center mb-16">
          Partners
        </h2>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 max-w-4xl mx-auto">
          {partners.map((partner, i) => (
            <div
              key={i}
              className="group flex flex-col items-center gap-3 p-6 rounded-md border border-[#350A8C]/10 hover:border-[#350A8C]/30 transition-all duration-300"
              data-testid={`card-partner-${i}`}
            >
              <div className="w-16 h-16 rounded-full bg-[#350A8C]/10 border border-[#350A8C]/20 flex items-center justify-center opacity-50 group-hover:opacity-100 transition-opacity">
                <span className="font-serif text-xs text-shadows-text/60">{partner.name.split(" ")[0][0]}{partner.name.split(" ").slice(-1)[0][0]}</span>
              </div>
              <span className="text-shadows-text/50 text-xs text-center group-hover:text-shadows-text/80 transition-colors">
                {partner.name}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export default function LandingPage() {
  return (
    <div className="bg-[#0B0626]">
      <HeroSection />
      <AboutSection />
      <ResearchModulesSection />
      <TeamPreview />
      <PartnersPreview />
    </div>
  );
}
