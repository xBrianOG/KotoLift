import { useState } from 'react';
import type { TranscriptSegment } from '../services/transcript';

interface SubtitleOverlayProps {
  segments: TranscriptSegment[];
  currentTimeMs: number;
  onSegmentClick: (segment: TranscriptSegment) => void;
  onWordClick: (word: string, segment: TranscriptSegment, e: React.MouseEvent) => void;
}

function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

export function SubtitleOverlay({ segments, currentTimeMs, onSegmentClick, onWordClick }: SubtitleOverlayProps) {
  const [hoveredWord, setHoveredWord] = useState<string | null>(null);

  const activeSegment = segments.find(
    seg => currentTimeMs >= seg.startMs && currentTimeMs < seg.endMs
  );

  if (!activeSegment) {
    return (
      <div style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        background: 'linear-gradient(transparent, rgba(0,0,0,0.9))',
        padding: '40px 20px 20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: 14 }}>
          Loading subtitles...
        </span>
      </div>
    );
  }

  const words = activeSegment.text.split(/\s+/).filter(Boolean);

  return (
    <div style={{
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      background: 'linear-gradient(transparent, rgba(0,0,0,0.95))',
      padding: '40px 20px 20px'
    }}>
      <div style={{ textAlign: 'center', marginBottom: 12 }}>
        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', fontFamily: 'monospace' }}>
          {formatTime(activeSegment.startMs)} - {formatTime(activeSegment.endMs)}
        </span>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '6px 10px', marginBottom: 16 }}>
        {words.map((word, i) => (
          <span
            key={i}
            onClick={(e) => onWordClick(word, activeSegment, e)}
            onMouseEnter={() => setHoveredWord(word)}
            onMouseLeave={() => setHoveredWord(null)}
            style={{
              display: 'inline-block',
              padding: '4px 8px',
              borderRadius: 4,
              cursor: 'pointer',
              background: hoveredWord === word ? 'rgba(255,200,0,0.5)' : 'transparent',
              color: '#fff',
              fontSize: 24,
              fontWeight: 600,
              textShadow: '2px 2px 4px rgba(0,0,0,1)',
              lineHeight: 1.4,
              transition: 'all 0.15s ease',
              fontFamily: 'Georgia, serif'
            }}
          >
            {word}
          </span>
        ))}
      </div>

      <div style={{ display: 'flex', justifyContent: 'center', gap: 12 }}>
        <button
          onClick={() => onSegmentClick(activeSegment)}
          style={{
            padding: '8px 16px',
            background: '#eab308',
            border: 'none',
            borderRadius: 6,
            color: '#000',
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
            boxShadow: '0 2px 8px rgba(0,0,0,0.3)'
          }}
        >
          Full Translation
        </button>
        <button
          onClick={() => {
            const nextIndex = segments.indexOf(activeSegment) + 1;
            if (nextIndex < segments.length) {
              onSegmentClick(segments[nextIndex]);
            }
          }}
          style={{
            padding: '8px 16px',
            background: 'rgba(255,255,255,0.1)',
            border: '1px solid rgba(255,255,255,0.3)',
            borderRadius: 6,
            color: '#fff',
            fontSize: 13,
            fontWeight: 500,
            cursor: 'pointer'
          }}
        >
          Next →
        </button>
      </div>
    </div>
  );
}