/**
 * Google Calendar Client for server-side usage.
 *
 * If Google OAuth credentials are present under `secrets/google/credentials.json`
 * and `secrets/google/token.json`, we create real events using Google Calendar API.
 * Otherwise, we fall back to a mock response so the demo keeps working.
 */

import path from "path";
import fs from "fs/promises";
import { google, calendar_v3 } from "googleapis";
import { CalendarClient, CalendarEventInfo, CalendarEventParams } from "./types";

export class GoogleCalendarClient implements CalendarClient {
  private secretsDir: string;

  constructor(secretsDir?: string) {
    this.secretsDir = secretsDir || process.env.GOOGLE_SECRETS_DIR || "secrets/google";
  }

  /**
   * Try to load OAuth2 client from secrets.
   * Expects credentials.json (OAuth client) and token.json (user token).
   */
  private async getAuthClient() {
    try {
      const credentialsPath = path.join(process.cwd(), this.secretsDir, "credentials.json");
      const tokenPath = path.join(process.cwd(), this.secretsDir, "token.json");

      const [credentialsRaw, tokenRaw] = await Promise.all([
        fs.readFile(credentialsPath, "utf-8"),
        fs.readFile(tokenPath, "utf-8"),
      ]);

      const credentials = JSON.parse(credentialsRaw);
      const token = JSON.parse(tokenRaw);

      const { client_secret, client_id, redirect_uris } = credentials.installed || credentials.web;
      const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);
      oAuth2Client.setCredentials(token);
      return oAuth2Client;
    } catch (err) {
      console.warn("[Calendar] Could not load Google OAuth credentials/token; using mock. Error:", err);
      return null;
    }
  }

  /**
   * Create a calendar event. If Google auth available, create real event; otherwise mock.
   */
  async createEvent(params: CalendarEventParams): Promise<unknown> {
    const auth = await this.getAuthClient();

    if (auth) {
      try {
        const calendar: calendar_v3.Calendar = google.calendar({ version: "v3", auth });
        const res = await calendar.events.insert({
          calendarId: "primary",
          requestBody: {
            summary: params.summary,
            start: { dateTime: params.start_iso, timeZone: params.timezone || "UTC" },
            end: { dateTime: params.end_iso, timeZone: params.timezone || "UTC" },
            attendees: params.attendees?.emails?.map((email) => ({ email })),
          },
        });
        console.log("[Calendar] Created event:", res.data.id);
        return res.data;
      } catch (err) {
        console.error("[Calendar] Failed to create Google event, falling back to mock:", err);
      }
    }

    // Fallback mock
    console.log("[Calendar] Would create event (mock):", {
      summary: params.summary,
      start: params.start_iso,
      end: params.end_iso,
      timezone: params.timezone || "UTC",
      attendees: params.attendees?.emails || [],
    });

    const eventId = `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    return {
      id: eventId,
      summary: params.summary,
      start: { dateTime: params.start_iso, timeZone: params.timezone || "UTC" },
      end: { dateTime: params.end_iso, timeZone: params.timezone || "UTC" },
      attendees: params.attendees?.emails?.map((email) => ({ email })) || [],
      htmlLink: `https://calendar.google.com/calendar/event?eid=${eventId}`,
      status: "confirmed (mock)",
    };
  }

  /**
   * List upcoming events within the specified window (minutes).
   */
  async listUpcomingEvents(windowMinutes: number): Promise<CalendarEventInfo[]> {
    const auth = await this.getAuthClient();
    if (!auth) {
      return [];
    }

    try {
      const calendar: calendar_v3.Calendar = google.calendar({ version: "v3", auth });
      const now = new Date();
      const timeMin = now.toISOString();
      const timeMax = new Date(now.getTime() + windowMinutes * 60 * 1000).toISOString();

      const res = await calendar.events.list({
        calendarId: "primary",
        timeMin,
        timeMax,
        singleEvents: true,
        orderBy: "startTime",
        maxResults: 5,
      });

      const items = res.data.items || [];
      const events: CalendarEventInfo[] = [];

      for (const item of items) {
        const start = item.start?.dateTime || item.start?.date;
        if (!start) continue; // skip events without start time

        const end = item.end?.dateTime || item.end?.date;
        events.push({
          summary: item.summary || "Calendar event",
          start,
          end,
        });
      }

      return events;
    } catch (err) {
      console.error("[Calendar] Failed to list upcoming events, returning empty list:", err);
      return [];
    }
  }
}

