import { Injectable } from '@angular/core';
import { TauriService } from '../../../core/tauri/tauri.service';

export interface GoogleLoginResult {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  email: string;
}

export interface GoogleRefreshResult {
  accessToken: string;
  expiresIn: number;
}

interface RustGoogleTokens {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  email: string;
}

interface RustRefreshedTokens {
  access_token: string;
  expires_in: number;
}

/**
 * Bridges Angular to the Rust-side Google OAuth 2.0 loopback flow.
 * The Tauri command opens the system browser, runs a local HTTP listener,
 * exchanges the auth code with PKCE, and returns tokens.
 */
@Injectable({
  providedIn: 'root',
})
export class GoogleOAuthService {
  constructor(private tauri: TauriService) {}

  public isAvailable(): boolean {
    return this.tauri.isTauriAvailable();
  }

  public async login(): Promise<GoogleLoginResult> {
    if (!this.tauri.isTauriAvailable()) {
      throw new Error('Google sign-in requires the desktop app.');
    }
    const raw = await this.tauri.invokeCommand<RustGoogleTokens>('google_oauth_login');
    return {
      accessToken: raw.access_token,
      refreshToken: raw.refresh_token,
      expiresIn: raw.expires_in,
      email: raw.email,
    };
  }

  public async refresh(refreshToken: string): Promise<GoogleRefreshResult> {
    if (!this.tauri.isTauriAvailable()) {
      throw new Error('Token refresh requires the desktop app.');
    }
    const raw = await this.tauri.invokeCommand<RustRefreshedTokens>(
      'google_oauth_refresh',
      { refreshToken }
    );
    return {
      accessToken: raw.access_token,
      expiresIn: raw.expires_in,
    };
  }
}
