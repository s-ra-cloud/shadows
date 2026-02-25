const partners = [
  {
    name: "C.G. Jung Institute Zurich",
    description: "The world's leading center for Jungian analytical psychology, providing theoretical foundations and archival resources for the SHADOWS archetypal taxonomy.",
  },
  {
    name: "Stanford Digital Humanities Lab",
    description: "Pioneering computational approaches to humanistic inquiry. Collaborating on network visualization methods and graph-theoretic analysis of mythological systems.",
  },
  {
    name: "British Museum Mythology Archive",
    description: "Providing access to one of the world's most comprehensive collections of mythological artifacts and iconographic databases spanning five millennia.",
  },
  {
    name: "Archetype Foundation Vienna",
    description: "An independent research foundation dedicated to the study of archetypal patterns in art, literature, and religious symbolism across European traditions.",
  },
  {
    name: "Kyoto National Museum",
    description: "Contributing expertise in East Asian religious iconography and Buddhist-Shinto syncretic traditions to the comparative mythology database.",
  },
  {
    name: "SOAS Centre for Religions and Theology",
    description: "Supporting research on African diaspora religions and the archetypal structures of Yoruba, Vodun, and syncretic Caribbean spiritual traditions.",
  },
];

export default function PartnersPage() {
  return (
    <div className="min-h-screen bg-[#0B0626] pt-24 pb-16">
      <div className="max-w-5xl mx-auto px-6">
        <h1 className="font-serif text-4xl md:text-5xl text-shadows-text tracking-wide mb-4" data-testid="text-partners-title">
          Partners & Collaborators
        </h1>
        <p className="text-shadows-text/50 max-w-2xl mb-16 leading-relaxed">
          SHADOWS is made possible through partnerships with leading academic institutions, museums, and research foundations around the world.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {partners.map((partner, i) => (
            <div
              key={i}
              className="group rounded-md border border-[#350A8C]/15 bg-[#0C0042]/20 p-6 transition-all duration-300 hover:border-[#350A8C]/40"
              data-testid={`card-partner-${i}`}
            >
              <div className="w-14 h-14 rounded-full bg-[#350A8C]/10 border border-[#350A8C]/20 flex items-center justify-center mb-4 opacity-50 group-hover:opacity-100 transition-opacity">
                <span className="font-serif text-sm text-shadows-text/60">
                  {partner.name.split(" ").map(w => w[0]).slice(0, 2).join("")}
                </span>
              </div>
              <h3 className="font-serif text-base text-shadows-text mb-2" data-testid={`text-partner-name-${i}`}>
                {partner.name}
              </h3>
              <p className="text-shadows-text/40 text-sm leading-relaxed">
                {partner.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
