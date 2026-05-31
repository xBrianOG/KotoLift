const RAILWAY_API = 'https://sumi.sumidev.com/api';

export interface Sentence {
  start: number;
  end: number;
  text: string;
}

function extractVideoId(url: string): string | null {
  const match = url.match(/(?:v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  return match ? match[1] : null;
}

export function getDemoSentences(): Sentence[] {
  return [
    { start: 0, end: 5, text: "Welcome to this tutorial. Click play to start learning." },
    { start: 5, end: 10, text: "Click on any word to see its translation." },
    { start: 10, end: 15, text: "Click the translation button for full sentence breakdown." },
    { start: 15, end: 20, text: "Saved words will appear in your flashcard deck." },
  ];
}

export async function fetchYouTubeTranscript(
  videoUrl: string,
  lang: string = 'en'
): Promise<{ title: string; sentences: Sentence[]; videoId: string }> {
  const videoId = extractVideoId(videoUrl);
  if (!videoId) {
    throw new Error('Invalid YouTube URL');
  }

  console.log(`[SubtitleService] Fetching transcript for: ${videoId}`);

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    const response = await fetch(`${RAILWAY_API}/transcribe/${videoId}?lang=${lang}`, {
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      if (data.segments?.length) {
        console.log(`[SubtitleService] Using backend transcript (${data.segments.length} sentences)`);
        return {
          title: data.title || 'YouTube Video',
          sentences: data.segments.map((seg: any) => ({
            start: seg.startMs / 1000,
            end: seg.endMs / 1000,
            text: seg.text
          })),
          videoId: data.videoId || videoId
        };
      }
    }
  } catch (e) {
    console.warn(`[SubtitleService] Backend fetch failed:`, e);
  }

  console.log(`[SubtitleService] Backend unavailable, using demo data`);
  
  const demoSentences = getDemoSentences();
  return { 
    title: 'YouTube Learning', 
    sentences: demoSentences, 
    videoId 
  };
}