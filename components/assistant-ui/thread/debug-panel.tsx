"use client";

import { useMemo, useState } from "react";
import type { FC } from "react";
import { Brain, ChevronDown, ChevronRight, Database, Wrench, Zap, Mic } from "lucide-react";
import { useThread } from "@assistant-ui/react";
import { useDebug } from "../debug-context";

type ToolCall = { name: string; args: unknown; result?: string; timestamp: number };

const deriveThreadToolCalls = (messages: any[]): ToolCall[] => {
  const calls: ToolCall[] = [];
  for (const msg of messages) {
    // OpenAI style tool calls
    const tcArr = (msg as any).tool_calls || (msg as any).toolCalls;
    if (Array.isArray(tcArr)) {
      for (const tc of tcArr) {
        calls.push({
          name: tc.function?.name || tc.name || "unknown",
          args: tc.function?.arguments ? JSON.parse(tc.function.arguments) : tc.args || {},
          timestamp: Date.now(),
        });
      }
    }

    // Vercel AI SDK streaming parts
    const content = (msg as any).content;
    if (Array.isArray(content)) {
      for (const part of content) {
        if (part?.type === "tool-call") {
          calls.push({
            name: part.toolName || part.name || "unknown",
            args: part.args || {},
            timestamp: Date.now(),
          });
        }
        if (part?.type === "tool-result") {
          const last = calls[calls.length - 1];
          if (last && !last.result) {
            last.result = typeof part.result === "string" ? part.result : JSON.stringify(part.result || "");
          }
        }
      }
    }
  }
  return calls.slice(-20);
};

export const DebugPanel: FC = () => {
  const { memories, toolCalls, triggerInfo, lastTranscription } = useDebug();
  const thread = useThread();
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    memories: true,
    tools: true,
  });

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  const threadToolCalls = useMemo(() => deriveThreadToolCalls(thread.messages || []), [thread.messages]);
  const combinedToolCalls = useMemo(() => [...toolCalls, ...threadToolCalls].slice(-30), [toolCalls, threadToolCalls]);
  const messageCount = (thread.messages || []).length || 0;

  return (
    <div className="h-full flex flex-col text-sm">
      <div className="p-4 border-b border-white/10">
        <h2 className="text-white font-semibold flex items-center gap-2">
          <Brain className="w-4 h-4 text-blue-400" />
          Agent Debug
        </h2>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {triggerInfo && (
          <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-3">
            <div className="flex items-center gap-2 text-blue-400 font-medium text-xs mb-1">
              <Zap className="w-3 h-3" />
              TRIGGER ACTIVATED
            </div>
            <div className="text-white font-semibold">{triggerInfo.label}</div>
            <div className="text-gray-500 text-xs mt-1">
              {new Date(triggerInfo.timestamp).toLocaleTimeString()}
            </div>
          </div>
        )}

        <div className="bg-white/5 rounded-xl p-3 flex items-center gap-3">
          <Mic className="w-4 h-4 text-purple-300" />
          <div className="flex flex-col">
            <span className="text-xs text-gray-400 uppercase tracking-wide">Last transcription</span>
            <span className="text-white text-sm">
              {lastTranscription ? `"${lastTranscription}"` : "No transcription yet"}
            </span>
          </div>
        </div>

        <div className="bg-white/5 rounded-xl overflow-hidden">
          <button
            onClick={() => toggleSection("memories")}
            className="w-full p-3 flex items-center justify-between text-left hover:bg-white/5 transition-colors"
          >
            <span className="flex items-center gap-2 text-white font-medium">
              <Database className="w-4 h-4 text-green-400" />
              Retrieved Memories ({memories.filter((m: any) => m.event === "GET").length})
            </span>
            {expandedSections.memories ? (
              <ChevronDown className="w-4 h-4 text-gray-400" />
            ) : (
              <ChevronRight className="w-4 h-4 text-gray-400" />
            )}
          </button>
          {expandedSections.memories && (
            <div className="px-3 pb-3 space-y-2">
              {memories.filter((m: any) => m.event === "GET").length === 0 ? (
                <div className="text-gray-500 text-xs italic">No memories retrieved yet</div>
              ) : (
                memories
                  .filter((m: any) => m.event === "GET")
                  .map((m: any, i: number) => (
                    <div key={m.id || i} className="bg-black/30 rounded-lg p-2 text-xs">
                      <div className="text-gray-300 leading-relaxed">{m.memory}</div>
                      {m.score && (
                        <div className="mt-1 text-gray-500">
                          Score: {(m.score * 100).toFixed(0)}%
                        </div>
                      )}
                    </div>
                  ))
              )}
            </div>
          )}
        </div>

        <div className="bg-white/5 rounded-xl overflow-hidden">
          <button
            onClick={() => toggleSection("tools")}
            className="w-full p-3 flex items-center justify-between text-left hover:bg-white/5 transition-colors"
          >
            <span className="flex items-center gap-2 text-white font-medium">
              <Wrench className="w-4 h-4 text-yellow-400" />
              Tool Calls ({combinedToolCalls.length})
            </span>
            {expandedSections.tools ? (
              <ChevronDown className="w-4 h-4 text-gray-400" />
            ) : (
              <ChevronRight className="w-4 h-4 text-gray-400" />
            )}
          </button>
          {expandedSections.tools && (
            <div className="px-3 pb-3 space-y-2">
              {combinedToolCalls.length === 0 ? (
                <div className="text-gray-500 text-xs italic">No tool calls yet</div>
              ) : (
                combinedToolCalls.map((t: any, i: number) => (
                  <div key={i} className="bg-black/30 rounded-lg p-2 text-xs">
                    <div className="text-yellow-400 font-mono font-medium">{t.name}</div>
                    <div className="text-gray-400 mt-1 font-mono text-[10px] break-all">
                      {JSON.stringify(t.args, null, 0)}
                    </div>
                    {t.result && (
                      <div className="text-green-400/80 mt-1 text-[10px] truncate">
                        → {t.result.slice(0, 100)}
                        {t.result.length > 100 ? "..." : ""}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {memories.filter((m: any) => m.event === "ADD").length > 0 && (
          <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-3">
            <div className="flex items-center gap-2 text-green-400 font-medium text-xs mb-2">
              <Database className="w-3 h-3" />
              Memory Updated
            </div>
            {memories
              .filter((m: any) => m.event === "ADD")
              .map((m: any, i: number) => (
                <div key={i} className="text-gray-300 text-xs bg-black/20 rounded p-2 mt-1">
                  {m.memory}
                </div>
              ))}
          </div>
        )}
      </div>

      <div className="p-3 border-t border-white/10 text-xs text-gray-500">
        Messages: {messageCount} | Model: grok-4-1-fast
      </div>
    </div>
  );
};


