import { Link, useLocation } from "wouter";
import { Menu, X } from "lucide-react";
import { useState } from "react";

const navLinks = [
  { href: "/", label: "Home" },
  { href: "/research", label: "Research" },
  { href: "/projects", label: "Projects" },
  { href: "/news", label: "News" },
  { href: "/team", label: "Team" },
  { href: "/partners", label: "Partners" },
];

export default function Navbar() {
  const [location] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-[#0B0626]/80 backdrop-blur-xl border-b border-[#350A8C]/20">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between gap-4">
        <Link href="/" data-testid="link-home-logo">
          <span className="font-serif text-xl tracking-[0.15em] text-shadows-text font-bold">
            SHADOWS
          </span>
        </Link>

        <div className="hidden md:flex items-center gap-1">
          {navLinks.map((link) => (
            <Link key={link.href} href={link.href} data-testid={`link-nav-${link.label.toLowerCase()}`}>
              <span
                className={`px-3 py-2 rounded-md text-sm transition-colors duration-200 ${
                  location === link.href
                    ? "text-shadows-green"
                    : "text-shadows-text/70 hover:text-shadows-text"
                }`}
              >
                {link.label}
              </span>
            </Link>
          ))}
        </div>

        <button
          className="md:hidden text-shadows-text"
          onClick={() => setMobileOpen(!mobileOpen)}
          data-testid="button-mobile-menu"
        >
          {mobileOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {mobileOpen && (
        <div className="md:hidden bg-[#0B0626]/95 backdrop-blur-xl border-b border-[#350A8C]/20 px-6 pb-4">
          {navLinks.map((link) => (
            <Link key={link.href} href={link.href} data-testid={`link-mobile-${link.label.toLowerCase()}`}>
              <span
                className={`block py-2 text-sm transition-colors ${
                  location === link.href
                    ? "text-shadows-green"
                    : "text-shadows-text/70"
                }`}
                onClick={() => setMobileOpen(false)}
              >
                {link.label}
              </span>
            </Link>
          ))}
        </div>
      )}
    </nav>
  );
}
