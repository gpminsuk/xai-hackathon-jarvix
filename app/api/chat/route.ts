/**
 * Chat API Route - Integrates ProactiveAgent with streaming responses
 * 
 * This route handles chat messages using the Jarvix ProactiveAgent which provides:
 * - Trigger-based proactive behavior
 * - Memory tools (search, add, get all) via mem0
 * - Calendar event creation
 * - Time-aware context
 * - Voice-optimized brevity
 */

import { createDataStreamResponse, jsonSchema, streamText, tool } from "ai";
import { addMemories, getMemories } from "@mem0/vercel-ai-provider";
import { createXai } from "@ai-sdk/xai";
import { Trigger } from "@/lib/types";
import { Mem0MemoryClient } from "@/lib/mem0-client";
import { GoogleCalendarClient } from "@/lib/calendar-client";
import { z } from "zod";

// Create xAI provider
const xai = createXai({
  apiKey: process.env.XAI_API_KEY,
});

export const runtime = "nodejs"; // Need nodejs for mem0 client
export const maxDuration = 60;

/**
 * Build the Jarvix system prompt - matches Python implementation
 */
function buildSystemPrompt(customPrompt?: string): string {
  const basePrompt = `You are Jarvix, an advanced conversational co-pilot integrated into a Tesla vehicle. You are a warm, intelligent, and proactive passenger in the car.

### CORE OBJECTIVES
1) Enhance the driving experience: help, inform, and keep company without distracting.
2) Be proactive but unobtrusive: anticipate needs from context (time, location, history), never nag.
3) Maintain continuity: remember preferences and past chats; build trust over time.

### PERSONALITY & VOICE
- Warm friend, not a cold assistant. Natural, casual language (e.g., "Got it", "No problem", "Sounds good").
- Concise and voice-first: 2–3 short sentences; no lists or markdown.
- Confident but humble: act decisively; if unsure, say so or ask.

### OPERATIONAL GUIDELINES
- Action-first: when intent is clear (e.g., “get coffee”), act (check prefs, find store) before asking.
- Contextual relevance: ONLY mention memories that fit the current situation. No random facts.
- Memory:
  - Read: use MEMORIES to personalize.
  - Write: when user states a new preference/fact, call add_memory silently.
- Truthfulness: NEVER invent ETAs, prices, names, or specifics. If unknown, say you don’t know or ask.

### DESTINATION / NEXT-STEP AWARENESS
- If navigating, anticipate what happens at/after arrival.
- Use relevant memories (preferences, schedules, prior visits) to offer concise next steps (e.g., “Place your usual for pickup?”, “Want directions to the entrance?”, “Need a quick to-do when you get there?”).
- Keep it factual; do not speculate about unknown details.

### TOOL USE
- ALWAYS search memories for relevant preferences when a destination or activity is mentioned (e.g., if heading to Starbucks, search for "coffee preferences starbucks order").
- Use search_memories tool proactively to personalize responses based on context.
- Use calendar tools when scheduling or time-related requests come up.
- Never mention the tools themselves to the user.
- After any tool call, always return a brief spoken reply; do not stop at tool output.
- Always return a short spoken reply even if no memories or tools apply.

### SAFETY & FOCUS
- Driver attention first: avoid long/complex replies. If a request is unsafe while driving, suggest a safer alternative.`;

  if (customPrompt && !customPrompt.startsWith("SYSTEM FOR")) {
    return `${basePrompt}\n\n### CURRENT SCENARIO CONTEXT\n${customPrompt}`;
  }

  return basePrompt;
}

/**
 * Get time context string
 */
function getTimeContext(): string {
  const now = new Date();
  const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const day = days[now.getDay()];
  const hour = now.getHours();
  
  let period: string;
  if (hour >= 5 && hour < 12) period = "morning";
  else if (hour >= 12 && hour < 17) period = "afternoon";
  else if (hour >= 17 && hour < 21) period = "evening";
  else period = "night";

  const timeStr = now.toTimeString().slice(0, 5);
  return `Today is ${day} ${period} (${timeStr})`;
}

/**
 * Find upcoming events by scanning ALL memories for time metadata.
 * Looks at start_utc/timestamp fields and returns the soonest events within the next window.
 */
async function getUpcomingEvents(
  memoryClient: Mem0MemoryClient,
  userId: string,
  windowHours = 72,
): Promise<string[]> {
  try {
    const mems = await memoryClient.getMemories(userId);
    const now = Date.now();
    const cutoff = now + windowHours * 60 * 60 * 1000;

    const candidates: Array<{ ts: number; label: string }> = [];

    for (const mem of mems) {
      const meta = (mem as any)?.metadata || {};
      const tsStr =
        meta.start_utc ||
        meta.timestamp ||
        meta.start ||
        meta.date ||
        meta.datetime;
      if (!tsStr) continue;

      const ts = Date.parse(tsStr);
      if (Number.isNaN(ts)) continue;
      if (ts < now || ts > cutoff) continue;

      const label = (mem as any)?.memory || (mem as any)?.text || "";
      const trimmed = label ? label.slice(0, 160) : "Upcoming event";
      candidates.push({ ts, label: trimmed });
    }

    candidates.sort((a, b) => a.ts - b.ts);

    return candidates.slice(0, 5).map((c) => {
      const timeStr = new Date(c.ts).toISOString().replace("T", " ").slice(0, 16) + " UTC";
      return `${timeStr} — ${c.label}`;
    });
  } catch (error) {
    console.error("[getUpcomingEvents] Error:", error);
    return [];
  }
}

/**
 * Format memories for retrieval context
 * Shows ALL memories to agent, categorized for clarity
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function formatMemoriesContext(memories: any[]): string {
  if (!memories || memories.length === 0) return "MEMORIES: None retrieved.";
  
  const lines = memories.map((m, i) => {
    const text = m.memory || "";
    const score = typeof m.score === "number" ? ` (score ${(m.score * 100).toFixed(0)}%)` : "";
    return `  ${i + 1}. ${text}${score}`;
  });
  
  return `MEMORIES (Use ONLY if relevant to current request):\n${lines.join("\n")}`;
}

export async function POST(req: Request) {
  try {
    const { messages, system: customSystem, tools: clientTools, userId, trigger } = await req.json();
    
    const effectiveUserId = userId || "demo_tesla_user";
    const effectiveTrigger: Trigger = trigger || "general";

    // Collect tool calls and memory updates for debug panel
    const toolLogs: Array<{ name: string; args: unknown; result?: unknown }> = [];
    const memoryUpdates: Array<{ id?: string; memory: string; event?: string }> = [];
    const searchedMemories: Array<{ id?: string; memory: string; score?: number }> = [];

    // Initialize clients
    const mem0ApiKey = process.env.MEM0_API_KEY;
    if (!mem0ApiKey) {
      throw new Error("MEM0_API_KEY not configured");
    }
    
    const memoryClient = new Mem0MemoryClient(mem0ApiKey, effectiveUserId);
    const calendarClient = new GoogleCalendarClient();

    // Normalize messages format for mem0
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const normalizedMessages = messages.map((msg: any) => {
      let content = msg.content;
      
      // Filter out [GREETING] prefix from assistant messages
      if (msg.role === "assistant") {
        if (typeof content === "string") {
          content = content.replace("[GREETING]", "");
        } else if (Array.isArray(content)) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          content = content.map((part: any) => {
            if (typeof part === "string") return part.replace("[GREETING]", "");
            if (part.type === "text") return { ...part, text: part.text.replace("[GREETING]", "") };
            return part;
          });
        }
      }

      if (typeof content === "string") {
        return {
          ...msg,
          content: [{ type: "text", text: content }],
        };
      }
      if (Array.isArray(content)) {
        return {
          ...msg,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          content: content.map((part: any) => {
            if (typeof part === "string") {
              return { type: "text", text: part };
            }
            return part;
          }),
        };
      }
      return msg;
    });

    // PARALLEL: Fetch memories AND upcoming events simultaneously
    console.log(`[Chat] Starting parallel memory fetch for user: ${effectiveUserId}`);
    const [memories, upcomingEvents] = await Promise.all([
      getMemories(normalizedMessages, {
        user_id: effectiveUserId,
      rerank: true,
      threshold: 0.1,
        top_k: 12,
      }),
      getUpcomingEvents(memoryClient, effectiveUserId),
    ]);
    console.log(`[Chat] Retrieved ${memories.length} memories, ${upcomingEvents.length} events`);
    const memoriesContext = formatMemoriesContext(memories);
    
    const upcomingContext = upcomingEvents.length > 0 
      ? `\nSCHEDULE CONTEXT:\n${upcomingEvents.map(e => `  • ${e}`).join("\n")}`
      : "";

    // Build trigger-specific instructions
    let triggerInstruction = "";
    if (effectiveTrigger === "destination_set") {
      triggerInstruction = `\n### CURRENT ACTION
Navigation to a destination just started. IMMEDIATELY search memories for preferences related to this destination (food, drinks, usual orders, etc.) and proactively offer helpful next steps.`;
    } else if (effectiveTrigger === "call_ended") {
      triggerInstruction = `\n### CURRENT ACTION
A phone call just ended. Search memories for context mentioned in the call and offer proactive follow-up actions.`;
    }

    // Build full system prompt with context
    const systemParts = [
      buildSystemPrompt(customSystem),
      triggerInstruction,
      `(Trigger: ${effectiveTrigger})`,
      `[Context] ${getTimeContext()}`,
      memoriesContext,
      upcomingContext,
    ].filter(Boolean);

    const fullSystemPrompt = systemParts.join("\n\n");

    // Define executable tools
    const executableTools = {
      search_memories: tool({
        description: "Search user's stored memories and preferences.",
        parameters: z.object({
          query: z.string().describe("What to search for"),
        }),
        execute: async ({ query }) => {
          console.log("[Tool] search_memories:", query);
          try {
            const results = await memoryClient.searchMemories(effectiveUserId, query);
            toolLogs.push({ name: "search_memories", args: { query }, result: results });
            // Capture for retrieved memories panel
            for (const r of results) {
              const rec: any = r;
              searchedMemories.push({
                id: r.id,
                memory: r.memory || r.text || "",
                score: typeof rec?.score === "number" ? rec.score : undefined,
              });
            }
            return results.length > 0 
              ? results.map(m => m.memory || m.text).join("\n")
              : "No relevant memories found.";
          } catch (error) {
            console.error("[Tool] search_memories error:", error);
            toolLogs.push({ name: "search_memories", args: { query }, result: "error" });
            return "Could not search memories.";
          }
        },
      }),
      add_memory: tool({
        description: "Store new user preference or information permanently.",
        parameters: z.object({
          memory_text: z.string().describe("The information to remember"),
        }),
        execute: async ({ memory_text }) => {
          console.log("[Tool] add_memory:", memory_text);
          // Sanitize to second-person: avoid user names, prefer "you/your"
          const sanitizeMemory = (text: string) => {
            let t = text;
            // Replace common names / ids with "you"
            const namePatterns = ["Mark", "Lia", "demo_user", "demo_tesla_user"];
            for (const n of namePatterns) {
              const re = new RegExp(`\\b${n}\\b`, "gi");
              t = t.replace(re, "you");
            }
            // Replace "my" with "your" when referring to user preference
            t = t.replace(/\bmy\b/gi, "your");
            // If it starts with "I " change to "You "
            t = t.replace(/^\s*I\b/gi, "You");
            return t.trim();
          };
          const cleaned = sanitizeMemory(memory_text);
          try {
            await memoryClient.addMemory(effectiveUserId, cleaned);
            toolLogs.push({ name: "add_memory", args: { memory_text: cleaned }, result: "ok" });
            // Track for debug panel as a memory update
            memoryUpdates.push({ memory: cleaned, event: "ADD" });
            return "Memory stored.";
          } catch (error) {
            console.error("[Tool] add_memory error:", error);
            toolLogs.push({ name: "add_memory", args: { memory_text: cleaned }, result: "error" });
            return "Could not store memory.";
          }
        },
      }),
      get_all_memories: tool({
        description: "Get all stored memories for context.",
        parameters: z.object({}),
        execute: async () => {
          console.log("[Tool] get_all_memories");
          try {
            const results = await memoryClient.getMemories(effectiveUserId);
            toolLogs.push({ name: "get_all_memories", args: {}, result: results });
            for (const r of results) {
              const rec: any = r;
              searchedMemories.push({
                id: r.id,
                memory: r.memory || r.text || "",
                score: typeof rec?.score === "number" ? rec.score : undefined,
              });
            }
            return results.length > 0 
              ? results.map(m => m.memory || m.text).join("\n")
              : "No memories stored yet.";
          } catch (error) {
            console.error("[Tool] get_all_memories error:", error);
            toolLogs.push({ name: "get_all_memories", args: {}, result: "error" });
            return "Could not retrieve memories.";
          }
        },
      }),
      create_calendar_event: tool({
        description: "Create a calendar event for the user.",
        parameters: z.object({
          summary: z.string().describe("Event title"),
          start_iso: z.string().describe("Start time in ISO 8601 format"),
          end_iso: z.string().describe("End time in ISO 8601 format"),
          timezone: z.string().optional().describe("Timezone (default: UTC)"),
          attendee_emails: z.array(z.string()).optional().describe("List of attendee emails"),
        }),
        execute: async ({ summary, start_iso, end_iso, timezone, attendee_emails }) => {
          console.log("[Tool] create_calendar_event:", summary);
          try {
            const result = await calendarClient.createEvent({
              summary,
              start_iso,
              end_iso,
              timezone: timezone || "UTC",
              attendees: attendee_emails ? { emails: attendee_emails } : undefined,
            });
            toolLogs.push({ name: "create_calendar_event", args: { summary, start_iso, end_iso, timezone, attendee_emails }, result });
            return `Event "${summary}" created successfully.`;
          } catch (error) {
            console.error("[Tool] create_calendar_event error:", error);
            toolLogs.push({ name: "create_calendar_event", args: { summary, start_iso, end_iso, timezone, attendee_emails }, result: "error" });
            return "Could not create calendar event.";
          }
        },
      }),
    };

    // Stream the response
    const result = streamText({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      model: xai("grok-4-1-fast" as any),
      messages: normalizedMessages,
      system: fullSystemPrompt,
      tools: executableTools,
      maxSteps: 8, // allow multi-tool then final reply
      onFinish: (event) => {
        console.log("[Chat] Stream finished. Usage:", event.usage);
      },
    });

    // Add memories asynchronously - this auto-extracts facts from conversation
    console.log(`[Chat] Starting addMemories task for user: ${effectiveUserId}`);
    const addMemoriesTask = addMemories(normalizedMessages, {
      user_id: effectiveUserId,
    });

    return createDataStreamResponse({
      execute: async (writer) => {
        try {
          // Send retrieved memories annotation
          if (memories.length > 0) {
            writer.writeMessageAnnotation({
              type: "mem0-get",
              memories,
            });
          }

          // Send trigger annotation
          writer.writeMessageAnnotation({
            type: "trigger",
            trigger: effectiveTrigger,
          });

          // Merge stream into response - MUST await this!
          await result.mergeIntoDataStream(writer);

          // If model produced no visible content, send a short fallback so UI isn't blank.
          // createDataStreamResponse writer supports message annotations; we'll emit a tiny assistant text message.
          const hasContent = true; // mergeIntoDataStream already wrote; fallback path below only if we explicitly decide to bypass.
          if (!hasContent) {
            writer.writeMessageAnnotation({
              type: "assistant-fallback",
              content: "Got it. I’ll keep that in mind and stay ready.",
            });
          }

          // Send new memories annotation after stream completes
          const newMemories = await addMemoriesTask;
          console.log(`[Chat] addMemories completed, ${newMemories.length} new memories extracted`);

          const formatted = newMemories
            .map((m: any, idx: number) => {
              const memText =
                (typeof m.memory === "string" && m.memory.trim()) ||
                (typeof m.text === "string" && m.text.trim()) ||
                (typeof m.data?.memory === "string" && m.data.memory.trim()) ||
                (typeof m.data?.text === "string" && m.data.text.trim()) ||
                "";
              if (!memText) return null;
              return {
                id: m.id || `mem0-add-${Date.now()}-${idx}`,
                data: { memory: memText },
                event: "ADD",
              };
            })
            .filter(Boolean);

          const hasNonEmpty = formatted.length > 0;

          if (hasNonEmpty) {
            console.log(`[Chat] New memories:`, formatted);
            writer.writeMessageAnnotation({
              type: "mem0-update",
              memories: formatted,
            });
          } else {
            console.log("[Chat] No non-empty memories returned from addMemories, attempting fallback.");
            // Fallback: if mem0 extraction returned nothing usable, store the last user utterance verbatim
            const lastUserMessage = [...normalizedMessages].reverse().find((m: any) => m.role === "user");
            const lastUserText =
              typeof lastUserMessage?.content === "string"
                ? lastUserMessage?.content
                : Array.isArray(lastUserMessage?.content) && lastUserMessage?.content[0]?.text
                ? (lastUserMessage?.content[0]?.text as string)
                : "";

            const fallbackText = (lastUserText || "").toString().trim();
            if (fallbackText) {
              try {
                await memoryClient.addMemory(effectiveUserId, fallbackText);
                const fallbackMem = [
                  {
                    id: `fallback-add-${Date.now()}`,
                    data: { memory: fallbackText },
                    event: "ADD",
                  },
                ];
                console.log("[Chat] Fallback memory stored:", fallbackMem);
                writer.writeMessageAnnotation({
                  type: "mem0-update",
                  memories: fallbackMem,
                });
              } catch (err) {
                console.error("[Chat] Fallback memory store failed:", err);
              }
            } else {
              console.log("[Chat] No user text available for fallback memory storage.");
            }
          }

          // Send tool call log annotation for debug panel
          if (toolLogs.length > 0) {
            const toJSONValue = (v: unknown) => {
              if (v === null || v === undefined) return null;
              if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") return v;
              try {
                return JSON.parse(JSON.stringify(v));
              } catch {
                return String(v);
              }
            };
            writer.writeMessageAnnotation({
              type: "tool-calls",
              calls: toolLogs.map((c, idx) => ({
                id: `tool-call-${idx}`,
                name: c.name,
                args: toJSONValue(c.args),
                result: toJSONValue(c.result),
              })),
            });
          }

          // Send memory update annotation for immediate visibility
          if (memoryUpdates.length > 0) {
            writer.writeMessageAnnotation({
              type: "mem0-update",
              memories: memoryUpdates.map((m, i) => ({
                id: m.id || `local-add-${Date.now()}-${i}`,
                data: { memory: m.memory },
                event: m.event || "ADD",
              })),
            });
          }

          // Send searched memories as retrieved memories annotation
          if (searchedMemories.length > 0) {
            writer.writeMessageAnnotation({
              type: "mem0-get",
              memories: searchedMemories,
            });
          }
        } catch (error) {
          console.error("Error in stream execution:", error);
          throw error;
        }
      },
    });
  } catch (error) {
    console.error("Error in POST handler:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
