use base64::{engine::general_purpose::STANDARD, Engine as _};
use rand::RngCore;
use serde::{Deserialize, Serialize};
use std::io::{BufRead, BufReader, Write};
use std::net::TcpListener;
use std::time::{Duration, Instant};

// ============================================================================
// OAuth 2.0 Loopback Flow for Spotify
//
// Client credentials can be provided at compile-time in src-tauri/.cargo/config.toml:
//
//   [env]
//   SPOTIFY_CLIENT_ID     = "your-spotify-app-client-id"
//   SPOTIFY_CLIENT_SECRET = "your-spotify-app-client-secret"
//
// Setup in Spotify Developer Dashboard (https://developer.spotify.com/dashboard):
//   1. Create an App.
//   2. In App Settings -> Redirect URIs, add: http://127.0.0.1:43734 or http://localhost:43734
//   3. Copy Client ID and Client Secret into .cargo/config.toml.
// ============================================================================
const SPOTIFY_CLIENT_ID: Option<&str> = option_env!("SPOTIFY_CLIENT_ID");
const SPOTIFY_CLIENT_SECRET: Option<&str> = option_env!("SPOTIFY_CLIENT_SECRET");

const LOOPBACK_PORT: u16 = 43734;

fn require_credentials() -> Result<(&'static str, &'static str), String> {
    match (SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET) {
        (Some(id), Some(secret)) if !id.is_empty() && !secret.is_empty() => Ok((id, secret)),
        _ => Err(
            "SPOTIFY_CLIENT_ID / SPOTIFY_CLIENT_SECRET not configured. Please set them in src-tauri/.cargo/config.toml."
                .to_string(),
        ),
    }
}

const AUTH_ENDPOINT: &str = "https://accounts.spotify.com/authorize";
const TOKEN_ENDPOINT: &str = "https://accounts.spotify.com/api/token";
const USER_INFO_ENDPOINT: &str = "https://api.spotify.com/v1/me";

const SCOPES: &str = "user-read-private user-read-email user-read-playback-state user-modify-playback-state user-read-currently-playing user-read-recently-played user-top-read playlist-read-private playlist-read-collaborative user-library-read user-library-modify";

const CALLBACK_TIMEOUT_SECS: u64 = 120;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SpotifyTokens {
    pub access_token: String,
    pub refresh_token: Option<String>,
    pub expires_in: u64,
    pub user_id: String,
    pub display_name: String,
    pub email: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct RefreshedSpotifyTokens {
    pub access_token: String,
    pub refresh_token: Option<String>,
    pub expires_in: u64,
}

pub fn run_login_flow() -> Result<SpotifyTokens, String> {
    let (client_id, client_secret) = require_credentials()?;

    let listener = TcpListener::bind(("127.0.0.1", LOOPBACK_PORT)).map_err(|e| {
        format!(
            "Failed to bind loopback listener on port {} (needed for Spotify redirect URI): {}",
            LOOPBACK_PORT, e
        )
    })?;
    let redirect_uri = format!("http://127.0.0.1:{}", LOOPBACK_PORT);

    let mut state_bytes = [0u8; 24];
    rand::thread_rng().fill_bytes(&mut state_bytes);
    let state = STANDARD.encode(&state_bytes);

    let auth_url = format!(
        "{}?response_type=code&client_id={}&scope={}&redirect_uri={}&state={}&show_dialog=true",
        AUTH_ENDPOINT,
        urlencoding::encode(client_id),
        urlencoding::encode(SCOPES),
        urlencoding::encode(&redirect_uri),
        urlencoding::encode(&state),
    );

    open_url_in_browser(&auth_url)?;

    let (code, returned_state) = wait_for_callback(&listener)?;
    if returned_state != state {
        return Err("OAuth state mismatch (possible CSRF attack).".to_string());
    }

    let token_resp = exchange_code(&code, &redirect_uri, client_id, client_secret)?;
    let (user_id, display_name, email) = fetch_user_profile(&token_resp.access_token);

    Ok(SpotifyTokens {
        access_token: token_resp.access_token,
        refresh_token: token_resp.refresh_token,
        expires_in: token_resp.expires_in.unwrap_or(3600),
        user_id,
        display_name,
        email,
    })
}

pub fn refresh_access_token(refresh_token: &str) -> Result<RefreshedSpotifyTokens, String> {
    let (client_id, client_secret) = require_credentials()?;

    let basic_auth = STANDARD.encode(format!("{}:{}", client_id, client_secret).as_bytes());
    let body = format!(
        "grant_type=refresh_token&refresh_token={}",
        urlencoding::encode(refresh_token)
    );

    let response = ureq::post(TOKEN_ENDPOINT)
        .set("Authorization", &format!("Basic {}", basic_auth))
        .set("Content-Type", "application/x-www-form-urlencoded")
        .set("Accept", "application/json")
        .send_string(&body)
        .map_err(|e| format!("Spotify token refresh failed: {}", e))?;

    let parsed: TokenResponse = response
        .into_json()
        .map_err(|e| format!("Failed to parse Spotify refresh response: {}", e))?;

    Ok(RefreshedSpotifyTokens {
        access_token: parsed.access_token,
        refresh_token: parsed.refresh_token.or_else(|| Some(refresh_token.to_string())),
        expires_in: parsed.expires_in.unwrap_or(3600),
    })
}

// ----------------------------------------------------------------------------
// Helpers & Internal structs
// ----------------------------------------------------------------------------

#[derive(Debug, Deserialize)]
struct TokenResponse {
    access_token: String,
    #[serde(default)]
    refresh_token: Option<String>,
    #[serde(default)]
    expires_in: Option<u64>,
}

#[derive(Debug, Deserialize)]
struct UserProfileResponse {
    id: String,
    #[serde(default)]
    display_name: Option<String>,
    #[serde(default)]
    email: Option<String>,
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
                "No response from Spotify after 2 minutes. If the browser shows an error, verify http://127.0.0.1:43734 is listed in your Spotify Developer App Redirect URIs."
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
                            "<html><body style=\"font-family:sans-serif;padding:2rem;background:#121212;color:#fff\">\
                             <h2 style=\"color:#ff5555\">Spotify Authentication Failed</h2><p>Error: <code>{}</code></p>\
                             <p>You can close this tab and return to Bilet-X to retry.</p></body></html>",
                            html_escape(err),
                        ),
                    )
                } else if code.is_some() {
                    (
                        "200 OK",
                        "<html><body style=\"font-family:sans-serif;padding:2rem;background:#121212;color:#fff;text-align:center\">\
                             <h2 style=\"color:#1DB954\">✓ Connected to Spotify!</h2>\
                             <p>Authentication successful. You can close this tab and return to Bilet-X.</p>\
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
                    return Err(format!("Spotify authorization error: {}", err));
                }
                let code = code.ok_or("Missing 'code' parameter from Spotify callback.")?;
                let state = state.ok_or("Missing 'state' parameter from Spotify callback.")?;
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

fn exchange_code(
    code: &str,
    redirect_uri: &str,
    client_id: &str,
    client_secret: &str,
) -> Result<TokenResponse, String> {
    let basic_auth = STANDARD.encode(format!("{}:{}", client_id, client_secret).as_bytes());
    let body = format!(
        "grant_type=authorization_code&code={}&redirect_uri={}",
        urlencoding::encode(code),
        urlencoding::encode(redirect_uri),
    );

    let response = ureq::post(TOKEN_ENDPOINT)
        .set("Authorization", &format!("Basic {}", basic_auth))
        .set("Content-Type", "application/x-www-form-urlencoded")
        .set("Accept", "application/json")
        .send_string(&body)
        .map_err(|e| format!("Spotify token exchange failed: {}", e))?;

    response
        .into_json::<TokenResponse>()
        .map_err(|e| format!("Failed to parse Spotify token response: {}", e))
}

fn fetch_user_profile(access_token: &str) -> (String, String, Option<String>) {
    let response = ureq::get(USER_INFO_ENDPOINT)
        .set("Authorization", &format!("Bearer {}", access_token))
        .set("Accept", "application/json")
        .call();

    match response {
        Ok(res) => {
            if let Ok(parsed) = res.into_json::<UserProfileResponse>() {
                return (
                    parsed.id,
                    parsed.display_name.unwrap_or_else(|| "Spotify User".to_string()),
                    parsed.email,
                );
            }
        }
        Err(e) => {
            eprintln!("Warning: /v1/me profile fetch returned: {}", e);
        }
    }

    ("spotify_user".to_string(), "Spotify User".to_string(), None)
}

fn html_escape(s: &str) -> String {
    s.replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
}
