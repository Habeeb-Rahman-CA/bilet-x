use crate::models::{AppStateInfo, SystemInfo};
use crate::state::AppState;
use tauri::{AppHandle, Emitter, State, Window};

#[tauri::command]
pub fn greet(name: &str, state: State<'_, AppState>) -> String {
    if let Ok(mut count) = state.total_invocations.lock() {
        *count += 1;
    }
    format!("Hello, {}! Greetings from Rust Tauri backend.", name)
}

#[tauri::command]
pub fn get_system_info(state: State<'_, AppState>) -> SystemInfo {
    if let Ok(mut count) = state.total_invocations.lock() {
        *count += 1;
    }

    SystemInfo {
        os: std::env::consts::OS.to_string(),
        arch: std::env::consts::ARCH.to_string(),
        rust_version: env!("CARGO_PKG_VERSION").to_string(),
        tauri_version: tauri::VERSION.to_string(),
        hostname: std::env::var("HOSTNAME")
            .or_else(|_| std::env::var("COMPUTERNAME"))
            .unwrap_or_else(|_| "localhost".to_string()),
        memory_info: "64-bit Architecture Active".to_string(),
    }
}

#[tauri::command]
pub fn get_app_state(state: State<'_, AppState>) -> AppStateInfo {
    if let Ok(mut count) = state.total_invocations.lock() {
        *count += 1;
    }

    let counter = state.counter.lock().map(|c| *c).unwrap_or(0);
    let active_theme = state
        .active_theme
        .lock()
        .map(|t| t.clone())
        .unwrap_or_else(|_| "dark".to_string());
    let total_invocations = state
        .total_invocations
        .lock()
        .map(|c| *c)
        .unwrap_or(0);
    let uptime_seconds = state.start_time.elapsed().as_secs();

    AppStateInfo {
        counter,
        active_theme,
        uptime_seconds,
        total_invocations,
    }
}

#[tauri::command]
pub fn increment_counter(state: State<'_, AppState>) -> u32 {
    if let Ok(mut count) = state.total_invocations.lock() {
        *count += 1;
    }

    if let Ok(mut counter) = state.counter.lock() {
        *counter += 1;
        *counter
    } else {
        0
    }
}

#[tauri::command]
pub fn set_theme(theme: String, state: State<'_, AppState>) -> Result<String, String> {
    if let Ok(mut count) = state.total_invocations.lock() {
        *count += 1;
    }

    let mut current_theme = state
        .active_theme
        .lock()
        .map_err(|e| format!("Lock error: {}", e))?;
    *current_theme = theme.clone();
    Ok(theme)
}

#[tauri::command]
pub fn window_minimize(window: Window) -> Result<(), String> {
    window.minimize().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn window_toggle_maximize(window: Window) -> Result<bool, String> {
    if window.is_maximized().unwrap_or(false) {
        window.unmaximize().map_err(|e| e.to_string())?;
        Ok(false)
    } else {
        window.maximize().map_err(|e| e.to_string())?;
        Ok(true)
    }
}

#[tauri::command]
pub fn window_close(window: Window) -> Result<(), String> {
    window.close().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn trigger_ping(app: AppHandle, message: String) -> Result<String, String> {
    let payload = serde_json::json!({
        "message": message,
        "timestamp": chrono_like_timestamp(),
        "status": "acknowledged"
    });

    app.emit("backend-ping-event", &payload)
        .map_err(|e| e.to_string())?;

    Ok(format!("Event emitted with message: '{}'", message))
}

fn chrono_like_timestamp() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let start = SystemTime::now();
    let since_the_epoch = start
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default();
    format!("{}s", since_the_epoch.as_secs())
}
