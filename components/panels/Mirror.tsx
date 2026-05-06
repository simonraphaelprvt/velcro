"use client";

import { motion } from "framer-motion";
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

function PatternBar({ insight, max, delay }: { insight: MIInsight; max: number; delay: number }) {
  const pct = (insight.count / max) * 100;

  return (
    <motion.div
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.4, delay, ease: [0.22, 1, 0.36, 1] }}
      className="space-y-1"
    >
      <div className="flex items-center justify-between">
        <span className="text-xs" style={{ color: "#c8c8e0" }}>{insight.pattern}</span>
        <span
          className="rounded-full px-2 py-0.5 text-[10px] font-medium tabular-nums"
          style={{ background: "rgba(129,140,248,0.15)", color: "#818cf8" }}
        >
          {insight.count}×
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full" style={{ background: "rgba(255,255,255,0.06)" }}>
        <motion.div
          className="h-full rounded-full"
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.9, delay: delay + 0.1, ease: [0.22, 1, 0.36, 1] }}
          style={{ background: "linear-gradient(90deg, #818cf8, #a78bfa)" }}
        />
      </div>
      {/* Examples always visible — max 2, no expand needed (hands-free) */}
      {insight.examples && insight.examples.length > 0 && (
        <div className="pl-2 border-l space-y-0.5" style={{ borderColor: "rgba(129,140,248,0.20)" }}>
          {insight.examples.slice(0, 2).map((ex, i) => (
            <div key={i} className="text-[10px] italic" style={{ color: "#7878a0" }}>„{ex}"</div>
          ))}
        </div>
      )}
    </motion.div>
  );
}

export default function Mirror({ data }: { data: MIData }) {
  const max = Math.max(...data.insights.map((i) => i.count), 1);

  return (
    <div className="space-y-3">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="flex items-start gap-3"
      >
        <div
          className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
          style={{ background: "rgba(167,139,250,0.12)", border: "1px solid rgba(167,139,250,0.25)" }}
        >
          <TrendingUp size={13} style={{ color: "#a78bfa" }} />
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-[0.3em]" style={{ color: "#6b6b8a" }}>Spiegel</div>
          <div className="mt-0.5 text-xs font-medium" style={{ color: "#e8e8f0" }}>{data.summary}</div>
        </div>
      </motion.div>

      {/* Bubble timeline */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1, duration: 0.5 }}
        className="flex items-center gap-0"
      >
        {data.insights.map((ins, i) => {
          const intensity = ins.count / max;
          const size = 7 + intensity * 9;
          return (
            <div key={i} className="flex items-center">
              <div className="flex flex-col items-center px-2 py-1">
                <div className="text-[8px] mb-1 text-center max-w-[70px] leading-none"
                  style={{ color: "#9494b0" }}>
                  {ins.pattern.length > 16 ? ins.pattern.slice(0, 14) + "…" : ins.pattern}
                </div>
                <div
                  className="rounded-full"
                  style={{
                    width: size, height: size,
                    background: `rgba(129,140,248,${0.3 + intensity * 0.6})`,
                    border: "1px solid rgba(129,140,248,0.5)",
                  }}
                />
                <div className="text-[8px] mt-1" style={{ color: "#6b6b8a" }}>{ins.count}×</div>
              </div>
              {i < data.insights.length - 1 && (
                <div className="h-px w-6 shrink-0" style={{ background: "rgba(255,255,255,0.08)" }} />
              )}
            </div>
          );
        })}
      </motion.div>

      {/* Bars */}
      <div
        className="rounded-xl p-3 space-y-3"
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
