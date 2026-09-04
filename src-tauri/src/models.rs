use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SystemInfo {
    pub os: String,
    pub arch: String,
    pub rust_version: String,
    pub tauri_version: String,
    pub hostname: String,
    pub memory_info: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppStateInfo {
    pub counter: u32,
    pub active_theme: String,
    pub uptime_seconds: u64,
    pub total_invocations: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EventPayload {
    pub event_name: String,
    pub timestamp: String,
    pub message: String,
    pub sender: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CustomResponse<T> {
    pub success: bool,
    pub data: Option<T>,
    pub error: Option<String>,
}
