import { Router } from 'express';
import { spawn } from 'child_process';
import { join } from 'path';
import { tmpdir } from 'os';
import { existsSync, unlinkSync, mkdirSync, statSync, readFileSync, writeFileSync } from 'fs';
import OpenAI from 'openai';

const router = Router();

const CACHE_DIR = join(tmpdir(), 'tts-cache');

if (!existsSync(CACHE_DIR)) {
  try {
    mkdirSync(CACHE_DIR, { recursive: true });
  } catch (e) {}
}

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

function hashText(text: string, voice: string, rate: number, model: string): string {
  let hash = 0;
  const str = `${text}|${voice}|${rate}|${model}`;
  for (let i = 0; i < str.length; i++) {
    const chr = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + chr;
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

const VOICE_BY_LANG: Record<string, string> = {
  en: 'nova',
  ja: 'alloy',
  es: 'shimmer',
};

async function generateOpenAITTS(text: string, voice: string, model: string = 'tts-1'): Promise<Buffer | null> {
  if (!openai) {
    return null;
  }

  try {
    const response = await openai.audio.speech.create({
      model,
      voice: voice as any,
      input: text,
      response_format: 'wav',
    });

    const buffer = Buffer.from(await response.arrayBuffer());
    return buffer;
  } catch (err) {
    console.error('[TTS] OpenAI error:', err);
    return null;
  }
}

async function generateMacOSTTS(text: string, voice: string, rate: number): Promise<Buffer | null> {
  if (process.platform !== 'darwin') {
    return null;
  }

  const cacheKey = hashText(text, voice, rate, 'say');
  const wavPath = join(CACHE_DIR, `${cacheKey}.wav`);
  const aiffPath = join(CACHE_DIR, `${cacheKey}.aiff`);

  if (existsSync(wavPath)) {
    try {
      const stats = statSync(wavPath);
      if (stats.size > 0) {
        return readFileSync(wavPath);
      }
    } catch (e) {}
  }

  const sayArgs: string[] = [];
  if (voice && voice !== 'default') {
    sayArgs.push('-v', voice);
  }
  sayArgs.push('-r', String(Math.round(200 * rate)));
  sayArgs.push('-o', aiffPath);
  sayArgs.push(text);

  const sayResult = await new Promise<boolean>((resolve) => {
    const proc = spawn('say', sayArgs);
    let stderr = '';
    proc.stderr.on('data', d => { stderr += d.toString(); });
    proc.on('error', () => resolve(false));
    proc.on('close', (code) => {
      if (code !== 0) {
        console.error('[TTS] say failed:', stderr);
        resolve(false);
        return;
      }
      resolve(true);
    });
  });

  if (!sayResult) {
    return null;
  }

  const convertResult = await new Promise<boolean>((resolve) => {
    const proc = spawn('afconvert', ['-f', 'WAVE', '-d', 'LEI16@44100', aiffPath, wavPath]);
    let stderr = '';
    proc.stderr.on('data', d => { stderr += d.toString(); });
    proc.on('error', (err) => {
      console.error('[TTS] afconvert error:', err.message);
      resolve(false);
    });
    proc.on('close', (code) => {
      if (code !== 0) {
        console.error('[TTS] afconvert failed:', stderr);
        resolve(false);
        return;
      }
      resolve(true);
    });
  });

  try { unlinkSync(aiffPath); } catch (e) {}

  if (!convertResult) {
    return null;
  }

  try {
    const buffer = readFileSync(wavPath);
    return buffer;
  } catch (e) {
    console.error('[TTS] read error:', e);
    return null;
  }
}

router.post('/', async (req, res) => {
  try {
    const { text, voice, rate = 0.9, lang = 'en' } = req.body || {};
    
    if (!text || typeof text !== 'string') {
      return res.status(400).json({ error: 'text required' });
    }

    if (text.length > 500) {
      return res.status(400).json({ error: 'text too long' });
    }

    const openaiVoice = voice || VOICE_BY_LANG[lang] || 'alloy';
    const model = 'tts-1';

    const cacheKey = hashText(text, openaiVoice, rate, model);
    const cachePath = join(CACHE_DIR, `${cacheKey}.wav`);

    if (existsSync(cachePath)) {
      try {
        const stats = statSync(cachePath);
        if (stats.size > 0) {
          const cached = readFileSync(cachePath);
          res.set({
            'Content-Type': 'audio/wav',
            'Content-Length': String(cached.length),
            'Cache-Control': 'public, max-age=86400',
            'Accept-Ranges': 'bytes',
          });
          return res.send(cached);
        }
      } catch (e) {}
    }

    let audioBuffer = await generateOpenAITTS(text, openaiVoice, model);
    let ttsSource = 'openai';

    if (!audioBuffer) {
      console.log('[TTS] OpenAI failed, falling back to macOS say');
      const fallbackVoice = lang === 'ja' ? 'Kyoko' : lang === 'es' ? 'Mónica' : 'Samantha';
      audioBuffer = await generateMacOSTTS(text, fallbackVoice, rate);
      ttsSource = 'say';
    }

    if (!audioBuffer) {
      return res.status(503).json({ 
        error: 'TTS unavailable',
        message: 'Both OpenAI TTS and macOS TTS failed. Use browser SpeechSynthesis instead.'
      });
    }

    try {
      writeFileSync(cachePath, audioBuffer);
    } catch (e) {}

    res.set({
      'Content-Type': 'audio/wav',
      'Content-Length': String(audioBuffer.length),
      'Cache-Control': 'public, max-age=86400',
      'Accept-Ranges': 'bytes',
      'X-TTS-Source': ttsSource,
    });
    res.send(audioBuffer);
  } catch (err) {
    console.error('[TTS] route error:', err);
    res.status(500).json({ error: 'Internal error' });
  }
});

router.get('/voices', (req, res) => {
  if (process.platform !== 'darwin') {
    res.json({ voices: [], message: 'Only available on macOS' });
    return;
  }
  
  const proc = spawn('say', ['-v', '?']);
  let stdout = '';
  proc.stdout.on('data', d => { stdout += d.toString(); });
  proc.on('close', () => {
    const voices = stdout
      .split('\n')
      .filter(Boolean)
      .map(line => {
        const match = line.match(/^(\S+)\s+/);
        return match ? match[1] : null;
      })
      .filter(Boolean);
    res.json({ voices });
  });
});

export default router;