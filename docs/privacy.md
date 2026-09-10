---
title: Privacy Policy
description: How Bilet-X handles your data.
---

# Privacy Policy

_Last updated: 2026-09-10_

This Privacy Policy explains how **Bilet-X** ("the app", "we") handles information when you use the desktop application.

## Summary

- Bilet-X is a local-first desktop app. It does **not** operate a backend server that receives your content.
- Your notes, tasks, and settings are stored **locally** on your device.
- Optional integrations (such as Gmail) only run when **you** explicitly connect them and only send data between your device and the third-party provider you authorized.
- We do not sell your data. We do not run analytics or advertising trackers inside the app.

## Data we handle

### Data stored on your device

When you use Bilet-X, the following is stored locally on your device only:

- Notes, tasks, and any other content you create in the app
- App settings and preferences (window position, hotkey, theme, etc.)
- Local caches used by the app for performance
- If you connect an integration: the OAuth tokens (access and refresh tokens) issued to you by that provider, stored on your device so the app can talk to the provider on your behalf

This data lives in your operating system's standard application-data directory (for example `%APPDATA%\com.bilet.x.app\` on Windows, `~/Library/Application Support/com.bilet.x.app/` on macOS, `~/.local/share/com.bilet.x.app/` on Linux). Uninstalling the app or deleting that folder removes this data.

### Data we do NOT collect

Bilet-X does not:

- Send your notes, tasks, or content to any Bilet-X-operated server
- Run third-party analytics, telemetry, ads, or tracking pixels
- Sell, rent, or share your data with anyone

There is no Bilet-X backend. If a feature needs the network, it talks directly to the third-party service you authorized, from your device.

## Optional integrations

Bilet-X supports optional integrations you can enable individually. When you connect one, you are authorizing Bilet-X on your device to communicate directly with that provider using standard OAuth. Bilet-X only requests the scopes needed for the features you turn on.

### Google / Gmail

If you connect Gmail, Bilet-X uses Google's OAuth 2.0 loopback flow to obtain tokens scoped to the features you enabled. Tokens are stored locally on your device and used to make requests directly from your device to Google's APIs. Bilet-X does not send your Google account data to any Bilet-X server (there is no such server), and does not use your Google data for advertising or resale.

Bilet-X's use and transfer of information received from Google APIs adheres to the [Google API Services User Data Policy](https://developers.google.com/terms/api-services-user-data-policy), including the Limited Use requirements.

You can disconnect the integration at any time from within Bilet-X, and you can also revoke access from your [Google Account permissions page](https://myaccount.google.com/permissions).

## Children

Bilet-X is a general-purpose productivity tool not directed at children under 13. We do not knowingly handle personal information of children.

## Security

Because Bilet-X stores your data on your own device, the security of that data depends primarily on the security of your device (disk encryption, account password, etc.). OAuth tokens are stored in the app's local data directory using the operating system's standard file permissions. We recommend keeping your device patched and using full-disk encryption.

## Changes to this policy

We may update this policy as the app evolves. Material changes will be reflected by updating the "Last updated" date at the top of this page and, where practical, by a note in the app's release notes.

## Contact

Questions or requests about this policy:

- **Email:** vibeseeroovibe@gmail.com
- **Issues:** [github.com/Habeeb-Rahman-CA/bilet-x/issues](https://github.com/Habeeb-Rahman-CA/bilet-x/issues)
