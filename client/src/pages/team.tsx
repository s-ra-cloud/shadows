import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

const teamMembers = [
  {
    name: "Laura Duparc",
    role: "Lead Researcher",
    institution: "Université Paris-Panthéon-Assas / Université Mohammed VI Polytechnique",
    bio: "Laura Duparc holds a doctorate in law from Université Paris-Panthéon-Assas and is a postdoctoral researcher working on large language models applied to law and digital humanities at Aix-Marseille Université. She is the founder and lead designer of LEGACY, a platform for exploring classical academic texts through NLP, graph analysis, and AI, hosted at Université Mohammed VI Polytechnique. Her broader portfolio includes the co-creation of several digital humanities platforms — Knowledge Tree (University of Chicago), La Grande Conversation, Future of Science Network, and Thesis Center. Her published research spans jurimetrics, criminal sciences, and computational approaches to the humanities, with articles in Droit et Société, AJ Pénal, and the Revue de Sciences Criminelles. She leads the SHADOWS initiative, bringing her expertise in network-based analysis and interdisciplinary platform design to the comparative study of world mythologies.",
  },
  {
    name: "Camille Bertrand",
    role: "Researcher",
    institution: "École des Hautes Études en Sciences Sociales",
    bio: "Camille Bertrand holds a Master's degree in political studies from the École des Hautes Études en Sciences Sociales (EHESS) and a law degree from Aix-Marseille Université, where she is currently pursuing a doctorate in law and political studies. She has worked as a research assistant at the Laboratory of Private Law and Criminal Sciences of Aix-Marseille Université on a SATT Sud-Est funded project, collaborating with a web developer to build a tool for substituting equivalent propositions in the work of Wittgenstein (Semantica.AI). Her experience bridges legal analysis, political theory, and digital tools for the humanities. Within SHADOWS, she contributes her skills in textual analysis and interdisciplinary research methodology.",
  },
  {
    name: "Ami Nagai",
    role: "Researcher",
    institution: "Aix-Marseille Université",
    bio: "Ami Nagai is a doctoral candidate in history at Aix-Marseille Université, affiliated with the TELEMMe laboratory (CNRS). Born in Tokyo, she holds a bachelor's degree in international and Francophone studies from Sophia University (Tokyo) and a master's in modern and contemporary history from Aix-Marseille Université, where she was a recipient of the French Government Scholarship. She is also pursuing a university diploma in criminal sciences and criminology. Her research fields include the history of criminality, law, gender, and medicine, with a doctoral thesis on castration in France from the 18th to 20th centuries. Fluent in Japanese, French, and English, she brings a cross-cultural perspective to SHADOWS, contributing to the atlas's coverage of Japanese and East Asian mythological traditions.",
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
        <p className="text-shadows-text/50 max-w-2xl mb-16 leading-relaxed text-justify">
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
                <p className="text-shadows-text/50 text-sm leading-relaxed border-t border-[#350A8C]/10 pt-3 mt-2 text-justify" data-testid={`text-member-bio-${i}`}>
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
