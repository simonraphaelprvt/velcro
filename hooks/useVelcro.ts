"use client";

import { useState, useRef, useCallback } from "react";
import { useRecorder } from "./useRecorder";
import type { Message } from "@/lib/types";

export type VelcroStatus = "idle" | "recording" | "transcribing" | "thinking" | "speaking";

interface UseVelcroReturn {
  messages: Message[];
  status: VelcroStatus;
  startListening: () => Promise<void>;
  stopListening: () => Promise<void>;
  // Exposed so VelcroOrb can connect Web Audio API for visualization
  audioElement: HTMLAudioElement | null;
}

function makeId() {
  return Math.random().toString(36).slice(2, 10);
}

export function useVelcro(): UseVelcroReturn {
  const [messages, setMessages] = useState<Message[]>([]);
  const [status, setStatus] = useState<VelcroStatus>("idle");
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null);
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
      const res = await fetch("/api/speak", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });

      if (!res.ok || !res.body) return;

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);

      setAudioElement(audio);

      await new Promise<void>((resolve) => {
        audio.onended = () => resolve();
        audio.onerror = () => resolve();
        audio.play().catch(() => resolve());
      });

      URL.revokeObjectURL(url);
      setAudioElement(null);
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
        // Build history snapshot before this exchange
        const history = messages
          .filter((m) => m.content) // exclude empty placeholder
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

      // Suppress unused variable warning
      void userMessageId;
    },
    [messages, addMessage, updateMessage, speak]
  );

  const startListening = useCallback(async () => {
    if (status !== "idle") return;
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

  return { messages, status, startListening, stopListening, audioElement };
}
