import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { youtubePlayer } from '../services/youtubePlayer';

export interface VideoPlayerHandle {
  play: () => void;
  pause: () => void;
  seekTo: (seconds: number) => void;
  getCurrentTime: () => number;
}

interface VideoPlayerProps {
  videoId: string;
  onReady?: () => void;
  onError?: (message: string) => void;
  onTimeUpdate?: (seconds: number) => void;
  onPlayStateChange?: (isPlaying: boolean) => void;
}

/**
 * Thin wrapper around the YouTube IFrame Player API. Hosts the embed inside
 * the provided container, and exposes imperative controls + a time-update
 * callback to the parent.
 *
 * The actual video is served by YouTube's CDN via the official embed — we
 * never touch the file ourselves, which sidesteps CORS / DRM / ToS issues
 * that would come from trying to play YouTube content in an HTML5 <video>.
 */
export const VideoPlayer = forwardRef<VideoPlayerHandle, VideoPlayerProps>(
  function VideoPlayer(
    { videoId, onReady, onError, onTimeUpdate, onPlayStateChange },
    ref,
  ) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useImperativeHandle(
      ref,
      () => ({
        play: () => youtubePlayer.play(),
        pause: () => youtubePlayer.pause(),
        seekTo: (s) => youtubePlayer.seekTo(s),
        getCurrentTime: () => youtubePlayer.getCurrentTime(),
      }),
      [],
    );

    useEffect(() => {
      if (!containerRef.current) return;
      let cancelled = false;

      setLoading(true);
      setError(null);

      youtubePlayer
        .load(containerRef.current, videoId)
        .then(() => {
          if (cancelled) return;
          setLoading(false);
          onReady?.();
        })
        .catch((e) => {
          if (cancelled) return;
          const msg = e instanceof Error ? e.message : 'Failed to load video';
          setError(msg);
          setLoading(false);
          onError?.(msg);
        });

      return () => {
        cancelled = true;
        youtubePlayer.destroy();
      };
    }, [videoId, onReady, onError]);

    useEffect(() => {
      if (!onTimeUpdate) return;
      return youtubePlayer.onTimeUpdate(onTimeUpdate);
    }, [onTimeUpdate]);

    useEffect(() => {
      if (!onPlayStateChange) return;
      return youtubePlayer.onPlayStateChange(onPlayStateChange);
    }, [onPlayStateChange]);

    return (
      <div
        style={{
          position: 'relative',
          width: '100%',
          paddingBottom: '56.25%',
          background: '#000',
          borderRadius: 8,
          overflow: 'hidden',
        }}
      >
        <div
          ref={containerRef}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
          }}
        />
        {loading && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'rgba(255,255,255,0.7)',
              fontSize: 14,
              pointerEvents: 'none',
            }}
          >
            Loading video…
          </div>
        )}
        {error && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              fontSize: 14,
              padding: 16,
              textAlign: 'center',
              background: 'rgba(0,0,0,0.85)',
            }}
          >
            {error}
          </div>
        )}
      </div>
    );
  },
);
