import { useQuery } from "@tanstack/react-query";
import { Calendar } from "lucide-react";
import type { News } from "@shared/schema";

export default function NewsPage() {
  const { data: newsItems, isLoading, error } = useQuery<News[]>({
    queryKey: ["/api/news"],
  });

  return (
    <div className="min-h-screen bg-[#0B0626] pt-24 pb-16">
      <div className="max-w-4xl mx-auto px-6">
        <h1 className="font-serif text-4xl md:text-5xl text-shadows-text tracking-wide mb-4" data-testid="text-news-title">
          News & Updates
        </h1>
        <p className="text-shadows-text/50 max-w-2xl mb-16 leading-relaxed text-justify">
          Latest developments, publications, and events from the SHADOWS research project.
        </p>

        {error ? (
          <div className="text-center py-16">
            <p className="text-red-400/60 text-sm" data-testid="text-news-error">Failed to load news. Please try again later.</p>
          </div>
        ) : isLoading ? (
          <div className="space-y-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="rounded-md border border-[#350A8C]/15 bg-[#0C0042]/20 p-6">
                <div className="h-4 w-24 bg-[#350A8C]/20 rounded mb-3 animate-pulse" />
                <div className="h-6 w-3/4 bg-[#350A8C]/15 rounded mb-3 animate-pulse" />
                <div className="h-3 w-full bg-[#350A8C]/10 rounded mb-2 animate-pulse" />
                <div className="h-3 w-2/3 bg-[#350A8C]/10 rounded animate-pulse" />
              </div>
            ))}
          </div>
        ) : newsItems && newsItems.length > 0 ? (
          <div className="space-y-6">
            {newsItems.map((item) => (
              <article
                key={item.id}
                className="rounded-md border border-[#350A8C]/15 bg-[#0C0042]/20 p-6 transition-all duration-300 hover:border-[#350A8C]/30"
                data-testid={`card-news-${item.id}`}
              >
                <div className="flex items-center gap-2 mb-3">
                  <Calendar className="w-3.5 h-3.5 text-[#8F00FF]/60" />
                  <time className="text-shadows-text/40 text-xs">
                    {new Date(item.date).toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  </time>
                </div>
                <h2 className="font-serif text-xl text-shadows-text mb-3" data-testid={`text-news-title-${item.id}`}>
                  {item.title}
                </h2>
                <p className="text-shadows-text/50 text-sm leading-relaxed text-justify">
                  {item.content.length > 300 ? item.content.substring(0, 300) + "..." : item.content}
                </p>
              </article>
            ))}
          </div>
        ) : (
          <div className="text-center py-16">
            <p className="text-shadows-text/30 text-sm" data-testid="text-news-empty">No news articles yet.</p>
          </div>
        )}
      </div>
    </div>
  );
}
