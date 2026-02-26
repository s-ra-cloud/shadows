const teamMembers = [
  {
    name: "Laura Duparc",
    role: "Lead Researcher",
    institution: "Université Mohammed VI Polytechnique",
    bio: "Laura Duparc holds a doctorate in law and is an affiliated researcher at Université Mohammed VI Polytechnique. She is the founder and lead designer of LEGACY, a platform for exploring classical academic texts through NLP, graph analysis, and AI, hosted at Université Mohammed VI Polytechnique. Her broader portfolio includes the co-creation of several digital humanities platforms — Knowledge Tree (University of Chicago), La Grande Conversation, Future of Science Network, and Thesis Center. Her published research spans jurimetrics, criminal sciences, and computational approaches to the humanities, with articles in Droit et Société, AJ Pénal, and the Revue de Sciences Criminelles. She leads the SHADOWS initiative, bringing her expertise in network-based analysis and interdisciplinary platform design to the comparative study of world mythologies.",
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
    bio: "Ami Nagai is a doctoral candidate in history at Aix-Marseille Université, affiliated with the TELEMMe laboratory (CNRS). Born in Tokyo, she holds a bachelor's degree in international and Francophone studies from Sophia University (Tokyo) and a master's in modern and contemporary history from Aix-Marseille Université, where she was a recipient of the French Government Scholarship. She also holds a university diploma in criminal sciences and criminology. Her research fields include the history of criminality, law, gender, and medicine, with a doctoral thesis on castration in France from the 18th to 20th centuries. Fluent in Japanese, French, and English, she brings a cross-cultural perspective to SHADOWS, contributing to the atlas's coverage of Japanese and East Asian mythological traditions.",
  },
];

export default function TeamPage() {
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

        <div className="space-y-10 max-w-3xl mx-auto">
          {teamMembers.map((member, i) => (
            <div
              key={i}
              className="rounded-md border border-[#350A8C]/20 bg-[#0C0042]/30 p-8 transition-all duration-300 hover:border-[#350A8C]/40"
              data-testid={`card-team-${i}`}
            >
              <div className="flex items-center gap-4 mb-5">
                <div className="w-14 h-14 rounded-full bg-gradient-to-br from-[#350A8C] to-[#8F00FF]/30 border border-[#8F00FF]/20 flex items-center justify-center flex-shrink-0">
                  <span className="font-serif text-lg text-shadows-text/60">
                    {member.name.split(" ").map(n => n[0]).join("")}
                  </span>
                </div>
                <div>
                  <h3 className="font-serif text-xl text-shadows-text mb-1" data-testid={`text-member-name-${i}`}>
                    {member.name}
                  </h3>
                  <p className="text-[#8F00FF]/80 text-xs">{member.role}</p>
                  <p className="text-shadows-text/40 text-xs">{member.institution}</p>
                </div>
              </div>
              <p className="text-shadows-text/50 text-sm leading-relaxed text-justify" data-testid={`text-member-bio-${i}`}>
                {member.bio}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
