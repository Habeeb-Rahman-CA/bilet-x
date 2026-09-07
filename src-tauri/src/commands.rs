use crate::db::{NoteRepository, SettingsRepository, TaskRepository};
use crate::state::{AppState, InteractiveRect};
use tauri::{State, Window};

const VALID_TASK_STATUSES: &[&str] = &["pending", "in_progress", "completed"];
const VALID_TASK_PRIORITIES: &[&str] = &["low", "medium", "high"];
const VALID_THEMES: &[&str] = &["light", "dark"];
const VALID_WIDGET_POSITIONS: &[&str] = &[
    "left",
    "right",
    "top-left",
    "top-right",
    "bottom-left",
    "bottom-right",
];

const MAX_ID_LEN: usize = 100;
const MAX_TITLE_LEN: usize = 200;
const MAX_CONTENT_LEN: usize = 100_000;
const MAX_DESCRIPTION_LEN: usize = 10_000;
const MAX_SETTING_KEY_LEN: usize = 50;
const MAX_SETTING_VALUE_LEN: usize = 10_000;

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

fn validate_id(id: &str, field: &str) -> Result<(), String> {
    if id.is_empty() {
        return Err(format!("{} cannot be empty", field));
    }
    if id.len() > MAX_ID_LEN {
        return Err(format!(
            "{} too long: {} chars (max {})",
            field,
            id.len(),
            MAX_ID_LEN
        ));
    }
    Ok(())
}

fn require_max_len(value: &str, max: usize, field: &str) -> Result<(), String> {
    if value.len() > max {
        return Err(format!(
            "{} too long: {} chars (max {})",
            field,
            value.len(),
            max
        ));
    }
    Ok(())
}

fn validate_setting(key: &str, value: &str) -> Result<(), String> {
    if key.is_empty() {
        return Err("setting key cannot be empty".to_string());
    }
    require_max_len(key, MAX_SETTING_KEY_LEN, "setting key")?;
    require_max_len(value, MAX_SETTING_VALUE_LEN, "setting value")?;
    // For keys the app relies on, enforce the same enum on the write path
    // that consumers already assume on the read path.
    match key {
        "theme" => require_one_of(value, VALID_THEMES, "theme"),
        "widget_position" => require_one_of(value, VALID_WIDGET_POSITIONS, "widget_position"),
        _ => Ok(()),
    }
}

// --- WINDOW COMMANDS ---

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
pub fn window_set_focus(window: Window) -> Result<(), String> {
    window.set_focus().map_err(|e| e.to_string())
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
pub fn set_widget_position(window: Window, position: String) -> Result<(), String> {
    require_one_of(&position, VALID_WIDGET_POSITIONS, "position")?;

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

// --- SQLITE PERSISTENCE COMMANDS ---

#[tauri::command]
pub fn db_get_notes(db: State<'_, crate::db::Database>) -> Result<Vec<crate::models::NoteItem>, String> {
    db.get_all_notes().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn db_save_note(note: crate::models::NoteItem, db: State<'_, crate::db::Database>) -> Result<crate::models::NoteItem, String> {
    validate_id(&note.id, "note.id")?;
    require_max_len(&note.title, MAX_TITLE_LEN, "note.title")?;
    require_max_len(&note.content, MAX_CONTENT_LEN, "note.content")?;
    db.save_note(note).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn db_delete_note(id: String, db: State<'_, crate::db::Database>) -> Result<bool, String> {
    validate_id(&id, "id")?;
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
    validate_id(&task.id, "task.id")?;
    require_max_len(&task.title, MAX_TITLE_LEN, "task.title")?;
    require_max_len(&task.description, MAX_DESCRIPTION_LEN, "task.description")?;
    require_one_of(&task.status, VALID_TASK_STATUSES, "task.status")?;
    require_one_of(&task.priority, VALID_TASK_PRIORITIES, "task.priority")?;
    db.save_task(task).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn db_delete_task(id: String, db: State<'_, crate::db::Database>) -> Result<bool, String> {
    validate_id(&id, "id")?;
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
pub fn db_set_setting(key: String, value: String, db: State<'_, crate::db::Database>) -> Result<crate::models::SettingItem, String> {
    validate_setting(&key, &value)?;
    db.set_setting(&key, &value).map_err(|e| e.to_string())
}
