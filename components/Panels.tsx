"use client";

/**
 * VELCRO Visual Panels (Phase 5)
 *
 * Each tool can emit a panel by returning text in this format:
 *
 *   <prose summary>
 *   VELCRO_PANEL:<type>
 *   { ...JSON data... }
 *
 * ContentWindow detects the marker and routes to the right component below.
 * The prose summary is what gets spoken.
 */

import React from "react";

// ─── Types ──────────────────────────────────────────────────────────────

export type PanelType =
  | "decision-matrix"
  | "scenario-tree"
  | "conversation-replay"
  | "relationship-web"
  | "mood-board"
  | "mirror"
  | "spatial-map";

export interface PanelEnvelope {
  type: PanelType;
  data: unknown;
}

// ─── Parser ─────────────────────────────────────────────────────────────

// Match `VELCRO_PANEL:type` — type word may be on the same line as JSON or not.
const PANEL_MARKER = /VELCRO_PANEL:\s*([a-z][a-z0-9-]+)/i;

/**
 * Find the matching closing brace of a JSON object starting at `start`.
 * Walks the string, accounting for nested objects and string literals
 * (so `}` characters inside strings don't end the object early).
 */
function findJsonEnd(text: string, start: number): number {
  let depth     = 0;
  let inString  = false;
  let escaped   = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (escaped) { escaped = false; continue; }
    if (inString) {
      if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') { inString = true; continue; }
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) return i + 1;
    }
  }
  return -1;
}

export function parsePanel(content: string): PanelEnvelope | null {
  const markerMatch = PANEL_MARKER.exec(content);
  if (!markerMatch) return null;
  const type = markerMatch[1] as PanelType;
  const after = content.slice((markerMatch.index ?? 0) + markerMatch[0].length);

  const jsonStart = after.indexOf("{");
  if (jsonStart < 0) return null;

  const absStart = (markerMatch.index ?? 0) + markerMatch[0].length + jsonStart;
  const jsonEnd  = findJsonEnd(content, absStart);
  if (jsonEnd < 0) return null;

  const jsonStr = content.slice(absStart, jsonEnd);
  try {
    const data = JSON.parse(jsonStr);
    return { type, data };
  } catch {
    return null;
  }
}

export function stripPanelFromText(content: string): string {
  // Remove everything from VELCRO_PANEL onwards so prose stays clean
  const idx = content.search(PANEL_MARKER);
  return idx >= 0 ? content.slice(0, idx).trim() : content.trim();
}

// ─── Router ─────────────────────────────────────────────────────────────

export function PanelRenderer({ envelope }: { envelope: PanelEnvelope }) {
  switch (envelope.type) {
    case "decision-matrix":     return <DecisionMatrix     data={envelope.data as DMData} />;
    case "scenario-tree":       return <ScenarioTree       data={envelope.data as STData} />;
    case "conversation-replay": return <ConversationReplay data={envelope.data as CRData} />;
    case "relationship-web":    return <RelationshipWeb    data={envelope.data as RWData} />;
    case "mood-board":          return <MoodBoard          data={envelope.data as MBData} />;
    case "mirror":              return <Mirror             data={envelope.data as MIData} />;
    case "spatial-map":         return <SpatialMap         data={envelope.data as SMData} />;
    default:                    return <UnknownPanel type={envelope.type} />;
  }
}

function UnknownPanel({ type }: { type: string }) {
  return <div className="text-velcro-dim">Unbekannter Panel-Typ: {type}</div>;
}

// ─── 1. Decision Matrix ─────────────────────────────────────────────────

interface DMData {
  question:       string;
  options:        string[];
  factors:        { name: string; weight: number; scores: number[] }[]; // scores 0-10
  recommendation: string;
}

function DecisionMatrix({ data }: { data: DMData }) {
  // Compute weighted total per option
  const totals = data.options.map((_, oi) =>
    data.factors.reduce((sum, f) => sum + (f.scores[oi] ?? 0) * f.weight, 0)
  );
  const max = Math.max(...totals, 1);
  const winnerIdx = totals.indexOf(Math.max(...totals));

  return (
    <div className="space-y-5">
      <PanelHeader label="Entscheidungs-Matrix" subtitle={data.question} />

      {/* Options bar chart */}
      <div className="space-y-2">
        {data.options.map((opt, i) => {
          const pct = (totals[i] / max) * 100;
          const isWinner = i === winnerIdx;
          return (
            <div key={i}>
              <div className="mb-1 flex justify-between text-xs">
                <span className={isWinner ? "font-semibold text-velcro-accent-bright" : "text-velcro-text"}>
                  {opt}
                </span>
                <span className="font-mono text-velcro-dim">{totals[i].toFixed(1)}</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-velcro-surface">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${pct}%`,
                    background: isWinner
                      ? "linear-gradient(90deg, #818cf8, #a78bfa)"
                      : "rgba(99,102,241,0.4)",
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Factor breakdown */}
      <div>
        <div className="mb-2 text-[10px] uppercase tracking-widest text-velcro-dim">Faktoren</div>
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-velcro-border text-velcro-dim">
              <th className="py-1.5 text-left font-medium">Faktor</th>
              <th className="py-1.5 text-right font-medium">Gew.</th>
              {data.options.map((opt, i) => (
                <th key={i} className="py-1.5 text-right font-medium">{abbreviate(opt)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.factors.map((f, i) => (
              <tr key={i} className="border-b border-velcro-border/40">
                <td className="py-1.5 text-velcro-text">{f.name}</td>
                <td className="py-1.5 text-right font-mono text-velcro-dim">×{f.weight}</td>
                {f.scores.map((s, si) => (
                  <td key={si} className="py-1.5 text-right">
                    <span className={si === winnerIdx ? "text-velcro-accent-bright" : "text-velcro-text"}>
                      {s}
                    </span>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Recommendation */}
      <div className="rounded-lg border border-velcro-accent/30 bg-velcro-accent/5 p-3">
        <div className="text-[10px] uppercase tracking-widest text-velcro-accent">Empfehlung</div>
        <div className="mt-1 text-sm text-velcro-text">{data.recommendation}</div>
      </div>
    </div>
  );
}

// ─── 2. Scenario Tree ───────────────────────────────────────────────────

interface STBranch {
  condition:     string;
  consequences:  string[];
  next?:         STBranch[];
}
interface STData {
  question: string;
  branches: STBranch[];
}

function ScenarioTree({ data }: { data: STData }) {
  return (
    <div className="space-y-4">
      <PanelHeader label="Szenario-Baum" subtitle={data.question} />
      <div className="space-y-3">
        {data.branches.map((b, i) => <Branch key={i} branch={b} depth={0} />)}
      </div>
    </div>
  );
}

function Branch({ branch, depth }: { branch: STBranch; depth: number }) {
  const colors = ["#818cf8", "#a78bfa", "#60a5fa", "#c4b5fd"];
  const color  = colors[depth % colors.length];
  return (
    <div className="relative" style={{ paddingLeft: depth > 0 ? "1rem" : 0 }}>
      {depth > 0 && (
        <div
          className="absolute left-0 top-0 h-full w-px"
          style={{ background: color, opacity: 0.3 }}
        />
      )}
      <div className="space-y-1.5">
        <div className="flex items-center gap-2 text-sm font-medium" style={{ color }}>
          <span className="text-[10px] opacity-60">→</span>
          <span>{branch.condition}</span>
        </div>
        {branch.consequences.length > 0 && (
          <ul className="space-y-1 pl-5 text-xs text-velcro-text/80">
            {branch.consequences.map((c, i) => (
              <li key={i} className="before:mr-2 before:text-velcro-dim before:content-['·']">{c}</li>
            ))}
          </ul>
        )}
        {branch.next?.length ? (
          <div className="mt-2 space-y-2 pl-5">
            {branch.next.map((n, i) => <Branch key={i} branch={n} depth={depth + 1} />)}
          </div>
        ) : null}
      </div>
    </div>
  );
}

// ─── 3. Conversation Replay ─────────────────────────────────────────────

interface CRItem {
  date:   string;
  topic:  string;
  tools?: string[];
}
interface CRData {
  range: string;
  items: CRItem[];
}

function ConversationReplay({ data }: { data: CRData }) {
  return (
    <div className="space-y-4">
      <PanelHeader label="Gespräche" subtitle={data.range} />
      <div className="relative space-y-3">
        <div className="absolute bottom-1 left-[5px] top-1 w-px bg-velcro-border/60" />
        {data.items.map((item, i) => (
          <div key={i} className="relative pl-6">
            <div
              className="absolute left-0 top-1.5 h-2.5 w-2.5 rounded-full border border-velcro-accent bg-velcro-bg"
              style={{ boxShadow: "0 0 6px rgba(167,139,250,0.4)" }}
            />
            <div className="text-[10px] uppercase tracking-widest text-velcro-dim">{item.date}</div>
            <div className="mt-0.5 text-sm text-velcro-text">{item.topic}</div>
            {item.tools && item.tools.length > 0 && (
              <div className="mt-1 flex flex-wrap gap-1">
                {item.tools.map((t, ti) => (
                  <span key={ti} className="rounded bg-velcro-surface px-1.5 py-0.5 font-mono text-[9px] text-velcro-accent">
                    {t}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── 4. Relationship Web ────────────────────────────────────────────────

interface RWNode { name: string; group?: string; lastContact?: string; mentionCount?: number }
interface RWData {
  center: string;
  nodes:  RWNode[];
}

function RelationshipWeb({ data }: { data: RWData }) {
  // Force-free radial layout — nodes placed on a circle around center
  const SIZE   = 360;
  const CENTER = SIZE / 2;
  const RADIUS = 120;
  const nodes  = data.nodes.slice(0, 12);

  const positions = nodes.map((_, i) => {
    const angle = (i / nodes.length) * Math.PI * 2 - Math.PI / 2;
    return {
      x: CENTER + Math.cos(angle) * RADIUS,
      y: CENTER + Math.sin(angle) * RADIUS,
    };
  });

  return (
    <div className="space-y-3">
      <PanelHeader label="Netzwerk" subtitle={`${nodes.length} aktive Kontakte`} />
      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="w-full">
        <defs>
          <radialGradient id="rwCenter">
            <stop offset="0%" stopColor="#a78bfa" />
            <stop offset="100%" stopColor="#6366f1" />
          </radialGradient>
        </defs>

        {/* Edges */}
        {positions.map((p, i) => {
          const node = nodes[i];
          const intensity = Math.min((node.mentionCount ?? 1) / 5, 1);
          return (
            <line
              key={`e${i}`}
              x1={CENTER} y1={CENTER}
              x2={p.x} y2={p.y}
              stroke="#818cf8"
              strokeWidth={0.5 + intensity * 1.5}
              opacity={0.2 + intensity * 0.5}
            />
          );
        })}

        {/* Center node */}
        <circle cx={CENTER} cy={CENTER} r={22} fill="url(#rwCenter)" />
        <text
          x={CENTER} y={CENTER + 4}
          textAnchor="middle"
          className="fill-white"
          fontSize="11"
          fontWeight="500"
        >
          {data.center}
        </text>

        {/* Outer nodes */}
        {positions.map((p, i) => {
          const node = nodes[i];
          const r = 8 + Math.min((node.mentionCount ?? 1) * 1.2, 10);
          return (
            <g key={`n${i}`}>
              <circle cx={p.x} cy={p.y} r={r} fill="#1e1b4b" stroke="#818cf8" strokeWidth={1} />
              <text
                x={p.x}
                y={p.y + r + 12}
                textAnchor="middle"
                className="fill-velcro-text"
                fontSize="9"
              >
                {node.name}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// ─── 5. Mood Board ──────────────────────────────────────────────────────

interface MBDay { date: string; mood: string; emoji?: string; note?: string }
interface MBData { range: string; days: MBDay[] }

const MOOD_COLORS: Record<string, string> = {
  gut:        "#34d399",
  neutral:    "#94a3b8",
  angespannt: "#fb923c",
  stress:     "#f87171",
  positiv:    "#34d399",
  negativ:    "#f87171",
};

function moodColor(mood: string): string {
  const lower = mood.toLowerCase();
  for (const k of Object.keys(MOOD_COLORS)) {
    if (lower.includes(k)) return MOOD_COLORS[k];
  }
  return "#a78bfa";
}

function MoodBoard({ data }: { data: MBData }) {
  return (
    <div className="space-y-4">
      <PanelHeader label="Stimmung" subtitle={data.range} />
      <div className="grid grid-cols-7 gap-2">
        {data.days.map((day, i) => {
          const color = moodColor(day.mood);
          return (
            <div key={i} className="space-y-1 text-center">
              <div className="text-[9px] text-velcro-dim">{day.date}</div>
              <div
                className="aspect-square rounded-lg flex items-center justify-center text-lg"
                style={{
                  background: `radial-gradient(circle, ${color}33, ${color}11)`,
                  border: `1px solid ${color}66`,
                }}
              >
                {day.emoji ?? moodEmoji(day.mood)}
              </div>
              <div className="text-[9px] capitalize" style={{ color }}>{day.mood}</div>
            </div>
          );
        })}
      </div>
      {data.days.some((d) => d.note) && (
        <div className="space-y-1.5">
          {data.days.filter((d) => d.note).map((d, i) => (
            <div key={i} className="text-xs">
              <span className="text-velcro-dim">{d.date}:</span>{" "}
              <span className="text-velcro-text">{d.note}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function moodEmoji(mood: string): string {
  const lower = mood.toLowerCase();
  if (lower.includes("gut") || lower.includes("posit"))  return "✨";
  if (lower.includes("angespannt") || lower.includes("stress")) return "⚡";
  if (lower.includes("neutral")) return "·";
  return "○";
}

// ─── 6. Mirror ──────────────────────────────────────────────────────────

interface MIInsight { pattern: string; count: number; examples?: string[] }
interface MIData { summary: string; insights: MIInsight[] }

function Mirror({ data }: { data: MIData }) {
  const max = Math.max(...data.insights.map((i) => i.count), 1);
  return (
    <div className="space-y-4">
      <PanelHeader label="Spiegel" subtitle="Muster der letzten Tage" />
      <div className="rounded-lg border border-velcro-border bg-velcro-surface/40 p-3 text-xs leading-relaxed text-velcro-text">
        {data.summary}
      </div>
      <div className="space-y-3">
        {data.insights.map((ins, i) => {
          const pct = (ins.count / max) * 100;
          return (
            <div key={i}>
              <div className="mb-1 flex items-baseline justify-between text-xs">
                <span className="text-velcro-text">{ins.pattern}</span>
                <span className="font-mono text-velcro-dim">{ins.count}×</span>
              </div>
              <div className="h-1 overflow-hidden rounded-full bg-velcro-surface">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${pct}%`, background: "linear-gradient(90deg, #818cf8, #a78bfa)" }}
                />
              </div>
              {ins.examples && ins.examples.length > 0 && (
                <div className="mt-1.5 space-y-0.5">
                  {ins.examples.slice(0, 2).map((ex, ei) => (
                    <div key={ei} className="text-[10px] italic text-velcro-dim">„{ex}"</div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── 7. Spatial Map ─────────────────────────────────────────────────────

interface SMLoc { name: string; date: string; event: string }
interface SMData { range: string; locations: SMLoc[] }

function SpatialMap({ data }: { data: SMData }) {
  return (
    <div className="space-y-4">
      <PanelHeader label="Orte" subtitle={data.range} />
      <div className="space-y-2">
        {data.locations.map((loc, i) => (
          <div
            key={i}
            className="flex items-start gap-3 rounded-lg border border-velcro-border bg-velcro-surface/30 p-3"
          >
            <div className="mt-0.5 text-velcro-accent">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
                <circle cx="12" cy="10" r="3" />
              </svg>
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm text-velcro-text">{loc.name}</div>
              <div className="mt-0.5 flex items-center gap-2 text-[10px] text-velcro-dim">
                <span>{loc.date}</span>
                <span>·</span>
                <span className="truncate">{loc.event}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Shared ─────────────────────────────────────────────────────────────

function PanelHeader({ label, subtitle }: { label: string; subtitle?: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-[0.3em] text-velcro-dim">{label}</div>
      {subtitle && <div className="mt-1 text-sm text-velcro-text">{subtitle}</div>}
    </div>
  );
}

function abbreviate(s: string, maxLen = 6): string {
  return s.length <= maxLen ? s : s.slice(0, maxLen);
}
