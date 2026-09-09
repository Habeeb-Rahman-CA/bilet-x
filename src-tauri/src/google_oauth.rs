use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine as _};
use rand::RngCore;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::io::{BufRead, BufReader, Write};
use std::net::TcpListener;
use std::time::{Duration, Instant};

// ============================================================================
// OAuth 2.0 Loopback Flow for Google Desktop Apps
//
// Credentials are baked in at compile time from environment variables so they
// never live in source (GitHub's push protection blocks committed secrets).
//
// Set them via a gitignored file at src-tauri/.cargo/config.toml:
//
//   [env]
//   GOOGLE_CLIENT_ID = "your-id.apps.googleusercontent.com"
//   GOOGLE_CLIENT_SECRET = "GOCSPX-yoursecret"
//
// Create a "Desktop app" OAuth client at:
//   https://console.cloud.google.com/apis/credentials
// Enable the Gmail API and add scopes: openid, email, profile, gmail.modify.
// ============================================================================
const GOOGLE_CLIENT_ID: Option<&str> = option_env!("GOOGLE_CLIENT_ID");
const GOOGLE_CLIENT_SECRET: Option<&str> = option_env!("GOOGLE_CLIENT_SECRET");

fn require_credentials() -> Result<(&'static str, &'static str), String> {
    match (GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET) {
        (Some(id), Some(secret)) if !id.is_empty() && !secret.is_empty() => Ok((id, secret)),
        _ => Err(
            "GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET not set at build time. Add them to src-tauri/.cargo/config.toml and rebuild."
                .to_string(),
        ),
    }
}

const AUTH_ENDPOINT: &str = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_ENDPOINT: &str = "https://oauth2.googleapis.com/token";
const USERINFO_ENDPOINT: &str = "https://openidconnect.googleapis.com/v1/userinfo";
const SCOPES: &str =
    "openid email profile https://www.googleapis.com/auth/gmail.modify";

const CALLBACK_TIMEOUT_SECS: u64 = 120;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct GoogleTokens {
    pub access_token: String,
    pub refresh_token: String,
    pub expires_in: u64,
    pub email: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct RefreshedTokens {
    pub access_token: String,
    pub expires_in: u64,
}

pub fn run_login_flow() -> Result<GoogleTokens, String> {
    let (client_id, _client_secret) = require_credentials()?;

    let listener = TcpListener::bind("127.0.0.1:0")
        .map_err(|e| format!("Failed to bind loopback listener: {}", e))?;
    let port = listener
        .local_addr()
        .map_err(|e| format!("Failed to read listener port: {}", e))?
        .port();
    let redirect_uri = format!("http://127.0.0.1:{}", port);

    let verifier = pkce_verifier();
    let challenge = pkce_challenge(&verifier);
    let state = random_url_safe(32);

    let auth_url = format!(
        "{}?client_id={}&redirect_uri={}&response_type=code&scope={}&access_type=offline&prompt=consent&code_challenge={}&code_challenge_method=S256&state={}&include_granted_scopes=true",
        AUTH_ENDPOINT,
        urlencoding::encode(client_id),
        urlencoding::encode(&redirect_uri),
        urlencoding::encode(SCOPES),
        urlencoding::encode(&challenge),
        urlencoding::encode(&state),
    );

    open_url_in_browser(&auth_url)?;

    let (code, returned_state) = wait_for_callback(&listener)?;
    if returned_state != state {
        return Err("OAuth state mismatch (possible CSRF).".to_string());
    }

    let token_response = exchange_code(&code, &verifier, &redirect_uri)?;

    let email = fetch_userinfo_email(&token_response.access_token)
        .unwrap_or_else(|_| String::new());

    let refresh_token = token_response.refresh_token.ok_or_else(|| {
        "Google did not return a refresh_token. Remove the app from https://myaccount.google.com/permissions and try again."
            .to_string()
    })?;

    Ok(GoogleTokens {
        access_token: token_response.access_token,
        refresh_token,
        expires_in: token_response.expires_in.unwrap_or(3600),
        email,
    })
}

pub fn refresh_access_token(refresh_token: &str) -> Result<RefreshedTokens, String> {
    let (client_id, client_secret) = require_credentials()?;

    let body = format!(
        "client_id={}&client_secret={}&refresh_token={}&grant_type=refresh_token",
        urlencoding::encode(client_id),
        urlencoding::encode(client_secret),
        urlencoding::encode(refresh_token),
    );

    let response = ureq::post(TOKEN_ENDPOINT)
        .set("Content-Type", "application/x-www-form-urlencoded")
        .send_string(&body)
        .map_err(|e| format!("Refresh token request failed: {}", e))?;

    let parsed: TokenResponse = response
        .into_json()
        .map_err(|e| format!("Failed to parse refresh response: {}", e))?;

    Ok(RefreshedTokens {
        access_token: parsed.access_token,
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
struct UserInfoResponse {
    #[serde(default)]
    email: Option<String>,
}

fn pkce_verifier() -> String {
    // 32 random bytes -> ~43 char URL-safe base64 (within 43-128 spec range)
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
        // Avoid `cmd /c start` — cmd.exe treats `&` in URLs as a command separator
        // and mangles OAuth URLs with multiple query params. rundll32 passes the
        // URL through to the shell's default protocol handler unmodified.
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
                "No response from Google after 2 minutes. If you saw an \"Access blocked\" or error page in the browser, your Google account may not be a test user on the OAuth consent screen, or the app hasn't been published. Cancel and try again."
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
                             <h2>Sign-in failed</h2><p>Google returned an error: <code>{}</code></p>\
                             <p>You can close this tab and try again.</p></body></html>",
                            html_escape(err),
                        ),
                    )
                } else if code.is_some() {
                    (
                        "200 OK",
                        "<html><body style=\"font-family:sans-serif;padding:2rem\">\
                             <h2>Signed in ✓</h2><p>You can close this tab and return to Bilet-X.</p>\
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
                    return Err(format!("Google OAuth error: {}", err));
                }
                let code = code.ok_or("Missing 'code' parameter from Google.")?;
                let state = state.ok_or("Missing 'state' parameter from Google.")?;
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
    // Format: "GET /?code=...&state=... HTTP/1.1\r\n"
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
        "code={}&client_id={}&client_secret={}&redirect_uri={}&grant_type=authorization_code&code_verifier={}",
        urlencoding::encode(code),
        urlencoding::encode(client_id),
        urlencoding::encode(client_secret),
        urlencoding::encode(redirect_uri),
        urlencoding::encode(verifier),
    );

    let response = ureq::post(TOKEN_ENDPOINT)
        .set("Content-Type", "application/x-www-form-urlencoded")
        .send_string(&body)
        .map_err(|e| format!("Token exchange failed: {}", e))?;

    response
        .into_json::<TokenResponse>()
        .map_err(|e| format!("Failed to parse token response: {}", e))
}

fn fetch_userinfo_email(access_token: &str) -> Result<String, String> {
    let response = ureq::get(USERINFO_ENDPOINT)
        .set("Authorization", &format!("Bearer {}", access_token))
        .call()
        .map_err(|e| format!("Userinfo request failed: {}", e))?;

    let info: UserInfoResponse = response
        .into_json()
        .map_err(|e| format!("Failed to parse userinfo: {}", e))?;

    info.email.ok_or_else(|| "No email in userinfo response.".to_string())
}

fn html_escape(s: &str) -> String {
    s.replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
}
