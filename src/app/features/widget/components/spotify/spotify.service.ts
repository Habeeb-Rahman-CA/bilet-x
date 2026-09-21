import { Injectable, computed, signal } from '@angular/core';
import { PersistenceService } from '../../../../core/tauri/persistence.service';
import { TauriService } from '../../../../core/tauri/tauri.service';
import { WindowService } from '../../../../core/tauri/window.service';

export interface SpotifyTrack {
  id: string;
  name: string;
  artist: string;
  album: string;
  albumArt: string;
  durationMs: number;
  uri?: string;
  isLiked?: boolean;
}

export interface SpotifyDevice {
  id: string;
  name: string;
  type: string;
  isActive: boolean;
  volumePercent: number;
}

export interface SpotifyPlaylist {
  id: string;
  name: string;
  coverArt?: string;
  trackCount: number;
  uri?: string;
}

interface SpotifyOAuthResult {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  user_id: string;
  display_name: string;
  email?: string;
}

interface SpotifyRefreshResult {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
}

@Injectable({ providedIn: 'root' })
export class SpotifyService {
  // Auth state
  public readonly isConnected = signal<boolean>(false);
  public readonly accessToken = signal<string>('');
  public readonly refreshToken = signal<string>('');
  public readonly userName = signal<string>('');
  public readonly userEmail = signal<string>('');
  public readonly tokenExpiresAt = signal<number>(0);
  public readonly isConnecting = signal<boolean>(false);
  public readonly errorMessage = signal<string | null>(null);
  public readonly playbackError = signal<string | null>(null);

  // Playback state
  public readonly isPlaying = signal<boolean>(false);
  public readonly currentTrack = signal<SpotifyTrack | null>(null);
  public readonly progressMs = signal<number>(0);
  public readonly volumePercent = signal<number>(75);
  public readonly isMuted = signal<boolean>(false);
  public readonly shuffleState = signal<boolean>(false);
  public readonly repeatState = signal<'off' | 'context' | 'track'>('off');

  // Devices, Playlists & Liked Songs
  public readonly devices = signal<SpotifyDevice[]>([]);
  public readonly playlists = signal<SpotifyPlaylist[]>([]);
  public readonly likedSongsCount = signal<number>(0);
  public readonly likedSongsTracks = signal<SpotifyTrack[]>([]);
  public readonly recentTracks = signal<SpotifyTrack[]>([]);
  public readonly isLoadingPlaylists = signal<boolean>(false);

  // Computed signals
  public readonly progressPercent = computed(() => {
    const track = this.currentTrack();
    if (!track || !track.durationMs || track.durationMs <= 0) return 0;
    return Math.min(100, Math.max(0, (this.progressMs() / track.durationMs) * 100));
  });

  public readonly formattedProgress = computed(() => {
    return this.formatTime(this.progressMs());
  });

  public readonly formattedDuration = computed(() => {
    const track = this.currentTrack();
    return track ? this.formatTime(track.durationMs) : '0:00';
  });

  public readonly activeDevice = computed(() => {
    return this.devices().find((d) => d.isActive) || this.devices()[0] || null;
  });

  private prevVolume = 75;
  private clockIntervalId: number | null = null;
  private pollIntervalId: number | null = null;
  private lastSyncTime = Date.now();

  constructor(
    private persistence: PersistenceService,
    private tauri: TauriService,
    private windowService: WindowService
  ) {
    this.hydrateFromPersistence();
    this.startProgressClock();
    this.startPolling();
  }

  /**
   * Format milliseconds into MM:SS
   */
  public formatTime(ms: number): string {
    const totalSecs = Math.floor(Math.max(0, ms) / 1000);
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  }

  /**
   * Initiate 1-Click Native Spotify OAuth Login
   */
  public async loginWithOAuth(): Promise<boolean> {
    this.isConnecting.set(true);
    this.errorMessage.set(null);

    try {
      const res = await this.tauri.invokeCommand<SpotifyOAuthResult>('spotify_oauth_login');

      this.accessToken.set(res.access_token);
      if (res.refresh_token) {
        this.refreshToken.set(res.refresh_token);
      }
      this.userName.set(res.display_name || 'Spotify User');
      this.userEmail.set(res.email || '');
      this.tokenExpiresAt.set(Date.now() + (res.expires_in || 3600) * 1000);
      this.isConnected.set(true);

      await this.persistAuth();
      await this.fetchCurrentPlayback();
      await this.fetchDevices();
      await this.fetchUserPlaylists();
      await this.fetchRecentlyPlayed();

      this.isConnecting.set(false);
      return true;
    } catch (err: any) {
      this.isConnecting.set(false);
      const msg = err?.message || String(err);
      this.errorMessage.set(msg);
      console.warn('Spotify OAuth login error:', err);
      return false;
    }
  }

  /**
   * Refresh Spotify Access Token via Rust backend
   */
  public async refreshAccessToken(): Promise<boolean> {
    const refresh = this.refreshToken();
    if (!refresh) return false;

    try {
      const res = await this.tauri.invokeCommand<SpotifyRefreshResult>('spotify_oauth_refresh', {
        refreshToken: refresh,
      });

      this.accessToken.set(res.access_token);
      if (res.refresh_token) {
        this.refreshToken.set(res.refresh_token);
      }
      this.tokenExpiresAt.set(Date.now() + (res.expires_in || 3600) * 1000);
      await this.persistAuth();
      return true;
    } catch (err) {
      console.warn('Failed to refresh Spotify access token:', err);
      return false;
    }
  }

  /**
   * Connect with manual User Access Token
   */
  public async connectWithToken(token: string): Promise<boolean> {
    if (!token.trim()) {
      this.errorMessage.set('Please enter a valid Spotify Access Token');
      return false;
    }

    this.isConnecting.set(true);
    this.errorMessage.set(null);

    try {
      this.accessToken.set(token.trim());
      const response = await fetch('https://api.spotify.com/v1/me', {
        headers: { Authorization: `Bearer ${token.trim()}` },
      });

      if (!response.ok) {
        throw new Error(`Spotify authentication failed (HTTP ${response.status})`);
      }

      const me = await response.json();
      this.userName.set(me.display_name || 'Spotify User');
      this.userEmail.set(me.email || '');
      this.isConnected.set(true);

      await this.persistAuth();
      await this.fetchCurrentPlayback();
      await this.fetchDevices();
      await this.fetchUserPlaylists();
      await this.fetchRecentlyPlayed();

      this.isConnecting.set(false);
      return true;
    } catch (err: any) {
      this.isConnected.set(false);
      this.isConnecting.set(false);
      this.errorMessage.set(err?.message || 'Failed to authenticate with Spotify API');
      return false;
    }
  }

  /**
   * Disconnect / Logout
   */
  public async disconnect(): Promise<void> {
    this.isConnected.set(false);
    this.accessToken.set('');
    this.refreshToken.set('');
    this.userName.set('');
    this.userEmail.set('');
    this.tokenExpiresAt.set(0);
    this.errorMessage.set(null);
    this.isPlaying.set(false);
    this.currentTrack.set(null);
    this.progressMs.set(0);

    await this.persistence.setSetting('spotify_connected', 'false');
    await this.persistence.setSetting('spotify_access_token', '');
    await this.persistence.setSetting('spotify_refresh_token', '');
    await this.persistence.setSetting('spotify_user_name', '');
    await this.persistence.setSetting('spotify_user_email', '');
  }

  /**
   * Helper to format device query parameter
   */
  private getDeviceIdParam(): string {
    const dev = this.activeDevice();
    return dev?.id ? `?device_id=${encodeURIComponent(dev.id)}` : '';
  }

  /**
   * Launch Spotify Desktop app or Web Player
   */
  public openSpotifyApp(): void {
    this.playbackError.set(null);
    this.windowService.openExternalUrl('spotify:');
  }

  public openSpotifyWeb(): void {
    this.playbackError.set(null);
    this.windowService.openExternalUrl('https://open.spotify.com');
  }

  /**
   * Toggle Play / Pause on active Spotify device
   */
  public async togglePlay(): Promise<void> {
    if (!this.isConnected() || !this.accessToken()) return;
    this.playbackError.set(null);

    // If currently idle without active track, start Liked Songs or recent track
    if (!this.isPlaying() && !this.currentTrack()) {
      await this.playLikedSongs();
      return;
    }

    const nextState = !this.isPlaying();
    this.isPlaying.set(nextState);
    this.lastSyncTime = Date.now();

    try {
      const endpoint = nextState ? 'play' : 'pause';
      const devParam = this.getDeviceIdParam();
      const res = await this.spotifyFetch(`/me/player/${endpoint}${devParam}`, { method: 'PUT' });

      if (res.status === 404) {
        // No active device found on Spotify
        await this.fetchDevices();
        const dev = this.activeDevice();
        if (dev?.id) {
          const retryRes = await this.spotifyFetch(
            `/me/player/${endpoint}?device_id=${encodeURIComponent(dev.id)}`,
            {
              method: 'PUT',
            }
          );
          if (!retryRes.ok) {
            const errData = await retryRes.json().catch(() => null);
            if (retryRes.status === 403) {
              this.playbackError.set(
                errData?.error?.message ||
                  'Spotify Premium is required for remote playback control.'
              );
              this.isPlaying.set(false);
            }
          }
        } else {
          this.isPlaying.set(false);
          this.playbackError.set(
            'No active Spotify device found. Open Spotify on your PC or phone.'
          );
        }
      } else if (!res.ok) {
        const errData = await res.json().catch(() => null);
        if (res.status === 403) {
          this.playbackError.set(
            errData?.error?.message || 'Spotify Premium is required for remote playback control.'
          );
          this.isPlaying.set(false);
        }
      }
      setTimeout(() => this.fetchCurrentPlayback(), 400);
    } catch (err: any) {
      console.warn('Spotify play/pause failed:', err);
    }
  }

  /**
   * Skip to Next Track
   */
  public async nextTrack(): Promise<void> {
    if (!this.isConnected() || !this.accessToken()) return;
    this.playbackError.set(null);

    try {
      const devParam = this.getDeviceIdParam();
      const res = await this.spotifyFetch(`/me/player/next${devParam}`, { method: 'POST' });
      if (res.status === 404) {
        await this.fetchDevices();
      } else if (!res.ok) {
        const errData = await res.json().catch(() => null);
        if (res.status === 403) {
          this.playbackError.set(
            errData?.error?.message || 'Spotify Premium is required to skip tracks remotely.'
          );
        }
      }
      setTimeout(() => this.fetchCurrentPlayback(), 400);
    } catch (err: any) {
      console.warn('Spotify next failed:', err);
    }
  }

  /**
   * Skip to Previous Track
   */
  public async previousTrack(): Promise<void> {
    if (!this.isConnected() || !this.accessToken()) return;
    this.playbackError.set(null);

    if (this.progressMs() > 3000) {
      this.seek(0);
      return;
    }

    try {
      const devParam = this.getDeviceIdParam();
      const res = await this.spotifyFetch(`/me/player/previous${devParam}`, { method: 'POST' });
      if (res.status === 404) {
        await this.fetchDevices();
      } else if (!res.ok) {
        const errData = await res.json().catch(() => null);
        if (res.status === 403) {
          this.playbackError.set(
            errData?.error?.message || 'Spotify Premium is required to skip tracks remotely.'
          );
        }
      }
      setTimeout(() => this.fetchCurrentPlayback(), 400);
    } catch (err: any) {
      console.warn('Spotify previous failed:', err);
    }
  }

  /**
   * Seek to specific millisecond position
   */
  public async seek(positionMs: number): Promise<void> {
    const track = this.currentTrack();
    const maxDur = track?.durationMs || 0;
    const clamped = maxDur > 0 ? Math.max(0, Math.min(positionMs, maxDur)) : positionMs;
    this.progressMs.set(clamped);
    this.lastSyncTime = Date.now();

    if (this.isConnected() && this.accessToken()) {
      try {
        const devParam = this.activeDevice()?.id
          ? `&device_id=${encodeURIComponent(this.activeDevice()!.id)}`
          : '';
        await this.spotifyFetch(`/me/player/seek?position_ms=${Math.floor(clamped)}${devParam}`, {
          method: 'PUT',
        });
      } catch (err: any) {
        console.warn('Spotify seek failed:', err);
      }
    }
  }

  /**
   * Seek by percentage (0..100)
   */
  public async seekPercent(percent: number): Promise<void> {
    const track = this.currentTrack();
    if (!track || !track.durationMs) return;
    const ms = (Math.max(0, Math.min(100, percent)) / 100) * track.durationMs;
    await this.seek(ms);
  }

  /**
   * Set Volume percentage (0..100)
   */
  public async setVolume(volume: number): Promise<void> {
    const clamped = Math.max(0, Math.min(100, Math.round(volume)));
    this.volumePercent.set(clamped);
    if (clamped > 0 && this.isMuted()) {
      this.isMuted.set(false);
    }

    if (this.isConnected() && this.accessToken()) {
      try {
        const devParam = this.activeDevice()?.id
          ? `&device_id=${encodeURIComponent(this.activeDevice()!.id)}`
          : '';
        await this.spotifyFetch(`/me/player/volume?volume_percent=${clamped}${devParam}`, {
          method: 'PUT',
        });
      } catch (err: any) {
        console.warn('Spotify volume change failed:', err);
      }
    }
  }

  /**
   * Toggle Mute
   */
  public async toggleMute(): Promise<void> {
    if (this.isMuted()) {
      this.isMuted.set(false);
      await this.setVolume(this.prevVolume || 50);
    } else {
      this.prevVolume = this.volumePercent();
      this.isMuted.set(true);
      await this.setVolume(0);
    }
  }

  /**
   * Toggle Shuffle
   */
  public async toggleShuffle(): Promise<void> {
    const next = !this.shuffleState();
    this.shuffleState.set(next);

    if (this.isConnected() && this.accessToken()) {
      try {
        const devParam = this.activeDevice()?.id
          ? `&device_id=${encodeURIComponent(this.activeDevice()!.id)}`
          : '';
        await this.spotifyFetch(`/me/player/shuffle?state=${next}${devParam}`, { method: 'PUT' });
      } catch (err: any) {
        console.warn('Spotify shuffle toggle failed:', err);
      }
    }
  }

  /**
   * Toggle Repeat (off -> context -> track -> off)
   */
  public async toggleRepeat(): Promise<void> {
    const current = this.repeatState();
    const next = current === 'off' ? 'context' : current === 'context' ? 'track' : 'off';
    this.repeatState.set(next);

    if (this.isConnected() && this.accessToken()) {
      try {
        const devParam = this.activeDevice()?.id
          ? `&device_id=${encodeURIComponent(this.activeDevice()!.id)}`
          : '';
        await this.spotifyFetch(`/me/player/repeat?state=${next}${devParam}`, { method: 'PUT' });
      } catch (err: any) {
        console.warn('Spotify repeat toggle failed:', err);
      }
    }
  }

  /**
   * Toggle Like on Current Track
   */
  public async toggleLike(): Promise<void> {
    const track = this.currentTrack();
    if (!track || !track.id) return;

    const next = !track.isLiked;
    this.currentTrack.set({ ...track, isLiked: next });

    if (this.isConnected() && this.accessToken() && track.id) {
      try {
        const method = next ? 'PUT' : 'DELETE';
        await this.spotifyFetch(`/me/tracks?ids=${track.id}`, { method });
        setTimeout(() => this.fetchLikedSongs(), 500);
      } catch (err: any) {
        console.warn('Spotify like toggle failed:', err);
      }
    }
  }

  /**
   * Play specific track directly
   */
  public async playTrack(track: SpotifyTrack): Promise<void> {
    this.playbackError.set(null);
    this.currentTrack.set(track);
    this.progressMs.set(0);
    this.isPlaying.set(true);
    this.lastSyncTime = Date.now();

    if (this.isConnected() && this.accessToken() && track.uri) {
      try {
        let devParam = this.getDeviceIdParam();
        let res = await this.spotifyFetch(`/me/player/play${devParam}`, {
          method: 'PUT',
          body: JSON.stringify({ uris: [track.uri] }),
        });

        if (res.status === 404) {
          await this.fetchDevices();
          const dev = this.activeDevice();
          if (dev?.id) {
            await this.spotifyFetch(`/me/player/play?device_id=${encodeURIComponent(dev.id)}`, {
              method: 'PUT',
              body: JSON.stringify({ uris: [track.uri] }),
            });
          } else {
            this.isPlaying.set(false);
            this.playbackError.set(
              'No active Spotify device found. Open Spotify app on desktop or phone.'
            );
          }
        }
        setTimeout(() => this.fetchCurrentPlayback(), 400);
      } catch (err: any) {
        console.warn('Spotify play track failed:', err);
      }
    }
  }

  /**
   * Play specific playlist directly
   */
  public async playPlaylist(pl: SpotifyPlaylist): Promise<void> {
    if (!this.isConnected() || !this.accessToken() || !pl.uri) return;
    this.playbackError.set(null);

    try {
      let devParam = this.getDeviceIdParam();
      let res = await this.spotifyFetch(`/me/player/play${devParam}`, {
        method: 'PUT',
        body: JSON.stringify({ context_uri: pl.uri }),
      });

      if (res.status === 404) {
        await this.fetchDevices();
        const dev = this.activeDevice();
        if (dev?.id) {
          await this.spotifyFetch(`/me/player/play?device_id=${encodeURIComponent(dev.id)}`, {
            method: 'PUT',
            body: JSON.stringify({ context_uri: pl.uri }),
          });
        } else {
          this.playbackError.set(
            'No active Spotify device found. Open Spotify app on desktop or phone.'
          );
          return;
        }
      }

      this.isPlaying.set(true);
      setTimeout(() => this.fetchCurrentPlayback(), 500);
    } catch (err: any) {
      console.warn('Spotify play playlist failed:', err);
    }
  }

  /**
   * Select / Transfer playback to a device
   */
  public async selectDevice(deviceId: string): Promise<void> {
    const updated = this.devices().map((d) => ({
      ...d,
      isActive: d.id === deviceId,
    }));
    this.devices.set(updated);
    this.playbackError.set(null);

    if (this.isConnected() && this.accessToken()) {
      try {
        const res = await this.spotifyFetch('/me/player', {
          method: 'PUT',
          body: JSON.stringify({ device_ids: [deviceId], play: true }),
        });
        if (!res.ok) {
          const errData = await res.json().catch(() => null);
          if (res.status === 403) {
            this.playbackError.set(
              errData?.error?.message || 'Spotify Premium is required for remote playback control.'
            );
          }
        }
        setTimeout(() => this.fetchCurrentPlayback(), 500);
      } catch (err: any) {
        console.warn('Spotify device transfer failed:', err);
      }
    }
  }

  /**
   * Fetch current playback state from Spotify Web API
   */
  public async fetchCurrentPlayback(): Promise<void> {
    if (!this.isConnected() || !this.accessToken()) return;

    try {
      const res = await this.spotifyFetch('/me/player');
      if (res.status === 204) {
        // Active device is idle or playback is stopped
        this.isPlaying.set(false);
        return;
      }
      if (!res.ok) return;

      const data = await res.json();
      if (!data || !data.item) {
        this.isPlaying.set(false);
        return;
      }

      const item = data.item;
      const track: SpotifyTrack = {
        id: item.id,
        name: item.name,
        artist: item.artists?.map((a: any) => a.name).join(', ') || 'Unknown Artist',
        album: item.album?.name || '',
        albumArt: item.album?.images?.[0]?.url || item.album?.images?.[1]?.url || '',
        durationMs: item.duration_ms,
        uri: item.uri,
      };

      // Check if track is saved in user library
      if (track.id) {
        this.checkTrackLiked(track.id).then((liked) => {
          if (this.currentTrack()?.id === track.id) {
            this.currentTrack.set({ ...track, isLiked: liked });
          }
        });
      }

      this.currentTrack.set(track);
      this.isPlaying.set(!!data.is_playing);
      this.progressMs.set(data.progress_ms || 0);
      this.shuffleState.set(!!data.shuffle_state);
      this.repeatState.set(data.repeat_state || 'off');
      this.lastSyncTime = Date.now();

      if (data.device) {
        this.volumePercent.set(data.device.volume_percent ?? 75);
      }
    } catch (err: any) {
      console.warn('Spotify fetch playback state error:', err);
    }
  }

  /**
   * Check if a track is liked
   */
  public async checkTrackLiked(trackId: string): Promise<boolean> {
    try {
      const res = await this.spotifyFetch(`/me/tracks/contains?ids=${trackId}`);
      if (!res.ok) return false;
      const array = await res.json();
      return Array.isArray(array) && array[0] === true;
    } catch {
      return false;
    }
  }

  /**
   * Fetch available devices
   */
  public async fetchDevices(): Promise<void> {
    if (!this.isConnected() || !this.accessToken()) return;
    try {
      const res = await this.spotifyFetch('/me/player/devices');
      if (!res.ok) return;
      const data = await res.json();
      if (data && Array.isArray(data.devices)) {
        this.devices.set(
          data.devices.map((d: any) => ({
            id: d.id,
            name: d.name,
            type: d.type,
            isActive: !!d.is_active,
            volumePercent: d.volume_percent ?? 75,
          }))
        );
      }
    } catch (err) {
      console.warn('Spotify fetch devices error:', err);
    }
  }

  /**
   * Fetch user's saved / liked songs
   */
  public async fetchLikedSongs(): Promise<void> {
    if (!this.isConnected() || !this.accessToken()) return;

    try {
      const res = await this.spotifyFetch('/me/tracks?limit=50');
      if (!res.ok) {
        console.warn('Spotify fetch liked songs response not ok:', res.status);
        return;
      }
      const data = await res.json();
      if (data) {
        this.likedSongsCount.set(data.total || 0);
        if (Array.isArray(data.items)) {
          this.likedSongsTracks.set(
            data.items
              .filter((item: any) => item && item.track && item.track.id)
              .map((item: any) => ({
                id: item.track.id,
                name: item.track.name,
                artist: item.track.artists?.map((a: any) => a.name).join(', ') || 'Unknown Artist',
                album: item.track.album?.name || '',
                albumArt:
                  item.track.album?.images?.[0]?.url || item.track.album?.images?.[1]?.url || '',
                durationMs: item.track.duration_ms || 0,
                uri: item.track.uri,
                isLiked: true,
              }))
          );
        }
      }
    } catch (err) {
      console.warn('Spotify fetch liked songs error:', err);
    }
  }

  /**
   * Play user's Liked Songs library (or fallback to top playlist / recent tracks)
   */
  public async playLikedSongs(): Promise<void> {
    if (!this.isConnected() || !this.accessToken()) return;
    this.playbackError.set(null);

    try {
      let uris = this.likedSongsTracks()
        .map((t) => t.uri)
        .filter((u): u is string => !!u);

      if (uris.length === 0) {
        await this.fetchLikedSongs();
        uris = this.likedSongsTracks()
          .map((t) => t.uri)
          .filter((u): u is string => !!u);
      }

      if (uris.length > 0) {
        let devParam = this.getDeviceIdParam();
        let res = await this.spotifyFetch(`/me/player/play${devParam}`, {
          method: 'PUT',
          body: JSON.stringify({ uris }),
        });

        if (res.status === 404) {
          await this.fetchDevices();
          const dev = this.activeDevice();
          if (dev?.id) {
            await this.spotifyFetch(`/me/player/play?device_id=${encodeURIComponent(dev.id)}`, {
              method: 'PUT',
              body: JSON.stringify({ uris }),
            });
          } else {
            this.playbackError.set(
              'No active Spotify device found. Open Spotify on your PC or phone.'
            );
            return;
          }
        }

        this.isPlaying.set(true);
        if (this.likedSongsTracks().length > 0 && !this.currentTrack()) {
          this.currentTrack.set(this.likedSongsTracks()[0]);
        }
        setTimeout(() => this.fetchCurrentPlayback(), 500);
      } else if (this.playlists().length > 0) {
        // Fallback to first playlist if user has no liked songs
        await this.playPlaylist(this.playlists()[0]);
      } else if (this.recentTracks().length > 0) {
        // Fallback to recent track
        await this.playTrack(this.recentTracks()[0]);
      } else {
        this.playbackError.set(
          'Your Liked Songs library is empty. Click the ❤️ icon on any playing song to add it.'
        );
      }
    } catch (err) {
      console.warn('Spotify play liked songs error:', err);
    }
  }

  /**
   * Fetch user playlists & saved library
   */
  public async fetchUserPlaylists(): Promise<void> {
    if (!this.isConnected() || !this.accessToken()) return;
    this.isLoadingPlaylists.set(true);

    try {
      // 1. Sync Liked Songs
      await this.fetchLikedSongs();

      // 2. Sync Recently Played Tracks
      await this.fetchRecentlyPlayed();

      // 3. Fetch User Playlists
      const res = await this.spotifyFetch('/me/playlists?limit=50');
      if (res.ok) {
        const data = await res.json();
        if (data && Array.isArray(data.items)) {
          const list: SpotifyPlaylist[] = data.items
            .filter((p: any) => p && p.id)
            .map((p: any) => ({
              id: p.id,
              name: p.name || 'Untitled Playlist',
              coverArt: p.images?.[0]?.url || p.images?.[1]?.url || '',
              trackCount: p.tracks?.total || 0,
              uri: p.uri,
            }));
          this.playlists.set(list);
        }
      } else {
        console.warn('Spotify fetch playlists status:', res.status);
      }
    } catch (err) {
      console.warn('Spotify fetch playlists error:', err);
    } finally {
      this.isLoadingPlaylists.set(false);
    }
  }

  /**
   * Fetch recently played tracks (with fallback to top tracks)
   */
  public async fetchRecentlyPlayed(): Promise<void> {
    if (!this.isConnected() || !this.accessToken()) return;
    try {
      const res = await this.spotifyFetch('/me/player/recently-played?limit=20');
      if (res.ok) {
        const data = await res.json();
        if (data && Array.isArray(data.items) && data.items.length > 0) {
          const list: SpotifyTrack[] = data.items
            .filter((item: any) => item && item.track && item.track.id)
            .map((item: any) => ({
              id: item.track.id,
              name: item.track.name,
              artist: item.track.artists?.map((a: any) => a.name).join(', ') || 'Unknown Artist',
              album: item.track.album?.name || '',
              albumArt:
                item.track.album?.images?.[0]?.url || item.track.album?.images?.[1]?.url || '',
              durationMs: item.track.duration_ms || 0,
              uri: item.track.uri,
            }));
          this.recentTracks.set(list);
          if (!this.currentTrack() && list.length > 0) {
            this.currentTrack.set(list[0]);
          }
          return;
        }
      }

      // Fallback to top tracks if recently played is empty
      const topRes = await this.spotifyFetch('/me/top/tracks?limit=20');
      if (topRes.ok) {
        const topData = await topRes.json();
        if (topData && Array.isArray(topData.items)) {
          const list: SpotifyTrack[] = topData.items
            .filter((item: any) => item && item.id)
            .map((item: any) => ({
              id: item.id,
              name: item.name,
              artist: item.artists?.map((a: any) => a.name).join(', ') || 'Unknown Artist',
              album: item.album?.name || '',
              albumArt: item.album?.images?.[0]?.url || item.album?.images?.[1]?.url || '',
              durationMs: item.duration_ms || 0,
              uri: item.uri,
            }));
          this.recentTracks.set(list);
          if (!this.currentTrack() && list.length > 0) {
            this.currentTrack.set(list[0]);
          }
        }
      }
    } catch (err) {
      console.warn('Spotify fetch recently played error:', err);
    }
  }

  private async spotifyFetch(endpoint: string, init?: RequestInit): Promise<Response> {
    // Check if token needs refresh
    if (this.tokenExpiresAt() > 0 && Date.now() >= this.tokenExpiresAt() - 60000) {
      await this.refreshAccessToken();
    }

    const url = `https://api.spotify.com/v1${endpoint}`;
    const headers = {
      ...(init?.headers || {}),
      Authorization: `Bearer ${this.accessToken()}`,
      'Content-Type': 'application/json',
    };

    let res = await fetch(url, { ...init, headers });

    if (res.status === 401) {
      // Try refresh once
      const refreshed = await this.refreshAccessToken();
      if (refreshed) {
        const retryHeaders = {
          ...(init?.headers || {}),
          Authorization: `Bearer ${this.accessToken()}`,
          'Content-Type': 'application/json',
        };
        res = await fetch(url, { ...init, headers: retryHeaders });
      } else {
        this.errorMessage.set('Spotify session expired. Please re-authenticate.');
      }
    }
    return res;
  }

  /**
   * Interpolate progress clock smoothly every 250ms when playing
   */
  private startProgressClock(): void {
    this.clockIntervalId = window.setInterval(() => {
      if (!this.isPlaying()) return;

      const track = this.currentTrack();
      if (!track || !track.durationMs) return;

      const now = Date.now();
      const elapsed = now - this.lastSyncTime;
      this.lastSyncTime = now;

      const nextMs = this.progressMs() + elapsed;
      if (nextMs >= track.durationMs) {
        this.fetchCurrentPlayback();
      } else {
        this.progressMs.set(nextMs);
      }
    }, 250);
  }

  /**
   * Poll Spotify API every 2.5s for live status updates from external player
   */
  private startPolling(): void {
    this.pollIntervalId = window.setInterval(() => {
      if (this.isConnected() && this.accessToken()) {
        this.fetchCurrentPlayback();
      }
    }, 2500);
  }

  private async persistAuth(): Promise<void> {
    await this.persistence.setSetting('spotify_connected', this.isConnected() ? 'true' : 'false');
    await this.persistence.setSetting('spotify_access_token', this.accessToken());
    await this.persistence.setSetting('spotify_refresh_token', this.refreshToken());
    await this.persistence.setSetting('spotify_user_name', this.userName());
    await this.persistence.setSetting('spotify_user_email', this.userEmail());
    await this.persistence.setSetting('spotify_token_expires_at', this.tokenExpiresAt().toString());
  }

  private hydrateFromPersistence(): void {
    const isConn = this.persistence.getSettingValue('spotify_connected', 'false') === 'true';
    const token = this.persistence.getSettingValue('spotify_access_token', '');
    const refresh = this.persistence.getSettingValue('spotify_refresh_token', '');
    const uName = this.persistence.getSettingValue('spotify_user_name', '');
    const uEmail = this.persistence.getSettingValue('spotify_user_email', '');
    const exp = parseInt(this.persistence.getSettingValue('spotify_token_expires_at', '0'), 10);

    this.isConnected.set(isConn);
    this.accessToken.set(token);
    this.refreshToken.set(refresh);
    this.userName.set(uName);
    this.userEmail.set(uEmail);
    if (!isNaN(exp)) this.tokenExpiresAt.set(exp);

    if (isConn && token) {
      this.fetchCurrentPlayback();
      this.fetchDevices();
      this.fetchUserPlaylists();
      this.fetchRecentlyPlayed();
    }
  }
}
