pub mod commands;
pub mod db;
pub mod models;
pub mod state;

use state::AppState;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(AppState::default())
        .invoke_handler(tauri::generate_handler![
            commands::greet,
            commands::get_system_info,
            commands::get_app_state,
            commands::increment_counter,
            commands::set_theme,
            commands::window_minimize,
            commands::window_toggle_maximize,
            commands::window_close,
            commands::set_window_size,
            commands::window_set_focus,
            commands::position_window_right,
            commands::trigger_ping,
            commands::db_get_notes,
            commands::db_save_note,
            commands::db_delete_note,
            commands::db_get_tasks,
            commands::db_save_task,
            commands::db_update_task_status,
            commands::db_delete_task,
            commands::db_get_settings,
            commands::db_get_setting,
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

            if let Some(main_window) = app.get_webview_window("main") {
                std::thread::spawn(move || {
                    std::thread::sleep(std::time::Duration::from_millis(150));
                    if let Ok(Some(monitor)) = main_window.primary_monitor() {
                        let monitor_size = monitor.size();
                        let window_size = main_window
                            .outer_size()
                            .unwrap_or(tauri::PhysicalSize { width: 640, height: 440 });
                        let x = (monitor_size.width as i32) - (window_size.width as i32) - 10;
                        let y = ((monitor_size.height as i32) - (window_size.height as i32)) / 2;
                        let _ = main_window.set_position(tauri::Position::Physical(tauri::PhysicalPosition { x, y }));
                    }
                });
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

