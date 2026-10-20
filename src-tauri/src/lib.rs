mod commands;
mod storage;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .manage(commands::Roots::default())
        .manage(storage::Projects::default())
        .invoke_handler(tauri::generate_handler![
            commands::detect_retrobat,
            commands::set_retrobat_root,
            commands::root_status,
            commands::list_themes,
            commands::list_theme_files,
            commands::read_theme_xml,
            commands::read_text,
            commands::read_text_optional,
            storage::write_text,
            storage::backup_theme,
            commands::backups_dir,
            storage::export_theme,
            commands::write_binary,
            commands::copy_folder_into_theme,
            commands::save_recovery,
            commands::load_recovery,
            commands::clear_recovery,
            commands::list_gamelists,
            commands::read_gamelist,
            commands::list_fonts,
            commands::add_font_to_theme,
            commands::download_font,
            storage::copy_theme,
            commands::delete_theme,
            storage::create_theme_from_starter,
            commands::import_asset,
            commands::read_themesettings,
            commands::set_active_theme,
            commands::launch_retrobat,
            storage::open_project,
            storage::close_project,
            storage::changed_files,
            storage::accept_changes,
            storage::save_files,
            storage::list_backups,
            storage::restore_backup,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
