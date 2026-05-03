"use client";

import { useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface ContentWindowProps {
  content: string;
  onDismiss: () => void;
}

export function ContentWindow({ content, onDismiss }: ContentWindowProps) {
  const ref = useRef<HTMLDivElement>(null);

  // Dismiss on Escape or click outside
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onDismiss();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onDismiss]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-6"
      onClick={(e) => {
        if (e.target === e.currentTarget) onDismiss();
      }}
    >
      {/* Backdrop */}
      <div className="animate-fade-in absolute inset-0 bg-velcro-bg/80 backdrop-blur-sm" />

      {/* Panel */}
      <div
        ref={ref}
        className="animate-slide-up relative z-10 max-h-[75vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-velcro-border bg-velcro-surface p-6"
      >
        {/* Close button */}
        <button
          onClick={onDismiss}
          className="absolute right-4 top-4 text-velcro-dim transition-colors hover:text-velcro-text"
          aria-label="Schliessen"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        {/* Rendered markdown */}
        <div className="prose-velcro text-sm text-velcro-text">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              // Tables
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
                <td className="border-b border-velcro-border/50 px-3 py-2">{children}</td>
              ),
              // Code
              code: ({ children, className }) => {
                const isBlock = className?.includes("language-");
                return isBlock ? (
                  <code className="block overflow-x-auto rounded-lg bg-velcro-bg p-4 font-mono text-xs text-velcro-accent-bright">
                    {children}
                  </code>
                ) : (
                  <code className="rounded bg-velcro-bg px-1.5 py-0.5 font-mono text-xs text-velcro-accent-bright">
                    {children}
                  </code>
                );
              },
              // Lists
              ul: ({ children }) => (
                <ul className="space-y-1 pl-4">{children}</ul>
              ),
              li: ({ children }) => (
                <li className="before:mr-2 before:text-velcro-accent before:content-['·']">
                  {children}
                </li>
              ),
              ol: ({ children }) => (
                <ol className="list-decimal space-y-1 pl-4">{children}</ol>
              ),
              // Headings
              h1: ({ children }) => (
                <h1 className="mb-3 text-base font-semibold text-velcro-text">{children}</h1>
              ),
              h2: ({ children }) => (
                <h2 className="mb-2 text-sm font-semibold text-velcro-text">{children}</h2>
              ),
              h3: ({ children }) => (
                <h3 className="mb-1.5 text-xs font-semibold text-velcro-dim uppercase tracking-wider">
                  {children}
                </h3>
              ),
              // Paragraphs
              p: ({ children }) => (
                <p className="mb-3 leading-relaxed last:mb-0">{children}</p>
              ),
              // Bold
              strong: ({ children }) => (
                <strong className="font-semibold text-velcro-text">{children}</strong>
              ),
            }}
          >
            {content}
          </ReactMarkdown>
        </div>

        {/* Dismiss hint */}
        <p className="mt-5 text-center text-[10px] tracking-widest text-velcro-dim/50">
          ESC ZUM SCHLIESSEN
        </p>
      </div>
    </div>
  );
}

// Heuristic: does this response contain structured content worth showing in the window?
export function hasStructuredContent(text: string): boolean {
  const hasTable = /\|.+\|/.test(text) && /\|[-: ]+\|/.test(text);
  const hasCodeBlock = text.includes("```");
  const hasNumberedList = (text.match(/^\d+\./gm) ?? []).length >= 3;
  const isBulletHeavy = (text.match(/^[-*] /gm) ?? []).length >= 4;
  const isLong = text.length > 800;

  return hasTable || hasCodeBlock || hasNumberedList || (isBulletHeavy && isLong);
}
