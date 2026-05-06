"use client";

import { motion } from "framer-motion";

export interface STBranch {
  condition:    string;
  probability?: number;   // 0–100
  consequences: string[];
  outcome?:     "positive" | "negative" | "neutral";
  next?:        STBranch[];
}
export interface STData {
  question: string;
  branches: STBranch[];
}

const OUTCOME_STYLES = {
  positive: { bg: "rgba(52,211,153,0.10)", border: "rgba(52,211,153,0.30)", text: "#34d399" },
  negative: { bg: "rgba(248,113,113,0.10)", border: "rgba(248,113,113,0.30)", text: "#f87171" },
  neutral:  { bg: "rgba(148,163,184,0.08)", border: "rgba(148,163,184,0.20)", text: "#94a3b8" },
};

function BranchNode({ branch, depth, index, totalSiblings }: {
  branch: STBranch;
  depth: number;
  index: number;
  totalSiblings: number;
}) {
  const delay    = depth * 0.15 + index * 0.1;
  const hasKids  = branch.next && branch.next.length > 0;
  const outcome  = branch.outcome ?? "neutral";
  const style    = OUTCOME_STYLES[outcome];

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay, ease: [0.22, 1, 0.36, 1] }}
      className="flex flex-col items-center"
    >
      {/* Connector line from parent */}
      {depth > 0 && (
        <motion.div
          className="w-px"
          style={{ background: "rgba(255,255,255,0.12)", height: 24 }}
          initial={{ scaleY: 0, originY: 0 }}
          animate={{ scaleY: 1 }}
          transition={{ duration: 0.3, delay: delay - 0.05 }}
        />
      )}

      {/* Node card */}
      <div
        className="w-full rounded-xl px-3.5 py-3"
        style={{
          background: style.bg,
          border: `1px solid ${style.border}`,
          maxWidth: depth === 0 ? "100%" : "90%",
        }}
      >
        <div className="flex items-start justify-between gap-2">
          <span className="text-sm font-medium leading-snug" style={{ color: "#e8e8f0" }}>
            {branch.condition}
          </span>
          {branch.probability != null && (
            <span
              className="shrink-0 rounded-full px-2 py-0.5 text-[9px] font-medium tabular-nums"
              style={{ background: "rgba(255,255,255,0.08)", color: style.text, border: `1px solid ${style.border}` }}
            >
              {branch.probability}%
            </span>
          )}
        </div>
        {branch.consequences.length > 0 && (
          <ul className="mt-2 space-y-0.5">
            {branch.consequences.map((c, i) => (
              <li key={i} className="flex items-start gap-1.5 text-xs" style={{ color: "#7878a0" }}>
                <span style={{ color: style.text, marginTop: 2 }}>›</span>
                {c}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Children */}
      {hasKids && (
        <>
          <motion.div
            className="w-px"
            style={{ background: "rgba(255,255,255,0.12)", height: 20 }}
            initial={{ scaleY: 0, originY: 0 }}
            animate={{ scaleY: 1 }}
            transition={{ duration: 0.3, delay: delay + 0.1 }}
          />
          <div
            className="flex w-full gap-3"
            style={{ justifyContent: branch.next!.length === 1 ? "center" : "space-between" }}
          >
            {branch.next!.map((child, ci) => (
              <div key={ci} className="flex-1">
                <BranchNode
                  branch={child}
                  depth={depth + 1}
                  index={ci}
                  totalSiblings={branch.next!.length}
                />
              </div>
            ))}
          </div>
        </>
      )}
    </motion.div>
  );
}

export default function ScenarioTree({ data }: { data: STData }) {
  return (
    <div className="space-y-5">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <div className="text-[10px] uppercase tracking-[0.3em]" style={{ color: "#6b6b8a" }}>Szenario-Simulator</div>
        <div
          className="mt-2 inline-block rounded-lg px-3.5 py-2 text-sm font-medium"
          style={{ background: "rgba(129,140,248,0.12)", border: "1px solid rgba(129,140,248,0.25)", color: "#c4b5fd" }}
        >
          {data.question}
        </div>
      </motion.div>

      {/* Tree */}
      <div className="space-y-0">
        {data.branches.map((branch, i) => (
          <div key={i} className={i > 0 ? "mt-4" : ""}>
            <BranchNode
              branch={branch}
              depth={0}
              index={i}
              totalSiblings={data.branches.length}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
