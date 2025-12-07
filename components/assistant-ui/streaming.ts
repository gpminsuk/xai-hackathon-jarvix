export type ChatStreamHandlers = {
  onTextChunk?: (text: string) => void;
  onAnnotation?: (annotation: unknown) => void;
  onToolCall?: (tool: { name?: string; args?: unknown; result?: unknown }) => void;
};

const safeJsonParse = (input: string) => {
  try {
    return JSON.parse(input);
  } catch {
    return null;
  }
};

/**
 * Parse the streamed chat response from /api/chat.
 * Supports the prefixed line protocol:
 * - 0: text chunk (JSON encoded string)
 * - 8 or 2: annotations (JSON object or array)
 * - 9: tool call (JSON object)
 *
 * Falls back to parsing any JSON-shaped line to catch tool call metadata.
 */
export async function readChatStream(
  response: Response,
  handlers: ChatStreamHandlers = {},
): Promise<string> {
  if (!response.body) {
    throw new Error("Response is missing a body to read from.");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let aggregatedText = "";

  const handleToolCall = (raw: unknown) => {
    if (!raw || typeof raw !== "object") return;
    const tool = raw as { name?: string; toolName?: string; tool_name?: string; args?: unknown; arguments?: unknown; result?: unknown };
    const maybeName = tool.toolName || tool.tool_name || tool.name;
    if (!maybeName) return;
    handlers.onToolCall?.({
      name: maybeName,
      // Prefer structured args, fallback to openAI-style arguments blob
      args: tool.args ?? tool.arguments,
      result: tool.result,
    });
  };

  const handleAnnotations = (payload: unknown) => {
    const dispatchToolCalls = (ann: any) => {
      if (ann?.type === "tool-calls" && Array.isArray(ann.calls)) {
        ann.calls.forEach((c: any) =>
          handlers.onToolCall?.({
            name: c.name || c.toolName || c.tool_name || "unknown",
            args: c.args || c.arguments,
            result: c.result,
          }),
        );
      }
    };

    if (Array.isArray(payload)) {
      payload.forEach((ann) => {
        dispatchToolCalls(ann);
        handlers.onAnnotation?.(ann);
      });
      return;
    }

    if (payload && typeof payload === "object") {
      dispatchToolCalls(payload as any);
      handlers.onAnnotation?.(payload);
    }
  };

  const handleLine = (rawLine: string) => {
    const line = rawLine.trim();
    if (!line) return;

    // Text chunk
    if (line.startsWith("0:")) {
      const text = safeJsonParse(line.slice(2));
      if (typeof text === "string") {
        aggregatedText += text;
        handlers.onTextChunk?.(text);
      }
      return;
    }

    // Annotations
    if (line.startsWith("8:") || line.startsWith("2:")) {
      const payload = safeJsonParse(line.slice(2));
      handleAnnotations(payload);
      return;
    }

    // Tool call
    if (line.startsWith("9:")) {
      const payload = safeJsonParse(line.slice(2));
      handleToolCall(payload);
      return;
    }

    // Fallback: attempt to parse any JSON to capture stray tool-call shapes
    const fallbackObj = safeJsonParse(line.replace(/^[0-9]+:/, ""));
    if (fallbackObj) {
      const looksLikeTool =
        typeof fallbackObj === "object" &&
        (fallbackObj.toolName ||
          fallbackObj.tool_name ||
          (fallbackObj as { type?: string }).type === "tool-call" ||
          (fallbackObj as { type?: string }).type === "tool_call" ||
          (fallbackObj as { tool_call_id?: string }).tool_call_id);

      if (looksLikeTool) {
        handleToolCall(fallbackObj);
      } else {
        handleAnnotations(fallbackObj);
      }
    }
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split("\n");
    buffer = parts.pop() || "";
    for (const part of parts) {
      handleLine(part);
    }
  }

  // Flush remaining buffer
  if (buffer.trim()) {
    const tailParts = buffer.split("\n");
    for (const part of tailParts) {
      handleLine(part);
    }
  }

  return aggregatedText;
}

