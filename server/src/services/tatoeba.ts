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

  // Tatoeba filter semantics: `trans:lang=a,b` is OR within a group, AND
  // across groups. To require *both* languages we use one group per lang.
  // see https://api.tatoeba.org/openapi (paths./v1/sentences.parameters)
  const url = new URL(TATOEBA_BASE);
  url.searchParams.set('lang', tatoebaSource);
  otherLangs.forEach((code, i) => {
    const n = i + 1;
    url.searchParams.set(`trans:${n}:lang`, code);
    url.searchParams.set(`showtrans:${n}:lang`, code);
  });
  url.searchParams.set('q', trimmed);
  url.searchParams.set('sort', 'relevance');
  url.searchParams.set('limit', String(Math.max(limit * 2, limit)));

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
      .slice(0, limit)
      .map((s) => exampleFromSentence(s, sourceLang));
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
