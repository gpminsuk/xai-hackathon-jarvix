from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Callable, Dict, Iterable, List, Optional, Tuple

from xai_sdk import Client
from xai_sdk.chat import system, user

from jarvix.memory import MemoryManager
from jarvix.ingest import connectors


@dataclass
class IngestConfig:
    model: str = "grok-4-1-fast-reasoning"
    timeout: int = 60
    dry_run: bool = False
    limit: Optional[int] = None
    user_id: str = "demo_user"
    verbose: bool = False
    enrich: bool = True


def _select_context_mems(
    record: Dict[str, object],
    memories: List[Dict[str, object]],
    max_items: int = 3,
) -> List[str]:
    """
    Pick a few prior memories to give Grok minimal context based on simple token overlap.
    """
    def tokenize(val: object) -> List[str]:
        out: List[str] = []
        if isinstance(val, list):
            for v in val:
                out.extend(tokenize(v))
        elif isinstance(val, str):
            for w in val.lower().replace(",", " ").replace(".", " ").split():
                if len(w) >= 3:
                    out.append(w)
        return out

    record_tokens = set()
    for key in ("transcription", "description", "text", "summary"):
        record_tokens.update(tokenize(record.get(key)))

    scored: List[Tuple[int, str]] = []
    for mem in memories:
        text = mem.get("memory") or mem.get("text") or ""
        tokens = set(tokenize(text))
        score = len(record_tokens.intersection(tokens))
        if score > 0:
            scored.append((score, text))

    scored.sort(key=lambda t: t[0], reverse=True)
    return [t[1] for t in scored[:max_items]]


def _record_to_plain_text(record: Dict[str, object]) -> str:
    """
    Pick a reasonable raw text from the record without Grok enrichment.
    """
    candidates = [
        record.get("transcription"),
        record.get("description"),
        record.get("text"),
        record.get("summary"),
    ]
    for cand in candidates:
        if isinstance(cand, str) and cand.strip():
            return cand.strip()
    for val in record.values():
        if isinstance(val, str) and val.strip():
            return val.strip()
    try:
        return json.dumps(record, ensure_ascii=False)
    except Exception:
        return ""


def grok_enrich(
    client: Client,
    model: str,
    record: Dict[str, object],
    context_note: str,
    prior_mems: Optional[List[str]] = None,
) -> str:
    """
    Use Grok to produce one short, factual sentence from the record.
    """
    sys_prompt = (
        "You are a life co-pilot that extracts a single, user-relevant fact for memory. "
        "Output ONE short factual sentence using only the provided fields. Prioritize user preferences, requests, "
        "important statements, relationships, career/school, travel/plans, or commitments. Keep it concise and actionable. "
        "Do not add or infer anything not present. If nothing clearly useful to the user is present, return an empty string. "
        "No lists or tables. If reference memories are provided, use them only when they explicitly support the fact; otherwise ignore them."
    )
    chat = client.chat.create(model=model, tools=[])
    chat.append(system(sys_prompt))
    chat.append(
        user(
            json.dumps(
                {
                    "note": context_note,
                    "record": record,
                    "reference_memories": prior_mems or [],
                },
                ensure_ascii=False,
            )
        )
    )
    resp = chat.sample()
    return (resp.content or "").strip()


def _iter_limited(items: Iterable, limit: Optional[int]) -> Iterable:
    if limit is None:
        yield from items
    else:
        for idx, item in enumerate(items):
            if idx >= limit:
                break
            yield item


def ingest_file(
    connector: str,
    path: Path,
    mem: MemoryManager,
    cfg: IngestConfig,
) -> Tuple[int, int]:
    """
    Ingest a single data file for the given connector.
    Returns: (processed, stored)
    """
    loader: Callable[[Path], Iterable[Tuple[Dict[str, object], Dict[str, object]]]] = {
        "calendar": connectors.calendar.load_calendar_file,
        "vision": connectors.vision.load_vision_file,
        "audio": connectors.audio.load_audio_file,
    }[connector]

    client = Client(timeout=cfg.timeout)
    processed = 0
    stored = 0
    occurrence_counts: Dict[str, int] = {}
    memories_cache: Optional[List[Dict[str, object]]] = None

    if cfg.verbose:
        print(f"[{connector}] Starting {path.name}")

    for record, metadata in _iter_limited(loader(path), cfg.limit):
        processed += 1

        user_id = cfg.user_id or metadata.get("user_id") or "demo_user"
        metadata["user_id"] = user_id
        if memories_cache is None:
            try:
                memories_cache = mem.get_memories(user_id=user_id)
            except Exception:
                memories_cache = []

        prior_mems = _select_context_mems(record, memories_cache or [])

        if cfg.enrich:
            # Connector-specific context note
            note = "Connector: {c}. Keep it factual and concise.".format(c=connector)
            if connector == "calendar":
                note = (
                    "Connector: calendar. Include start_utc and end_utc if present, keep it to one short factual sentence."
                )

            text = grok_enrich(
                client,
                cfg.model,
                record,
                context_note=note,
                prior_mems=prior_mems,
            )
            if not text:
                if cfg.verbose:
                    print(f"[{connector}] {path.name} #{processed}: no enrichment output, skipped")
                continue
        else:
            text = _record_to_plain_text(record)
            if not text:
                if cfg.verbose:
                    print(f"[{connector}] {path.name} #{processed}: no raw text found, skipped")
                continue
            if cfg.verbose:
                print(f"[{connector}] {path.name} #{processed}: using raw text")

        # Track simple occurrence count within this ingest run to boost confidence
        occurrence_counts[text] = occurrence_counts.get(text, 0) + 1
        metadata["occurrence_count"] = occurrence_counts[text]

        if cfg.dry_run:
            print(f"[dry-run] {connector} -> {metadata['source']} | {text}")
            continue

        mem.add_memory(
            user_id=user_id,
            text=text,
            metadata={
                "connector": connector,
                "source": metadata["source"],
                "record_id": metadata.get("record_id"),
                "timestamp": metadata.get("timestamp"),
            },
            infer=False,  # Store verbatim - text is already enriched by Grok or raw
        )
        stored += 1
        if cfg.verbose:
            print(
                f"[{connector}] {path.name} #{processed}: stored (occurrence={metadata['occurrence_count']})"
            )

    return processed, stored


def ingest_paths(
    connector: str,
    paths: List[Path],
    mem: MemoryManager,
    cfg: IngestConfig,
) -> Tuple[int, int]:
    total_processed = 0
    total_stored = 0
    for p in paths:
        if cfg.verbose:
            print(f"[{connector}] Ingesting file: {p}")
        proc, st = ingest_file(connector, p, mem, cfg)
        total_processed += proc
        total_stored += st
        if cfg.verbose:
            print(f"[{connector}] {p.name} done: processed={proc}, stored={st}")
    return total_processed, total_stored

