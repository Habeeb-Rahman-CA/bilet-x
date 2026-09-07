use std::sync::{Arc, Mutex};

#[derive(Clone, Copy, Debug)]
pub struct InteractiveRect {
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
}

#[derive(Default)]
pub struct AppState {
    pub interactive_rect: Arc<Mutex<Option<InteractiveRect>>>,
}
