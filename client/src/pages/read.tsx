import { useQuery } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { BookOpen, AlertCircle, ArrowLeft } from "lucide-react";
import ReactMarkdown from "react-markdown";

interface ReaderText {
  id: number;
  title: string;
  author: string | null;
  translator: string | null;
  language: string | null;
  text: string;
  markdown: string | null;
}

export default function ReadPage() {
  const params = useParams<{ id: string }>();
  const id = parseInt(String(params.id));
  const validId = Number.isInteger(id) && id > 0;

  const { data, isLoading, error } = useQuery<ReaderText>({
    queryKey: [`/api/hunter/library/${id}/text`],
    enabled: validId,
    retry: false,
  });

  return (
    <div className="min-h-screen bg-[#0B0626] text-[#E0DCE6]">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 pt-20 pb-16">
        <Link
          href="/sources"
          className="inline-flex items-center gap-2 text-sm text-[#E0DCE6]/50 hover:text-[#E0DCE6] transition-colors mb-6"
          data-testid="link-back-to-library"
        >
          <ArrowLeft size={16} /> Back to the Library
        </Link>

        {!validId || error ? (
          <div className="py-24 flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 rounded-full bg-[#130D30] border border-[#350A8C]/40 flex items-center justify-center mb-6">
              <AlertCircle className="text-[#8F00FF]/50" size={32} />
            </div>
            <h1 className="text-2xl font-bold mb-2" style={{ fontFamily: "'Cinzel Decorative', serif" }}>
              Text Not Found
            </h1>
            <p className="text-[#E0DCE6]/60 max-w-md" data-testid="text-reader-not-found">
              This text does not exist in the library, or it is not available for public
              reading. It may have been removed or its link may be incorrect.
            </p>
          </div>
        ) : isLoading ? (
          <div className="py-24 text-center text-[#E0DCE6]/50 text-sm">Loading text...</div>
        ) : data ? (
          <>
            <div className="border-b border-[#350A8C]/30 pb-6 mb-8">
              <div className="flex items-start gap-3">
                <BookOpen size={22} className="text-[#8F00FF]/60 shrink-0 mt-1.5" />
                <div className="min-w-0">
                  <h1
                    className="text-2xl font-semibold text-[#E0DCE6]"
                    style={{ fontFamily: "'Cinzel Decorative', serif" }}
                    data-testid="text-reader-title"
                  >
                    {data.title}
                  </h1>
                  <p className="text-sm text-[#E0DCE6]/60 mt-2">
                    {data.author && `By ${data.author}`}
                    {data.translator && `${data.author ? " • " : ""}Tr: ${data.translator}`}
                    {data.language && `${data.author || data.translator ? " • " : ""}${data.language.toUpperCase()}`}
                  </p>
                </div>
              </div>
            </div>
            {data.markdown ? (
              <div
                className="reader-markdown text-[#E0DCE6]/90 text-[15px] leading-relaxed font-serif [&_h1]:text-xl [&_h1]:font-bold [&_h1]:mt-6 [&_h1]:mb-3 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:mt-5 [&_h2]:mb-2 [&_h3]:font-semibold [&_h3]:mt-4 [&_h3]:mb-2 [&_p]:my-3 [&_hr]:my-6 [&_hr]:border-[#350A8C]/40 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_blockquote]:border-l-2 [&_blockquote]:border-[#8F00FF]/50 [&_blockquote]:pl-4 [&_a]:text-[#8F00FF]"
                data-testid="text-reader-body"
              >
                <ReactMarkdown>{data.markdown}</ReactMarkdown>
              </div>
            ) : (
              <pre
                className="whitespace-pre-wrap text-[#E0DCE6]/90 text-[15px] leading-relaxed font-serif"
                data-testid="text-reader-body"
              >
                {data.text}
              </pre>
            )}
          </>
        ) : null}
      </div>
    </div>
  );
}
