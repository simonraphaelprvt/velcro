/**
 * Debrief storage + retrieval (Phase 3).
 *
 * After a call/meeting, VELCRO collects a structured debrief through
 * conversation and persists it to Supabase. The morning brief reads from
 * here for open todos and unresolved threads.
 */

import { getServiceSupabase } from "@/lib/supabase";
import { getCalendarEvents, getRecentMails } from "@/lib/google";
import type { Debrief, DebriefTodo, CalendarEvent, MailSummary } from "@/lib/types";

// ---------------------------------------------------------------------------
// Save
// ---------------------------------------------------------------------------

export interface SaveDebriefInput {
  person: string;
  summary: string;
  decisions?: string[];
  todos?: DebriefTodo[];
  mood?: string;
  open_threads?: string[];
  source_event_id?: string;
}

export async function saveDebrief(input: SaveDebriefInput): Promise<Debrief> {
  const db = getServiceSupabase();
  const { data, error } = await db
    .from("debriefs")
    .insert({
      person:          input.person,
      summary:         input.summary,
      decisions:       input.decisions       ?? [],
      todos:           input.todos           ?? [],
      mood:            input.mood            ?? null,
      open_threads:    input.open_threads    ?? [],
      source_event_id: input.source_event_id ?? null,
    })
    .select("*")
    .single();

  if (error) throw new Error(`Debrief save failed: ${error.message}`);
  return data as Debrief;
}

// ---------------------------------------------------------------------------
// Read
// ---------------------------------------------------------------------------

export async function getRecentDebriefs(limit = 10): Promise<Debrief[]> {
  const db = getServiceSupabase();
  const { data, error } = await db
    .from("debriefs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(`Debrief read failed: ${error.message}`);
  return (data ?? []) as Debrief[];
}

/**
 * Pull every still-open todo from the last N debriefs, plus open threads.
 * Returns a flat structure suitable for morning-brief synthesis.
 */
export async function getOpenThreads(): Promise<{
  todos:   { person: string; text: string; due?: string; debriefId: string }[];
  threads: { person: string; text: string; debriefId: string }[];
}> {
  const recent = await getRecentDebriefs(20);
  const todos:   { person: string; text: string; due?: string; debriefId: string }[] = [];
  const threads: { person: string; text: string; debriefId: string }[] = [];

  for (const d of recent) {
    for (const t of d.todos ?? []) {
      if (!t.done) todos.push({ person: d.person, text: t.text, due: t.due, debriefId: d.id });
    }
    for (const th of d.open_threads ?? []) {
      threads.push({ person: d.person, text: th, debriefId: d.id });
    }
  }

  return { todos, threads };
}

// ---------------------------------------------------------------------------
// Morning Brief
// ---------------------------------------------------------------------------

export interface MorningBriefData {
  events: CalendarEvent[];
  unread: MailSummary[];
  openTodos:   { person: string; text: string; due?: string }[];
  openThreads: { person: string; text: string }[];
}

export async function buildMorningBrief(): Promise<MorningBriefData> {
  const now   = new Date();
  const start = new Date(now); start.setHours(0, 0, 0, 0);
  const end   = new Date(now); end.setHours(23, 59, 59, 999);

  const [eventsRes, mailsRes, openRes] = await Promise.allSettled([
    getCalendarEvents(start.toISOString(), end.toISOString()),
    getRecentMails(8, "is:unread in:inbox"),
    getOpenThreads(),
  ]);

  const events = eventsRes.status === "fulfilled" ? eventsRes.value : [];
  const unread = mailsRes.status  === "fulfilled" ? mailsRes.value  : [];
  const open   = openRes.status   === "fulfilled" ? openRes.value   : { todos: [], threads: [] };

  return {
    events,
    unread,
    openTodos:   open.todos,
    openThreads: open.threads,
  };
}

export function formatMorningBrief(data: MorningBriefData): string {
  const { events, unread, openTodos, openThreads } = data;
  const today = new Date().toLocaleDateString("de-DE", {
    weekday: "long",
    day:     "2-digit",
    month:   "long",
  });

  const lines: string[] = [];

  // Spoken summary — first paragraph, no markdown
  const summaryParts: string[] = [];
  if (events.length) {
    summaryParts.push(
      `Heute ${events.length} Termin${events.length === 1 ? "" : "e"}` +
      (events[0]?.title ? `, beginnend mit ${events[0].title}` : "")
    );
  } else {
    summaryParts.push("Heute sind keine Termine geplant");
  }
  if (openTodos.length) {
    summaryParts.push(`${openTodos.length} offene Todos aus Debriefs`);
  }
  if (unread.length) {
    summaryParts.push(`${unread.length} ungelesene Mails`);
  }
  lines.push(`Guten Morgen. ${today}. ${summaryParts.join(", ")}.`);
  lines.push("");

  // ── Termine heute ────────────────────────────────────────────────────
  if (events.length) {
    lines.push("## Termine heute");
    for (const e of events) {
      const when = formatEventTime(e.start);
      const where = e.location ? ` · ${e.location}` : "";
      lines.push(`- **${when}** — ${e.title}${where}`);
    }
    lines.push("");
  }

  // ── Offene Todos ─────────────────────────────────────────────────────
  if (openTodos.length) {
    lines.push("## Offene Todos");
    for (const t of openTodos.slice(0, 8)) {
      const due = t.due ? ` _(bis ${t.due})_` : "";
      lines.push(`- **${t.person}**: ${t.text}${due}`);
    }
    lines.push("");
  }

  // ── Offene Threads ───────────────────────────────────────────────────
  if (openThreads.length) {
    lines.push("## Offene Threads");
    for (const th of openThreads.slice(0, 6)) {
      lines.push(`- **${th.person}**: ${th.text}`);
    }
    lines.push("");
  }

  // ── Ungelesene Mails ─────────────────────────────────────────────────
  if (unread.length) {
    lines.push("## Ungelesene Mails");
    for (const m of unread.slice(0, 5)) {
      const from = cleanFrom(m.from);
      lines.push(`- **${m.subject}** — ${from}`);
    }
  }

  return lines.join("\n").trim();
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatEventTime(iso: string): string {
  if (!iso) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) return "ganztägig";
  return new Date(iso).toLocaleTimeString("de-DE", {
    hour:   "2-digit",
    minute: "2-digit",
  });
}

function cleanFrom(from: string): string {
  const match = from.match(/^([^<]+)</);
  return (match?.[1] ?? from).trim().replace(/^"|"$/g, "");
}
