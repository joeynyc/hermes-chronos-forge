"""Backend routes for the Hermes Command Center dashboard plugin.

This file is intentionally defensive: the dashboard still works if internal
Hermes APIs change, and the route never returns secrets or raw environment data.
"""

from __future__ import annotations

import os
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Iterable, List

from fastapi import APIRouter

router = APIRouter()


def _maybe_dict(obj: Any) -> Dict[str, Any]:
    if isinstance(obj, dict):
        return obj
    if hasattr(obj, "__dict__"):
        return dict(obj.__dict__)
    return {}


def _epoch(value: Any) -> float | None:
    if value is None:
        return None
    try:
        return float(value)
    except Exception:
        return None


def _hermes_home() -> Path:
    try:
        from hermes_cli.config import get_hermes_home  # type: ignore

        return Path(get_hermes_home()).expanduser()
    except Exception:
        return Path(os.environ.get("HERMES_HOME", "~/.hermes")).expanduser()


def _read_error_lines(home: Path, max_lines: int = 200) -> List[str]:
    candidates: List[Path] = []
    for folder in [home / "logs", home]:
        if folder.exists():
            candidates.extend(folder.glob("*error*.log"))
            candidates.extend(folder.glob("errors*"))
    seen = set()
    lines: List[str] = []
    for path in candidates:
        if path in seen or not path.is_file():
            continue
        seen.add(path)
        try:
            text = path.read_text(errors="replace")
        except Exception:
            continue
        tail = text.splitlines()[-max_lines:]
        lines.extend(tail)
    return lines[-max_lines:]


def _list_sessions(limit: int = 200) -> List[Dict[str, Any]]:
    try:
        from hermes_state import SessionDB  # type: ignore
    except Exception:
        return []

    db = SessionDB()
    try:
        if hasattr(db, "list_sessions_rich"):
            raw = db.list_sessions_rich(limit=limit)
        elif hasattr(db, "list_sessions"):
            raw = db.list_sessions(limit=limit)
        else:
            raw = []
        return [_maybe_dict(item) for item in raw]
    finally:
        close = getattr(db, "close", None)
        if callable(close):
            close()


@router.get("/snapshot")
async def snapshot() -> Dict[str, Any]:
    home = _hermes_home()
    now = datetime.now(timezone.utc)
    sessions = _list_sessions(200)
    recent_cutoff = now.timestamp() - 24 * 60 * 60

    active = 0
    recent = 0
    source_counts: Counter[str] = Counter()
    model_counts: Counter[str] = Counter()

    for session in sessions:
        if session.get("is_active") or not session.get("ended_at"):
            active += 1
        last = _epoch(session.get("last_active") or session.get("started_at"))
        if last is not None and last >= recent_cutoff:
            recent += 1
        if session.get("source"):
            source_counts[str(session.get("source"))] += 1
        if session.get("model"):
            model_counts[str(session.get("model"))] += 1

    error_lines = _read_error_lines(home, 200)

    return {
        "ok": True,
        "generated_at": now.isoformat(),
        "hermes_home": str(home),
        "session_count_sample": len(sessions),
        "active_sessions_sample": active,
        "sessions_last_24h_sample": recent,
        "top_sources": source_counts.most_common(5),
        "top_models": model_counts.most_common(5),
        "error_lines": len(error_lines),
    }
