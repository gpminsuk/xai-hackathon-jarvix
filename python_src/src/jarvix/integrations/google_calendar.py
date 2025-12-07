from __future__ import annotations

import os
from pathlib import Path
from typing import List, Optional

from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build

SCOPES = ["https://www.googleapis.com/auth/calendar"]


def _load_creds(
    credentials_path: Path,
    token_path: Path,
) -> Credentials:
    creds: Optional[Credentials] = None
    if token_path.exists():
        creds = Credentials.from_authorized_user_file(token_path, SCOPES)

    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            flow = InstalledAppFlow.from_client_secrets_file(str(credentials_path), SCOPES)
            creds = flow.run_local_server(port=0)
        token_path.write_text(creds.to_json())

    return creds


def create_event(
    summary: str,
    start_iso: str,
    end_iso: str,
    attendees: Optional[List[str]] = None,
    timezone: str = "UTC",
    secrets_dir: str = "secrets/google",
) -> str:
    """
    Create a calendar event via Google Calendar API.
    Expects credentials.json and token.json in secrets_dir.
    """
    base = Path(secrets_dir)
    credentials_path = base / "credentials.json"
    token_path = base / "token.json"
    if not credentials_path.exists():
        raise FileNotFoundError(f"Missing credentials at {credentials_path}")

    creds = _load_creds(credentials_path, token_path)
    service = build("calendar", "v3", credentials=creds)

    event = {
        "summary": summary,
        "start": {"dateTime": start_iso, "timeZone": timezone},
        "end": {"dateTime": end_iso, "timeZone": timezone},
    }
    if attendees:
        event["attendees"] = [{"email": e} for e in attendees]

    created = service.events().insert(calendarId="primary", body=event, sendUpdates="all").execute()
    link = created.get("htmlLink", "")
    return f"Event created: {link}" if link else "Event created."

