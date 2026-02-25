import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

const teamMembers = [
  {
    name: "Dr. Elena Vasquez",
    role: "Principal Investigator",
    institution: "University of Zurich",
    bio: "Elena Vasquez is a Jungian analyst and comparative mythologist specializing in the archetypal structures of Mediterranean and Mesoamerican religious traditions. Her work bridges analytical psychology and digital humanities, focusing on the computational modeling of mythological networks. She has published extensively on the Shadow archetype in colonial-era mythological syncretism.",
  },
  {
    name: "Prof. Akira Tanaka",
    role: "Computational Mythologist",
    institution: "Kyoto University",
    bio: "Akira Tanaka combines expertise in East Asian religious studies with advanced computational graph theory. His research applies network analysis to Buddhist, Shinto, and Daoist mythological systems, revealing structural homologies with Western archetypal patterns. He leads the algorithmic development of the SHADOWS graph engine.",
  },
  {
    name: "Dr. Amara Osei",
    role: "Comparative Religion Scholar",
    institution: "SOAS University of London",
    bio: "Amara Osei specializes in West African and diaspora religious traditions, with a focus on Yoruba and Vodun cosmologies. Her contribution to SHADOWS centers on mapping the diffusion of archetypal motifs across the Atlantic, tracking how deities transform through cultural transmission.",
  },
  {
    name: "Dr. Marcus Chen",
    role: "Graph Theory & Visualization",
    institution: "MIT Media Lab",
    bio: "Marcus Chen is a data visualization researcher who designs interactive systems for exploring complex relational datasets. His work on force-directed layouts and semantic clustering informs the core visualization engine of the SHADOWS platform.",
  },
  {
    name: "Dr. Sofia Petrov",
    role: "Depth Psychology Researcher",
    institution: "Pacifica Graduate Institute",
    bio: "Sofia Petrov is a depth psychologist whose research explores the relationship between individual dream symbolism and collective mythological motifs. She contributes the psychological classification framework used in the SHADOWS archetype taxonomy.",
  },
  {
    name: "Dr. Rajan Mehta",
    role: "Hindu & Vedic Studies",
    institution: "Jawaharlal Nehru University",
    bio: "Rajan Mehta is an authority on Hindu and Vedic mythological systems. His research on the Trimurti and avatar traditions provides foundational data for the Indo-European mythological module of the SHADOWS atlas.",
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
          An interdisciplinary collective of scholars advancing the frontiers of comparative mythology
          through computational analysis and Jungian depth psychology.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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
