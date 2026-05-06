"use client";

import { motion } from "framer-motion";

export interface MBDay {
  date:  string;
  mood:  string;
  note?: string;
}
export interface MBData {
  range: string;
  days:  MBDay[];
}

const MOOD_MAP: { keys: string[]; color: string; emoji: string; label: string }[] = [
  { keys: ["gut", "posit", "super", "toll"],              color: "#34d399", emoji: "✨", label: "Gut"        },
  { keys: ["neutral", "okay", "ok"],                      color: "#818cf8", emoji: "○",  label: "Neutral"    },
  { keys: ["angespannt", "stress", "druck"],              color: "#fb923c", emoji: "⚡", label: "Angespannt" },
  { keys: ["schlecht", "negat", "müde", "erschöpft"],     color: "#f87171", emoji: "↓",  label: "Schlecht"   },
  { keys: ["—", "-"],                                     color: "#2a2a3e", emoji: "·",  label: "—"          },
];

function resolveMood(mood: string) {
  const lower = mood.toLowerCase();
  for (const m of MOOD_MAP) {
    if (m.keys.some((k) => lower.includes(k))) return m;
  }
  return { color: "#a78bfa", emoji: "·", label: mood };
}

// Trend line using SVG
function TrendLine({ days }: { days: MBDay[] }) {
  const moodScore = (mood: string) => {
    const m = resolveMood(mood);
    if (m.color === "#34d399") return 4;
    if (m.color === "#818cf8") return 3;
    if (m.color === "#fb923c") return 2;
    if (m.color === "#f87171") return 1;
    return 0;
  };
  const scores = days.map((d) => moodScore(d.mood));
  const W = 100, H = 32;
  if (scores.length < 2) return null;
  const step = W / (scores.length - 1);
  const points = scores.map((s, i) => `${i * step},${H - (s / 4) * H}`).join(" ");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ width: "100%", height: 32 }}>
      <polyline
        points={points}
        fill="none"
        stroke="url(#trendGrad)"
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <defs>
        <linearGradient id="trendGrad" x1="0" y1="0" x2="100%" y2="0">
          <stop offset="0%" stopColor="#818cf8" />
          <stop offset="100%" stopColor="#34d399" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export default function MoodBoard({ data }: { data: MBData }) {
  const notedDays = data.days.filter((d) => d.note);

  return (
    <div className="space-y-5">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
      >
        <div className="text-[10px] uppercase tracking-[0.3em]" style={{ color: "#6b6b8a" }}>Stimmungs-Verlauf</div>
        <div className="mt-1 text-base font-medium" style={{ color: "#e8e8f0" }}>{data.range}</div>
      </motion.div>

      {/* Trend sparkline */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.15 }}
        className="overflow-hidden rounded-lg px-2 py-2"
        style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
      >
        <TrendLine days={data.days} />
      </motion.div>

      {/* Day grid */}
      <motion.div
        className="grid gap-2"
        style={{ gridTemplateColumns: `repeat(${Math.min(data.days.length, 7)}, 1fr)` }}
        initial="hidden"
        animate="show"
        variants={{ hidden: {}, show: { transition: { staggerChildren: 0.06 } } }}
      >
        {data.days.map((day, i) => {
          const m = resolveMood(day.mood);
          return (
            <motion.div
              key={i}
              variants={{ hidden: { opacity: 0, scale: 0.8 }, show: { opacity: 1, scale: 1, transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] } } }}
              className="flex flex-col items-center gap-1"
            >
              <div className="text-[9px]" style={{ color: "#6b6b8a" }}>{day.date}</div>
              <div
                className="flex h-10 w-full items-center justify-center rounded-lg text-base"
                style={{
                  background: `${m.color}18`,
                  border: `1px solid ${m.color}40`,
                }}
              >
                {m.emoji}
              </div>
              <div className="text-[9px] text-center leading-none" style={{ color: m.color }}>
                {m.label}
              </div>
            </motion.div>
          );
        })}
      </motion.div>

      {/* Notes */}
      {notedDays.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 + data.days.length * 0.06 + 0.1 }}
          className="space-y-2"
        >
          <div className="text-[10px] uppercase tracking-[0.25em]" style={{ color: "#6b6b8a" }}>Notizen</div>
          {notedDays.map((d, i) => {
            const m = resolveMood(d.mood);
            return (
              <div
                key={i}
                className="flex items-start gap-2.5 rounded-lg p-2.5"
                style={{ background: `${m.color}0a`, border: `1px solid ${m.color}25` }}
              >
                <div className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: m.color }} />
                <div>
                  <span className="text-[10px]" style={{ color: m.color }}>{d.date} · </span>
                  <span className="text-xs" style={{ color: "#c8c8e0" }}>{d.note}</span>
                </div>
              </div>
            );
          })}
        </motion.div>
      )}
    </div>
  );
}
