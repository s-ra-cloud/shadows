import { Link } from "wouter";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import machinaLogoPath from "@assets/Machin_logo_1772208429837.jpeg";
import telemmeLogoPath from "@assets/image_1778849116577.png";
import irisLogoPath from "@assets/image_1778849190765.png";
function LegacyLogoSvg({ size = 112 }: { size?: number }) {
  const cx = 60, cy = 60;
  const r = 38;
  const nodes = Array.from({ length: 6 }, (_, i) => {
    const angle = (Math.PI / 3) * i - Math.PI / 2;
    return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) };
  });
  return (
    <svg width={size} height={size} viewBox="0 0 120 120" fill="none">
      <defs>
        <radialGradient id="pNodeGlow">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.9" />
          <stop offset="40%" stopColor="#c8d8e8" stopOpacity="0.6" />
          <stop offset="100%" stopColor="#8899aa" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="pCenterGlow">
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
          <circle cx={n.x} cy={n.y} r="10" fill="url(#pNodeGlow)" opacity="0.7" />
          <circle cx={n.x} cy={n.y} r="5" fill="#c8d8e8" fillOpacity="0.6" />
          <circle cx={n.x} cy={n.y} r="2" fill="#ffffff" fillOpacity="0.9" />
        </g>
      ))}
      <circle cx={cx} cy={cy} r="18" fill="url(#pCenterGlow)" opacity="0.8" />
      <circle cx={cx} cy={cy} r="9" fill="#d0dce6" fillOpacity="0.5" />
      <circle cx={cx} cy={cy} r="3.5" fill="#ffffff" fillOpacity="0.95" />
    </svg>
  );
}

const partners = [
  {
    name: "LEGACY",
    url: "https://legacy-um6p.1337.ma/home",
    visual: "legacy",
    description:
      "LEGACY is a digital humanities programme based in Morocco. It focuses on preserving and computationally analysing cultural heritage through advanced data science, machine learning, and interactive visualisation. LEGACY partners with SHADOWS to bring North-African and pan-Mediterranean mythological traditions into the comparative atlas.",
    focus: [
      "Cultural heritage preservation",
      "Computational analysis of historical texts",
      "Data science & machine learning",
      "North-African & Mediterranean traditions",
    ],
  },
  {
    name: "Machina Research Network",
    url: "https://machina-research.net",
    visual: "machina",
    description:
      "Machina Research Network is a computational interdisciplinary research collective that bridges computer science, humanities, and social sciences. Its research programme applies quantitative methods — network analysis, natural language processing, and statistical modelling — to questions traditionally addressed through qualitative scholarship. Machina collaborates with SHADOWS on graph-theoretic approaches to comparative mythology and the development of open research tools.",
    focus: [
      "Computational interdisciplinary research",
      "Network analysis & NLP",
      "Statistical modelling for humanities",
      "Open research tooling",
    ],
  },
  {
    name: "TELEMMe — UMR 7303",
    url: "https://telemme.mmsh.fr/",
    visual: "telemme",
    description:
      "TELEMMe (Temps, Espaces, Langages, Europe Méridionale, Méditerranée) is a joint research unit (UMR 7303) of Aix-Marseille Université and the CNRS, hosted at the Maison Méditerranéenne des Sciences de l'Homme. The lab brings together historians, geographers, art historians, and social scientists working on Southern Europe and the Mediterranean from the late Middle Ages to the present. TELEMMe partners with SHADOWS on the historical and spatial framing of Mediterranean mythological traditions.",
    focus: [
      "Mediterranean & Southern Europe studies",
      "Historical geography",
      "Cultural and intellectual history",
      "Interdisciplinary social sciences",
    ],
  },
  {
    name: "IRIS — EHESS",
    url: "https://iris.ehess.fr/",
    visual: "iris",
    description:
      "IRIS (Institut de Recherche Interdisciplinaire sur les enjeux Sociaux) is a joint research unit of the EHESS, CNRS, INSERM, and Université Sorbonne Paris Nord. It gathers anthropologists, sociologists, historians, and public-health researchers around the social, political, and ethical dimensions of contemporary issues. IRIS contributes to SHADOWS through interdisciplinary perspectives on the social construction and circulation of mythological imaginaries.",
    focus: [
      "Interdisciplinary social research",
      "Anthropology & sociology",
      "Cultural and political imaginaries",
      "Critical humanities",
    ],
  },
];

export default function PartnersPage() {
  return (
    <div className="min-h-screen bg-[#0B0626]">
      <section className="relative py-24 bg-gradient-to-b from-[#0C0042] to-[#0B0626]">
        <div className="max-w-4xl mx-auto px-6">
          <div className="mb-8">
            <Link href="/" aria-label="Back to SHADOWS home page">
              <Button
                variant="ghost"
                size="sm"
                className="text-shadows-text/40 hover:text-shadows-text p-1 h-auto"
                data-testid="button-back-home"
              >
                <ArrowLeft size={16} className="mr-1" aria-hidden="true" />
                Back to home
              </Button>
            </Link>
          </div>

          <h1
            className="font-serif text-4xl md:text-5xl text-shadows-text tracking-wide mb-4"
            data-testid="text-partners-title"
          >
            Partners
          </h1>
          <p className="text-shadows-text/50 max-w-2xl leading-relaxed mb-20 text-justify" data-testid="text-partners-intro">
            SHADOWS is developed in collaboration with other projects in digital humanities
            and computational interdisciplinary research. Our partners contribute expertise in cultural heritage
            preservation, network science, and quantitative approaches to the study of myth and symbol.
          </p>

          <div className="space-y-16">
            {partners.map((partner, i) => (
              <div
                key={i}
                className="border border-[#350A8C]/15 rounded-lg p-8 md:p-10 hover:border-[#350A8C]/30 transition-all duration-300"
                data-testid={`card-partner-detail-${i}`}
              >
                <div className="flex flex-col md:flex-row gap-8 items-start">
                  <div className="flex-shrink-0">
                    <a href={partner.url} target="_blank" rel="noopener noreferrer" className="block opacity-80 hover:opacity-100 transition-opacity">
                      {partner.visual === "legacy" ? (
                        <LegacyLogoSvg size={112} />
                      ) : partner.visual === "machina" ? (
                        <img
                          src={machinaLogoPath}
                          alt="Machina Research Network logo"
                          className="w-28 h-28 rounded-lg object-contain bg-white/90 p-1"
                          data-testid="img-machina-logo"
                        />
                      ) : partner.visual === "telemme" ? (
                        <img
                          src={telemmeLogoPath}
                          alt="TELEMMe — UMR 7303 logo"
                          className="w-44 h-28 rounded-lg object-contain bg-white/95 p-2"
                          data-testid="img-telemme-logo"
                        />
                      ) : partner.visual === "iris" ? (
                        <img
                          src={irisLogoPath}
                          alt="IRIS — EHESS logo"
                          className="w-28 h-28 rounded-lg object-contain bg-white/95 p-2"
                          data-testid="img-iris-logo"
                        />
                      ) : (
                        <div className="w-28 h-28 rounded-full bg-gradient-to-br from-[#350A8C]/20 to-[#8F00FF]/10 border border-[#350A8C]/20 flex items-center justify-center">
                          <span className="font-serif text-3xl text-shadows-text/60">{partner.name.split(" ")[0][0]}</span>
                        </div>
                      )}
                    </a>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4 mb-4">
                      <h2 className="font-serif text-2xl text-shadows-text tracking-wide" data-testid={`text-partner-name-${i}`}>
                        {partner.name}
                      </h2>
                      <a
                        href={partner.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`Open ${partner.name} website in a new tab`}
                        title={`Open ${partner.name} website`}
                        className="flex-shrink-0 text-[#8F00FF]/60 hover:text-[#03FF9B] transition-colors"
                        data-testid={`link-partner-${i}`}
                      >
                        <ExternalLink size={18} aria-hidden="true" />
                      </a>
                    </div>

                    <p className="text-shadows-text/60 leading-relaxed mb-6 text-justify" data-testid={`text-partner-desc-${i}`}>
                      {partner.description}
                    </p>

                    <div>
                      <span className="text-xs uppercase tracking-wider text-shadows-text/30 mb-3 block">
                        Areas of focus
                      </span>
                      <div className="flex flex-wrap gap-2">
                        {partner.focus.map((area, j) => (
                          <span
                            key={j}
                            className="text-xs px-3 py-1.5 rounded-full border border-[#350A8C]/20 text-shadows-text/50"
                            data-testid={`tag-partner-focus-${i}-${j}`}
                          >
                            {area}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="mt-6">
                      <a
                        href={partner.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`Visit the ${partner.name} website (opens in a new tab)`}
                        className="inline-flex items-center gap-2 text-sm text-[#8F00FF]/70 hover:text-[#03FF9B] transition-colors"
                        data-testid={`link-partner-visit-${i}`}
                      >
                        Visit {partner.name} website
                        <ExternalLink size={14} aria-hidden="true" />
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
