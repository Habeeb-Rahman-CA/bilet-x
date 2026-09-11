use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine as _};
use rand::RngCore;
use serde::{Deserialize, Serialize};
use std::io::{BufRead, BufReader, Write};
use std::net::TcpListener;
use std::time::{Duration, Instant};

// ============================================================================
// OAuth 2.0 Loopback Flow for Meta / WhatsApp Business Cloud API
//
// Client credentials come from environment variables baked in at compile
// time. Add to the gitignored file at src-tauri/.cargo/config.toml:
//
//   [env]
//   WHATSAPP_CLIENT_ID     = "your-meta-app-id"
//   WHATSAPP_CLIENT_SECRET = "your-meta-app-secret"
//
// Setup:
//   1. Create an app at https://developers.facebook.com/apps/ → Business type
//   2. Add product: "WhatsApp" (creates a test WABA + phone number)
//   3. Add product: "Facebook Login for Business"
//   4. Under Facebook Login → Settings, add redirect URI:
//         http://localhost:43731
//      Also set "Client OAuth Login" and "Web OAuth Login" = Yes.
//   5. App Settings → Basic → copy App ID + App Secret into config.toml
//   6. While the app is in Development mode, only assigned roles
//      (Admin/Developer/Tester) can OAuth into it. Add yourself under
//      App Roles → Roles.
//
// NOTE: WhatsApp Cloud API delivers inbound messages via webhook only —
// there's no polling endpoint for received messages. This flow gives us
// access to WABA metadata (phone numbers, templates) and outbound send
// capability, but not a live inbox.
// ============================================================================
const WHATSAPP_CLIENT_ID: Option<&str> = option_env!("WHATSAPP_CLIENT_ID");
const WHATSAPP_CLIENT_SECRET: Option<&str> = option_env!("WHATSAPP_CLIENT_SECRET");

const LOOPBACK_PORT: u16 = 43731;

fn require_credentials() -> Result<(&'static str, &'static str), String> {
    match (WHATSAPP_CLIENT_ID, WHATSAPP_CLIENT_SECRET) {
        (Some(id), Some(secret)) if !id.is_empty() && !secret.is_empty() => Ok((id, secret)),
        _ => Err(
            "WHATSAPP_CLIENT_ID / WHATSAPP_CLIENT_SECRET not set at build time. Add them to src-tauri/.cargo/config.toml and rebuild."
                .to_string(),
        ),
    }
}

const GRAPH_VERSION: &str = "v20.0";
const AUTH_ENDPOINT: &str = "https://www.facebook.com/v20.0/dialog/oauth";
const TOKEN_ENDPOINT: &str = "https://graph.facebook.com/v20.0/oauth/access_token";
const ME_ENDPOINT: &str = "https://graph.facebook.com/v20.0/me";
const BUSINESSES_ENDPOINT: &str = "https://graph.facebook.com/v20.0/me/businesses";

// Delegated Meta scopes for WhatsApp Business Cloud API:
//   whatsapp_business_management — read WABA + template metadata
//   whatsapp_business_messaging  — send/receive messages via Cloud API
//
// business_management would let us auto-discover WABAs via /me/businesses,
// but Meta doesn't enable it by default on new apps — requesting it triggers
// "Invalid Scopes: business_management" unless the app owner explicitly adds
// it under App Review → Permissions and Features. Skipping it keeps the flow
// working on a fresh app; auto-discovery becomes best-effort and simply
// returns empty on apps without the scope granted. The UI already handles
// the "no WABA linked" state and prompts the user to configure via Meta
// Business Manager.
const SCOPES: &str = "whatsapp_business_management,whatsapp_business_messaging";

const CALLBACK_TIMEOUT_SECS: u64 = 120;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct WhatsAppPhoneNumber {
    pub id: String,
    pub display_phone_number: String,
    pub verified_name: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct WhatsAppTokens {
    pub access_token: String,
    /// Seconds until the long-lived token expires (~60 days for Meta long-lived
    /// user tokens). No refresh_token — the user re-signs in when it expires.
    pub expires_in: u64,
    pub user_id: String,
    pub user_name: String,
    /// First discovered WhatsApp Business Account, if any. Empty when the
    /// account has no WABAs yet.
    pub waba_id: String,
    pub waba_name: String,
    pub business_id: String,
    pub business_name: String,
    pub phone_numbers: Vec<WhatsAppPhoneNumber>,
}

pub fn run_login_flow() -> Result<WhatsAppTokens, String> {
    let (client_id, _client_secret) = require_credentials()?;

    let listener = TcpListener::bind(("127.0.0.1", LOOPBACK_PORT))
        .map_err(|e| format!(
            "Failed to bind loopback listener on port {} (needed for Meta's registered redirect URI): {}",
            LOOPBACK_PORT, e
        ))?;
    // Meta accepts both localhost and 127.0.0.1 for loopback redirects; use
    // localhost to match their documentation examples.
    let redirect_uri = format!("http://localhost:{}", LOOPBACK_PORT);

    let state = random_url_safe(32);

    // Meta's OAuth dialog. We don't use PKCE here — Meta's flow is a
    // confidential-client-style exchange that requires client_secret at token
    // time anyway.
    let auth_url = format!(
        "{}?client_id={}&redirect_uri={}&scope={}&state={}&response_type=code&auth_type=rerequest",
        AUTH_ENDPOINT,
        urlencoding::encode(client_id),
        urlencoding::encode(&redirect_uri),
        urlencoding::encode(SCOPES),
        urlencoding::encode(&state),
    );

    open_url_in_browser(&auth_url)?;

    let (code, returned_state) = wait_for_callback(&listener)?;
    if returned_state != state {
        return Err("OAuth state mismatch (possible CSRF).".to_string());
    }

    let short_lived = exchange_code(&code, &redirect_uri)?;
    // Immediately upgrade to a long-lived user token (~60 days). Short-lived
    // tokens die in about an hour, which would be a lousy widget UX.
    let long_lived = exchange_for_long_lived(&short_lived.access_token)?;

    let (user_id, user_name) = fetch_me(&long_lived.access_token)
        .unwrap_or_else(|_| (String::new(), String::new()));

    let (business_id, business_name, waba_id, waba_name, phone_numbers) =
        discover_first_waba(&long_lived.access_token).unwrap_or_else(|err| {
            // Discovery is best-effort — the user might not have a WABA yet.
            // Sign-in should still succeed; the UI can prompt them to finish
            // WhatsApp onboarding in Meta Business Manager.
            eprintln!("[WhatsApp] WABA discovery failed: {}", err);
            (String::new(), String::new(), String::new(), String::new(), vec![])
        });

    Ok(WhatsAppTokens {
        access_token: long_lived.access_token,
        expires_in: long_lived.expires_in.unwrap_or(60 * 24 * 3600),
        user_id,
        user_name,
        waba_id,
        waba_name,
        business_id,
        business_name,
        phone_numbers,
    })
}

// ----------------------------------------------------------------------------
// Internals
// ----------------------------------------------------------------------------

#[derive(Debug, Deserialize)]
struct TokenResponse {
    access_token: String,
    #[serde(default)]
    expires_in: Option<u64>,
}

#[derive(Debug, Deserialize)]
struct GraphMe {
    #[serde(default)]
    id: Option<String>,
    #[serde(default)]
    name: Option<String>,
}

#[derive(Debug, Deserialize)]
struct BusinessesResponse {
    #[serde(default)]
    data: Vec<BusinessEntry>,
}

#[derive(Debug, Deserialize)]
struct BusinessEntry {
    id: String,
    #[serde(default)]
    name: Option<String>,
    #[serde(default)]
    owned_whatsapp_business_accounts: Option<WabaConnection>,
    #[serde(default)]
    client_whatsapp_business_accounts: Option<WabaConnection>,
}

#[derive(Debug, Deserialize)]
struct WabaConnection {
    #[serde(default)]
    data: Vec<WabaEntry>,
}

#[derive(Debug, Deserialize)]
struct WabaEntry {
    id: String,
    #[serde(default)]
    name: Option<String>,
    #[serde(default)]
    phone_numbers: Option<PhoneNumbersResponse>,
}

#[derive(Debug, Deserialize)]
struct PhoneNumbersResponse {
    #[serde(default)]
    data: Vec<PhoneNumberEntry>,
}

#[derive(Debug, Deserialize)]
struct PhoneNumberEntry {
    id: String,
    #[serde(default)]
    display_phone_number: Option<String>,
    #[serde(default)]
    verified_name: Option<String>,
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
                "No response from Meta after 2 minutes. If the browser shows an error page, verify http://localhost:43731 is in your app's Facebook Login → Valid OAuth Redirect URIs. Cancel and try again."
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
                             <h2>Sign-in failed</h2><p>Meta returned an error: <code>{}</code></p>\
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
                    return Err(format!("Meta OAuth error: {}", err));
                }
                let code = code.ok_or("Missing 'code' parameter from Meta.")?;
                let state = state.ok_or("Missing 'state' parameter from Meta.")?;
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

fn exchange_code(code: &str, redirect_uri: &str) -> Result<TokenResponse, String> {
    let (client_id, client_secret) = require_credentials()?;

    // Meta's v20.0 token endpoint is a GET with query params (unlike Google
    // and Microsoft which use POST body).
    let url = format!(
        "{}?client_id={}&client_secret={}&redirect_uri={}&code={}",
        TOKEN_ENDPOINT,
        urlencoding::encode(client_id),
        urlencoding::encode(client_secret),
        urlencoding::encode(redirect_uri),
        urlencoding::encode(code),
    );

    let response = ureq::get(&url)
        .set("Accept", "application/json")
        .call()
        .map_err(|e| format!("Token exchange failed: {}", e))?;

    response
        .into_json::<TokenResponse>()
        .map_err(|e| format!("Failed to parse token response: {}", e))
}

fn exchange_for_long_lived(short_lived: &str) -> Result<TokenResponse, String> {
    let (client_id, client_secret) = require_credentials()?;

    let url = format!(
        "{}?grant_type=fb_exchange_token&client_id={}&client_secret={}&fb_exchange_token={}",
        TOKEN_ENDPOINT,
        urlencoding::encode(client_id),
        urlencoding::encode(client_secret),
        urlencoding::encode(short_lived),
    );

    let response = ureq::get(&url)
        .set("Accept", "application/json")
        .call()
        .map_err(|e| format!("Long-lived token exchange failed: {}", e))?;

    response
        .into_json::<TokenResponse>()
        .map_err(|e| format!("Failed to parse long-lived token response: {}", e))
}

fn fetch_me(access_token: &str) -> Result<(String, String), String> {
    let url = format!("{}?fields=id,name", ME_ENDPOINT);
    let response = ureq::get(&url)
        .set("Authorization", &format!("Bearer {}", access_token))
        .set("Accept", "application/json")
        .call()
        .map_err(|e| format!("Me endpoint failed: {}", e))?;

    let me: GraphMe = response
        .into_json()
        .map_err(|e| format!("Failed to parse /me: {}", e))?;

    Ok((me.id.unwrap_or_default(), me.name.unwrap_or_default()))
}

fn discover_first_waba(
    access_token: &str,
) -> Result<(String, String, String, String, Vec<WhatsAppPhoneNumber>), String> {
    // One-shot Graph query: pull every business the user is on plus its owned
    // AND client WABAs plus each WABA's phone numbers. Cheap in one round trip.
    let fields =
        "id,name,owned_whatsapp_business_accounts{id,name,phone_numbers{id,display_phone_number,verified_name}},client_whatsapp_business_accounts{id,name,phone_numbers{id,display_phone_number,verified_name}}";
    let url = format!(
        "{}?fields={}",
        BUSINESSES_ENDPOINT,
        urlencoding::encode(fields),
    );

    let response = ureq::get(&url)
        .set("Authorization", &format!("Bearer {}", access_token))
        .set("Accept", "application/json")
        .call()
        .map_err(|e| format!("Businesses endpoint failed: {}", e))?;

    let parsed: BusinessesResponse = response
        .into_json()
        .map_err(|e| format!("Failed to parse businesses response: {}", e))?;

    for business in parsed.data {
        // Prefer owned WABAs, fall back to client WABAs (WABAs the user
        // manages but doesn't legally own).
        let candidates = business
            .owned_whatsapp_business_accounts
            .into_iter()
            .flat_map(|c| c.data)
            .chain(
                business
                    .client_whatsapp_business_accounts
                    .into_iter()
                    .flat_map(|c| c.data),
            );

        for waba in candidates {
            let phone_numbers = waba
                .phone_numbers
                .map(|p| {
                    p.data
                        .into_iter()
                        .map(|pn| WhatsAppPhoneNumber {
                            id: pn.id,
                            display_phone_number: pn.display_phone_number.unwrap_or_default(),
                            verified_name: pn.verified_name.unwrap_or_default(),
                        })
                        .collect()
                })
                .unwrap_or_default();

            return Ok((
                business.id,
                business.name.unwrap_or_default(),
                waba.id,
                waba.name.unwrap_or_default(),
                phone_numbers,
            ));
        }
    }

    Err("No WhatsApp Business Account found on this Meta account. Complete WhatsApp onboarding in Business Manager first.".to_string())
}

fn html_escape(s: &str) -> String {
    s.replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
}

// Silence "unused constant" if GRAPH_VERSION is only referenced in docs above.
#[allow(dead_code)]
const _: &str = GRAPH_VERSION;
