type TimeUpdateCallback = (time: number) => void;
type StateChangeCallback = (isPlaying: boolean) => void;

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: () => void;
  }
}

class YouTubePlayerService {
  private player: any = null;
  private timeUpdateCallbacks: Set<TimeUpdateCallback> = new Set();
  private stateChangeCallbacks: Set<StateChangeCallback> = new Set();
  private pollInterval: number | null = null;
  private lastKnownTime = 0;
  private apiReady = false;
  private pendingInit: { iframe: HTMLIFrameElement; videoId: string; resolve: () => void; reject: (e: Error) => void } | null = null;

  loadPlayer(iframe: HTMLIFrameElement, videoId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (typeof window.YT !== 'undefined' && window.YT.Player) {
        this.initPlayer(iframe, videoId).then(resolve).catch(reject);
      } else {
        window.onYouTubeIframeAPIReady = () => {
          this.apiReady = true;
          if (this.pendingInit) {
            const { iframe, videoId, resolve, reject } = this.pendingInit;
            this.pendingInit = null;
            this.initPlayer(iframe, videoId).then(resolve).catch(reject);
          }
        };

        const tag = document.createElement('script');
        tag.src = 'https://www.youtube.com/iframe_api';
        tag.onerror = () => reject(new Error('Failed to load YouTube API'));
        document.head.appendChild(tag);

        setTimeout(() => {
          if (typeof window.YT === 'undefined' || !window.YT.Player) {
            reject(new Error('YouTube API timeout'));
          }
        }, 10000);
      }
    });
  }

  private initPlayer(iframe: HTMLIFrameElement, videoId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.player = new window.YT.Player(iframe, {
          videoId,
          events: {
            onReady: () => resolve(),
            onError: (e: any) => reject(new Error(e))
          },
          playerVars: {
            enablejsapi: 1,
            controls: 1,
            rel: 0
          }
        });
      } catch (e) {
        reject(e);
      }
    });
  }

  private startPolling(): void {
    if (this.pollInterval) return;
    this.pollInterval = window.setInterval(() => {
      if (this.player && typeof this.player.getCurrentTime === 'function') {
        try {
          const time = this.player.getCurrentTime();
          if (time !== this.lastKnownTime) {
            this.lastKnownTime = time;
            this.timeUpdateCallbacks.forEach(cb => cb(time));
          }
        } catch {}
      }
    }, 250);
  }

  private stopPolling(): void {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
  }

  play(): void {
    this.player?.playVideo();
  }

  pause(): void {
    this.player?.pauseVideo();
  }

  seekTo(seconds: number): void {
    this.player?.seekTo(seconds, true);
  }

  getCurrentTime(): number {
    return this.lastKnownTime;
  }

  onTimeUpdate(callback: TimeUpdateCallback): () => void {
    this.timeUpdateCallbacks.add(callback);
    return () => this.timeUpdateCallbacks.delete(callback);
  }

  onStateChange(callback: StateChangeCallback): () => void {
    this.stateChangeCallbacks.add(callback);
    return () => this.stateChangeCallbacks.delete(callback);
  }

  destroy(): void {
    this.stopPolling();
    this.timeUpdateCallbacks.clear();
    this.stateChangeCallbacks.clear();
    if (this.player && typeof this.player.destroy === 'function') {
      this.player.destroy();
    }
    this.player = null;
  }
}

export const youtubePlayer = new YouTubePlayerService();