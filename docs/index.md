---
title: Bilet-X
description: Always-on-top desktop widget for notes, tasks, and quick actions.
---

# Bilet-X

**Bilet-X** is a minimalist, always-on-top desktop widget for notes, tasks, and quick actions. It runs locally, follows you across workspaces via a global hotkey, and keeps your data on your machine.

- **Platform:** Windows, macOS, Linux (desktop)
- **Version:** 1.0.2
- **Publisher:** Habeeb Rahman C A
- **Source code:** [github.com/Habeeb-Rahman-CA/bilet-x](https://github.com/Habeeb-Rahman-CA/bilet-x)

## What it does

- Captures notes and to-dos in a small, always-visible window
- Stays on top of other apps and follows you across virtual desktops
- Summonable from anywhere with a global hotkey
- Stores all data locally in a SQLite database inside your OS app-data folder
- Optional integrations (e.g. Gmail) that you explicitly enable and authorize

## Where your data lives

Bilet-X does not run a backend server. Your notes, tasks, and settings live in a local SQLite file under your platform's standard app-data directory (for example `%APPDATA%\com.bilet.x.app\` on Windows). Nothing is uploaded unless you connect an optional third-party integration yourself.

## Optional integrations

Bilet-X supports pluggable integrations that you can enable one at a time. When you connect one (for example Gmail via Google OAuth), Bilet-X talks directly from your machine to that provider using the credentials you authorize. Bilet-X does not proxy or store this data on any Bilet-X server, because there is no such server.

## Support & contact

- **Issues / bug reports:** [GitHub Issues](https://github.com/Habeeb-Rahman-CA/bilet-x/issues)
- **Email:** habeebrahmanca22@gmail.com

## Legal

- [Privacy Policy](./privacy.md)
- [Terms of Service](./terms.md)
