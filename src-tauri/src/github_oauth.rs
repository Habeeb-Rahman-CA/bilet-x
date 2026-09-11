use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine as _};
use rand::RngCore;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::io::{BufRead, BufReader, Write};
use std::net::TcpListener;
use std::time::{Duration, Instant};

// ============================================================================
// OAuth 2.0 Authorization Code Loopback Flow for GitHub
//
// Client credentials come from environment variables baked in at compile time
// (same pattern as google_oauth.rs / jira_oauth.rs). Add to the gitignored
// file at src-tauri/.cargo/config.toml:
//
//   [env]
//   GITHUB_CLIENT_ID = "your-github-oauth-app-client-id"
//   GITHUB_CLIENT_SECRET = "your-github-oauth-app-client-secret"
//
// Register an OAuth App (not a GitHub App — different flow) at:
//   https://github.com/settings/developers
// Under "OAuth Apps" → New OAuth App:
//   - Application name:        Bilet-X (or whatever)
//   - Homepage URL:            http://127.0.0.1:43729
//   - Authorization callback:  http://127.0.0.1:43729
// GitHub's classic OAuth Apps accept loopback callbacks with exact matches.
// Scopes are requested per-authorize (not registered ahead of time) — we ask
// for `repo` (to see issues in private repos) and `read:user`.
//
// Note: OAuth Apps do NOT issue refresh tokens by default. Access tokens
// are long-lived (they don't expire unless revoked). If we ever migrate to
// a GitHub App, we'd need to add a refresh flow here.
// ============================================================================
const GITHUB_CLIENT_ID: Option<&str> = option_env!("GITHUB_CLIENT_ID");
const GITHUB_CLIENT_SECRET: Option<&str> = option_env!("GITHUB_CLIENT_SECRET");

const LOOPBACK_PORT: u16 = 43729;

fn require_credentials() -> Result<(&'static str, &'static str), String> {
    match (GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET) {
        (Some(id), Some(secret)) if !id.is_empty() && !secret.is_empty() => Ok((id, secret)),
        _ => Err(
            "GITHUB_CLIENT_ID / GITHUB_CLIENT_SECRET not set at build time. Add them to src-tauri/.cargo/config.toml and rebuild."
                .to_string(),
        ),
    }
}

const AUTH_ENDPOINT: &str = "https://github.com/login/oauth/authorize";
const TOKEN_ENDPOINT: &str = "https://github.com/login/oauth/access_token";
const USER_ENDPOINT: &str = "https://api.github.com/user";
const USER_EMAILS_ENDPOINT: &str = "https://api.github.com/user/emails";
const USER_AGENT: &str = "Bilet-X-Desktop";

// `repo` — full read/write on repos you can see, needed for the /issues
//          endpoint to include private repo issues.
// `read:user` — read profile so we can display the account name.
// `user:email` — read primary email address for the connection label.
const SCOPES: &str = "repo read:user user:email";

const CALLBACK_TIMEOUT_SECS: u64 = 120;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct GitHubTokens {
    pub access_token: String,
    pub login: String,
    pub email: String,
    pub name: String,
    pub avatar_url: String,
}

pub fn run_login_flow() -> Result<GitHubTokens, String> {
    let (client_id, _client_secret) = require_credentials()?;

    let listener = TcpListener::bind(("127.0.0.1", LOOPBACK_PORT))
        .map_err(|e| format!(
            "Failed to bind loopback listener on port {} (needed for GitHub's registered callback URL): {}",
            LOOPBACK_PORT, e
        ))?;
    let redirect_uri = format!("http://127.0.0.1:{}", LOOPBACK_PORT);

    let verifier = pkce_verifier();
    let challenge = pkce_challenge(&verifier);
    let state = random_url_safe(32);

    let auth_url = format!(
        "{}?client_id={}&redirect_uri={}&scope={}&state={}&code_challenge={}&code_challenge_method=S256&allow_signup=false",
        AUTH_ENDPOINT,
        urlencoding::encode(client_id),
        urlencoding::encode(&redirect_uri),
        urlencoding::encode(SCOPES),
        urlencoding::encode(&state),
        urlencoding::encode(&challenge),
    );

    open_url_in_browser(&auth_url)?;

    let (code, returned_state) = wait_for_callback(&listener)?;
    if returned_state != state {
        return Err("OAuth state mismatch (possible CSRF).".to_string());
    }

    let token_response = exchange_code(&code, &verifier, &redirect_uri)?;

    let (login, name, avatar_url, profile_email) =
        fetch_user_profile(&token_response.access_token)
            .unwrap_or_else(|_| (String::new(), String::new(), String::new(), String::new()));

    // /user only returns an email if the user chose to make it public — for
    // private accounts, fall back to /user/emails (requires user:email scope)
    // and pick the primary verified address.
    let email = if profile_email.is_empty() {
        fetch_primary_email(&token_response.access_token).unwrap_or_default()
    } else {
        profile_email
    };

    Ok(GitHubTokens {
        access_token: token_response.access_token,
        login,
        email,
        name,
        avatar_url,
    })
}

// ----------------------------------------------------------------------------
// Internals
// ----------------------------------------------------------------------------

#[derive(Debug, Deserialize)]
struct TokenResponse {
    access_token: String,
    #[serde(default)]
    _scope: Option<String>,
    #[serde(default)]
    _token_type: Option<String>,
}

#[derive(Debug, Deserialize)]
struct GitHubUser {
    #[serde(default)]
    login: Option<String>,
    #[serde(default)]
    name: Option<String>,
    #[serde(default)]
    avatar_url: Option<String>,
    #[serde(default)]
    email: Option<String>,
}

#[derive(Debug, Deserialize)]
struct GitHubEmail {
    email: String,
    #[serde(default)]
    primary: bool,
    #[serde(default)]
    verified: bool,
}

fn pkce_verifier() -> String {
    let mut bytes = [0u8; 32];
    rand::thread_rng().fill_bytes(&mut bytes);
    URL_SAFE_NO_PAD.encode(bytes)
}

fn pkce_challenge(verifier: &str) -> String {
    let digest = Sha256::digest(verifier.as_bytes());
    URL_SAFE_NO_PAD.encode(digest)
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
                "No response from GitHub after 2 minutes. If the browser shows an error page, verify the OAuth App's callback URL exactly matches http://127.0.0.1:43729. Cancel and try again."
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
                             <h2>Sign-in failed</h2><p>GitHub returned an error: <code>{}</code></p>\
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
                    return Err(format!("GitHub OAuth error: {}", err));
                }
                let code = code.ok_or("Missing 'code' parameter from GitHub.")?;
                let state = state.ok_or("Missing 'state' parameter from GitHub.")?;
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
    verifier: &str,
    redirect_uri: &str,
) -> Result<TokenResponse, String> {
    let (client_id, client_secret) = require_credentials()?;

    let body = format!(
        "client_id={}&client_secret={}&code={}&redirect_uri={}&code_verifier={}",
        urlencoding::encode(client_id),
        urlencoding::encode(client_secret),
        urlencoding::encode(code),
        urlencoding::encode(redirect_uri),
        urlencoding::encode(verifier),
    );

    // GitHub's token endpoint returns application/x-www-form-urlencoded by
    // default; asking for JSON keeps the response easier to parse.
    let response = ureq::post(TOKEN_ENDPOINT)
        .set("Content-Type", "application/x-www-form-urlencoded")
        .set("Accept", "application/json")
        .send_string(&body)
        .map_err(|e| format!("Token exchange failed: {}", e))?;

    response
        .into_json::<TokenResponse>()
        .map_err(|e| format!("Failed to parse token response: {}", e))
}

fn fetch_user_profile(access_token: &str) -> Result<(String, String, String, String), String> {
    let response = ureq::get(USER_ENDPOINT)
        .set("Authorization", &format!("Bearer {}", access_token))
        .set("Accept", "application/vnd.github+json")
        .set("User-Agent", USER_AGENT)
        .call()
        .map_err(|e| format!("User profile request failed: {}", e))?;

    let user: GitHubUser = response
        .into_json()
        .map_err(|e| format!("Failed to parse user profile: {}", e))?;

    Ok((
        user.login.unwrap_or_default(),
        user.name.unwrap_or_default(),
        user.avatar_url.unwrap_or_default(),
        user.email.unwrap_or_default(),
    ))
}

fn fetch_primary_email(access_token: &str) -> Result<String, String> {
    let response = ureq::get(USER_EMAILS_ENDPOINT)
        .set("Authorization", &format!("Bearer {}", access_token))
        .set("Accept", "application/vnd.github+json")
        .set("User-Agent", USER_AGENT)
        .call()
        .map_err(|e| format!("User emails request failed: {}", e))?;

    let emails: Vec<GitHubEmail> = response
        .into_json()
        .map_err(|e| format!("Failed to parse user emails: {}", e))?;

    let primary = emails
        .into_iter()
        .find(|e| e.primary && e.verified)
        .map(|e| e.email)
        .unwrap_or_default();
    Ok(primary)
}

fn html_escape(s: &str) -> String {
    s.replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
}
