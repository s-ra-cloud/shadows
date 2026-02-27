import { Link } from "wouter";
import { ArrowRight, Network } from "lucide-react";
import { Button } from "@/components/ui/button";
import heroVideo from "@assets/hero_1772053813686.mp4";
import teamPhotoPath from "@assets/Team_1772115638559.jpeg";
import odinImgPath from "@assets/Odin_1772207712816.png";

function HeroSection() {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden" data-testid="section-hero">
      <video
        className="absolute inset-0 w-full h-full object-cover"
        src={heroVideo}
        autoPlay
        loop
        muted
        playsInline
        ref={(el) => { if (el) el.playbackRate = 0.5; }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-[#0B0626]/85 via-[#0B0626]/60 to-[#0B0626]" />
      <div className="absolute inset-0 bg-gradient-to-r from-[#0C0042]/40 to-transparent" />

      <div className="relative z-10 text-center px-6 max-w-4xl mx-auto">
        <h1
          className="font-serif text-5xl sm:text-6xl md:text-7xl lg:text-8xl tracking-[0.2em] text-shadows-text mb-6 animate-fade-in-up font-normal"
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-16 items-center">
          <div>
            <h2 className="font-serif text-3xl md:text-4xl text-shadows-text tracking-wide mb-6">
              About the Project
            </h2>
            <div className="space-y-4 text-shadows-text/60 leading-relaxed text-justify">
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

          <div className="relative flex items-center justify-center overflow-hidden">
            <img
              src={odinImgPath}
              alt="Odin node graph visualization"
              className="w-full max-w-md scale-110"
              data-testid="img-about-odin"
              style={{ mask: "radial-gradient(ellipse 70% 70% at center, black 30%, rgba(0,0,0,0.6) 50%, transparent 80%)", WebkitMask: "radial-gradient(ellipse 70% 70% at center, black 30%, rgba(0,0,0,0.6) 50%, transparent 80%)" }}
            />
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
  return (
    <section className="py-24 bg-[#0C0042]" data-testid="section-team-preview">
      <div className="max-w-7xl mx-auto px-6">
        <h2 className="font-serif text-3xl md:text-4xl text-shadows-text tracking-wide text-center mb-4">
          Research Team
        </h2>
        <p className="text-shadows-text/50 text-center max-w-xl mx-auto mb-12">
          An interdisciplinary team of scholars bridging comparative mythology, religious studies, and computational analysis.
        </p>

        <div className="max-w-2xl mx-auto">
          <div className="rounded-lg overflow-hidden border border-[#350A8C]/20">
            <img
              src={teamPhotoPath}
              alt="Research team — Camille Bertrand, Laura Duparc, Ami Nagai"
              className="w-full h-auto object-cover"
              data-testid="img-team-photo"
            />
          </div>
          <div className="flex justify-center gap-12 mt-6">
            <div className="text-center" data-testid="card-team-member-0">
              <span className="font-serif text-sm text-shadows-text/70 block" data-testid="text-team-name-0">Camille Bertrand</span>
              <span className="text-[#8F00FF]/80 text-xs">Researcher</span>
            </div>
            <div className="text-center" data-testid="card-team-member-1">
              <span className="font-serif text-sm text-shadows-text/70 block" data-testid="text-team-name-1">Laura Duparc</span>
              <span className="text-[#8F00FF]/80 text-xs">Lead Researcher</span>
            </div>
            <div className="text-center" data-testid="card-team-member-2">
              <span className="font-serif text-sm text-shadows-text/70 block" data-testid="text-team-name-2">Ami Nagai</span>
              <span className="text-[#8F00FF]/80 text-xs">Researcher</span>
            </div>
          </div>
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

function LegacyLogoSvg({ size = 80 }: { size?: number }) {
  const cx = 60, cy = 60;
  const r = 38;
  const nodes = Array.from({ length: 6 }, (_, i) => {
    const angle = (Math.PI / 3) * i - Math.PI / 2;
    return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) };
  });
  return (
    <svg width={size} height={size} viewBox="0 0 120 120" fill="none">
      <defs>
        <radialGradient id="mNodeGlow">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.9" />
          <stop offset="40%" stopColor="#c8d8e8" stopOpacity="0.6" />
          <stop offset="100%" stopColor="#8899aa" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="mCenterGlow">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="1" />
          <stop offset="30%" stopColor="#dde8f0" stopOpacity="0.7" />
          <stop offset="70%" stopColor="#aa8866" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#664422" stopOpacity="0" />
        </radialGradient>
      </defs>
      {nodes.map((a, i) => {
        const b = nodes[(i + 1) % 6];
        return <line key={`edge-${i}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#8090a0" strokeWidth="3" strokeOpacity="0.5" />;
      })}
      {nodes.map((n, i) => (
        <line key={`spoke-${i}`} x1={cx} y1={cy} x2={n.x} y2={n.y} stroke="#8090a0" strokeWidth="2.5" strokeOpacity="0.4" />
      ))}
      {nodes.map((n, i) => (
        <g key={`node-${i}`}>
          <circle cx={n.x} cy={n.y} r="10" fill="url(#mNodeGlow)" opacity="0.7" />
          <circle cx={n.x} cy={n.y} r="5" fill="#c8d8e8" fillOpacity="0.6" />
          <circle cx={n.x} cy={n.y} r="2" fill="#ffffff" fillOpacity="0.9" />
        </g>
      ))}
      <circle cx={cx} cy={cy} r="18" fill="url(#mCenterGlow)" opacity="0.8" />
      <circle cx={cx} cy={cy} r="9" fill="#d0dce6" fillOpacity="0.5" />
      <circle cx={cx} cy={cy} r="3.5" fill="#ffffff" fillOpacity="0.95" />
    </svg>
  );
}

function PartnersPreview() {
  const partners = [
    {
      name: "LEGACY",
      url: "https://legacy-um6p.1337.ma/home",
      visual: <LegacyLogoSvg size={80} />,
    },
    {
      name: "Machina Research Network",
      url: "https://machina-research.net",
      visual: null,
    },
  ];

  return (
    <section className="py-24 bg-gradient-to-b from-[#0C0042] to-[#0B0626]" data-testid="section-partners">
      <div className="max-w-7xl mx-auto px-6">
        <h2 className="font-serif text-3xl md:text-4xl text-shadows-text tracking-wide text-center mb-4">
          Partners
        </h2>
        <p className="text-shadows-text/50 text-center max-w-xl mx-auto mb-16">
          SHADOWS is developed in collaboration with other projects in digital humanities and computational interdisciplinary research.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 max-w-2xl mx-auto">
          {partners.map((partner, i) => (
            <a
              key={i}
              href={partner.url}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex flex-col items-center gap-5 p-8 rounded-md border border-[#350A8C]/10 hover:border-[#8F00FF]/40 transition-all duration-300"
              data-testid={`card-partner-${i}`}
            >
              <div className="opacity-60 group-hover:opacity-100 transition-opacity">
                {partner.visual || (
                  <div className="w-20 h-20 rounded-full bg-[#350A8C]/10 border border-[#350A8C]/20 flex items-center justify-center group-hover:border-[#8F00FF]/40">
                    <span className="font-serif text-2xl text-shadows-text/60 group-hover:text-shadows-text transition-colors">{partner.name.split(" ")[0][0]}</span>
                  </div>
                )}
              </div>
              <span className="text-shadows-text/60 text-sm text-center group-hover:text-shadows-text transition-colors">
                {partner.name}
              </span>
            </a>
          ))}
        </div>

        <div className="text-center mt-12">
          <Link href="/partners">
            <Button
              variant="outline"
              size="sm"
              className="border-[#350A8C]/40 text-shadows-text/60 hover:border-[#03FF9B] hover:text-[#03FF9B] no-default-hover-elevate no-default-active-elevate transition-all duration-300"
              data-testid="button-view-partners"
            >
              Learn More
            </Button>
          </Link>
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
