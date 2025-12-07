// Types for Jarvix agent

export type Trigger =
  | "destination_set"
  | "call_ended"
  | "fsd_on"
  | "conversation_gap"
  | "passenger_exit"
  | "general";

export interface ChatOptions {
  trigger: Trigger;
  message?: string;
}

export interface MemoryRecord {
  id?: string;
  memory?: string;
  text?: string;
  metadata?: Record<string, unknown>;
}

export interface MemoryClient {
  getMemories(userId: string): Promise<MemoryRecord[]>;
  addMemory?(userId: string, text: string, metadata?: Record<string, unknown>): Promise<unknown>;
  searchMemories?(userId: string, query: string): Promise<MemoryRecord[]>;
}

export interface CalendarEventParams {
  summary: string;
  start_iso: string;
  end_iso: string;
  timezone?: string;
  attendees?: { emails?: string[] };
}

export interface CalendarEventInfo {
  summary: string;
  start: string;
  end?: string;
}

export interface CalendarClient {
  createEvent(params: CalendarEventParams): Promise<unknown>;
  listUpcomingEvents?(windowMinutes: number): Promise<CalendarEventInfo[]>;
}

export interface ToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
}

export interface ToolResult {
  name: string;
  content: unknown;
  id: string;
}

export interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content?: string | null;
  tool_call_id?: string;
  name?: string;
  tool_calls?: ToolCall[];
}

export interface ChatCompletionChoice {
  index: number;
  message: ChatMessage;
  finish_reason: string | null;
}

export interface ChatCompletionResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: ChatCompletionChoice[];
}

// Tool definitions matching Python agent
export const MEMORY_TOOL_DEFINITIONS = [
  {
    type: "function" as const,
    function: {
      name: "search_memories",
      description: "Search stored memories before answering. Use this to personalize responses.",
      parameters: {
        type: "object",
        properties: {
          query: { 
            type: "string",
            description: "Search query to find relevant memories"
          }
        },
        required: ["query"]
      }
    }
  },
  {
    type: "function" as const,
    function: {
      name: "add_memory",
      description: "Store new information about the user silently. Never mention storing.",
      parameters: {
        type: "object",
        properties: {
          memory_text: {
            type: "string",
            description: "The information to remember about the user"
          }
        },
        required: ["memory_text"]
      }
    }
  },
  {
    type: "function" as const,
    function: {
      name: "get_all_memories",
      description: "Get complete memory context for the user.",
      parameters: {
        type: "object",
        properties: {}
      }
    }
  }
];

export const CALENDAR_TOOL_DEFINITIONS = [
  {
    type: "function" as const,
    function: {
      name: "create_calendar_event",
      description: "Create a calendar event for the user.",
      parameters: {
        type: "object",
        properties: {
          summary: {
            type: "string",
            description: "Event title/summary"
          },
          start_iso: {
            type: "string",
            description: "Start time in ISO 8601 format"
          },
          end_iso: {
            type: "string",
            description: "End time in ISO 8601 format"
          },
          timezone: {
            type: "string",
            description: "Timezone (default: UTC)"
          },
          attendees: {
            type: "object",
            properties: {
              emails: {
                type: "array",
                items: { type: "string" }
              }
            }
          }
        },
        required: ["summary", "start_iso", "end_iso"]
      }
    }
  }
];

