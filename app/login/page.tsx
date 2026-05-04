"use client";

import { useState, useRef, useEffect, FormEvent } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [password, setPassword] = useState("");
  const [error, setError]       = useState("");
  const [loading, setLoading]   = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const router   = useRouter();

  useEffect(() => { inputRef.current?.focus(); }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });

    if (res.ok) {
      router.push("/");
      router.refresh();
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Fehler.");
      setPassword("");
      setLoading(false);
      inputRef.current?.focus();
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-velcro-bg px-4">
      {/* Ambient glow */}
      <div
        className="pointer-events-none absolute h-[500px] w-[500px] rounded-full opacity-[0.04] blur-[120px]"
        style={{ background: "radial-gradient(circle, #6366f1, transparent 70%)" }}
      />

      <div className="relative w-full max-w-xs">
        <p className="mb-10 text-center font-mono text-[10px] tracking-[0.5em] text-velcro-dim">
          VELCRO
        </p>

        {/* Google login — primary action */}
        <a
          href="/api/auth/google"
          className="flex w-full items-center justify-center gap-3 rounded-lg border border-velcro-border bg-velcro-surface px-4 py-3 text-sm text-velcro-text transition-colors hover:border-velcro-accent hover:bg-velcro-muted"
        >
          {/* Google icon */}
          <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
            <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"/>
            <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"/>
            <path fill="#FBBC05" d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"/>
            <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"/>
          </svg>
          Mit Google einloggen
        </a>

        {/* Divider */}
        <div className="my-5 flex items-center gap-3">
          <div className="h-px flex-1 bg-velcro-border" />
          <span className="text-[10px] tracking-widest text-velcro-dim">ODER</span>
          <div className="h-px flex-1 bg-velcro-border" />
        </div>

        {/* Password fallback */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <input
            ref={inputRef}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Passwort"
            autoComplete="current-password"
            disabled={loading}
            className="w-full rounded-lg border border-velcro-border bg-velcro-surface px-4 py-3 text-sm text-velcro-text placeholder-velcro-dim outline-none transition-colors focus:border-velcro-accent disabled:opacity-50"
          />

          {error && (
            <p className="animate-fade-in text-center text-xs text-velcro-danger">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading || !password}
            className="rounded-lg border border-velcro-border bg-velcro-surface px-4 py-3 text-sm text-velcro-dim transition-colors hover:border-velcro-accent hover:text-velcro-text disabled:opacity-40"
          >
            {loading ? "..." : "Einloggen"}
          </button>
        </form>
      </div>
    </main>
  );
}
