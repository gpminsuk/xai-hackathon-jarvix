"use client";

import {
  ActionBarPrimitive,
  BranchPickerPrimitive,
  ComposerPrimitive,
  MessagePrimitive,
  ThreadPrimitive,
  ThreadListItemPrimitive,
  ThreadListPrimitive,
  useMessage,
  useThread,
  useAssistantRuntime,
  useThreadListItem,
} from "@assistant-ui/react";
import type { FC } from "react";
import {
  ArrowDownIcon,
  CheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CopyIcon,
  PencilIcon,
  RefreshCwIcon,
  SendHorizontalIcon,
  ArchiveIcon,
  PlusIcon,
  Sun,
  Moon,
  SaveIcon,
  MicIcon,
  SquareIcon,
  TrashIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Dispatch,
  SetStateAction,
  useState,
  useRef,
  useEffect,
  useCallback,
} from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "../ui/scroll-area";
import { TooltipIconButton } from "@/components/assistant-ui/tooltip-icon-button";
import { MemoryUI } from "./memory-ui";
import MarkdownRenderer from "../mem0/markdown";
import React from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import GithubButton from "../mem0/github-button";
import Link from "next/link";
import { getNewThreadText } from "@/app/assistant";
import { GreetingLoadingContext } from "./greeting-context";

// Create a context to pass userId to ThreadListItem in mobile drawer
const UserIdContext = React.createContext<string | undefined>(undefined);

interface ThreadProps {
  sidebarOpen: boolean;
  setSidebarOpen: Dispatch<SetStateAction<boolean>>;
  isDarkMode: boolean;
  toggleDarkMode: () => void;
  userId?: string;
}

export const Thread: FC<ThreadProps> = ({
  sidebarOpen,
  setSidebarOpen,
  isDarkMode,
  toggleDarkMode,
  userId,
}) => {
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const composerInputRef = useRef<HTMLTextAreaElement>(null);
  const thread = useThread();
  const runtime = useAssistantRuntime();
  const hasSentGreetingRef = useRef<string | null>(null);
  const previousThreadIdRef = useRef<string | null | undefined>(null);

  // Simple check: if threadId exists, a thread is selected
  const threadId = thread.threadId;
  const hasSelectedThread = !!threadId;

  // Always render ThreadPrimitive.Root so ThreadListPrimitive.New can create threads
  // But conditionally render the thread content based on hasSelectedThread
  return (
    <UserIdContext.Provider value={userId}>
      <ThreadPrimitive.Root
        className="bg-[#f8fafc] dark:bg-zinc-900 box-border flex flex-col overflow-hidden relative h-[calc(100dvh-4rem)] pb-4 md:h-full"
        style={{
          ["--thread-max-width" as string]: "42rem",
        }}
      >
        {/* Mobile sidebar overlay */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black/40 z-30 md:hidden"
            onClick={() => setSidebarOpen(false)}
          ></div>
        )}

        {/* Mobile sidebar drawer */}
        <div
          className={cn(
            "fixed inset-y-0 left-0 z-40 w-[75%] bg-white shadow-lg rounded-r-lg dark:bg-zinc-900 transform transition-transform duration-300 ease-in-out md:hidden",
            sidebarOpen ? "translate-x-0" : "-translate-x-full"
          )}
        >
          <div className="h-full flex flex-col">
            <div className="flex items-center justify-between border-b dark:text-white border-[#e2e8f0] dark:border-zinc-800 p-4">
              <h2 className="font-medium">Settings</h2>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSidebarOpen(false)}
                  className="text-[#475569] dark:text-zinc-300 hover:bg-[#eef2ff] dark:hover:bg-zinc-800 h-8 w-8 p-0"
                >
                  ✕
                </Button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-3">
              <div className="flex flex-col justify-between items-stretch gap-1.5 h-full dark:text-white">
                <ThreadListPrimitive.Root className="flex flex-col items-stretch gap-1.5 h-full dark:text-white">
                  <ThreadListPrimitive.New asChild>
                    <div className="flex items-center flex-col gap-2 w-full">
                      <Button
                        className="hover:bg-zinc-600 w-full dark:hover:bg-zinc-800 dark:data-[active]:bg-zinc-800 flex items-center justify-start gap-1 rounded-lg px-2.5 py-2 text-start bg-[#4f46e5] text-white dark:bg-[#6366f1]"
                        variant="default"
                      >
                        <PlusIcon className="w-4 h-4" />
                        {getNewThreadText(userId)}
                      </Button>
                      <Button
                        className="hover:bg-zinc-600 w-full dark:hover:bg-zinc-700 dark:data-[active]:bg-zinc-800 flex items-center justify-start gap-1 rounded-lg px-2.5 py-2 text-start bg-zinc-800 text-white"
                        onClick={toggleDarkMode}
                        aria-label="Toggle theme"
                      >
                        {isDarkMode ? (
                          <div className="flex items-center gap-2">
                            <Sun className="w-6 h-6" />
                            <span>Toggle Light Mode</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <Moon className="w-6 h-6" />
                            <span>Toggle Dark Mode</span>
                          </div>
                        )}
                      </Button>
                      <GithubButton
                        url="https://github.com/mem0ai/mem0/tree/main/examples"
                        className="w-full rounded-lg h-9 pl-2 text-sm font-semibold bg-zinc-800 dark:border-zinc-800 dark:text-white text-white hover:bg-zinc-900"
                        text="View on Github"
                      />

                      <Link
                        href={"https://app.mem0.ai/"}
                        target="_blank"
                        className="py-2 px-4 w-full rounded-lg h-9 pl-3 text-sm font-semibold dark:bg-zinc-800 dark:hover:bg-zinc-700 bg-zinc-800 text-white hover:bg-zinc-900 dark:text-white"
                      >
                        <span className="flex items-center gap-2">
                          <SaveIcon className="w-4 h-4" />
                          Save Memories
                        </span>
                      </Link>
                    </div>
                  </ThreadListPrimitive.New>
                  <div className="mt-4 mb-2">
                    <h2 className="text-sm font-medium text-[#475569] dark:text-zinc-300 px-2.5">
                      Recent Events
                    </h2>
                  </div>
                  <ThreadListPrimitive.Items components={{ ThreadListItem }} />
                </ThreadListPrimitive.Root>
              </div>
            </div>
          </div>
        </div>

        {hasSelectedThread ? (
          <>
            <ScrollArea className="flex-1 w-full">
              <div className="flex h-full flex-col w-full items-center px-4 pt-8 justify-end">
                <ThreadPrimitive.Messages
                  components={{
                    UserMessage: UserMessage,
                    EditComposer: EditComposer,
                    AssistantMessage: AssistantMessage,
                  }}
                />

                <ThreadPrimitive.If empty={true}>
                  <GreetingLoadingSpinner />
                </ThreadPrimitive.If>

                <ThreadPrimitive.If empty={false}>
                  <div className="min-h-8 flex-grow" />
                </ThreadPrimitive.If>
              </div>
            </ScrollArea>

            <div
              className="sticky bottom-0 flex w-full max-w-[var(--thread-max-width)] flex-col items-center justify-end rounded-t-lg px-4 md:pb-4 mx-auto"
              style={{ zIndex: 1000 }}
            >
              <ThreadScrollToBottom />
              <div className="flex w-full items-center gap-2">
                <Composer
                  composerInputRef={
                    composerInputRef as React.RefObject<HTMLTextAreaElement>
                  }
                  isRecording={isRecording}
                />
                <VoiceRecorderButton
                  isRecording={isRecording}
                  setIsRecording={setIsRecording}
                  composerInputRef={
                    composerInputRef as React.RefObject<HTMLTextAreaElement>
                  }
                />
              </div>
            </div>
          </>
        ) : (
          <ScrollArea className="flex-1 w-full">
            <div className="flex h-full flex-col w-full items-center px-4 pt-8 justify-end">
              <div className="flex w-full flex-grow flex-col mt-8 md:h-[calc(100vh-15rem)]">
                <div className="flex w-full flex-grow flex-col items-center justify-start">
                  <div className="flex flex-col items-center justify-center h-full">
                    <div className="text-[2rem] leading-[1] tracking-[-0.02em] md:text-4xl font-bold text-[#1e293b] dark:text-white mb-2 text-center md:w-full w-5/6">
                      Trigger an event
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </ScrollArea>
        )}
      </ThreadPrimitive.Root>
    </UserIdContext.Provider>
  );
};

const GreetingLoadingSpinner: FC = () => {
  const { isLoading } = React.useContext(GreetingLoadingContext);

  if (!isLoading) {
    return null;
  }

  return (
    <div className="flex w-full flex-grow flex-col mt-8 md:h-[calc(100vh-15rem)]">
      <div className="flex w-full flex-grow flex-col items-center justify-start">
        <div className="flex flex-col items-center justify-center h-full">
          <RefreshCwIcon className="w-8 h-8 animate-spin text-[#4f46e5] dark:text-[#6366f1] mb-4" />
          <div className="text-lg text-[#475569] dark:text-zinc-300">
            Generating the first message...
          </div>
        </div>
      </div>
    </div>
  );
};

const ThreadScrollToBottom: FC = () => {
  return (
    <ThreadPrimitive.ScrollToBottom asChild>
      <TooltipIconButton
        tooltip="Scroll to bottom"
        variant="outline"
        className="absolute -top-8 rounded-full disabled:invisible bg-white dark:bg-zinc-800 border-[#e2e8f0] dark:border-zinc-700 hover:bg-[#eef2ff] dark:hover:bg-zinc-700"
      >
        <ArrowDownIcon className="text-[#475569] dark:text-zinc-300" />
      </TooltipIconButton>
    </ThreadPrimitive.ScrollToBottom>
  );
};

interface ComposerProps {
  composerInputRef: React.RefObject<HTMLTextAreaElement>;
  isRecording: boolean;
}

const Composer: FC<ComposerProps> = ({ composerInputRef, isRecording }) => {
  return (
    <ComposerPrimitive.Root
      className={`focus-within:border-[#4f46e5]/20 dark:focus-within:border-[#6366f1]/20 flex w-full flex-wrap items-end rounded-full border border-[#e2e8f0] dark:border-zinc-700 bg-white dark:bg-zinc-800 px-2.5 shadow-sm transition-colors ease-in ${
        isRecording ? "opacity-60 cursor-not-allowed" : ""
      }`}
    >
      <ComposerPrimitive.Input
        rows={1}
        autoFocus
        placeholder={isRecording ? "Listening..." : "Message to Grok..."}
        disabled={isRecording}
        className="placeholder:text-zinc-400 dark:placeholder:text-zinc-500 max-h-40 flex-grow resize-none border-none bg-transparent px-2 py-4 text-sm outline-none focus:ring-0 disabled:cursor-not-allowed disabled:opacity-70 text-[#1e293b] dark:text-zinc-200"
        ref={composerInputRef}
      />
      <ComposerAction />
    </ComposerPrimitive.Root>
  );
};

interface VoiceRecorderButtonProps {
  isRecording: boolean;
  setIsRecording: (recording: boolean) => void;
  composerInputRef: React.RefObject<HTMLTextAreaElement>;
}

const VoiceRecorderButton: FC<VoiceRecorderButtonProps> = ({
  isRecording,
  setIsRecording,
  composerInputRef,
}) => {
  const runtime = useAssistantRuntime();
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      audioChunksRef.current = [];

      // Try to use webm, fallback to default
      let options: MediaRecorderOptions = {};
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
        console.log("Recording stopped, processing audio...");
        // Stop all tracks
        stream.getTracks().forEach((track) => track.stop());

        // Create audio blob
        const audioBlob = new Blob(audioChunksRef.current, {
          type: mediaRecorder.mimeType || "audio/webm",
        });
        console.log("Audio blob created:", {
          size: audioBlob.size,
          type: audioBlob.type,
        });

        // Send to STT API
        try {
          console.log("Sending audio to STT API...");
          const formData = new FormData();
          // Use .wav extension even if it's webm - some APIs accept it
          // The actual mime type is set in the blob
          formData.append("file", audioBlob, "recording.wav");

          const response = await fetch("/api/stt", {
            method: "POST",
            body: formData,
          });

          if (!response.ok) {
            const errorData = await response
              .json()
              .catch(() => ({ error: "Unknown error" }));
            console.error("STT API error:", response.status, errorData);
            throw new Error(
              errorData.error || `STT API error: ${response.status}`
            );
          }

          const result = await response.json();
          const transcribedText = (result.text || "").trim();
          console.log(
            "STT result received:",
            transcribedText,
            "Length:",
            transcribedText.length
          );

          // Send transcribed text directly using runtime - NO INPUT MANIPULATION
          if (transcribedText && transcribedText.length > 0 && runtime) {
            console.log(
              "Submitting transcribed text directly to chat (no input):",
              transcribedText
            );

            runtime.thread.append({
              role: "user",
              content: [{ type: "text", text: transcribedText }],
            });
            console.log("Message sent successfully");
          } else {
            console.warn("No transcribed text or runtime unavailable", {
              transcribedText,
              hasRuntime: !!runtime,
              textLength: transcribedText?.length || 0,
            });
          }
        } catch (error) {
          console.error("Error transcribing audio:", error);
          const errorMessage =
            error instanceof Error ? error.message : "Unknown error";
          alert(
            `Failed to transcribe audio: ${errorMessage}. Please try again.`
          );
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (error) {
      console.error("Error starting recording:", error);
      alert("Failed to access microphone. Please check permissions.");
    }
  }, [runtime, setIsRecording, composerInputRef]);

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
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  }, [isRecording, startRecording, stopRecording]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  return (
    <ThreadPrimitive.If running={false}>
      <TooltipIconButton
        tooltip={isRecording ? "Stop recording" : "Start recording"}
        variant="default"
        onClick={toggleRecording}
        className={`size-10 p-2 transition-opacity ease-in rounded-full ${
          isRecording
            ? "bg-red-500 hover:bg-red-600 text-white animate-pulse"
            : "bg-[#4f46e5] dark:bg-[#6366f1] hover:bg-[#4338ca] dark:hover:bg-[#4f46e5] text-white"
        }`}
      >
        {isRecording ? (
          <SquareIcon className="w-5 h-5" />
        ) : (
          <MicIcon className="w-5 h-5" />
        )}
      </TooltipIconButton>
    </ThreadPrimitive.If>
  );
};

const ComposerAction: FC = () => {
  return (
    <>
      <ThreadPrimitive.If running={false}>
        <ComposerPrimitive.Send asChild>
          <TooltipIconButton
            tooltip="Send"
            variant="default"
            className="my-2.5 size-8 p-2 transition-opacity ease-in bg-[#4f46e5] dark:bg-[#6366f1] hover:bg-[#4338ca] dark:hover:bg-[#4f46e5] text-white rounded-full"
          >
            <SendHorizontalIcon />
          </TooltipIconButton>
        </ComposerPrimitive.Send>
      </ThreadPrimitive.If>
      <ThreadPrimitive.If running>
        <ComposerPrimitive.Cancel asChild>
          <TooltipIconButton
            tooltip="Cancel"
            variant="default"
            className="my-2.5 size-8 p-2 transition-opacity ease-in bg-[#4f46e5] dark:bg-[#6366f1] hover:bg-[#4338ca] dark:hover:bg-[#4f46e5] text-white rounded-full"
          >
            <CircleStopIcon />
          </TooltipIconButton>
        </ComposerPrimitive.Cancel>
      </ThreadPrimitive.If>
    </>
  );
};

const UserMessage: FC = () => {
  return (
    <MessagePrimitive.Root className="grid auto-rows-auto grid-cols-[minmax(72px,1fr)_auto] gap-y-2 [&:where(>*)]:col-start-2 w-full max-w-[var(--thread-max-width)] py-4">
      <UserActionBar />

      <div className="bg-[#4f46e5] text-sm dark:bg-[#6366f1] text-white max-w-[calc(var(--thread-max-width)*0.8)] break-words rounded-3xl px-5 py-2.5 col-start-2 row-start-2">
        <MessagePrimitive.Content />
      </div>

      <BranchPicker className="col-span-full col-start-1 row-start-3 -mr-1 justify-end" />
    </MessagePrimitive.Root>
  );
};

const UserActionBar: FC = () => {
  return (
    <ActionBarPrimitive.Root
      hideWhenRunning
      autohide="not-last"
      className="flex flex-col items-end col-start-1 row-start-2 mr-3 mt-2.5"
    >
      <ActionBarPrimitive.Edit asChild>
        <TooltipIconButton
          tooltip="Edit"
          className="text-[#475569] dark:text-zinc-300 hover:text-[#4f46e5] dark:hover:text-[#6366f1] hover:bg-[#eef2ff] dark:hover:bg-zinc-800"
        >
          <PencilIcon />
        </TooltipIconButton>
      </ActionBarPrimitive.Edit>
    </ActionBarPrimitive.Root>
  );
};

const EditComposer: FC = () => {
  return (
    <ComposerPrimitive.Root className="bg-[#eef2ff] dark:bg-zinc-800 my-4 flex w-full max-w-[var(--thread-max-width)] flex-col gap-2 rounded-xl">
      <ComposerPrimitive.Input className="text-[#1e293b] dark:text-zinc-200 flex h-8 w-full resize-none bg-transparent p-4 pb-0 outline-none" />

      <div className="mx-3 mb-3 flex items-center justify-center gap-2 self-end">
        <ComposerPrimitive.Cancel asChild>
          <Button
            variant="ghost"
            className="text-[#475569] dark:text-zinc-300 hover:bg-[#eef2ff]/50 dark:hover:bg-zinc-700/50"
          >
            Cancel
          </Button>
        </ComposerPrimitive.Cancel>
        <ComposerPrimitive.Send asChild>
          <Button className="bg-[#4f46e5] dark:bg-[#6366f1] hover:bg-[#4338ca] dark:hover:bg-[#4f46e5] text-white rounded-[2rem]">
            Send
          </Button>
        </ComposerPrimitive.Send>
      </div>
    </ComposerPrimitive.Root>
  );
};

const AssistantMessage: FC = () => {
  const content = useMessage((m) => m.content);
  const messageId = useMessage((m) => m.id);
  const messageStatus = useMessage((m) => m.status);
  const markdownText = React.useMemo(() => {
    if (!content) return "";
    if (typeof content === "string")
      return (content as string).replace("[GREETING]", "");
    if (Array.isArray(content) && content.length > 0 && "text" in content[0]) {
      return content[0].text.replace("[GREETING]", "") || "";
    }
    return "";
  }, [content]);
  const isGreeting = React.useMemo(() => {
    if (!content) return false;
    if (typeof content === "string")
      return (content as string).startsWith("[GREETING]");
    if (Array.isArray(content) && content.length > 0 && "text" in content[0]) {
      return content[0].text.startsWith("[GREETING]");
    }
    return false;
  }, [content]);

  const isInitialMountRef = useRef<boolean>(true);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const hasPlayedForThisMessageRef = useRef<string>("");
  const previousStatusRef = useRef<typeof messageStatus>(undefined);

  // Play TTS when streaming ends (detected via status change)
  useEffect(() => {
    // On initial mount, mark existing content so we don't play for old messages
    if (isInitialMountRef.current) {
      isInitialMountRef.current = false;
      previousStatusRef.current = messageStatus;
      if (markdownText && markdownText.length > 0) {
        hasPlayedForThisMessageRef.current = messageId;
      }
      return;
    }

    // Check if this is a new message
    const isNewMessage = hasPlayedForThisMessageRef.current !== messageId;
    const hasContent = markdownText && markdownText.length > 0;

    // Check if streaming just ended (status changed from running to complete)
    const wasStreaming = previousStatusRef.current?.type === "running";
    const isNowComplete = messageStatus?.type === "complete";

    console.log("Message status check:", {
      previousStatus: previousStatusRef.current,
      currentStatus: messageStatus,
      wasStreaming,
      isNowComplete,
      isNewMessage,
      hasContent,
    });

    // If streaming just ended and it's a new message with content, play TTS
    if (
      (wasStreaming && isNowComplete && isNewMessage && hasContent) ||
      isGreeting
    ) {
      console.log("Streaming ended, starting TTS");

      // Clean text for TTS (remove markdown, HTML, etc.)
      const cleanText = markdownText
        .replace(/<highlight>(.*?)<\/highlight>/g, "$1") // Remove highlight tags but keep the text
        .replace(/<[^>]*>/g, "") // Remove any remaining HTML tags
        .replace(/```[\s\S]*?```/g, "") // Remove code blocks
        .replace(/`[^`]*`/g, "") // Remove inline code
        .replace(/\*\*([^*]+)\*\*/g, "$1") // Remove bold markdown, keep text
        .replace(/\*([^*]+)\*/g, "$1") // Remove italic markdown, keep text
        .replace(/#+\s/g, "") // Remove heading markdown
        .trim();

      if (cleanText.length > 0) {
        // Mark that we've played for this message
        hasPlayedForThisMessageRef.current = messageId;
        console.log("Requesting TTS for message:", messageId);
        // Call TTS API and play audio
        fetch("/api/tts", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            text: cleanText,
            voice: "Ara",
            responseFormat: "mp3",
          }),
        })
          .then((response) => {
            if (!response.ok) {
              throw new Error(`TTS API error: ${response.status}`);
            }
            return response.blob();
          })
          .then((blob) => {
            // Stop any currently playing audio for this message
            if (audioRef.current) {
              audioRef.current.pause();
              audioRef.current = null;
            }

            // Create audio element and play
            const audioUrl = URL.createObjectURL(blob);
            const audio = new Audio(audioUrl);
            audioRef.current = audio;

            audio.play().catch((error) => {
              console.error("Error playing audio:", error);
            });

            // Clean up URL when audio finishes
            audio.addEventListener("ended", () => {
              URL.revokeObjectURL(audioUrl);
              audioRef.current = null;
            });
          })
          .catch((error) => {
            console.error("Error fetching TTS:", error);
          });
      }
    }

    // Update previous status
    previousStatusRef.current = messageStatus;

    // Cleanup: stop audio if component unmounts
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, [markdownText, messageId, messageStatus, isGreeting]);

  return (
    <MessagePrimitive.Root className="grid grid-cols-[auto_auto_1fr] grid-rows-[auto_1fr] relative w-full max-w-[var(--thread-max-width)] py-4">
      <div className="text-[#1e293b] dark:text-zinc-200 max-w-[calc(var(--thread-max-width)*0.8)] break-words leading-7 col-span-2 col-start-2 row-start-1 my-1.5 bg-white dark:bg-zinc-800 rounded-3xl px-5 py-2.5 border border-[#e2e8f0] dark:border-zinc-700 shadow-sm">
        <MemoryUI />
        <MarkdownRenderer
          markdownText={markdownText}
          showCopyButton={true}
          isDarkMode={document.documentElement.classList.contains("dark")}
        />
      </div>

      <AssistantActionBar />

      <BranchPicker className="col-start-2 row-start-2 -ml-2 mr-2" />
    </MessagePrimitive.Root>
  );
};

const AssistantActionBar: FC = () => {
  return (
    <ActionBarPrimitive.Root
      hideWhenRunning
      autohideFloat="single-branch"
      className="text-[#475569] dark:text-zinc-300 flex gap-1 col-start-3 row-start-2 ml-1 data-[floating]:bg-white data-[floating]:dark:bg-zinc-800 data-[floating]:absolute data-[floating]:rounded-md data-[floating]:border data-[floating]:border-[#e2e8f0] data-[floating]:dark:border-zinc-700 data-[floating]:p-1 data-[floating]:shadow-sm"
    >
      <ActionBarPrimitive.Copy asChild>
        <TooltipIconButton
          tooltip="Copy"
          className="hover:text-[#4f46e5] dark:hover:text-[#6366f1] hover:bg-[#eef2ff] dark:hover:bg-zinc-700"
        >
          <MessagePrimitive.If copied>
            <CheckIcon />
          </MessagePrimitive.If>
          <MessagePrimitive.If copied={false}>
            <CopyIcon />
          </MessagePrimitive.If>
        </TooltipIconButton>
      </ActionBarPrimitive.Copy>
      <ActionBarPrimitive.Reload asChild>
        <TooltipIconButton
          tooltip="Refresh"
          className="hover:text-[#4f46e5] dark:hover:text-[#6366f1] hover:bg-[#eef2ff] dark:hover:bg-zinc-700"
        >
          <RefreshCwIcon />
        </TooltipIconButton>
      </ActionBarPrimitive.Reload>
    </ActionBarPrimitive.Root>
  );
};

const BranchPicker: FC<BranchPickerPrimitive.Root.Props> = ({
  className,
  ...rest
}) => {
  return (
    <BranchPickerPrimitive.Root
      hideWhenSingleBranch
      className={cn(
        "text-[#475569] dark:text-zinc-300 inline-flex items-center text-xs",
        className
      )}
      {...rest}
    >
      <BranchPickerPrimitive.Previous asChild>
        <TooltipIconButton
          tooltip="Previous"
          className="hover:text-[#4f46e5] dark:hover:text-[#6366f1] hover:bg-[#eef2ff] dark:hover:bg-zinc-700"
        >
          <ChevronLeftIcon />
        </TooltipIconButton>
      </BranchPickerPrimitive.Previous>
      <span className="font-medium">
        <BranchPickerPrimitive.Number /> / <BranchPickerPrimitive.Count />
      </span>
      <BranchPickerPrimitive.Next asChild>
        <TooltipIconButton
          tooltip="Next"
          className="hover:text-[#4f46e5] dark:hover:text-[#6366f1] hover:bg-[#eef2ff] dark:hover:bg-zinc-700"
        >
          <ChevronRightIcon />
        </TooltipIconButton>
      </BranchPickerPrimitive.Next>
    </BranchPickerPrimitive.Root>
  );
};

const CircleStopIcon = () => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 16 16"
      fill="currentColor"
      width="16"
      height="16"
    >
      <rect width="10" height="10" x="3" y="3" rx="2" />
    </svg>
  );
};

// Get timestamp in yyyy-MM-dd hh:mm A format with userId prefix
const getTimestamp = (userId?: string) => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  let hours = now.getHours();
  const minutes = String(now.getMinutes()).padStart(2, "0");
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12;
  hours = hours ? hours : 12; // the hour '0' should be '12'
  const hoursStr = String(hours).padStart(2, "0");
  const timestamp = `${year}-${month}-${day} ${hoursStr}:${minutes} ${ampm}`;
  // Add userId prefix if provided
  return userId ? `[${userId}] ${timestamp}` : timestamp;
};

// Component for reuse in mobile drawer
const ThreadListItem: FC = () => {
  // Archive effectively deletes the thread (removes it from the list)
  // Since threads are stored in localStorage, archiving removes them
  return (
    <ThreadListItemPrimitive.Root className="data-[active]:bg-[#eef2ff] hover:bg-[#eef2ff] dark:hover:bg-zinc-800 dark:data-[active]:bg-zinc-800 focus-visible:bg-[#eef2ff] dark:focus-visible:bg-zinc-800 focus-visible:ring-[#4f46e5] flex items-center gap-2 rounded-lg transition-all focus-visible:outline-none focus-visible:ring-2">
      <ThreadListItemPrimitive.Trigger className="flex-grow px-3 py-2 text-start">
        <p className="text-sm">
          <ThreadListItemPrimitive.Title />
        </p>
      </ThreadListItemPrimitive.Trigger>
      <ThreadListItemPrimitive.Archive asChild>
        <TooltipIconButton
          className="hover:text-[#4f46e5] text-[#475569] dark:text-zinc-300 dark:hover:text-[#6366f1] ml-auto mr-3 size-4 p-0"
          variant="ghost"
          tooltip="Delete thread"
        >
          <TrashIcon className="w-4 h-4" />
        </TooltipIconButton>
      </ThreadListItemPrimitive.Archive>
    </ThreadListItemPrimitive.Root>
  );
};
