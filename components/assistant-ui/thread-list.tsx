import type { FC } from "react";
import React from "react";
import {
  ThreadListItemPrimitive,
  ThreadListPrimitive,
  useAssistantRuntime,
} from "@assistant-ui/react";
import { ArchiveIcon, PlusIcon, RefreshCwIcon, TrashIcon } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { TooltipIconButton } from "@/components/assistant-ui/tooltip-icon-button";
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
import { getNewThreadText, fixedUserIds } from "./utils";
import { GreetingLoadingContext } from "./greeting-context";
// import ThemeAwareLogo from "@/components/assistant-ui/theme-aware-logo";
// import Link from "next/link";
interface ThreadListProps {
  isDarkMode: boolean;
  userId?: string;
}

export const ThreadList: FC<ThreadListProps> = ({ userId }) => {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex-col h-full border-r border-[#e2e8f0] bg-white dark:bg-zinc-900 dark:border-zinc-800 p-3 overflow-y-auto hidden md:flex">
      <ThreadListPrimitive.Root className="flex flex-col justify-between h-full items-stretch gap-1.5">
        <div className="flex flex-col h-full items-stretch gap-1.5">
          <ThreadListNew userId={userId} />
          <div className="mt-4 mb-2 flex justify-between items-center px-2.5">
            <h2 className="text-sm font-medium text-[#475569] dark:text-zinc-300">
              Recent Events
            </h2>
          </div>
          <ThreadListItems />
        </div>
      </ThreadListPrimitive.Root>
    </div>
  );
};

const ThreadListNew: FC<{ userId?: string }> = ({ userId }) => {
  const runtime = useAssistantRuntime();
  const { setIsLoading } = React.useContext(GreetingLoadingContext);

  // Make a separate API call to generate greeting (not as a user message)
  const generateGreeting = async () => {
    setIsLoading(true);
    try {
      // Use the userId prop passed from parent component
      const currentUserId = userId || "scenario1";

      // Make direct API call to generate greeting
      // Format messages correctly for mem0 and AI SDK (content can be string or array)
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: [
            {
              role: "user",
              content: "Generate a greeting message",
            },
          ],
          userId: currentUserId,
          system: fixedUserIds.find((id) => id[0] == currentUserId)?.[2] || "",
          tools: {},
        }),
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      // Parse the streaming response and add it as an assistant message
      // This is a separate inference call - the user message is not shown
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let fullResponse = "";

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split("\n").filter((line) => line.trim());

          for (const line of lines) {
            if (line.startsWith("0:")) {
              const data = JSON.parse(line.slice(2));
              fullResponse += data;
            }
          }
        }
      }

      // Add the greeting as an assistant message directly (no user message shown)
      // This is a separate inference, not part of the chat history
      if (fullResponse.trim()) {
        runtime.thread.append({
          role: "assistant",
          content: [{ type: "text", text: `[GREETING]${fullResponse.trim()}` }],
        });
        // TTS will automatically play when the message is added (handled by AssistantMessage component)
      }
    } catch (error) {
      console.error("Error generating greeting:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ThreadListPrimitive.New asChild>
      <Button
        className="hover:bg-[#8ea4e8] dark:hover:bg-zinc-800 dark:data-[active]:bg-zinc-800 flex items-center justify-start gap-1 rounded-lg px-2.5 py-2 text-start bg-[#4f46e5] text-white dark:bg-[#6366f1]"
        onClick={() => {
          setTimeout(() => {
            generateGreeting();
          }, 0);
        }}
      >
        <PlusIcon className="w-4 h-4" />
        {getNewThreadText(userId)}
      </Button>
    </ThreadListPrimitive.New>
  );
};

const ThreadListItems: FC = () => {
  return <ThreadListPrimitive.Items components={{ ThreadListItem }} />;
};

const ThreadListItem: FC = () => {
  return (
    <ThreadListItemPrimitive.Root className="data-[active]:bg-[#eef2ff] hover:bg-[#eef2ff] dark:hover:bg-zinc-800 dark:data-[active]:bg-zinc-800 dark:text-white focus-visible:bg-[#eef2ff] dark:focus-visible:bg-zinc-800 focus-visible:ring-[#4f46e5] flex items-center gap-2 rounded-lg transition-all focus-visible:outline-none focus-visible:ring-2">
      <ThreadListItemPrimitive.Trigger className="flex-grow px-3 py-2 text-start">
        <ThreadListItemTitle />
      </ThreadListItemPrimitive.Trigger>
      <ThreadListItemArchive />
    </ThreadListItemPrimitive.Root>
  );
};

const ThreadListItemTitle: FC = () => {
  return (
    <p className="text-sm">
      <ThreadListItemPrimitive.Title fallback={"New Session"} />
    </p>
  );
};

const ThreadListItemArchive: FC = () => {
  // Archive effectively deletes the thread (removes it from the list)
  // Since threads are stored in localStorage, archiving removes them
  return (
    <ThreadListItemPrimitive.Archive asChild>
      <TooltipIconButton
        className="hover:text-[#4f46e5] text-[#475569] dark:text-zinc-300 dark:hover:text-[#6366f1] ml-auto mr-3 size-4 p-0"
        variant="ghost"
        tooltip="Delete thread"
      >
        <TrashIcon className="w-4 h-4" />
      </TooltipIconButton>
    </ThreadListItemPrimitive.Archive>
  );
};
