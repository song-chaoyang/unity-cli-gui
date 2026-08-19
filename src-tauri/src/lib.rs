#![allow(non_snake_case)]

mod commands;
mod core;
mod models;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            // Generic CLI execution
            commands::core::run_unity_json,
            commands::core::run_unity_plain,
            commands::core::start_streaming,
            commands::core::start_raw_stream,
            commands::core::cancel_process,
            commands::core::check_unity_available,
            commands::core::get_unity_path,
            // Platform-specific
            commands::core::ai_chat,
            commands::core::get_git_info,
            commands::core::read_file_content,
            commands::core::write_file_content,
            commands::core::reveal_in_file_manager,
            commands::core::open_terminal_at_path,
            commands::core::open_in_editor,
            commands::core::check_hub_installed,
            commands::core::get_project_meta,
            commands::core::set_project_meta,
            commands::core::get_system_locale,
            commands::core::start_auth_login,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
