/**
 * Web Search via Tavily — purpose-built for LLMs.
 * Free tier: 1000 queries/month, no credit card required.
 * Setup: https://tavily.com → API key → TAVILY_API_KEY env var.
 *
 * Tavily returns both raw results AND a synthesized answer, which we use
 * for the spoken summary so VELCRO can answer factual questions directly.
 */

interface TavilyResult {
  title:   string;
  url:     string;
  content: string;
  score?:  number;
}

export interface WebSearchResult {
  query:   string;
  answer?: string;       // Tavily-synthesized one-paragraph answer
  results: TavilyResult[];
}

export async function webSearch(query: string, count = 6): Promise<WebSearchResult> {
  const key = process.env.TAVILY_API_KEY;
  if (!key) {
    throw new Error("TAVILY_API_KEY nicht gesetzt. Hole einen Key auf tavily.com (kostenlos, ohne Kreditkarte).");
  }

  const res = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key:        key,
      query,
      search_depth:   "basic",       // "advanced" costs 2 credits
      include_answer: true,
      max_results:    count,
      // Tavily auto-detects language; no country filter on basic plan
    }),
  });

  if (!res.ok) throw new Error(`Tavily Search: ${res.status} — ${await res.text()}`);
  const data = await res.json();

  const results: TavilyResult[] = (data.results ?? []).slice(0, count).map((r: {
    title?: string; url?: string; content?: string; score?: number;
  }) => ({
    title:   r.title   ?? "",
    url:     r.url     ?? "",
    content: (r.content ?? "").replace(/\s+/g, " ").trim(),
    score:   r.score,
  }));

  return {
    query,
    answer:  typeof data.answer === "string" ? data.answer.trim() : undefined,
    results,
  };
}

export function formatWebSearch(s: WebSearchResult): string {
  if (!s.results.length && !s.answer) {
    return `Keine Treffer fuer "${s.query}".`;
  }

  const lines: string[] = [];

  // Spoken summary — prefer Tavily's synthesized answer if available
  if (s.answer) {
    lines.push(s.answer);
  } else if (s.results[0]) {
    const top = s.results[0];
    lines.push(`Zu "${s.query}": ${truncate(top.content, 220)}`);
  }
  lines.push("");

  lines.push(`## Suchergebnisse: ${s.query}`);
  for (const r of s.results) {
    const host = (() => { try { return new URL(r.url).host.replace(/^www\./, ""); } catch { return ""; } })();
    lines.push(`- **[${r.title}](${r.url})** — ${host}`);
    if (r.content) lines.push(`  ${truncate(r.content, 200)}`);
  }

  return lines.join("\n").trim();
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max).trim() + "…";
}
