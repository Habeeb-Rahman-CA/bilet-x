use std::sync::{Arc, Mutex};
use std::time::Instant;

#[derive(Clone, Copy, Debug)]
pub struct InteractiveRect {
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
}

pub struct AppState {
    pub counter: Mutex<u32>,
    pub active_theme: Mutex<String>,
    pub total_invocations: Mutex<u64>,
    pub start_time: Instant,
    pub interactive_rect: Arc<Mutex<Option<InteractiveRect>>>,
}

impl Default for AppState {
    fn default() -> Self {
        Self {
            counter: Mutex::new(0),
            active_theme: Mutex::new("dark".to_string()),
            total_invocations: Mutex::new(0),
            start_time: Instant::now(),
            interactive_rect: Arc::new(Mutex::new(None)),
        }
    }
}
