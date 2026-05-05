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
  callPrep: flag(process.env.NEXT_PUBLIC_FEATURE_CALL_PREP, false),

  // Phase 3 — Debrief & Morning Brief
  debrief: flag(process.env.NEXT_PUBLIC_FEATURE_DEBRIEF, false),
  morningBrief: flag(process.env.NEXT_PUBLIC_FEATURE_MORNING_BRIEF, false),

  // Phase 4 — Quality of Life
  spotify: flag(process.env.NEXT_PUBLIC_FEATURE_SPOTIFY, false),
  webSearch: flag(process.env.NEXT_PUBLIC_FEATURE_WEB_SEARCH, false),
  weather: flag(process.env.NEXT_PUBLIC_FEATURE_WEATHER, false),

  // Phase 5 — Visual Context Panels
  spatialMap: flag(process.env.NEXT_PUBLIC_FEATURE_SPATIAL_MAP, false),
  decisionMatrix: flag(process.env.NEXT_PUBLIC_FEATURE_DECISION_MATRIX, false),
  conversationReplay: flag(process.env.NEXT_PUBLIC_FEATURE_CONVERSATION_REPLAY, false),
  scenario: flag(process.env.NEXT_PUBLIC_FEATURE_SCENARIO, false),
  relationshipWeb: flag(process.env.NEXT_PUBLIC_FEATURE_RELATIONSHIP_WEB, false),
  moodBoard: flag(process.env.NEXT_PUBLIC_FEATURE_MOOD_BOARD, false),
  mirror: flag(process.env.NEXT_PUBLIC_FEATURE_MIRROR, false),
} as const;

export type FeatureFlag = keyof typeof FEATURES;
