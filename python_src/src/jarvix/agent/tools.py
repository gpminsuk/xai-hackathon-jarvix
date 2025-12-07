"""
Agent tools for mem0 memory integration.
"""

from __future__ import annotations

import difflib
from typing import Any, Dict, List, Tuple

from jarvix.memory import MemoryManager
from jarvix.integrations import google_calendar


class MemoryTools:
    """
    Client-side mem0 memory tools.
    
    Provides tools for storing and retrieving user memories.
    """
    
    def __init__(self, user_id: str, memory_manager: MemoryManager):
        """
        Initialize memory tools.
        
        Args:
            user_id: Unique user identifier
            memory_manager: MemoryManager instance
        """
        self.user_id = user_id
        self.memory = memory_manager
    
    def add_memory(self, memory_text: str, metadata: Dict[str, Any] = None) -> str:
        """
        Store a new memory about the user.
        
        Args:
            memory_text: The memory to store
            metadata: Optional metadata (category, confidence, etc.)
            
        Returns:
            Success message
        """
        if metadata is None:
            metadata = {}
        
        # Add source metadata
        metadata["source"] = "agent"
        
        # Store in mem0
        result = self.memory.add_memory(
            user_id=self.user_id,
            text=memory_text,
            metadata=metadata
        )
        
        # Extract memories from result
        if isinstance(result, dict) and "results" in result:
            memories = result["results"]
            count = len(memories)
            return f"Stored {count} memory(ies) about: {memory_text[:50]}..."
        
        return f"Stored memory: {memory_text[:50]}..."
    
    def _rank_memories(self, query: str, memories: List[Dict[str, Any]]) -> List[Tuple[float, Dict[str, Any]]]:
        """
        Rank memories by simple semantic closeness using difflib.
        Keeps implementation lightweight while improving over raw keyword search.
        """
        query_lower = query.lower()
        ranked: List[Tuple[float, Dict[str, Any]]] = []

        for mem in memories:
            text = mem.get("memory", "") or ""
            ratio = difflib.SequenceMatcher(None, query_lower, text.lower()).ratio()

            # Light keyword boost
            if query_lower in text.lower():
                ratio += 0.15

            ranked.append((ratio, mem))

        ranked.sort(key=lambda x: x[0], reverse=True)
        return ranked

    def search_memories(self, query: str) -> str:
        """
        Search for relevant memories.
        
        Args:
            query: What to search for
            
        Returns:
            Formatted string of relevant memories
        """
        # Get all memories
        memories = self.memory.get_memories(user_id=self.user_id)
        
        if not memories:
            return "No memories found."
        
        ranked = self._rank_memories(query, memories)
        top = [mem for score, mem in ranked[:5] if score > 0.2]

        if not top:
            return f"No memories matching '{query}'"

        results = []
        for i, mem in enumerate(top, 1):
            label = mem.get("memory") or ""
            results.append(f"{i}. {label}")
        return "\n".join(results)
    
    def get_all_memories(self) -> str:
        """
        Get all memories for context.
        
        Returns:
            Formatted string of all memories
        """
        memories = self.memory.get_memories(user_id=self.user_id)
        
        if not memories:
            return "No memories stored yet."
        
        # Group by category if available
        categorized = {}
        for mem in memories:
            category = mem.get("metadata", {}).get("category", "general")
            if category not in categorized:
                categorized[category] = []
            categorized[category].append(mem.get("memory"))
        
        # Format output
        results = [f"Total: {len(memories)} memories\n"]
        for category, mems in categorized.items():
            results.append(f"{category.upper()}:")
            for mem in mems[:3]:
                results.append(f"  • {mem}")
        
        return "\n".join(results)


def get_memory_tool_definitions() -> list:
    """
    Get tool definitions for mem0 memory tools.
    
    Returns:
        List of tool definitions for Grok
    """
    from xai_sdk.chat import tool
    
    return [
        tool(
            name="add_memory",
            description=(
                "Silently store new information about the user (preferences, habits, facts, routines). "
                "Do NOT tell the user you are storing it. "
                "Use when learning anything that should be remembered for future interactions."
            ),
            parameters={
                "type": "object",
                "properties": {
                    "memory_text": {
                        "type": "string",
                        "description": "The information to remember"
                    },
                    "metadata": {
                        "type": "object",
                        "description": "Optional categorization",
                        "properties": {
                            "category": {
                                "type": "string",
                                "enum": ["preference", "habit", "fact", "schedule", "location"],
                            },
                            "confidence": {
                                "type": "string",
                                "enum": ["high", "medium", "low"],
                            }
                        }
                    }
                },
                "required": ["memory_text"]
            }
        ),
        tool(
            name="search_memories",
            description=(
                "ALWAYS call this first to personalize before responding. "
                "Search stored memories for user preferences, routines, relationships, or past facts."
            ),
            parameters={
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "What to search for"
                    }
                },
                "required": ["query"]
            }
        ),
        tool(
            name="get_all_memories",
            description=(
                "Get complete memory context. "
                "Use for briefings or when full user context is needed."
            ),
            parameters={
                "type": "object",
                "properties": {}
            }
        )
    ]


class CalendarTools:
    """
    Client-side calendar tools (Google Calendar).
    """

    def create_event(
        self,
        summary: str,
        start_iso: str,
        end_iso: str,
        timezone: str = "UTC",
        attendees: Dict[str, Any] | None = None,
        secrets_dir: str = "secrets/google",
    ) -> str:
        attendee_list = None
        if attendees and isinstance(attendees, dict):
            maybe = attendees.get("emails")
            if isinstance(maybe, list):
                attendee_list = [str(e) for e in maybe]
        return google_calendar.create_event(
            summary=summary,
            start_iso=start_iso,
            end_iso=end_iso,
            attendees=attendee_list,
            timezone=timezone,
            secrets_dir=secrets_dir,
        )


def get_calendar_tool_definitions() -> list:
    from xai_sdk.chat import tool

    return [
        tool(
            name="create_calendar_event",
            description="Create a calendar event via Google Calendar (client-side).",
            parameters={
                "type": "object",
                "properties": {
                    "summary": {"type": "string", "description": "Event summary/title"},
                    "start_iso": {"type": "string", "description": "Start datetime in ISO (e.g., 2025-12-10T10:00:00)"},
                    "end_iso": {"type": "string", "description": "End datetime in ISO (e.g., 2025-12-10T11:00:00)"},
                    "timezone": {"type": "string", "description": "Timezone ID, default UTC"},
                    "attendees": {
                        "type": "object",
                        "description": "Optional attendees as { emails: [\"a@b.com\"] }",
                        "properties": {
                            "emails": {
                                "type": "array",
                                "items": {"type": "string"},
                            }
                        },
                    },
                    "secrets_dir": {"type": "string", "description": "Path to credentials/token (default secrets/google)"},
                },
                "required": ["summary", "start_iso", "end_iso"],
            },
        )
    ]

