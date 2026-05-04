"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { useVelcro } from "@/hooks/useVelcro";
import { VelcroOrb } from "@/components/VelcroOrb";
import { ContentWindow, hasStructuredContent } from "@/components/ContentWindow";

const statusLabel: Record<string, string> = {
  idle:        "",
  recording:   "",           // shown inline on orb now
  transcribing: "Verarbeite...",
  thinking:    "Denkt...",
  speaking:    "Spricht...",
};

export default function Home() {
  const { messages, status, startListening, stopListening, analyserNode } = useVelcro();
  const spaceActiveRef = useRef(false);

  const [contentToDismiss, setContentToDismiss] = useState<string | null>(null);

  const latestAssistant = [...messages].reverse().find((m) => m.role === "assistant");
  const latestUser      = [...messages].reverse().find((m) => m.role === "user");

  // Auto-open content window for structured responses
  useEffect(() => {
    if (
      latestAssistant?.content &&
      status === "idle" &&
      hasStructuredContent(latestAssistant.content) &&
      contentToDismiss !== latestAssistant.id
    ) {
      setContentToDismiss(latestAssistant.id ?? null);
    }
  }, [latestAssistant, status, contentToDismiss]);

  const showContentWindow =
    latestAssistant?.content &&
    hasStructuredContent(latestAssistant.content) &&
    contentToDismiss !== latestAssistant.id &&
    status === "idle";

  // ── Toggle handler (click + spacebar) ──────────────────────────────
  const toggleListening = useCallback(() => {
    if (status === "idle")      startListening();
    else if (status === "recording") stopListening();
  }, [status, startListening, stopListening]);

  // Spacebar toggles (no hold-to-talk — single press = start/stop)
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.code !== "Space" || e.repeat || spaceActiveRef.current) return;
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      e.preventDefault();
      spaceActiveRef.current = true;
      toggleListening();
    },
    [toggleListening]
  );

  const handleKeyUp = useCallback((e: KeyboardEvent) => {
    if (e.code === "Space") spaceActiveRef.current = false;
  }, []);

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [handleKeyDown, handleKeyUp]);

  const label = statusLabel[status];

  return (
    <main className="relative flex h-screen flex-col items-center justify-center overflow-hidden bg-velcro-bg">
      {/* Deep ambient radial glow */}
      <div
        className="pointer-events-none absolute h-[600px] w-[600px] rounded-full opacity-[0.05] blur-[120px]"
        style={{ background: "radial-gradient(circle, #6366f1, transparent 70%)" }}
      />

      {/* Live status dot — top right */}
      <span
        className={[
          "absolute right-6 top-6 h-1.5 w-1.5 rounded-full transition-colors duration-700",
          status === "idle" ? "bg-velcro-border" : "bg-velcro-accent-2",
        ].join(" ")}
      />

      {/* Central orb */}
      <div className="flex flex-col items-center gap-14">
        <VelcroOrb
          status={status}
          analyserNode={analyserNode}
          onClick={toggleListening}
        />

        {/* Status text */}
        <div className="h-4">
          {label ? (
            <p className="animate-fade-in text-xs tracking-widest text-velcro-dim">
              {label.toUpperCase()}
            </p>
          ) : null}
        </div>
      </div>

      {/* Last exchange */}
      {(latestUser || latestAssistant) && (
        <div className="absolute bottom-12 left-1/2 flex w-full max-w-md -translate-x-1/2 flex-col items-center gap-2 px-6 text-center">
          {latestUser && (
            <p className="animate-fade-in line-clamp-1 text-xs text-velcro-dim">
              {latestUser.content}
            </p>
          )}
          {latestAssistant?.content && status !== "idle" && (
            <p className="animate-fade-in line-clamp-2 text-xs text-velcro-text/70">
              {latestAssistant.content}
            </p>
          )}
        </div>
      )}

      {/* Content window for structured responses */}
      {showContentWindow && latestAssistant && (
        <ContentWindow
          content={latestAssistant.content}
          onDismiss={() => setContentToDismiss(latestAssistant.id ?? null)}
        />
      )}
    </main>
  );
}
