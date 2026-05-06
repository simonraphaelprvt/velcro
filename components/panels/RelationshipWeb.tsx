"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";

export interface RWNode {
  name:         string;
  role?:        string;
  group?:       "person" | "deal" | "project" | "date";
  lastContact?: string;
  mentionCount?: number;
}
export interface RWData {
  center: string;
  nodes:  RWNode[];
}

const GROUP_COLOR: Record<string, string> = {
  person:  "#60a5fa",
  deal:    "#34d399",
  project: "#a78bfa",
  date:    "#fbbf24",
};
const DEFAULT_COLOR = "#818cf8";

interface SimNode extends RWNode {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  color: string;
}

function groupColor(n: RWNode) {
  return n.group ? (GROUP_COLOR[n.group] ?? DEFAULT_COLOR) : DEFAULT_COLOR;
}

export default function RelationshipWeb({ data }: { data: RWData }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hoveredNode, setHoveredNode] = useState<SimNode | null>(null);
  const hoverRef = useRef<SimNode | null>(null);
  const nodesRef = useRef<SimNode[]>([]);
  const rafRef   = useRef<number>(0);
  const sizeRef  = useRef({ w: 600, h: 320 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const CX = canvas.offsetWidth / 2;
    const CY = canvas.offsetHeight / 2;
    sizeRef.current = { w: canvas.offsetWidth, h: canvas.offsetHeight };

    canvas.width  = canvas.offsetWidth  * window.devicePixelRatio;
    canvas.height = canvas.offsetHeight * window.devicePixelRatio;
    const ctx = canvas.getContext("2d")!;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

    // Build node list
    const periphery: SimNode[] = data.nodes.slice(0, 14).map((n, i) => {
      const angle = (i / Math.min(data.nodes.length, 14)) * Math.PI * 2;
      const dist  = 95 + Math.random() * 55;
      const r     = 7 + Math.min((n.mentionCount ?? 1) * 1.5, 12);
      return {
        ...n,
        x: CX + Math.cos(angle) * dist,
        y: CY + Math.sin(angle) * dist,
        vx: 0, vy: 0,
        r, color: groupColor(n),
      };
    });
    nodesRef.current = periphery;

    // Simple spring simulation
    const tick = () => {
      const nodes = nodesRef.current;
      const { w, h } = sizeRef.current;
      const cx = w / 2, cy = h / 2;

      for (const n of nodes) {
        // Spring toward orbit position (not rigid — just gentle pull)
        const dx = cx - n.x, dy = cy - n.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const targetDist = 95 + (n.mentionCount ?? 1) * 4;
        const force = (dist - targetDist) * 0.003;
        n.vx += (dx / dist) * force;
        n.vy += (dy / dist) * force;

        // Dampen
        n.vx *= 0.88;
        n.vy *= 0.88;

        // Add tiny random drift
        n.vx += (Math.random() - 0.5) * 0.04;
        n.vy += (Math.random() - 0.5) * 0.04;

        n.x += n.vx;
        n.y += n.vy;
      }

      // ── Draw ──────────────────────────────────────────────────────────
      ctx.clearRect(0, 0, w, h);

      // Edges
      for (const n of nodes) {
        const strength = Math.min((n.mentionCount ?? 1) / 8, 1);
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(n.x, n.y);
        ctx.strokeStyle = `rgba(${hexToRgb(n.color)}, ${0.12 + strength * 0.25})`;
        ctx.lineWidth   = 0.5 + strength * 1.5;
        ctx.stroke();
      }

      // Center node
      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, 22);
      grad.addColorStop(0, "rgba(167,139,250,0.9)");
      grad.addColorStop(1, "rgba(99,102,241,0.6)");
      ctx.beginPath();
      ctx.arc(cx, cy, 22, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.fill();
      ctx.font = `500 11px Inter, system-ui`;
      ctx.fillStyle = "#ffffff";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(data.center, cx, cy);

      // Outer nodes
      for (const n of nodes) {
        const isHovered = hoverRef.current === n;
        // Glow
        if (isHovered) {
          const glow = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, n.r * 2.5);
          glow.addColorStop(0, `rgba(${hexToRgb(n.color)}, 0.25)`);
          glow.addColorStop(1, "transparent");
          ctx.beginPath();
          ctx.arc(n.x, n.y, n.r * 2.5, 0, Math.PI * 2);
          ctx.fillStyle = glow;
          ctx.fill();
        }
        // Node circle
        ctx.beginPath();
        ctx.arc(n.x, n.y, isHovered ? n.r * 1.2 : n.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(13,13,18,0.9)`;
        ctx.fill();
        ctx.strokeStyle = n.color;
        ctx.lineWidth   = isHovered ? 1.5 : 1;
        ctx.stroke();

        // Label
        ctx.font = `400 9px Inter, system-ui`;
        ctx.fillStyle = isHovered ? "#e8e8f0" : "#9494b0";
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        ctx.fillText(n.name, n.x, n.y + n.r + 4);

        // Role chip
        if (n.role) {
          ctx.font = `400 8px Inter, system-ui`;
          ctx.fillStyle = n.color;
          ctx.textBaseline = "top";
          ctx.fillText(n.role, n.x, n.y + n.r + 15);
        }
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);

    // Hover detection
    const onMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const hit = nodesRef.current.find((n) => {
        const dx = mx - n.x, dy = my - n.y;
        return dx * dx + dy * dy < (n.r + 8) ** 2;
      }) ?? null;
      hoverRef.current = hit;
      setHoveredNode(hit);
    };
    canvas.addEventListener("mousemove", onMouseMove);

    return () => {
      cancelAnimationFrame(rafRef.current);
      canvas.removeEventListener("mousemove", onMouseMove);
    };
  }, [data]);

  return (
    <div className="space-y-4">
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
      >
        <div className="text-[10px] uppercase tracking-[0.3em]" style={{ color: "#6b6b8a" }}>Netzwerk</div>
        <div className="mt-1 text-base font-medium" style={{ color: "#e8e8f0" }}>
          {data.nodes.length} Kontakte
        </div>
      </motion.div>

      {/* Legend */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="flex flex-wrap gap-3"
      >
        {Object.entries(GROUP_COLOR).map(([grp, color]) => (
          <div key={grp} className="flex items-center gap-1.5">
            <div className="h-2 w-2 rounded-full" style={{ background: color }} />
            <span className="text-[10px] capitalize" style={{ color: "#7878a0" }}>{grp}</span>
          </div>
        ))}
      </motion.div>

      {/* Canvas */}
      <motion.div
        className="relative overflow-hidden rounded-xl"
        style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.1 }}
      >
        <canvas
          ref={canvasRef}
          style={{ width: "100%", height: "320px", display: "block" }}
        />

        {/* Hover tooltip */}
        {hoveredNode && (
          <div
            className="pointer-events-none absolute rounded-lg p-2.5"
            style={{
              left: Math.min(hoveredNode.x + 12, (sizeRef.current.w ?? 600) - 150),
              top:  Math.max(hoveredNode.y - 60, 8),
              background: "rgba(13,13,18,0.95)",
              border: `1px solid ${hoveredNode.color}40`,
              minWidth: 120,
            }}
          >
            <div className="text-xs font-medium" style={{ color: "#e8e8f0" }}>{hoveredNode.name}</div>
            {hoveredNode.role && (
              <div className="text-[10px] mt-0.5" style={{ color: hoveredNode.color }}>{hoveredNode.role}</div>
            )}
            {hoveredNode.lastContact && (
              <div className="text-[10px] mt-1" style={{ color: "#6b6b8a" }}>
                📅 {hoveredNode.lastContact}
              </div>
            )}
            {hoveredNode.mentionCount != null && (
              <div className="text-[10px]" style={{ color: "#6b6b8a" }}>
                {hoveredNode.mentionCount}× erwähnt
              </div>
            )}
          </div>
        )}
      </motion.div>
    </div>
  );
}

function hexToRgb(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `${r},${g},${b}`;
}
