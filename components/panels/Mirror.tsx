"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { TrendingUp } from "lucide-react";

export interface MIInsight {
  pattern:   string;
  count:     number;
  examples?: string[];
}
export interface MIData {
  summary:  string;
  insights: MIInsight[];
}

// Animated count-up bar
function PatternBar({ insight, max, delay }: { insight: MIInsight; max: number; delay: number }) {
  const [expanded, setExpanded] = useState(false);
  const pct = (insight.count / max) * 100;

  return (
    <motion.div
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.4, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      <button
        onClick={() => setExpanded((e) => !e)}
        className="w-full text-left"
      >
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-sm" style={{ color: "#c8c8e0" }}>{insight.pattern}</span>
          <div className="flex items-center gap-2">
            <span
              className="rounded-full px-2 py-0.5 text-[10px] font-medium tabular-nums"
              style={{ background: "rgba(129,140,248,0.15)", color: "#818cf8" }}
            >
              {insight.count}×
            </span>
            {insight.examples && (
              <span className="text-[9px]" style={{ color: "#6b6b8a" }}>
                {expanded ? "▲" : "▼"}
              </span>
            )}
          </div>
        </div>
        <div
          className="h-1.5 overflow-hidden rounded-full"
          style={{ background: "rgba(255,255,255,0.06)" }}
        >
          <motion.div
            className="h-full rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.9, delay: delay + 0.1, ease: [0.22, 1, 0.36, 1] }}
            style={{ background: `linear-gradient(90deg, #818cf8, #a78bfa)` }}
          />
        </div>
      </button>

      <AnimatePresence>
        {expanded && insight.examples && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <div className="mt-2 space-y-1.5 pl-3 border-l" style={{ borderColor: "rgba(129,140,248,0.25)" }}>
              {insight.examples.map((ex, i) => (
                <div key={i} className="text-xs italic" style={{ color: "#7878a0" }}>
                  „{ex}"
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default function Mirror({ data }: { data: MIData }) {
  const max = Math.max(...data.insights.map((i) => i.count), 1);

  return (
    <div className="space-y-5">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="flex items-start gap-3"
      >
        <div
          className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
          style={{ background: "rgba(167,139,250,0.12)", border: "1px solid rgba(167,139,250,0.25)" }}
        >
          <TrendingUp size={15} style={{ color: "#a78bfa" }} />
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-[0.3em]" style={{ color: "#6b6b8a" }}>Spiegel</div>
          <div className="mt-0.5 text-sm font-medium" style={{ color: "#e8e8f0" }}>Muster der letzten Tage</div>
        </div>
      </motion.div>

      {/* Horizontal timeline of patterns */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1, duration: 0.5 }}
        className="relative overflow-x-auto pb-1"
      >
        {/* Timeline track */}
        <div className="flex items-center gap-0 min-w-max">
          {data.insights.map((ins, i) => {
            const intensity = ins.count / max;
            const size = 8 + intensity * 10;
            return (
              <div key={i} className="flex items-center">
                <div className="flex flex-col items-center px-3 py-2">
                  <div className="text-[9px] mb-1.5 text-center max-w-[80px] leading-snug"
                    style={{ color: "#9494b0" }}>
                    {ins.pattern.length > 20 ? ins.pattern.slice(0, 18) + "…" : ins.pattern}
                  </div>
                  <div
                    className="rounded-full"
                    style={{
                      width: size,
                      height: size,
                      background: `rgba(129,140,248,${0.3 + intensity * 0.6})`,
                      border: "1px solid rgba(129,140,248,0.5)",
                      boxShadow: `0 0 ${size}px rgba(129,140,248,${intensity * 0.4})`,
                    }}
                  />
                  <div className="text-[9px] mt-1.5" style={{ color: "#6b6b8a" }}>{ins.count}×</div>
                </div>
                {i < data.insights.length - 1 && (
                  <div className="h-px w-8 shrink-0" style={{ background: "rgba(255,255,255,0.08)" }} />
                )}
              </div>
            );
          })}
        </div>
      </motion.div>

      {/* Bar breakdown */}
      <div
        className="rounded-xl p-4 space-y-4"
        style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.07)" }}
      >
        <div className="text-[10px] uppercase tracking-[0.25em]" style={{ color: "#6b6b8a" }}>Häufigkeit</div>
        {data.insights.map((ins, i) => (
          <PatternBar key={i} insight={ins} max={max} delay={0.2 + i * 0.09} />
        ))}
      </div>
    </div>
  );
}
