use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine as _};
use rand::RngCore;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::io::{BufRead, BufReader, Write};
use std::net::TcpListener;
use std::time::{Duration, Instant};

// ============================================================================
// OAuth 2.0 (3LO) Loopback Flow for Atlassian / Jira
//
// Client credentials come from environment variables baked in at compile time
// (same pattern as google_oauth.rs). Add to the gitignored file at
// src-tauri/.cargo/config.toml:
//
//   [env]
//   JIRA_CLIENT_ID = "your-atlassian-oauth-client-id"
//   JIRA_CLIENT_SECRET = "your-atlassian-oauth-client-secret"
//
// Create an OAuth 2.0 (3LO) app at:
//   https://developer.atlassian.com/console/myapps/
// Add the "Jira API" permission with scopes: read:jira-user, read:jira-work,
// offline_access. Under "Authorization" set the callback URL to EXACTLY:
//
//   http://127.0.0.1:43728
//
// Atlassian requires an exact redirect_uri match (unlike Google's installed-app
// spec which allows any loopback port), so we bind to a fixed port instead of
// letting the OS pick one. If port 43728 is ever busy on a user's machine, the
// login will fail with "Address already in use" and they can free it.
// ============================================================================
const JIRA_CLIENT_ID: Option<&str> = option_env!("JIRA_CLIENT_ID");
const JIRA_CLIENT_SECRET: Option<&str> = option_env!("JIRA_CLIENT_SECRET");

const LOOPBACK_PORT: u16 = 43728;

fn require_credentials() -> Result<(&'static str, &'static str), String> {
    match (JIRA_CLIENT_ID, JIRA_CLIENT_SECRET) {
        (Some(id), Some(secret)) if !id.is_empty() && !secret.is_empty() => Ok((id, secret)),
        _ => Err(
            "JIRA_CLIENT_ID / JIRA_CLIENT_SECRET not set at build time. Add them to src-tauri/.cargo/config.toml and rebuild."
                .to_string(),
        ),
    }
}

const AUTH_ENDPOINT: &str = "https://auth.atlassian.com/authorize";
const TOKEN_ENDPOINT: &str = "https://auth.atlassian.com/oauth/token";
const USERINFO_ENDPOINT: &str = "https://api.atlassian.com/me";
const RESOURCES_ENDPOINT: &str = "https://api.atlassian.com/oauth/token/accessible-resources";
const AUDIENCE: &str = "api.atlassian.com";
// offline_access → refresh token. read:jira-user for /myself + assignee resolution.
// read:jira-work for search + issue read.
const SCOPES: &str = "read:jira-user read:jira-work offline_access";

const CALLBACK_TIMEOUT_SECS: u64 = 120;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct JiraTokens {
    pub access_token: String,
    pub refresh_token: String,
    pub expires_in: u64,
    pub email: String,
    pub display_name: String,
    pub cloud_id: String,
    pub site_url: String,
    pub site_name: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct RefreshedJiraTokens {
    pub access_token: String,
    pub refresh_token: String,
    pub expires_in: u64,
}

pub fn run_login_flow() -> Result<JiraTokens, String> {
    let (client_id, _client_secret) = require_credentials()?;

    let listener = TcpListener::bind(("127.0.0.1", LOOPBACK_PORT))
        .map_err(|e| format!(
            "Failed to bind loopback listener on port {} (needed for Atlassian's fixed callback URL): {}",
            LOOPBACK_PORT, e
        ))?;
    let redirect_uri = format!("http://127.0.0.1:{}", LOOPBACK_PORT);

    let verifier = pkce_verifier();
    let challenge = pkce_challenge(&verifier);
    let state = random_url_safe(32);

    let auth_url = format!(
        "{}?audience={}&client_id={}&scope={}&redirect_uri={}&state={}&response_type=code&prompt=consent&code_challenge={}&code_challenge_method=S256",
        AUTH_ENDPOINT,
        urlencoding::encode(AUDIENCE),
        urlencoding::encode(client_id),
        urlencoding::encode(SCOPES),
        urlencoding::encode(&redirect_uri),
        urlencoding::encode(&state),
        urlencoding::encode(&challenge),
    );

    open_url_in_browser(&auth_url)?;

    let (code, returned_state) = wait_for_callback(&listener)?;
    if returned_state != state {
        return Err("OAuth state mismatch (possible CSRF).".to_string());
    }

    let token_response = exchange_code(&code, &verifier, &redirect_uri)?;

    let refresh_token = token_response.refresh_token.ok_or_else(|| {
        "Atlassian did not return a refresh_token. Make sure your OAuth app requests the 'offline_access' scope and try again."
            .to_string()
    })?;

    let (email, display_name) = fetch_userinfo(&token_response.access_token)
        .unwrap_or_else(|_| (String::new(), String::new()));

    let (cloud_id, site_url, site_name) = fetch_first_accessible_resource(&token_response.access_token)?;

    Ok(JiraTokens {
        access_token: token_response.access_token,
        refresh_token,
        expires_in: token_response.expires_in.unwrap_or(3600),
        email,
        display_name,
        cloud_id,
        site_url,
        site_name,
    })
}

pub fn refresh_access_token(refresh_token: &str) -> Result<RefreshedJiraTokens, String> {
    let (client_id, client_secret) = require_credentials()?;

    let body = serde_json::json!({
        "grant_type": "refresh_token",
        "client_id": client_id,
        "client_secret": client_secret,
        "refresh_token": refresh_token,
    });

    let response = ureq::post(TOKEN_ENDPOINT)
        .set("Content-Type", "application/json")
        .set("Accept", "application/json")
        .send_json(body)
        .map_err(|e| format!("Refresh token request failed: {}", e))?;

    let parsed: TokenResponse = response
        .into_json()
        .map_err(|e| format!("Failed to parse refresh response: {}", e))?;

    Ok(RefreshedJiraTokens {
        access_token: parsed.access_token,
        // Atlassian rotates refresh tokens: if a new one is returned, use it;
        // otherwise keep reusing the current one.
        refresh_token: parsed.refresh_token.unwrap_or_else(|| refresh_token.to_string()),
        expires_in: parsed.expires_in.unwrap_or(3600),
    })
}

// ----------------------------------------------------------------------------
// Internals
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
struct AtlassianMe {
    #[serde(default)]
    email: Option<String>,
    #[serde(default)]
    name: Option<String>,
}

#[derive(Debug, Deserialize)]
struct AccessibleResource {
    id: String,
    #[serde(default)]
    url: Option<String>,
    #[serde(default)]
    name: Option<String>,
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
                "No response from Atlassian after 2 minutes. If you saw an error page in the browser, verify the OAuth app's callback URL includes http://127.0.0.1 and the requested scopes are enabled. Cancel and try again."
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
                             <h2>Sign-in failed</h2><p>Atlassian returned an error: <code>{}</code></p>\
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
                    return Err(format!("Atlassian OAuth error: {}", err));
                }
                let code = code.ok_or("Missing 'code' parameter from Atlassian.")?;
                let state = state.ok_or("Missing 'state' parameter from Atlassian.")?;
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

    let body = serde_json::json!({
        "grant_type": "authorization_code",
        "client_id": client_id,
        "client_secret": client_secret,
        "code": code,
        "redirect_uri": redirect_uri,
        "code_verifier": verifier,
    });

    let response = ureq::post(TOKEN_ENDPOINT)
        .set("Content-Type", "application/json")
        .set("Accept", "application/json")
        .send_json(body)
        .map_err(|e| format!("Token exchange failed: {}", e))?;

    response
        .into_json::<TokenResponse>()
        .map_err(|e| format!("Failed to parse token response: {}", e))
}

fn fetch_userinfo(access_token: &str) -> Result<(String, String), String> {
    let response = ureq::get(USERINFO_ENDPOINT)
        .set("Authorization", &format!("Bearer {}", access_token))
        .set("Accept", "application/json")
        .call()
        .map_err(|e| format!("Userinfo request failed: {}", e))?;

    let info: AtlassianMe = response
        .into_json()
        .map_err(|e| format!("Failed to parse userinfo: {}", e))?;

    Ok((info.email.unwrap_or_default(), info.name.unwrap_or_default()))
}

fn fetch_first_accessible_resource(
    access_token: &str,
) -> Result<(String, String, String), String> {
    let response = ureq::get(RESOURCES_ENDPOINT)
        .set("Authorization", &format!("Bearer {}", access_token))
        .set("Accept", "application/json")
        .call()
        .map_err(|e| format!("Accessible-resources request failed: {}", e))?;

    let resources: Vec<AccessibleResource> = response
        .into_json()
        .map_err(|e| format!("Failed to parse accessible-resources: {}", e))?;

    let first = resources.into_iter().next().ok_or_else(|| {
        "Your Atlassian account has no accessible Jira sites. Grant the OAuth app access to at least one site and try again.".to_string()
    })?;

    Ok((
        first.id,
        first.url.unwrap_or_default(),
        first.name.unwrap_or_default(),
    ))
}

fn html_escape(s: &str) -> String {
    s.replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
}
