import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

const teamMembers = [
  {
    name: "Camille Bertrand",
    role: "Researcher",
    institution: "EHESS",
    bio: "Camille Bertrand is a researcher at the École des Hautes Études en Sciences Sociales specializing in the anthropology of religion and symbolic systems. Her contribution to SHADOWS centers on the classification and cross-referencing of mythological motifs across Indo-European, Semitic, and East Asian traditions.",
  },
  {
    name: "Laura Duparc",
    role: "Lead Researcher",
    institution: "University Mohammed VI Polytechnic",
    bio: "Laura Duparc leads the SHADOWS research initiative, bringing expertise in comparative mythology and digital humanities. Her work focuses on mapping structural parallels across mythological traditions using computational network analysis, with particular interest in how archetypal motifs migrate and transform across cultures and historical periods.",
  },
  {
    name: "Ami Nagai",
    role: "Researcher",
    institution: "Aix-Marseille Université",
    bio: "Ami Nagai brings expertise in East Asian religious studies and comparative symbolism to the SHADOWS project. Her research explores the structural resonances between Japanese, Chinese, and South Asian mythological systems, contributing to the atlas's coverage of pan-Asian archetypal networks.",
  },
];

export default function TeamPage() {
  const [expanded, setExpanded] = useState<number | null>(null);

  return (
    <div className="min-h-screen bg-[#0B0626] pt-24 pb-16">
      <div className="max-w-5xl mx-auto px-6">
        <h1 className="font-serif text-4xl md:text-5xl text-shadows-text tracking-wide mb-4" data-testid="text-team-title">
          Research Team
        </h1>
        <p className="text-shadows-text/50 max-w-2xl mb-16 leading-relaxed">
          An interdisciplinary team of scholars advancing the frontiers of comparative mythology
          through computational analysis and network visualization.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
          {teamMembers.map((member, i) => (
            <div
              key={i}
              className="rounded-md border border-[#350A8C]/20 bg-[#0C0042]/30 p-6 transition-all duration-300 hover:border-[#350A8C]/40 cursor-pointer"
              onClick={() => setExpanded(expanded === i ? null : i)}
              data-testid={`card-team-${i}`}
            >
              <div className="flex items-start justify-between gap-2 mb-4">
                <div className="w-14 h-14 rounded-full bg-gradient-to-br from-[#350A8C] to-[#8F00FF]/30 border border-[#8F00FF]/20 flex items-center justify-center flex-shrink-0">
                  <span className="font-serif text-lg text-shadows-text/60">
                    {member.name.split(" ").map(n => n[0]).join("")}
                  </span>
                </div>
                <button className="text-shadows-text/30 mt-1" data-testid={`button-expand-${i}`}>
                  {expanded === i ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </button>
              </div>
              <h3 className="font-serif text-base text-shadows-text mb-1" data-testid={`text-member-name-${i}`}>
                {member.name}
              </h3>
              <p className="text-[#8F00FF]/80 text-xs mb-1">{member.role}</p>
              <p className="text-shadows-text/40 text-xs mb-3">{member.institution}</p>
              {expanded === i && (
                <p className="text-shadows-text/50 text-sm leading-relaxed border-t border-[#350A8C]/10 pt-3 mt-2" data-testid={`text-member-bio-${i}`}>
                  {member.bio}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
