"use client";

import { useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { parsePanel, PanelRenderer, stripPanelFromText } from "@/components/Panels";

interface ContentWindowProps {
  content:   string;
  onDismiss: () => void;
}

export function ContentWindow({ content, onDismiss }: ContentWindowProps) {
  const panel          = parsePanel(content);
  const displayContent = panel ? "" : extractDisplayContent(content);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onDismiss(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onDismiss]);

  return (
    // z-10 — orb (z-30) always floats above. 0.3s delay so orb moves first.
    <div
      className="pointer-events-auto absolute left-1/2 top-1/2 z-10 w-full px-4 -translate-x-1/2 -translate-y-1/2"
      style={{
        maxWidth: 820,
        animation: "velcro-window-in 0.5s cubic-bezier(0.4, 0, 0.2, 1) 0.3s both",
      }}
    >
      <div
        className="relative max-h-[78vh] overflow-y-auto rounded-2xl p-6"
        style={{
          background:    "rgba(10,10,16,0.97)",
          border:        "1px solid rgba(255,255,255,0.08)",
          boxShadow:     "0 0 80px rgba(99,102,241,0.10), 0 32px 64px rgba(0,0,0,0.55)",
          backdropFilter: "blur(24px)",
        }}
      >
        {/* Close button */}
        <button
          onClick={onDismiss}
          className="absolute right-4 top-4 transition-colors"
          style={{ color: "#6b6b8a" }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "#e8e8f0")}
          onMouseLeave={(e) => (e.currentTarget.style.color = "#6b6b8a")}
          aria-label="Schließen"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        {/* Content */}
        <div className="text-sm" style={{ color: "#e8e8f0" }}>
          {panel ? (
            <PanelRenderer envelope={panel} />
          ) : (
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                table: ({ children }) => (
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse text-xs">{children}</table>
                  </div>
                ),
                thead: ({ children }) => (
                  <thead style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>{children}</thead>
                ),
                th: ({ children }) => (
                  <th className="px-3 py-2 text-left text-xs font-medium" style={{ color: "#6b6b8a" }}>{children}</th>
                ),
                td: ({ children }) => (
                  <td className="px-3 py-2 text-xs" style={{ borderBottom: "1px solid rgba(255,255,255,0.05)", color: "#c8c8e0" }}>{children}</td>
                ),
                code: ({ children, className }) => {
                  const isBlock = className?.includes("language-");
                  return isBlock ? (
                    <code
                      className="block overflow-x-auto rounded-xl p-4 font-mono text-xs"
                      style={{ background: "rgba(255,255,255,0.04)", color: "#a78bfa" }}
                    >
                      {children}
                    </code>
                  ) : (
                    <code
                      className="rounded px-1.5 py-0.5 font-mono text-xs"
                      style={{ background: "rgba(255,255,255,0.06)", color: "#a78bfa" }}
                    >
                      {children}
                    </code>
                  );
                },
                ul: ({ children }) => <ul className="space-y-1.5 pl-4">{children}</ul>,
                li: ({ children }) => (
                  <li className="text-xs leading-relaxed" style={{ color: "#c8c8e0" }}>
                    <span style={{ color: "#818cf8", marginRight: 6 }}>›</span>
                    {children}
                  </li>
                ),
                ol: ({ children }) => <ol className="list-decimal space-y-1.5 pl-4 text-xs" style={{ color: "#c8c8e0" }}>{children}</ol>,
                h1: ({ children }) => <h1 className="mb-3 text-sm font-semibold" style={{ color: "#e8e8f0" }}>{children}</h1>,
                h2: ({ children }) => <h2 className="mb-2 text-xs font-semibold" style={{ color: "#e8e8f0" }}>{children}</h2>,
                h3: ({ children }) => <h3 className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider" style={{ color: "#6b6b8a" }}>{children}</h3>,
                p:  ({ children }) => <p className="mb-3 text-xs leading-relaxed last:mb-0" style={{ color: "#c8c8e0" }}>{children}</p>,
                strong: ({ children }) => <strong className="font-semibold" style={{ color: "#e8e8f0" }}>{children}</strong>,
              }}
            >
              {displayContent}
            </ReactMarkdown>
          )}
        </div>

        <p className="mt-5 text-center text-[9px] tracking-widest" style={{ color: "rgba(107,107,138,0.4)" }}>
          ESC
        </p>
      </div>
    </div>
  );
}

// Extract only the structured part (tables, lists, code) — prose is spoken, not shown.
export function extractDisplayContent(text: string): string {
  const panelIdx = text.search(/VELCRO_PANEL:/);
  if (panelIdx >= 0) text = text.slice(0, panelIdx).trim();

  const candidates: number[] = [];
  const tableIdx    = text.search(/^\|/m);
  const codeIdx     = text.indexOf("```");
  const numberedIdx = text.search(/^\d+\. /m);
  const headingIdx  = text.search(/^#{1,6} /m);

  if (tableIdx    >= 0) candidates.push(tableIdx);
  if (codeIdx     >= 0) candidates.push(codeIdx);
  if (numberedIdx >= 0) candidates.push(numberedIdx);
  if (headingIdx  >= 0) candidates.push(headingIdx);

  if (candidates.length === 0) return text;
  return text.slice(Math.min(...candidates)).trim();
}

export function hasStructuredContent(text: string): boolean {
  if (/^VELCRO_PANEL:/m.test(text)) return true;
  const hasTable        = /\|.+\|/.test(text) && /\|[-: ]+\|/.test(text);
  const hasCodeBlock    = text.includes("```");
  const hasNumberedList = (text.match(/^\d+\./gm) ?? []).length >= 3;
  const hasHeadings     = (text.match(/^#{1,6} /gm) ?? []).length >= 1;
  const isBulletHeavy   = (text.match(/^[-*] /gm) ?? []).length >= 3;
  const isLong          = text.length > 400;
  return hasTable || hasCodeBlock || hasNumberedList
      || (hasHeadings && isBulletHeavy) || (isBulletHeavy && isLong);
}

// Re-export for backwards compat
export { stripPanelFromText };
