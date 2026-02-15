mod commands;
mod config;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            // Docker
            commands::docker::check_docker,
            commands::docker::get_docker_install_url,
            commands::docker::is_linux,
            // Telegram
            commands::telegram::validate_bot_token,
            // Backend API
            commands::backend::register_desktop,
            commands::backend::check_usage,
            commands::backend::get_backend_status,
            commands::backend::create_payment,
            commands::backend::get_profile,
            commands::backend::update_profile,
            // Setup & Deploy
            commands::setup::setup_openclaw,
            commands::setup::deploy_openclaw,
            commands::setup::apply_optimizations,
            commands::setup::teardown_openclaw,
            // Status & Control
            commands::status::get_openclaw_status,
            commands::status::get_openclaw_logs,
            commands::status::start_openclaw,
            commands::status::stop_openclaw,
            commands::status::restart_openclaw,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
