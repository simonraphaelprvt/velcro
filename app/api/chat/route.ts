import { NextRequest } from "next/server";
import type Anthropic from "@anthropic-ai/sdk";
import { anthropic, MODEL, VELCRO_SYSTEM_PROMPT } from "@/lib/anthropic";
import { VELCRO_TOOLS, executeTool } from "@/lib/tools";
import { getServiceSupabase } from "@/lib/supabase";
import type { Message } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 90;

interface ChatRequest {
  query: string;
  history?: Pick<Message, "role" | "content">[];
}

// Max tool-use iterations before forcing a final answer
const MAX_TOOL_ROUNDS = 5;

export async function POST(req: NextRequest) {
  let body: ChatRequest;
  try {
    body = await req.json();
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  const { query, history = [] } = body;
  if (!query?.trim()) return new Response("query is required", { status: 400 });

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: object) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));

      try {
        // Build message array for the agentic loop
        const messages: Anthropic.MessageParam[] = [
          ...history.map((m) => ({
            role: m.role as "user" | "assistant",
            content: m.content,
          })),
          { role: "user", content: query },
        ];

        let finalResponse = "";
        let toolsUsed: string[] = [];

        // Agentic loop: Claude may call tools multiple times before answering
        for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
          const response = await anthropic.messages.create({
            model: MODEL,
            max_tokens: 700,
            system: VELCRO_SYSTEM_PROMPT,
            tools: VELCRO_TOOLS,
            messages,
          });

          // Collect any text content from this turn
          const textBlocks = response.content.filter(
            (b): b is Anthropic.TextBlock => b.type === "text"
          );
          const toolBlocks = response.content.filter(
            (b): b is Anthropic.ToolUseBlock => b.type === "tool_use"
          );

          if (response.stop_reason === "end_turn" || toolBlocks.length === 0) {
            // Done — collect final text
            finalResponse = textBlocks.map((b) => b.text).join("") || finalResponse;
            break;
          }

          // Execute all tool calls in parallel
          const toolResults = await Promise.all(
            toolBlocks.map(async (block) => {
              toolsUsed.push(block.name);
              const result = await executeTool(
                block.name,
                block.input as Record<string, unknown>
              );
              return {
                type: "tool_result" as const,
                tool_use_id: block.id,
                content: result,
              };
            })
          );

          // Append assistant turn + tool results for next round
          messages.push(
            { role: "assistant", content: response.content },
            { role: "user", content: toolResults }
          );

          // Stream a thinking indicator to keep the frontend alive
          send({ type: "thinking", tools: toolsUsed });
        }

        // Stream the final response as delta chunks (keeps frontend SSE contract)
        if (finalResponse) {
          // Split into ~20-char chunks to simulate streaming
          const chunkSize = 20;
          for (let i = 0; i < finalResponse.length; i += chunkSize) {
            send({ type: "delta", text: finalResponse.slice(i, i + chunkSize) });
          }
        }

        send({ type: "done", tools: toolsUsed });
        controller.close();

        logConversation(query, finalResponse, toolsUsed).catch(console.error);
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

async function logConversation(query: string, response: string, tools: string[]) {
  const db = getServiceSupabase();
  await db.from("conversations").insert({
    query,
    response,
    sources: tools.length ? { tools } : null,
  });
}
