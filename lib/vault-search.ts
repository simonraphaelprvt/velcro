import OpenAI from "openai";
import { getServiceSupabase } from "@/lib/supabase";
import type { VaultSearchResult } from "@/lib/types";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

export async function embedQuery(text: string): Promise<number[]> {
  const response = await openai.embeddings.create({
    model: process.env.OPENAI_EMBEDDING_MODEL ?? "text-embedding-3-small",
    input: text,
  });
  return response.data[0].embedding;
}

export async function searchVault(
  query: string,
  matchCount = 8,
  matchThreshold = 0.3
): Promise<VaultSearchResult[]> {
  const embedding = await embedQuery(query);
  const db = getServiceSupabase();

  const { data, error } = await db.rpc("match_vault_chunks", {
    query_embedding: embedding,
    match_count: matchCount,
    match_threshold: matchThreshold,
  });

  if (error) throw new Error(`Vault search failed: ${error.message}`);

  return (data ?? []) as VaultSearchResult[];
}

// Format vault results into a readable context block for Claude
export function formatVaultContext(results: VaultSearchResult[]): string {
  if (results.length === 0) return "";

  const blocks = results.map((r) => {
    const source = r.file_path.replace(/\.md$/, "").replace(/\//g, " / ");
    return `[${source}]\n${r.content.trim()}`;
  });

  return blocks.join("\n\n---\n\n");
}
