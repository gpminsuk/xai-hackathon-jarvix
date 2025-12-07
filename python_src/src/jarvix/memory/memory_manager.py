from __future__ import annotations

from typing import Any, Dict, List, Optional, Union

from mem0 import MemoryClient  # type: ignore


class MemoryManager:
    """
    Small convenience wrapper around mem0's hosted API client.

    Responsibilities:
    - Add memories for a given user.
    - Fetch memories for a given user.
    - Return a simple, uniform structure that can be visualized.
    """

    def __init__(self, api_key: Optional[str] = None, **mem0_kwargs: Any) -> None:
        """
        Initialize the underlying mem0 hosted client.

        - If `api_key` is provided, it is passed explicitly to
          `mem0.MemoryClient(api_key=...)`.
        - Otherwise, mem0 will look for `MEM0_API_KEY` in the environment,
          along with any other configuration it supports.

        Any additional keyword arguments are forwarded directly to
        `mem0.MemoryClient(...)` so you can configure project settings,
        base URLs, etc. according to mem0's documentation.
        """
        if api_key is not None:
            self._client = MemoryClient(api_key=api_key, **mem0_kwargs)
        else:
            self._client = MemoryClient(**mem0_kwargs)

    # Core operations -----------------------------------------------------
    def add_memory(
        self,
        user_id: str,
        text: Optional[str] = None,
        messages: Optional[List[Dict[str, Any]]] = None,
        metadata: Optional[Dict[str, Any]] = None,
        infer: bool = True,
    ) -> Dict[str, Any]:
        """
        Add a new memory for the given user.

        You can provide memory in two formats:
        1. Simple text string (via `text` parameter)
        2. Conversation messages (via `messages` parameter)

        Args:
            user_id: The user identifier
            text: Simple text to add as memory (mutually exclusive with messages)
            messages: List of conversation messages in format:
                     [{"role": "user", "content": "..."}, {"role": "assistant", "content": "..."}]
            metadata: Optional metadata to attach to the memory
            infer: If True (default), mem0 uses AI to extract facts from the input.
                   If False, stores the text verbatim without AI extraction.
                   Only applies when using `text` parameter.

        Returns:
            The raw response from mem0 (dict with "results" key in v1.0+)

        Examples:
            # Simple text with AI extraction (default)
            manager.add_memory(user_id="alice", text="I love pizza")

            # Simple text stored verbatim (no extraction)
            manager.add_memory(user_id="alice", text="User prefers pepperoni pizza", infer=False)

            # Conversation format (always uses AI extraction)
            manager.add_memory(
                user_id="alex",
                messages=[
                    {"role": "user", "content": "Hi, I'm Alex. I'm a vegetarian and allergic to nuts."},
                    {"role": "assistant", "content": "Hello Alex! I'll remember that."}
                ]
            )
        """
        if not user_id:
            raise ValueError("user_id must be non-empty")

        # Ensure exactly one of text or messages is provided
        if text and messages:
            raise ValueError("Provide either 'text' or 'messages', not both")
        if not text and not messages:
            raise ValueError("Must provide either 'text' or 'messages'")

        # Add memory using the appropriate format
        if messages:
            # Messages always use AI extraction
            return self._client.add(messages, user_id=user_id, metadata=metadata)
        else:
            if not text:
                raise ValueError("text must be non-empty")
            # Use infer=False to store verbatim without AI extraction
            return self._client.add(text, user_id=user_id, metadata=metadata, infer=infer)

    def get_memories(self, user_id: str) -> List[Dict[str, Any]]:
        """
        Retrieve all memories for a given user.

        The exact structure depends on mem0's backend, but we normalize
        to a list of dicts where possible.
        """
        if not user_id:
            raise ValueError("user_id must be non-empty")

        # mem0 hosted client: get all memories for this user_id.
        # In mem0 v1.0+, get_all() returns a dict with "results" key
        result = self._client.get_all(filters={"AND": [{"user_id": user_id}]})

        # Extract the results list from the response
        if isinstance(result, dict) and "results" in result:
            return [self._coerce_record(r) for r in result["results"]]

        # Fallback: if it's already a list
        if isinstance(result, list):
            return [self._coerce_record(r) for r in result]

        # Fallback: single object or dict
        return [self._coerce_record(result)]

    # Helpers -------------------------------------------------------------
    @staticmethod
    def _coerce_record(record: Any) -> Dict[str, Any]:
        """
        Best-effort conversion of a mem0 record into a plain dict.
        """
        if isinstance(record, dict):
            return record

        # Try dataclass / pydantic-like objects
        if hasattr(record, "dict") and callable(getattr(record, "dict")):
            return record.dict()  # type: ignore[no-any-return]

        if hasattr(record, "__dict__"):
            return dict(record.__dict__)

        # Last resort: wrap the raw value
        return {"value": record}

