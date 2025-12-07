from __future__ import annotations

import json
from pathlib import Path
from typing import Dict, Iterable, Tuple


def load_vision_file(path: Path) -> Iterable[Tuple[Dict[str, object], Dict[str, object]]]:
    """
    Yield (record, metadata) for each vision extraction.
    """
    data = json.loads(path.read_text())
    user_id = Path(path).stem
    extractions = data.get("extractions", [])

    for idx, ex in enumerate(extractions):
        content = ex.get("content", {})
        record = {
            "description": content.get("description"),
            "text": content.get("text"),
            "filename": ex.get("filename"),
            "date": ex.get("date"),
        }
        metadata = {
            "user_id": user_id,
            "source": path.name,
            "record_id": ex.get("filename", f"vision-{idx}"),
            "timestamp": ex.get("date"),
        }
        yield record, metadata

