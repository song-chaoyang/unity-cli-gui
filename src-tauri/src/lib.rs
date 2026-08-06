#![allow(non_snake_case)]

mod commands;
mod core;
mod models;

use commands::{aichat, build, editors, mcp, projects, settings};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            // Editors
            editors::list_editors,
            editors::list_releases,
            editors::list_running_editors,
            editors::editor_info,
            editors::editor_path,
            editors::set_default_editor,
            editors::unset_default_editor,
            editors::get_default_editor,
            editors::uninstall_editor,
            editors::list_modules,
            editors::add_modules,
            editors::remove_modules,
            editors::check_editor_upgrades,
            editors::get_install_path,
            editors::set_install_path,
            editors::editors_upgrade,
            // Projects
            projects::list_projects,
            projects::project_info,
            projects::open_project,
            projects::open_project_with_params,
            projects::project_require,
            projects::project_size,
            projects::pin_project,
            projects::unpin_project,
            projects::remove_project,
            projects::upgrade_project,
            projects::create_project,
            projects::add_existing_project,
            projects::reveal_in_file_manager,
            projects::open_terminal_at_path,
            projects::open_in_editor,
            projects::get_git_info,
            projects::get_project_meta,
            projects::set_project_meta,
            projects::project_clone,
            projects::project_link,
            projects::project_unlink,
            projects::projects_export,
            projects::projects_import,
            projects::refresh_modules,
            projects::submit_bug,
            projects::cloud_project_list,
            projects::license_server_list,
            projects::license_server_status,
            projects::template_create,
            projects::template_delete,
            projects::template_location,
            projects::template_edit,
            projects::list_templates,
            projects::cache_info,
            projects::cache_clean,
            projects::get_env,
            // Build / Test / Process management
            build::start_build,
            build::start_test,
            build::cancel_process,
            build::start_install_editor,
            build::build_command_string,
            build::check_unity_available,
            build::get_unity_path,
            build::run_unity_command,
            // MCP / Status / Pipeline
            mcp::get_status,
            mcp::pipeline_list,
            mcp::pipeline_list_versions,
            mcp::pipeline_install,
            mcp::pipeline_upgrade,
            mcp::list_editor_commands,
            mcp::execute_editor_command,
            mcp::list_mcp_clients,
            mcp::configure_mcp_client,
            // Settings / Logs / Diagnostics
            settings::start_log_stream,
            settings::run_doctor,
            settings::run_diagnose,
            settings::auth_status,
            settings::auth_login,
            settings::auth_logout,
            settings::license_status,
            settings::license_activate,
            settings::license_return,
            settings::list_licenses,
            settings::cloud_status,
            settings::list_cloud_orgs,
            settings::get_language,
            settings::set_language,
            settings::get_proxy,
            settings::set_proxy,
            settings::unset_proxy,
            settings::analytics_status,
            settings::analytics_opt_in,
            settings::analytics_opt_out,
            settings::check_cli_update,
            settings::get_changelog,
            settings::get_update_check,
            settings::set_update_check,
            settings::start_cli_upgrade,
            settings::install_hub,
            settings::check_hub_installed,
            settings::self_uninstall,
            // AI Chat
            aichat::ai_chat,
            aichat::ai_test_connection,
            aichat::get_system_locale,
            aichat::read_file_content,
            aichat::write_file_content,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
