import { getAuthHeaders } from "./auth";

const API_BASE = import.meta.env.VITE_API_BASE ?? "https://kotolift.onrender.com";

export interface VideoSegment {
  id: string;
  startMs: number;
  endMs: number;
  text: string;
}

export interface VideoAnalysisResult {
  title: string;
  segments: VideoSegment[];
  languageDetected?: string;
  minutesUsed?: number;
  method?: string;
}

export interface ApiError {
  error: string;
  code?: string;
}

export async function analyzeVideo(
  url: string,
  lang?: string,
  preferWhisper?: boolean,
): Promise<VideoAnalysisResult> {
  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...getAuthHeaders(),
  };

  const response = await fetch(`${API_BASE}/api/video/analyze`, {
    method: "POST",
    headers,
    body: JSON.stringify({ url, lang, preferWhisper }),
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

export type SupportedLang = 'en' | 'ja' | 'es';

export async function translateText(
  text: string,
  sourceLang: SupportedLang,
  targetLang: SupportedLang
): Promise<string> {
  if (sourceLang === targetLang) {
    return text;
  }

  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...getAuthHeaders(),
  };

  const response = await fetch(`${API_BASE}/api/video/translate`, {
    method: "POST",
    headers,
    body: JSON.stringify({ text, sourceLang, targetLang }),
  });

  if (!response.ok) {
    const error: ApiError = await response
      .json()
      .catch(() => ({ error: "Translation failed" }));
    throw new Error(error.error || "Translation failed");
  }

  const data = await response.json();
  return data.translation || "";
}
