/**
 * Structured credential blob stored in TokenStorage.
 * Wraps access token with optional refresh token and expiry so integrations
 * can auto-refresh without prompting the user.
 */
export interface StoredCredential {
  accessToken: string;
  refreshToken?: string;
  /** Epoch ms when accessToken expires. Undefined = unknown/never. */
  expiresAt?: number;
}

export function serializeCredential(cred: StoredCredential): string {
  return JSON.stringify(cred);
}

/**
 * Parse a stored credential. Falls back to treating raw strings as bare
 * access tokens so pre-refresh-era connections keep working.
 */
export function parseCredential(raw: string | null): StoredCredential | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.accessToken === 'string') {
      return parsed as StoredCredential;
    }
  } catch {
    // Not JSON — treat as legacy raw token
  }
  return { accessToken: raw };
}

export function isExpiringSoon(cred: StoredCredential, skewMs = 60_000): boolean {
  if (!cred.expiresAt) return false;
  return cred.expiresAt - Date.now() < skewMs;
}
