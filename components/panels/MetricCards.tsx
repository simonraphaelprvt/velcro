"use client";

import { useEffect, useState } from "react";
import { motion, type Variants } from "framer-motion";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

export interface MCMetric {
  label:     string;
  value:     string;             // raw display value, e.g. "127", "4.5k", "€1.2M"
  unit?:     string;
  sentiment?: "positive" | "neutral" | "negative";
  change?:   string;             // e.g. "+12%", "-3"
}
export interface MCData {
  title?:  string;
  metrics: MCMetric[];
}

const SENTIMENT_STYLE: Record<string, { color: string; bg: string; border: string; iconColor: string }> = {
  positive: { color: "#34d399", bg: "rgba(52,211,153,0.08)",  border: "rgba(52,211,153,0.25)", iconColor: "#34d399" },
  neutral:  { color: "#fbbf24", bg: "rgba(251,191,36,0.06)",  border: "rgba(251,191,36,0.20)", iconColor: "#fbbf24" },
  negative: { color: "#f87171", bg: "rgba(248,113,113,0.08)", border: "rgba(248,113,113,0.25)", iconColor: "#f87171" },
};
const DEFAULT_STYLE = { color: "#e8e8f0", bg: "rgba(255,255,255,0.03)", border: "rgba(255,255,255,0.07)", iconColor: "#818cf8" };

const STAGGER: Variants = { hidden: {}, show: { transition: { staggerChildren: 0.08 } } };
const SLIDE: Variants = {
  hidden: { opacity: 0, y: 10 },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  show:   { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] as any } },
};

// Try to extract a leading number from a value string for the count-up animation.
// Returns { number, prefix, suffix } so we can animate the digit part only.
function parseValueForCountUp(raw: string): { num: number | null; prefix: string; suffix: string } {
  const m = raw.match(/^([^\d.,-]*)([\d.,-]+)([a-zA-ZäöüÄÖÜß%€$£¥]*)?$/);
  if (!m) return { num: null, prefix: "", suffix: raw };
  const numStr = m[2].replace(/\./g, "").replace(/,/g, ".");
  const n = parseFloat(numStr);
  if (isNaN(n)) return { num: null, prefix: "", suffix: raw };
  return { num: n, prefix: m[1] ?? "", suffix: m[3] ?? "" };
}

function formatNumber(n: number, original: string): string {
  // Heuristic: if original had no decimals, render integer; else preserve 1 decimal.
  const hasDecimal = /[.,]\d/.test(original);
  if (!hasDecimal) return Math.round(n).toLocaleString("de-DE");
  return n.toLocaleString("de-DE", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

function CountUpValue({ raw }: { raw: string }) {
  const parsed = parseValueForCountUp(raw);
  const [v, setV] = useState(0);

  useEffect(() => {
    if (parsed.num === null) return;
    const target = parsed.num;
    const duration = 1100;
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setV(target * eased);
      if (p < 1) requestAnimationFrame(tick);
    };
    const id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, [parsed.num]);

  if (parsed.num === null) return <>{raw}</>;
  return <>{parsed.prefix}{formatNumber(v, raw)}{parsed.suffix}</>;
}

function ChangeChip({ change, sentiment }: { change: string; sentiment?: string }) {
  const isPositive = change.trim().startsWith("+");
  const isNegative = change.trim().startsWith("-");
  const color = sentiment === "positive" || isPositive ? "#34d399"
              : sentiment === "negative" || isNegative ? "#f87171"
              : "#fbbf24";
  const Icon  = isPositive ? TrendingUp : isNegative ? TrendingDown : Minus;
  return (
    <div className="mt-1 flex items-center gap-1">
      <Icon size={11} style={{ color }} />
      <span className="text-[10px] font-medium tabular-nums" style={{ color }}>{change}</span>
    </div>
  );
}

export default function MetricCards({ data }: { data: MCData }) {
  const cols = Math.min(Math.max(data.metrics.length, 2), 4);

  return (
    <motion.div className="space-y-3" variants={STAGGER} initial="hidden" animate="show">
      {data.title && (
        <motion.div variants={SLIDE}>
          <div className="text-[10px] uppercase tracking-[0.3em]" style={{ color: "#6b6b8a" }}>Kennzahlen</div>
          <div className="mt-1 text-sm font-medium" style={{ color: "#e8e8f0" }}>{data.title}</div>
        </motion.div>
      )}

      <motion.div
        variants={SLIDE}
        className="grid gap-3"
        style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
      >
        {data.metrics.map((m, i) => {
          const style = m.sentiment ? SENTIMENT_STYLE[m.sentiment] ?? DEFAULT_STYLE : DEFAULT_STYLE;
          return (
            <motion.div
              key={i}
              variants={SLIDE}
              className="rounded-xl p-4"
              style={{ background: style.bg, border: `1px solid ${style.border}` }}
            >
              <div className="text-[10px] uppercase tracking-wider" style={{ color: "#7878a0" }}>
                {m.label}
              </div>
              <div className="mt-1.5 flex items-baseline gap-1">
                <span className="text-2xl font-bold tabular-nums leading-none" style={{ color: style.color }}>
                  <CountUpValue raw={m.value} />
                </span>
                {m.unit && (
                  <span className="text-xs font-medium" style={{ color: style.color, opacity: 0.7 }}>
                    {m.unit}
                  </span>
                )}
              </div>
              {m.change && <ChangeChip change={m.change} sentiment={m.sentiment} />}
            </motion.div>
          );
        })}
      </motion.div>
    </motion.div>
  );
}
