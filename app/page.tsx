"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { useVelcro } from "@/hooks/useVelcro";
import { useWakeWord } from "@/hooks/useWakeWord";
import { VelcroOrb } from "@/components/VelcroOrb";
import { ContentWindow, hasStructuredContent } from "@/components/ContentWindow";
import { HelpButton } from "@/components/HelpButton";
import { FEATURES } from "@/lib/config";

const statusLabel: Record<string, string> = {
  idle:         "",
  recording:    "",
  transcribing: "Verarbeite...",
  thinking:     "Denkt...",
  speaking:     "",   // orb is moving around window, no label needed
};

interface OrbTransform { x: number; y: number; scale: number }

function randomIdle(): OrbTransform {
  const angle = Math.random() * Math.PI * 2;
  const dist  = 20 + Math.random() * 65;
  return { x: Math.cos(angle) * dist, y: Math.sin(angle) * dist, scale: 0.88 + Math.random() * 0.26 };
}

function randomBesideWindow(side: "left" | "right"): OrbTransform {
  const sign = side === "right" ? 1 : -1;
  return {
    x:     sign * (310 + Math.random() * 70),
    y:     (Math.random() - 0.5) * 260,
    scale: 0.48 + Math.random() * 0.22,
  };
}

export default function Home() {
  const { messages, status, startListening, stopListening, analyserNode } = useVelcro();
  const spaceActiveRef = useRef(false);

  const [dismissedId, setDismissedId] = useState<string | null>(null);
  const latestAssistant = [...messages].reverse().find((m) => m.role === "assistant");
  const latestUser      = [...messages].reverse().find((m) => m.role === "user");

  // Show window while speaking AND while idle — so orb is beside it as VELCRO explains
  const showContentWindow =
    !!latestAssistant?.content &&
    hasStructuredContent(latestAssistant.content) &&
    latestAssistant.id !== dismissedId &&
    (status === "idle" || status === "speaking");

  // ── Orb wander ───────────────────────────────────────────────────────
  const [orbT, setOrbT] = useState<OrbTransform>({ x: 0, y: 0, scale: 1 });
  const wanderRef     = useRef<ReturnType<typeof setTimeout> | null>(null);
  const windowSideRef = useRef<"left" | "right">("right");
  const showWinRef    = useRef(false);

  useEffect(() => { showWinRef.current = showContentWindow; }, [showContentWindow]);

  const scheduleWander = useCallback(() => {
    if (wanderRef.current) clearTimeout(wanderRef.current);
    const delay = 2200 + Math.random() * 2400;
    wanderRef.current = setTimeout(() => {
      setOrbT(showWinRef.current ? randomBesideWindow(windowSideRef.current) : randomIdle());
      scheduleWander();
    }, delay);
  }, []);

  useEffect(() => {
    if (showContentWindow) {
      windowSideRef.current = Math.random() > 0.5 ? "right" : "left";
      // Slight delay before orb moves — let window animate in first
      setTimeout(() => setOrbT(randomBesideWindow(windowSideRef.current)), 350);
    } else {
      setOrbT(randomIdle());
    }
    scheduleWander();
    return () => { if (wanderRef.current) clearTimeout(wanderRef.current); };
  }, [showContentWindow, scheduleWander]);

  // ── Toggle ────────────────────────────────────────────────────────────
  const toggleListening = useCallback(() => {
    if (status === "idle")           startListening();
    else if (status === "recording") stopListening();
  }, [status, startListening, stopListening]);

  // ── Wake Word ("Hey VELCRO") ──────────────────────────────────────────
  const { supported: wakeSupported, listening: wakeListening, primeFromGesture } = useWakeWord({
    enabled: FEATURES.wakeWord,
    status,
    onWake: () => {
      if (status === "idle") startListening();
    },
  });

  // ── First-touch primer ────────────────────────────────────────────────
  // Wake-word callbacks aren't a "user gesture" in Safari, so AudioContext
  // creation inside startListening() can fail when triggered by voice. Prime
  // it on ANY first user interaction (click anywhere, key press) so the
  // wake-word path works on subsequent activations.
  const [primed, setPrimed] = useState(false);
  useEffect(() => {
    if (primed) return;
    const prime = () => {
      // Touch the recorder + AudioContext path silently so Safari unlocks audio.
      // We don't actually start recording — just trigger the gesture lock.
      try {
        // A no-op AudioContext.resume() inside a real gesture is enough.
        const Ctx = window.AudioContext;
        if (Ctx) {
          const ctx = new Ctx();
          ctx.resume().catch(() => {});
          // Don't keep the throwaway context — let it close.
          setTimeout(() => ctx.close().catch(() => {}), 0);
        }
      } catch { /* ignore */ }
      // Safari: kick off wake word recognition now that we have a user gesture
      primeFromGesture();
      setPrimed(true);
    };
    window.addEventListener("pointerdown", prime, { once: true, passive: true });
    window.addEventListener("keydown",     prime, { once: true });
    return () => {
      window.removeEventListener("pointerdown", prime);
      window.removeEventListener("keydown",     prime);
    };
  }, [primed]);

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
      {/* Ambient glow */}
      <div
        className="pointer-events-none absolute h-[600px] w-[600px] rounded-full blur-[130px]"
        style={{ background: "radial-gradient(circle, rgba(99,102,241,0.06), transparent 70%)" }}
      />

      {/* Help button — bottom left, capabilities legend */}
      <HelpButton />

      {/* Status dot */}
      <span className={[
        "absolute right-6 top-6 h-1.5 w-1.5 rounded-full transition-colors duration-700",
        status === "idle" ? "bg-velcro-border" : "bg-velcro-accent-2",
      ].join(" ")} />

      {/* Wake-word indicator — bottom right, only when supported */}
      {FEATURES.wakeWord && wakeSupported && (
        <div className="pointer-events-none absolute bottom-5 right-6 flex items-center gap-2">
          <span
            className={[
              "h-1.5 w-1.5 rounded-full transition-colors duration-500",
              wakeListening ? "bg-velcro-accent animate-wake-pulse" : "bg-velcro-border",
            ].join(" ")}
          />
          <span className="text-[9px] tracking-[0.3em] text-velcro-dim/60">
            {wakeListening ? "HEY VELCRO" : "—"}
          </span>
        </div>
      )}

      {/* Content window — rendered BEFORE orb in DOM so orb sits on top (z-30) */}
      {showContentWindow && latestAssistant && (
        <ContentWindow
          content={latestAssistant.content}
          onDismiss={() => setDismissedId(latestAssistant.id ?? null)}
        />
      )}

      {/* Orb — z-30 ensures it always floats above the content panel */}
      <div
        className="relative z-30"
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

      {/* Last exchange */}
      {(latestUser || latestAssistant) && !showContentWindow && (
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
    </main>
  );
}
