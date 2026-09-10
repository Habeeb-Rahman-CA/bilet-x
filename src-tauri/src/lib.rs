pub mod commands;
pub mod db;
pub mod google_oauth;
pub mod models;
pub mod state;

use db::SettingsRepository;
use state::AppState;
use std::str::FromStr;
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Emitter, Manager,
};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut, ShortcutState};

/// Chooses where the widget window should appear on startup.
///
/// Preference order:
/// 1. Saved (widget_x, widget_y) — but only if the window would land with
///    at least a 40x40 grabable region on some currently-connected monitor.
///    This protects against a monitor that was unplugged between sessions.
/// 2. Saved widget_position preset ("left", "top-right", etc.) on the primary monitor.
/// 3. Default: "right" on the primary monitor.
fn compute_initial_position(
    window: &tauri::WebviewWindow,
    saved_x: Option<i32>,
    saved_y: Option<i32>,
    saved_preset: Option<&str>,
) -> tauri::PhysicalPosition<i32> {
    let window_size = window.outer_size().unwrap_or(tauri::PhysicalSize {
        width: 640,
        height: 440,
    });
    let ww = window_size.width as i32;
    let wh = window_size.height as i32;

    if let (Some(x), Some(y)) = (saved_x, saved_y) {
        let monitors = window.available_monitors().unwrap_or_default();
        let visible = monitors.iter().any(|m| {
            let mp = m.position();
            let ms = m.size();
            let mr = mp.x + ms.width as i32;
            let mb = mp.y + ms.height as i32;
            let overlap_w = (x + ww).min(mr) - x.max(mp.x);
            let overlap_h = (y + wh).min(mb) - y.max(mp.y);
            overlap_w >= 40 && overlap_h >= 40
        });
        if visible {
            return tauri::PhysicalPosition { x, y };
        }
    }

    let monitor_size = window
        .primary_monitor()
        .ok()
        .flatten()
        .map(|m| *m.size())
        .unwrap_or(tauri::PhysicalSize {
            width: 1920,
            height: 1080,
        });
    let mw = monitor_size.width as i32;
    let mh = monitor_size.height as i32;

    let (x, y) = match saved_preset.unwrap_or("right") {
        "left" => (10, (mh - wh) / 2),
        "top" => ((mw - ww) / 2, 10),
        "bottom" => ((mw - ww) / 2, mh - wh - 10),
        "top-left" => (10, 10),
        "bottom-left" => (10, mh - wh - 10),
        "top-right" => (mw - ww - 10, 10),
        "bottom-right" => (mw - ww - 10, mh - wh - 10),
        _ => (mw - ww - 10, (mh - wh) / 2),
    };
    tauri::PhysicalPosition { x, y }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(AppState::default())
        .invoke_handler(tauri::generate_handler![
            commands::window_minimize,
            commands::window_toggle_maximize,
            commands::window_close,
            commands::set_window_size,
            commands::window_set_focus,
            commands::set_widget_position,
            commands::set_window_position,
            commands::set_interactive_area,
            commands::set_global_shortcut,
            commands::send_desktop_notification,
            commands::db_get_notes,
            commands::db_save_note,
            commands::db_delete_note,
            commands::db_clear_notes,
            commands::db_get_tasks,
            commands::db_save_task,
            commands::db_delete_task,
            commands::db_clear_tasks,
            commands::db_get_settings,
            commands::db_set_setting,
            commands::db_get_activities,
            commands::db_clear_activities,
            commands::open_external_url,
            commands::google_oauth_login,
            commands::google_oauth_refresh,
        ])
        .setup(|app| {
            let app_dir = app
                .path()
                .app_data_dir()
                .unwrap_or_else(|_| std::path::PathBuf::from("./bilet_x_data"));

            let database = db::Database::init(app_dir)
                .map_err(|e| Box::new(std::io::Error::other(e)) as Box<dyn std::error::Error>)?;

            let initial_shortcut_str = database
                .get_setting("global_shortcut")
                .ok()
                .flatten()
                .unwrap_or_else(|| "CommandOrControl+Shift+K".to_string());

            let saved_x: Option<i32> = database
                .get_setting("widget_x")
                .ok()
                .flatten()
                .and_then(|s| s.parse().ok());
            let saved_y: Option<i32> = database
                .get_setting("widget_y")
                .ok()
                .flatten()
                .and_then(|s| s.parse().ok());
            let saved_preset: Option<String> = database.get_setting("widget_position").ok().flatten();

            app.manage(database);

            // 1. Initial Window Positioning Hook
            //
            // Set position from saved x/y (or preset fallback) after a short delay so
            // the OS finishes creating the window. Doing this in Rust before the
            // Angular side boots avoids the visible "jump" from an early default
            // position to the restored one.
            if let Some(main_window) = app.get_webview_window("main") {
                let positioning_window = main_window.clone();
                let saved_preset_for_thread = saved_preset.clone();
                std::thread::spawn(move || {
                    std::thread::sleep(Duration::from_millis(150));
                    let target = compute_initial_position(
                        &positioning_window,
                        saved_x,
                        saved_y,
                        saved_preset_for_thread.as_deref(),
                    );
                    let _ = positioning_window
                        .set_position(tauri::Position::Physical(target));
                });

                // 1a. Cursor Click-Through Polling
                // Passes clicks through the transparent regions of the window while keeping
                // the dock/panel area interactive. The frontend reports the interactive rect
                // (in logical CSS pixels, relative to the window) via `set_interactive_area`.
                let click_through_window = main_window.clone();
                let interactive_rect = app.state::<AppState>().interactive_rect.clone();
                std::thread::spawn(move || {
                    let mut current_ignore = false;
                    loop {
                        std::thread::sleep(std::time::Duration::from_millis(30));

                        let rect_opt = interactive_rect.lock().ok().and_then(|g| *g);
                        let Some(rect) = rect_opt else { continue };

                        let cursor = match click_through_window.cursor_position() {
                            Ok(pos) => pos,
                            Err(_) => continue,
                        };
                        let win_pos = match click_through_window.outer_position() {
                            Ok(pos) => pos,
                            Err(_) => continue,
                        };
                        let scale = click_through_window.scale_factor().unwrap_or(1.0);

                        let rel_x = (cursor.x - win_pos.x as f64) / scale;
                        let rel_y = (cursor.y - win_pos.y as f64) / scale;
                        let in_rect = rel_x >= rect.x
                            && rel_x <= rect.x + rect.width
                            && rel_y >= rect.y
                            && rel_y <= rect.y + rect.height;
                        let should_ignore = !in_rect;

                        if should_ignore != current_ignore
                            && click_through_window
                                .set_ignore_cursor_events(should_ignore)
                                .is_ok()
                        {
                            current_ignore = should_ignore;
                        }
                    }
                });

                // 1b. Auto-persist Window Position on Drag
                //
                // The panel header and dock use `-webkit-app-region: drag`, which moves
                // the OS window directly (no JS mousemove events). We catch the resulting
                // WindowEvent::Moved and persist widget_x / widget_y so the user's chosen
                // spot survives a restart. Throttled to at most one write per 300ms so a
                // rapid drag doesn't hammer SQLite.
                let app_handle_for_move = app.handle().clone();
                let last_save: Arc<Mutex<Option<Instant>>> = Arc::new(Mutex::new(None));
                main_window.on_window_event(move |event| {
                    if let tauri::WindowEvent::Moved(pos) = event {
                        let mut ls = match last_save.lock() {
                            Ok(g) => g,
                            Err(_) => return,
                        };
                        if let Some(t) = *ls {
                            if t.elapsed() < Duration::from_millis(300) {
                                return;
                            }
                        }
                        *ls = Some(Instant::now());
                        drop(ls);

                        let db = app_handle_for_move.state::<db::Database>();
                        let _ = db.set_setting("widget_x", &pos.x.to_string());
                        let _ = db.set_setting("widget_y", &pos.y.to_string());
                    }
                });
            }

            // 2. System Tray Setup
            let show_item = MenuItem::with_id(app, "show", "Show Widget", true, None::<&str>)?;
            let hide_item = MenuItem::with_id(app, "hide", "Hide Widget", true, None::<&str>)?;
            let quit_item = MenuItem::with_id(app, "quit", "Quit Bilet-X", true, None::<&str>)?;

            let tray_menu = Menu::with_items(app, &[&show_item, &hide_item, &quit_item])?;

            if let Some(icon) = app.default_window_icon() {
                let _tray = TrayIconBuilder::new()
                    .icon(icon.clone())
                    .menu(&tray_menu)
                    .show_menu_on_left_click(false)
                    .on_menu_event(|app_handle, event| match event.id.as_ref() {
                        "show" => {
                            if let Some(window) = app_handle.get_webview_window("main") {
                                let _ = window.show();
                                let _ = window.set_focus();
                            }
                        }
                        "hide" => {
                            if let Some(window) = app_handle.get_webview_window("main") {
                                let _ = window.hide();
                            }
                        }
                        "quit" => {
                            app_handle.exit(0);
                        }
                        _ => {}
                    })
                    .on_tray_icon_event(|tray_handle, event| {
                        if let TrayIconEvent::Click {
                            button: MouseButton::Left,
                            button_state: MouseButtonState::Up,
                            ..
                        } = event
                        {
                            let app = tray_handle.app_handle();
                            if let Some(window) = app.get_webview_window("main") {
                                if window.is_visible().unwrap_or(false) {
                                    let _ = window.hide();
                                } else {
                                    let _ = window.show();
                                    let _ = window.set_focus();
                                }
                            }
                        }
                    })
                    .build(app)?;
            }

            // 3. Global Shortcut Setup
            app.handle().plugin(
                tauri_plugin_global_shortcut::Builder::new()
                    .with_handler(|app_handle, _shortcut, event| {
                        if event.state() == ShortcutState::Pressed {
                            if let Some(window) = app_handle.get_webview_window("main") {
                                let is_visible = window.is_visible().unwrap_or(false);
                                if !is_visible {
                                    let _ = window.show();
                                    let _ = window.set_focus();
                                } else {
                                    let _ = window.set_focus();
                                }
                                let _ = window.emit("toggle-widget", ());
                            }
                        }
                    })
                    .build(),
            )?;

            if !initial_shortcut_str.trim().is_empty() {
                if let Ok(sc) = Shortcut::from_str(initial_shortcut_str.trim()) {
                    let _ = app.global_shortcut().register(sc);
                }
            }

            // 4. Desktop Notifications Plugin Setup
            app.handle().plugin(tauri_plugin_notification::init())?;

            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
