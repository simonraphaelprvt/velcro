"use client";

import { useState, useRef, useCallback } from "react";
import { useRecorder } from "./useRecorder";
import type { Message } from "@/lib/types";

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

// Extract the spoken portion of a response — the prose BEFORE any table/code block.
// If Claude put no intro, returns a short fallback so VELCRO always speaks.
function extractSpokenText(text: string): string {
  // Find where the first table or code block starts
  const tableStart = text.search(/^\|/m);
  const codeStart  = text.indexOf("```");
  const listStart  = text.search(/^\d+\. /m);

  let cutAt = text.length;
  if (tableStart > 0) cutAt = Math.min(cutAt, tableStart);
  if (codeStart  > 0) cutAt = Math.min(cutAt, codeStart);
  if (listStart  > 0) cutAt = Math.min(cutAt, listStart);

  const before = stripInlineMarkdown(text.slice(0, cutAt));
  if (before.length > 4) return before;

  // Fallback: Claude skipped the intro — speak the full stripped text
  const full = stripInlineMarkdown(text);
  return full || "Hier ist die Übersicht für Sie.";
}

export type VelcroStatus = "idle" | "recording" | "transcribing" | "thinking" | "speaking";

interface UseVelcroReturn {
  messages: Message[];
  status: VelcroStatus;
  startListening: () => Promise<void>;
  stopListening: () => Promise<void>;
  // AnalyserNode for real-time orb visualisation (null when not speaking)
  analyserNode: AnalyserNode | null;
}

function makeId() {
  return Math.random().toString(36).slice(2, 10);
}

export function useVelcro(): UseVelcroReturn {
  const [messages, setMessages] = useState<Message[]>([]);
  const [status, setStatus] = useState<VelcroStatus>("idle");
  const [analyserNode, setAnalyserNode] = useState<AnalyserNode | null>(null);

  // AudioContext created once during a user gesture so Safari allows playback
  const audioCtxRef  = useRef<AudioContext | null>(null);
  const analyserRef  = useRef<AnalyserNode | null>(null);
  const hasGreetedRef = useRef(false);

  const recorder = useRecorder();

  const addMessage = useCallback((role: Message["role"], content: string): string => {
    const id = makeId();
    setMessages((prev) => [...prev, { id, role, content, timestamp: new Date() }]);
    return id;
  }, []);

  const updateMessage = useCallback((id: string, content: string) => {
    setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, content } : m)));
  }, []);

  const speak = useCallback(async (text: string) => {
    setStatus("speaking");
    try {
      // Extract spoken prose — text before tables/code, never empty
      const spoken = extractSpokenText(text);

      // Prepend greeting to the very first thing VELCRO says
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

      // Decode via AudioContext so Safari autoplay policy can't block us.
      // The AudioContext was created + resumed during the user gesture in startListening.
      const ctx = audioCtxRef.current;
      if (!ctx) {
        console.error("No AudioContext — was startListening called first?");
        return;
      }

      if (ctx.state === "suspended") {
        await ctx.resume();
      }

      const arrayBuffer = await res.arrayBuffer();
      const audioBuffer = await ctx.decodeAudioData(arrayBuffer);

      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;

      // Wire through the analyser for orb visualisation
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

  const runPipeline = useCallback(
    async (audioBlob: Blob) => {
      // 1. Transcribe
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

      if (!query) {
        setStatus("idle");
        return;
      }

      const userMessageId = addMessage("user", query);

      // 2. Stream Claude response
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

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

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
            } catch {
              // malformed SSE line
            }
          }
        }
      } catch (err) {
        console.error("Chat error:", err);
        updateMessage(assistantId, "Entschuldigung, da ist etwas schiefgelaufen.");
        setStatus("idle");
        return;
      }

      // 3. Speak the response
      if (fullResponse) {
        await speak(fullResponse);
      } else {
        setStatus("idle");
      }

      void userMessageId;
    },
    [messages, addMessage, updateMessage, speak]
  );

  const startListening = useCallback(async () => {
    if (status !== "idle") return;

    // Create (or reopen) AudioContext during user gesture — required by Safari
    if (!audioCtxRef.current || audioCtxRef.current.state === "closed") {
      const ctx = new AudioContext();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 64;
      audioCtxRef.current = ctx;
      analyserRef.current = analyser;
    }
    await audioCtxRef.current.resume();

    await recorder.start();
    setStatus("recording");
  }, [status, recorder]);

  const stopListening = useCallback(async () => {
    if (status !== "recording") return;
    const blob = await recorder.stop();
    if (blob) {
      await runPipeline(blob);
    } else {
      setStatus("idle");
    }
  }, [status, recorder, runPipeline]);

  return { messages, status, startListening, stopListening, analyserNode };
}
