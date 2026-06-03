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

  /**
   * Monotonic counter. Each load() increments it; any async operation that
   * was started by a now-superseded load() bails when it sees a fresher
   * counter. This prevents "stale" onReady/onStateChange/onTimeUpdate
   * callbacks from doing work after destroy() or after a new load() started.
   */
  private loadGeneration = 0;
  private currentVideoId: string | null = null;
  private destroyedPlayerId: YTPlayer | null = null;

  /** Initialize the player inside the given container for the given videoId. */
  async load(container: HTMLElement, videoId: string): Promise<void> {
    const myGeneration = ++this.loadGeneration;

    // Fast path: same video already loaded into a live player. Just hand
    // the new container to the existing player by reloading into it.
    if (this.player && this.currentVideoId === videoId && !this.destroyedPlayerId) {
      this.replaceContainer(container);
      return;
    }

    // Slow path: build a fresh player. Tear down the old one cleanly first.
    this.destroy();

    this.container = container;
    this.container.innerHTML = '<div id="yt-player-mount"></div>';
    this.currentVideoId = videoId;

    await this.ensureApiLoaded();
    if (myGeneration !== this.loadGeneration) return; // superseded
    if (!window.YT) throw new Error('YouTube IFrame API not available');

    const mount = this.container.querySelector('#yt-player-mount');
    if (!mount) throw new Error('YT player mount not found');

    return new Promise<void>((resolve, reject) => {
      try {
        const newPlayer = new window.YT!.Player(mount as HTMLElement, {
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
              if (myGeneration !== this.loadGeneration) {
                // A newer load() superseded us while we were constructing.
                // Destroy the player we just created.
                try { newPlayer.destroy(); } catch { /* ignore */ }
                return;
              }
              this.player = newPlayer;
              this.startPolling();
              resolve();
            },
            onError: (e: { data: number }) => {
              if (myGeneration !== this.loadGeneration) return;
              reject(new Error(`YouTube player error ${e.data}`));
            },
            onStateChange: (e: { data: number; target: YTPlayer }) => {
              if (myGeneration !== this.loadGeneration) return;
              if (!window.YT) return;
              const isPlaying = e.data === window.YT.PlayerState.PLAYING;
              this.stateListeners.forEach((cb) => cb(isPlaying));
            },
          },
        });
        // Store immediately so destroy() can clean it up if needed before
        // onReady fires. The onReady callback will overwrite this with the
        // same instance once it fires (no functional change).
        this.player = newPlayer;
      } catch (e) {
        if (myGeneration === this.loadGeneration) reject(e);
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
    if (!this.player) return 0;
    try { return this.player.getCurrentTime(); } catch { return 0; }
  }

  getDuration(): number {
    if (!this.player) return 0;
    try { return this.player.getDuration(); } catch { return 0; }
  }

  onTimeUpdate(callback: (seconds: number) => void): () => void {
    this.timeListeners.add(callback);
    return () => this.timeListeners.delete(callback);
  }

  onPlayStateChange(callback: (isPlaying: boolean) => void): () => void {
    this.stateListeners.add(callback);
    return () => this.stateListeners.delete(callback);
  }

  /**
   * Tear down the current player. Carefully:
   *  1. Bump the generation so any in-flight async work bails.
   *  2. Stop polling first (so getCurrentTime() isn't called on a
   *     mid-destroy player).
   *  3. Call player.destroy() while the iframe is STILL in the DOM. The
   *     YouTube IFrame API logs "signal is aborted without reason" if the
   *     iframe is detached from the DOM before destroy() runs, because
   *     its internal postMessage channel dies. We deliberately leave the
   *     container's innerHTML alone here and let the next load() clear it.
   *  4. Clear the container reference only after destroy() returns.
   */
  destroy(): void {
    this.loadGeneration++;
    this.stopPolling();
    this.timeListeners.clear();
    this.stateListeners.clear();
    if (this.player) {
      const playerToDestroy = this.player;
      this.player = null;
      this.destroyedPlayerId = playerToDestroy;
      try {
        playerToDestroy.destroy();
      } catch {
        /* ignore — destroying a player after a mid-load abort can throw */
      }
    }
    if (this.container) {
      // Defer clearing the DOM until the next microtask so any pending
      // postMessage handlers from the iframe complete first.
      const c = this.container;
      this.container = null;
      queueMicrotask(() => {
        try { c.innerHTML = ''; } catch { /* ignore */ }
      });
    }
    this.lastEmittedTime = -1;
    this.currentVideoId = null;
    this.destroyedPlayerId = null;
  }

  /**
   * Move an existing player to a new container. The IFrame API lets us
   * call loadVideoById() on the same player instance, but it doesn't let
   * us move iframes between containers. The pragmatic approach: if the
   * new container is different from the current one, we tear down and
   * rebuild. The IFrame API script load is cached so this is cheap.
   */
  private replaceContainer(newContainer: HTMLElement): void {
    if (this.container === newContainer) return;
    this.container = newContainer;
  }

  private startPolling(): void {
    if (this.pollHandle !== null) return;
    this.pollHandle = window.setInterval(() => {
      // Defensive: if anything nukes the player between ticks, just bail.
      if (!this.player) return;
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
