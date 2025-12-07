"use client";

import React, { createContext, useContext, useState, useCallback } from "react";

interface DebugMemory {
  id: string;
  memory: string;
  score?: number;
  event: "GET" | "ADD" | "DELETE";
}

interface DebugToolCall {
  name: string;
  args: Record<string, unknown>;
  result?: string;
  timestamp: number;
}

interface TriggerInfo {
  trigger: string;
  label: string;
  timestamp: number;
}

interface DebugContextType {
  memories: DebugMemory[];
  toolCalls: DebugToolCall[];
  triggerInfo: TriggerInfo | null;
  lastTranscription: string | null;
  addMemories: (mems: DebugMemory[]) => void;
  addToolCall: (tool: DebugToolCall) => void;
  setTrigger: (trigger: string, label: string) => void;
  setLastTranscription: (text: string | null) => void;
  clearDebug: () => void;
}

const DebugContext = createContext<DebugContextType>({
  memories: [],
  toolCalls: [],
  triggerInfo: null,
  lastTranscription: null,
  addMemories: () => {},
  addToolCall: () => {},
  setTrigger: () => {},
  setLastTranscription: () => {},
  clearDebug: () => {},
});

export const useDebug = () => useContext(DebugContext);

export const DebugProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [memories, setMemories] = useState<DebugMemory[]>([]);
  const [toolCalls, setToolCalls] = useState<DebugToolCall[]>([]);
  const [triggerInfo, setTriggerInfo] = useState<TriggerInfo | null>(null);
  const [lastTranscription, setLastTranscription] = useState<string | null>(null);

  const addMemories = useCallback((mems: DebugMemory[]) => {
    console.log("DebugProvider: Adding memories", mems);
    setMemories(prev => {
      const newMems = [...prev];
      for (const m of mems) {
        if (!newMems.find(x => x.id === m.id)) {
          newMems.push(m);
        }
      }
      return newMems.slice(-50); // Keep last 50
    });
  }, []);

  const addToolCall = useCallback((tool: DebugToolCall) => {
    setToolCalls(prev => [...prev, tool].slice(-30)); // Keep last 30
  }, []);

  const setTrigger = useCallback((trigger: string, label: string) => {
    setTriggerInfo({ trigger, label, timestamp: Date.now() });
  }, []);

  const clearDebug = useCallback(() => {
    setMemories([]);
    setToolCalls([]);
    // Don't clear trigger - keep it visible
  }, []);

  return (
    <DebugContext.Provider
      value={{
        memories,
        toolCalls,
        triggerInfo,
        lastTranscription,
        addMemories,
        addToolCall,
        setTrigger,
        setLastTranscription,
        clearDebug,
      }}
    >
      {children}
    </DebugContext.Provider>
  );
};

