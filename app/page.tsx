export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-velcro-bg">
      <div className="flex flex-col items-center gap-3">
        {/* Wordmark */}
        <span className="font-mono text-xs tracking-[0.4em] text-velcro-dim uppercase">
          VELCRO
        </span>

        {/* Status */}
        <p className="text-sm text-velcro-dim">System initialisiert.</p>

        {/* Phase indicator */}
        <div className="mt-8 rounded-lg border border-velcro-border bg-velcro-surface px-5 py-4 text-center">
          <p className="text-xs text-velcro-dim">Phase 1 abgeschlossen</p>
          <p className="mt-1 text-sm text-velcro-text">
            Projekt-Skeleton bereit. Voice-Interface folgt in Phase 4+5.
          </p>
        </div>
      </div>
    </main>
  );
}
