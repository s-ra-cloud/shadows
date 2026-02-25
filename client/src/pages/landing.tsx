import { Link } from "wouter";
import { ArrowRight, Network } from "lucide-react";
import { Button } from "@/components/ui/button";
import heroImage from "@assets/hero_1772030235687.jpeg";

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
          Mapping the universal patterns that connect deities, mythological figures, and symbolic motifs
          across world religions and cultures through interactive network visualizations.
        </p>
        <div className="animate-fade-in-up" style={{ animationDelay: "0.7s" }}>
          <Link href="/graph">
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
                SHADOWS is a digital humanities initiative that maps the structural patterns underlying
                world mythologies. This project constructs interactive network graphs revealing the hidden
                connections between deities, heroes, tricksters, and symbolic motifs across cultures
                and epochs.
              </p>
              <p>
                Our methodology integrates comparative mythology, religious studies, and computational
                graph analysis. Each node in our atlas represents a mythological figure or
                symbolic motif, while edges encode relationships of transformation, opposition,
                complementarity, and cultural diffusion.
              </p>
              <p>
                The result is an evolving, navigable map of humanity's mythological imagination — from
                the ancient pantheons of Mesopotamia, Greece, and India to the recurring figures
                and symbols that persist across civilizations and into contemporary culture.
              </p>
            </div>
          </div>

          <div className="flex items-center justify-center">
            <svg viewBox="0 0 400 400" className="w-72 h-72 md:w-96 md:h-96 opacity-40">
              <circle cx="200" cy="200" r="180" fill="none" stroke="#350A8C" strokeWidth="0.5" strokeDasharray="4 4" />
              <circle cx="200" cy="200" r="130" fill="none" stroke="#8F00FF" strokeWidth="0.5" strokeDasharray="2 6" />

              <circle cx="200" cy="40" r="5" fill="#8F00FF" className="animate-pulse-glow" />
              <circle cx="340" cy="120" r="4" fill="#350A8C" className="animate-pulse-glow" />
              <circle cx="360" cy="240" r="4.5" fill="#03FF9B" className="animate-pulse-glow" />
              <circle cx="280" cy="350" r="4" fill="#E0DCE6" className="animate-pulse-glow" />
              <circle cx="120" cy="350" r="5" fill="#8F00FF" className="animate-pulse-glow" />
              <circle cx="40" cy="240" r="4" fill="#350A8C" className="animate-pulse-glow" />
              <circle cx="60" cy="120" r="4.5" fill="#03FF9B" className="animate-pulse-glow" />

              <circle cx="200" cy="120" r="3.5" fill="#8F00FF" />
              <circle cx="270" cy="180" r="3" fill="#350A8C" />
              <circle cx="260" cy="260" r="3.5" fill="#E0DCE6" />
              <circle cx="200" cy="300" r="3" fill="#03FF9B" />
              <circle cx="140" cy="260" r="3" fill="#350A8C" />
              <circle cx="130" cy="180" r="3.5" fill="#8F00FF" />

              <line x1="200" y1="40" x2="340" y2="120" stroke="#350A8C" strokeWidth="0.4" strokeOpacity="0.5" />
              <line x1="340" y1="120" x2="360" y2="240" stroke="#350A8C" strokeWidth="0.4" strokeOpacity="0.5" />
              <line x1="360" y1="240" x2="280" y2="350" stroke="#350A8C" strokeWidth="0.4" strokeOpacity="0.5" />
              <line x1="280" y1="350" x2="120" y2="350" stroke="#350A8C" strokeWidth="0.4" strokeOpacity="0.5" />
              <line x1="120" y1="350" x2="40" y2="240" stroke="#350A8C" strokeWidth="0.4" strokeOpacity="0.5" />
              <line x1="40" y1="240" x2="60" y2="120" stroke="#350A8C" strokeWidth="0.4" strokeOpacity="0.5" />
              <line x1="60" y1="120" x2="200" y2="40" stroke="#350A8C" strokeWidth="0.4" strokeOpacity="0.5" />

              <line x1="200" y1="40" x2="200" y2="120" stroke="#8F00FF" strokeWidth="0.3" strokeOpacity="0.4" />
              <line x1="340" y1="120" x2="270" y2="180" stroke="#8F00FF" strokeWidth="0.3" strokeOpacity="0.4" />
              <line x1="360" y1="240" x2="260" y2="260" stroke="#8F00FF" strokeWidth="0.3" strokeOpacity="0.4" />
              <line x1="280" y1="350" x2="200" y2="300" stroke="#8F00FF" strokeWidth="0.3" strokeOpacity="0.4" />
              <line x1="120" y1="350" x2="140" y2="260" stroke="#8F00FF" strokeWidth="0.3" strokeOpacity="0.4" />
              <line x1="40" y1="240" x2="130" y2="180" stroke="#8F00FF" strokeWidth="0.3" strokeOpacity="0.4" />
              <line x1="60" y1="120" x2="200" y2="120" stroke="#8F00FF" strokeWidth="0.3" strokeOpacity="0.4" />

              <line x1="200" y1="120" x2="270" y2="180" stroke="#03FF9B" strokeWidth="0.3" strokeOpacity="0.3" />
              <line x1="270" y1="180" x2="260" y2="260" stroke="#03FF9B" strokeWidth="0.3" strokeOpacity="0.3" />
              <line x1="260" y1="260" x2="200" y2="300" stroke="#03FF9B" strokeWidth="0.3" strokeOpacity="0.3" />
              <line x1="200" y1="300" x2="140" y2="260" stroke="#03FF9B" strokeWidth="0.3" strokeOpacity="0.3" />
              <line x1="140" y1="260" x2="130" y2="180" stroke="#03FF9B" strokeWidth="0.3" strokeOpacity="0.3" />
              <line x1="130" y1="180" x2="200" y2="120" stroke="#03FF9B" strokeWidth="0.3" strokeOpacity="0.3" />

              <line x1="200" y1="120" x2="260" y2="260" stroke="#350A8C" strokeWidth="0.2" strokeOpacity="0.3" />
              <line x1="270" y1="180" x2="140" y2="260" stroke="#350A8C" strokeWidth="0.2" strokeOpacity="0.3" />
              <line x1="130" y1="180" x2="200" y2="300" stroke="#350A8C" strokeWidth="0.2" strokeOpacity="0.3" />

              <text x="200" y="32" textAnchor="middle" fill="#E0DCE6" fontSize="7" fontFamily="serif">Zeus</text>
              <text x="355" y="115" textAnchor="start" fill="#E0DCE6" fontSize="7" fontFamily="serif">Odin</text>
              <text x="372" y="244" textAnchor="start" fill="#E0DCE6" fontSize="7" fontFamily="serif">Vishnu</text>
              <text x="280" y="370" textAnchor="middle" fill="#E0DCE6" fontSize="7" fontFamily="serif">Isis</text>
              <text x="120" y="370" textAnchor="middle" fill="#E0DCE6" fontSize="7" fontFamily="serif">Athena</text>
              <text x="28" y="244" textAnchor="end" fill="#E0DCE6" fontSize="7" fontFamily="serif">Amaterasu</text>
              <text x="48" y="115" textAnchor="end" fill="#E0DCE6" fontSize="7" fontFamily="serif">Quetzalcoatl</text>
            </svg>
          </div>
        </div>
      </div>
    </section>
  );
}

function GraphPreviewSection() {
  return (
    <section className="relative py-32 bg-gradient-to-b from-[#0B0626] to-[#0C0042] overflow-hidden" data-testid="section-graph-preview">
      <div className="absolute inset-0 flex items-center justify-center opacity-[0.08] pointer-events-none">
        <svg viewBox="0 0 800 500" className="w-full max-w-5xl">
          <circle cx="120" cy="100" r="6" fill="#8F00FF" />
          <circle cx="300" cy="60" r="5" fill="#350A8C" />
          <circle cx="480" cy="110" r="7" fill="#03FF9B" />
          <circle cx="650" cy="80" r="5" fill="#E0DCE6" />
          <circle cx="200" cy="220" r="6" fill="#350A8C" />
          <circle cx="400" cy="200" r="8" fill="#8F00FF" />
          <circle cx="580" cy="230" r="5" fill="#03FF9B" />
          <circle cx="100" cy="340" r="5" fill="#8F00FF" />
          <circle cx="320" cy="360" r="6" fill="#E0DCE6" />
          <circle cx="500" cy="380" r="5" fill="#350A8C" />
          <circle cx="680" cy="350" r="6" fill="#8F00FF" />
          <circle cx="250" cy="440" r="4" fill="#03FF9B" />
          <circle cx="550" cy="420" r="5" fill="#350A8C" />
          <circle cx="720" cy="200" r="4" fill="#E0DCE6" />
          <circle cx="60" cy="220" r="4" fill="#03FF9B" />

          <line x1="120" y1="100" x2="300" y2="60" stroke="#8F00FF" strokeWidth="0.8" />
          <line x1="300" y1="60" x2="480" y2="110" stroke="#350A8C" strokeWidth="0.8" />
          <line x1="480" y1="110" x2="650" y2="80" stroke="#8F00FF" strokeWidth="0.5" />
          <line x1="120" y1="100" x2="200" y2="220" stroke="#350A8C" strokeWidth="0.8" />
          <line x1="300" y1="60" x2="400" y2="200" stroke="#8F00FF" strokeWidth="0.5" />
          <line x1="200" y1="220" x2="400" y2="200" stroke="#03FF9B" strokeWidth="0.8" />
          <line x1="400" y1="200" x2="580" y2="230" stroke="#350A8C" strokeWidth="0.8" />
          <line x1="480" y1="110" x2="580" y2="230" stroke="#8F00FF" strokeWidth="0.5" />
          <line x1="650" y1="80" x2="720" y2="200" stroke="#350A8C" strokeWidth="0.5" />
          <line x1="580" y1="230" x2="680" y2="350" stroke="#8F00FF" strokeWidth="0.8" />
          <line x1="200" y1="220" x2="100" y2="340" stroke="#8F00FF" strokeWidth="0.5" />
          <line x1="100" y1="340" x2="320" y2="360" stroke="#350A8C" strokeWidth="0.8" />
          <line x1="320" y1="360" x2="500" y2="380" stroke="#8F00FF" strokeWidth="0.5" />
          <line x1="400" y1="200" x2="320" y2="360" stroke="#03FF9B" strokeWidth="0.5" />
          <line x1="500" y1="380" x2="680" y2="350" stroke="#350A8C" strokeWidth="0.8" />
          <line x1="100" y1="340" x2="250" y2="440" stroke="#03FF9B" strokeWidth="0.5" />
          <line x1="320" y1="360" x2="250" y2="440" stroke="#8F00FF" strokeWidth="0.5" />
          <line x1="500" y1="380" x2="550" y2="420" stroke="#8F00FF" strokeWidth="0.5" />
          <line x1="680" y1="350" x2="550" y2="420" stroke="#350A8C" strokeWidth="0.5" />
          <line x1="60" y1="220" x2="120" y2="100" stroke="#03FF9B" strokeWidth="0.5" />
          <line x1="60" y1="220" x2="100" y2="340" stroke="#8F00FF" strokeWidth="0.5" />
          <line x1="720" y1="200" x2="680" y2="350" stroke="#8F00FF" strokeWidth="0.5" />
          <line x1="400" y1="200" x2="500" y2="380" stroke="#350A8C" strokeWidth="0.5" />
        </svg>
      </div>

      <div className="relative z-10 text-center px-6 max-w-3xl mx-auto">
        <Network className="w-10 h-10 text-[#8F00FF]/50 mx-auto mb-6" />
        <h2 className="font-serif text-3xl md:text-4xl text-shadows-text tracking-wide mb-4">
          Explore the Atlas
        </h2>
        <p className="text-shadows-text/50 max-w-xl mx-auto mb-10 leading-relaxed">
          Navigate an interactive network graph mapping deities, mythological figures, and symbolic motifs
          across cultures and traditions. Zoom, filter, and discover hidden connections.
        </p>
        <Link href="/graph">
          <Button
            variant="outline"
            size="lg"
            className="border-[#8F00FF] text-shadows-text hover:border-[#03FF9B] hover:text-[#03FF9B] transition-all duration-300 px-8 tracking-wider no-default-hover-elevate no-default-active-elevate"
            data-testid="button-explore-graph"
          >
            Open Graph
            <ArrowRight className="ml-2 w-4 h-4" />
          </Button>
        </Link>
      </div>
    </section>
  );
}

function TeamPreview() {
  const teamMembers = [
    { name: "Laura Duparc", role: "Lead Researcher", institution: "University Mohammed VI Polytechnic" },
    { name: "Camille Bertrand", role: "Researcher", institution: "EHESS" },
    { name: "Ami Nagai", role: "Researcher", institution: "Aix-Marseille Université" },
  ];

  return (
    <section className="py-24 bg-[#0C0042]" data-testid="section-team-preview">
      <div className="max-w-7xl mx-auto px-6">
        <h2 className="font-serif text-3xl md:text-4xl text-shadows-text tracking-wide text-center mb-4">
          Research Team
        </h2>
        <p className="text-shadows-text/50 text-center max-w-xl mx-auto mb-16">
          An interdisciplinary team of scholars bridging comparative mythology, religious studies, and computational analysis.
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
    { name: "Centre for Comparative Mythology" },
    { name: "Digital Humanities Lab" },
    { name: "Mythology Archive" },
    { name: "Archetype Foundation" },
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
      <GraphPreviewSection />
      <TeamPreview />
      <PartnersPreview />
    </div>
  );
}
