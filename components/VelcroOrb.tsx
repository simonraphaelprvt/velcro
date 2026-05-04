"use client";

import { useEffect, useRef, useState } from "react";
import type { VelcroStatus } from "@/hooks/useVelcro";

interface VelcroOrbProps {
  status: VelcroStatus;
  analyserNode: AnalyserNode | null;
  onClick: () => void;
}

// ── Deterministic particle cloud ──────────────────────────────────────
const SIZE   = 300;
const CX     = SIZE / 2;
const CY     = SIZE / 2;
const RING_R = 112;

const PARTICLES = Array.from({ length: 90 }, (_, i) => {
  const angle   = (i / 90) * Math.PI * 2;
  const scatter = Math.sin(i * 7.31 + 1.2) * 11 + Math.cos(i * 3.71) * 7;
  const r       = RING_R + scatter;
  const size    = 0.6 + Math.abs(Math.sin(i * 3.71 + 0.8)) * 2.0;
  const baseOp  = 0.18 + Math.abs(Math.sin(i * 5.13 + 2.1)) * 0.68;
  const dur     = 2.0 + Math.abs(Math.sin(i * 1.7)) * 2.5;
  const del     = (i * 0.091) % dur;
  return { cx: CX + Math.cos(angle) * r, cy: CY + Math.sin(angle) * r, r: size / 2, baseOp, dur, del };
});

const HALO = Array.from({ length: 28 }, (_, i) => {
  const angle = (i / 28) * Math.PI * 2 + 0.15;
  const r     = RING_R + 20 + Math.abs(Math.sin(i * 4.1)) * 12;
  const size  = 0.4 + Math.abs(Math.sin(i * 6.3)) * 0.8;
  const baseOp = 0.07 + Math.abs(Math.sin(i * 3.9)) * 0.2;
  return { cx: CX + Math.cos(angle) * r, cy: CY + Math.sin(angle) * r, r: size / 2, baseOp, dur: 3.5 + Math.abs(Math.sin(i * 2.1)) * 2, del: (i * 0.17) % 4 };
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

  // Audio-reactive scale
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
      setAudioScale(1 + smoothed * 0.24);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; } setAudioScale(1); };
  }, [analyserNode, status]);

  const ringOpacity = isRecording ? 1 : isSpeaking ? 1 : 0.85;
  const svgFilter   = isThinking  ? "hue-rotate(25deg) brightness(1.2)" : undefined;
  const ambientScale = isSpeaking ? audioScale * 1.15 : 1;

  const glowColor = isRecording
    ? "rgba(139,92,246,0.6)"
    : isSpeaking
    ? "rgba(99,102,241,0.7)"
    : isThinking
    ? "rgba(129,140,248,0.4)"
    : "rgba(99,102,241,0.3)";

  return (
    <button
      onClick={(isIdle || isRecording) ? onClick : undefined}
      aria-label={isIdle ? "Sprechen" : isRecording ? "Aufnahme beenden" : undefined}
      className={[
        "group relative flex items-center justify-center select-none outline-none",
        (isIdle || isRecording) ? "cursor-pointer" : "cursor-default",
      ].join(" ")}
      style={{ WebkitTapHighlightColor: "transparent" }}
    >
      {/* Ambient glow behind ring */}
      <div
        className="pointer-events-none absolute rounded-full"
        style={{
          width: "300px", height: "300px",
          background: `radial-gradient(circle, ${glowColor} 0%, transparent 68%)`,
          filter: "blur(28px)",
          transform: `scale(${ambientScale})`,
          transition: "transform 80ms linear, background 600ms ease",
        }}
      />

      {/* Float wrapper — subtle internal breathing */}
      <div
        className="animate-orb-float"
        style={{ animationPlayState: isActive ? "paused" : "running" }}
      >
        <div
          className="animate-orb-drift"
          style={{ animationPlayState: isActive ? "paused" : "running" }}
        >
          <svg
            viewBox={`0 0 ${SIZE} ${SIZE}`}
            width={SIZE}
            height={SIZE}
            overflow="visible"
            style={{
              overflow: "visible",
              transform: isSpeaking ? `scale(${audioScale})` : undefined,
              transition: isSpeaking ? "transform 55ms linear" : "transform 500ms cubic-bezier(0.34,1.56,0.64,1)",
              filter: svgFilter,
            }}
          >
            <defs>
              {/* Ring gradient — vivid blue → indigo → purple */}
              <linearGradient id="ringGrad" x1="25%" y1="0%" x2="75%" y2="100%">
                <stop offset="0%"   stopColor="#e0f2ff" stopOpacity="1"    />
                <stop offset="18%"  stopColor="#60a5fa" stopOpacity="1"    />
                <stop offset="48%"  stopColor="#6366f1" stopOpacity="1"    />
                <stop offset="76%"  stopColor="#8b5cf6" stopOpacity="1"    />
                <stop offset="100%" stopColor="#4f46e5" stopOpacity="0.8"  />
              </linearGradient>

              <linearGradient id="dotGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%"   stopColor="#93c5fd" />
                <stop offset="55%"  stopColor="#818cf8" />
                <stop offset="100%" stopColor="#a78bfa" />
              </linearGradient>

              {/* Fix: filterUnits="userSpaceOnUse" with large absolute bounds
                  prevents the visible rectangle clipping artifact */}
              <filter id="ringGlow" filterUnits="userSpaceOnUse" x="-60" y="-60" width="420" height="420">
                <feGaussianBlur in="SourceGraphic" stdDeviation="4" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>

              <filter id="dotGlow" filterUnits="userSpaceOnUse" x="-25" y="-25" width="350" height="350">
                <feGaussianBlur in="SourceGraphic" stdDeviation="1.4" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>

              <filter id="recordGlow" filterUnits="userSpaceOnUse" x="-80" y="-80" width="460" height="460">
                <feGaussianBlur in="SourceGraphic" stdDeviation="7" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            {/* Outer halo — counter-rotates very slowly */}
            <g style={{
              transformOrigin: `${CX}px ${CY}px`,
              transformBox: "fill-box",
              animation: "velcro-spin-reverse 90s linear infinite",
              animationPlayState: isActive ? "paused" : "running",
            }}>
              {HALO.map((p, i) => (
                <circle key={`h${i}`} cx={p.cx} cy={p.cy} r={p.r}
                  fill="url(#dotGrad)"
                  className="velcro-particle"
                  style={{ "--base-op": p.baseOp, opacity: p.baseOp, animationDuration: `${p.dur}s`, animationDelay: `-${p.del}s` } as React.CSSProperties}
                />
              ))}
            </g>

            {/* Main particle ring — slow rotation */}
            <g style={{
              transformOrigin: `${CX}px ${CY}px`,
              transformBox: "fill-box",
              animation: "velcro-spin 70s linear infinite",
              animationPlayState: isActive ? "paused" : "running",
            }}>
              {PARTICLES.map((p, i) => (
                <circle key={`p${i}`} cx={p.cx} cy={p.cy} r={p.r}
                  fill="url(#dotGrad)"
                  filter="url(#dotGlow)"
                  className="velcro-particle"
                  style={{ "--base-op": p.baseOp, opacity: p.baseOp, animationDuration: `${p.dur}s`, animationDelay: `-${p.del}s` } as React.CSSProperties}
                />
              ))}
            </g>

            {/* The ring */}
            <circle
              cx={CX} cy={CY} r={RING_R}
              fill="none"
              stroke="url(#ringGrad)"
              strokeWidth={isRecording ? 2.8 : 1.9}
              filter={isRecording ? "url(#recordGlow)" : "url(#ringGlow)"}
              opacity={ringOpacity}
              style={{
                animation: (!isActive && !isThinking) ? "velcro-ring-idle 4s ease-in-out infinite" : undefined,
                transition: "stroke-width 0.5s cubic-bezier(0.4,0,0.2,1), opacity 0.5s cubic-bezier(0.4,0,0.2,1)",
              }}
            />

            {/* VELCRO wordmark inside */}
            <text
              x={CX} y={CY + 6}
              textAnchor="middle"
              fill="white"
              fontSize="14"
              letterSpacing="8"
              fontFamily="system-ui, -apple-system, sans-serif"
              fontWeight="300"
              opacity={isThinking ? 0.4 : 0.7}
              style={{ transition: "opacity 0.5s", userSelect: "none" }}
            >
              VELCRO
            </text>
          </svg>
        </div>
      </div>

      {/* Status hints */}
      {isIdle && (
        <span className="animate-fade-in absolute -bottom-8 text-[10px] tracking-[0.45em] text-velcro-dim transition-opacity duration-300 group-hover:opacity-0">
          SPACE
        </span>
      )}
      {isRecording && (
        <span className="animate-fade-in absolute -bottom-8 text-[10px] tracking-[0.3em] text-velcro-accent">
          ● REC
        </span>
      )}
    </button>
  );
}
