// YouTube IFrame Player API wrapper.
//
// We use the official IFrame API rather than embedding a raw iframe because
// the API gives us imperative play / pause / seekTo / getCurrentTime calls
// that work with YouTube's own CORS / postMessage plumbing. We never host
// the video ourselves — YouTube serves it from their CDN; we just attach
// our UI on top.
//
// This is a singleton because the IFrame API script can only be loaded once
// per page, and we want a single source of truth for time updates. Multiple
// <VideoPlayer> instances on the same page will share the singleton's time
// polling loop, but only one YT.Player is ever active at a time.

declare global {
  interface Window {
    YT?: YTNS;
    onYouTubeIframeAPIReady?: () => void;
  }
}

// Minimal type surface for what we actually call. The full IFrame Player API
// has hundreds of methods; we only use a handful.
export interface YTPlayer {
  playVideo: () => void;
  pauseVideo: () => void;
  seekTo: (seconds: number, allowSeekAhead: boolean) => void;
  getCurrentTime: () => number;
  getDuration: () => number;
  getPlayerState: () => number;
  destroy: () => void;
  loadVideoById: (videoId: string) => void;
}

export interface YTNS {
  Player: new (
    target: HTMLElement | string,
    options: YTPlayerOptions,
  ) => YTPlayer;
  PlayerState: {
    UNSTARTED: number;
    ENDED: number;
    PLAYING: number;
    PAUSED: number;
    BUFFERING: number;
    CUED: number;
  };
}

interface YTPlayerOptions {
  videoId?: string;
  width?: number | string;
  height?: number | string;
  playerVars?: Record<string, number | string>;
  events?: {
    onReady?: (event: { target: YTPlayer }) => void;
    onStateChange?: (event: { data: number; target: YTPlayer }) => void;
    onError?: (event: { data: number }) => void;
  };
}

const POLL_INTERVAL_MS = 250;

class YouTubePlayerService {
  private player: YTPlayer | null = null;
  private container: HTMLElement | null = null;
  private pollHandle: number | null = null;
  private timeListeners = new Set<(seconds: number) => void>();
  private stateListeners = new Set<(isPlaying: boolean) => void>();
  private lastEmittedTime = -1;

  /** Initialize the player inside the given container for the given videoId. */
  async load(container: HTMLElement, videoId: string): Promise<void> {
    this.destroy();

    this.container = container;
    this.container.innerHTML = '<div id="yt-player-mount"></div>';

    await this.ensureApiLoaded();
    if (!window.YT) throw new Error('YouTube IFrame API not available');

    const mount = this.container.querySelector('#yt-player-mount');
    if (!mount) throw new Error('YT player mount not found');

    return new Promise((resolve, reject) => {
      try {
        this.player = new window.YT!.Player(mount as HTMLElement, {
          videoId,
          playerVars: {
            enablejsapi: 1,
            playsinline: 1,
            rel: 0,
            modestbranding: 1,
            origin: window.location.origin,
          },
          events: {
            onReady: () => {
              this.startPolling();
              resolve();
            },
            onError: (e: { data: number }) => reject(new Error(`YouTube player error ${e.data}`)),
            onStateChange: (e: { data: number; target: YTPlayer }) => {
              const isPlaying = e.data === window.YT!.PlayerState.PLAYING;
              this.stateListeners.forEach((cb) => cb(isPlaying));
            },
          },
        });
      } catch (e) {
        reject(e);
      }
    });
  }

  /** Imperative controls. Safe to call before load (no-op). */
  play(): void {
    try { this.player?.playVideo(); } catch { /* ignore */ }
  }

  pause(): void {
    try { this.player?.pauseVideo(); } catch { /* ignore */ }
  }

  seekTo(seconds: number): void {
    try { this.player?.seekTo(seconds, true); } catch { /* ignore */ }
  }

  getCurrentTime(): number {
    try { return this.player?.getCurrentTime() ?? 0; } catch { return 0; }
  }

  getDuration(): number {
    try { return this.player?.getDuration() ?? 0; } catch { return 0; }
  }

  onTimeUpdate(callback: (seconds: number) => void): () => void {
    this.timeListeners.add(callback);
    return () => this.timeListeners.delete(callback);
  }

  onPlayStateChange(callback: (isPlaying: boolean) => void): () => void {
    this.stateListeners.add(callback);
    return () => this.stateListeners.delete(callback);
  }

  destroy(): void {
    this.stopPolling();
    this.timeListeners.clear();
    this.stateListeners.clear();
    if (this.player) {
      try { this.player.destroy(); } catch { /* ignore */ }
      this.player = null;
    }
    if (this.container) {
      this.container.innerHTML = '';
      this.container = null;
    }
    this.lastEmittedTime = -1;
  }

  private startPolling(): void {
    if (this.pollHandle !== null) return;
    this.pollHandle = window.setInterval(() => {
      const time = this.getCurrentTime();
      if (Math.abs(time - this.lastEmittedTime) > 0.05) {
        this.lastEmittedTime = time;
        this.timeListeners.forEach((cb) => cb(time));
      }
    }, POLL_INTERVAL_MS);
  }

  private stopPolling(): void {
    if (this.pollHandle !== null) {
      clearInterval(this.pollHandle);
      this.pollHandle = null;
    }
  }

  private ensureApiLoaded(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (window.YT?.Player) {
        resolve();
        return;
      }

      let settled = false;
      const previousReady = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        previousReady?.();
        if (!settled) {
          settled = true;
          resolve();
        }
      };

      const existing = document.querySelector<HTMLScriptElement>(
        'script[data-yt-iframe-api]',
      );
      if (!existing) {
        const tag = document.createElement('script');
        tag.src = 'https://www.youtube.com/iframe_api';
        tag.async = true;
        tag.dataset.ytIframeApi = '1';
        tag.onerror = () => {
          if (!settled) {
            settled = true;
            reject(new Error('Failed to load YouTube IFrame API'));
          }
        };
        document.head.appendChild(tag);
      }

      setTimeout(() => {
        if (!settled && window.YT?.Player) {
          settled = true;
          resolve();
        } else if (!settled) {
          settled = true;
          reject(new Error('YouTube IFrame API load timeout'));
        }
      }, 10000);
    });
  }
}

export const youtubePlayer = new YouTubePlayerService();
