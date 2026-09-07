use crate::models::{AppStateInfo, SystemInfo};
use crate::state::{AppState, InteractiveRect};
use tauri::{AppHandle, Emitter, State, Window};

const VALID_THEMES: &[&str] = &["light", "dark"];
const VALID_TASK_STATUSES: &[&str] = &["pending", "in_progress", "completed"];
const VALID_TASK_PRIORITIES: &[&str] = &["low", "medium", "high"];

fn require_one_of(value: &str, allowed: &[&str], field: &str) -> Result<(), String> {
    if allowed.contains(&value) {
        Ok(())
    } else {
        Err(format!(
            "invalid {}: '{}' (allowed: {})",
            field,
            value,
            allowed.join(", ")
        ))
    }
}

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
    require_one_of(&theme, VALID_THEMES, "theme")?;

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
pub fn set_window_size(window: Window, width: f64, height: f64) -> Result<(), String> {
    if !width.is_finite() || !height.is_finite() || width <= 0.0 || height <= 0.0 {
        return Err("width and height must be positive and finite".to_string());
    }

    const MIN_LOGICAL: f64 = 200.0; // matches minWidth/minHeight in tauri.conf.json
    let (max_w, max_h) = match window.primary_monitor() {
        Ok(Some(m)) => {
            let scale = window.scale_factor().unwrap_or(1.0);
            let s = m.size();
            (s.width as f64 / scale, s.height as f64 / scale)
        }
        _ => (f64::INFINITY, f64::INFINITY),
    };

    let clamped_w = width.clamp(MIN_LOGICAL, max_w.max(MIN_LOGICAL));
    let clamped_h = height.clamp(MIN_LOGICAL, max_h.max(MIN_LOGICAL));

    window
        .set_size(tauri::Size::Logical(tauri::LogicalSize {
            width: clamped_w,
            height: clamped_h,
        }))
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn window_set_focus(window: Window) -> Result<(), String> {
    window.set_focus().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn set_widget_position(window: Window, position: String) -> Result<(), String> {
    if let Ok(Some(monitor)) = window.primary_monitor() {
        let monitor_size = monitor.size();
        let window_size = window
            .outer_size()
            .unwrap_or(tauri::PhysicalSize { width: 640, height: 440 });

        let (x, y) = match position.as_str() {
            "left" => (
                10,
                ((monitor_size.height as i32) - (window_size.height as i32)) / 2,
            ),
            "top-left" => (10, 10),
            "bottom-left" => (
                10,
                (monitor_size.height as i32) - (window_size.height as i32) - 10,
            ),
            "top-right" => (
                (monitor_size.width as i32) - (window_size.width as i32) - 10,
                10,
            ),
            "bottom-right" => (
                (monitor_size.width as i32) - (window_size.width as i32) - 10,
                (monitor_size.height as i32) - (window_size.height as i32) - 10,
            ),
            _ => (
                // default "right"
                (monitor_size.width as i32) - (window_size.width as i32) - 10,
                ((monitor_size.height as i32) - (window_size.height as i32)) / 2,
            ),
        };

        window
            .set_position(tauri::Position::Physical(tauri::PhysicalPosition { x, y }))
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}




#[tauri::command]
pub fn set_interactive_area(
    x: f64,
    y: f64,
    width: f64,
    height: f64,
    state: State<'_, AppState>,
) -> Result<(), String> {
    // Reject degenerate rects: a zero/negative width or height would leave
    // the window fully click-through with no way to reach the dock — the
    // user would have to recover via the tray icon.
    if !x.is_finite() || !y.is_finite() || !width.is_finite() || !height.is_finite() {
        return Err("x, y, width, height must be finite".to_string());
    }
    if width <= 0.0 || height <= 0.0 {
        return Err("width and height must be positive".to_string());
    }

    let mut rect = state
        .interactive_rect
        .lock()
        .map_err(|e| format!("Lock error: {}", e))?;
    *rect = Some(InteractiveRect { x, y, width, height });
    Ok(())
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

// --- SQLITE PERSISTENCE COMMANDS VIA REPOSITORIES ---
use crate::db::{NoteRepository, SettingsRepository, TaskRepository};

#[tauri::command]
pub fn db_get_notes(db: State<'_, crate::db::Database>) -> Result<Vec<crate::models::NoteItem>, String> {
    db.get_all_notes().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn db_save_note(note: crate::models::NoteItem, db: State<'_, crate::db::Database>) -> Result<crate::models::NoteItem, String> {
    db.save_note(note).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn db_delete_note(id: String, db: State<'_, crate::db::Database>) -> Result<bool, String> {
    db.delete_note(&id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn db_clear_notes(db: State<'_, crate::db::Database>) -> Result<usize, String> {
    db.clear_all_notes().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn db_get_tasks(db: State<'_, crate::db::Database>) -> Result<Vec<crate::models::TaskItem>, String> {
    db.get_all_tasks().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn db_save_task(task: crate::models::TaskItem, db: State<'_, crate::db::Database>) -> Result<crate::models::TaskItem, String> {
    require_one_of(&task.status, VALID_TASK_STATUSES, "task.status")?;
    require_one_of(&task.priority, VALID_TASK_PRIORITIES, "task.priority")?;
    db.save_task(task).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn db_update_task_status(id: String, status: String, db: State<'_, crate::db::Database>) -> Result<bool, String> {
    require_one_of(&status, VALID_TASK_STATUSES, "status")?;
    db.update_task_status(&id, &status).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn db_delete_task(id: String, db: State<'_, crate::db::Database>) -> Result<bool, String> {
    db.delete_task(&id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn db_clear_tasks(db: State<'_, crate::db::Database>) -> Result<usize, String> {
    db.clear_all_tasks().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn db_get_settings(db: State<'_, crate::db::Database>) -> Result<Vec<crate::models::SettingItem>, String> {
    db.get_all_settings().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn db_get_setting(key: String, db: State<'_, crate::db::Database>) -> Result<Option<String>, String> {
    db.get_setting(&key).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn db_set_setting(key: String, value: String, db: State<'_, crate::db::Database>) -> Result<crate::models::SettingItem, String> {
    db.set_setting(&key, &value).map_err(|e| e.to_string())
}


fn chrono_like_timestamp() -> String {

    use std::time::{SystemTime, UNIX_EPOCH};
    let start = SystemTime::now();
    let since_the_epoch = start
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default();
    format!("{}s", since_the_epoch.as_secs())
}
