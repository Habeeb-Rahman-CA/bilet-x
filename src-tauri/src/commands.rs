use crate::db::{
    ActivityRepository, ClipboardRepository, NoteRepository, SettingsRepository, TaskRepository,
};
use crate::google_oauth::{self, GoogleTokens, RefreshedTokens};
use crate::jira_oauth::{self, JiraTokens, RefreshedJiraTokens};
use crate::state::{AppState, InteractiveRect};
use tauri::{State, Window};

const ACTIVITY_LOG_LIMIT_MAX: u32 = 500;
// Settings keys we surface in the activity feed. Others (widget_x, widget_y)
// are set by Rust itself on drag and would flood the log.
const USER_FACING_SETTING_KEYS: &[&str] = &[
    "theme",
    "widget_position",
    "global_shortcut",
    "notifications_enabled",
    "dock_size",
    "dock_auto_hide",
    "dock_orientation",
    "tab_notes_visible",
    "tab_tasks_visible",
    "tab_messages_visible",
    "tab_jira_visible",
    "tab_calendar_visible",
    "tab_calculator_visible",
    "tab_pomodoro_visible",
    "tab_clipboard_visible",
    "tab_activity_visible",
    "tab_settings_visible",
    "pomodoro_focus_minutes",
    "pomodoro_break_minutes",
    "clipboard_capture_enabled",
];

const VALID_TASK_STATUSES: &[&str] = &["pending", "in_progress", "completed"];
const VALID_TASK_PRIORITIES: &[&str] = &["low", "medium", "high"];
const VALID_THEMES: &[&str] = &["light", "dark"];
const VALID_WIDGET_POSITIONS: &[&str] = &[
    "left",
    "right",
    "top",
    "bottom",
    "top-left",
    "top-right",
    "bottom-left",
    "bottom-right",
];
const VALID_BOOL_STRINGS: &[&str] = &["true", "false"];
const VALID_DOCK_SIZES: &[&str] = &["compact", "normal", "large"];
const VALID_DOCK_ORIENTATIONS: &[&str] = &["vertical", "horizontal"];

const MAX_ID_LEN: usize = 100;
const MAX_TITLE_LEN: usize = 200;
const MAX_CONTENT_LEN: usize = 100_000;
const MAX_DESCRIPTION_LEN: usize = 10_000;
const MAX_SETTING_KEY_LEN: usize = 50;
const MAX_SETTING_VALUE_LEN: usize = 10_000;
const MAX_SHORTCUT_LEN: usize = 100;
const MAX_NOTIFICATION_TITLE_LEN: usize = 200;
const MAX_NOTIFICATION_BODY_LEN: usize = 1_000;

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

fn require_bounded_u32(value: &str, min: u32, max: u32, field: &str) -> Result<(), String> {
    let n: u32 = value
        .parse()
        .map_err(|_| format!("{} must be a positive integer", field))?;
    if n < min || n > max {
        return Err(format!("{} must be between {} and {}", field, min, max));
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
        "global_shortcut" => require_max_len(value, MAX_SHORTCUT_LEN, "global_shortcut"),
        "notifications_enabled" => {
            require_one_of(value, VALID_BOOL_STRINGS, "notifications_enabled")
        }
        "dock_size" => require_one_of(value, VALID_DOCK_SIZES, "dock_size"),
        "dock_orientation" => require_one_of(value, VALID_DOCK_ORIENTATIONS, "dock_orientation"),
        "dock_auto_hide"
        | "tab_notes_visible"
        | "tab_tasks_visible"
        | "tab_messages_visible"
        | "tab_jira_visible"
        | "tab_calendar_visible"
        | "tab_calculator_visible"
        | "tab_pomodoro_visible"
        | "tab_clipboard_visible"
        | "tab_activity_visible"
        | "tab_settings_visible"
        | "clipboard_capture_enabled" => require_one_of(value, VALID_BOOL_STRINGS, key),
        "pomodoro_focus_minutes" => require_bounded_u32(value, 1, 120, key),
        "pomodoro_break_minutes" => require_bounded_u32(value, 1, 60, key),
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
pub fn set_window_position(window: Window, x: f64, y: f64) -> Result<(), String> {
    if !x.is_finite() || !y.is_finite() {
        return Err("x and y must be finite".to_string());
    }
    // Coarse sanity cap so a rogue caller can't shoot the window to a distant
    // virtual-desktop coordinate that no user would ever intend. 100_000 logical
    // pixels covers even large multi-monitor setups.
    const MAX_COORD: f64 = 100_000.0;
    if x.abs() > MAX_COORD || y.abs() > MAX_COORD {
        return Err(format!("x and y must be within +/-{} px", MAX_COORD));
    }
    window
        .set_position(tauri::Position::Logical(tauri::LogicalPosition { x, y }))
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn set_widget_position(window: Window, position: String) -> Result<(), String> {
    require_one_of(&position, VALID_WIDGET_POSITIONS, "position")?;

    let Some(monitor) = window.primary_monitor().ok().flatten() else {
        return Ok(());
    };
    let monitor_size = monitor.size();
    let window_size = window.outer_size().unwrap_or(tauri::PhysicalSize {
        width: 640,
        height: 440,
    });

    let (target_x, target_y) = match position.as_str() {
        "left" => (
            10,
            ((monitor_size.height as i32) - (window_size.height as i32)) / 2,
        ),
        "top" => (
            ((monitor_size.width as i32) - (window_size.width as i32)) / 2,
            10,
        ),
        "bottom" => (
            ((monitor_size.width as i32) - (window_size.width as i32)) / 2,
            (monitor_size.height as i32) - (window_size.height as i32) - 10,
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
            (monitor_size.width as i32) - (window_size.width as i32) - 10,
            ((monitor_size.height as i32) - (window_size.height as i32)) / 2,
        ),
    };

    let start_pos = window.outer_position().map_err(|e| e.to_string())?;
    let start_x = start_pos.x as f64;
    let start_y = start_pos.y as f64;
    let target_x_f = target_x as f64;
    let target_y_f = target_y as f64;

    // Spawn a short animation thread so the window slides to the preset
    // instead of teleporting. easeOutCubic: fast start, decelerates into
    // the target. Sub-pixel step values are truncated on set_position, but
    // 15 frames over ~250ms is small enough that the truncation isn't
    // visible.
    let win = window.clone();
    std::thread::spawn(move || {
        const FRAMES: u32 = 15;
        const TOTAL_MS: u64 = 250;
        let frame_ms = TOTAL_MS / FRAMES as u64;
        for i in 1..=FRAMES {
            let t = i as f64 / FRAMES as f64;
            let eased = 1.0 - (1.0 - t).powi(3);
            let cx = (start_x + (target_x_f - start_x) * eased) as i32;
            let cy = (start_y + (target_y_f - start_y) * eased) as i32;
            let _ = win.set_position(tauri::Position::Physical(
                tauri::PhysicalPosition { x: cx, y: cy },
            ));
            std::thread::sleep(std::time::Duration::from_millis(frame_ms));
        }
        // Land exactly on target in case rounding drifted.
        let _ = win.set_position(tauri::Position::Physical(
            tauri::PhysicalPosition {
                x: target_x,
                y: target_y,
            },
        ));
    });

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
    *rect = Some(InteractiveRect {
        x,
        y,
        width,
        height,
    });
    Ok(())
}

// --- SQLITE PERSISTENCE COMMANDS ---

#[tauri::command]
pub fn db_get_notes(
    db: State<'_, crate::db::Database>,
) -> Result<Vec<crate::models::NoteItem>, String> {
    db.get_all_notes().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn db_save_note(
    note: crate::models::NoteItem,
    db: State<'_, crate::db::Database>,
) -> Result<crate::models::NoteItem, String> {
    validate_id(&note.id, "note.id")?;
    require_max_len(&note.title, MAX_TITLE_LEN, "note.title")?;
    require_max_len(&note.content, MAX_CONTENT_LEN, "note.content")?;
    let is_scratchpad = note.id == "main_scratchpad";
    let title_for_log = note.title.clone();
    let saved = db.save_note(note).map_err(|e| e.to_string())?;
    // Skip scratchpad autosaves — they fire on every keystroke and would
    // drown the activity log.
    if !is_scratchpad {
        let _ = db.add_activity("note", "saved", &format!("Saved note \"{}\"", title_for_log));
    }
    Ok(saved)
}

#[tauri::command]
pub fn db_delete_note(id: String, db: State<'_, crate::db::Database>) -> Result<bool, String> {
    validate_id(&id, "id")?;
    let ok = db.delete_note(&id).map_err(|e| e.to_string())?;
    let _ = db.add_activity("note", "deleted", &format!("Deleted note {}", id));
    Ok(ok)
}

#[tauri::command]
pub fn db_clear_notes(db: State<'_, crate::db::Database>) -> Result<usize, String> {
    let n = db.clear_all_notes().map_err(|e| e.to_string())?;
    let _ = db.add_activity("note", "cleared", &format!("Cleared all notes ({})", n));
    Ok(n)
}

#[tauri::command]
pub fn db_get_tasks(
    db: State<'_, crate::db::Database>,
) -> Result<Vec<crate::models::TaskItem>, String> {
    db.get_all_tasks().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn db_save_task(
    task: crate::models::TaskItem,
    db: State<'_, crate::db::Database>,
) -> Result<crate::models::TaskItem, String> {
    validate_id(&task.id, "task.id")?;
    require_max_len(&task.title, MAX_TITLE_LEN, "task.title")?;
    require_max_len(&task.description, MAX_DESCRIPTION_LEN, "task.description")?;
    require_one_of(&task.status, VALID_TASK_STATUSES, "task.status")?;
    require_one_of(&task.priority, VALID_TASK_PRIORITIES, "task.priority")?;
    let title_for_log = task.title.clone();
    let saved = db.save_task(task).map_err(|e| e.to_string())?;
    let _ = db.add_activity("task", "saved", &format!("Saved task \"{}\"", title_for_log));
    Ok(saved)
}

#[tauri::command]
pub fn db_delete_task(id: String, db: State<'_, crate::db::Database>) -> Result<bool, String> {
    validate_id(&id, "id")?;
    let ok = db.delete_task(&id).map_err(|e| e.to_string())?;
    let _ = db.add_activity("task", "deleted", &format!("Deleted task {}", id));
    Ok(ok)
}

#[tauri::command]
pub fn db_clear_tasks(db: State<'_, crate::db::Database>) -> Result<usize, String> {
    let n = db.clear_all_tasks().map_err(|e| e.to_string())?;
    let _ = db.add_activity("task", "cleared", &format!("Cleared all tasks ({})", n));
    Ok(n)
}

#[tauri::command]
pub fn db_get_settings(
    db: State<'_, crate::db::Database>,
) -> Result<Vec<crate::models::SettingItem>, String> {
    db.get_all_settings().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn db_set_setting(
    key: String,
    value: String,
    db: State<'_, crate::db::Database>,
) -> Result<crate::models::SettingItem, String> {
    validate_setting(&key, &value)?;
    let saved = db.set_setting(&key, &value).map_err(|e| e.to_string())?;
    if USER_FACING_SETTING_KEYS.contains(&key.as_str()) {
        let _ = db.add_activity(
            "setting",
            "changed",
            &format!("Set {} to \"{}\"", key, value),
        );
    }
    Ok(saved)
}

#[tauri::command]
pub fn db_get_activities(
    limit: u32,
    db: State<'_, crate::db::Database>,
) -> Result<Vec<crate::models::ActivityItem>, String> {
    if limit == 0 || limit > ACTIVITY_LOG_LIMIT_MAX {
        return Err(format!(
            "limit must be between 1 and {}",
            ACTIVITY_LOG_LIMIT_MAX
        ));
    }
    db.get_recent_activities(limit).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn db_clear_activities(db: State<'_, crate::db::Database>) -> Result<usize, String> {
    let n = db.clear_activities().map_err(|e| e.to_string())?;
    let _ = db.add_activity("activity", "cleared", &format!("Cleared activity log ({})", n));
    Ok(n)
}

// --- CLIPBOARD COMMANDS ---

const CLIPBOARD_MAX_ENTRIES: u32 = 100;

// Native clipboard read via `arboard`. Returns "" for non-text/empty clipboard
// rather than an error so the frontend polling loop stays quiet.
#[tauri::command]
pub fn clipboard_read_text() -> Result<String, String> {
    let mut cb = arboard::Clipboard::new().map_err(|e| e.to_string())?;
    match cb.get_text() {
        Ok(s) => Ok(s),
        Err(arboard::Error::ContentNotAvailable) => Ok(String::new()),
        Err(e) => Err(e.to_string()),
    }
}

#[tauri::command]
pub fn clipboard_write_text(text: String) -> Result<(), String> {
    require_max_len(&text, MAX_CONTENT_LEN, "clipboard text")?;
    let mut cb = arboard::Clipboard::new().map_err(|e| e.to_string())?;
    cb.set_text(text).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn db_get_clipboard_history(
    limit: u32,
    db: State<'_, crate::db::Database>,
) -> Result<Vec<crate::models::ClipboardItem>, String> {
    if limit == 0 || limit > CLIPBOARD_MAX_ENTRIES {
        return Err(format!("limit must be between 1 and {}", CLIPBOARD_MAX_ENTRIES));
    }
    db.get_clipboard_history(limit).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn db_save_clipboard_entry(
    content: String,
    db: State<'_, crate::db::Database>,
) -> Result<Option<crate::models::ClipboardItem>, String> {
    require_max_len(&content, MAX_CONTENT_LEN, "clipboard content")?;
    db.add_clipboard_entry(&content).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn db_delete_clipboard_entry(
    id: String,
    db: State<'_, crate::db::Database>,
) -> Result<bool, String> {
    validate_id(&id, "clipboard id")?;
    db.delete_clipboard_entry(&id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn db_clear_clipboard_history(db: State<'_, crate::db::Database>) -> Result<usize, String> {
    db.clear_clipboard_history().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn set_global_shortcut(app: tauri::AppHandle, shortcut: String) -> Result<(), String> {
    use std::str::FromStr;
    use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut};

    require_max_len(&shortcut, MAX_SHORTCUT_LEN, "shortcut")?;

    let global_shortcut = app.global_shortcut();
    global_shortcut
        .unregister_all()
        .map_err(|e| e.to_string())?;

    let trimmed = shortcut.trim();
    if !trimmed.is_empty() {
        let sc = Shortcut::from_str(trimmed)
            .map_err(|e| format!("Invalid shortcut format '{}': {:?}", trimmed, e))?;
        global_shortcut.register(sc).map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub fn send_desktop_notification(
    app: tauri::AppHandle,
    title: String,
    body: Option<String>,
) -> Result<(), String> {
    use tauri_plugin_notification::NotificationExt;

    if title.trim().is_empty() {
        return Err("Notification title cannot be empty".to_string());
    }
    require_max_len(&title, MAX_NOTIFICATION_TITLE_LEN, "notification title")?;
    if let Some(ref b) = body {
        require_max_len(b, MAX_NOTIFICATION_BODY_LEN, "notification body")?;
    }

    let mut builder = app.notification().builder().title(title);
    if let Some(b) = body {
        if !b.trim().is_empty() {
            builder = builder.body(b);
        }
    }
    builder.show().map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn google_oauth_login() -> Result<GoogleTokens, String> {
    // Run the blocking loopback listener on a background thread so the UI
    // event loop keeps pumping (otherwise Windows marks the window as
    // "Not Responding" and grays out clicks like Cancel).
    tauri::async_runtime::spawn_blocking(google_oauth::run_login_flow)
        .await
        .map_err(|e| format!("OAuth task join error: {}", e))?
}

#[tauri::command]
pub async fn google_oauth_refresh(refresh_token: String) -> Result<RefreshedTokens, String> {
    if refresh_token.trim().is_empty() {
        return Err("refresh_token is required".to_string());
    }
    tauri::async_runtime::spawn_blocking(move || {
        google_oauth::refresh_access_token(&refresh_token)
    })
    .await
    .map_err(|e| format!("Refresh task join error: {}", e))?
}

#[tauri::command]
pub async fn jira_oauth_login() -> Result<JiraTokens, String> {
    tauri::async_runtime::spawn_blocking(jira_oauth::run_login_flow)
        .await
        .map_err(|e| format!("OAuth task join error: {}", e))?
}

#[tauri::command]
pub async fn jira_oauth_refresh(refresh_token: String) -> Result<RefreshedJiraTokens, String> {
    if refresh_token.trim().is_empty() {
        return Err("refresh_token is required".to_string());
    }
    tauri::async_runtime::spawn_blocking(move || {
        jira_oauth::refresh_access_token(&refresh_token)
    })
    .await
    .map_err(|e| format!("Refresh task join error: {}", e))?
}

#[tauri::command]
pub fn open_external_url(url: String) -> Result<(), String> {
    require_max_len(&url, 2000, "url")?;
    if !url.starts_with("https://") && !url.starts_with("http://") && !url.starts_with("mailto:") {
        return Err("Invalid URL protocol (only http, https, and mailto allowed)".to_string());
    }
    #[cfg(target_os = "windows")]
    {
        // rundll32 passes the URL to the shell's protocol handler unmodified;
        // `cmd /c start` mangles URLs whose query strings contain `&`.
        std::process::Command::new("rundll32.exe")
            .args(["url.dll,FileProtocolHandler", &url])
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(&url)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("xdg-open")
            .arg(&url)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}
