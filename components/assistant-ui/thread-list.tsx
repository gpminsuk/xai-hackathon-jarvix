import type { FC } from "react";
import React from "react";
import {
  ThreadListItemPrimitive,
  ThreadListPrimitive,
  useAssistantRuntime,
} from "@assistant-ui/react";
import { PlusIcon, TrashIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { TooltipIconButton } from "@/components/assistant-ui/tooltip-icon-button";
import { getNewThreadText, getTriggerForUser, getSystemPromptForUser, getGreetingContextForUser, getMem0UserId } from "./utils";
import { GreetingLoadingContext } from "./greeting-context";
import { readChatStream } from "./streaming";

interface ThreadListProps {
  isDarkMode: boolean;
  userId?: string;
}

export const ThreadList: FC<ThreadListProps> = ({ userId }) => {
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
  const { isLoading, setIsLoading } = React.useContext(GreetingLoadingContext);

  // Generate greeting with proper trigger and system prompt
  const generateGreeting = async () => {
    if (isLoading) return; // Prevent double-clicks
    setIsLoading(true);
    try {
      const displayName = userId || "Mark (Starbucks)";
      const trigger = getTriggerForUser(displayName);
      const systemPrompt = getSystemPromptForUser(displayName);
      const greetingContext = getGreetingContextForUser(displayName);
      const mem0UserId = getMem0UserId();

      console.log(`[Greeting] Generating for ${displayName}, mem0 user: ${mem0UserId}`);

      // Make direct API call to generate greeting
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: [
            {
              role: "user",
              content: greetingContext, // Use scenario-specific context
            },
          ],
          userId: mem0UserId, // Use demo_user for all mem0 queries
          trigger: trigger,
          system: systemPrompt,
          tools: {},
        }),
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const fullResponse = await readChatStream(response);

      // Add the greeting as an assistant message
      if (fullResponse.trim()) {
        runtime.thread.append({
          role: "assistant",
          content: [{ type: "text", text: `[GREETING]${fullResponse.trim()}` }],
        });
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
        className={`hover:bg-[#8ea4e8] dark:hover:bg-zinc-800 dark:data-[active]:bg-zinc-800 flex items-center justify-start gap-1 rounded-lg px-2.5 py-2 text-start bg-[#4f46e5] text-white dark:bg-[#6366f1] ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
        disabled={isLoading}
        onClick={() => {
          if (isLoading) return;
          setTimeout(() => {
            generateGreeting();
          }, 0);
        }}
      >
        {isLoading ? (
          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
        ) : (
          <PlusIcon className="w-4 h-4" />
        )}
        {isLoading ? "Loading..." : getNewThreadText(userId)}
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
