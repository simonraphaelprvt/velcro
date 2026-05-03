import type Anthropic from "@anthropic-ai/sdk";
import { searchVault, formatVaultContext } from "@/lib/vault-search";
import { getCalendarEvents, getRecentMails } from "@/lib/google";
import type { CalendarEvent, MailSummary } from "@/lib/types";

// ---------------------------------------------------------------------------
// Tool definitions for Claude
// ---------------------------------------------------------------------------

export const VELCRO_TOOLS: Anthropic.Tool[] = [
  {
    name: "search_vault",
    description:
      "Sucht in Simons persoenlichem Obsidian Vault nach relevanten Notizen, Projekten, Kunden, Ideen oder Informationen. Nutze dieses Tool bei Fragen zu Simons Business, Projekten, Kunden oder gespeichertem Wissen.",
    input_schema: {
      type: "object" as const,
      properties: {
        query: {
          type: "string",
          description: "Suchanfrage, z.B. 'Porsche Projekt Status' oder 'Karin Meeting'",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "get_calendar",
    description:
      "Holt Termine aus Simons Google Calendar fuer einen bestimmten Zeitraum. Nutze dieses Tool bei Fragen wie 'Was steht heute an?', 'Habe ich naechste Woche Meetings?' oder 'Wann ist mein naechster Termin?'.",
    input_schema: {
      type: "object" as const,
      properties: {
        start: {
          type: "string",
          description: "Startdatum als ISO-String, z.B. '2026-05-03T00:00:00'",
        },
        end: {
          type: "string",
          description: "Enddatum als ISO-String, z.B. '2026-05-03T23:59:59'",
        },
      },
      required: ["start", "end"],
    },
  },
  {
    name: "get_recent_mails",
    description:
      "Holt die letzten Mails aus Simons Gmail-Postfach. Nutze dieses Tool bei Fragen wie 'Habe ich neue Mails?', 'Was hat Karin geschrieben?' oder 'Gibt es wichtige E-Mails?'.",
    input_schema: {
      type: "object" as const,
      properties: {
        limit: {
          type: "number",
          description: "Anzahl der Mails (Standard: 10, Maximum: 20)",
        },
      },
    },
  },
];

// ---------------------------------------------------------------------------
// Tool execution
// ---------------------------------------------------------------------------

export async function executeTool(
  name: string,
  input: Record<string, unknown>
): Promise<string> {
  try {
    switch (name) {
      case "search_vault": {
        const query = input.query as string;
        const results = await searchVault(query);
        const context = formatVaultContext(results);
        return context || "Keine relevanten Notizen im Vault gefunden.";
      }

      case "get_calendar": {
        const events = await getCalendarEvents(
          input.start as string,
          input.end as string
        );
        if (events.length === 0) return "Keine Termine in diesem Zeitraum.";
        return formatCalendarEvents(events);
      }

      case "get_recent_mails": {
        const limit = Math.min((input.limit as number) ?? 10, 20);
        const mails = await getRecentMails(limit);
        if (mails.length === 0) return "Keine Mails gefunden.";
        return formatMails(mails);
      }

      default:
        return `Unbekanntes Tool: ${name}`;
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unbekannter Fehler";
    return `Tool-Fehler (${name}): ${msg}`;
  }
}

// ---------------------------------------------------------------------------
// Formatters
// ---------------------------------------------------------------------------

function formatCalendarEvents(events: CalendarEvent[]): string {
  return events
    .map((e) => {
      const start = formatDateTime(e.start);
      const end = formatDateTime(e.end);
      const location = e.location ? `\n  Ort: ${e.location}` : "";
      return `${e.title}\n  ${start} bis ${end}${location}`;
    })
    .join("\n\n");
}

function formatMails(mails: MailSummary[]): string {
  return mails
    .map((m) => {
      const unread = m.unread ? "[UNGELESEN] " : "";
      return `${unread}Von: ${m.from}\nBetreff: ${m.subject}\nDatum: ${m.date}\n${m.snippet}`;
    })
    .join("\n\n---\n\n");
}

function formatDateTime(iso: string): string {
  if (!iso) return "";
  // Date-only events (all-day) have format YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
    const [, month, day] = iso.split("-");
    return `${day}.${month}.`;
  }
  const d = new Date(iso);
  return d.toLocaleString("de-DE", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}
