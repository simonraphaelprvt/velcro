"use client";

import { useEffect, useRef, useState } from "react";
import type { VelcroStatus } from "@/hooks/useVelcro";

interface VelcroOrbProps {
  status: VelcroStatus;
  audioElement: HTMLAudioElement | null;
  onClick: () => void;
}

// Map status to orb animation class
function getOrbAnimation(status: VelcroStatus): string {
  switch (status) {
    case "recording":
      return "animate-pulse-record";
    case "thinking":
    case "transcribing":
      return "animate-shimmer";
    case "speaking":
      return ""; // driven by Web Audio API scale
    default:
      return "animate-breathe";
  }
}

export function VelcroOrb({ status, audioElement, onClick }: VelcroOrbProps) {
  const [audioScale, setAudioScale] = useState(1);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const dataRef = useRef<any>(null);

  // Connect audio element to Web Audio API for reactivity
  useEffect(() => {
    if (!audioElement || status !== "speaking") {
      setAudioScale(1);
      return;
    }

    let ctx: AudioContext;
    try {
      ctx = new AudioContext();
      ctxRef.current = ctx;
      const source = ctx.createMediaElementSource(audioElement);
      sourceRef.current = source;
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 64;
      source.connect(analyser);
      analyser.connect(ctx.destination);
      analyserRef.current = analyser;
      dataRef.current = new Uint8Array(analyser.frequencyBinCount);
    } catch {
      // Web Audio not available, fall back to CSS animation
      return;
    }

    let smoothed = 0;

    const tick = () => {
      if (!analyserRef.current || !dataRef.current) return;
      analyserRef.current.getByteFrequencyData(dataRef.current);
      const raw = dataRef.current.reduce((a, b) => a + b, 0) / dataRef.current.length / 255;
      // Smooth the value to avoid jitter
      smoothed = smoothed * 0.75 + raw * 0.25;
      // Map 0..1 amplitude to scale 1.0..1.18
      setAudioScale(1 + smoothed * 0.18);
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      // Don't close AudioContext here — it would silence the audio mid-playback
      setAudioScale(1);
    };
  }, [audioElement, status]);

  // Clean up AudioContext when done speaking
  useEffect(() => {
    if (status !== "speaking" && ctxRef.current) {
      ctxRef.current.close().catch(() => {});
      ctxRef.current = null;
      analyserRef.current = null;
      sourceRef.current = null;
    }
  }, [status]);

  const isIdle = status === "idle";
  const isRecording = status === "recording";
  const isSpeaking = status === "speaking";

  const orbStyle: React.CSSProperties =
    isSpeaking
      ? { transform: `scale(${audioScale})`, transition: "transform 60ms linear" }
      : {};

  return (
    <button
      onClick={isIdle ? onClick : undefined}
      aria-label={isIdle ? "Spacebar oder tippen zum Sprechen" : undefined}
      className={[
        "group relative flex items-center justify-center",
        isIdle ? "cursor-pointer" : "cursor-default",
      ].join(" ")}
    >
      {/* Expanding rings — recording and speaking */}
      {(isRecording || isSpeaking) && (
        <>
          <span className="animate-ring-expand absolute h-[220px] w-[220px] rounded-full bg-velcro-accent opacity-0" />
          <span className="animate-ring-expand-delay absolute h-[220px] w-[220px] rounded-full bg-velcro-accent opacity-0" />
        </>
      )}

      {/* The orb itself */}
      <div
        style={orbStyle}
        className={[
          "relative h-[200px] w-[200px] rounded-full",
          "transition-[box-shadow,filter] duration-500",
          getOrbAnimation(status),
          // Glow intensity based on state
          isRecording
            ? "shadow-[0_0_80px_rgba(167,139,250,0.7),0_0_160px_rgba(124,58,237,0.4)]"
            : isSpeaking
            ? "shadow-[0_0_100px_rgba(167,139,250,0.8),0_0_200px_rgba(124,58,237,0.5)]"
            : "shadow-[0_0_50px_rgba(167,139,250,0.35),0_0_100px_rgba(124,58,237,0.2)]",
        ].join(" ")}
      >
        {/* Sphere gradient — light source at top-left for 3D feel */}
        <div
          className="absolute inset-0 rounded-full"
          style={{
            background:
              "radial-gradient(circle at 38% 32%, #ddd6fe 0%, #a78bfa 35%, #7c3aed 65%, #3b1f8c 100%)",
          }}
        />

        {/* Inner highlight spot */}
        <div
          className="absolute rounded-full"
          style={{
            top: "14%",
            left: "20%",
            width: "30%",
            height: "22%",
            background:
              "radial-gradient(circle, rgba(255,255,255,0.28) 0%, transparent 100%)",
          }}
        />
      </div>

      {/* Tap hint — only on idle, fades on hover */}
      {isIdle && (
        <span className="animate-fade-in absolute -bottom-9 text-[11px] tracking-widest text-velcro-dim transition-opacity group-hover:opacity-0">
          SPACE
        </span>
      )}
    </button>
  );
}
