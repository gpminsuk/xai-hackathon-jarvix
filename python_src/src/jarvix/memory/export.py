from __future__ import annotations

from datetime import datetime
from pathlib import Path
from typing import Optional

import shutil


def export_sqlite_folder(
    source_dir: Optional[str] = None,
    output_dir: Optional[str] = None,
) -> Path:
    """
    Create a ZIP archive of a folder that holds mem0's SQLite data.

    This is intended for local/self-hosted mem0 setups that store
    memories in a SQLite-backed directory (for example, under
    `~/.mem0`).

    - If `source_dir` is None, we default to `~/.mem0` and require
      that it exists.
    - If `output_dir` is None, the archive is created in the current
      working directory.

    Returns the path to the created ZIP file.
    """
    if source_dir is None:
        default_src = Path.home() / ".mem0"
        if not default_src.exists():
            raise FileNotFoundError(
                "No source_dir provided and default ~/.mem0 does not exist. "
                "Pass the directory that contains your mem0 SQLite files."
            )
        src_path = default_src
    else:
        src_path = Path(source_dir).expanduser().resolve()
        if not src_path.exists():
            raise FileNotFoundError(f"source_dir does not exist: {src_path}")
        if not src_path.is_dir():
            raise NotADirectoryError(f"source_dir is not a directory: {src_path}")

    if output_dir is None:
        out_dir = Path.cwd()
    else:
        out_dir = Path(output_dir).expanduser().resolve()
        out_dir.mkdir(parents=True, exist_ok=True)

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    base_name = out_dir / f"mem0_sqlite_backup_{timestamp}"

    archive_path_str = shutil.make_archive(
        base_name=str(base_name),
        format="zip",
        root_dir=str(src_path),
    )

    return Path(archive_path_str)

