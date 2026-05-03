"use client";

import { useEffect, useRef, useCallback } from "react";
import { useVelcro } from "@/hooks/useVelcro";
import { MicButton } from "@/components/MicButton";
import { ChatMessage } from "@/components/ChatMessage";

export default function Home() {
  const { messages, status, startListening, stopListening } = useVelcro();
  const chatEndRef = useRef<HTMLDivElement>(null);
  const spaceActiveRef = useRef(false);

  // Auto-scroll chat to bottom on new messages
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Spacebar push-to-talk
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.code !== "Space" || e.repeat || spaceActiveRef.current) return;
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      )
        return;
      e.preventDefault();
      spaceActiveRef.current = true;
      startListening();
    },
    [startListening]
  );

  const handleKeyUp = useCallback(
    (e: KeyboardEvent) => {
      if (e.code !== "Space" || !spaceActiveRef.current) return;
      e.preventDefault();
      spaceActiveRef.current = false;
      stopListening();
    },
    [stopListening]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [handleKeyDown, handleKeyUp]);

  const isStreaming = status === "thinking";
  const lastMessageId = messages[messages.length - 1]?.id;

  return (
    <main className="flex h-screen flex-col bg-velcro-bg">
      {/* Top bar */}
      <header className="flex items-center justify-between border-b border-velcro-border px-6 py-4">
        <span className="font-mono text-[10px] tracking-[0.5em] text-velcro-dim">VELCRO</span>
        <span
          className={[
            "h-1.5 w-1.5 rounded-full transition-colors duration-500",
            status === "idle" ? "bg-velcro-dim" : "bg-velcro-accent-2",
          ].join(" ")}
        />
      </header>

      {/* Chat history */}
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="mx-auto flex max-w-2xl flex-col gap-4">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center gap-2 pt-20 text-center">
              <p className="text-sm text-velcro-dim">Bereit.</p>
            </div>
          )}

          {messages.map((msg) => (
            <ChatMessage
              key={msg.id}
              message={msg}
              isStreaming={isStreaming && msg.id === lastMessageId}
            />
          ))}

          <div ref={chatEndRef} />
        </div>
      </div>

      {/* Bottom mic area */}
      <div className="border-t border-velcro-border px-6 py-8">
        <div className="flex justify-center">
          <MicButton
            status={status}
            onStart={startListening}
            onStop={stopListening}
          />
        </div>
      </div>
    </main>
  );
}
