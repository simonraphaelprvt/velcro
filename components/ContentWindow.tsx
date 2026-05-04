"use client";

import { useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface ContentWindowProps {
  content: string;
  onDismiss: () => void;
}

export function ContentWindow({ content, onDismiss }: ContentWindowProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onDismiss(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onDismiss]);

  return (
    // Sits on the same z-level as the orb — no backdrop, no overlay.
    // Orb wanders beside it via page.tsx transform logic.
    <div className="animate-slide-up pointer-events-auto absolute left-1/2 top-1/2 z-10 w-full max-w-lg -translate-x-1/2 -translate-y-1/2">
      <div className="relative max-h-[70vh] overflow-y-auto rounded-2xl border border-velcro-border bg-velcro-bg/90 p-6 shadow-[0_0_60px_rgba(99,102,241,0.12)] backdrop-blur-md">
        {/* Close */}
        <button
          onClick={onDismiss}
          className="absolute right-4 top-4 text-velcro-dim transition-colors hover:text-velcro-text"
          aria-label="Schliessen"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        {/* Content */}
        <div className="text-sm text-velcro-text">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              table: ({ children }) => (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-xs">{children}</table>
                </div>
              ),
              thead: ({ children }) => (
                <thead className="border-b border-velcro-border">{children}</thead>
              ),
              th: ({ children }) => (
                <th className="px-3 py-2 text-left font-medium text-velcro-dim">{children}</th>
              ),
              td: ({ children }) => (
                <td className="border-b border-velcro-border/40 px-3 py-2">{children}</td>
              ),
              code: ({ children, className }) => {
                const isBlock = className?.includes("language-");
                return isBlock ? (
                  <code className="block overflow-x-auto rounded-lg bg-velcro-surface p-4 font-mono text-xs text-velcro-accent-bright">
                    {children}
                  </code>
                ) : (
                  <code className="rounded bg-velcro-surface px-1.5 py-0.5 font-mono text-xs text-velcro-accent-bright">
                    {children}
                  </code>
                );
              },
              ul: ({ children }) => <ul className="space-y-1 pl-4">{children}</ul>,
              li: ({ children }) => (
                <li className="before:mr-2 before:text-velcro-accent before:content-['·']">{children}</li>
              ),
              ol: ({ children }) => <ol className="list-decimal space-y-1 pl-4">{children}</ol>,
              h1: ({ children }) => <h1 className="mb-3 text-base font-semibold">{children}</h1>,
              h2: ({ children }) => <h2 className="mb-2 text-sm font-semibold">{children}</h2>,
              h3: ({ children }) => <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-velcro-dim">{children}</h3>,
              p:  ({ children }) => <p className="mb-3 leading-relaxed last:mb-0">{children}</p>,
              strong: ({ children }) => <strong className="font-semibold text-velcro-text">{children}</strong>,
            }}
          >
            {content}
          </ReactMarkdown>
        </div>

        <p className="mt-5 text-center text-[9px] tracking-widest text-velcro-dim/40">
          ESC
        </p>
      </div>
    </div>
  );
}

// Heuristic: does this response contain structured content worth showing?
export function hasStructuredContent(text: string): boolean {
  const hasTable       = /\|.+\|/.test(text) && /\|[-: ]+\|/.test(text);
  const hasCodeBlock   = text.includes("```");
  const hasNumberedList = (text.match(/^\d+\./gm) ?? []).length >= 3;
  const isBulletHeavy  = (text.match(/^[-*] /gm) ?? []).length >= 4;
  const isLong         = text.length > 600;
  return hasTable || hasCodeBlock || hasNumberedList || (isBulletHeavy && isLong);
}
