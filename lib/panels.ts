/**
 * Server-side data builders for Phase 5 visual panels.
 *
 * Each builder returns the panel envelope as a string in the format:
 *   <prose summary>
 *   VELCRO_PANEL:<type>
 *   { ...JSON... }
 */

import { getServiceSupabase } from "@/lib/supabase";
import { getCalendarEvents } from "@/lib/google";
import { getRecentDebriefs } from "@/lib/debrief";

function envelope(prose: string, type: string, data: unknown): string {
  return `${prose.trim()}\n\nVELCRO_PANEL:${type}\n${JSON.stringify(data, null, 2)}`;
}

// ─── Conversation Replay ────────────────────────────────────────────────

export async function buildConversationReplay(days = 7): Promise<string> {
  const db = getServiceSupabase();
  const since = new Date(Date.now() - days * 86400000).toISOString();

  const { data, error } = await db
    .from("conversations")
    .select("query,response,sources,created_at")
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) throw new Error(`replay: ${error.message}`);

  const items = (data ?? []).map((row) => ({
    date:  formatDate(row.created_at),
    topic: truncate(row.query, 70),
    tools: extractTools(row.sources),
  }));

  if (!items.length) {
    return "Keine Gespräche in diesem Zeitraum.";
  }

  const summary =
    `In den letzten ${days} Tagen ${items.length} Konversation${items.length === 1 ? "" : "en"}. ` +
    `Zuletzt: ${truncate(items[0].topic, 60)}.`;

  return envelope(summary, "conversation-replay", {
    range: `Letzte ${days} Tage`,
    items,
  });
}

function extractTools(sources: unknown): string[] | undefined {
  if (!sources || typeof sources !== "object") return undefined;
  const tools = (sources as { tools?: string[] }).tools;
  if (!Array.isArray(tools) || tools.length === 0) return undefined;
  // Dedupe + drop generic ones from the chip view
  return [...new Set(tools)].slice(0, 4);
}

// ─── Mood Board ──────────────────────────────────────────────────────────

export async function buildMoodBoard(days = 7): Promise<string> {
  const debriefs = await getRecentDebriefs(50);
  const since = Date.now() - days * 86400000;

  // Group by date — keep latest mood per day
  const byDay = new Map<string, { mood: string; note: string }>();
  for (const d of debriefs) {
    const ts = new Date(d.created_at).getTime();
    if (ts < since) continue;
    const dateKey = new Date(d.created_at).toISOString().slice(0, 10);
    if (!byDay.has(dateKey)) {
      byDay.set(dateKey, {
        mood: d.mood ?? "neutral",
        note: `${d.person}: ${truncate(d.summary, 60)}`,
      });
    }
  }

  const dayList: { date: string; mood: string; note?: string }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000);
    const key = d.toISOString().slice(0, 10);
    const entry = byDay.get(key);
    dayList.push({
      date: d.toLocaleDateString("de-DE", { weekday: "short" }),
      mood: entry?.mood ?? "—",
      note: entry?.note,
    });
  }

  const recordedDays = dayList.filter((d) => d.mood !== "—").length;
  const summary = recordedDays
    ? `Stimmungsverlauf der letzten ${days} Tage. ${recordedDays} Tage mit Debrief, der Rest ohne Eintrag.`
    : `Noch keine Stimmungsdaten in den letzten ${days} Tagen — bitte Debriefs anlegen.`;

  return envelope(summary, "mood-board", {
    range: `Letzte ${days} Tage`,
    days:  dayList,
  });
}

// ─── Relationship Web ───────────────────────────────────────────────────

export async function buildRelationshipWeb(): Promise<string> {
  const debriefs = await getRecentDebriefs(50);

  // Aggregate by person
  const counts = new Map<string, { count: number; last: string }>();
  for (const d of debriefs) {
    const cur = counts.get(d.person);
    if (!cur || cur.last < d.created_at) {
      counts.set(d.person, { count: (cur?.count ?? 0) + 1, last: d.created_at });
    } else {
      cur.count += 1;
    }
  }

  const nodes = [...counts.entries()]
    .map(([name, v]) => ({ name, mentionCount: v.count, lastContact: formatDate(v.last) }))
    .sort((a, b) => (b.mentionCount ?? 0) - (a.mentionCount ?? 0))
    .slice(0, 12);

  if (!nodes.length) {
    return "Noch keine Kontakte im Netzwerk — Debriefs anlegen, um Beziehungen zu visualisieren.";
  }

  const summary =
    `Ihr Netzwerk umfasst ${nodes.length} aktive Kontakte. ` +
    `Am häufigsten: ${nodes.slice(0, 3).map((n) => n.name).join(", ")}.`;

  return envelope(summary, "relationship-web", { center: "Simon", nodes });
}

// ─── Mirror ─────────────────────────────────────────────────────────────

export async function buildMirror(days = 14): Promise<string> {
  const db = getServiceSupabase();
  const since = new Date(Date.now() - days * 86400000).toISOString();

  const [{ data: convData }, debriefs] = await Promise.all([
    db.from("conversations")
      .select("query,sources,created_at")
      .gte("created_at", since),
    getRecentDebriefs(50),
  ]);

  const recentDebriefs = debriefs.filter(
    (d) => new Date(d.created_at).getTime() > Date.now() - days * 86400000
  );

  // Pattern 1 — most-mentioned people in queries
  const peopleHits = new Map<string, string[]>();
  const namesFromDebriefs = new Set(recentDebriefs.map((d) => d.person.split(/\s/)[0]));
  for (const conv of convData ?? []) {
    const q: string = conv.query ?? "";
    for (const name of namesFromDebriefs) {
      if (name.length < 3) continue;
      if (q.toLowerCase().includes(name.toLowerCase())) {
        const arr = peopleHits.get(name) ?? [];
        arr.push(truncate(q, 50));
        peopleHits.set(name, arr);
      }
    }
  }

  // Pattern 2 — most-used tools
  const toolHits = new Map<string, number>();
  for (const conv of convData ?? []) {
    const tools = (conv.sources as { tools?: string[] } | null)?.tools ?? [];
    for (const t of tools) toolHits.set(t, (toolHits.get(t) ?? 0) + 1);
  }

  // Pattern 3 — mood frequency
  const moodHits = new Map<string, number>();
  for (const d of recentDebriefs) {
    if (d.mood) moodHits.set(d.mood, (moodHits.get(d.mood) ?? 0) + 1);
  }

  const insights: { pattern: string; count: number; examples?: string[] }[] = [];

  for (const [name, examples] of [...peopleHits.entries()].sort((a, b) => b[1].length - a[1].length).slice(0, 4)) {
    insights.push({ pattern: `Sie sprechen über ${name}`, count: examples.length, examples: examples.slice(0, 2) });
  }
  for (const [tool, count] of [...toolHits.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3)) {
    insights.push({ pattern: `Tool genutzt: ${tool}`, count });
  }
  for (const [mood, count] of [...moodHits.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3)) {
    insights.push({ pattern: `Stimmung "${mood}"`, count });
  }

  if (!insights.length) {
    return "Noch zu wenig Daten für eine Spiegel-Analyse — bitte ein paar Konversationen und Debriefs sammeln.";
  }

  const top = insights[0];
  const summary = `In den letzten ${days} Tagen war das prägendste Muster: ${top.pattern} (${top.count}×). Insgesamt ${insights.length} erkennbare Muster.`;
  const reflectiveSummary = `Beobachtungen aus ${convData?.length ?? 0} Konversationen und ${recentDebriefs.length} Debriefs der letzten ${days} Tage.`;

  return envelope(summary, "mirror", {
    summary: reflectiveSummary,
    insights,
  });
}

// ─── Spatial Map ────────────────────────────────────────────────────────

export async function buildSpatialMap(days = 14): Promise<string> {
  const now    = Date.now();
  const past   = new Date(now - days * 86400000);
  const future = new Date(now + 7  * 86400000);

  const events = await getCalendarEvents(past.toISOString(), future.toISOString());
  const located = events
    .filter((e) => e.location && e.location.trim().length > 0)
    .map((e) => ({
      name:  e.location ?? "",
      date:  formatDate(e.start),
      event: e.title,
    }))
    .slice(0, 12);

  if (!located.length) {
    return "Keine Termine mit Ortsangabe in diesem Zeitraum.";
  }

  const summary = `${located.length} Termine mit Ortsangabe im Zeitraum von -${days} bis +7 Tagen. Häufig: ${[...new Set(located.map((l) => l.name))].slice(0, 3).join(", ")}.`;

  return envelope(summary, "spatial-map", {
    range: `${days} Tage rückwärts, 7 vorwärts`,
    locations: located,
  });
}

// ─── Helpers ────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("de-DE", { weekday: "short", day: "2-digit", month: "2-digit" });
}

function truncate(s: string, max: number): string {
  if (!s) return "";
  return s.length <= max ? s : s.slice(0, max - 1).trim() + "…";
}
