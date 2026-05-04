"use client";

import { useEffect, useRef, useState } from "react";
import type { VelcroStatus } from "@/hooks/useVelcro";

interface VelcroOrbProps {
  status: VelcroStatus;
  analyserNode: AnalyserNode | null;
  /** Called on click — parent decides start vs stop */
  onClick: () => void;
}

// ── Particle cloud ────────────────────────────────────────────────────
// Pre-computed deterministically so SSR and client match.
const SIZE   = 300;
const CX     = SIZE / 2;   // 150
const CY     = SIZE / 2;   // 150
const RING_R = 112;

const PARTICLES = Array.from({ length: 92 }, (_, i) => {
  const angle       = (i / 92) * Math.PI * 2;
  // Scatter particles both inside and outside the ring edge
  const scatter     = Math.sin(i * 7.31 + 1.2) * 15 + Math.cos(i * 3.71) * 9;
  const r           = RING_R + scatter;
  const size        = 0.55 + Math.abs(Math.sin(i * 3.71 + 0.8)) * 2.3;
  const baseOp      = 0.1  + Math.abs(Math.sin(i * 5.13 + 2.1)) * 0.72;
  const twinkleDur  = 2.0  + Math.abs(Math.sin(i * 1.7))  * 2.8;
  const twingleDel  = (i * 0.091) % twinkleDur;
  return {
    cx: CX + Math.cos(angle) * r,
    cy: CY + Math.sin(angle) * r,
    r: size / 2,
    baseOp,
    twinkleDur,
    twingleDel,
  };
});

// A second, sparser outer halo
const HALO = Array.from({ length: 32 }, (_, i) => {
  const angle  = (i / 32) * Math.PI * 2 + 0.1;
  const r      = RING_R + 22 + Math.abs(Math.sin(i * 4.1)) * 14;
  const size   = 0.4 + Math.abs(Math.sin(i * 6.3)) * 0.9;
  const baseOp = 0.06 + Math.abs(Math.sin(i * 3.9)) * 0.22;
  return {
    cx: CX + Math.cos(angle) * r,
    cy: CY + Math.sin(angle) * r,
    r: size / 2,
    baseOp,
    dur: 3.5 + Math.abs(Math.sin(i * 2.1)) * 2,
    del: (i * 0.17) % 4,
  };
});

// ── Component ─────────────────────────────────────────────────────────
export function VelcroOrb({ status, analyserNode, onClick }: VelcroOrbProps) {
  const [audioScale, setAudioScale] = useState(1);
  const rafRef = useRef<number | null>(null);

  const isIdle      = status === "idle";
  const isRecording = status === "recording";
  const isThinking  = status === "thinking" || status === "transcribing";
  const isSpeaking  = status === "speaking";
  const isActive    = isRecording || isSpeaking;

  // ── Audio-reactive scale ─────────────────────────────────────────────
  useEffect(() => {
    if (!analyserNode || status !== "speaking") {
      if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
      setAudioScale(1);
      return;
    }
    const data = new Uint8Array(analyserNode.frequencyBinCount);
    let smoothed = 0;
    const tick = () => {
      analyserNode.getByteFrequencyData(data);
      const raw = data.reduce((a, b) => a + b, 0) / data.length / 255;
      smoothed = smoothed * 0.78 + raw * 0.22;
      setAudioScale(1 + smoothed * 0.22);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
      setAudioScale(1);
    };
  }, [analyserNode, status]);

  // ── Derived colours per status ───────────────────────────────────────
  // Ring glow colour
  const glowColor = isRecording
    ? "rgba(167,139,250,0.55)"   // purple-ish
    : isSpeaking
    ? "rgba(99,102,241,0.65)"    // indigo
    : isThinking
    ? "rgba(129,140,248,0.35)"
    : "rgba(99,102,241,0.28)";   // idle — dim

  // Ring opacity / brightness
  const ringOpacity = isRecording ? 1 : isSpeaking ? 1 : 0.82;

  // Whether to apply the shimmer filter on the SVG (thinking)
  const svgFilter = isThinking ? "hue-rotate(20deg) brightness(1.15)" : undefined;

  // Outer ambient glow size reacts to audio
  const ambientScale = isSpeaking ? audioScale * 1.1 : 1;

  return (
    <button
      onClick={(isIdle || isRecording) ? onClick : undefined}
      aria-label={
        isIdle      ? "Zum Sprechen drücken" :
        isRecording ? "Aufnahme beenden" : undefined
      }
      className={[
        "group relative flex items-center justify-center select-none outline-none",
        (isIdle || isRecording) ? "cursor-pointer" : "cursor-default",
      ].join(" ")}
    >
      {/* ── Ambient background glow ───────────────────────────────────── */}
      <div
        className="pointer-events-none absolute rounded-full blur-[70px] transition-all duration-700"
        style={{
          width:  "260px",
          height: "260px",
          background: `radial-gradient(circle, ${glowColor} 0%, transparent 70%)`,
          transform: `scale(${ambientScale})`,
        }}
      />

      {/* ── Float + drift wrapper ─────────────────────────────────────── */}
      <div
        className="animate-orb-float"
        style={{ animationPlayState: isActive ? "paused" : "running" }}
      >
        <div
          className="animate-orb-drift"
          style={{ animationPlayState: isActive ? "paused" : "running" }}
        >
          {/* ── SVG orb ───────────────────────────────────────────────── */}
          <svg
            viewBox={`0 0 ${SIZE} ${SIZE}`}
            width={SIZE}
            height={SIZE}
            style={{
              transform: isSpeaking ? `scale(${audioScale})` : undefined,
              transition: isSpeaking ? "transform 55ms linear" : "transform 400ms ease",
              filter: svgFilter,
              overflow: "visible",
            }}
          >
            <defs>
              {/* Ring gradient — blue-white at top → purple at bottom */}
              <linearGradient id="ringGrad" x1="30%" y1="0%" x2="70%" y2="100%">
                <stop offset="0%"   stopColor="#e0f2ff" stopOpacity="0.95" />
                <stop offset="22%"  stopColor="#93c5fd" stopOpacity="1"    />
                <stop offset="50%"  stopColor="#818cf8" stopOpacity="1"    />
                <stop offset="78%"  stopColor="#a78bfa" stopOpacity="1"    />
                <stop offset="100%" stopColor="#6366f1" stopOpacity="0.75" />
              </linearGradient>

              {/* Particle gradient — blue to purple */}
              <linearGradient id="dotGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%"   stopColor="#bfdbfe" />
                <stop offset="60%"  stopColor="#a5b4fc" />
                <stop offset="100%" stopColor="#c4b5fd" />
              </linearGradient>

              {/* Glow filter for the ring */}
              <filter id="ringGlow" x="-30%" y="-30%" width="160%" height="160%">
                <feGaussianBlur in="SourceGraphic" stdDeviation="3.5" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>

              {/* Softer glow for particles */}
              <filter id="dotGlow" x="-80%" y="-80%" width="260%" height="260%">
                <feGaussianBlur in="SourceGraphic" stdDeviation="1.2" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>

              {/* Recording pulse filter */}
              <filter id="recordGlow" x="-30%" y="-30%" width="160%" height="160%">
                <feGaussianBlur in="SourceGraphic" stdDeviation="5" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            {/* ── Outer halo dots (counter-rotate slowly) ─────────────── */}
            <g
              style={{
                transformOrigin: `${CX}px ${CY}px`,
                transformBox: "fill-box",
                animation: "velcro-spin-reverse 45s linear infinite",
                animationPlayState: isActive ? "paused" : "running",
              }}
            >
              {HALO.map((p, i) => (
                <circle
                  key={`h${i}`}
                  cx={p.cx}
                  cy={p.cy}
                  r={p.r}
                  fill="url(#dotGrad)"
                  className="velcro-particle"
                  style={{
                    "--base-op": p.baseOp,
                    opacity: p.baseOp,
                    animationDuration: `${p.dur}s`,
                    animationDelay: `-${p.del}s`,
                  } as React.CSSProperties}
                />
              ))}
            </g>

            {/* ── Main particle ring (rotates) ─────────────────────────── */}
            <g
              style={{
                transformOrigin: `${CX}px ${CY}px`,
                transformBox: "fill-box",
                animation: "velcro-spin 30s linear infinite",
                animationPlayState: isActive ? "paused" : "running",
              }}
            >
              {PARTICLES.map((p, i) => (
                <circle
                  key={`p${i}`}
                  cx={p.cx}
                  cy={p.cy}
                  r={p.r}
                  fill="url(#dotGrad)"
                  filter="url(#dotGlow)"
                  className="velcro-particle"
                  style={{
                    "--base-op": p.baseOp,
                    opacity: p.baseOp,
                    animationDuration: `${p.twinkleDur}s`,
                    animationDelay: `-${p.twingleDel}s`,
                  } as React.CSSProperties}
                />
              ))}
            </g>

            {/* ── The ring itself ──────────────────────────────────────── */}
            <circle
              cx={CX}
              cy={CY}
              r={RING_R}
              fill="none"
              stroke="url(#ringGrad)"
              strokeWidth={isRecording ? 2.5 : 1.8}
              filter={isRecording ? "url(#recordGlow)" : "url(#ringGlow)"}
              opacity={ringOpacity}
              style={{
                animation: (!isActive && !isThinking)
                  ? "velcro-ring-idle 4s ease-in-out infinite"
                  : undefined,
                transition: "stroke-width 0.4s, opacity 0.4s",
              }}
            />

            {/* ── VELCRO wordmark inside ───────────────────────────────── */}
            <text
              x={CX}
              y={CY + 6}
              textAnchor="middle"
              fill="white"
              fontSize="15"
              letterSpacing="7"
              fontFamily="system-ui, -apple-system, sans-serif"
              fontWeight="400"
              opacity={isThinking ? 0.5 : 0.75}
              style={{ transition: "opacity 0.5s", userSelect: "none" }}
            >
              VELCRO
            </text>
          </svg>
        </div>
      </div>

      {/* ── Status hint below ─────────────────────────────────────────── */}
      {isIdle && (
        <span className="animate-fade-in absolute -bottom-8 text-[10px] tracking-[0.45em] text-velcro-dim transition-opacity group-hover:opacity-0">
          SPACE
        </span>
      )}
      {isRecording && (
        <span className="animate-fade-in absolute -bottom-8 text-[10px] tracking-[0.3em] text-velcro-accent">
          ● AUFNAHME
        </span>
      )}
    </button>
  );
}
