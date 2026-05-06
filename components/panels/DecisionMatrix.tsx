"use client";

import { useEffect, useState } from "react";
import { motion, type Variants } from "framer-motion";
import { CheckCircle } from "lucide-react";

export interface DMData {
  question:       string;
  options:        string[];
  factors:        { name: string; weight: number; scores: number[] }[];
  recommendation: string;
}

const STAGGER: Variants = { hidden: {}, show: { transition: { staggerChildren: 0.09 } } };
const SLIDE:   Variants = {
  hidden: { opacity: 0, y: 16 },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  show:   { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] as any } },
};

// Animated number counter via requestAnimationFrame
function Counter({ target, duration = 1100 }: { target: number; duration?: number }) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    const start  = performance.now();
    const tick   = (now: number) => {
      const p = Math.min((now - start) / duration, 1);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - p, 3);
      setValue(target * eased);
      if (p < 1) requestAnimationFrame(tick);
    };
    const raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return <span>{value.toFixed(1)}</span>;
}

// Animated bar
function Bar({ pct, color, delay }: { pct: number; color: string; delay: number }) {
  return (
    <div className="h-1.5 overflow-hidden rounded-full" style={{ background: "rgba(255,255,255,0.06)" }}>
      <motion.div
        className="h-full rounded-full"
        initial={{ width: 0 }}
        animate={{ width: `${pct}%` }}
        transition={{ duration: 0.8, delay, ease: [0.22, 1, 0.36, 1] }}
        style={{ background: color }}
      />
    </div>
  );
}

export default function DecisionMatrix({ data }: { data: DMData }) {
  const totals = data.options.map((_, oi) =>
    data.factors.reduce((sum, f) => sum + (f.scores[oi] ?? 0) * f.weight, 0)
  );
  const max       = Math.max(...totals, 1);
  const winnerIdx = totals.indexOf(Math.max(...totals));
  const loserIdx  = totals.indexOf(Math.min(...totals));

  const OPTION_COLORS = ["#818cf8", "#a78bfa", "#60a5fa", "#34d399"];

  return (
    <motion.div
      className="space-y-4"
      variants={STAGGER}
      initial="hidden"
      animate="show"
    >
      {/* Header */}
      <motion.div variants={SLIDE}>
        <div className="text-[10px] uppercase tracking-[0.3em]" style={{ color: "#6b6b8a" }}>Entscheidungs-Matrix</div>
        <div className="mt-1.5 text-base font-medium" style={{ color: "#e8e8f0" }}>{data.question}</div>
      </motion.div>

      {/* Score cards — side by side */}
      <motion.div variants={SLIDE} className="grid gap-3" style={{ gridTemplateColumns: `repeat(${data.options.length}, 1fr)` }}>
        {data.options.map((opt, i) => {
          const isWinner = i === winnerIdx;
          const pct = (totals[i] / max) * 100;
          const color = OPTION_COLORS[i % OPTION_COLORS.length];
          return (
            <div
              key={i}
              className="relative rounded-xl p-3"
              style={{
                background: isWinner
                  ? `linear-gradient(135deg, ${color}18, ${color}08)`
                  : "rgba(255,255,255,0.03)",
                border: isWinner
                  ? `1px solid ${color}50`
                  : "1px solid rgba(255,255,255,0.07)",
              }}
            >
              {isWinner && (
                <div
                  className="absolute -top-2.5 left-1/2 -translate-x-1/2 rounded-full px-2 py-0.5 text-[9px] font-medium uppercase tracking-wider"
                  style={{ background: color, color: "#0d0d12" }}
                >
                  Favorit
                </div>
              )}
              <div className="text-xs font-medium mb-3 truncate" style={{ color: isWinner ? color : "#9494b0" }}>
                {opt}
              </div>
              <div className="text-2xl font-bold tabular-nums" style={{ color: isWinner ? color : "#e8e8f0" }}>
                <Counter target={totals[i]} />
              </div>
              <div className="mt-2">
                <Bar pct={pct} color={color} delay={0.3 + i * 0.1} />
              </div>
            </div>
          );
        })}
      </motion.div>

      {/* Factor breakdown */}
      <motion.div variants={SLIDE} className="space-y-1">
        <div className="mb-3 text-[10px] uppercase tracking-[0.25em]" style={{ color: "#6b6b8a" }}>Faktoren</div>
        {data.factors.map((f, fi) => (
          <div key={fi} className="rounded-lg px-2.5 py-1.5" style={{ background: "rgba(255,255,255,0.03)" }}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs" style={{ color: "#c8c8e0" }}>{f.name}</span>
              <span
                className="rounded px-1.5 py-0.5 text-[9px] font-mono font-medium"
                style={{ background: "rgba(129,140,248,0.15)", color: "#818cf8" }}
              >
                ×{f.weight}
              </span>
            </div>
            {/* Per-option bars */}
            <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${data.options.length}, 1fr)` }}>
              {f.scores.map((score, si) => {
                const color = OPTION_COLORS[si % OPTION_COLORS.length];
                const pct = (score / 10) * 100;
                return (
                  <div key={si}>
                    <div className="mb-1 flex justify-between">
                      <span className="text-[9px] truncate" style={{ color: "#6b6b8a" }}>
                        {data.options[si]?.slice(0, 8)}
                      </span>
                      <span className="text-[9px] font-mono" style={{ color }}>
                        {score}
                      </span>
                    </div>
                    <Bar pct={pct} color={color} delay={0.5 + fi * 0.05 + si * 0.03} />
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </motion.div>

      {/* Verdict */}
      <motion.div
        variants={SLIDE}
        className="flex items-center gap-3 rounded-xl p-3"
        style={{ background: "rgba(52,211,153,0.08)", border: "1px solid rgba(52,211,153,0.25)" }}
      >
        <CheckCircle size={18} style={{ color: "#34d399", flexShrink: 0 }} />
        <div>
          <div className="text-[10px] uppercase tracking-widest mb-0.5" style={{ color: "#34d399" }}>Empfehlung</div>
          <div className="text-sm font-medium" style={{ color: "#e8e8f0" }}>
            {data.options[winnerIdx]}
            {loserIdx !== winnerIdx && (
              <span style={{ color: "#6b6b8a" }}> · {data.options[loserIdx]} abgelehnt</span>
            )}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
