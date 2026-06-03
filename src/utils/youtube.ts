// Shared YouTube helpers. Single source of truth for parsing YouTube URLs
// and extracting the 11-character video ID. Imported by every component /
// service that needs to look at a YouTube URL.

const VIDEO_ID_REGEX = /^[a-zA-Z0-9_-]{11}$/;

const URL_PATTERNS: RegExp[] = [
  /(?:v=)([a-zA-Z0-9_-]{11})/,            // https://www.youtube.com/watch?v=XXXXXXXXXXX
  /youtu\.be\/([a-zA-Z0-9_-]{11})/,          // https://youtu.be/XXXXXXXXXXX
  /embed\/([a-zA-Z0-9_-]{11})/,              // https://www.youtube.com/embed/XXXXXXXXXXX
  /^([a-zA-Z0-9_-]{11})$/,                  // bare video ID
];

export function extractVideoIdFromUrl(input: string): string | null {
  const trimmed = (input || '').trim();
  if (!trimmed) return null;

  for (const pattern of URL_PATTERNS) {
    const m = trimmed.match(pattern);
    if (m && m[1] && VIDEO_ID_REGEX.test(m[1])) return m[1];
  }
  return null;
}

export function isValidVideoId(id: string | null | undefined): id is string {
  return typeof id === 'string' && VIDEO_ID_REGEX.test(id);
}
