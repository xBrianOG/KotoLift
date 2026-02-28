import { getAuthHeaders } from "./auth";

const API_BASE = import.meta.env.VITE_API_BASE ?? "";

export interface VideoSegment {
  id: string;
  startMs: number;
  endMs: number;
  text: string;
}

export interface VideoAnalysisResult {
  title: string;
  segments: VideoSegment[];
  minutesUsed?: number;
}

export interface ApiError {
  error: string;
  code?: string;
}

export async function analyzeVideo(
  url: string,
  lang?: string,
): Promise<VideoAnalysisResult> {
  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...getAuthHeaders(),
  };

  const response = await fetch(`${API_BASE}/api/video/analyze`, {
    method: "POST",
    headers,
    body: JSON.stringify({ url, lang }),
  });

  if (response.status === 401) {
    const error: ApiError = await response
      .json()
      .catch(() => ({ error: "Please sign in" }));
    throw new AuthError(error.error || "Please sign in");
  }

  if (!response.ok) {
    const error: ApiError = await response
      .json()
      .catch(() => ({ error: "Analysis failed" }));
    throw new Error(error.error || "Analysis failed");
  }

  return response.json();
}

export async function getUsage(): Promise<{
  minutesUsed: number;
  month: string;
}> {
  const headers = {
    ...getAuthHeaders(),
  };

  const response = await fetch(`${API_BASE}/api/usage/me`, { headers });

  if (response.status === 401) {
    throw new AuthError("Please sign in");
  }

  if (!response.ok) {
    throw new Error("Failed to get usage");
  }

  return response.json();
}

export class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthError";
  }
}
