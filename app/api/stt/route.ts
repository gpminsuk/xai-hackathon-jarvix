import { NextRequest } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 30;

const BASE_URL = process.env.BASE_URL || "https://api.x.ai/v1";
const API_URL = `${BASE_URL}/audio/transcriptions`;

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

    // Get the audio file from the form data
    const formData = await req.formData();
    const audioFile = formData.get("file") as File;

    if (!audioFile) {
      return new Response(JSON.stringify({ error: "Audio file is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    console.log("Received audio file:", {
      name: audioFile.name,
      type: audioFile.type,
      size: audioFile.size,
    });

    // Create form data for xAI API
    const xaiFormData = new FormData();
    // Use the original file but ensure it has a proper name
    // xAI API should accept webm, but if not, we'll see the error
    const fileName = audioFile.name || "recording.webm";
    xaiFormData.append("file", audioFile, fileName);

    console.log("Sending to xAI:", {
      name: fileName,
      type: audioFile.type,
      size: audioFile.size,
    });

    // Call xAI transcription API
    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${XAI_API_KEY}`,
      },
      body: xaiFormData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`STT API Error: ${response.status} - ${errorText}`);
      return new Response(
        JSON.stringify({
          error: `STT API Error: ${response.status} - ${errorText}`,
        }),
        {
          status: response.status,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const result = await response.json();

    return new Response(JSON.stringify({ text: result.text || "" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in STT route:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

