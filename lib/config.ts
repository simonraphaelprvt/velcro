/**
 * Feature Flags for VELCRO.
 *
 * All flags default to ON unless explicitly set to "false" via env var.
 * Phase 5+ panels default OFF until their backends are wired up.
 *
 * Flags are NEXT_PUBLIC_* so they can be read in client components.
 */

const flag = (envValue: string | undefined, defaultOn: boolean): boolean => {
  if (envValue === undefined) return defaultOn;
  return envValue.toLowerCase() !== "false";
};

export const FEATURES = {
  // Phase 1 — Wake Word Detection
  wakeWord: flag(process.env.NEXT_PUBLIC_FEATURE_WAKE_WORD, true),

  // Phase 2 — Call Preparation
  callPrep: flag(process.env.NEXT_PUBLIC_FEATURE_CALL_PREP, true),

  // Phase 3 — Debrief & Morning Brief
  debrief: flag(process.env.NEXT_PUBLIC_FEATURE_DEBRIEF, true),
  morningBrief: flag(process.env.NEXT_PUBLIC_FEATURE_MORNING_BRIEF, true),

  // Phase 4 — Quality of Life
  spotify: flag(process.env.NEXT_PUBLIC_FEATURE_SPOTIFY, true),
  webSearch: flag(process.env.NEXT_PUBLIC_FEATURE_WEB_SEARCH, true),
  weather: flag(process.env.NEXT_PUBLIC_FEATURE_WEATHER, true),

  // Phase 5 — Visual Context Panels
  spatialMap: flag(process.env.NEXT_PUBLIC_FEATURE_SPATIAL_MAP, true),
  decisionMatrix: flag(process.env.NEXT_PUBLIC_FEATURE_DECISION_MATRIX, true),
  conversationReplay: flag(process.env.NEXT_PUBLIC_FEATURE_CONVERSATION_REPLAY, true),
  scenario: flag(process.env.NEXT_PUBLIC_FEATURE_SCENARIO, true),
  relationshipWeb: flag(process.env.NEXT_PUBLIC_FEATURE_RELATIONSHIP_WEB, true),
  moodBoard: flag(process.env.NEXT_PUBLIC_FEATURE_MOOD_BOARD, true),
  mirror: flag(process.env.NEXT_PUBLIC_FEATURE_MIRROR, true),

  // Phase 6 — Generative Visual Panels (no backend, pure Claude generation)
  tiles:        flag(process.env.NEXT_PUBLIC_FEATURE_TILES,        true),
  mindmap:      flag(process.env.NEXT_PUBLIC_FEATURE_MINDMAP,      true),
  timeline:     flag(process.env.NEXT_PUBLIC_FEATURE_TIMELINE,     true),
  metricCards:  flag(process.env.NEXT_PUBLIC_FEATURE_METRIC_CARDS, true),
} as const;

export type FeatureFlag = keyof typeof FEATURES;
