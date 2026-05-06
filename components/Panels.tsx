"use client";

/**
 * VELCRO Visual Panels — router + parser
 *
 * Tools emit:  <prose>\n\nVELCRO_PANEL:<type>\n{...json...}
 * ContentWindow calls parsePanel() → PanelRenderer renders the right component.
 */

import React from "react";

import DecisionMatrix,   { type DMData } from "@/components/panels/DecisionMatrix";
import ScenarioTree,     { type STData } from "@/components/panels/ScenarioTree";
import ConversationReplay, { type CRData } from "@/components/panels/ConversationReplay";
import RelationshipWeb,  { type RWData } from "@/components/panels/RelationshipWeb";
import MoodBoard,        { type MBData } from "@/components/panels/MoodBoard";
import Mirror,           { type MIData } from "@/components/panels/Mirror";
import SpatialMap,       { type SMData } from "@/components/panels/SpatialMap";

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

const PANEL_MARKER = /VELCRO_PANEL:\s*([a-z][a-z0-9-]+)/i;

function findJsonEnd(text: string, start: number): number {
  let depth = 0, inString = false, escaped = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (escaped)  { escaped = false; continue; }
    if (inString) {
      if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') { inString = true; continue; }
    if (ch === "{") depth++;
    else if (ch === "}") { depth--; if (depth === 0) return i + 1; }
  }
  return -1;
}

export function parsePanel(content: string): PanelEnvelope | null {
  const m = PANEL_MARKER.exec(content);
  if (!m) return null;
  const type  = m[1] as PanelType;
  const after = content.slice((m.index ?? 0) + m[0].length);
  const jsonStart = after.indexOf("{");
  if (jsonStart < 0) return null;
  const absStart = (m.index ?? 0) + m[0].length + jsonStart;
  const jsonEnd  = findJsonEnd(content, absStart);
  if (jsonEnd < 0) return null;
  try {
    return { type, data: JSON.parse(content.slice(absStart, jsonEnd)) };
  } catch { return null; }
}

export function stripPanelFromText(content: string): string {
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
    default: return (
      <div className="text-xs" style={{ color: "#6b6b8a" }}>
        Unbekannter Panel-Typ: {envelope.type}
      </div>
    );
  }
}
