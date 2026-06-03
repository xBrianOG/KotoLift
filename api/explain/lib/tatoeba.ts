// NOTE: Keep this file in sync with server/src/services/tatoeba.ts.
// They are duplicated because the Vercel serverless function (api/) and
// the Render Express server (server/) build from separate roots.

export type ExampleSourceLang = 'ja' | 'en' | 'es';

export interface TatoebaExample {
  ja: string;
  en: string;
  es: string;
}

const LANG_TO_TATOEBA: Record<ExampleSourceLang, 'jpn' | 'eng' | 'spa'> = {
  ja: 'jpn',
  en: 'eng',
  es: 'spa',
};

interface TatoebaTranslation {
  id: number;
  text: string;
  lang: 'jpn' | 'eng' | 'spa';
  is_direct?: boolean;
}

interface TatoebaSentence {
  id: number;
  text: string;
  lang: 'jpn' | 'eng' | 'spa';
  translations?: TatoebaTranslation[];
}

const TATOEBA_BASE = 'https://api.tatoeba.org/v1/sentences';
const DEFAULT_TIMEOUT_MS = 2500;
const DEFAULT_LIMIT = 3;

function exampleFromSentence(s: TatoebaSentence, sourceLang: ExampleSourceLang): TatoebaExample {
  const result: TatoebaExample = { ja: '', en: '', es: '' };
  result[sourceLang] = s.text;
  for (const tr of s.translations || []) {
    if (tr.lang === 'jpn') result.ja = tr.text;
    else if (tr.lang === 'eng') result.en = tr.text;
    else if (tr.lang === 'spa') result.es = tr.text;
  }
  return result;
}

export async function fetchExamples(
  query: string,
  sourceLang: ExampleSourceLang,
  limit: number = DEFAULT_LIMIT,
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
): Promise<TatoebaExample[]> {
  const trimmed = (query || '').trim();
  if (!trimmed) return [];

  const tatoebaSource = LANG_TO_TATOEBA[sourceLang];
  const otherLangs = (Object.keys(LANG_TO_TATOEBA) as ExampleSourceLang[])
    .filter((l) => l !== sourceLang)
    .map((l) => LANG_TO_TATOEBA[l]);

  const strict = await search(trimmed, tatoebaSource, otherLangs, limit, timeoutMs);
  if (strict.length > 0) return strict;

  return searchLoose(trimmed, tatoebaSource, otherLangs, limit, timeoutMs);
}

async function search(
  query: string,
  tatoebaSource: 'jpn' | 'eng' | 'spa',
  otherLangs: Array<'jpn' | 'eng' | 'spa'>,
  limit: number,
  timeoutMs: number,
): Promise<TatoebaExample[]> {
  const url = new URL(TATOEBA_BASE);
  url.searchParams.set('lang', tatoebaSource);
  otherLangs.forEach((code, i) => {
    const n = i + 1;
    url.searchParams.set(`trans:${n}:lang`, code);
    url.searchParams.set(`showtrans:${n}:lang`, code);
  });
  url.searchParams.set('q', query);
  url.searchParams.set('sort', 'relevance');
  url.searchParams.set('limit', String(Math.max(limit * 2, limit)));
  return runSearch(url, query, tatoebaSource, limit, timeoutMs);
}

async function searchLoose(
  query: string,
  tatoebaSource: 'jpn' | 'eng' | 'spa',
  otherLangs: Array<'jpn' | 'eng' | 'spa'>,
  limit: number,
  timeoutMs: number,
): Promise<TatoebaExample[]> {
  const url = new URL(TATOEBA_BASE);
  url.searchParams.set('lang', tatoebaSource);
  url.searchParams.set('trans:lang', otherLangs.join(','));
  url.searchParams.set('showtrans:lang', otherLangs.join(','));
  url.searchParams.set('q', query);
  url.searchParams.set('sort', 'relevance');
  url.searchParams.set('limit', String(Math.max(limit * 3, limit)));
  return runSearch(url, query, tatoebaSource, limit, timeoutMs);
}

async function runSearch(
  url: URL,
  trimmed: string,
  tatoebaSource: 'jpn' | 'eng' | 'spa',
  limit: number,
  timeoutMs: number,
): Promise<TatoebaExample[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url.toString(), { signal: controller.signal });
    if (!response.ok) {
      console.warn(`[Tatoeba] HTTP ${response.status} for query "${trimmed}"`);
      return [];
    }
    const data = (await response.json()) as { data?: TatoebaSentence[] };
    if (!Array.isArray(data.data)) return [];

    return data.data
      .filter((s) => s.lang === tatoebaSource)
      .map((s) => exampleFromSentence(s, thisLang(tatoebaSource)))
      .slice(0, limit);
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      console.warn(`[Tatoeba] timeout after ${timeoutMs}ms for query "${trimmed}"`);
    } else {
      console.warn(`[Tatoeba] fetch error for query "${trimmed}":`, err);
    }
    return [];
  } finally {
    clearTimeout(timer);
  }
}

function thisLang(code: 'jpn' | 'eng' | 'spa'): ExampleSourceLang {
  if (code === 'jpn') return 'ja';
  if (code === 'eng') return 'en';
  return 'es';
}
