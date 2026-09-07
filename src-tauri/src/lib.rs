pub mod commands;
pub mod db;
pub mod models;
pub mod state;

use state::AppState;
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Manager,
};

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
            commands::set_interactive_area,
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
        ])
        .setup(|app| {
            let app_dir = app
                .path()
                .app_data_dir()
                .unwrap_or_else(|_| std::path::PathBuf::from("./bilet_x_data"));

            let database = db::Database::init(app_dir).map_err(|e| {
                Box::new(std::io::Error::new(std::io::ErrorKind::Other, e))
                    as Box<dyn std::error::Error>
            })?;

            app.manage(database);

            // 1. Initial Window Positioning Hook
            if let Some(main_window) = app.get_webview_window("main") {
                let positioning_window = main_window.clone();
                std::thread::spawn(move || {
                    std::thread::sleep(std::time::Duration::from_millis(150));
                    if let Ok(Some(monitor)) = positioning_window.primary_monitor() {
                        let monitor_size = monitor.size();
                        let window_size = positioning_window
                            .outer_size()
                            .unwrap_or(tauri::PhysicalSize { width: 640, height: 440 });
                        let x = (monitor_size.width as i32) - (window_size.width as i32) - 10;
                        let y = ((monitor_size.height as i32) - (window_size.height as i32)) / 2;
                        let _ = positioning_window.set_position(tauri::Position::Physical(tauri::PhysicalPosition { x, y }));
                    }
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

                        if should_ignore != current_ignore {
                            if click_through_window
                                .set_ignore_cursor_events(should_ignore)
                                .is_ok()
                            {
                                current_ignore = should_ignore;
                            }
                        }
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
