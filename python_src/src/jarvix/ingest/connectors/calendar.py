from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, Iterable, Tuple


def _to_utc(dt_str: str) -> str:
    """
    Convert ISO8601 with offset to UTC ISO string. If parse fails, return the input.
    """
    try:
        dt = datetime.fromisoformat(dt_str)
        if dt.tzinfo:
            return dt.astimezone(timezone.utc).isoformat()
    except Exception:
        return dt_str
    return dt_str


def load_calendar_file(path: Path) -> Iterable[Tuple[Dict[str, object], Dict[str, object]]]:
    """
    Yield (record, metadata) for each calendar event.
    """
    data = json.loads(path.read_text())
    user_id = Path(path).stem
    events = data.get("events", [])

    for idx, ev in enumerate(events):
        start = ev.get("start", {})
        end = ev.get("end", {})
        start_dt = start.get("dateTime") or start.get("date")
        end_dt = end.get("dateTime") or end.get("date")

        record = {
            "summary": ev.get("summary"),
            "description": ev.get("description"),
            "location": ev.get("location"),
            "start_utc": _to_utc(start_dt) if start_dt else None,
            "end_utc": _to_utc(end_dt) if end_dt else None,
            "attendees": ev.get("attendees"),
            "organizer": ev.get("organizer"),
            "calendar_name": ev.get("calendar_name"),
        }

        metadata = {
            "user_id": user_id,
            "source": path.name,
            "record_id": ev.get("event_id", f"event-{idx}"),
            "timestamp": record.get("start_utc") or record.get("end_utc"),
            "start_utc": record.get("start_utc"),
            "end_utc": record.get("end_utc"),
        }

        yield record, metadata

