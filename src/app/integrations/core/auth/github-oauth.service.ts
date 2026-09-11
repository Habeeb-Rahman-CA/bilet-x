import { Injectable } from '@angular/core';
import { TauriService } from '../../../core/tauri/tauri.service';

export interface GitHubLoginResult {
  accessToken: string;
  login: string;
  email: string;
  name: string;
  avatarUrl: string;
}

interface RustGitHubTokens {
  access_token: string;
  login: string;
  email: string;
  name: string;
  avatar_url: string;
}

/**
 * Bridges Angular to the Rust-side GitHub OAuth 2.0 loopback flow.
 * Rust opens the system browser, runs a local HTTP listener, exchanges
 * the auth code with PKCE, and returns an access token plus basic user
 * profile info (login, email, display name, avatar).
 *
 * GitHub classic OAuth Apps do not issue refresh tokens — access tokens
 * are long-lived until the user revokes them, so there is no refresh().
 */
@Injectable({
  providedIn: 'root',
})
export class GitHubOAuthService {
  constructor(private tauri: TauriService) {}

  public isAvailable(): boolean {
    return this.tauri.isTauriAvailable();
  }

  public async login(): Promise<GitHubLoginResult> {
    if (!this.tauri.isTauriAvailable()) {
      throw new Error('GitHub sign-in requires the desktop app.');
    }
    const raw = await this.tauri.invokeCommand<RustGitHubTokens>('github_oauth_login');
    return {
      accessToken: raw.access_token,
      login: raw.login,
      email: raw.email,
      name: raw.name,
      avatarUrl: raw.avatar_url,
    };
  }
}
