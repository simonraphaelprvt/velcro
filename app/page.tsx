"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { useVelcro } from "@/hooks/useVelcro";
import { VelcroOrb } from "@/components/VelcroOrb";
import { ContentWindow, hasStructuredContent } from "@/components/ContentWindow";

const statusLabel: Record<string, string> = {
  idle:         "",
  recording:    "",
  transcribing: "Verarbeite...",
  thinking:     "Denkt...",
  speaking:     "Spricht...",
};

// ── Orb position type ─────────────────────────────────────────────────
interface OrbTransform { x: number; y: number; scale: number }

function randomIdle(): OrbTransform {
  const angle = Math.random() * Math.PI * 2;
  const dist  = 20 + Math.random() * 65;
  return {
    x:     Math.cos(angle) * dist,
    y:     Math.sin(angle) * dist,
    scale: 0.88 + Math.random() * 0.26,
  };
}

function randomBesideWindow(side: "left" | "right"): OrbTransform {
  const sign = side === "right" ? 1 : -1;
  return {
    x:     sign * (250 + Math.random() * 70),
    y:     (Math.random() - 0.5) * 200,
    scale: 0.52 + Math.random() * 0.2,
  };
}

// ── Page ──────────────────────────────────────────────────────────────
export default function Home() {
  const { messages, status, startListening, stopListening, analyserNode } = useVelcro();
  const spaceActiveRef = useRef(false);

  // Content window — opens automatically when response has structured content,
  // closes only when user explicitly dismisses it.
  const [dismissedId, setDismissedId] = useState<string | null>(null);
  const latestAssistant = [...messages].reverse().find((m) => m.role === "assistant");
  const latestUser      = [...messages].reverse().find((m) => m.role === "user");

  const showContentWindow =
    !!latestAssistant?.content &&
    hasStructuredContent(latestAssistant.content) &&
    latestAssistant.id !== dismissedId &&
    status === "idle";

  // ── Orb wander ───────────────────────────────────────────────────────
  const [orbT, setOrbT] = useState<OrbTransform>({ x: 0, y: 0, scale: 1 });
  const wanderRef     = useRef<ReturnType<typeof setTimeout> | null>(null);
  const windowSideRef = useRef<"left" | "right">("right");
  const showWinRef    = useRef(false);

  // Keep ref in sync so the wander timer always reads the latest value
  useEffect(() => { showWinRef.current = showContentWindow; }, [showContentWindow]);

  const scheduleWander = useCallback(() => {
    if (wanderRef.current) clearTimeout(wanderRef.current);
    const delay = 2600 + Math.random() * 2800;
    wanderRef.current = setTimeout(() => {
      setOrbT(showWinRef.current
        ? randomBesideWindow(windowSideRef.current)
        : randomIdle()
      );
      scheduleWander();
    }, delay);
  }, []);

  // Immediately reposition when window opens/closes
  useEffect(() => {
    if (showContentWindow) {
      windowSideRef.current = Math.random() > 0.5 ? "right" : "left";
      setOrbT(randomBesideWindow(windowSideRef.current));
    } else {
      setOrbT(randomIdle());
    }
    scheduleWander();
    return () => { if (wanderRef.current) clearTimeout(wanderRef.current); };
  }, [showContentWindow, scheduleWander]);

  // ── Toggle ────────────────────────────────────────────────────────────
  const toggleListening = useCallback(() => {
    if (status === "idle")      startListening();
    else if (status === "recording") stopListening();
  }, [status, startListening, stopListening]);

  // Spacebar toggle
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.code !== "Space" || e.repeat || spaceActiveRef.current) return;
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
    e.preventDefault();
    spaceActiveRef.current = true;
    toggleListening();
  }, [toggleListening]);
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
      {/* Deep ambient glow */}
      <div
        className="pointer-events-none absolute h-[600px] w-[600px] rounded-full blur-[130px]"
        style={{ background: "radial-gradient(circle, rgba(99,102,241,0.06), transparent 70%)" }}
      />

      {/* Status dot */}
      <span className={[
        "absolute right-6 top-6 h-1.5 w-1.5 rounded-full transition-colors duration-700",
        status === "idle" ? "bg-velcro-border" : "bg-velcro-accent-2",
      ].join(" ")} />

      {/* ── Orb — positioned via wandering transform ─────────────────── */}
      <div
        style={{
          transform: `translate(${orbT.x}px, ${orbT.y}px) scale(${orbT.scale})`,
          transition: "transform 2.6s cubic-bezier(0.4, 0, 0.2, 1)",
        }}
      >
        <div className="flex flex-col items-center gap-12">
          <VelcroOrb
            status={status}
            analyserNode={analyserNode}
            onClick={toggleListening}
          />
          <div className="h-4">
            {label && (
              <p className="animate-fade-in text-xs tracking-widest text-velcro-dim">
                {label.toUpperCase()}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Last exchange — pinned to bottom, not part of the wandering orb */}
      {(latestUser || latestAssistant) && (
        <div className="pointer-events-none absolute bottom-10 left-1/2 flex w-full max-w-sm -translate-x-1/2 flex-col items-center gap-1.5 px-6 text-center">
          {latestUser && (
            <p className="animate-fade-in line-clamp-1 text-[11px] text-velcro-dim">
              {latestUser.content}
            </p>
          )}
          {latestAssistant?.content && status !== "idle" && (
            <p className="animate-fade-in line-clamp-2 text-[11px] text-velcro-text/60">
              {latestAssistant.content}
            </p>
          )}
        </div>
      )}

      {/* Content window */}
      {showContentWindow && latestAssistant && (
        <ContentWindow
          content={latestAssistant.content}
          onDismiss={() => setDismissedId(latestAssistant.id ?? null)}
        />
      )}
    </main>
  );
}
