// ============================================================================
// Slack Web API HTTP proxy.
//
// Slack's Web API (slack.com/api/*) does not send CORS response headers, so
// fetch() from the Angular webview is blocked. These helpers run in the Rust
// process (via `ureq`) where CORS doesn't apply, and return the raw response
// body to the caller for JSON parsing on the Angular side.
//
// Only the alphanumeric + dot + underscore path shape is allowed. That's
// enough for every documented method (e.g. conversations.list, users.info)
// and prevents callers from smuggling arbitrary URLs into the proxy.
// ============================================================================

const API_BASE: &str = "https://slack.com/api";

pub fn api_get(token: &str, path: &str, query: &str) -> Result<String, String> {
    validate_path(path)?;
    let url = if query.is_empty() {
        format!("{}/{}", API_BASE, path)
    } else {
        format!("{}/{}?{}", API_BASE, path, query)
    };

    let response = ureq::get(&url)
        .set("Authorization", &format!("Bearer {}", token))
        .set("Accept", "application/json")
        .call()
        .map_err(|e| format!("Slack GET {} failed: {}", path, e))?;

    response
        .into_string()
        .map_err(|e| format!("Failed to read Slack response: {}", e))
}

pub fn api_post(token: &str, path: &str, body: &str) -> Result<String, String> {
    validate_path(path)?;
    let url = format!("{}/{}", API_BASE, path);

    let response = ureq::post(&url)
        .set("Authorization", &format!("Bearer {}", token))
        .set("Content-Type", "application/x-www-form-urlencoded")
        .set("Accept", "application/json")
        .send_string(body)
        .map_err(|e| format!("Slack POST {} failed: {}", path, e))?;

    response
        .into_string()
        .map_err(|e| format!("Failed to read Slack response: {}", e))
}

fn validate_path(path: &str) -> Result<(), String> {
    if path.is_empty() {
        return Err("Slack API path cannot be empty".to_string());
    }
    if path.len() > 128 {
        return Err("Slack API path too long".to_string());
    }
    if !path
        .chars()
        .all(|c| c.is_ascii_alphanumeric() || c == '.' || c == '_')
    {
        return Err(format!(
            "Slack API path '{}' contains invalid characters (only alphanumeric, '.', '_' allowed)",
            path
        ));
    }
    Ok(())
}
