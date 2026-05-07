"use client";

import { motion } from "framer-motion";

export interface MMBranch {
  label:   string;
  leaves?: string[];
}
export interface MMData {
  central:  string;
  branches: MMBranch[];
}

// Compute positions for branches around a circle. Returns { x, y } offsets in px relative to center.
function branchPosition(i: number, total: number, radius: number) {
  // Start at top, go clockwise. Add slight angular offset so 3-branch case isn't strictly triangular.
  const angle = (i / total) * Math.PI * 2 - Math.PI / 2;
  return {
    x: Math.cos(angle) * radius,
    y: Math.sin(angle) * radius,
    angle,
  };
}

export default function Mindmap({ data }: { data: MMData }) {
  const total = data.branches.length;
  // Container size — fits within content window
  const W = 760, H = 420;
  const cx = W / 2, cy = H / 2;
  const branchRadius = Math.min(W, H) * 0.34;
  const leafRadius   = 86;

  // Pre-compute all positions
  const branches = data.branches.map((b, i) => {
    const p = branchPosition(i, total, branchRadius);
    return { ...b, x: cx + p.x, y: cy + p.y, angle: p.angle };
  });

  return (
    <div className="space-y-2">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
      >
        <div className="text-[10px] uppercase tracking-[0.3em]" style={{ color: "#6b6b8a" }}>Mindmap</div>
      </motion.div>

      <div className="relative" style={{ width: "100%", maxWidth: W, height: H, margin: "0 auto" }}>
        <svg
          viewBox={`0 0 ${W} ${H}`}
          width="100%"
          height="100%"
          style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
        >
          <defs>
            <radialGradient id="mm-center-glow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="rgba(129,140,248,0.35)" />
              <stop offset="100%" stopColor="rgba(129,140,248,0)" />
            </radialGradient>
          </defs>

          {/* Glow under central node */}
          <circle cx={cx} cy={cy} r={70} fill="url(#mm-center-glow)" />

          {/* Branch lines from center to each branch */}
          {branches.map((b, i) => (
            <motion.line
              key={`bl-${i}`}
              x1={cx}
              y1={cy}
              x2={b.x}
              y2={b.y}
              stroke="rgba(167,139,250,0.35)"
              strokeWidth="1"
              strokeLinecap="round"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.4 + i * 0.1, ease: [0.22, 1, 0.36, 1] }}
            />
          ))}

          {/* Leaf lines from each branch */}
          {branches.flatMap((b, i) =>
            (b.leaves ?? []).slice(0, 3).map((_, li) => {
              const leafCount = Math.min(b.leaves?.length ?? 0, 3);
              // Spread leaves in an arc around the branch direction
              const arcSpread = leafCount === 1 ? 0 : leafCount === 2 ? 0.55 : 0.9;
              const leafAngle = b.angle + (li - (leafCount - 1) / 2) * (arcSpread / Math.max(leafCount - 1, 1));
              const lx = b.x + Math.cos(leafAngle) * leafRadius;
              const ly = b.y + Math.sin(leafAngle) * leafRadius;
              return (
                <motion.line
                  key={`ll-${i}-${li}`}
                  x1={b.x}
                  y1={b.y}
                  x2={lx}
                  y2={ly}
                  stroke="rgba(255,255,255,0.10)"
                  strokeWidth="0.8"
                  initial={{ pathLength: 0, opacity: 0 }}
                  animate={{ pathLength: 1, opacity: 1 }}
                  transition={{ duration: 0.45, delay: 0.7 + i * 0.1 + li * 0.05 }}
                />
              );
            })
          )}
        </svg>

        {/* Central node */}
        <motion.div
          className="absolute"
          style={{ left: cx, top: cy, transform: "translate(-50%, -50%)" }}
          initial={{ opacity: 0, scale: 0.6 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
        >
          <div
            className="rounded-2xl px-4 py-2.5 text-center"
            style={{
              background: "linear-gradient(135deg, rgba(129,140,248,0.20), rgba(167,139,250,0.10))",
              border:     "1px solid rgba(129,140,248,0.40)",
              boxShadow:  "0 0 24px rgba(129,140,248,0.20)",
              minWidth:   100,
              maxWidth:   180,
            }}
          >
            <div className="text-sm font-semibold leading-tight" style={{ color: "#e8e8f0" }}>
              {data.central}
            </div>
          </div>
        </motion.div>

        {/* Branch nodes + leaves */}
        {branches.map((b, i) => {
          const leafCount = Math.min(b.leaves?.length ?? 0, 3);
          const arcSpread = leafCount === 1 ? 0 : leafCount === 2 ? 0.55 : 0.9;
          return (
            <div key={`b-${i}`}>
              {/* Branch node */}
              <motion.div
                className="absolute"
                style={{ left: b.x, top: b.y, transform: "translate(-50%, -50%)" }}
                initial={{ opacity: 0, scale: 0.6 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.4, delay: 0.35 + i * 0.1, ease: [0.22, 1, 0.36, 1] }}
              >
                <div
                  className="rounded-xl px-3 py-1.5 text-center whitespace-nowrap"
                  style={{
                    background: "rgba(167,139,250,0.10)",
                    border:     "1px solid rgba(167,139,250,0.30)",
                    maxWidth:   130,
                  }}
                >
                  <div className="text-xs font-medium" style={{ color: "#c4b5fd" }}>{b.label}</div>
                </div>
              </motion.div>

              {/* Leaf nodes */}
              {(b.leaves ?? []).slice(0, 3).map((leaf, li) => {
                const leafAngle = b.angle + (li - (leafCount - 1) / 2) * (arcSpread / Math.max(leafCount - 1, 1));
                const lx = b.x + Math.cos(leafAngle) * leafRadius;
                const ly = b.y + Math.sin(leafAngle) * leafRadius;
                return (
                  <motion.div
                    key={`l-${i}-${li}`}
                    className="absolute"
                    style={{ left: lx, top: ly, transform: "translate(-50%, -50%)" }}
                    initial={{ opacity: 0, scale: 0.5 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.35, delay: 0.65 + i * 0.1 + li * 0.06 }}
                  >
                    <div
                      className="rounded-lg px-2 py-0.5 text-center whitespace-nowrap"
                      style={{
                        background: "rgba(255,255,255,0.04)",
                        border:     "1px solid rgba(255,255,255,0.08)",
                        maxWidth:   110,
                      }}
                    >
                      <div className="text-[10px]" style={{ color: "#9494b0" }}>{leaf}</div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
