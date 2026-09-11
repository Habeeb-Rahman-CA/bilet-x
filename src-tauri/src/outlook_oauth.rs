use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine as _};
use rand::RngCore;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::io::{BufRead, BufReader, Write};
use std::net::TcpListener;
use std::time::{Duration, Instant};

// ============================================================================
// OAuth 2.0 Loopback Flow for Microsoft / Outlook via Microsoft Graph
//
// Client credentials come from environment variables baked in at compile
// time (same pattern as google_oauth.rs / jira_oauth.rs / github_oauth.rs).
// Add to the gitignored file at src-tauri/.cargo/config.toml:
//
//   [env]
//   OUTLOOK_CLIENT_ID = "your-azure-app-registration-application-id"
//
// Register an app at https://portal.azure.com/ → Microsoft Entra ID →
// App registrations → New registration:
//   - Name:                            Bilet-X (or whatever)
//   - Supported account types:         "Accounts in any organizational
//                                       directory (Multitenant) and personal
//                                       Microsoft accounts (Skype, Xbox)"
//   - Redirect URI (Public client / native): http://localhost:43730
//
// Then under Authentication:
//   - Allow public client flows: Yes
//
// Under API permissions add delegated Microsoft Graph scopes:
//   Mail.Read, Mail.ReadWrite, User.Read, offline_access
// (offline_access buys us a refresh token; without it the session dies in
// about an hour.)
//
// A client secret is NOT required for public client flows on Microsoft's
// v2.0 endpoint — PKCE replaces the secret. We only need CLIENT_ID.
// ============================================================================
const OUTLOOK_CLIENT_ID: Option<&str> = option_env!("OUTLOOK_CLIENT_ID");

const LOOPBACK_PORT: u16 = 43730;

fn require_credentials() -> Result<&'static str, String> {
    match OUTLOOK_CLIENT_ID {
        Some(id) if !id.is_empty() => Ok(id),
        _ => Err(
            "OUTLOOK_CLIENT_ID not set at build time. Add it to src-tauri/.cargo/config.toml and rebuild."
                .to_string(),
        ),
    }
}

// `common` tenant accepts both work/school (Entra ID) and personal (outlook.com,
// live.com, hotmail.com) accounts. The app must be registered as multi-tenant
// + personal accounts for this to work.
const AUTH_ENDPOINT: &str = "https://login.microsoftonline.com/common/oauth2/v2.0/authorize";
const TOKEN_ENDPOINT: &str = "https://login.microsoftonline.com/common/oauth2/v2.0/token";
const USERINFO_ENDPOINT: &str = "https://graph.microsoft.com/v1.0/me";

// Delegated Graph scopes:
//   Mail.Read        — read mail
//   Mail.ReadWrite   — mark-as-read / flag toggling
//   User.Read        — /me profile
//   offline_access   — refresh_token issuance
const SCOPES: &str = "Mail.Read Mail.ReadWrite User.Read offline_access";

const CALLBACK_TIMEOUT_SECS: u64 = 120;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct OutlookTokens {
    pub access_token: String,
    pub refresh_token: String,
    pub expires_in: u64,
    pub email: String,
    pub display_name: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct RefreshedOutlookTokens {
    pub access_token: String,
    pub refresh_token: String,
    pub expires_in: u64,
}

pub fn run_login_flow() -> Result<OutlookTokens, String> {
    let client_id = require_credentials()?;

    // Bind on IPv4 loopback explicitly — modern browsers resolve `localhost`
    // to 127.0.0.1 first, so a v4-only listener catches the redirect fine.
    let listener = TcpListener::bind(("127.0.0.1", LOOPBACK_PORT))
        .map_err(|e| format!(
            "Failed to bind loopback listener on port {} (needed for Microsoft's registered redirect URI): {}",
            LOOPBACK_PORT, e
        ))?;
    // Microsoft's docs consistently reference `http://localhost` (not
    // 127.0.0.1) as the loopback redirect. Some tenants reject the IP form,
    // so we send `localhost` — the browser still resolves it to 127.0.0.1
    // and hits our listener above.
    let redirect_uri = format!("http://localhost:{}", LOOPBACK_PORT);

    let verifier = pkce_verifier();
    let challenge = pkce_challenge(&verifier);
    let state = random_url_safe(32);

    let auth_url = format!(
        "{}?client_id={}&response_type=code&redirect_uri={}&response_mode=query&scope={}&state={}&code_challenge={}&code_challenge_method=S256&prompt=select_account",
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

    let refresh_token = token_response.refresh_token.ok_or_else(|| {
        "Microsoft did not return a refresh_token. Make sure the OAuth request includes the 'offline_access' scope and try again."
            .to_string()
    })?;

    let (email, display_name) = fetch_userinfo(&token_response.access_token)
        .unwrap_or_else(|_| (String::new(), String::new()));

    Ok(OutlookTokens {
        access_token: token_response.access_token,
        refresh_token,
        expires_in: token_response.expires_in.unwrap_or(3600),
        email,
        display_name,
    })
}

pub fn refresh_access_token(refresh_token: &str) -> Result<RefreshedOutlookTokens, String> {
    let client_id = require_credentials()?;

    // Microsoft's v2 token endpoint takes form-urlencoded, not JSON.
    let body = format!(
        "client_id={}&grant_type=refresh_token&refresh_token={}&scope={}",
        urlencoding::encode(client_id),
        urlencoding::encode(refresh_token),
        urlencoding::encode(SCOPES),
    );

    let response = ureq::post(TOKEN_ENDPOINT)
        .set("Content-Type", "application/x-www-form-urlencoded")
        .set("Accept", "application/json")
        .send_string(&body)
        .map_err(|e| format!("Refresh token request failed: {}", e))?;

    let parsed: TokenResponse = response
        .into_json()
        .map_err(|e| format!("Failed to parse refresh response: {}", e))?;

    Ok(RefreshedOutlookTokens {
        access_token: parsed.access_token,
        refresh_token: parsed
            .refresh_token
            .unwrap_or_else(|| refresh_token.to_string()),
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
struct GraphMe {
    #[serde(default, rename = "userPrincipalName")]
    user_principal_name: Option<String>,
    #[serde(default)]
    mail: Option<String>,
    #[serde(default, rename = "displayName")]
    display_name: Option<String>,
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
                "No response from Microsoft after 2 minutes. If the browser shows an error page, verify the app's redirect URI is registered exactly as http://localhost:43730 under 'Public client / native (mobile & desktop)'. Cancel and try again."
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
                             <h2>Sign-in failed</h2><p>Microsoft returned an error: <code>{}</code></p>\
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
                    return Err(format!("Microsoft OAuth error: {}", err));
                }
                let code = code.ok_or("Missing 'code' parameter from Microsoft.")?;
                let state = state.ok_or("Missing 'state' parameter from Microsoft.")?;
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
    let client_id = require_credentials()?;

    let body = format!(
        "client_id={}&grant_type=authorization_code&code={}&redirect_uri={}&code_verifier={}&scope={}",
        urlencoding::encode(client_id),
        urlencoding::encode(code),
        urlencoding::encode(redirect_uri),
        urlencoding::encode(verifier),
        urlencoding::encode(SCOPES),
    );

    let response = ureq::post(TOKEN_ENDPOINT)
        .set("Content-Type", "application/x-www-form-urlencoded")
        .set("Accept", "application/json")
        .send_string(&body)
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

    let info: GraphMe = response
        .into_json()
        .map_err(|e| format!("Failed to parse userinfo: {}", e))?;

    // Personal accounts often return the mailbox address in userPrincipalName,
    // while work accounts typically expose it in `mail`. Prefer `mail` if
    // present, otherwise fall back to UPN.
    let email = info.mail.filter(|s| !s.is_empty()).unwrap_or_else(|| info.user_principal_name.unwrap_or_default());
    let display_name = info.display_name.unwrap_or_default();
    Ok((email, display_name))
}

fn html_escape(s: &str) -> String {
    s.replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
}
