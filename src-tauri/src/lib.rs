mod commands;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .manage(commands::Roots::default())
        .invoke_handler(tauri::generate_handler![
            commands::detect_retrobat,
            commands::set_retrobat_root,
            commands::root_status,
            commands::list_themes,
            commands::list_theme_files,
            commands::read_theme_xml,
            commands::read_text,
            commands::read_text_optional,
            commands::write_text,
            commands::backup_theme,
            commands::backups_dir,
            commands::copy_theme,
            commands::create_theme_from_starter,
            commands::import_asset,
            commands::read_themesettings,
            commands::set_active_theme,
            commands::launch_retrobat,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
