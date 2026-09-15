# Contributing to Bilet-X

Thanks for taking the time to look under the hood. Bilet-X is a personal project first — but issues, ideas, and pull requests are genuinely welcome. This guide covers everything you need to get from a fresh clone to a working development build.

---

## Prerequisites

- **Node.js 20+** (project is pinned to npm 11 via `packageManager`)
- **Rust stable** — install via [rustup](https://rustup.rs/)
- **Platform build tools** — follow the [Tauri v2 prerequisites](https://v2.tauri.app/start/prerequisites/) for your OS (WebView2 on Windows, Xcode CLI tools on macOS, `libwebkit2gtk-4.1-dev` and friends on Linux)

---

## First-time setup

```bash
git clone https://github.com/Habeeb-Rahman-CA/bilet-x.git
cd bilet-x
npm install
```

To run any OAuth integration locally (Gmail, Slack, GitHub, Jira, Outlook, WhatsApp), create a gitignored credentials file at `src-tauri/.cargo/config.toml`:

```toml
[env]
GOOGLE_CLIENT_ID     = "..."
GOOGLE_CLIENT_SECRET = "..."
SLACK_CLIENT_ID      = "..."
SLACK_CLIENT_SECRET  = "..."
GITHUB_CLIENT_ID     = "..."
GITHUB_CLIENT_SECRET = "..."
JIRA_CLIENT_ID       = "..."
JIRA_CLIENT_SECRET   = "..."
OUTLOOK_CLIENT_ID    = "..."
WHATSAPP_CLIENT_ID     = "..."
WHATSAPP_CLIENT_SECRET = "..."
```

Each provider's `src-tauri/src/*_oauth.rs` file has a header comment explaining exactly which app-console screen these values come from. You only need to fill in credentials for the providers you plan to touch — the rest surface a friendly "not configured" error until they're set.

`config.toml` is gitignored, and the `[env]` values are baked into the compiled binary at build time via Rust's `option_env!` macro. Never commit them.

---

## Running locally

```bash
npm run tauri:dev
```

This starts the Angular dev server on `http://localhost:4200` and launches the Tauri shell against it. Frontend edits hot-reload; Rust edits trigger a rebuild.

Other useful scripts:

| Command | What it does |
|---|---|
| `npm run start` | Angular dev server only (browser-only, no Tauri APIs) |
| `npm run build` | Production Angular build into `dist/` |
| `npm run tauri:build` | Produce installers in `src-tauri/target/release/bundle/` |
| `npm run test` | Run Vitest unit tests |
| `npm run format` | Format all TS / HTML / CSS / JSON with Prettier |
| `npm run format:check` | Verify formatting without writing changes |
| `npm run rust:check` | `cargo check` on the Tauri crate |
| `npm run rust:clippy` | Clippy with `-D warnings` |
| `npm run rust:fmt` | Verify Rust formatting |

---

## Repo layout

```
src/                         Angular frontend
  app/
    core/                    Shared services (Tauri bridge, persistence, notifications, window)
    features/widget/         The widget UI (settings, inbox, notes, calendar, …)
    integrations/
      core/                  Provider-agnostic types, registry, auth handlers, capability interfaces
      providers/             One folder per provider (gmail, slack, github, jira, outlook, whatsapp)
    shared/                  Reusable UI components

src-tauri/                   Rust backend
  src/
    lib.rs                   Tauri entrypoint, command registration, window setup
    commands.rs              #[tauri::command] bridge functions
    db.rs                    SQLite schema and queries
    *_oauth.rs               One file per OAuth loopback flow
    slack_api.rs             Proxy for Slack Web API calls (works around browser CORS)
  .cargo/config.toml         (gitignored) build-time OAuth secrets
  tauri.conf.json            Bundle identifier, window config, CSP, installer targets

.github/workflows/release.yml  Tag-triggered multi-platform release build
```

---

## Code style

The repo has automated checks; please run them locally before opening a PR.

- **TypeScript / HTML / CSS / JSON** — Prettier + `prettier-plugin-tailwindcss`. Run `npm run format`.
- **Rust** — `rustfmt` and `clippy`. Run `npm run rust:fmt` and `npm run rust:clippy`.
- **Editor defaults** — `.editorconfig` enforces 2-space indentation for everything except Rust (4-space), single quotes in TypeScript, UTF-8, and trailing newlines.

A few conventions the codebase already follows:

- **No comments explaining *what* well-named code already says.** Comments should only appear when the *why* is non-obvious (a workaround, a subtle invariant, a past incident).
- **Angular signals over `BehaviorSubject`** for local state — this repo is on Angular 21 with the modern reactive primitives.
- **Rust side keeps OAuth flows purely blocking** and wraps them in `tauri::async_runtime::spawn_blocking` at the command boundary — see `commands.rs`.

---

## Testing

Frontend unit tests live next to their sources as `*.spec.ts` and run under [Vitest](https://vitest.dev/):

```bash
npm run test
```

The pluggable integration layer has an architecture-level spec at `src/app/integrations/integration-architecture.spec.ts` — if you add or rename a provider capability, keep that spec green.

For Rust, there is no test harness in the tree yet; a minimum bar is:

```bash
npm run rust:check
npm run rust:clippy
```

---

## Adding a new integration

Bilet-X's integration layer is designed to be pluggable. Rough shape of adding a new provider:

1. Create a folder under `src/app/integrations/providers/<name>/` containing:
   - `<name>.integration.ts` — extends `BaseIntegration`, declares `id`, `category`, `hasInlineConnectUI`, and the capabilities it exposes (`tasks`, `messages`, `calendar`, `notifications`).
   - `<name>-auth.ts` — implements `AuthHandler` (usually delegates to an OAuth service).
   - One capability implementation per capability the provider supports (see `MessageProvider`, `TaskProvider`, etc. in `src/app/integrations/core/capabilities/`).
2. If the provider needs a native OAuth loopback (most do), add a Rust module at `src-tauri/src/<name>_oauth.rs` following the pattern in `google_oauth.rs`. Register the corresponding `#[tauri::command]` in `commands.rs` and add its name to the `tauri::generate_handler!` list in `lib.rs`.
3. Register the frontend integration in `IntegrationRegistryService`.
4. If the provider needs an inline connect UI (like the Gmail card in the Inbox tab), set `hasInlineConnectUI = true` and build the card inside the relevant feature component; otherwise the generic Settings connect form will pick it up automatically.

The Rust OAuth files each carry a header comment describing how to register the app on the provider side and which scopes to request — the fastest way to learn the pattern is to read `google_oauth.rs` end-to-end.

---

## Filing issues

Good bug reports include:

- What you were trying to do
- What actually happened (screenshots welcome)
- OS and version (`Windows 11`, `macOS 14.5`, `Ubuntu 24.04`, …)
- Whether it reproduces with `npm run tauri:dev` from source, from an installer, or both
- Any error banner text from the app (the inline connect card and Settings form both surface errors verbatim)

For OAuth-flow bugs, please also include which provider and roughly what step failed (browser never opened, callback errored, token exchange failed, first API call failed).

---

## Pull requests

- Keep PRs focused. Small, single-purpose PRs get reviewed faster than sweeping ones.
- Run the format / lint / check commands locally before pushing.
- Match the existing commit style: short imperative subject, optional `feat:` / `fix:` / `ci:` / `chore:` prefix when it clarifies the intent. Example: `feat: add trello integration`, `fix: retry gmail token refresh on 401`, `ci: pass oauth secrets to release build`.
- If your change affects the user-facing feature set, update `README.md` in the same PR.

---

## Releases

Releases are produced entirely by CI. To ship a new version:

1. Bump the version in `package.json`, `src-tauri/Cargo.toml`, and `src-tauri/tauri.conf.json` to the same value (e.g. `1.0.4`).
2. Commit and push to `main`.
3. Tag the commit and push the tag:
   ```bash
   git tag v1.0.4
   git push origin v1.0.4
   ```
4. `.github/workflows/release.yml` will build Windows, macOS (universal), and Linux installers, then publish a draft GitHub Release. Review the draft, add release notes, and publish it.

OAuth credentials for release builds are stored as GitHub Actions repository secrets and forwarded into the build environment by the workflow. Do not commit credentials to `src-tauri/.cargo/config.toml` on a branch that reaches GitHub.

---

Thanks for contributing.
