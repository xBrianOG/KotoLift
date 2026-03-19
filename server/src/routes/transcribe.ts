import { Router } from 'express';
import { spawn } from 'child_process';
import { createReadStream, unlinkSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { Readable } from 'stream';
import OpenAI from 'openai';

const router = Router();

async function downloadAudio(videoId: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const tmpDir = '/tmp';
    if (!existsSync(tmpDir)) mkdirSync(tmpDir, { recursive: true });
    const outputPath = join(tmpDir, `audio_${videoId}.mp3`);

    const ytdlp = spawn('yt-dlp', [
      '-x',
      '--audio-format', 'mp3',
      '--audio-quality', '0',
      '-o', outputPath,
      `https://www.youtube.com/watch?v=${videoId}`,
      '--no-playlist'
    ]);

    let stderr = '';
    ytdlp.stderr.on('data', (data) => { stderr += data.toString(); });
    ytdlp.on('close', (code) => {
      if (code === 0 && existsSync(outputPath)) {
        resolve(outputPath);
      } else {
        reject(new Error(`yt-dlp failed: ${stderr}`));
      }
    });
    ytdlp.on('error', (err) => reject(err));
  });
}

function msToTimestamp(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const millis = ms % 1000;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(millis).padStart(3, '0')}`;
}

function generateSRT(segments: Array<{ start: number; end: number; text: string }>): string {
  return segments.map((seg, i) => {
    return `${i + 1}\n${msToTimestamp(seg.start)} --> ${msToTimestamp(seg.end)}\n${seg.text}\n`;
  }).join('\n');
}

router.get('/:videoId', async (req, res) => {
  const { videoId } = req.params;
  const lang = (req.query.lang as string) || 'en';

  if (!videoId || !/^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
    return res.status(400).json({ error: 'Invalid video ID' });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'OpenAI API key not configured' });
  }

  let audioPath: string | null = null;
  try {
    console.log(`[Transcribe] Downloading audio for ${videoId}`);
    
    audioPath = await downloadAudio(videoId);
    console.log(`[Transcribe] Audio downloaded, sending to Whisper...`);

    const openai = new OpenAI({ apiKey });
    
    const fileStream = createReadStream(audioPath) as unknown as File;
    
    const whisperResponse = await openai.audio.transcriptions.create({
      file: fileStream,
      model: 'whisper-1',
      language: lang.split('-')[0],
      response_format: 'verbose_json',
      timestamp_granularities: ['segment']
    });

    const segments = (whisperResponse.segments || []).map((seg: any, i: number) => ({
      id: `seg-${i + 1}`,
      startMs: Math.round((seg.start || 0) * 1000),
      endMs: Math.round((seg.end || (seg.start || 0) + 3) * 1000),
      text: (seg.text || '').trim()
    })).filter((s: any) => s.text);

    console.log(`[Transcribe] Got ${segments.length} segments from Whisper`);

    return res.json({
      title: `Video ${videoId}`,
      segments,
      videoId,
      method: 'Whisper AI'
    });
  } catch (e: any) {
    console.error(`[Transcribe] Error:`, e.message);
    return res.status(500).json({ error: e.message || 'Failed to transcribe video' });
  } finally {
    if (audioPath && existsSync(audioPath)) {
      try { unlinkSync(audioPath); } catch { /* ignore */ }
    }
  }
});

export default router;
