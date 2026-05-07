"use client";

import { useEffect, useState } from "react";

export function GoogleButton() {
  const [connected, setConnected] = useState<boolean | null>(null);

  useEffect(() => {
    fetch("/api/auth/google/status")
      .then((r) => r.json())
      .then((d) => setConnected(!!d.connected))
      .catch(() => setConnected(false));
  }, []);

  return (
    <a
      href="/api/auth/google"
      aria-label={connected ? "Google verbunden" : "Mit Google verbinden"}
      title={connected ? "Google verbunden — erneut verbinden" : "Mit Google verbinden"}
      className={[
        "absolute bottom-5 left-14 z-40",
        "flex h-6 w-6 items-center justify-center rounded-full",
        "border bg-velcro-bg/40 text-[11px] font-semibold",
        "backdrop-blur-md transition-all duration-300",
        connected
          ? "border-emerald-500/60 text-emerald-400 hover:border-emerald-400 hover:bg-velcro-surface/70"
          : "border-velcro-border/60 text-velcro-dim hover:border-velcro-accent/60 hover:bg-velcro-surface/70 hover:text-velcro-text",
      ].join(" ")}
    >
      G
    </a>
  );
}
