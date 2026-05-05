"use client";

import { useEffect, useState } from "react";

interface Capability {
  label:    string;
  examples: string[];
}

interface CapabilityGroup {
  title:        string;
  capabilities: Capability[];
}

const CAPABILITIES: CapabilityGroup[] = [
  {
    title: "Wissen",
    capabilities: [
      { label: "Vault-Suche",       examples: ["Was weiß ich über Karin?", "Status vom Porsche-Projekt?"] },
      { label: "Web-Suche",         examples: ["Aktuelle Bayern-News", "Wer hat heute gewonnen?"] },
      { label: "Wetter",            examples: ["Wie ist das Wetter?", "Brauch ich eine Jacke?"] },
    ],
  },
  {
    title: "Kalender & Mails",
    capabilities: [
      { label: "Heutige Termine",   examples: ["Was steht heute an?", "Hab ich heute Termine?"] },
      { label: "Termin erstellen",  examples: ["Trag mir 14 Uhr Call mit Karin ein"] },
      { label: "Mails",             examples: ["Hab ich neue Mails?", "Was hat Karin geschrieben?"] },
      { label: "Morgen-Briefing",   examples: ["Guten Morgen", "Brief mich"] },
    ],
  },
  {
    title: "Calls & Debriefs",
    capabilities: [
      { label: "Call-Vorbereitung", examples: ["Bereite mich auf das Meeting mit Porsche vor"] },
      { label: "Debrief speichern", examples: ["Lass uns den Call mit Karin nachbesprechen"] },
      { label: "Offene Aufgaben",   examples: ["Was ist noch offen?", "Meine Aufgaben"] },
    ],
  },
  {
    title: "Spotify",
    capabilities: [
      { label: "Spielen",           examples: ["Spiel was Ruhiges", "Lass Bowie laufen"] },
      { label: "Steuern",           examples: ["Pause", "Weiter", "Was läuft gerade?"] },
    ],
  },
  {
    title: "Visuelle Panels",
    capabilities: [
      { label: "Decision Matrix",   examples: ["Soll ich A oder B kaufen?", "Hilf mir entscheiden"] },
      { label: "Scenario Tree",     examples: ["Was passiert wenn ich kündige?"] },
      { label: "Conversation Replay", examples: ["Was haben wir letzte Woche besprochen?"] },
      { label: "Relationship Web",  examples: ["Mein Netzwerk", "Meine Kontakte"] },
      { label: "Mood Board",        examples: ["Wie war meine Woche?", "Stimmungsverlauf"] },
      { label: "Mirror",            examples: ["Was sind meine Muster?", "Spiegel"] },
      { label: "Spatial Map",       examples: ["Wo war ich diese Woche?"] },
    ],
  },
  {
    title: "Bedienung",
    capabilities: [
      { label: "Wake Word",         examples: ["Hey VELCRO sagen — VELCRO erwacht von selbst"] },
      { label: "Push-to-Talk",      examples: ["Leertaste oder auf den Orb klicken"] },
    ],
  },
];

export function HelpButton() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && open) setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      {/* Trigger */}
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Was kann VELCRO?"
        className={[
          "absolute bottom-5 left-5 z-40",
          "flex h-6 w-6 items-center justify-center rounded-full",
          "border border-velcro-border/60 bg-velcro-bg/40 text-[11px] text-velcro-dim",
          "backdrop-blur-md transition-all duration-300",
          "hover:border-velcro-accent/60 hover:bg-velcro-surface/70 hover:text-velcro-text",
          open ? "border-velcro-accent/80 text-velcro-text" : "",
        ].join(" ")}
      >
        ?
      </button>

      {/* Panel */}
      {open && (
        <>
          {/* Click-outside catcher */}
          <div
            className="fixed inset-0 z-30"
            onClick={() => setOpen(false)}
          />

          <div
            className="absolute bottom-14 left-5 z-40 w-[320px] max-h-[70vh] overflow-y-auto rounded-2xl border border-velcro-border bg-velcro-bg/95 p-5 shadow-[0_0_60px_rgba(99,102,241,0.15)] backdrop-blur-md"
            style={{ animation: "velcro-help-in 0.25s cubic-bezier(0.4,0,0.2,1) both" }}
          >
            <div className="mb-4 flex items-baseline justify-between">
              <div>
                <div className="text-[9px] uppercase tracking-[0.3em] text-velcro-dim">VELCRO</div>
                <div className="mt-0.5 text-sm font-medium text-velcro-text">Was Sie sagen können</div>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="text-velcro-dim transition-colors hover:text-velcro-text"
                aria-label="Schließen"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <div className="space-y-5">
              {CAPABILITIES.map((group) => (
                <div key={group.title}>
                  <div className="mb-2 text-[9px] uppercase tracking-[0.25em] text-velcro-accent/70">
                    {group.title}
                  </div>
                  <div className="space-y-2">
                    {group.capabilities.map((cap) => (
                      <div key={cap.label}>
                        <div className="text-xs text-velcro-text">{cap.label}</div>
                        {cap.examples.map((ex, i) => (
                          <div key={i} className="mt-0.5 pl-2 text-[10px] italic leading-snug text-velcro-dim">
                            „{ex}"
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-5 border-t border-velcro-border/40 pt-3 text-center text-[9px] tracking-[0.25em] text-velcro-dim/50">
              ESC
            </div>
          </div>
        </>
      )}
    </>
  );
}
