"use client";

import { AssistantRuntimeProvider, useAssistantRuntime } from "@assistant-ui/react";
import { useChatRuntime } from "@assistant-ui/react-ai-sdk";
import { Thread } from "@/components/assistant-ui/thread";
import { useEffect, useState } from "react";
import { useLocalStorage } from "usehooks-ts";
import { GreetingLoadingContext } from "@/components/assistant-ui/greeting-context";
import { DebugProvider, useDebug } from "@/components/assistant-ui/debug-context";
import {
  fixedUserIds,
  getTriggerForUser,
  getSystemPromptForUser,
  getMem0UserId,
  getTriggerLabel,
  getNewThreadText,
  getGreetingContextForUser,
} from "@/components/assistant-ui/utils";
import { readChatStream } from "@/components/assistant-ui/streaming";
import { Play, ChevronDown } from "lucide-react";

// Trigger button component that needs runtime context
const TriggerButton = ({ 
  userId, 
  isLoading, 
  setIsLoading 
}: { 
  userId: string; 
  isLoading: boolean; 
  setIsLoading: (v: boolean) => void;
}) => {
  const runtime = useAssistantRuntime();
  const { addMemories, addToolCall, setTrigger, clearDebug } = useDebug();
  
  const handleTrigger = async () => {
    if (isLoading) return;
    setIsLoading(true);
    clearDebug(); // Clear previous debug info
    
    try {
      const trigger = getTriggerForUser(userId);
      const triggerLabel = getTriggerLabel(trigger);
      const systemPrompt = getSystemPromptForUser(userId);
      const greetingContext = getGreetingContextForUser(userId);
      const mem0UserId = getMem0UserId();

      // Set trigger in debug panel
      setTrigger(trigger, triggerLabel);

      console.log(`[Trigger] Running scenario for ${userId}, trigger: ${triggerLabel}`);

      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [{ role: "user", content: greetingContext }],
          userId: mem0UserId,
          trigger: trigger,
          system: systemPrompt,
          tools: {},
        }),
      });

      if (!response.ok) throw new Error(`API error: ${response.status}`);

      const fullResponse = await readChatStream(response, {
        onAnnotation: (annotation) => {
          if (!annotation || typeof annotation !== "object") return;
          const ann: any = annotation;

          if (ann.type === "tool-calls" && Array.isArray(ann.calls)) {
            for (const call of ann.calls) {
              addToolCall({
                name: call.name || "unknown",
                args: call.args || {},
                result:
                  typeof call.result === "string"
                    ? call.result
                    : JSON.stringify(call.result || ""),
                timestamp: Date.now(),
              });
            }
          }

          if (ann.type === "mem0-get" && ann.memories) {
            addMemories(
              ann.memories.map((m: any) => ({
                id: m.id,
                memory: m.memory,
                score: m.score,
                event: "GET",
              })),
            );
          }

          if (ann.type === "mem0-update" && ann.memories) {
            addMemories(
              ann.memories.map((m: any) => ({
                id: m.id,
                memory: m.data?.memory || m.memory || "",
                event: m.event || "ADD",
              })),
            );
          }

          if (ann.type === "trigger") {
            setTrigger(ann.trigger, getTriggerLabel(ann.trigger));
          }
        },
        onToolCall: (toolData) => {
          addToolCall({
            name: toolData.name || "unknown",
            args: toolData.args || {},
            result:
              typeof toolData.result === "string"
                ? toolData.result
                : toolData.result
                ? JSON.stringify(toolData.result)
                : undefined,
            timestamp: Date.now(),
          });
        },
      });

      if (fullResponse.trim()) {
        runtime.thread.append({
          role: "assistant",
          content: [{ type: "text", text: `[GREETING]${fullResponse.trim()}` }],
        });
      }
    } catch (error) {
      console.error("Error triggering scenario:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <button
      onClick={handleTrigger}
      disabled={isLoading}
      className={`flex items-center gap-2 px-5 py-3 rounded-xl font-semibold text-sm transition-all shadow-lg ${
        isLoading
          ? "bg-gray-600 cursor-not-allowed opacity-60"
          : "bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-400 hover:to-emerald-500 shadow-green-500/30"
      }`}
    >
      {isLoading ? (
        <>
          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          Running...
        </>
      ) : (
        <>
          <Play className="w-4 h-4" />
          Run Scenario
        </>
      )}
    </button>
  );
};

export const Assistant = () => {
  const [selectedUserId, setSelectedUserId] = useLocalStorage<string>(
    "selectedUserId",
    fixedUserIds[0][0]
  );

  useEffect(() => {
    document.documentElement.classList.add("dark");
  }, []);

  const handleUserIdChange = (newUserId: string) => {
    if (newUserId !== selectedUserId && fixedUserIds.some((id) => id[0] === newUserId)) {
      setSelectedUserId(newUserId);
    }
  };

  const currentTrigger = getTriggerForUser(selectedUserId);
  const currentSystemPrompt = getSystemPromptForUser(selectedUserId);
  const triggerLabel = getTriggerLabel(currentTrigger);
  const driverMessage = getNewThreadText(selectedUserId);
  const mem0UserId = getMem0UserId();

  const runtime = useChatRuntime({
    api: "/api/chat",
    body: {
      userId: mem0UserId,
      trigger: currentTrigger,
      system: currentSystemPrompt,
    },
  });

  const [isGreetingLoading, setIsGreetingLoading] = useState(false);

  return (
    <DebugProvider>
      <GreetingLoadingContext.Provider
        value={{ isLoading: isGreetingLoading, setIsLoading: setIsGreetingLoading }}
      >
        <AssistantRuntimeProvider runtime={runtime}>
          <div className="h-screen w-screen bg-black overflow-hidden relative">
          
          {/* TOP BAR: Scenario Selector + Trigger Button */}
          <div className="absolute top-0 left-0 right-0 z-50 h-16 bg-black/90 backdrop-blur-xl border-b border-white/10 flex items-center justify-between px-6">
            
            {/* Left: Jarvix Logo */}
            <div className="flex items-center gap-4">
              <div className="bg-gradient-to-r from-blue-600 to-blue-500 px-4 py-2 rounded-xl text-white font-bold text-sm tracking-wide shadow-lg shadow-blue-500/20">
                JARVIX
              </div>
              <span className="text-gray-500 text-sm">Tesla Co-Pilot Demo</span>
            </div>

            {/* Center: Scenario Selector */}
            <div className="flex items-center gap-4">
              <span className="text-gray-400 text-sm">Scenario:</span>
              <div className="relative">
                <select
                  value={selectedUserId || fixedUserIds[0][0]}
                  onChange={(e) => handleUserIdChange(e.target.value)}
                  className="h-10 pl-4 pr-10 rounded-xl bg-white/5 border border-white/10 text-white text-sm font-medium focus:outline-none focus:border-blue-500 cursor-pointer appearance-none min-w-[200px]"
                >
                  {fixedUserIds.map((id) => (
                    <option key={id[0]} value={id[0]} className="bg-black text-white">
                      {id[0]}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              </div>
            </div>

            {/* Right: Trigger Button */}
            <TriggerButton 
              userId={selectedUserId} 
              isLoading={isGreetingLoading} 
              setIsLoading={setIsGreetingLoading} 
            />
          </div>

          {/* Main Tesla Dashboard - offset for top bar */}
          <div className="w-full h-full pt-16">
            <Thread
              sidebarOpen={false}
              setSidebarOpen={() => {}}
              isDarkMode={true}
              toggleDarkMode={() => {}}
              userId={selectedUserId}
              triggerLabel={triggerLabel}
              driverMessage={driverMessage}
            />
          </div>
          </div>
        </AssistantRuntimeProvider>
      </GreetingLoadingContext.Provider>
    </DebugProvider>
  );
};
