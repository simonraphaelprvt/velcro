"use client";

import { useEffect, useRef, useState } from "react";
import type { VelcroStatus } from "@/hooks/useVelcro";

interface VelcroOrbProps {
  status: VelcroStatus;
  analyserNode: AnalyserNode | null;
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
      return ""; // driven by Web Audio analyser scale
    default:
      return "animate-breathe";
  }
}

export function VelcroOrb({ status, analyserNode, onClick }: VelcroOrbProps) {
  const [audioScale, setAudioScale] = useState(1);
  const rafRef = useRef<number | null>(null);

  // Drive orb scale from the AnalyserNode passed in from useVelcro
  useEffect(() => {
    if (!analyserNode || status !== "speaking") {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      setAudioScale(1);
      return;
    }

    const data = new Uint8Array(analyserNode.frequencyBinCount);
    let smoothed = 0;

    const tick = () => {
      analyserNode.getByteFrequencyData(data);
      const raw = data.reduce((a, b) => a + b, 0) / data.length / 255;
      smoothed = smoothed * 0.75 + raw * 0.25;
      setAudioScale(1 + smoothed * 0.18);
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      setAudioScale(1);
    };
  }, [analyserNode, status]);

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
          isRecording
            ? "shadow-[0_0_80px_rgba(167,139,250,0.7),0_0_160px_rgba(124,58,237,0.4)]"
            : isSpeaking
            ? "shadow-[0_0_100px_rgba(167,139,250,0.8),0_0_200px_rgba(124,58,237,0.5)]"
            : "shadow-[0_0_50px_rgba(167,139,250,0.35),0_0_100px_rgba(124,58,237,0.2)]",
        ].join(" ")}
      >
        {/* Sphere gradient — light source top-left for 3D feel */}
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
