import { useEffect, useRef, useState } from 'react';
import { youtubePlayer } from '../services/youtubePlayer';

interface VideoPlayerProps {
  videoId: string;
  onReady?: () => void;
  onError?: (error: string) => void;
}

export function VideoPlayer({ videoId, onReady }: VideoPlayerProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (!iframeRef.current) return;

    const timer = setTimeout(() => {
      setIsReady(true);
      onReady?.();
    }, 1000);

    return () => {
      clearTimeout(timer);
      youtubePlayer.destroy();
    };
  }, [videoId]);

  return (
    <div style={{ 
      position: 'relative',
      width: '100%',
      paddingBottom: '56.25%',
      background: '#000'
    }}>
      <iframe
        ref={iframeRef}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%'
        }}
        src={`https://www.youtube.com/embed/${videoId}?enablejsapi=1&playsinline=1&rel=0`}
        frameBorder="0"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
        allowFullScreen
      />
    </div>
  );
}