import { Link } from "wouter";

export default function Footer() {
  return (
    <footer className="bg-[#0B0626] border-t border-[#350A8C]/20 py-12">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div>
            <h3 className="font-serif text-lg tracking-[0.1em] text-shadows-text mb-3">SHADOWS</h3>
            <p className="text-shadows-text/50 text-sm leading-relaxed">
              A Comparative Archetypal Atlas of Myth and Symbol. Exploring the universal patterns that connect world mythologies.
            </p>
            <p className="text-shadows-text/50 text-sm leading-relaxed mt-3">
              Contact:{" "}
              <a
                href="mailto:laura.duparc@univ-amu.fr"
                className="text-shadows-text/70 hover:text-shadows-green transition-colors underline decoration-dotted underline-offset-2"
                data-testid="link-footer-contact-email"
              >
                laura.duparc@univ-amu.fr
              </a>
            </p>
          </div>
          <div>
            <h4 className="text-shadows-text/70 text-sm font-medium mb-3 uppercase tracking-wider">Navigate</h4>
            <div className="flex flex-col gap-2">
              <Link href="/research"><span className="text-shadows-text/50 text-sm hover:text-shadows-green transition-colors" data-testid="link-footer-research">Research</span></Link>
              <Link href="/graph"><span className="text-shadows-text/50 text-sm hover:text-shadows-green transition-colors" data-testid="link-footer-graph">Graph</span></Link>
              <Link href="/news"><span className="text-shadows-text/50 text-sm hover:text-shadows-green transition-colors" data-testid="link-footer-news">News</span></Link>
            </div>
          </div>
          <div>
            <h4 className="text-shadows-text/70 text-sm font-medium mb-3 uppercase tracking-wider">Community</h4>
            <div className="flex flex-col gap-2">
              <Link href="/team"><span className="text-shadows-text/50 text-sm hover:text-shadows-green transition-colors" data-testid="link-footer-team">Team</span></Link>
              <Link href="/partners"><span className="text-shadows-text/50 text-sm hover:text-shadows-green transition-colors" data-testid="link-footer-partners">Partners</span></Link>
              <Link href="/admin"><span className="text-shadows-text/50 text-sm hover:text-shadows-green transition-colors" data-testid="link-footer-admin">Admin</span></Link>
            </div>
          </div>
        </div>
        <div className="mt-10 pt-6 border-t border-[#350A8C]/10 text-center">
          <p className="text-shadows-text/30 text-xs">
            &copy; {new Date().getFullYear()} SHADOWS Research Project. The project is open source under the{" "}
            <a
              href="https://creativecommons.org/licenses/by/4.0/"
              target="_blank"
              rel="noopener noreferrer"
              className="underline decoration-dotted hover:text-shadows-green transition-colors"
              data-testid="link-footer-license"
            >
              CC-BY 4.0
            </a>{" "}
            license.{" "}
            <span
              className="text-shadows-text/40"
              data-testid="text-footer-download-code"
              title="Coming soon"
            >
              Download code (coming soon)
            </span>
          </p>
        </div>
      </div>
    </footer>
  );
}
