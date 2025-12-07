"use client";

import { AssistantRuntimeProvider, useLocalRuntime } from "@assistant-ui/react";
import { useChatRuntime } from "@assistant-ui/react-ai-sdk";
import { Thread } from "@/components/assistant-ui/thread";
import { ThreadList } from "@/components/assistant-ui/thread-list";
import { useEffect, useState, useRef } from "react";
import { v4 as uuidv4 } from "uuid";
import { AlignJustify } from "lucide-react";
import { Button } from "@/components/ui/button";
import ThemeAwareLogo from "@/components/mem0/theme-aware-logo";
import Link from "next/link";
import GithubButton from "@/components/mem0/github-button";
import { useLocalStorage } from "usehooks-ts";
import { GreetingLoadingContext } from "@/components/assistant-ui/greeting-context";
import {
  fixedUserIds,
  getNewThreadText,
} from "@/components/assistant-ui/utils";

export { getNewThreadText };

export const Assistant = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [dashboardOpen, setDashboardOpen] = useState(false);

  const [selectedUserId, setSelectedUserId, _] = useLocalStorage<string>(
    "selectedUserId",
    fixedUserIds[0][0]
  );

  // Set dark mode as default
  useEffect(() => {
    document.documentElement.classList.add("dark");
  }, []);

  // Handle userId change from dropdown (only when user explicitly changes it)
  const handleUserIdChange = (newUserId: string) => {
    if (
      newUserId !== selectedUserId &&
      fixedUserIds.some((id) => id.includes(newUserId))
    ) {
      console.log(`Switching from ${selectedUserId} to ${newUserId}`);
      setSelectedUserId(newUserId);
    }
  };

  // Use a single runtime - threads are shared, but mem0 queries use selectedUserId
  const runtime = useChatRuntime({
    api: "/api/chat",
    body: {
      userId: selectedUserId,
      system: fixedUserIds.find((id) => id[0] == selectedUserId)?.[2] || "",
    },
  });

  // Manage greeting loading state at the Assistant level so both ThreadList and Thread can access it
  const [isGreetingLoading, setIsGreetingLoading] = useState(false);

  return (
    <GreetingLoadingContext.Provider
      value={{
        isLoading: isGreetingLoading,
        setIsLoading: setIsGreetingLoading,
      }}
    >
      <AssistantRuntimeProvider runtime={runtime}>
        <div className="bg-[#f8fafc] dark:bg-zinc-900 text-[#1e293b] dark">
          <header className="h-16 border-b border-[#e2e8f0] flex items-center justify-between px-4 sm:px-6 bg-white dark:bg-zinc-900 dark:border-zinc-800 dark:text-white">
            <div className="flex items-center">
              <Link href="/" className="flex items-center">
                <ThemeAwareLogo width={120} height={40} isDarkMode={true} />
              </Link>
            </div>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSidebarOpen(true)}
              className="text-[#475569] dark:text-zinc-300 md:hidden"
            >
              <AlignJustify size={24} className="md:hidden" />
            </Button>

            <div className="md:flex items-center gap-2 hidden">
              <select
                value={selectedUserId || fixedUserIds[0]}
                onChange={(e) => handleUserIdChange(e.target.value)}
                className="w-[240px] h-9 px-3 rounded-lg bg-white dark:bg-zinc-800 border border-[#e2e8f0] dark:border-zinc-700 text-[#475569] dark:text-zinc-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#4f46e5] dark:focus:ring-[#6366f1]"
              >
                {fixedUserIds.map((id) => (
                  <option key={id[0]} value={id[0]}>
                    {id[0]}
                  </option>
                ))}
              </select>
              {/* <button
                className="px-4 py-2 rounded-full hover:bg-[#eef2ff] dark:hover:bg-zinc-800 text-[#475569] dark:text-zinc-300 text-sm font-medium"
                onClick={() => setDashboardOpen(!dashboardOpen)}
                aria-label="Toggle dashboard"
              >
                Dashboard
              </button> */}
            </div>
          </header>
          <div className="grid grid-cols-1 md:grid-cols-[260px_1fr] gap-x-0 h-[calc(100dvh-4rem)] relative">
            <ThreadList isDarkMode={true} userId={selectedUserId} />
            <Thread
              sidebarOpen={sidebarOpen}
              setSidebarOpen={setSidebarOpen}
              isDarkMode={true}
              toggleDarkMode={() => {}}
              userId={selectedUserId}
            />
            {dashboardOpen && (
              <div
                className="fixed z-50 bg-black/90 flex items-center justify-center"
                style={{
                  top: "4rem",
                  bottom: 0,
                  left: 0,
                  right: 0,
                }}
              >
                <div className="relative w-full h-full flex items-center justify-center p-4">
                  <button
                    className="absolute top-4 right-4 text-white hover:text-gray-300 z-10 bg-black/50 rounded-full p-2 transition-colors"
                    onClick={() => setDashboardOpen(false)}
                    aria-label="Close dashboard"
                  >
                    <svg
                      className="w-6 h-6"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                  <img
                    src="/dashboard.webp"
                    alt="Dashboard"
                    className="max-w-full max-h-full object-contain"
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </AssistantRuntimeProvider>
    </GreetingLoadingContext.Provider>
  );
};
