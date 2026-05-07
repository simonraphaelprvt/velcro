"use client";

import { motion, type Variants } from "framer-motion";
import { Check, Circle, Clock } from "lucide-react";

export interface TLStep {
  label:       string;
  descriptor?: string;
  status?:     "done" | "current" | "future";
}
export interface TLData {
  title: string;
  steps: TLStep[];
}

const STATUS_STYLE = {
  done:    { color: "#34d399", bg: "rgba(52,211,153,0.12)",  border: "rgba(52,211,153,0.35)",  Icon: Check },
  current: { color: "#818cf8", bg: "rgba(129,140,248,0.18)", border: "rgba(129,140,248,0.50)", Icon: Clock },
  future:  { color: "#7878a0", bg: "rgba(255,255,255,0.04)", border: "rgba(255,255,255,0.10)", Icon: Circle },
};

const STAGGER: Variants = { hidden: {}, show: { transition: { staggerChildren: 0.12 } } };
const STEP: Variants = {
  hidden: { opacity: 0, y: 12 },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  show:   { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] as any } },
};

export default function Timeline({ data }: { data: TLData }) {
  const total = data.steps.length;
  // Auto-detect current step if not explicitly set
  const explicitCurrent = data.steps.findIndex((s) => s.status === "current");
  const lastDone        = (() => {
    for (let i = data.steps.length - 1; i >= 0; i--) {
      if (data.steps[i].status === "done") return i;
    }
    return -1;
  })();
  const inferredCurrent = explicitCurrent >= 0 ? explicitCurrent : lastDone + 1;

  return (
    <motion.div className="space-y-4" variants={STAGGER} initial="hidden" animate="show">
      {/* Header */}
      <motion.div variants={STEP}>
        <div className="text-[10px] uppercase tracking-[0.3em]" style={{ color: "#6b6b8a" }}>Ablauf</div>
        <div className="mt-1 text-sm font-medium" style={{ color: "#e8e8f0" }}>{data.title}</div>
      </motion.div>

      {/* Horizontal timeline */}
      <motion.div variants={STEP} className="relative pt-2">
        {/* Background track */}
        <div
          className="absolute left-0 right-0 top-[18px] h-px"
          style={{ background: "rgba(255,255,255,0.08)" }}
        />
        {/* Animated progress fill up to current step */}
        {inferredCurrent > 0 && total > 1 && (
          <motion.div
            className="absolute left-0 top-[18px] h-px"
            style={{
              background: "linear-gradient(90deg, rgba(52,211,153,0.6), rgba(129,140,248,0.6))",
              transformOrigin: "left",
            }}
            initial={{ scaleX: 0, width: `${(inferredCurrent / (total - 1)) * 100}%` }}
            animate={{ scaleX: 1 }}
            transition={{ duration: 0.9, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
          />
        )}

        <div
          className="grid gap-2 relative"
          style={{ gridTemplateColumns: `repeat(${total}, minmax(0, 1fr))` }}
        >
          {data.steps.map((step, i) => {
            const status =
              step.status ??
              (i < inferredCurrent ? "done" : i === inferredCurrent ? "current" : "future");
            const s     = STATUS_STYLE[status];
            const Icon  = s.Icon;
            return (
              <motion.div
                key={i}
                variants={STEP}
                className="flex flex-col items-center text-center"
              >
                {/* Dot */}
                <motion.div
                  className="flex h-9 w-9 items-center justify-center rounded-full"
                  style={{
                    background: s.bg,
                    border: `1px solid ${s.border}`,
                    boxShadow: status === "current" ? `0 0 16px ${s.color}55` : "none",
                  }}
                  animate={status === "current" ? {
                    scale: [1, 1.08, 1],
                  } : { scale: 1 }}
                  transition={status === "current" ? {
                    duration: 2.2, repeat: Infinity, ease: "easeInOut",
                  } : undefined}
                >
                  <Icon size={13} style={{ color: s.color }} strokeWidth={status === "current" ? 2.5 : 2} />
                </motion.div>

                {/* Step number */}
                <div className="mt-1 text-[8px] font-mono tabular-nums" style={{ color: "#6b6b8a" }}>
                  {String(i + 1).padStart(2, "0")}
                </div>

                {/* Label */}
                <div
                  className="mt-1 text-xs font-medium leading-snug"
                  style={{ color: status === "future" ? "#7878a0" : "#e8e8f0" }}
                >
                  {step.label}
                </div>

                {/* Descriptor */}
                {step.descriptor && (
                  <div className="mt-0.5 text-[10px] leading-snug" style={{ color: "#7878a0" }}>
                    {step.descriptor}
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      </motion.div>
    </motion.div>
  );
}
