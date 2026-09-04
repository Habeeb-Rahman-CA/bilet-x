use std::sync::Mutex;
use std::time::Instant;

pub struct AppState {
    pub counter: Mutex<u32>,
    pub active_theme: Mutex<String>,
    pub total_invocations: Mutex<u64>,
    pub start_time: Instant,
}

impl Default for AppState {
    fn default() -> Self {
        Self {
            counter: Mutex::new(0),
            active_theme: Mutex::new("dark".to_string()),
            total_invocations: Mutex::new(0),
            start_time: Instant::now(),
        }
    }
}
