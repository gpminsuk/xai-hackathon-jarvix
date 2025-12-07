"""
Core agent implementation with Grok AI and mem0.
"""

from __future__ import annotations

import json
import os
import random
from datetime import datetime, timezone
from typing import Any, Dict, Optional, List

from xai_sdk import Client
from xai_sdk.chat import system, user, tool_result
from xai_sdk.tools import web_search, get_tool_call_type

from jarvix.memory import MemoryManager
from .tools import MemoryTools, CalendarTools, get_memory_tool_definitions, get_calendar_tool_definitions


class ProactiveAgent:
    """
    Proactive AI agent with web search and persistent memory.
    
    Features:
    - Web search for real-time information (server-side via Grok)
    - Persistent memory via mem0 (client-side)
    - Natural conversation flow
    - Proactive assistance based on learned patterns
    """
    
    def __init__(
        self,
        user_id: str,
        xai_api_key: Optional[str] = None,
        mem0_api_key: Optional[str] = None,
        model: str = "grok-4-1-fast",
        system_prompt: Optional[str] = None
    ):
        """
        Initialize the proactive agent.
        
        Args:
            user_id: Unique user identifier
            xai_api_key: xAI API key (defaults to XAI_API_KEY env var)
            mem0_api_key: mem0 API key (defaults to MEM0_API_KEY env var)
            model: Grok model to use
            system_prompt: Custom system prompt (optional)
        """
        self.user_id = user_id
        self.model = model
        
        xai_api_key = xai_api_key or os.getenv("XAI_API_KEY")
        mem0_api_key = mem0_api_key or os.getenv("MEM0_API_KEY")
        
        # Use a generous but bounded timeout to avoid hanging calls.
        self.client = Client(api_key=xai_api_key, timeout=90)
        
        # Initialize memory
        memory_manager = MemoryManager(api_key=mem0_api_key)
        self.memory_tools = MemoryTools(user_id, memory_manager)
        self.calendar_tools = CalendarTools()
        
        # Tool routing for client-side tools
        self.client_tools_map = {
            "add_memory": self.memory_tools.add_memory,
            "search_memories": self.memory_tools.search_memories,
            "get_all_memories": self.memory_tools.get_all_memories,
            "create_calendar_event": self.calendar_tools.create_event,
        }
        self._tool_count = 1 + len(get_memory_tool_definitions()) + len(get_calendar_tool_definitions())
        
        # Create chat with tools
        self.chat = self.client.chat.create(
            model=model,
            tools=[
                web_search(),  # Server-side
                *get_memory_tool_definitions(),  # Client-side
                *get_calendar_tool_definitions(),
            ]
        )
        
        # Set system prompt
        if system_prompt is None:
            system_prompt = self._default_system_prompt()
        
        self.chat.append(system(system_prompt))
    
    # ------------------- time-aware helpers -------------------
    def _parse_iso(self, ts: Optional[str]) -> Optional[datetime]:
        if not ts:
            return None
        try:
            dt = datetime.fromisoformat(ts)
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            return dt.astimezone(timezone.utc)
        except Exception:
            return None

    def _upcoming_context(self, window_minutes: int = 60) -> Optional[str]:
        """Return a short context string if there is a memory within the next window."""
        try:
            memories = MemoryManager().get_memories(user_id=self.user_id)
        except Exception:
            return None

        now = datetime.now(timezone.utc)
        soon = now.timestamp() + window_minutes * 60

        upcoming: List[str] = []
        for mem in memories:
            meta = mem.get("metadata", {}) or {}
            ts = meta.get("timestamp") or meta.get("start_utc")
            dt = self._parse_iso(ts)
            if not dt:
                continue
            if now <= dt <= datetime.fromtimestamp(soon, tz=timezone.utc):
                # Build a short label from memory text and time
                label = mem.get("memory") or mem.get("text") or ""
                dt_str = dt.strftime("%H:%M UTC")
                if label:
                    upcoming.append(f"{dt_str} | {label[:80]}")
                else:
                    upcoming.append(f"{dt_str}")

        if not upcoming:
            return None

        # Keep it concise: include only the first item
        return f"Upcoming within {window_minutes}m: {upcoming[0]}"
    
    def _default_system_prompt(self) -> str:
        """
        Voice-first, concise Jarvix brand voice.
        """
        return (
            "You are Jarvix, Tesla's conversational co-pilot.\n"
            "\n"
            "VOICE RULES:\n"
            "- Max 2-3 short sentences per reply.\n"
            "- Lead with the action/answer, then one brief detail.\n"
            "- Use contractions naturally: I'll, you're, let's.\n"
            "- No bullets, no lists, no markdown.\n"
            "- Quick acknowledgments: Got it. On it. Done.\n"
            "\n"
            "STYLE:\n"
            "- Short, spoken sentences. No over-explaining.\n"
            "- Lead with the action, then one brief detail.\n"
            "- Avoid filler words. Avoid apologies unless truly necessary.\n"
            "- Never expose internal tool wiring. Do not mention mem0 or tool calls.\n"
            "- End with one concise clarifying question only if it clearly moves the trip forward (e.g., “Order your usual latte for pickup?”).\n"
            "\n"
            "MEMORY:\n"
            "- Always search memories first to personalize.\n"
            "- Store new preferences silently—never mention storing.\n"
            "- If user says 'my usual' or 'like always', recall it confidently.\n"
            "\n"
            "PROACTIVE:\n"
            "- Offer A/B choices, not open-ended: 'Starbucks on the way, or straight to work?'\n"
            "- If something relevant is imminent, mention it briefly.\n"
            "\n"
            "NEVER:\n"
            "- Apologize for limitations.\n"
            "- Mention tools, memories, or internal steps.\n"
            "- Exceed ~30 words unless the user asked for detail."
        )
    
    def _get_time_context(self) -> Optional[str]:
        """Build minimal time-aware context for the model."""
        now = datetime.now()
        day = now.strftime("%A")
        hour = now.hour
        if 5 <= hour < 12:
            period = "morning"
        elif 12 <= hour < 17:
            period = "afternoon"
        elif 17 <= hour < 21:
            period = "evening"
        else:
            period = "night"

        parts: List[str] = [f"Today is {day} {period} ({now.strftime('%H:%M')})"]
        upcoming = self._upcoming_context(window_minutes=60)
        if upcoming:
            parts.append(upcoming)

        return " | ".join(parts) if parts else None

    def _enforce_brevity(self, response: str, max_words: int = 35) -> str:
        """Trim overly long responses for voice delivery."""
        words = response.split()
        if len(words) <= max_words:
            return response

        # Keep first sentence if it fits
        first_period = response.find(". ")
        if 0 < first_period < len(response) * 0.7:
            first_sentence = response[: first_period + 1]
            if len(first_sentence.split()) <= max_words:
                return first_sentence

        truncated = " ".join(words[:max_words]).rstrip(",.;:") + "."
        return truncated

    def _fallback_message(self) -> str:
        """Return a varied, context-free fallback."""
        options = [
            "Connection's spotty. What were you saying?",
            "Didn't catch that. Try again?",
            "Still here—network hiccup. Go ahead.",
        ]
        return random.choice(options)

    def chat_message(self, message: Optional[str], trigger: str, verbose: bool = True) -> str:
        """
        Send a message and get response.
        
        Args:
            message: User's message
            trigger: Hint about the trigger context (e.g., 'destination_set', 'call_ended',
                     'fsd_on', 'conversation_gap', 'passenger_exit') to steer proactive behavior.
            verbose: Print tool calls and thinking
            
        Returns:
            Agent's response text
        """
        if verbose:
            print(f"\nUser: {message}")
            print(f"Agent: ", end="", flush=True)
        
        # Add trigger and time-aware context if available
        message = message or ""
        message = f"(Trigger: {trigger}) {message}"
        time_ctx = self._get_time_context()
        if time_ctx:
            self.chat.append(system(f"[Context] {time_ctx}"))

        # Add user message
        self.chat.append(user(message))
        
        if verbose:
            print(f"[dbg] model={self.model} | sending message | tools={self._tool_count}")

        max_rounds = 4  # allow deeper chaining of client tool calls
        streamed_content: str = ""
        try:
            round_idx = 0
            while round_idx < max_rounds:
                streamed_content = ""
                final_response = None

                # Stream to show incremental output
                for response, chunk in self.chat.stream():
                    final_response = response
                    if chunk.tool_calls and verbose:
                        for tc in chunk.tool_calls:
                            print(f"[dbg] tool_call chunk: {tc.function.name} args={tc.function.arguments}")
                    if chunk.content:
                        streamed_content += chunk.content
                        if verbose:
                            print(chunk.content, end="", flush=True)

                # Append assistant message (with tool calls) to history if present
                if final_response and hasattr(final_response, "message"):
                    self.chat.append(final_response.message)

                # If no tool calls, we're done
                if not final_response or not final_response.tool_calls:
                    break

                if verbose:
                    print(f"\n[dbg] Tool calls found: {len(final_response.tool_calls)}")

                # Handle client-side tools; server-side tools need no local execution
                for tool_call in final_response.tool_calls:
                    call_type = get_tool_call_type(tool_call)
                    if verbose:
                        print(f"[dbg] Tool call type: {call_type}")
                    if call_type in ["function", "client_side_tool"]:
                        func_name = tool_call.function.name
                        func_args = json.loads(tool_call.function.arguments)
                        if verbose:
                            print(f"[dbg] executing client tool {func_name} with args={func_args}")
                        if func_name in self.client_tools_map:
                            result = self.client_tools_map[func_name](**func_args)
                            if not isinstance(result, str):
                                try:
                                    result_text = json.dumps(result)
                                except Exception:
                                    result_text = str(result)
                            else:
                                result_text = result
                            self.chat.append(tool_result(result_text))
                        else:
                            if verbose:
                                print(f"[dbg] warning: tool {func_name} not in client_tools_map")

                round_idx += 1

        except Exception as e:
            # Graceful fallback on deadline or other RPC issues
            if "DEADLINE_EXCEEDED" in str(e):
                fallback = "Network is slow. Want me to keep going or try again?"
                if verbose:
                    print(f"\n{fallback}")
                return fallback
            err = f"Error while contacting xAI (append/stream): {e}"
            if verbose:
                print(f"\n{err}")
            return err

        if verbose:
            print()

        if streamed_content:
            return self._enforce_brevity(streamed_content)

        fallback = self._fallback_message()
        if verbose:
            print(fallback)
        return fallback
    
    def get_conversation_history(self) -> list[Dict[str, Any]]:
        """
        Get the conversation history.
        
        Returns:
            List of message dictionaries
        """
        return self.chat.messages
    
    def reset_conversation(self):
        """Reset the conversation while keeping the system prompt."""
        system_msg = self.chat.messages[0] if self.chat.messages else None
        
        self.chat = self.client.chat.create(
            model=self.model,
            tools=[
                web_search(),
                *get_memory_tool_definitions()
            ]
        )
        
        if system_msg:
            self.chat.messages.append(system_msg)

