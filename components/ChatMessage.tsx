import type { Message } from "@/lib/types";

interface ChatMessageProps {
  message: Message;
  isStreaming?: boolean;
}

export function ChatMessage({ message, isStreaming }: ChatMessageProps) {
  const isUser = message.role === "user";

  return (
    <div className={`flex animate-slide-up ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={[
          "max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed",
          isUser
            ? "bg-velcro-muted text-velcro-text rounded-br-sm"
            : "bg-velcro-surface border border-velcro-border text-velcro-text rounded-bl-sm",
        ].join(" ")}
      >
        {/* Empty assistant bubble shows a blinking cursor while streaming */}
        {!isUser && !message.content && isStreaming ? (
          <span className="inline-block h-3 w-0.5 animate-pulse bg-velcro-accent" />
        ) : (
          <span className="whitespace-pre-wrap">{message.content}</span>
        )}

        {/* Streaming cursor at end of assistant message */}
        {!isUser && message.content && isStreaming && (
          <span className="ml-0.5 inline-block h-3 w-0.5 animate-pulse bg-velcro-accent align-middle" />
        )}
      </div>
    </div>
  );
}
