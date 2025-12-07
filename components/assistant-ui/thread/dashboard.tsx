"use client";

import {
  ComposerPrimitive,
  useAssistantRuntime,
  useThread,
} from "@assistant-ui/react";
import type { FC } from "react";
import { Mic, Send, Square, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  RefObject,
} from "react";
import { useDebug } from "../debug-context";

export const DashboardAgentMessage: FC = () => {
  const thread = useThread();
  const messages = thread.messages;

  const lastAssistantMessage = useMemo(() => [...messages].reverse().find((m) => m.role === "assistant"), [messages]);
  const lastAssistantWithText = useMemo(
    () =>
      [...messages]
        .reverse()
        .filter((m) => m.role === "assistant")
        .find((m) => {
          const c = m.content;
          if (typeof c === "string") return c.trim().length > 0;
          if (Array.isArray(c) && c.length > 0) {
            const first = c[0] as any;
            return typeof first === "string" ? first.trim().length > 0 : (first?.text || "").trim().length > 0;
          }
          return false;
        }),
    [messages],
  );

  const lastMessage = messages[messages.length - 1];
  const isAssistantStreaming =
    lastAssistantMessage && typeof (lastAssistantMessage as any).status === "object"
      ? ((lastAssistantMessage as any).status as any).type === "running"
      : false;
  const isThinking = (lastMessage?.role === "user" || isAssistantStreaming) && !lastAssistantWithText;

  if (isThinking) {
    return (
      <div className="flex items-center gap-2">
        <div className="flex gap-1">
          <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
          <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
          <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
        </div>
        <span className="text-blue-400 font-medium">Processing...</span>
      </div>
    );
  }

  const content = lastAssistantWithText?.content;
  if (!content) {
    return <div className="text-gray-500 italic">Ready to assist. Just ask.</div>;
  }

  let text = "";
  if (typeof content === "string") text = content;
  else if (Array.isArray(content) && content.length > 0) text = (content[0] as any).text || "";

  text = text.replace("[GREETING]", "").trim();

  if (!text) {
    return (
      <div className="flex items-center gap-2 text-gray-400">
        <span className="text-yellow-500">⚡</span>
        <span className="italic">Updating system...</span>
      </div>
    );
  }

  const parts = text.split(/(<highlight>.*?<\/highlight>)/g);

  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
      <p className="text-lg font-medium leading-relaxed text-white">
        {parts.map((part, i) => {
          if (part.startsWith("<highlight>")) {
            const highlighted = part.replace(/<\/?highlight>/g, "");
            return (
              <span key={i} className="text-blue-400 font-semibold">
                {highlighted}
              </span>
            );
          }
          return <span key={i}>{part}</span>;
        })}
      </p>
    </div>
  );
};

export const ConversationPreview: FC = () => {
  const thread = useThread();
  const lastFive = useMemo(() => {
    const msgs = (thread.messages || []).slice(-5);
    return msgs
      .map((m: any, idx: number) => {
        const role = m.role || "unknown";
        let text = "";
        const content = m.content;
        if (typeof content === "string") {
          text = content;
        } else if (Array.isArray(content) && content.length > 0) {
          const first = content[0] as any;
          text = typeof first === "string" ? first : first?.text || "";
        }
        text = text.replace("[GREETING]", "").trim();
        return { id: m.id || idx, role, text };
      })
      .reverse();
  }, [thread.messages]);

  if (lastFive.length === 0) return null;

  return (
    <div className="mt-3 bg-white/5 border border-white/10 rounded-xl p-3">
      <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-gray-400 mb-2">
        <MessageSquare className="w-4 h-4 text-cyan-300" />
        Last 5 messages
      </div>
      <div className="space-y-2">
        {lastFive.map((m) => (
          <div key={m.id} className="bg-black/30 rounded-lg p-2 text-xs text-white">
            <span
              className={
                m.role === "assistant"
                  ? "text-blue-300 font-semibold"
                  : m.role === "user"
                  ? "text-green-300 font-semibold"
                  : "text-gray-300 font-semibold"
              }
            >
              {m.role.toUpperCase()}
            </span>
            <span className="mx-2 text-gray-500">•</span>
            <span className="text-gray-200 leading-relaxed">{m.text || "…"}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export interface DashboardComposerProps {
  composerInputRef: RefObject<HTMLTextAreaElement | null>;
  isRecording: boolean;
  setIsRecording: (val: boolean) => void;
}

export const DashboardComposer: FC<DashboardComposerProps> = ({
  composerInputRef,
  isRecording,
  setIsRecording,
}) => {
  return (
    <ComposerPrimitive.Root className="flex items-center gap-3">
      <VoiceRecorderButton
        isRecording={isRecording}
        setIsRecording={setIsRecording}
        composerInputRef={composerInputRef}
      />

      <div className={`flex-1 transition-opacity ${isRecording ? "opacity-50" : "opacity-100"}`}>
        <ComposerPrimitive.Input
          rows={1}
          autoFocus
          placeholder={isRecording ? "Listening..." : "Ask Jarvix..."}
          disabled={isRecording}
          className="w-full bg-white/5 border border-white/10 text-white placeholder:text-gray-500 px-4 py-3 text-base rounded-xl focus:outline-none focus:border-blue-500/50 transition-colors disabled:cursor-not-allowed"
          ref={composerInputRef}
        />
      </div>

      <ComposerPrimitive.Send asChild>
        <button className="w-11 h-11 rounded-xl bg-blue-500 hover:bg-blue-600 flex items-center justify-center transition-colors text-white shadow-lg">
          <Send className="w-5 h-5" />
        </button>
      </ComposerPrimitive.Send>
    </ComposerPrimitive.Root>
  );
};

interface VoiceRecorderButtonProps {
  isRecording: boolean;
  setIsRecording: (recording: boolean) => void;
  composerInputRef: RefObject<HTMLTextAreaElement | null>;
}

export const VoiceRecorderButton: FC<VoiceRecorderButtonProps> = ({
  isRecording,
  setIsRecording,
  composerInputRef,
}) => {
  const runtime = useAssistantRuntime();
  const { setLastTranscription } = useDebug();
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      audioChunksRef.current = [];

      const options: MediaRecorderOptions = {};
      if (MediaRecorder.isTypeSupported("audio/webm;codecs=opus")) {
        options.mimeType = "audio/webm;codecs=opus";
      } else if (MediaRecorder.isTypeSupported("audio/webm")) {
        options.mimeType = "audio/webm";
      }

      const mediaRecorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());

        const audioBlob = new Blob(audioChunksRef.current, {
          type: mediaRecorder.mimeType || "audio/webm",
        });

        try {
          const formData = new FormData();
          formData.append("file", audioBlob, "recording.wav");

          const response = await fetch("/api/stt", {
            method: "POST",
            body: formData,
          });

          if (!response.ok) throw new Error("STT API error");

          const result = await response.json();
          const transcribedText = (result.text || "").trim();

          // Surface final transcription for UI/debug visibility
          setLastTranscription(transcribedText || "(no speech detected)");

          if (transcribedText && runtime) {
            runtime.thread.append({
              role: "user",
              content: [{ type: "text", text: transcribedText }],
            });
          }
        } catch (error) {
          console.error("Error transcribing audio:", error);
          alert("Failed to transcribe audio.");
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (error) {
      console.error("Error starting recording:", error);
      alert("Microphone access failed.");
    }
  }, [runtime, setIsRecording]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  }, [isRecording, setIsRecording]);

  const toggleRecording = useCallback(() => {
    if (isRecording) stopRecording();
    else startRecording();
  }, [isRecording, startRecording, stopRecording]);

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  return (
    <button
      onClick={toggleRecording}
      className={cn(
        "w-11 h-11 rounded-xl flex items-center justify-center transition-all shadow-lg",
        isRecording ? "bg-red-500 animate-pulse shadow-red-500/30" : "bg-white/10 hover:bg-white/20",
      )}
    >
      {isRecording ? <Square className="w-5 h-5 text-white" /> : <Mic className="w-5 h-5 text-white" />}
    </button>
  );
};


