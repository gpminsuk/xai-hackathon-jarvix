import { NextRequest } from "next/server";

export const runtime = "edge";
export const maxDuration = 30;

const BASE_URL = process.env.BASE_URL || "https://api.x.ai/v1";
const API_URL = `${BASE_URL}/audio/speech`;

interface TTSRequest {
  text: string;
  voice?: string;
  responseFormat?: string;
}

export async function POST(req: NextRequest) {
  try {
    const XAI_API_KEY = process.env.XAI_API_KEY;

    if (!XAI_API_KEY) {
      return new Response(
        JSON.stringify({
          error: "XAI_API_KEY not found in environment variables",
        }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    const {
      text,
      voice = "Ara",
      responseFormat = "mp3",
    }: TTSRequest = await req.json();

    if (!text) {
      return new Response(JSON.stringify({ error: "Text is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Clean text - remove markdown and HTML tags for better TTS
    const cleanText = text
      .replace(/<highlight>(.*?)<\/highlight>/g, "$1") // Remove highlight tags but keep the text
      .replace(/<[^>]*>/g, "") // Remove all HTML tags
      .replace(/```[\s\S]*?```/g, "") // Remove code blocks
      .replace(/`[^`]*`/g, "") // Remove inline code
      .replace(/\*\*([^*]+)\*\*/g, "$1") // Remove bold markdown
      .replace(/\*([^*]+)\*/g, "$1") // Remove italic markdown
      .replace(/#+\s/g, "") // Remove heading markdown
      .trim();

    if (!cleanText) {
      return new Response(
        JSON.stringify({ error: "No text content after cleaning" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${XAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        input: cleanText,
        voice: voice,
        response_format: responseFormat,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`TTS API Error: ${response.status} - ${errorText}`);
      return new Response(
        JSON.stringify({
          error: `TTS API Error: ${response.status} - ${errorText}`,
        }),
        {
          status: response.status,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Return audio as binary data
    const audioBuffer = await response.arrayBuffer();

    return new Response(audioBuffer, {
      status: 200,
      headers: {
        "Content-Type": `audio/${responseFormat}`,
        "Content-Length": audioBuffer.byteLength.toString(),
      },
    });
  } catch (error) {
    console.error("Error in TTS route:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
