import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { toFile } from "openai/uploads";

export const runtime = "nodejs";
export const maxDuration = 30;

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

export async function POST(req: NextRequest) {
  const formData = await req.formData().catch(() => null);
  if (!formData) {
    return NextResponse.json({ error: "Expected multipart/form-data" }, { status: 400 });
  }

  const audioField = formData.get("audio");
  if (!audioField || !(audioField instanceof Blob)) {
    return NextResponse.json({ error: "Missing audio field" }, { status: 400 });
  }

  // Whisper requires a filename with extension to detect the codec
  const mimeType = audioField.type || "audio/webm";
  const ext = mimeType.includes("mp4") || mimeType.includes("m4a") ? "m4a"
    : mimeType.includes("ogg") ? "ogg"
    : mimeType.includes("wav") ? "wav"
    : "webm";

  const arrayBuffer = await audioField.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const transcription = await openai.audio.transcriptions.create({
    model: "whisper-1",
    file: await toFile(buffer, `audio.${ext}`, { type: mimeType }),
    language: "de",
    response_format: "json",
  });

  return NextResponse.json({ text: transcription.text });
}
