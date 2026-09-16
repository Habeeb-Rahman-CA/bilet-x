# Security Policy

Bilet-X is a local-first desktop widget that talks directly to third-party services on your behalf. We take that responsibility seriously. This document explains how to report a vulnerability, what's in scope, and the known security characteristics of the app so you can make an informed decision before installing it.

---

## Reporting a vulnerability

**Please do not open a public GitHub issue for security reports.** Public disclosure gives attackers a head-start against users who haven't yet updated.

Instead, use one of these private channels:

1. **GitHub Security Advisories** (preferred) — [open a private advisory](../../security/advisories/new) on this repository. This gives us a private thread and a way to issue a coordinated fix.
2. **Email** — send the details to `<security-contact-email>` with the subject line `Bilet-X security report`.

Please include:

- A clear description of the issue and the affected component (frontend, Rust IPC surface, one of the OAuth flows, local storage, …)
- Steps to reproduce, ideally with a minimal PoC
- The app version (`Settings → About` or the version string in `package.json`)
- Your OS and version
- Whether the issue reproduces from a released installer, `npm run tauri:dev`, or both

**What to expect:**

- An acknowledgement within **72 hours**.
- A first assessment (severity, whether we can reproduce, rough timeline) within **7 days**.
- A patched release published to the [Releases page](../../releases) as soon as a fix is ready.
- Optional credit in the release notes (please tell us how you'd like to be named, or if you prefer to stay anonymous).

We ask for **90 days** before public disclosure of an unpatched issue, or coordinated timing with the release if a fix ships sooner.

---

## Supported versions

Only the latest published release receives security fixes. If you're on an older version, please update from the [Releases page](../../releases) before filing a report.

| Version | Supported |
|---|---|
| Latest release | ✅ |
| Any older version | ❌ |

---

## Scope

**In scope:**

- Anything in `src/` (Angular frontend) or `src-tauri/src/` (Rust backend) shipped as part of a Bilet-X release
- OAuth loopback flows for Gmail, Slack, GitHub, Jira, Outlook, and WhatsApp
- The Tauri IPC surface (`#[tauri::command]` functions registered in `src-tauri/src/lib.rs`)
- The local SQLite storage layer (`src-tauri/src/db.rs`)
- The strict CSP and window / webview configuration in `src-tauri/tauri.conf.json`
- The release workflow in `.github/workflows/release.yml`

**Out of scope:**

- Bugs in third-party dependencies — please report those upstream. If a dependency issue is being actively exploited against Bilet-X, that combination is in scope.
- Social-engineering attacks that require a user to install a modified installer from somewhere other than the official Releases page.
- Non-security bugs, feature requests, or crashes without a clear security impact — please open a normal GitHub issue for those.
- Attacks that require an attacker who already has code execution on the user's machine as the same OS user (at that point, all local data — including any password manager or browser session — is game).

---

## Known security characteristics

These are deliberate design choices, not vulnerabilities. Reporting one of these will get a friendly "expected behavior" reply.

### Data stays local

Bilet-X does not run a backend. All notes, tokens, and cached provider data live in a SQLite database inside the app-data directory for your OS user:

- **Windows:** `%APPDATA%\com.bilet.x.app\`
- **macOS:** `~/Library/Application Support/com.bilet.x.app/`
- **Linux:** `~/.local/share/com.bilet.x.app/`

The database is protected by OS-level file permissions only — it is not encrypted at rest. Anyone with access to your user account on the machine can read it. Uninstalling the app does not delete the folder.

### OAuth flows use loopback + PKCE

Every provider uses OAuth 2.0 in the recommended desktop pattern:

- A short-lived HTTP listener on `127.0.0.1` receives the redirect (no custom URI schemes, no `webview://` interceptors).
- The `state` parameter is verified on return to prevent CSRF.
- Where the provider supports it, **PKCE** replaces the client secret (see `src-tauri/src/outlook_oauth.rs` and the PKCE code paths in `google_oauth.rs`).
- Tokens are stored locally through the Tauri persistence layer and can be revoked from **Settings → Connected Services → Disconnect**, which also invalidates them with the provider where the API allows.

### OAuth client credentials are baked into the binary

Providers that require a client secret (Slack, GitHub, Jira, WhatsApp, Google) have their credentials baked into the compiled binary via Rust's `option_env!` macro at build time. **These strings are extractable from a downloaded installer** — this is inherent to native OAuth clients, not a Bilet-X-specific weakness. Consequences:

- An attacker who extracts these can impersonate the Bilet-X app to the provider (impersonation is *not* the same as gaining access to other users' data — they still need each user's authorization).
- We rotate the shipped credentials on any release where we have reason to believe they've been abused, and we scope tokens to the narrowest necessary permissions.

If this trade-off doesn't work for your threat model, build Bilet-X from source with your own provider credentials — see the "First-time setup" section of `CONTRIBUTING.md`.

### Strict Content Security Policy

The Tauri webview enforces a strict CSP (`src-tauri/tauri.conf.json`). Notably:

- `script-src 'self'` — no inline scripts, no remote script sources.
- `connect-src` is limited to `'self'`, Tauri IPC, the local dev server URL, and the specific provider API hosts the webview calls directly (Gmail, Microsoft Graph, GitHub, Atlassian, Facebook Graph).
- `frame-ancestors 'none'`, `object-src 'none'`, `form-action 'none'`.

OAuth flows themselves (authorization code exchange, token refresh) run in Rust `#[tauri::command]` functions so client secrets never touch the webview. Read-only API calls to fetch mail/issues/notifications are made directly from the webview under the CSP allowlist above.

### Signing status

Windows and macOS installers on the Releases page are currently **not code-signed**. You will see a SmartScreen or Gatekeeper warning on first install. This is being tracked and will change in a future release; until then, verify the download by checking the SHA-256 published in the release notes.

---

## Responsible disclosure

Thank you for helping keep Bilet-X and its users safe. Security researchers who report valid issues in good faith will be:

- Credited in release notes (or left anonymous, at your preference).
- Kept in the loop on remediation timing.
- Not pursued legally for good-faith research — accessing your own installation of the app, its local data, or its network traffic is explicitly welcome.

We don't currently run a paid bug-bounty program, but a heartfelt thank-you is guaranteed.
