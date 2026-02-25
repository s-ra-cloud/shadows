import { useQuery } from "@tanstack/react-query";
import { ExternalLink, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Publication } from "@shared/schema";

export default function ResearchPage() {
  const { data: publications, isLoading, error } = useQuery<Publication[]>({
    queryKey: ["/api/publications"],
  });

  return (
    <div className="min-h-screen bg-[#0B0626] pt-24 pb-16">
      <div className="max-w-4xl mx-auto px-6">
        <h1 className="font-serif text-4xl md:text-5xl text-shadows-text tracking-wide mb-4" data-testid="text-research-title">
          Research & Publications
        </h1>
        <p className="text-shadows-text/50 max-w-2xl mb-16 leading-relaxed">
          Peer-reviewed publications, conference papers, and working papers from the SHADOWS research team.
        </p>

        {error ? (
          <div className="text-center py-16">
            <p className="text-red-400/60 text-sm" data-testid="text-research-error">Failed to load publications. Please try again later.</p>
          </div>
        ) : isLoading ? (
          <div className="space-y-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="rounded-md border border-[#350A8C]/15 bg-[#0C0042]/20 p-6">
                <div className="h-5 w-3/4 bg-[#350A8C]/15 rounded mb-3 animate-pulse" />
                <div className="h-3 w-1/2 bg-[#350A8C]/10 rounded mb-3 animate-pulse" />
                <div className="h-3 w-full bg-[#350A8C]/10 rounded mb-2 animate-pulse" />
                <div className="h-3 w-2/3 bg-[#350A8C]/10 rounded animate-pulse" />
              </div>
            ))}
          </div>
        ) : publications && publications.length > 0 ? (
          <div className="space-y-6">
            {publications.map((pub) => (
              <article
                key={pub.id}
                className="rounded-md border border-[#350A8C]/15 bg-[#0C0042]/20 p-6 transition-all duration-300 hover:border-[#350A8C]/30"
                data-testid={`card-publication-${pub.id}`}
              >
                <h2 className="font-serif text-lg text-shadows-text mb-2" data-testid={`text-pub-title-${pub.id}`}>
                  {pub.title}
                </h2>
                <p className="text-[#8F00FF]/70 text-sm mb-1">{pub.authors}</p>
                {pub.venue && (
                  <p className="text-shadows-text/40 text-xs italic mb-3">{pub.venue}</p>
                )}
                {pub.abstract && (
                  <p className="text-shadows-text/50 text-sm leading-relaxed mb-4">
                    {pub.abstract.length > 250 ? pub.abstract.substring(0, 250) + "..." : pub.abstract}
                  </p>
                )}
                <div className="flex items-center gap-3 flex-wrap">
                  {pub.doi && (
                    <a
                      href={`https://doi.org/${pub.doi}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      data-testid={`link-doi-${pub.id}`}
                    >
                      <Button
                        variant="outline"
                        size="sm"
                        className="border-[#350A8C]/30 text-shadows-text/60 no-default-hover-elevate no-default-active-elevate hover:border-[#03FF9B] hover:text-[#03FF9B] transition-all duration-300"
                      >
                        <ExternalLink className="w-3 h-3 mr-1.5" />
                        DOI
                      </Button>
                    </a>
                  )}
                  {pub.pdfUrl && (
                    <a
                      href={pub.pdfUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      data-testid={`link-pdf-${pub.id}`}
                    >
                      <Button
                        variant="outline"
                        size="sm"
                        className="border-[#350A8C]/30 text-shadows-text/60 no-default-hover-elevate no-default-active-elevate hover:border-[#8F00FF] hover:text-[#8F00FF] transition-all duration-300"
                      >
                        <FileText className="w-3 h-3 mr-1.5" />
                        PDF
                      </Button>
                    </a>
                  )}
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="text-center py-16">
            <p className="text-shadows-text/30 text-sm" data-testid="text-research-empty">No publications yet.</p>
          </div>
        )}
      </div>
    </div>
  );
}
