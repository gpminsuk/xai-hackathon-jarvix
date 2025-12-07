"use client";

import { ThreadPrimitive } from "@assistant-ui/react";
import type { FC } from "react";
import { Battery, Music, ArrowUp } from "lucide-react";
import { Dispatch, SetStateAction, useState, useRef, useEffect } from "react";
import { DashboardAgentMessage, DashboardComposer, ConversationPreview } from "./thread/dashboard";
import { DebugPanel } from "./thread/debug-panel";
import { AssistantSpeechListener } from "./thread/assistant-speech-listener";

type ToneOptions = {
  type: OscillatorType;
  frequency: number;
  duration: number;
  gain: number;
  rampTo?: number;
};

const playTone = ({ type, frequency, duration, gain, rampTo }: ToneOptions) => {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();
    osc.type = type;
    osc.frequency.value = frequency;
    gainNode.gain.setValueAtTime(gain, ctx.currentTime);
    if (rampTo !== undefined) {
      gainNode.gain.exponentialRampToValueAtTime(rampTo, ctx.currentTime + duration);
    }
    osc.connect(gainNode).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + duration);
  } catch (error) {
    console.warn("Could not play tone:", error);
  }
};

interface ThreadProps {
  sidebarOpen: boolean;
  setSidebarOpen: Dispatch<SetStateAction<boolean>>;
  isDarkMode: boolean;
  toggleDarkMode: () => void;
  userId?: string;
  triggerLabel?: string;
  driverMessage?: string;
}

export const Thread: FC<ThreadProps> = ({
  sidebarOpen: _sidebarOpen,
  setSidebarOpen: _setSidebarOpen,
  isDarkMode: _isDarkMode,
  toggleDarkMode: _toggleDarkMode,
  userId: _userId,
  triggerLabel,
  driverMessage,
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const composerInputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!triggerLabel) return;
    const normalized = triggerLabel.toLowerCase();
    if (normalized === "call ended") {
      playTone({ type: "sine", frequency: 880, duration: 0.2, gain: 0.1 });
    } else if (normalized === "destination entered") {
      playTone({ type: "triangle", frequency: 120, duration: 0.25, gain: 0.25, rampTo: 0.001 });
    }
  }, [triggerLabel]);

  const now = new Date();
  const timeStr = now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

  return (
    <ThreadPrimitive.Root
      className="w-full h-full bg-black text-white overflow-hidden relative font-sans select-none"
    >
      <div className="flex w-full h-full">
        {/* LEFT PANEL: Navigation & Media */}
        <div className="w-[32%] h-full relative flex flex-col border-r border-white/10 bg-[#0a0a0a]">
          {/* Nav Header */}
          <div className="absolute top-4 left-4 z-20 bg-[#1a1a1a]/90 backdrop-blur-sm p-4 rounded-2xl shadow-2xl border border-white/5 max-w-[85%]">
            <div className="flex items-start gap-3">
              <div className="mt-1 bg-blue-500 rounded-lg p-2">
                <ArrowUp className="w-6 h-6 text-white" strokeWidth={3} />
              </div>
              <div>
                <div className="text-xl font-semibold text-white tracking-tight">Sand Hill Rd</div>
                <div className="text-3xl font-bold mt-0.5 text-white">
                  2.6 <span className="text-lg font-medium text-gray-400">mi</span>
                </div>
              </div>
            </div>
          </div>

          {/* Map Area */}
          <div className="flex-1 w-full bg-[#111] relative overflow-hidden">
            <div
              className="absolute inset-0 opacity-10"
              style={{
                backgroundImage:
                  "linear-gradient(#333 1px, transparent 1px), linear-gradient(90deg, #333 1px, transparent 1px)",
                backgroundSize: "30px 30px",
              }}
            />

            <div className="absolute top-0 left-1/2 w-3 h-full bg-gradient-to-b from-blue-400 to-blue-600 shadow-[0_0_15px_rgba(59,130,246,0.5)] transform -translate-x-1/2"></div>

            <div className="absolute bottom-1/4 left-1/2 transform -translate-x-1/2">
              <div className="w-4 h-4 bg-blue-500 rounded-full shadow-[0_0_20px_rgba(59,130,246,0.8)] animate-pulse"></div>
            </div>

            <div className="absolute bottom-4 left-4 flex items-center gap-3 text-sm">
              <div className="bg-green-500/20 text-green-400 px-3 py-1.5 rounded-full font-medium border border-green-500/30">
                256 mi
              </div>
              <div className="bg-white/10 text-white px-3 py-1.5 rounded-full font-medium">69°F</div>
            </div>
          </div>

          {/* Media Card */}
          <div className="h-28 bg-[#1a1a1a] border-t border-white/5 p-4 flex items-center gap-4">
            <div className="w-14 h-14 bg-gradient-to-br from-green-400 to-green-600 rounded-xl flex items-center justify-center shadow-lg">
              <Music className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-base font-semibold truncate">Cruel Summer</div>
              <div className="text-sm text-gray-400 truncate">Taylor Swift</div>
              <div className="mt-2 h-1 bg-white/10 rounded-full overflow-hidden">
                <div className="w-1/3 h-full bg-white/60 rounded-full"></div>
              </div>
            </div>
          </div>
        </div>

          {/* CENTER PANEL: Car Visualization & Agent */}
          <div className="flex-1 h-full relative flex flex-col bg-gradient-to-b from-[#0a0a0a] via-black to-[#050505]">
            
            {/* Top Status Bar */}
            <div className="w-full px-6 py-3 flex justify-between items-center text-gray-400 border-b border-white/5">
              <div className="flex items-center gap-3">
                <span className="text-xs font-bold tracking-widest text-white/60">P R N D</span>
              </div>
              <div className="flex items-center gap-4 text-sm">
                <div className="flex items-center gap-1.5">
                  <Battery className="w-4 h-4 text-green-500" />
                  <span className="text-white font-medium">256 mi</span>
                </div>
                <span className="text-white/80">{timeStr}</span>
              </div>
            </div>

            {/* Car Visualization Area */}
            <div className="flex-1 relative flex flex-col items-center justify-center">
              {/* Lane lines */}
              <div className="absolute inset-0 flex justify-center pointer-events-none">
                <div className="w-px h-full bg-gradient-to-b from-transparent via-blue-500/30 to-blue-500/50 mx-16"></div>
                <div className="w-px h-full bg-gradient-to-b from-transparent via-blue-500/30 to-blue-500/50 mx-16"></div>
              </div>

              {/* Car representation */}
              <div className="relative z-10 mb-8">
                <div className="w-20 h-40 bg-gradient-to-b from-gray-300 to-white rounded-[2rem] shadow-[0_20px_60px_rgba(255,255,255,0.1)] flex flex-col items-center justify-between py-4">
                  <div className="w-[70%] h-10 bg-black/60 rounded-[1.5rem]"></div>
                  <div className="w-[70%] h-6 bg-red-500/30 rounded-b-lg blur-sm"></div>
                </div>
              </div>

              {/* JARVIX Agent Panel */}
              <div className="absolute bottom-4 left-4 right-4 z-50">
                <div className="bg-black/80 backdrop-blur-xl border border-white/10 rounded-2xl p-5 shadow-[0_0_40px_rgba(0,0,0,0.8)]">
                  
                  {/* Trigger/Status Header */}
                  {(driverMessage || triggerLabel) && (
                    <div className="flex items-center gap-3 mb-3 pb-3 border-b border-white/10">
                      {triggerLabel && (
                        <span className="text-xs font-bold tracking-wider text-blue-400 uppercase bg-blue-500/10 px-2 py-1 rounded">
                          {triggerLabel}
                        </span>
                      )}
                      {driverMessage && (
                        <span className="text-xs text-gray-400 truncate">
                          {driverMessage}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Agent Message */}
                  <DashboardAgentMessage />

                  {/* Recent conversation preview */}
                  <ConversationPreview />

                  {/* Input Area */}
                  <div className="mt-4 pt-3 border-t border-white/10">
                    <DashboardComposer
                      composerInputRef={composerInputRef}
                      isRecording={isRecording}
                      setIsRecording={setIsRecording}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT PANEL: Memory & Debug Logs */}
          <div className="w-[28%] h-full bg-[#0a0a0a] border-l border-white/10 flex flex-col overflow-hidden">
            <DebugPanel />
          </div>
      </div>

      {/* Hidden thread messages for state management */}
      <div className="hidden">
        <ThreadPrimitive.Messages
          components={{
            UserMessage: () => null,
            AssistantMessage: AssistantSpeechListener,
          }}
        />
      </div>

    </ThreadPrimitive.Root>
  );
};