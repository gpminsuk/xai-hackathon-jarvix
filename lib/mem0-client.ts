/**
 * Mem0 Memory Client for server-side usage.
 * Uses the mem0 REST API directly since we're in a Node.js environment.
 */

import { MemoryClient, MemoryRecord } from "./types";

const MEM0_API_BASE = "https://api.mem0.ai/v1";

export class Mem0MemoryClient implements MemoryClient {
  private apiKey: string;
  private userId: string;

  constructor(apiKey: string, userId: string) {
    this.apiKey = apiKey;
    this.userId = userId;
  }

  private async request(endpoint: string, options: RequestInit = {}): Promise<unknown> {
    const url = `${MEM0_API_BASE}${endpoint}`;
    console.log(`[Mem0] ${options.method || "GET"} ${url}`);
    
    const response = await fetch(url, {
      ...options,
      headers: {
        "Authorization": `Token ${this.apiKey}`,
        "Content-Type": "application/json",
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      console.error(`[Mem0] Error: ${response.status} - ${error}`);
      throw new Error(`Mem0 API error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    console.log(`[Mem0] Response:`, JSON.stringify(data).slice(0, 200));
    return data;
  }

  async getMemories(userId?: string): Promise<MemoryRecord[]> {
    const uid = userId || this.userId;
    const result = await this.request(`/memories/?user_id=${encodeURIComponent(uid)}`);
    // mem0 API returns { results: [...] } or directly an array depending on endpoint
    if (Array.isArray(result)) {
      return result as MemoryRecord[];
    }
    return (result as { results?: MemoryRecord[] })?.results || [];
  }

  async addMemory(userId: string, text: string, metadata?: Record<string, unknown>): Promise<unknown> {
    const uid = userId || this.userId;
    const body = {
      messages: [{ role: "user", content: text }],
      user_id: uid,
      metadata,
      infer: false, // Store verbatim without mem0's AI extraction
    };
    return this.request("/memories/", {
      method: "POST",
      body: JSON.stringify(body),
    });
  }

  async searchMemories(userId: string, query: string): Promise<MemoryRecord[]> {
    const uid = userId || this.userId;
    const body = {
      query,
      user_id: uid,
    };
    const result = await this.request("/memories/search/", {
      method: "POST",
      body: JSON.stringify(body),
    });
    // API returns array directly OR { results: [...] }
    if (Array.isArray(result)) {
      return result as MemoryRecord[];
    }
    return (result as { results?: MemoryRecord[] })?.results || [];
  }
}

