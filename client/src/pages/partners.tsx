import { Link } from "wouter";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";

const partners = [
  {
    name: "Legacy — UM6P / 1337",
    url: "https://legacy-um6p.1337.ma/home",
    initials: "L",
    description:
      "Legacy is a digital humanities programme housed at Mohammed VI Polytechnic University (UM6P) and 1337 coding school in Morocco. It focuses on preserving and computationally analysing cultural heritage through advanced data science, machine learning, and interactive visualisation. Legacy partners with SHADOWS to bring North-African and pan-Mediterranean mythological traditions into the comparative atlas.",
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
    initials: "M",
    description:
      "Machina Research Network is a computational interdisciplinary research collective that bridges computer science, humanities, and social sciences. Its research programme applies quantitative methods — network analysis, natural language processing, and statistical modelling — to questions traditionally addressed through qualitative scholarship. Machina collaborates with SHADOWS on graph-theoretic approaches to comparative mythology and the development of open research tools.",
    focus: [
      "Computational interdisciplinary research",
      "Network analysis & NLP",
      "Statistical modelling for humanities",
      "Open research tooling",
    ],
  },
];

export default function PartnersPage() {
  return (
    <div className="min-h-screen bg-[#0B0626]">
      <section className="relative py-24 bg-gradient-to-b from-[#0C0042] to-[#0B0626]">
        <div className="max-w-4xl mx-auto px-6">
          <div className="mb-8">
            <Link href="/">
              <Button
                variant="ghost"
                size="sm"
                className="text-shadows-text/40 hover:text-shadows-text p-1 h-auto"
                data-testid="button-back-home"
              >
                <ArrowLeft size={16} className="mr-1" />
                Back
              </Button>
            </Link>
          </div>

          <h1
            className="font-serif text-4xl md:text-5xl text-shadows-text tracking-wide mb-4"
            data-testid="text-partners-title"
          >
            Partners
          </h1>
          <p className="text-shadows-text/50 max-w-2xl leading-relaxed mb-20" data-testid="text-partners-intro">
            SHADOWS is developed in collaboration with leading research institutions in digital humanities
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
                    <div className="w-24 h-24 rounded-full bg-gradient-to-br from-[#350A8C]/20 to-[#8F00FF]/10 border border-[#350A8C]/20 flex items-center justify-center">
                      <span className="font-serif text-3xl text-shadows-text/60">{partner.initials}</span>
                    </div>
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
                        className="flex-shrink-0 text-[#8F00FF]/60 hover:text-[#03FF9B] transition-colors"
                        data-testid={`link-partner-${i}`}
                      >
                        <ExternalLink size={18} />
                      </a>
                    </div>

                    <p className="text-shadows-text/60 leading-relaxed mb-6" data-testid={`text-partner-desc-${i}`}>
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
                        className="inline-flex items-center gap-2 text-sm text-[#8F00FF]/70 hover:text-[#03FF9B] transition-colors"
                        data-testid={`link-partner-visit-${i}`}
                      >
                        Visit website
                        <ExternalLink size={14} />
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
