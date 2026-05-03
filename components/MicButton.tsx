"use client";

import type { VelcroStatus } from "@/hooks/useVelcro";

interface MicButtonProps {
  status: VelcroStatus;
  onStart: () => void;
  onStop: () => void;
}

const MicIcon = () => (
  <svg
    width="28"
    height="28"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.75"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M12 2a3 3 0 0 1 3 3v7a3 3 0 0 1-6 0V5a3 3 0 0 1 3-3Z" />
    <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
    <line x1="12" x2="12" y1="19" y2="22" />
  </svg>
);

const statusLabel: Record<VelcroStatus, string> = {
  idle: "Spacebar halten zum Sprechen",
  recording: "Spreche...",
  transcribing: "Verarbeite...",
  thinking: "Denkt...",
  speaking: "Antwortet...",
};

export function MicButton({ status, onStart, onStop }: MicButtonProps) {
  const isRecording = status === "recording";
  const isBusy = status !== "idle" && status !== "recording";

  return (
    <div className="flex flex-col items-center gap-5">
      {/* Outer pulse ring — only visible while recording */}
      <div className="relative flex items-center justify-center">
        {isRecording && (
          <>
            <span className="absolute h-[88px] w-[88px] animate-ping rounded-full bg-velcro-accent opacity-10" />
            <span className="absolute h-[72px] w-[72px] animate-pulse-ring rounded-full bg-velcro-accent opacity-15" />
          </>
        )}

        <button
          onMouseDown={!isBusy ? onStart : undefined}
          onMouseUp={isRecording ? onStop : undefined}
          onTouchStart={!isBusy ? (e) => { e.preventDefault(); onStart(); } : undefined}
          onTouchEnd={isRecording ? onStop : undefined}
          disabled={isBusy}
          aria-label="Mikrofon"
          className={[
            "relative z-10 flex h-[60px] w-[60px] items-center justify-center rounded-full transition-all duration-200",
            isRecording
              ? "bg-velcro-accent text-velcro-bg shadow-[0_0_24px_rgba(167,139,250,0.4)]"
              : isBusy
              ? "border border-velcro-border bg-velcro-surface text-velcro-dim cursor-not-allowed"
              : "border border-velcro-border bg-velcro-surface text-velcro-dim hover:border-velcro-accent hover:text-velcro-accent",
          ].join(" ")}
        >
          <MicIcon />
        </button>
      </div>

      {/* Status label */}
      <p
        className={[
          "text-xs transition-colors duration-300",
          isRecording ? "text-velcro-accent" : "text-velcro-dim",
        ].join(" ")}
      >
        {statusLabel[status]}
      </p>
    </div>
  );
}
