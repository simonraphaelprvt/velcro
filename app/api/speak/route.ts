import { NextRequest } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 30;

const ELEVENLABS_API_URL = "https://api.elevenlabs.io/v1";

export async function POST(req: NextRequest) {
  let body: { text: string };
  try {
    body = await req.json();
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  const { text } = body;
  if (!text?.trim()) {
    return new Response("text is required", { status: 400 });
  }

  const voiceId = process.env.ELEVENLABS_VOICE_ID;
  const apiKey = process.env.ELEVENLABS_API_KEY;

  if (!voiceId || !apiKey) {
    return new Response("ElevenLabs not configured", { status: 503 });
  }

  const elevenResponse = await fetch(
    `${ELEVENLABS_API_URL}/text-to-speech/${voiceId}/stream`,
    {
      method: "POST",
      headers: {
        "xi-api-key": apiKey,
        "Content-Type": "application/json",
        Accept: "audio/mpeg",
      },
      body: JSON.stringify({
        text,
        model_id: "eleven_multilingual_v2",
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
          style: 0.0,
          use_speaker_boost: true,
        },
      }),
    }
  );

  if (!elevenResponse.ok) {
    const err = await elevenResponse.text();
    console.error("ElevenLabs error:", err);
    return new Response("TTS failed", { status: 502 });
  }

  // Stream the audio bytes directly back to the client
  return new Response(elevenResponse.body, {
    headers: {
      "Content-Type": "audio/mpeg",
      "Transfer-Encoding": "chunked",
      "Cache-Control": "no-store",
    },
  });
}
