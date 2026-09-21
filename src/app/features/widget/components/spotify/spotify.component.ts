import { Component, ElementRef, ViewChild, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SpotifyService, SpotifyTrack, SpotifyPlaylist } from './spotify.service';

@Component({
  selector: 'app-spotify',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="relative flex h-full flex-col font-sans select-none">
      <!-- ==========================================
           CASE 1: NOT CONNECTED (FULL-HEIGHT SIGN-IN CARD)
           ========================================== -->
      <div
        *ngIf="!spotify.isConnected()"
        class="relative flex h-full flex-1 flex-col justify-between overflow-hidden rounded-xl border border-neutral-800 bg-neutral-900/90 p-4"
      >
        <!-- Ambient Green Glow -->
        <div
          class="pointer-events-none absolute -top-10 -right-10 h-32 w-32 rounded-full bg-[#1DB954]/15 blur-2xl"
        ></div>
        <div
          class="pointer-events-none absolute -bottom-10 -left-10 h-32 w-32 rounded-full bg-[#1DB954]/10 blur-2xl"
        ></div>

        <!-- Card Header -->
        <div class="relative z-10 flex items-center justify-between">
          <div class="flex items-center space-x-2">
            <div
              class="flex h-5 w-5 items-center justify-center rounded-md border border-[#1DB954]/30 bg-[#1DB954]/10 text-[#1DB954]"
            >
              <svg class="h-3 w-3" viewBox="0 0 24 24" fill="currentColor">
                <path
                  d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"
                />
              </svg>
            </div>
            <span class="font-mono text-[12px] font-bold tracking-wider text-neutral-100 uppercase">
              Spotify
            </span>
          </div>

          <span
            class="rounded-full border border-neutral-800 bg-neutral-950/80 px-2 py-0.5 font-mono text-[9px] text-neutral-400"
          >
            Disconnected
          </span>
        </div>

        <!-- Center Hero Content -->
        <div class="relative z-10 my-auto flex flex-col items-center px-2 py-4 text-center">
          <div
            class="flex h-14 w-14 items-center justify-center rounded-2xl border border-[#1DB954]/30 bg-[#1DB954]/10 text-[#1DB954] shadow-lg shadow-[#1DB954]/10"
          >
            <svg class="h-7 w-7" viewBox="0 0 24 24" fill="currentColor">
              <path
                d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"
              />
            </svg>
          </div>

          <div class="mt-3 text-sm font-semibold text-white">Connect to Spotify</div>
          <p class="mt-1 max-w-[220px] text-[11px] leading-relaxed text-neutral-400">
            Control your playback, browse playlists, and manage volume directly from Bilet.
          </p>

          <!-- Sign In Button / Loading State -->
          <div class="mt-4 w-full max-w-[220px]">
            <button
              *ngIf="!spotify.isConnecting()"
              (click)="onConnectOAuth()"
              type="button"
              class="flex w-full items-center justify-center space-x-2 rounded-xl bg-[#1DB954] px-4 py-2.5 font-mono text-[11px] font-bold text-black shadow-lg shadow-[#1DB954]/20 transition hover:bg-[#1ed760] active:scale-95"
            >
              <svg class="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="currentColor">
                <path
                  d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"
                />
              </svg>
              <span>Sign in with Spotify</span>
            </button>

            <div
              *ngIf="spotify.isConnecting()"
              class="flex w-full items-center justify-center space-x-2 rounded-xl bg-neutral-800 px-4 py-2.5 font-mono text-[11px] font-medium text-neutral-300"
            >
              <svg
                class="h-3.5 w-3.5 animate-spin text-[#1DB954]"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2.5"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path d="M21 12a9 9 0 1 1-6.219-8.56" />
              </svg>
              <span>Signing in...</span>
            </div>
          </div>

          <!-- Error message banner -->
          <div
            *ngIf="spotify.errorMessage()"
            class="mt-3 w-full max-w-[240px] rounded-lg border border-red-500/30 bg-red-500/10 p-2 text-center text-[10px] leading-tight text-red-300"
          >
            {{ spotify.errorMessage() }}
          </div>
        </div>

        <!-- Bottom Info -->
        <div
          class="relative z-10 border-t border-neutral-800/60 pt-2 text-center font-mono text-[9px] text-neutral-500"
        >
          Requires Spotify Premium or active player session
        </div>
      </div>

      <!-- ==========================================
           CASE 2: CONNECTED (PLAYER CARD + PLAYLISTS)
           ========================================== -->
      <div *ngIf="spotify.isConnected()" class="flex h-full flex-col space-y-2.5">
        <!-- 1. MAIN SPOTIFY PLAYER CARD -->
        <div
          class="relative shrink-0 overflow-hidden rounded-xl border border-neutral-800 bg-neutral-900/90 p-3"
        >
          <!-- Subtle Ambient Green Glow -->
          <div
            class="pointer-events-none absolute -top-8 -right-8 h-24 w-24 rounded-full bg-[#1DB954]/10 blur-xl"
          ></div>

          <!-- Card Header: Icon + Title + Device / Status Badge -->
          <div class="flex items-center justify-between">
            <div class="flex items-center space-x-2">
              <div
                class="flex h-5 w-5 items-center justify-center rounded-md border border-[#1DB954]/30 bg-[#1DB954]/10 text-[#1DB954]"
              >
                <svg class="h-3 w-3" viewBox="0 0 24 24" fill="currentColor">
                  <path
                    d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"
                  />
                </svg>
              </div>
              <span
                class="font-mono text-[12px] font-bold tracking-wider text-neutral-100 uppercase"
              >
                Spotify
              </span>
            </div>

            <!-- Header Right Actions -->
            <div class="flex items-center space-x-1.5">
              <!-- Active Device Badge -->
              <button
                (click)="showDevicePicker.set(!showDevicePicker())"
                type="button"
                class="flex items-center space-x-1.5 rounded-full border border-neutral-800 bg-black/60 px-2 py-0.5 font-mono text-[9px] text-neutral-300 transition-colors hover:border-neutral-700"
                [title]="
                  spotify.activeDevice()
                    ? 'Active: ' + spotify.activeDevice()!.name
                    : 'Select Spotify Device'
                "
              >
                <span
                  class="h-1.5 w-1.5 rounded-full"
                  [ngClass]="{
                    'animate-pulse bg-[#1DB954]': spotify.isPlaying(),
                    'bg-neutral-500': !spotify.isPlaying(),
                  }"
                ></span>
                <span class="max-w-[85px] truncate">{{
                  spotify.activeDevice() ? spotify.activeDevice()!.name : 'No Device'
                }}</span>
              </button>
            </div>
          </div>

          <!-- Playback Error / Device Warning Banner -->
          <div
            *ngIf="spotify.playbackError()"
            class="mt-2.5 flex items-center justify-between rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-1.5 text-[10px] text-amber-200"
          >
            <div class="flex min-w-0 items-center space-x-1.5 pr-1">
              <span class="shrink-0 text-xs">⚠️</span>
              <span class="truncate">{{ spotify.playbackError() }}</span>
            </div>
            <div class="flex shrink-0 items-center space-x-1">
              <button
                (click)="spotify.openSpotifyApp()"
                type="button"
                class="rounded bg-[#1DB954] px-1.5 py-0.5 font-mono text-[9px] font-bold text-black hover:bg-[#1ed760]"
              >
                Open App
              </button>
              <button
                (click)="spotify.playbackError.set(null)"
                type="button"
                class="px-1 text-neutral-400 hover:text-white"
              >
                ✕
              </button>
            </div>
          </div>

          <!-- STATE B: CONNECTED BUT IDLE -->
          <div
            *ngIf="!spotify.currentTrack()"
            class="mt-2.5 flex flex-col items-center rounded-lg border border-neutral-800/80 bg-neutral-950/60 p-3 text-center"
          >
            <div
              class="flex h-8 w-8 items-center justify-center rounded-full border border-[#1DB954]/30 bg-[#1DB954]/10 text-[#1DB954]"
            >
              <svg class="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                <path
                  d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"
                />
              </svg>
            </div>
            <p class="mt-1.5 text-[11px] font-semibold text-neutral-200">Ready to Play</p>
            <p class="mt-0.5 max-w-[200px] text-[10px] text-neutral-400">
              {{
                spotify.activeDevice()
                  ? 'Active device: ' + spotify.activeDevice()!.name
                  : 'Start playback from Liked Songs or any playlist below'
              }}
            </p>
            <button
              (click)="spotify.playLikedSongs()"
              type="button"
              class="mt-2 flex items-center space-x-1.5 rounded-lg bg-[#1DB954] px-3 py-1 font-mono text-[10px] font-bold text-black transition hover:bg-[#1ed760] active:scale-95"
            >
              <svg class="h-3 w-3" viewBox="0 0 24 24" fill="currentColor">
                <polygon points="5 3 19 12 5 21 5 3" />
              </svg>
              <span>{{
                spotify.likedSongsCount() > 0
                  ? 'Play Liked Songs'
                  : spotify.playlists().length > 0
                    ? 'Play ' + spotify.playlists()[0].name
                    : 'Start Playback'
              }}</span>
            </button>
          </div>

          <!-- STATE C: CONNECTED & TRACK PLAYING -->
          <div *ngIf="spotify.isConnected() && spotify.currentTrack()" class="mt-2.5 space-y-2.5">
            <!-- Track Info Row: Album Art + Title/Artist + Like Button -->
            <div class="flex items-center space-x-2.5">
              <!-- Album Cover Frame -->
              <div
                class="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg border border-neutral-800 bg-neutral-950"
              >
                <img
                  *ngIf="spotify.currentTrack()!.albumArt"
                  [src]="spotify.currentTrack()!.albumArt"
                  [alt]="spotify.currentTrack()!.name"
                  class="h-full w-full object-cover"
                />
                <div
                  *ngIf="!spotify.currentTrack()!.albumArt"
                  class="flex h-full w-full items-center justify-center text-neutral-600"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.5"
                  >
                    <circle cx="12" cy="12" r="10" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                </div>

                <!-- Mini Equalizer Overlay -->
                <div
                  *ngIf="spotify.isPlaying()"
                  class="absolute inset-0 flex items-end justify-center gap-0.5 bg-black/40 p-1 pb-1.5"
                >
                  <div class="animate-wave-1 h-2 w-0.5 rounded-full bg-[#1DB954]"></div>
                  <div class="animate-wave-2 h-3.5 w-0.5 rounded-full bg-[#1DB954]"></div>
                  <div class="animate-wave-3 h-2.5 w-0.5 rounded-full bg-[#1DB954]"></div>
                </div>
              </div>

              <!-- Title & Artist -->
              <div class="min-w-0 flex-1">
                <div
                  class="cursor-pointer truncate text-[12px] font-semibold text-neutral-100 transition hover:text-[#1DB954]"
                  [title]="spotify.currentTrack()!.name"
                >
                  {{ spotify.currentTrack()!.name }}
                </div>
                <div
                  class="truncate text-[10px] text-neutral-400"
                  [title]="spotify.currentTrack()!.artist"
                >
                  {{ spotify.currentTrack()!.artist }}
                </div>
              </div>

              <!-- Like Button -->
              <button
                (click)="spotify.toggleLike()"
                type="button"
                [title]="spotify.currentTrack()!.isLiked ? 'Liked' : 'Like track'"
                class="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-neutral-800 bg-neutral-950 transition active:scale-90"
                [ngClass]="{
                  'border-[#1DB954]/30 text-[#1DB954]': spotify.currentTrack()!.isLiked,
                  'text-neutral-500 hover:text-neutral-300': !spotify.currentTrack()!.isLiked,
                }"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  [attr.fill]="spotify.currentTrack()!.isLiked ? 'currentColor' : 'none'"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <path
                    d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"
                  />
                </svg>
              </button>
            </div>

            <!-- Progress Scrubber -->
            <div class="space-y-1">
              <div
                #progressBar
                (click)="onProgressClick($event)"
                class="group relative h-1 w-full cursor-pointer rounded-full bg-neutral-800 transition-all hover:h-1.5"
              >
                <div
                  class="h-full rounded-full bg-[#1DB954] transition-all"
                  [style.width.%]="spotify.progressPercent()"
                ></div>
              </div>

              <div
                class="flex items-center justify-between font-mono text-[9px] text-neutral-500 tabular-nums"
              >
                <span>{{ spotify.formattedProgress() }}</span>
                <span>{{ spotify.formattedDuration() }}</span>
              </div>
            </div>

            <!-- Playback Controls Deck -->
            <div class="flex items-center justify-center space-x-3 pt-0.5">
              <!-- Shuffle -->
              <button
                (click)="spotify.toggleShuffle()"
                type="button"
                title="Shuffle"
                class="flex h-6 w-6 items-center justify-center rounded-md border border-neutral-800 bg-neutral-950 text-neutral-400 transition hover:text-neutral-200"
                [ngClass]="{ 'border-[#1DB954]/40 text-[#1DB954]': spotify.shuffleState() }"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="11"
                  height="11"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <path d="M2 18h1.4c1.3 0 2.5-.6 3.3-1.7l6.1-8.6c.7-1.1 2-1.7 3.3-1.7H22" />
                  <path d="m18 2 4 4-4 4" />
                  <path d="M2 6h1.9c1.5 0 2.9.9 3.6 2.2" />
                  <path d="M22 18h-5.9c-1.3 0-2.6-.7-3.3-1.8l-.5-.8" />
                  <path d="m18 14 4 4-4 4" />
                </svg>
              </button>

              <!-- Previous -->
              <button
                (click)="spotify.previousTrack()"
                type="button"
                title="Previous"
                class="flex h-7 w-7 items-center justify-center rounded-md border border-neutral-800 bg-neutral-950 text-neutral-300 transition hover:text-white active:scale-95"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="13"
                  height="13"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M6 6h2v12H6zm3.5 6 8.5 6V6z" />
                </svg>
              </button>

              <!-- Play / Pause Main Button -->
              <button
                (click)="spotify.togglePlay()"
                type="button"
                [title]="spotify.isPlaying() ? 'Pause' : 'Play'"
                class="flex h-8 w-8 items-center justify-center rounded-full bg-[#1DB954] text-black shadow-md shadow-[#1DB954]/20 transition hover:scale-105 active:scale-95"
              >
                <svg
                  *ngIf="spotify.isPlaying()"
                  xmlns="http://www.w3.org/2000/svg"
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <rect x="6" y="4" width="4" height="16" rx="1" />
                  <rect x="14" y="4" width="4" height="16" rx="1" />
                </svg>

                <svg
                  *ngIf="!spotify.isPlaying()"
                  xmlns="http://www.w3.org/2000/svg"
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  class="ml-0.5"
                >
                  <polygon points="5 3 19 12 5 21 5 3" />
                </svg>
              </button>

              <!-- Next -->
              <button
                (click)="spotify.nextTrack()"
                type="button"
                title="Next"
                class="flex h-7 w-7 items-center justify-center rounded-md border border-neutral-800 bg-neutral-950 text-neutral-300 transition hover:text-white active:scale-95"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="13"
                  height="13"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="m6 18 8.5-6L6 6v12zM16 6v12h2V6h-2z" />
                </svg>
              </button>

              <!-- Repeat -->
              <button
                (click)="spotify.toggleRepeat()"
                type="button"
                title="Repeat"
                class="relative flex h-6 w-6 items-center justify-center rounded-md border border-neutral-800 bg-neutral-950 text-neutral-400 transition hover:text-neutral-200"
                [ngClass]="{
                  'border-[#1DB954]/40 text-[#1DB954]': spotify.repeatState() !== 'off',
                }"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="11"
                  height="11"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <path d="m17 2 4 4-4 4" />
                  <path d="M3 11v-1a4 4 0 0 1 4-4h14" />
                  <path d="m7 22-4-4 4-4" />
                  <path d="M21 13v1a4 4 0 0 1-4 4H3" />
                </svg>
                <span
                  *ngIf="spotify.repeatState() === 'track'"
                  class="absolute -top-1 -right-1 flex h-2.5 w-2.5 items-center justify-center rounded-full bg-[#1DB954] text-[7px] font-bold text-black"
                  >1</span
                >
              </button>
            </div>

            <!-- Volume Slider Strip -->
            <div class="flex items-center justify-between border-t border-neutral-800/60 pt-2">
              <div class="flex flex-1 items-center space-x-2">
                <button
                  (click)="spotify.toggleMute()"
                  type="button"
                  [title]="spotify.isMuted() ? 'Unmute' : 'Mute'"
                  class="text-neutral-400 transition hover:text-neutral-200"
                >
                  <svg
                    *ngIf="spotify.isMuted() || spotify.volumePercent() === 0"
                    xmlns="http://www.w3.org/2000/svg"
                    width="11"
                    height="11"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  >
                    <line x1="2" x2="22" y1="2" y2="22" />
                    <path d="M18.89 13.23A7.12 7.12 0 0 0 19 12a7 7 0 0 0-7-7" />
                    <path d="M6 9H2v6h4l5 5V4L6 9z" />
                  </svg>
                  <svg
                    *ngIf="!spotify.isMuted() && spotify.volumePercent() > 0"
                    xmlns="http://www.w3.org/2000/svg"
                    width="11"
                    height="11"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  >
                    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                    <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                  </svg>
                </button>
                <input
                  type="range"
                  min="0"
                  max="100"
                  [ngModel]="spotify.isMuted() ? 0 : spotify.volumePercent()"
                  (ngModelChange)="spotify.setVolume($event)"
                  class="h-1 w-20 cursor-pointer appearance-none rounded-full bg-neutral-800 accent-[#1DB954]"
                />
              </div>

              <span class="font-mono text-[9px] text-neutral-500 tabular-nums">{{
                spotify.isMuted() ? '0%' : spotify.volumePercent() + '%'
              }}</span>
            </div>
          </div>
        </div>

        <!-- 2. QUICK PLAYLISTS & MIXES LIST (Scrollable Section) -->
        <div class="flex-1 space-y-1.5 overflow-y-auto pr-0.5">
          <!-- Segmented Tab Header -->
          <div class="flex items-center justify-between px-0.5 pt-0.5">
            <div
              class="flex items-center space-x-1 rounded-lg border border-neutral-800 bg-black/40 p-0.5"
            >
              <button
                (click)="libraryTab.set('tracks')"
                type="button"
                class="rounded-md px-2 py-0.5 font-mono text-[9px] font-semibold transition"
                [ngClass]="{
                  'bg-neutral-800 text-neutral-100 shadow-sm': libraryTab() === 'tracks',
                  'text-neutral-500 hover:text-neutral-300': libraryTab() !== 'tracks',
                }"
              >
                Songs ({{ spotify.recentTracks().length }})
              </button>
              <button
                (click)="libraryTab.set('playlists')"
                type="button"
                class="rounded-md px-2 py-0.5 font-mono text-[9px] font-semibold transition"
                [ngClass]="{
                  'bg-neutral-800 text-neutral-100 shadow-sm': libraryTab() === 'playlists',
                  'text-neutral-500 hover:text-neutral-300': libraryTab() !== 'playlists',
                }"
              >
                Playlists ({{ spotify.playlists().length }})
              </button>
            </div>

            <div class="flex items-center space-x-2">
              <button
                (click)="spotify.fetchUserPlaylists()"
                [disabled]="spotify.isLoadingPlaylists()"
                type="button"
                class="flex items-center space-x-1 font-mono text-[9px] text-neutral-500 transition hover:text-[#1DB954] disabled:opacity-50"
              >
                <svg
                  *ngIf="spotify.isLoadingPlaylists()"
                  class="h-2.5 w-2.5 animate-spin text-[#1DB954]"
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2.5"
                >
                  <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                </svg>
                <span>{{ spotify.isLoadingPlaylists() ? 'Syncing...' : 'Refresh' }}</span>
              </button>
              <button
                (click)="spotify.disconnect()"
                type="button"
                class="font-mono text-[9px] text-red-400/70 transition hover:text-red-400"
              >
                Disconnect
              </button>
            </div>
          </div>

          <!-- TAB 1: RECENT / TOP SONGS LIST -->
          <ng-container *ngIf="libraryTab() === 'tracks'">
            <div
              *ngIf="spotify.recentTracks().length === 0"
              class="rounded-xl border border-neutral-800/70 bg-neutral-900/40 p-3 text-center text-[11px] text-neutral-500"
            >
              No songs loaded yet. Click Refresh to sync.
            </div>

            <div
              *ngFor="let tr of spotify.recentTracks()"
              class="group flex items-center justify-between rounded-xl border border-neutral-800/70 bg-neutral-900/40 p-2 transition hover:border-[#1DB954]/40 hover:bg-neutral-900/80"
            >
              <div class="flex min-w-0 items-center space-x-2.5">
                <img
                  *ngIf="tr.albumArt"
                  [src]="tr.albumArt"
                  class="h-8 w-8 shrink-0 rounded-md border border-neutral-800 object-cover"
                />
                <div
                  *ngIf="!tr.albumArt"
                  class="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-neutral-800 bg-neutral-950 text-neutral-500"
                >
                  <svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor">
                    <path
                      d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"
                    />
                  </svg>
                </div>
                <div class="min-w-0">
                  <p
                    class="truncate text-[11px] font-semibold text-neutral-200 group-hover:text-white"
                    [title]="tr.name"
                  >
                    {{ tr.name }}
                  </p>
                  <p class="truncate font-mono text-[9px] text-neutral-400" [title]="tr.artist">
                    {{ tr.artist }}
                  </p>
                </div>
              </div>

              <button
                (click)="spotify.playTrack(tr)"
                type="button"
                title="Play track"
                class="flex h-6 w-6 items-center justify-center rounded-md border border-neutral-800 bg-neutral-950 text-neutral-400 transition group-hover:border-[#1DB954]/50 group-hover:bg-[#1DB954]/10 group-hover:text-[#1DB954]"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="10"
                  height="10"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <polygon points="5 3 19 12 5 21 5 3" />
                </svg>
              </button>
            </div>
          </ng-container>

          <!-- TAB 2: PLAYLISTS & LIKED SONGS -->
          <ng-container *ngIf="libraryTab() === 'playlists'">
            <!-- 1. Permanent Liked Songs Item -->
            <div
              class="group flex items-center justify-between rounded-xl border border-neutral-800/70 bg-neutral-900/40 p-2 transition hover:border-[#1DB954]/40 hover:bg-neutral-900/80"
            >
              <div class="flex min-w-0 items-center space-x-2.5">
                <div
                  class="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-gradient-to-br from-[#450af5] via-[#8e8ee5] to-[#c4efd9] text-white shadow-sm"
                >
                  <svg class="h-4 w-4 drop-shadow" viewBox="0 0 24 24" fill="currentColor">
                    <path
                      d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
                    />
                  </svg>
                </div>
                <div class="min-w-0">
                  <p
                    class="truncate text-[11px] font-semibold text-neutral-200 group-hover:text-white"
                  >
                    Liked Songs
                  </p>
                  <p class="font-mono text-[9px] text-[#1DB954]">
                    {{
                      spotify.likedSongsCount() > 0
                        ? spotify.likedSongsCount() + ' songs'
                        : '0 songs (Tap ❤️ on any song)'
                    }}
                  </p>
                </div>
              </div>

              <button
                (click)="spotify.playLikedSongs()"
                type="button"
                title="Play Liked Songs"
                class="flex h-6 w-6 items-center justify-center rounded-md border border-neutral-800 bg-neutral-950 text-neutral-400 transition group-hover:border-[#1DB954]/50 group-hover:bg-[#1DB954]/10 group-hover:text-[#1DB954]"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="10"
                  height="10"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <polygon points="5 3 19 12 5 21 5 3" />
                </svg>
              </button>
            </div>

            <!-- 2. Playlist Rows -->
            <div
              *ngIf="spotify.playlists().length === 0"
              class="rounded-xl border border-neutral-800/70 bg-neutral-900/40 p-3 text-center text-[11px] text-neutral-500"
            >
              No playlists found.
            </div>

            <div
              *ngFor="let pl of spotify.playlists()"
              class="group flex items-center justify-between rounded-xl border border-neutral-800/70 bg-neutral-900/40 p-2 transition hover:border-neutral-700 hover:bg-neutral-900/80"
            >
              <div class="flex min-w-0 items-center space-x-2.5">
                <img
                  *ngIf="pl.coverArt"
                  [src]="pl.coverArt"
                  class="h-8 w-8 shrink-0 rounded-md border border-neutral-800 object-cover"
                />
                <div
                  *ngIf="!pl.coverArt"
                  class="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-neutral-800 bg-neutral-950 text-neutral-500"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="13"
                    height="13"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                  >
                    <path d="M9 18V5l12-2v13" />
                    <circle cx="6" cy="18" r="3" />
                    <circle cx="18" cy="16" r="3" />
                  </svg>
                </div>
                <div class="min-w-0">
                  <p
                    class="truncate text-[11px] font-semibold text-neutral-200 group-hover:text-white"
                  >
                    {{ pl.name }}
                  </p>
                  <p class="font-mono text-[9px] text-neutral-500">{{ pl.trackCount }} tracks</p>
                </div>
              </div>

              <button
                (click)="spotify.playPlaylist(pl)"
                type="button"
                title="Play playlist"
                class="flex h-6 w-6 items-center justify-center rounded-md border border-neutral-800 bg-neutral-950 text-neutral-400 transition group-hover:border-[#1DB954]/50 group-hover:bg-[#1DB954]/10 group-hover:text-[#1DB954]"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="10"
                  height="10"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <polygon points="5 3 19 12 5 21 5 3" />
                </svg>
              </button>
            </div>
          </ng-container>
        </div>
      </div>

      <!-- DEVICE PICKER MODAL -->
      <div
        *ngIf="showDevicePicker()"
        class="absolute inset-x-2 top-10 bottom-2 z-20 flex flex-col justify-between rounded-xl border border-neutral-800 bg-neutral-950/95 p-3 shadow-2xl backdrop-blur-md"
      >
        <div class="space-y-2">
          <div class="flex items-center justify-between border-b border-neutral-800 pb-2">
            <span class="font-mono text-[11px] font-bold tracking-wider text-neutral-100 uppercase"
              >Playback Devices</span
            >
            <button
              (click)="showDevicePicker.set(false)"
              type="button"
              class="text-xs text-neutral-400 hover:text-white"
            >
              ✕
            </button>
          </div>

          <div class="max-h-[160px] space-y-1 overflow-y-auto">
            <div
              *ngIf="spotify.devices().length === 0"
              class="space-y-2 p-3 text-center text-[10px] text-neutral-400"
            >
              <p>No active Spotify playback devices found.</p>
              <button
                (click)="spotify.openSpotifyApp(); showDevicePicker.set(false)"
                type="button"
                class="rounded-lg bg-[#1DB954] px-3 py-1 font-mono text-[10px] font-bold text-black hover:bg-[#1ed760]"
              >
                Launch Spotify App
              </button>
            </div>

            <div
              *ngFor="let dev of spotify.devices()"
              (click)="spotify.selectDevice(dev.id); showDevicePicker.set(false)"
              class="flex cursor-pointer items-center justify-between rounded-lg p-2 text-xs transition"
              [ngClass]="{
                'border border-[#1DB954]/30 bg-[#1DB954]/10 text-[#1DB954]': dev.isActive,
                'border border-neutral-800/60 bg-neutral-900/40 text-neutral-300 hover:border-neutral-700':
                  !dev.isActive,
              }"
            >
              <div class="flex items-center space-x-2">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="13"
                  height="13"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                >
                  <rect width="20" height="14" x="2" y="3" rx="2" />
                  <line x1="8" x2="16" y1="21" y2="21" />
                  <line x1="12" x2="12" y1="17" y2="21" />
                </svg>
                <span class="text-[11px] font-medium">{{ dev.name }}</span>
              </div>
              <span *ngIf="dev.isActive" class="font-mono text-[9px] font-bold text-[#1DB954]"
                >ACTIVE</span
              >
            </div>
          </div>
        </div>

        <button
          (click)="spotify.fetchDevices()"
          type="button"
          class="w-full rounded-lg border border-neutral-800 bg-neutral-900 py-1.5 font-mono text-[10px] text-neutral-400 transition hover:text-neutral-200"
        >
          Refresh Devices
        </button>
      </div>
    </div>
  `,
  styles: [
    `
      @keyframes wave-animation {
        0%,
        100% {
          height: 4px;
        }
        50% {
          height: 14px;
        }
      }
      .animate-wave-1 {
        animation: wave-animation 1.1s ease-in-out infinite;
      }
      .animate-wave-2 {
        animation: wave-animation 0.8s ease-in-out infinite 0.2s;
      }
      .animate-wave-3 {
        animation: wave-animation 1.3s ease-in-out infinite 0.4s;
      }
    `,
  ],
})
export class SpotifyComponent {
  @ViewChild('progressBar') progressBarRef?: ElementRef<HTMLElement>;

  public showDevicePicker = signal<boolean>(false);
  public libraryTab = signal<'tracks' | 'playlists'>('tracks');

  constructor(public spotify: SpotifyService) {}

  public onProgressClick(event: MouseEvent): void {
    if (!this.progressBarRef) return;
    const rect = this.progressBarRef.nativeElement.getBoundingClientRect();
    const clickX = event.clientX - rect.left;
    const width = rect.width;
    if (width > 0) {
      const pct = (clickX / width) * 100;
      this.spotify.seekPercent(pct);
    }
  }

  public async onConnectOAuth(): Promise<void> {
    await this.spotify.loginWithOAuth();
  }
}
