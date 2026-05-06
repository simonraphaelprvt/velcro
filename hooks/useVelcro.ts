"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useRecorder } from "./useRecorder";
import type { Message } from "@/lib/types";

// ─── Silence-detection thresholds ───────────────────────────────────────────
/** RMS above this level counts as speech (float32, range 0–1). */
const SPEECH_RMS_THRESHOLD   = 0.02;
/** After speech detected: ms of silence before auto-stop. */
const POST_SPEECH_SILENCE_MS = 2200;
/** If user never speaks: ms before cancelling the recording. */
const NO_SPEECH_TIMEOUT_MS   = 8000;
/** Hard limit — always stop after this many ms regardless. */
const MAX_RECORDING_MS       = 45_000;

// ─── Text helpers ────────────────────────────────────────────────────────────

function stripInlineMarkdown(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/gs, "$1")
    .replace(/\*(.+?)\*/gs,     "$1")
    .replace(/__(.+?)__/gs,     "$1")
    .replace(/_(.+?)_/gs,       "$1")
    .replace(/`{1,3}[^`\n]*`{1,3}/g, "")
    .replace(/#{1,6}\s+/g,      "")
    .replace(/\[(.+?)\]\(.+?\)/g, "$1")
    .replace(/^[-*+]\s+/gm,     "")
    .replace(/^\d+\.\s+/gm,     "")
    .replace(/\|[^\n]+\|/g,     "")
    .replace(/^-{3,}$/gm,       "")
    .replace(/\n{3,}/g,         "\n\n")
    .trim();
}

function normalizeForSpeech(text: string): string {
  return text
    .replace(/\bTodos\b/g, "Aufgaben")
    .replace(/\bTodo\b/g,  "Aufgabe")
    .replace(/\bOKs?\b/g,  "okay");
}

function extractSpokenText(text: string): string {
  const tableStart   = text.search(/^\|/m);
  const codeStart    = text.indexOf("```");
  const numberedList = text.search(/^\d+\. /m);
  const headingStart = text.search(/^#{1,6} /m);
  const panelStart   = text.search(/^VELCRO_PANEL:/m);

  let cutAt = text.length;
  if (tableStart   > 0) cutAt = Math.min(cutAt, tableStart);
  if (codeStart    > 0) cutAt = Math.min(cutAt, codeStart);
  if (numberedList > 0) cutAt = Math.min(cutAt, numberedList);
  if (headingStart > 0) cutAt = Math.min(cutAt, headingStart);
  if (panelStart   > 0) cutAt = Math.min(cutAt, panelStart);

  const before = normalizeForSpeech(stripInlineMarkdown(text.slice(0, cutAt)));
  if (before.length > 4) return before;

  const full      = normalizeForSpeech(stripInlineMarkdown(text));
  const sentences = full.match(/[^.!?]+[.!?]+/g) ?? [];
  return sentences.slice(0, 2).join(" ").trim() || "Hier ist die Übersicht für Sie.";
}

// ─── Types ───────────────────────────────────────────────────────────────────

export type VelcroStatus = "idle" | "recording" | "transcribing" | "thinking" | "speaking";

interface UseVelcroReturn {
  messages:       Message[];
  status:         VelcroStatus;
  startListening: () => Promise<void>;
  stopListening:  () => Promise<void>;
  analyserNode:   AnalyserNode | null;
}

function makeId() {
  return Math.random().toString(36).slice(2, 10);
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useVelcro(): UseVelcroReturn {
  const [messages,     setMessages]     = useState<Message[]>([]);
  const [status,       setStatus]       = useState<VelcroStatus>("idle");
  const [analyserNode, setAnalyserNode] = useState<AnalyserNode | null>(null);

  const audioCtxRef      = useRef<AudioContext | null>(null);
  const analyserRef      = useRef<AnalyserNode | null>(null);
  // Separate analyser connected to the mic input — used for silence detection.
  const micAnalyserRef   = useRef<AnalyserNode | null>(null);
  const micSourceRef     = useRef<MediaStreamAudioSourceNode | null>(null);
  const hasGreetedRef    = useRef(false);

  const recorder = useRecorder();

  // Keep a stable ref to stopListening so the silence-detection interval
  // can call it without being in its dependency array (avoids stale closure).
  const stopListeningRef = useRef<() => Promise<void>>(async () => {});

  const addMessage = useCallback((role: Message["role"], content: string): string => {
    const id = makeId();
    setMessages((prev) => [...prev, { id, role, content, timestamp: new Date() }]);
    return id;
  }, []);

  const updateMessage = useCallback((id: string, content: string) => {
    setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, content } : m)));
  }, []);

  // ── TTS ──────────────────────────────────────────────────────────────────
  const speak = useCallback(async (text: string) => {
    setStatus("speaking");
    try {
      const spoken = extractSpokenText(text);
      const cleanText = !hasGreetedRef.current
        ? `Hallo, Simon. ${spoken}`
        : spoken;
      hasGreetedRef.current = true;

      const res = await fetch("/api/speak", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: cleanText }),
      });

      if (!res.ok) {
        console.error("Speak API error:", res.status, await res.text().catch(() => ""));
        return;
      }

      const ctx = audioCtxRef.current;
      if (!ctx) { console.error("No AudioContext"); return; }
      if (ctx.state === "suspended") await ctx.resume();

      const audioBuffer = await ctx.decodeAudioData(await res.arrayBuffer());
      const source      = ctx.createBufferSource();
      source.buffer     = audioBuffer;

      const analyser = analyserRef.current!;
      source.connect(analyser);
      analyser.connect(ctx.destination);
      setAnalyserNode(analyser);

      await new Promise<void>((resolve) => {
        source.onended = () => resolve();
        source.start(0);
      });

      setAnalyserNode(null);
    } catch (err) {
      console.error("TTS error:", err);
    } finally {
      setStatus("idle");
    }
  }, []);

  // ── Pipeline ─────────────────────────────────────────────────────────────
  const runPipeline = useCallback(
    async (audioBlob: Blob) => {
      setStatus("transcribing");
      let query = "";
      try {
        const form = new FormData();
        form.append("audio", audioBlob, "audio.webm");
        const res = await fetch("/api/transcribe", { method: "POST", body: form });
        if (!res.ok) throw new Error("Transcription failed");
        const data = await res.json();
        query = data.text?.trim() ?? "";
      } catch (err) {
        console.error("Transcribe error:", err);
        setStatus("idle");
        return;
      }

      if (!query) { setStatus("idle"); return; }

      const userMessageId = addMessage("user", query);

      setStatus("thinking");
      const assistantId = makeId();
      setMessages((prev) => [
        ...prev,
        { id: assistantId, role: "assistant", content: "", timestamp: new Date() },
      ]);

      let fullResponse = "";
      try {
        const history = messages
          .filter((m) => m.content)
          .map((m) => ({ role: m.role, content: m.content }));

        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query, history }),
        });

        if (!res.ok || !res.body) throw new Error("Chat failed");

        const reader  = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer    = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer      = lines.pop() ?? "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const raw = line.slice(6).trim();
            if (!raw) continue;
            try {
              const event = JSON.parse(raw);
              if (event.type === "delta") {
                fullResponse += event.text;
                updateMessage(assistantId, fullResponse);
              }
            } catch { /* malformed SSE */ }
          }
        }
      } catch (err) {
        console.error("Chat error:", err);
        updateMessage(assistantId, "Entschuldigung, da ist etwas schiefgelaufen.");
        setStatus("idle");
        return;
      }

      if (fullResponse) await speak(fullResponse);
      else               setStatus("idle");

      void userMessageId;
    },
    [messages, addMessage, updateMessage, speak]
  );

  // ── Wake chirp ────────────────────────────────────────────────────────────
  const playWakeChirp = useCallback(() => {
    const ctx = audioCtxRef.current;
    if (!ctx || ctx.state !== "running") return;
    try {
      const now  = ctx.currentTime;
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(660, now);
      osc.frequency.exponentialRampToValueAtTime(990, now + 0.13);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.18, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.2);
    } catch { /* ignore */ }
  }, []);

  // ── Start ─────────────────────────────────────────────────────────────────
  const startListening = useCallback(async () => {
    if (status !== "idle") return;

    // STEP 1 — mic access (must be first, before any await, for iOS gesture chain)
    try {
      await recorder.start();
    } catch (err) {
      console.error("[VELCRO] mic access failed:", err);
      setStatus("idle");
      return;
    }

    // STEP 2 — AudioContext (follows getUserMedia within the same gesture)
    if (!audioCtxRef.current || audioCtxRef.current.state === "closed") {
      const ctx      = new AudioContext();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 64;
      audioCtxRef.current = ctx;
      analyserRef.current = analyser;
    }
    await audioCtxRef.current.resume();

    // STEP 3 — connect mic stream to a separate analyser for silence detection
    const stream = recorder.getStream();
    if (stream && audioCtxRef.current) {
      try {
        const micSrc    = audioCtxRef.current.createMediaStreamSource(stream);
        const micAna    = audioCtxRef.current.createAnalyser();
        micAna.fftSize  = 512;
        micSrc.connect(micAna);
        micSourceRef.current  = micSrc;
        micAnalyserRef.current = micAna;
      } catch (err) {
        console.warn("[VELCRO] mic analyser setup failed:", err);
      }
    }

    playWakeChirp();
    setStatus("recording");
  }, [status, recorder, playWakeChirp]);

  // ── Stop ──────────────────────────────────────────────────────────────────
  const stopListening = useCallback(async () => {
    if (status !== "recording") return;

    // Tear down silence-detection audio graph
    try { micSourceRef.current?.disconnect(); } catch { /* ignore */ }
    micSourceRef.current   = null;
    micAnalyserRef.current = null;

    const blob = await recorder.stop();
    if (blob) await runPipeline(blob);
    else      setStatus("idle");
  }, [status, recorder, runPipeline]);

  // Keep ref current so silence-detection interval can call it safely
  useEffect(() => { stopListeningRef.current = stopListening; }, [stopListening]);

  // ── Silence detection ─────────────────────────────────────────────────────
  // Runs while status === "recording". Auto-stops when:
  //   • speech was detected and then silence for POST_SPEECH_SILENCE_MS
  //   • no speech at all for NO_SPEECH_TIMEOUT_MS
  //   • total recording exceeds MAX_RECORDING_MS
  useEffect(() => {
    if (status !== "recording") return;

    const startedAt  = Date.now();
    let lastSpeechAt = Date.now();
    let hasSpoken    = false;

    const id = setInterval(() => {
      const analyser = micAnalyserRef.current;
      if (!analyser) return;

      const buf = new Float32Array(analyser.frequencyBinCount);
      analyser.getFloatTimeDomainData(buf);
      const rms = Math.sqrt(buf.reduce((s, v) => s + v * v, 0) / buf.length);

      const now = Date.now();

      if (rms > SPEECH_RMS_THRESHOLD) {
        hasSpoken    = true;
        lastSpeechAt = now;
      }

      const silenceDuration = now - lastSpeechAt;
      const totalDuration   = now - startedAt;

      const shouldStop =
        (hasSpoken  && silenceDuration >= POST_SPEECH_SILENCE_MS) ||
        (!hasSpoken && totalDuration   >= NO_SPEECH_TIMEOUT_MS)   ||
        totalDuration >= MAX_RECORDING_MS;

      if (shouldStop) {
        clearInterval(id);
        console.log("[VELCRO] auto-stop — spoken:", hasSpoken, "silence:", silenceDuration, "ms");
        stopListeningRef.current();
      }
    }, 150);

    return () => clearInterval(id);
  }, [status]); // intentionally excludes stopListening — using ref instead

  return { messages, status, startListening, stopListening, analyserNode };
}
