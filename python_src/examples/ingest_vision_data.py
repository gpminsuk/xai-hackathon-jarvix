"""
Example script: ingest vision data (image descriptions + text) into mem0.

Run from the repo root:

    python usage/ingest_vision_data.py data/vision/scenario1/scenario1.json

API keys
--------
This example is written for the hosted mem0 Cloud API.

- Set your mem0 key in the environment:

    export MEM0_API_KEY="your-mem0-api-key"

The script:
1. Reads a JSON file from the data/vision directory
2. Uses the filename (without extension) as the user_id
3. Combines description + text from each extraction as memory
4. Ingests each combined text as a separate memory
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any, Dict, List

from jarvix.memory import MemoryManager


def extract_vision_memories(data: Dict[str, Any]) -> List[Dict[str, str]]:
    """
    Extract vision memories from JSON data.
    
    Each extraction combines description and text into a single memory.
    
    Args:
        data: JSON data with extractions array
        
    Returns:
        List of dicts with 'memory' and metadata
    """
    memories = []
    
    # Check for extractions array
    if "extractions" not in data or not isinstance(data["extractions"], list):
        return memories
    
    for extraction in data["extractions"]:
        if not isinstance(extraction, dict):
            continue
            
        # Extract content
        content = extraction.get("content", {})
        if not isinstance(content, dict):
            continue
        
        description = content.get("description", "").strip()
        text = content.get("text", "").strip()
        
        # Skip if both are empty
        if not description and not text:
            continue
        
        # Combine description + text (with space between if both exist)
        combined_parts = []
        if description:
            combined_parts.append(description)
        if text:
            combined_parts.append(text)
        
        combined_memory = " ".join(combined_parts)
        
        # Create memory entry with metadata
        memory_entry = {
            "memory": combined_memory,
            "filename": extraction.get("filename", ""),
            "date": extraction.get("date", ""),
        }
        
        memories.append(memory_entry)
    
    return memories


def ingest_vision_file(
    json_path: Path,
    manager: MemoryManager,
    metadata: Dict[str, Any] | None = None,
) -> None:
    """
    Ingest vision data from a JSON file into mem0.
    
    Args:
        json_path: Path to the JSON file
        manager: MemoryManager instance
        metadata: Optional metadata to attach to each memory
    """
    # Use filename (without extension) as user_id
    user_id = json_path.stem
    
    # Read and parse the JSON file
    with open(json_path, "r", encoding="utf-8") as f:
        data = json.load(f)
    
    # Extract vision memories
    vision_memories = extract_vision_memories(data)
    
    if not vision_memories:
        print(f"⚠️  No vision data found in {json_path}")
        return
    
    print(f"\n📥 Ingesting {len(vision_memories)} vision memories for user: {user_id}")
    print(f"   Source file: {json_path}")
    
    # Add default metadata if not provided
    if metadata is None:
        metadata = {}
    
    # Add source file to metadata
    metadata["source_file"] = str(json_path)
    metadata["source_type"] = "vision"
    
    # Ingest each vision memory
    ingested_count = 0
    for idx, mem_data in enumerate(vision_memories, 1):
        try:
            # Combine base metadata with memory-specific metadata
            mem_metadata = {
                **metadata,
                "vision_index": idx,
                "image_filename": mem_data["filename"],
                "image_date": mem_data["date"],
            }
            
            manager.add_memory(
                user_id=user_id,
                text=mem_data["memory"],
                metadata=mem_metadata
            )
            ingested_count += 1
            
            # Show preview of memory (truncated)
            preview = mem_data["memory"][:80] + "..." if len(mem_data["memory"]) > 80 else mem_data["memory"]
            print(f"   ✓ [{idx}/{len(vision_memories)}] {preview}")
            
        except Exception as e:
            print(f"   ✗ [{idx}/{len(vision_memories)}] Failed: {e}")
    
    print(f"\n✅ Successfully ingested {ingested_count}/{len(vision_memories)} vision memories")


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Ingest vision data (image descriptions + text) into mem0",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Ingest a single vision file
  python usage/ingest_vision_data.py data/vision/scenario1/scenario1.json
  
  # Ingest with custom metadata
  python usage/ingest_vision_data.py data/vision/scenario1/scenario1.json --metadata '{"type": "vision", "source": "mobile_app"}'
  
  # Ingest all vision files in a directory
  for file in data/vision/*/*.json; do
    python usage/ingest_vision_data.py "$file"
  done
        """,
    )
    parser.add_argument(
        "json_file",
        type=Path,
        help="Path to the vision JSON file to ingest",
    )
    parser.add_argument(
        "--metadata",
        type=str,
        help="Optional JSON string with metadata to attach to each memory",
    )
    parser.add_argument(
        "--api-key",
        type=str,
        help="mem0 API key (can also use MEM0_API_KEY env var)",
    )
    
    args = parser.parse_args()
    
    # Validate file exists
    if not args.json_file.exists():
        print(f"❌ Error: File not found: {args.json_file}")
        return
    
    # Parse metadata if provided
    metadata = None
    if args.metadata:
        try:
            metadata = json.loads(args.metadata)
        except json.JSONDecodeError as e:
            print(f"❌ Error: Invalid JSON in --metadata: {e}")
            return
    
    # Initialize MemoryManager
    if args.api_key:
        manager = MemoryManager(api_key=args.api_key)
    else:
        manager = MemoryManager()
    
    # Ingest the file
    ingest_vision_file(args.json_file, manager, metadata)


if __name__ == "__main__":
    main()

