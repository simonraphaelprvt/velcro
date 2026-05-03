"use client";

import { useState, useRef, useEffect, FormEvent } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

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
      <div className="w-full max-w-sm">
        {/* Wordmark */}
        <p className="mb-10 text-center font-mono text-[10px] tracking-[0.5em] text-velcro-dim">
          VELCRO
        </p>

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
            <p className="text-center text-xs text-velcro-danger animate-fade-in">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading || !password}
            className="rounded-lg bg-velcro-accent px-4 py-3 text-sm font-medium text-velcro-bg transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            {loading ? "..." : "Einloggen"}
          </button>
        </form>
      </div>
    </main>
  );
}
