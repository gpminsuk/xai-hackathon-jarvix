"use client";

import { useEffect, useMemo, useRef } from "react";
import { useMessage } from "@assistant-ui/react";

const stripGreetingPrefix = (text: string) => text.replace("[GREETING]", "");

const cleanTextForSpeech = (text: string) =>
  stripGreetingPrefix(text)
    .replace(/<highlight>(.*?)<\/highlight>/g, "$1")
    .replace(/<[^>]*>/g, "")
    .replace(/```[\s\S]*?```/g, "")
    .replace(/`[^`]*`/g, "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/#+\s/g, "")
    .trim();

/**
 * Listens to assistant messages and triggers TTS playback for the newest
 * completed message. Lives in the hidden ThreadPrimitive.Messages tree.
 */
export const AssistantSpeechListener = () => {
  const content = useMessage((m) => m.content);
  const messageId = useMessage((m) => m.id);
  const messageStatus = useMessage((m) => m.status);

  const markdownText = useMemo(() => {
    if (!content) return "";
    if (typeof content === "string") return stripGreetingPrefix(content);
    if (Array.isArray(content) && content.length > 0 && "text" in content[0]) {
      return stripGreetingPrefix(content[0].text || "");
    }
    return "";
  }, [content]);

  const isGreeting = useMemo(() => {
    if (!content) return false;
    if (typeof content === "string") return content.startsWith("[GREETING]");
    if (Array.isArray(content) && content.length > 0 && "text" in content[0]) {
      return content[0].text.startsWith("[GREETING]");
    }
    return false;
  }, [content]);

  const isInitialMountRef = useRef(true);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const hasPlayedForMessageRef = useRef<string>("");
  const previousStatusRef = useRef<typeof messageStatus>();

  useEffect(() => {
    if (isInitialMountRef.current) {
      isInitialMountRef.current = false;
      previousStatusRef.current = messageStatus;
      if (markdownText) {
        hasPlayedForMessageRef.current = messageId;
      }
      return;
    }

    const isNewMessage = hasPlayedForMessageRef.current !== messageId;
    const hasContent = markdownText.length > 0;
    const wasStreaming = previousStatusRef.current?.type === "running";
    const isNowComplete = messageStatus?.type === "complete";

    if ((wasStreaming && isNowComplete && isNewMessage && hasContent) || isGreeting) {
      const text = cleanTextForSpeech(markdownText);
      if (text.length > 0) {
        hasPlayedForMessageRef.current = messageId;
        fetch("/api/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text, voice: "Ara", responseFormat: "mp3" }),
        })
          .then((response) => (response.ok ? response.blob() : Promise.reject()))
          .then((blob) => {
            if (audioRef.current) {
              audioRef.current.pause();
              audioRef.current = null;
            }
            const audioUrl = URL.createObjectURL(blob);
            const audio = new Audio(audioUrl);
            audioRef.current = audio;
            audio.play().catch(console.error);
            audio.addEventListener("ended", () => {
              URL.revokeObjectURL(audioUrl);
              audioRef.current = null;
            });
          })
          .catch(console.error);
      }
    }

    previousStatusRef.current = messageStatus;

    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, [markdownText, messageId, messageStatus, isGreeting]);

  return null;
};


