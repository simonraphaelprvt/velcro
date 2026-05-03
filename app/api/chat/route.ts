import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { anthropic, MODEL, VELCRO_SYSTEM_PROMPT } from "@/lib/anthropic";
import { searchVault, formatVaultContext } from "@/lib/vault-search";
import { getServiceSupabase } from "@/lib/supabase";
import type { Message } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

interface ChatRequest {
  query: string;
  history?: Pick<Message, "role" | "content">[];
}

export async function POST(req: NextRequest) {
  let body: ChatRequest;
  try {
    body = await req.json();
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  const { query, history = [] } = body;

  if (!query?.trim()) {
    return new Response("query is required", { status: 400 });
  }

  // Search vault for relevant context
  let vaultContext = "";
  let sources: { file_path: string; similarity: number }[] = [];
  try {
    const results = await searchVault(query);
    vaultContext = formatVaultContext(results);
    sources = results.map((r) => ({ file_path: r.file_path, similarity: r.similarity }));
  } catch (err) {
    // Vault search is best-effort — answer without context rather than fail
    console.error("Vault search error:", err);
  }

  // Build system prompt, inject vault context when available
  const systemPrompt = vaultContext
    ? `${VELCRO_SYSTEM_PROMPT}\n\nRelevante Auszuege aus Simons Obsidian Vault:\n\n${vaultContext}`
    : VELCRO_SYSTEM_PROMPT;

  // Map history to Anthropic message format
  const messages: Anthropic.MessageParam[] = [
    ...history.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
    { role: "user", content: query },
  ];

  // Stream response as Server-Sent Events
  const encoder = new TextEncoder();
  let fullResponse = "";

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: object) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      try {
        const claudeStream = anthropic.messages.stream({
          model: MODEL,
          max_tokens: 1024,
          system: systemPrompt,
          messages,
        });

        for await (const chunk of claudeStream) {
          if (
            chunk.type === "content_block_delta" &&
            chunk.delta.type === "text_delta"
          ) {
            const text = chunk.delta.text;
            fullResponse += text;
            send({ type: "delta", text });
          }
        }

        send({ type: "done", sources });
        controller.close();

        // Log to Supabase asynchronously — don't block the response
        logConversation(query, fullResponse, sources).catch(console.error);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        send({ type: "error", message });
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

async function logConversation(
  query: string,
  response: string,
  sources: { file_path: string; similarity: number }[]
) {
  const db = getServiceSupabase();
  await db.from("conversations").insert({
    query,
    response,
    sources,
  });
}
