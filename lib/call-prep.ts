/**
 * Call Preparation orchestrator.
 *
 * Given a person or topic name, fetches in parallel:
 *   - Vault chunks mentioning that person/topic
 *   - Recent Gmail threads from/to/about them
 *   - Past + upcoming calendar events with them
 *
 * Returns a single structured Markdown briefing suitable for a content panel.
 */

import { searchVault } from "@/lib/vault-search";
import { searchMails, searchPastEvents } from "@/lib/google";
import type { CalendarEvent, MailSummary, VaultSearchResult } from "@/lib/types";

interface CallPrepData {
  vault: VaultSearchResult[];
  mails: MailSummary[];
  events: CalendarEvent[];
}

export async function gatherCallPrep(needle: string): Promise<CallPrepData> {
  const trimmed = needle.trim();
  if (!trimmed) return { vault: [], mails: [], events: [] };

  // Run all three lookups in parallel — fail-soft per source so partial
  // results still surface even if (e.g.) Google auth is missing.
  const [vaultRes, mailsRes, eventsRes] = await Promise.allSettled([
    searchVault(trimmed, 6, 0.25),
    searchMails(trimmed, 6),
    searchPastEvents(trimmed, 6),
  ]);

  return {
    vault:  vaultRes.status  === "fulfilled" ? vaultRes.value  : [],
    mails:  mailsRes.status  === "fulfilled" ? mailsRes.value  : [],
    events: eventsRes.status === "fulfilled" ? eventsRes.value : [],
  };
}

// ---------------------------------------------------------------------------
// Briefing formatter — produces the Markdown that ContentWindow renders.
// Structure: short prose intro (gets spoken), then three labeled sections.
// ---------------------------------------------------------------------------

export function formatCallPrep(needle: string, data: CallPrepData): string {
  const { vault, mails, events } = data;
  const hasAny = vault.length || mails.length || events.length;

  if (!hasAny) {
    return `Zu ${needle} habe ich keine Hinweise im Vault, in Mails oder Kalender gefunden. Möchten Sie das Briefing manuell aufbauen?`;
  }

  const lines: string[] = [];

  // ── Spoken summary (prose before any structured block) ───────────────
  const summaryParts: string[] = [];
  if (events.length) {
    const lastEvent = events[events.length - 1];
    summaryParts.push(
      `Ihr letzter Termin mit ${needle} war ${shortDate(lastEvent.start)}: ${lastEvent.title}`
    );
  }
  if (mails.length) {
    summaryParts.push(
      `Es gibt ${mails.length} aktuelle Mail${mails.length === 1 ? "" : "s"} im Verlauf`
    );
  }
  if (vault.length) {
    summaryParts.push(
      `und ${vault.length} relevante Notizen im Vault`
    );
  }
  lines.push(summaryParts.join(", ") + ".");
  lines.push("");

  // ── Calendar history ──────────────────────────────────────────────────
  if (events.length) {
    lines.push("## Bisherige Termine");
    for (const e of events.slice(-5).reverse()) {
      const when = shortDate(e.start);
      const where = e.location ? ` · ${e.location}` : "";
      lines.push(`- ${when} — ${e.title}${where}`);
    }
    lines.push("");
  }

  // ── Mail thread ───────────────────────────────────────────────────────
  if (mails.length) {
    lines.push("## Letzter Mailverkehr");
    for (const m of mails.slice(0, 5)) {
      const from = cleanFrom(m.from);
      const snippet = m.snippet.slice(0, 140).replace(/\s+/g, " ").trim();
      lines.push(`- **${m.subject}** — ${from}`);
      if (snippet) lines.push(`  ${snippet}…`);
    }
    lines.push("");
  }

  // ── Vault notes ───────────────────────────────────────────────────────
  if (vault.length) {
    lines.push("## Notizen aus dem Vault");
    for (const v of vault.slice(0, 4)) {
      const source = v.file_path.replace(/\.md$/, "").split("/").pop() ?? v.file_path;
      const excerpt = v.content.replace(/\s+/g, " ").trim().slice(0, 200);
      lines.push(`- **${source}** — ${excerpt}…`);
    }
    lines.push("");
  }

  // ── Talking points hint for Claude — Claude will rewrite/ignore ──────
  // (kept short so the panel stays scannable)
  lines.push("## Talking Points");
  lines.push("_VELCRO synthetisiert die wichtigsten Themen aus den obigen Quellen._");

  return lines.join("\n").trim();
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function shortDate(iso: string): string {
  if (!iso) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
    const [, m, d] = iso.split("-");
    return `${d}.${m}.`;
  }
  const date = new Date(iso);
  return date.toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  });
}

function cleanFrom(from: string): string {
  // "Karin Müller <karin@example.com>" → "Karin Müller"
  const match = from.match(/^([^<]+)</);
  return (match?.[1] ?? from).trim().replace(/^"|"$/g, "");
}
