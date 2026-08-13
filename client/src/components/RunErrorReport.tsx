/**
 * The failure reason for a hunting run.
 *
 * A run error is stored already cleaned by the server, but it is still
 * machine-written text: it can be a long single line with no spaces. The card
 * therefore shows a one-line summary and keeps the full text collapsed behind
 * "Show details", in a scrollable, word-breaking monospaced block with a copy
 * button, so a long error can never stretch or overflow the layout.
 */
import { useState } from "react";
import { AlertCircle, ChevronDown, ChevronRight, Copy, Check } from "lucide-react";

/** Hard cap on what is ever rendered, however large the stored error is. */
const MAX_DETAIL_CHARS = 4000;
/** Longest summary line shown before the reader has to open the details. */
const MAX_SUMMARY_CHARS = 160;

/** One readable line: whitespace collapsed, cut at the first sentence end. */
export function summariseRunError(error: string): string {
  const compact = error.replace(/\s+/g, " ").trim();
  if (compact.length <= MAX_SUMMARY_CHARS) return compact;
  const sentence = /^(.{20,160}?[.!?])(\s|$)/.exec(compact);
  if (sentence) return sentence[1];
  return `${compact.slice(0, MAX_SUMMARY_CHARS).trimEnd()}…`;
}

export function RunErrorReport({ error, testId }: { error: string; testId?: string }) {
  const [showDetails, setShowDetails] = useState(false);
  const [copied, setCopied] = useState(false);

  const full = error.replace(/\s+$/, "");
  const summary = summariseRunError(full);
  const hasDetails = full.replace(/\s+/g, " ").trim() !== summary;
  const detail =
    full.length > MAX_DETAIL_CHARS
      ? `${full.slice(0, MAX_DETAIL_CHARS)}\n… (truncated)`
      : full;

  const copy = () => {
    navigator.clipboard
      ?.writeText(detail)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      })
      .catch(() => {});
  };

  return (
    <div
      className="min-w-0 rounded-lg border border-red-500/30 bg-red-500/5 p-3"
      data-testid={testId ?? "run-error"}
    >
      <div className="flex items-start gap-2 text-sm text-red-400">
        <AlertCircle size={14} className="shrink-0 mt-0.5" />
        <span className="min-w-0 break-words" data-testid="text-run-error-summary">
          {summary}
        </span>
      </div>
      {hasDetails && (
        <>
          <button
            type="button"
            onClick={() => setShowDetails((open) => !open)}
            className="mt-2 inline-flex items-center gap-1 text-xs text-red-300/80 hover:text-red-200 transition-colors"
            data-testid="button-toggle-run-error-details"
          >
            {showDetails ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            {showDetails ? "Hide details" : "Show details"}
          </button>
          {showDetails && (
            <div className="mt-2 min-w-0">
              <div className="flex justify-end mb-1">
                <button
                  type="button"
                  onClick={copy}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] bg-[#130D30] border border-[#350A8C]/40 text-[#E0DCE6]/70 hover:text-[#E0DCE6] transition-colors"
                  data-testid="button-copy-run-error"
                >
                  {copied ? <Check size={11} /> : <Copy size={11} />}
                  {copied ? "Copied" : "Copy"}
                </button>
              </div>
              <pre
                className="max-h-48 overflow-auto whitespace-pre-wrap break-all rounded-md border border-[#350A8C]/30 bg-[#0B0626] p-2 font-mono text-[11px] leading-relaxed text-[#E0DCE6]/70"
                data-testid="text-run-error-detail"
              >
                {detail}
              </pre>
            </div>
          )}
        </>
      )}
    </div>
  );
}
