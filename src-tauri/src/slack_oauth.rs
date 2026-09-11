use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine as _};
use rand::RngCore;
use serde::{Deserialize, Serialize};
use std::io::{BufRead, BufReader, Write};
use std::net::TcpListener;
use std::time::{Duration, Instant};

// ============================================================================
// OAuth 2.0 (v2) Loopback Flow for Slack
//
// Client credentials come from environment variables baked in at compile
// time. Add to the gitignored file at src-tauri/.cargo/config.toml:
//
//   [env]
//   SLACK_CLIENT_ID     = "your-slack-app-client-id"
//   SLACK_CLIENT_SECRET = "your-slack-app-client-secret"
//
// Setup:
//   1. Create an app at https://api.slack.com/apps → From scratch.
//   2. OAuth & Permissions → Redirect URLs → add: http://localhost:43732
//   3. OAuth & Permissions → User Token Scopes (NOT bot scopes) → add:
//        channels:history, channels:read, groups:history, groups:read,
//        im:history, im:read, mpim:history, mpim:read,
//        users:read, users.profile:read
//      We deliberately request USER token scopes only so the app can act
//      as the signing-in user and read their DMs — a bot token would need
//      admin approval on many workspaces.
//   4. Basic Information → copy Client ID + Client Secret into config.toml.
//   5. Install to Workspace (developer's workspace works for personal use).
//
// User tokens (xoxp-*) don't expire by default. Workspaces can opt into
// token rotation, in which case we'd need a refresh flow — not implemented
// yet since Bilet-X is single-user-owned.
// ============================================================================
const SLACK_CLIENT_ID: Option<&str> = option_env!("SLACK_CLIENT_ID");
const SLACK_CLIENT_SECRET: Option<&str> = option_env!("SLACK_CLIENT_SECRET");

const LOOPBACK_PORT: u16 = 43732;

fn require_credentials() -> Result<(&'static str, &'static str), String> {
    match (SLACK_CLIENT_ID, SLACK_CLIENT_SECRET) {
        (Some(id), Some(secret)) if !id.is_empty() && !secret.is_empty() => Ok((id, secret)),
        _ => Err(
            "SLACK_CLIENT_ID / SLACK_CLIENT_SECRET not set at build time. Add them to src-tauri/.cargo/config.toml and rebuild."
                .to_string(),
        ),
    }
}

const AUTH_ENDPOINT: &str = "https://slack.com/oauth/v2/authorize";
const TOKEN_ENDPOINT: &str = "https://slack.com/api/oauth.v2.access";
const USER_INFO_ENDPOINT: &str = "https://slack.com/api/users.info";

// User-token scopes only. `scope` is reserved for bot scopes; we omit it.
const USER_SCOPES: &str = "channels:history,channels:read,groups:history,groups:read,im:history,im:read,mpim:history,mpim:read,users:read,users.profile:read";

const CALLBACK_TIMEOUT_SECS: u64 = 120;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SlackTokens {
    pub access_token: String,
    pub user_id: String,
    pub user_name: String,
    pub team_id: String,
    pub team_name: String,
    pub team_domain: String,
}

pub fn run_login_flow() -> Result<SlackTokens, String> {
    let (client_id, _client_secret) = require_credentials()?;

    let listener = TcpListener::bind(("127.0.0.1", LOOPBACK_PORT))
        .map_err(|e| format!(
            "Failed to bind loopback listener on port {} (needed for Slack's registered redirect URL): {}",
            LOOPBACK_PORT, e
        ))?;
    let redirect_uri = format!("http://localhost:{}", LOOPBACK_PORT);

    let state = random_url_safe(32);

    // Slack OAuth v2 uses `user_scope` for user-token-only apps. We omit
    // `scope` entirely so no bot user is provisioned.
    let auth_url = format!(
        "{}?client_id={}&user_scope={}&redirect_uri={}&state={}",
        AUTH_ENDPOINT,
        urlencoding::encode(client_id),
        urlencoding::encode(USER_SCOPES),
        urlencoding::encode(&redirect_uri),
        urlencoding::encode(&state),
    );

    open_url_in_browser(&auth_url)?;

    let (code, returned_state) = wait_for_callback(&listener)?;
    if returned_state != state {
        return Err("OAuth state mismatch (possible CSRF).".to_string());
    }

    let token_response = exchange_code(&code, &redirect_uri)?;

    if !token_response.ok {
        return Err(format!(
            "Slack OAuth failed: {}",
            token_response.error.unwrap_or_else(|| "unknown_error".to_string())
        ));
    }

    let authed = token_response.authed_user.ok_or_else(|| {
        "Slack did not return an authed_user.access_token — check that user scopes are configured on the app.".to_string()
    })?;

    let team = token_response.team.unwrap_or(Team {
        id: String::new(),
        name: String::new(),
        domain: None,
    });

    let user_name = fetch_user_display_name(&authed.access_token, &authed.id)
        .unwrap_or_else(|_| String::new());

    Ok(SlackTokens {
        access_token: authed.access_token,
        user_id: authed.id,
        user_name,
        team_id: team.id,
        team_name: team.name,
        team_domain: team.domain.unwrap_or_default(),
    })
}

// ----------------------------------------------------------------------------
// Internals
// ----------------------------------------------------------------------------

#[derive(Debug, Deserialize)]
struct OAuthV2Response {
    ok: bool,
    #[serde(default)]
    error: Option<String>,
    #[serde(default)]
    authed_user: Option<AuthedUser>,
    #[serde(default)]
    team: Option<Team>,
}

#[derive(Debug, Deserialize)]
struct AuthedUser {
    id: String,
    access_token: String,
}

#[derive(Debug, Deserialize)]
struct Team {
    id: String,
    #[serde(default)]
    name: String,
    #[serde(default)]
    domain: Option<String>,
}

#[derive(Debug, Deserialize)]
struct UsersInfoResponse {
    ok: bool,
    #[serde(default)]
    user: Option<SlackUser>,
}

#[derive(Debug, Deserialize)]
struct SlackUser {
    #[serde(default)]
    real_name: Option<String>,
    #[serde(default)]
    name: Option<String>,
    #[serde(default)]
    profile: Option<SlackUserProfile>,
}

#[derive(Debug, Deserialize)]
struct SlackUserProfile {
    #[serde(default)]
    display_name: Option<String>,
    #[serde(default)]
    real_name: Option<String>,
}

fn random_url_safe(byte_len: usize) -> String {
    let mut bytes = vec![0u8; byte_len];
    rand::thread_rng().fill_bytes(&mut bytes);
    URL_SAFE_NO_PAD.encode(&bytes)
}

fn open_url_in_browser(url: &str) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("rundll32.exe")
            .args(["url.dll,FileProtocolHandler", url])
            .spawn()
            .map_err(|e| format!("Failed to open browser: {}", e))?;
    }
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(url)
            .spawn()
            .map_err(|e| format!("Failed to open browser: {}", e))?;
    }
    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("xdg-open")
            .arg(url)
            .spawn()
            .map_err(|e| format!("Failed to open browser: {}", e))?;
    }
    Ok(())
}

fn wait_for_callback(listener: &TcpListener) -> Result<(String, String), String> {
    listener
        .set_nonblocking(true)
        .map_err(|e| format!("Failed to set non-blocking: {}", e))?;

    let deadline = Instant::now() + Duration::from_secs(CALLBACK_TIMEOUT_SECS);

    loop {
        if Instant::now() >= deadline {
            return Err(
                "No response from Slack after 2 minutes. If the browser shows an error page, verify http://localhost:43732 is in the app's OAuth & Permissions → Redirect URLs. Cancel and try again."
                    .to_string(),
            );
        }

        match listener.accept() {
            Ok((mut stream, _addr)) => {
                stream
                    .set_read_timeout(Some(Duration::from_secs(5)))
                    .ok();
                let mut reader = BufReader::new(&stream);
                let mut request_line = String::new();
                reader
                    .read_line(&mut request_line)
                    .map_err(|e| format!("Failed to read request: {}", e))?;

                let (code, state, error) = parse_query_params(&request_line);

                let (status, body) = if let Some(err) = error.as_deref() {
                    (
                        "400 Bad Request",
                        format!(
                            "<html><body style=\"font-family:sans-serif;padding:2rem\">\
                             <h2>Sign-in failed</h2><p>Slack returned an error: <code>{}</code></p>\
                             <p>You can close this tab and try again.</p></body></html>",
                            html_escape(err),
                        ),
                    )
                } else if code.is_some() {
                    (
                        "200 OK",
                        "<html><body style=\"font-family:sans-serif;padding:2rem\">\
                             <h2>Signed in \u{2713}</h2><p>You can close this tab and return to Bilet-X.</p>\
                             <script>window.close();</script></body></html>"
                            .to_string(),
                    )
                } else {
                    (
                        "400 Bad Request",
                        "<html><body>Missing authorization code.</body></html>".to_string(),
                    )
                };

                let response = format!(
                    "HTTP/1.1 {}\r\nContent-Type: text/html; charset=utf-8\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
                    status,
                    body.len(),
                    body
                );
                let _ = stream.write_all(response.as_bytes());
                let _ = stream.flush();

                if let Some(err) = error {
                    return Err(format!("Slack OAuth error: {}", err));
                }
                let code = code.ok_or("Missing 'code' parameter from Slack.")?;
                let state = state.ok_or("Missing 'state' parameter from Slack.")?;
                return Ok((code, state));
            }
            Err(ref e) if e.kind() == std::io::ErrorKind::WouldBlock => {
                std::thread::sleep(Duration::from_millis(100));
            }
            Err(e) => return Err(format!("Accept error: {}", e)),
        }
    }
}

fn parse_query_params(request_line: &str) -> (Option<String>, Option<String>, Option<String>) {
    let mut parts = request_line.split_whitespace();
    let _method = parts.next();
    let path = parts.next().unwrap_or("");

    let query = path.split_once('?').map(|(_, q)| q).unwrap_or("");
    let mut code = None;
    let mut state = None;
    let mut error = None;

    for pair in query.split('&') {
        if let Some((k, v)) = pair.split_once('=') {
            let decoded = urlencoding::decode(v).unwrap_or_else(|_| v.into()).into_owned();
            match k {
                "code" => code = Some(decoded),
                "state" => state = Some(decoded),
                "error" => error = Some(decoded),
                _ => {}
            }
        }
    }
    (code, state, error)
}

fn exchange_code(code: &str, redirect_uri: &str) -> Result<OAuthV2Response, String> {
    let (client_id, client_secret) = require_credentials()?;

    // Slack's token endpoint takes form-urlencoded body. Client credentials
    // can go in the body or via HTTP Basic auth — body form is simplest.
    let body = format!(
        "client_id={}&client_secret={}&code={}&redirect_uri={}",
        urlencoding::encode(client_id),
        urlencoding::encode(client_secret),
        urlencoding::encode(code),
        urlencoding::encode(redirect_uri),
    );

    let response = ureq::post(TOKEN_ENDPOINT)
        .set("Content-Type", "application/x-www-form-urlencoded")
        .set("Accept", "application/json")
        .send_string(&body)
        .map_err(|e| format!("Token exchange failed: {}", e))?;

    response
        .into_json::<OAuthV2Response>()
        .map_err(|e| format!("Failed to parse token response: {}", e))
}

fn fetch_user_display_name(access_token: &str, user_id: &str) -> Result<String, String> {
    let url = format!("{}?user={}", USER_INFO_ENDPOINT, urlencoding::encode(user_id));
    let response = ureq::get(&url)
        .set("Authorization", &format!("Bearer {}", access_token))
        .set("Accept", "application/json")
        .call()
        .map_err(|e| format!("users.info failed: {}", e))?;

    let parsed: UsersInfoResponse = response
        .into_json()
        .map_err(|e| format!("Failed to parse users.info response: {}", e))?;

    if !parsed.ok {
        return Err("users.info returned ok=false".to_string());
    }
    let user = parsed.user.ok_or("users.info returned no user")?;

    // Prefer profile.display_name (what shows in Slack UI), fall back to
    // real_name, then user handle.
    let name = user
        .profile
        .as_ref()
        .and_then(|p| p.display_name.clone().filter(|s| !s.is_empty()))
        .or_else(|| user.profile.and_then(|p| p.real_name).filter(|s| !s.is_empty()))
        .or(user.real_name)
        .or(user.name)
        .unwrap_or_default();

    Ok(name)
}

fn html_escape(s: &str) -> String {
    s.replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
}
