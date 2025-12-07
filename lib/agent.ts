/**
 * Proactive Agent - TypeScript implementation matching Python core.py
 * 
 * Features:
 * - Web search for real-time information (server-side via Grok)
 * - Persistent memory via mem0 (client-side tool execution)
 * - Natural conversation flow with time-aware context
 * - Proactive assistance based on learned patterns
 * - Trigger-based behavior steering
 */

import {
  ChatMessage,
  ChatCompletionResponse,
  ChatOptions,
  MemoryClient,
  CalendarClient,
  MemoryRecord,
  ToolCall,
  Trigger,
  MEMORY_TOOL_DEFINITIONS,
  CALENDAR_TOOL_DEFINITIONS,
} from "./types";
import { Mem0MemoryClient } from "./mem0-client";
import { GoogleCalendarClient } from "./calendar-client";

const XAI_BASE_URL = process.env.XAI_BASE_URL || "https://api.x.ai/v1";

export class ProactiveAgent {
  private readonly model: string;
  private readonly apiKey: string;
  private readonly userId: string;
  private readonly memory: MemoryClient;
  private readonly calendar: CalendarClient;
  private messages: ChatMessage[] = [];

  constructor(opts: {
    apiKey: string;
    mem0ApiKey: string;
    model?: string;
    userId: string;
    systemPrompt?: string;
  }) {
    this.apiKey = opts.apiKey;
    this.model = opts.model ?? "grok-4-1-fast";
    this.userId = opts.userId;
    this.memory = new Mem0MemoryClient(opts.mem0ApiKey, opts.userId);
    this.calendar = new GoogleCalendarClient();

    const systemPrompt = opts.systemPrompt || this.buildDefaultSystemPrompt();
    this.messages = [{ role: "system", content: systemPrompt }];
  }

  /**
   * Default system prompt - matches Python implementation
   */
  private buildDefaultSystemPrompt(): string {
    return [
      "You are Jarvix, Tesla's conversational co-pilot.",
      "",
      "VOICE RULES:",
      "- Max 2-3 short sentences per reply.",
      "- Lead with the action/answer, then one brief detail.",
      "- Use contractions naturally: I'll, you're, let's.",
      "- No bullets, no lists, no markdown.",
      "- Quick acknowledgments: Got it. On it. Done.",
      "",
      "STYLE:",
      "- Short, spoken sentences. No over-explaining.",
      "- Lead with the action, then one brief detail.",
      "- Avoid filler words. Avoid apologies unless truly necessary.",
      "- Never expose internal tool wiring. Do not mention mem0 or tool calls.",
      '- End with one concise clarifying question only if it clearly moves the trip forward (e.g., "Order your usual latte for pickup?").',
      "- Always respond; never leave silence—even a quick acknowledgment is better.",
      "",
      "MEMORY:",
      "- Always search memories first to personalize.",
      "- Store new preferences silently—never mention storing.",
      "- If user says 'my usual' or 'like always', recall it confidently.",
      "",
      "PROACTIVE:",
      "- Offer A/B choices, not open-ended: 'Starbucks on the way, or straight to work?'",
      "- If something relevant is imminent, mention it briefly.",
      "- Use upcoming calendar context (next 2 hours) when it affects the drive.",
      "",
      "CALENDAR:",
      "- Calendar context includes events in the next 2 hours; surface the most relevant one briefly.",
      "",
      "CLOSING:",
      "- If the user is done, close with a concise sign-off and end the turn.",
      "",
      "NEVER:",
      "- Apologize for limitations.",
      "- Mention tools, memories, or internal steps.",
      "- Exceed ~30 words unless the user asked for detail."
    ].join("\n");
  }

  /**
   * Build time context string (matches Python _get_time_context)
   */
  private getTimeContext(): string | null {
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
   * Build upcoming context from memories + calendar within the next window.
   */
  private async buildUpcomingContext(windowMinutes: number = 120): Promise<string | null> {
    const now = Date.now();
    const soon = now + windowMinutes * 60 * 1000;
    const upcoming: { label: string; timeMs: number }[] = [];

    try {
      const memories = await this.memory.getMemories(this.userId);
      for (const mem of memories) {
        const meta = (mem.metadata as Record<string, unknown>) || {};
        const ts = (meta.timestamp as string) || (meta.start_utc as string);
        if (!ts) continue;

        const dt = Date.parse(ts);
        if (Number.isNaN(dt)) continue;

        if (dt >= now && dt <= soon) {
          const label = mem.memory || mem.text || "";
          if (label) {
            upcoming.push({ label: label.slice(0, 80), timeMs: dt });
          }
        }
      }
    } catch (error) {
      console.error("[Agent] Error building upcoming context from memories:", error);
    }

    try {
      if (this.calendar.listUpcomingEvents) {
        const events = await this.calendar.listUpcomingEvents(windowMinutes);
        for (const evt of events) {
          const dt = Date.parse(evt.start);
          if (Number.isNaN(dt)) continue;
          if (dt < now || dt > soon) continue;

          const label = evt.summary || "Calendar event";
          upcoming.push({ label: `${label} (calendar)`.slice(0, 80), timeMs: dt });
        }
      }
    } catch (error) {
      console.error("[Agent] Error fetching calendar context:", error);
    }

    if (!upcoming.length) return null;

    upcoming.sort((a, b) => a.timeMs - b.timeMs);
    const formatted = upcoming
      .slice(0, 2)
      .map((item) => {
        const timeStr = new Date(item.timeMs).toISOString().slice(11, 16) + " UTC";
        return `${timeStr} | ${item.label}`;
      })
      .join(" ; ");

    return `Upcoming within ${windowMinutes}m: ${formatted}`;
  }

  /**
   * Enforce brevity on responses (matches Python _enforce_brevity)
   */
  private enforceBrevity(response: string, maxWords: number = 35): string {
    const words = response.split(/\s+/);
    if (words.length <= maxWords) return response;

    // Keep first sentence if it fits
    const firstPeriod = response.indexOf(". ");
    if (firstPeriod > 0 && firstPeriod < response.length * 0.7) {
      const firstSentence = response.slice(0, firstPeriod + 1);
      if (firstSentence.split(/\s+/).length <= maxWords) {
        return firstSentence;
      }
    }

    return words.slice(0, maxWords).join(" ").replace(/[,.;:]+$/, "") + ".";
  }

  /**
   * Get tool definitions for xAI API
   */
  private getToolDefs(): unknown[] {
    return [
      ...MEMORY_TOOL_DEFINITIONS,
      ...CALENDAR_TOOL_DEFINITIONS,
    ];
  }

  /**
   * Execute a tool call and return the result
   */
  private async executeToolCall(toolCall: ToolCall): Promise<unknown> {
    const name = toolCall.function.name;
    let args: Record<string, unknown>;
    
    try {
      args = JSON.parse(toolCall.function.arguments);
    } catch {
      args = {};
    }

    console.log(`[Agent] Executing tool: ${name}`, args);

    switch (name) {
      case "search_memories":
        if (this.memory.searchMemories) {
          const query = String(args.query ?? "");
          return await this.memory.searchMemories(this.userId, query);
        }
        break;

      case "get_all_memories":
        return await this.memory.getMemories(this.userId);

      case "add_memory":
        if (this.memory.addMemory) {
          const text = String(args.memory_text ?? "");
          await this.memory.addMemory(this.userId, text);
          return { status: "ok" };
        }
        break;

      case "create_calendar_event":
        return await this.calendar.createEvent({
          summary: String(args.summary ?? ""),
          start_iso: String(args.start_iso ?? ""),
          end_iso: String(args.end_iso ?? ""),
          timezone: (args.timezone as string) || "UTC",
          attendees: args.attendees as { emails?: string[] } | undefined,
        });

      default:
        return { status: "unhandled", tool: name, args };
    }

    return { status: "not_implemented", tool: name };
  }

  /**
   * Make a chat completion request to xAI API
   */
  private async chatCompletion(messages: ChatMessage[], tools?: unknown[]): Promise<ChatCompletionResponse> {
    const payload: Record<string, unknown> = {
      model: this.model,
      messages,
    };

    if (tools && tools.length > 0) {
      payload.tools = tools;
    }

    const response = await fetch(`${XAI_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`xAI API error: ${response.status} - ${error}`);
    }

    return response.json() as Promise<ChatCompletionResponse>;
  }

  /**
   * Send a chat message with a required trigger hint.
   * Matches the Python chat_message method behavior.
   */
  async chatMessage(options: ChatOptions): Promise<string> {
    const { trigger, message = "" } = options;

    // Build per-call message list from history + ephemeral context
    const callMessages: ChatMessage[] = [...this.messages];
    
    // Add trigger context
    callMessages.push({ role: "system", content: `(Trigger: ${trigger})` });

    // Add time context
    const timeCtx = this.getTimeContext();
    const upcomingCtx = await this.buildUpcomingContext(120);
    const contextParts = [timeCtx, upcomingCtx].filter(Boolean);
    if (contextParts.length > 0) {
      callMessages.push({ role: "system", content: `[Context] ${contextParts.join(" | ")}` });
    }

    // Add user message
    callMessages.push({ role: "user", content: message });

    const maxRounds = 4; // resets every turn to avoid carrying limits forward
    let finalContent = "";
    let lastAssistantContent = "";

    try {
      let round = 0;
      while (round < maxRounds) {
        console.log(`[Agent] Round ${round + 1}/${maxRounds}`);

        const response = await this.chatCompletion(callMessages, this.getToolDefs());
        const choice = response.choices?.[0];
        const assistantMsg = choice?.message;

        if (!assistantMsg) {
          console.error("[Agent] No message in response");
          break;
        }

        // Track content for fallback if we hit the round cap
        if (assistantMsg.content) {
          lastAssistantContent = assistantMsg.content;
        }

        // Add assistant message to call messages
        callMessages.push(assistantMsg);

        // If no tool calls, we're done
        if (!assistantMsg.tool_calls || assistantMsg.tool_calls.length === 0) {
          finalContent = assistantMsg.content || "";
          break;
        }

        console.log(`[Agent] Processing ${assistantMsg.tool_calls.length} tool calls`);

        // Execute tool calls and add results
        for (const toolCall of assistantMsg.tool_calls) {
          const result = await this.executeToolCall(toolCall);
          const resultStr = typeof result === "string" ? result : JSON.stringify(result);
          
          callMessages.push({
            role: "tool",
            tool_call_id: toolCall.id,
            content: resultStr,
          });
        }

        // Continue to next round to get final response
        round += 1;
      }
    } catch (error) {
      console.error("[Agent] Error in chat:", error);
      const errMsg = error instanceof Error ? error.message : String(error);
      if (errMsg.includes("DEADLINE") || errMsg.includes("timeout")) {
        return "Network is slow. Want me to keep going or try again?";
      }
      // Return a brief, non-silent fallback instead of throwing.
      return "I’m still here. Want me to retry or keep going?";
    }

    // If the model never produced a final message before hitting the round cap, fall back to the last assistant content we saw.
    if (!finalContent) {
      finalContent = lastAssistantContent || "I’m here. Want me to keep going?";
    }

    // Persist the conversation
    this.messages = callMessages;

    // Enforce brevity for voice delivery
    return this.enforceBrevity(finalContent);
  }

  /**
   * Reset conversation while keeping system prompt
   */
  resetConversation(): void {
    const systemMsg = this.messages[0];
    this.messages = systemMsg ? [systemMsg] : [];
  }

  /**
   * Get current message history
   */
  getMessages(): ChatMessage[] {
    return [...this.messages];
  }
}

/**
 * Create a ProactiveAgent instance with environment configuration
 */
export function createAgent(userId: string, systemPrompt?: string): ProactiveAgent {
  const apiKey = process.env.XAI_API_KEY;
  const mem0ApiKey = process.env.MEM0_API_KEY;

  if (!apiKey) {
    throw new Error("XAI_API_KEY environment variable is required");
  }
  if (!mem0ApiKey) {
    throw new Error("MEM0_API_KEY environment variable is required");
  }

  return new ProactiveAgent({
    apiKey,
    mem0ApiKey,
    userId,
    systemPrompt,
  });
}

