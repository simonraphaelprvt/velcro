"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { useVelcro } from "@/hooks/useVelcro";
import { VelcroOrb } from "@/components/VelcroOrb";
import { ContentWindow, hasStructuredContent } from "@/components/ContentWindow";

// Status label shown below the orb
const statusLabel: Record<string, string> = {
  idle: "",
  recording: "Hoere zu...",
  transcribing: "Verarbeite...",
  thinking: "Denkt...",
  speaking: "Spricht...",
};

export default function Home() {
  const { messages, status, startListening, stopListening, analyserNode } = useVelcro();
  const spaceActiveRef = useRef(false);

  // Content window: shows when latest assistant message has structured content
  const [contentToDismiss, setContentToDismiss] = useState<string | null>(null);

  const latestAssistant = [...messages].reverse().find((m) => m.role === "assistant");
  const latestUser = [...messages].reverse().find((m) => m.role === "user");

  // Detect structured content and auto-open window
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

  // Spacebar push-to-talk
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.code !== "Space" || e.repeat || spaceActiveRef.current) return;
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      e.preventDefault();
      spaceActiveRef.current = true;
      startListening();
    },
    [startListening]
  );

  const handleKeyUp = useCallback(
    (e: KeyboardEvent) => {
      if (e.code !== "Space" || !spaceActiveRef.current) return;
      e.preventDefault();
      spaceActiveRef.current = false;
      stopListening();
    },
    [stopListening]
  );

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
      {/* Ambient background glow behind orb */}
      <div
        className="pointer-events-none absolute h-[500px] w-[500px] rounded-full opacity-[0.07] blur-[100px]"
        style={{ background: "radial-gradient(circle, #7c3aed, transparent 70%)" }}
      />

      {/* Wordmark — top left */}
      <span className="absolute left-6 top-6 font-mono text-[10px] tracking-[0.5em] text-velcro-dim">
        VELCRO
      </span>

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
          onClick={startListening}
        />

        {/* Status text below orb */}
        <div className="h-4">
          {label ? (
            <p className="animate-fade-in text-xs tracking-widest text-velcro-dim">{label.toUpperCase()}</p>
          ) : null}
        </div>
      </div>

      {/* Last exchange — fades in below, subtle */}
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

      {/* Content window overlay for structured responses */}
      {showContentWindow && latestAssistant && (
        <ContentWindow
          content={latestAssistant.content}
          onDismiss={() => setContentToDismiss(latestAssistant.id ?? null)}
        />
      )}
    </main>
  );
}
