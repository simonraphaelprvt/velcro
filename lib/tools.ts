import type Anthropic from "@anthropic-ai/sdk";
import { searchVault, formatVaultContext } from "@/lib/vault-search";
import { getCalendarEvents, getRecentMails } from "@/lib/google";
import { gatherCallPrep, formatCallPrep } from "@/lib/call-prep";
import {
  saveDebrief,
  getOpenThreads,
  buildMorningBrief,
  formatMorningBrief,
  type SaveDebriefInput,
} from "@/lib/debrief";
import { createCalendarEvent } from "@/lib/google";
import { getWeather, formatWeather } from "@/lib/weather";
import { webSearch, formatWebSearch } from "@/lib/search";
import {
  searchSpotify,
  playSpotify,
  pauseSpotify,
  resumeSpotify,
  nextSpotify,
  getNowPlaying,
} from "@/lib/spotify";
import {
  buildConversationReplay,
  buildMoodBoard,
  buildRelationshipWeb,
  buildMirror,
  buildSpatialMap,
} from "@/lib/panels";
import { FEATURES } from "@/lib/config";
import type { CalendarEvent, MailSummary, DebriefTodo } from "@/lib/types";

// ---------------------------------------------------------------------------
// Tool definitions for Claude
// ---------------------------------------------------------------------------

const TODAY_CALENDAR_TOOL: Anthropic.Tool = {
  name: "get_today_calendar",
  description:
    "Holt alle Termine fuer den heutigen Tag direkt vom Server — kein Datum noetig. " +
    "Nutze DIESES Tool (nicht get_calendar) bei 'was steht heute an', 'habe ich heute Termine', " +
    "'was ist heute', 'Brief mich' ohne explizites Datum.",
  input_schema: {
    type: "object" as const,
    properties: {},
  },
};

const CALL_PREP_TOOL: Anthropic.Tool = {
  name: "prep_call",
  description:
    "Bereitet ein Call-Briefing fuer eine Person oder ein Thema vor. Nutze dieses Tool, " +
    "wenn Simon einen anstehenden Call, ein Meeting oder Gespraech erwaehnt — z.B. " +
    "'Ich habe gleich einen Call mit Karin', 'Bereite mich auf das Meeting mit Porsche vor', " +
    "'Was muss ich zu Mueller wissen'. Liefert in einem Schritt: vergangene Termine, " +
    "letzten Mailverkehr und relevante Vault-Notizen. WICHTIG: Nach dem Tool-Call das " +
    "Ergebnis exakt so weiterreichen wie es kommt — die Markdown-Struktur ist fuer das " +
    "Content-Panel optimiert. Im gesprochenen Teil: nenne den letzten Kontakt, das Thema " +
    "und 1-2 konkrete Talking Points.",
  input_schema: {
    type: "object" as const,
    properties: {
      person: {
        type: "string",
        description:
          "Name der Person, Firma oder des Themas, zu dem das Briefing erstellt werden soll. " +
          "Beispiele: 'Karin Mueller', 'Porsche', 'Olaf Scholz'",
      },
    },
    required: ["person"],
  },
};

const SAVE_DEBRIEF_TOOL: Anthropic.Tool = {
  name: "save_debrief",
  description:
    "Speichert ein strukturiertes Debrief eines abgeschlossenen Calls/Meetings im Vault. " +
    "Nutze dieses Tool NACH einer Debrief-Konversation, wenn Du alle Infos gesammelt hast " +
    "(Zusammenfassung, Entscheidungen, Todos, Stimmung, offene Threads). " +
    "WICHTIG: Sammle ZUERST die Infos durch Rueckfragen, dann speichere am Ende. " +
    "Bestaetige danach kurz: 'Debrief gespeichert.'",
  input_schema: {
    type: "object" as const,
    properties: {
      person: {
        type: "string",
        description: "Name der Person, Firma oder Thema des Calls (z.B. 'Karin Mueller')",
      },
      summary: {
        type: "string",
        description: "1-3 Saetze prosa Zusammenfassung des Gespraechs",
      },
      decisions: {
        type: "array",
        items: { type: "string" },
        description: "Konkrete Entscheidungen, die getroffen wurden",
      },
      todos: {
        type: "array",
        items: {
          type: "object",
          properties: {
            text: { type: "string", description: "Was zu tun ist" },
            due:  { type: "string", description: "Optional: Faelligkeit (z.B. 'Freitag', '2026-05-12')" },
          },
          required: ["text"],
        },
        description: "Konkrete Aktionspunkte fuer Simon",
      },
      mood: {
        type: "string",
        description: "Stimmung des Gespraechs: 'gut', 'neutral', 'angespannt' oder freier Text",
      },
      open_threads: {
        type: "array",
        items: { type: "string" },
        description: "Themen, die noch offen sind und in Folgegespraechen aufgegriffen werden sollten",
      },
    },
    required: ["person", "summary"],
  },
};

const MORNING_BRIEF_TOOL: Anthropic.Tool = {
  name: "morning_brief",
  description:
    "Erstellt das Morgen-Briefing fuer Simon: heutige Termine, offene Todos aus Debriefs, " +
    "ungelesene wichtige Mails. Nutze dieses Tool, wenn Simon 'Guten Morgen', 'Morning Brief', " +
    "'Was steht heute an' oder 'Brief mich' sagt. Liefert ein vollstaendiges Markdown-Briefing.",
  input_schema: {
    type: "object" as const,
    properties: {},
  },
};

// ─── Phase 4 Tools ────────────────────────────────────────────────────────

const CREATE_EVENT_TOOL: Anthropic.Tool = {
  name: "create_calendar_event",
  description:
    "Erstellt einen neuen Termin in Simons Google Calendar. Nutze, wenn Simon sagt " +
    "'Trag mir XY ein', 'Erstelle einen Termin', 'Block mir Zeit fuer ...'. " +
    "Bestaetige danach kurz mit Titel + Zeit.",
  input_schema: {
    type: "object" as const,
    properties: {
      title:       { type: "string", description: "Titel des Termins" },
      start:       { type: "string", description: "Start-Zeitpunkt als ISO mit Berlin TZ, z.B. '2026-05-06T14:00:00'" },
      end:         { type: "string", description: "End-Zeitpunkt als ISO, z.B. '2026-05-06T15:00:00'" },
      description: { type: "string", description: "Optionale Beschreibung" },
      location:    { type: "string", description: "Optionaler Ort" },
      attendees:   { type: "array", items: { type: "string" }, description: "Optionale E-Mail-Adressen" },
    },
    required: ["title", "start", "end"],
  },
};

const WEATHER_TOOL: Anthropic.Tool = {
  name: "get_weather",
  description:
    "Aktuelles Wetter und 4-Tage-Vorhersage. Nutze bei 'wie ist das Wetter', 'regnet es', " +
    "'soll ich eine Jacke mitnehmen'. Standard ist Berlin, andere Stadt optional.",
  input_schema: {
    type: "object" as const,
    properties: {
      city: { type: "string", description: "Optional: Stadt (Standard Berlin)" },
    },
  },
};

const WEB_SEARCH_TOOL: Anthropic.Tool = {
  name: "web_search",
  description:
    "Web-Suche fuer aktuelle Informationen, die nicht im Vault stehen — Nachrichten, " +
    "aktuelle Preise, oeffentliche Personen, neue Releases. Nutze NICHT fuer Simons " +
    "persoenliche Daten (dafuer search_vault).",
  input_schema: {
    type: "object" as const,
    properties: {
      query: { type: "string", description: "Suchanfrage" },
    },
    required: ["query"],
  },
};

const SPOTIFY_PLAY_TOOL: Anthropic.Tool = {
  name: "spotify_play",
  description:
    "Sucht einen Track/Artist/Playlist auf Spotify und spielt ihn ab. Nutze bei " +
    "'Spiel <X>', 'Lass <Künstler> laufen', 'Mach was Ruhiges an'. Bei Stimmungs-" +
    "anfragen ('was ruhiges') waehle eine passende Suchanfrage (z.B. 'ambient chill').",
  input_schema: {
    type: "object" as const,
    properties: {
      query: { type: "string", description: "Suchbegriff fuer Spotify (Track, Artist, Stimmung)" },
    },
    required: ["query"],
  },
};

const SPOTIFY_CONTROL_TOOL: Anthropic.Tool = {
  name: "spotify_control",
  description:
    "Steuert die laufende Spotify-Wiedergabe. Aktionen: pause, resume, next, status. " +
    "Nutze bei 'Pause', 'Stop', 'Weiter', 'Naechstes Lied', 'Was laeuft gerade'.",
  input_schema: {
    type: "object" as const,
    properties: {
      action: {
        type:        "string",
        enum:        ["pause", "resume", "next", "status"],
        description: "Aktion",
      },
    },
    required: ["action"],
  },
};

// ─── Phase 5 — Visual Panels ──────────────────────────────────────────────

const DECISION_MATRIX_TOOL: Anthropic.Tool = {
  name: "decision_matrix",
  description:
    "Visualisiert eine Entscheidung als gewichtete Matrix. Nutze, wenn Simon zwischen " +
    "konkreten Optionen abwaegt — 'Soll ich A oder B', 'Was waere besser', 'Hilf mir entscheiden'. " +
    "DU als Claude entscheidest sinnvolle Faktoren + Gewichtung + Bewertung pro Option (0-10) " +
    "basierend auf dem was Simon gesagt hat. Empfehlung am Ende ist deine begruendete Wahl.",
  input_schema: {
    type: "object" as const,
    properties: {
      question: { type: "string", description: "Die Entscheidungsfrage in einem Satz" },
      options:  { type: "array",  items: { type: "string" }, description: "Die zu vergleichenden Optionen (2-4)" },
      factors: {
        type: "array",
        items: {
          type: "object",
          properties: {
            name:   { type: "string", description: "Name des Faktors (z.B. 'Kosten', 'Zeit')" },
            weight: { type: "number", description: "Gewichtung 1-5" },
            scores: { type: "array", items: { type: "number" }, description: "Score 0-10 pro Option, gleiche Reihenfolge wie options" },
          },
          required: ["name", "weight", "scores"],
        },
        description: "3-6 relevante Bewertungs-Faktoren",
      },
      recommendation: { type: "string", description: "Deine begruendete Empfehlung in 1-2 Saetzen" },
    },
    required: ["question", "options", "factors", "recommendation"],
  },
};

const SCENARIO_TREE_TOOL: Anthropic.Tool = {
  name: "scenario_tree",
  description:
    "Visualisiert verschiedene 'Was-waere-wenn' Szenarien als Verzweigungsbaum. Nutze bei " +
    "'Was passiert wenn ich X', 'Welche Konsequenzen haette Y', 'Spiel mir Szenarien durch'. " +
    "Generiere 2-3 Hauptzweige mit jeweils 2-4 Konsequenzen.",
  input_schema: {
    type: "object" as const,
    properties: {
      question: { type: "string", description: "Die Ausgangsfrage" },
      branches: {
        type: "array",
        items: {
          type: "object",
          properties: {
            condition:    { type: "string" },
            consequences: { type: "array", items: { type: "string" } },
          },
          required: ["condition", "consequences"],
        },
      },
    },
    required: ["question", "branches"],
  },
};

const CONV_REPLAY_TOOL: Anthropic.Tool = {
  name: "conversation_replay",
  description:
    "Zeigt eine Timeline der letzten Konversationen. Nutze bei 'Was haben wir besprochen', " +
    "'Zeig mir die letzten Gespraeche', 'Worueber haben wir geredet'. Standard 7 Tage.",
  input_schema: {
    type: "object" as const,
    properties: {
      days: { type: "number", description: "Anzahl Tage zurueck (Standard 7)" },
    },
  },
};

const RELATIONSHIP_WEB_TOOL: Anthropic.Tool = {
  name: "relationship_web",
  description:
    "Visualisiert Simons aktives Kontakt-Netzwerk als radialen Graph. Nutze bei " +
    "'Mein Netzwerk', 'Wer ist alles in meinem Umfeld', 'Zeig mir meine Kontakte'.",
  input_schema: {
    type: "object" as const,
    properties: {},
  },
};

const MOOD_BOARD_TOOL: Anthropic.Tool = {
  name: "mood_board",
  description:
    "Stimmungsverlauf der letzten Tage als visuelles Board. Nutze bei 'Wie ging es mir', " +
    "'Stimmungsverlauf', 'Wie war die Woche'.",
  input_schema: {
    type: "object" as const,
    properties: {
      days: { type: "number", description: "Anzahl Tage zurueck (Standard 7)" },
    },
  },
};

const MIRROR_TOOL: Anthropic.Tool = {
  name: "mirror",
  description:
    "Spiegel-Analyse: erkannte Muster in Simons Gespraechen und Debriefs. Nutze bei " +
    "'Spiegel', 'Was sind meine Muster', 'Reflexion', 'Was beschaeftigt mich'.",
  input_schema: {
    type: "object" as const,
    properties: {},
  },
};

const SPATIAL_MAP_TOOL: Anthropic.Tool = {
  name: "spatial_map",
  description:
    "Zeigt Orte aus Simons Kalender (vergangene und kommende Termine mit Location). " +
    "Nutze bei 'Wo war ich diese Woche', 'Welche Orte', 'Reisen'.",
  input_schema: {
    type: "object" as const,
    properties: {
      days: { type: "number", description: "Anzahl Tage zurueck (Standard 14)" },
    },
  },
};

const OPEN_THREADS_TOOL: Anthropic.Tool = {
  name: "get_open_threads",
  description:
    "Liefert alle offenen Todos und ungeklaerten Threads aus den letzten Debriefs. " +
    "Nutze dieses Tool bei Fragen wie 'Was ist noch offen?', 'Welche Todos habe ich noch?', " +
    "'Was muss ich noch erledigen?'.",
  input_schema: {
    type: "object" as const,
    properties: {},
  },
};

export const VELCRO_TOOLS: Anthropic.Tool[] = [
  TODAY_CALENDAR_TOOL,
  CREATE_EVENT_TOOL,
  ...(FEATURES.callPrep     ? [CALL_PREP_TOOL]     : []),
  ...(FEATURES.debrief      ? [SAVE_DEBRIEF_TOOL, OPEN_THREADS_TOOL] : []),
  ...(FEATURES.morningBrief ? [MORNING_BRIEF_TOOL] : []),
  ...(FEATURES.weather      ? [WEATHER_TOOL]       : []),
  ...(FEATURES.webSearch    ? [WEB_SEARCH_TOOL]    : []),
  ...(FEATURES.spotify      ? [SPOTIFY_PLAY_TOOL, SPOTIFY_CONTROL_TOOL] : []),
  // Phase 5 — Visual Panels
  ...(FEATURES.decisionMatrix     ? [DECISION_MATRIX_TOOL]  : []),
  ...(FEATURES.scenario           ? [SCENARIO_TREE_TOOL]    : []),
  ...(FEATURES.conversationReplay ? [CONV_REPLAY_TOOL]      : []),
  ...(FEATURES.relationshipWeb    ? [RELATIONSHIP_WEB_TOOL] : []),
  ...(FEATURES.moodBoard          ? [MOOD_BOARD_TOOL]       : []),
  ...(FEATURES.mirror             ? [MIRROR_TOOL]           : []),
  ...(FEATURES.spatialMap         ? [SPATIAL_MAP_TOOL]      : []),
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
      case "get_today_calendar": {
        const now   = new Date();
        const start = new Date(now); start.setHours(0, 0, 0, 0);
        const end   = new Date(now); end.setHours(23, 59, 59, 999);
        const events = await getCalendarEvents(start.toISOString(), end.toISOString());
        if (events.length === 0) return "Heute keine Termine.";
        return formatCalendarEvents(events);
      }

      case "create_calendar_event": {
        const event = await createCalendarEvent({
          title:       (input.title as string),
          start:       (input.start as string),
          end:         (input.end as string),
          description: (input.description as string) ?? undefined,
          location:    (input.location as string) ?? undefined,
          attendees:   (input.attendees as string[]) ?? undefined,
        });
        const when = new Date(event.start).toLocaleString("de-DE", {
          weekday: "short", day: "2-digit", month: "2-digit",
          hour: "2-digit", minute: "2-digit",
          timeZone: "Europe/Berlin",
        });
        return `Termin erstellt: ${event.title} am ${when}.`;
      }

      case "get_weather": {
        const w = await getWeather((input.city as string) ?? "Berlin");
        return formatWeather(w);
      }

      case "web_search": {
        const q = (input.query as string)?.trim();
        if (!q) return "Keine Suchanfrage.";
        const s = await webSearch(q);
        return formatWebSearch(s);
      }

      case "spotify_play": {
        const q = (input.query as string)?.trim();
        if (!q) return "Kein Suchbegriff.";
        const tracks = await searchSpotify(q, 1);
        if (!tracks.length) return `Nichts gefunden zu "${q}".`;
        const track = tracks[0];
        await playSpotify(track.uri);
        return `Spielt jetzt: ${track.name} von ${track.artist}.`;
      }

      // ── Phase 5 ─────────────────────────────────────────────────────
      case "decision_matrix": {
        const data = {
          question:       input.question,
          options:        input.options,
          factors:        input.factors,
          recommendation: input.recommendation,
        };
        // Compute the winner so the spoken summary names it
        const factors = input.factors as { weight: number; scores: number[] }[];
        const options = input.options as string[];
        const totals  = options.map((_, i) =>
          factors.reduce((s, f) => s + (f.scores[i] ?? 0) * f.weight, 0)
        );
        const winnerIdx = totals.indexOf(Math.max(...totals));
        const winner    = options[winnerIdx];
        const summary =
          `Meine Empfehlung ist ${winner}. ${input.recommendation}`;
        return `${summary}\n\nVELCRO_PANEL:decision-matrix\n${JSON.stringify(data, null, 2)}`;
      }

      case "scenario_tree": {
        const data = { question: input.question, branches: input.branches };
        const branches = input.branches as { condition: string; consequences: string[] }[];
        // Speak the conditions only — keep it short for TTS
        const conditions = branches.map((b) => b.condition).join(", oder ");
        const summary = `Drei moegliche Wege: ${conditions}. Im Panel sehen Sie die Konsequenzen jedes Szenarios.`;
        return `${summary}\n\nVELCRO_PANEL:scenario-tree\n${JSON.stringify(data, null, 2)}`;
      }

      case "conversation_replay": {
        return await buildConversationReplay((input.days as number) ?? 7);
      }

      case "relationship_web": {
        return await buildRelationshipWeb();
      }

      case "mood_board": {
        return await buildMoodBoard((input.days as number) ?? 7);
      }

      case "mirror": {
        return await buildMirror((input.days as number) ?? 14);
      }

      case "spatial_map": {
        return await buildSpatialMap((input.days as number) ?? 14);
      }

      case "spotify_control": {
        const action = input.action as string;
        switch (action) {
          case "pause":  await pauseSpotify();  return "Pausiert.";
          case "resume": await resumeSpotify(); return "Fortgesetzt.";
          case "next":   await nextSpotify();   return "Naechster Track.";
          case "status": {
            const np = await getNowPlaying();
            if (!np.track) return "Aktuell laeuft nichts.";
            const state = np.isPlaying ? "Laeuft" : "Pausiert";
            return `${state}: ${np.track.name} von ${np.track.artist}.`;
          }
          default: return `Unbekannte Aktion: ${action}`;
        }
      }

      case "prep_call": {
        const person = (input.person as string)?.trim();
        if (!person) return "Kein Name oder Thema angegeben.";
        const data = await gatherCallPrep(person);
        return formatCallPrep(person, data);
      }

      case "save_debrief": {
        const payload: SaveDebriefInput = {
          person:       (input.person as string)?.trim() ?? "",
          summary:      (input.summary as string)?.trim() ?? "",
          decisions:    (input.decisions as string[]) ?? [],
          todos:        ((input.todos as Array<{ text: string; due?: string }>) ?? [])
                         .map<DebriefTodo>((t) => ({ text: t.text, done: false, due: t.due })),
          mood:         (input.mood as string) ?? undefined,
          open_threads: (input.open_threads as string[]) ?? [],
        };
        if (!payload.person || !payload.summary) {
          return "Fehlende Pflichtfelder (person, summary).";
        }
        const saved = await saveDebrief(payload);
        return `Debrief gespeichert (id: ${saved.id}). ${payload.todos?.length ?? 0} Todos, ${payload.open_threads?.length ?? 0} offene Threads.`;
      }

      case "morning_brief": {
        const data = await buildMorningBrief();
        return formatMorningBrief(data);
      }

      case "get_open_threads": {
        const open = await getOpenThreads();
        if (!open.todos.length && !open.threads.length) {
          return "Keine offenen Todos oder Threads.";
        }
        const lines: string[] = [];
        if (open.todos.length) {
          lines.push("## Offene Todos");
          for (const t of open.todos) {
            const due = t.due ? ` _(bis ${t.due})_` : "";
            lines.push(`- **${t.person}**: ${t.text}${due}`);
          }
        }
        if (open.threads.length) {
          if (lines.length) lines.push("");
          lines.push("## Offene Threads");
          for (const th of open.threads) {
            lines.push(`- **${th.person}**: ${th.text}`);
          }
        }
        return lines.join("\n");
      }

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
