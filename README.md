# Bilet-X

**A tiny always-on-top desktop widget for notes, mail, and calendar — one hotkey away, everywhere on your screen.**

Bilet-X sits quietly on the edge of your screen, stays above every other window, and follows you between virtual desktops. Press a single global hotkey and it's there; press it again and it's gone. Your notes and connected accounts stay entirely on your machine.

---

## Highlights

- **Always on top, always available.** A slim, frameless widget you can dock to any edge or corner of any monitor.
- **One global hotkey.** Default `Ctrl + Shift + K` (or `⌘ + Shift + K` on macOS). Rebind it from Settings.
- **Notes.** A fast, keyboardable scratchpad that persists locally.
- **Unified Inbox.** Connect Gmail, Outlook, Slack, or WhatsApp and read them side-by-side in one tab.
- **Calendar.** Read-only agenda view across your connected calendars.
- **Local by default.** Everything you type and every account token lives in a SQLite database on your own machine. No servers, no telemetry.
- **Multi-monitor aware.** Remembers where you last placed it and gracefully re-centers if a monitor is unplugged.
- **Auto-hide, themes, and dock layouts.** Tweak position, orientation (vertical / horizontal), size, and light/dark theme from Settings.

---

## Install

Grab the installer for your OS from the **[Releases page](../../releases)**:

| Platform | File to download |
|---|---|
| Windows 10 / 11 | `bilet-x_<version>_x64-setup.exe` (NSIS) or `.msi` |
| macOS (Intel + Apple Silicon) | `bilet-x_<version>_universal.dmg` |
| Linux (Debian / Ubuntu) | `bilet-x_<version>_amd64.deb` |
| Linux (AppImage) | `bilet-x_<version>_amd64.AppImage` |

Run the installer, launch **Bilet-X**, and press `Ctrl + Shift + K` to summon the widget.

---

## First run in 60 seconds

1. **Launch Bilet-X.** The widget appears docked to the right edge of your primary monitor.
2. **Press the global hotkey** (`Ctrl + Shift + K` by default) to toggle it in and out.
3. **Open the Settings tab** (gear icon) to:
   - change the global hotkey,
   - pick a dock position (left / right / top / bottom / any corner),
   - switch between vertical and horizontal orientation,
   - toggle light or dark theme,
   - enable auto-hide.
4. **Open the Inbox tab** and click **Connect** on any provider — a browser window will open, you sign in, and you're back in the widget with your messages loaded.

---

## Integrations

Bilet-X connects to your existing accounts through each provider's official OAuth login. Nothing is proxied through anyone else's server — the sign-in happens directly between your browser and the provider, and only the resulting token is stored locally.

| Service | What it gives you |
|---|---|
| Gmail | Read, mark-as-read, and open messages in the unified inbox |
| Outlook | Read and open messages in the unified inbox |
| Slack | Read DMs and channel messages, open threads directly in the Slack app |
| WhatsApp | Read recent chats |
| Google Calendar | Read-only agenda view |
| GitHub | Notifications and issue mentions |
| Jira | Assigned issues and mentions |

You can disconnect any account at any time from **Settings → Connected Services**. Disconnecting deletes the stored token from your machine.

---

## Your data stays on your machine

Bilet-X uses a local SQLite database. There is no cloud sync, no analytics, no crash reporter phoning home.

Database and token store locations:

- **Windows:** `%APPDATA%\com.bilet.x.app\`
- **macOS:** `~/Library/Application Support/com.bilet.x.app/`
- **Linux:** `~/.local/share/com.bilet.x.app/`

Uninstalling the app does not delete these folders — remove them by hand if you want a completely clean wipe.

---

## Build from source

Requirements: Node 20+, Rust stable, and the platform prerequisites listed in the [Tauri v2 setup guide](https://v2.tauri.app/start/prerequisites/).

```bash
git clone https://github.com/Habeeb-Rahman-CA/bilet-x.git
cd bilet-x
npm install
npm run tauri:dev        # run in development
npm run tauri:build      # produce an installer in src-tauri/target/release/bundle/
```

If you want the OAuth integrations to work in your own build, create `src-tauri/.cargo/config.toml` (gitignored) with your own provider credentials — see the header comment inside any of the `src-tauri/src/*_oauth.rs` files for the exact keys each provider expects.

---

## Under the hood

- **UI:** Angular 21 + Tailwind CSS
- **Shell:** Tauri v2 (Rust)
- **Storage:** SQLite (`rusqlite`, bundled)
- **Global shortcut:** `tauri-plugin-global-shortcut`
- **Notifications:** `tauri-plugin-notification`

---

## Feedback

Found a bug or missing an integration you'd love to see? Open an issue on the repo — Bilet-X is a personal project first, but PRs and suggestions are welcome.
