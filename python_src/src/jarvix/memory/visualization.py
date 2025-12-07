from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, Iterable, List


def _extract_timestamp(record: Dict[str, Any]) -> str:
    """
    Best-effort timestamp extraction as ISO string.
    """
    for key in ("created_at", "timestamp", "time", "ts"):
        value = record.get(key)
        if isinstance(value, str):
            # Optimistically assume it's already ISO-ish
            return value
        if isinstance(value, (int, float)):
            # Treat as unix epoch seconds
            try:
                return datetime.fromtimestamp(value).isoformat()
            except Exception:
                continue
    # Fallback: now
    return datetime.now().isoformat()


def _extract_text(record: Dict[str, Any]) -> str:
    for key in ("memory", "text", "content", "value"):
        value = record.get(key)
        if isinstance(value, str):
            return value
    return ""


def _extract_id(record: Dict[str, Any]) -> str:
    for key in ("id", "_id", "uuid"):
        value = record.get(key)
        if isinstance(value, (str, int)):
            return str(value)
    return ""


def memories_to_table(memories: Iterable[Dict[str, Any]]) -> str:
    """
    Render memories to a simple, monospaced text table.

    Useful for quick visualization in the terminal / logs.
    """
    rows: List[Dict[str, str]] = []
    for rec in memories:
        rows.append(
            {
                "id": _extract_id(rec),
                "timestamp": _extract_timestamp(rec),
                "text": _extract_text(rec),
            }
        )

    if not rows:
        return "(no memories)"

    # Compute column widths
    id_width = max(len("id"), max(len(r["id"]) for r in rows))
    ts_width = max(len("timestamp"), max(len(r["timestamp"]) for r in rows))

    header = f"{'id'.ljust(id_width)}  {'timestamp'.ljust(ts_width)}  text"
    sep = "-" * len(header)
    lines = [header, sep]

    for r in rows:
        lines.append(
            f"{r['id'].ljust(id_width)}  {r['timestamp'].ljust(ts_width)}  {r['text']}"
        )

    return "\n".join(lines)


def memories_to_html(memories: Iterable[Dict[str, Any]], title: str = "User Memories") -> str:
    """
    Render memories into a small self-contained HTML page.

    You can write this string to a file and open it in a browser to
    visualize the memories.
    """
    rows: List[Dict[str, str]] = []
    for rec in memories:
        rows.append(
            {
                "id": _extract_id(rec),
                "timestamp": _extract_timestamp(rec),
                "text": _extract_text(rec),
            }
        )

    # Basic, dependency-free styling
    table_rows = "\n".join(
        f"<tr><td>{r['id']}</td><td>{r['timestamp']}</td><td>{r['text']}</td></tr>"
        for r in rows
    )

    html = f"""<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>{title}</title>
    <style>
      body {{
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        margin: 2rem;
        background: #0b1020;
        color: #f5f5f5;
      }}
      h1 {{
        margin-bottom: 1rem;
      }}
      table {{
        border-collapse: collapse;
        width: 100%;
      }}
      th, td {{
        border: 1px solid #333;
        padding: 0.5rem 0.75rem;
        vertical-align: top;
      }}
      th {{
        background: #151b2e;
      }}
      tr:nth-child(even) td {{
        background: #111727;
      }}
      tr:nth-child(odd) td {{
        background: #0d1322;
      }}
      code {{
        font-family: Menlo, Monaco, Consolas, "Courier New", monospace;
      }}
    </style>
  </head>
  <body>
    <h1>{title}</h1>
    <table>
      <thead>
        <tr>
          <th>id</th>
          <th>timestamp</th>
          <th>text</th>
        </tr>
      </thead>
      <tbody>
        {table_rows}
      </tbody>
    </table>
  </body>
</html>
"""
    return html

