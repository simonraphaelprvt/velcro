"use client";

import { motion } from "framer-motion";
import { CheckCircle, Pin, HelpCircle, Zap } from "lucide-react";

export interface CRItem {
  date:   string;
  topic:  string;
  type?:  "decision" | "commitment" | "open" | "problem";
  tools?: string[];
}
export interface CRData {
  range: string;
  items: CRItem[];
}

const TYPE_CONFIG = {
  decision:   { icon: CheckCircle, color: "#34d399", label: "Entscheidung",  bg: "rgba(52,211,153,0.10)",  border: "rgba(52,211,153,0.25)" },
  commitment: { icon: Pin,         color: "#60a5fa", label: "Commitment",    bg: "rgba(96,165,250,0.10)",  border: "rgba(96,165,250,0.25)" },
  open:       { icon: HelpCircle,  color: "#fbbf24", label: "Offen",         bg: "rgba(251,191,36,0.10)",  border: "rgba(251,191,36,0.25)" },
  problem:    { icon: Zap,         color: "#f87171", label: "Problem",       bg: "rgba(248,113,113,0.10)", border: "rgba(248,113,113,0.25)" },
};
const DEFAULT_TYPE = { icon: HelpCircle, color: "#818cf8", label: "Gespräch", bg: "rgba(129,140,248,0.08)", border: "rgba(129,140,248,0.20)" };

export default function ConversationReplay({ data }: { data: CRData }) {
  const openItems = data.items.filter((i) => i.type === "open" || i.type === "problem");

  return (
    <div className="space-y-3">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
      >
        <div className="text-[10px] uppercase tracking-[0.3em]" style={{ color: "#6b6b8a" }}>Gesprächs-Verlauf</div>
        <div className="mt-1 text-base font-medium" style={{ color: "#e8e8f0" }}>{data.range}</div>
      </motion.div>

      {/* Timeline */}
      <div className="relative">
        {/* Vertical line — animates in */}
        <motion.div
          className="absolute left-[9px] top-0 w-px"
          style={{ background: "rgba(255,255,255,0.08)" }}
          initial={{ scaleY: 0, originY: 0 }}
          animate={{ scaleY: 1 }}
          transition={{ duration: 0.6, ease: "easeInOut" }}
          // Height computed via layout
          layoutId="timeline-line"
        />
        <div
          className="absolute left-[9px] w-px"
          style={{ top: 0, bottom: 0, background: "rgba(255,255,255,0.08)" }}
        />

        <div className="space-y-2 pl-7">
          {data.items.map((item, i) => {
            const cfg = item.type ? TYPE_CONFIG[item.type] : DEFAULT_TYPE;
            const Icon = cfg.icon;
            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.4, delay: 0.1 + i * 0.09, ease: [0.22, 1, 0.36, 1] }}
                className="relative"
              >
                {/* Dot on the line */}
                <div
                  className="absolute -left-7 top-3 flex h-[18px] w-[18px] items-center justify-center rounded-full"
                  style={{ background: cfg.bg, border: `1px solid ${cfg.border}` }}
                >
                  <Icon size={9} style={{ color: cfg.color }} />
                </div>

                <div
                  className="rounded-xl p-2"
                  style={{ background: cfg.bg, border: `1px solid ${cfg.border}` }}
                >
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <span
                      className="rounded px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wider"
                      style={{ color: cfg.color, background: "rgba(0,0,0,0.2)" }}
                    >
                      {cfg.label}
                    </span>
                    <span className="text-[10px]" style={{ color: "#6b6b8a" }}>{item.date}</span>
                  </div>
                  <div className="text-xs leading-snug" style={{ color: "#c8c8e0" }}>{item.topic}</div>
                  {item.tools && item.tools.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {item.tools.map((t, ti) => (
                        <span
                          key={ti}
                          className="rounded px-1.5 py-0.5 font-mono text-[9px]"
                          style={{ background: "rgba(255,255,255,0.06)", color: "#7878a0" }}
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Open items section */}
      {openItems.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 + data.items.length * 0.09 + 0.15 }}
          className="rounded-xl p-3"
          style={{ background: "rgba(251,191,36,0.06)", border: "1px solid rgba(251,191,36,0.2)" }}
        >
          <div className="mb-2.5 flex items-center gap-2">
            <HelpCircle size={13} style={{ color: "#fbbf24" }} />
            <span className="text-[10px] uppercase tracking-widest" style={{ color: "#fbbf24" }}>
              Offene Punkte
            </span>
          </div>
          <div className="space-y-2">
            {openItems.map((item, i) => (
              <div key={i} className="flex items-start gap-2 text-xs" style={{ color: "#c8c8e0" }}>
                <span style={{ color: item.type === "problem" ? "#f87171" : "#fbbf24", marginTop: 1 }}>›</span>
                <span>{item.topic}</span>
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  );
}
