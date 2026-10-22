mod commands;
mod storage;
mod importing;
mod assets;
mod intro;

use std::fs;
use std::path::{Path, PathBuf};

/// Must match "identifier" in tauri.conf.json (a test checks).
const APP_ID: &str = "com.channelcraft.studio";

/// Earlier versions used an app id with a personal name in it (com.<name>.channelcraft-studio), so
/// their backups, settings and preferences live in folders of that name. On the first start with
/// the new id they are copied across (the old folders are left as they are). Lock files and web
/// caches aren't copied. Runs before the window opens, so its saved preferences come along.
fn copy_old_data() {
    for var in ["APPDATA", "LOCALAPPDATA"] {
        let Some(base) = std::env::var_os(var).map(PathBuf::from) else { continue };
        let new = base.join(APP_ID);
        if new.exists() {
            continue;
        }
        let old = fs::read_dir(&base)
            .into_iter()
            .flatten()
            .flatten()
            .filter(|e| {
                let n = e.file_name().to_string_lossy().to_lowercase();
                n.starts_with("com.") && n.ends_with(".channelcraft-studio") && e.path().is_dir()
            })
            .max_by_key(|e| e.metadata().and_then(|m| m.modified()).ok());
        let Some(old) = old else { continue };
        let tmp = base.join(format!("{APP_ID}.copying"));
        let _ = fs::remove_dir_all(&tmp);
        if copy_tree(&old.path(), &tmp).is_ok() && fs::rename(&tmp, &new).is_ok() {
            continue;
        }
        let _ = fs::remove_dir_all(&tmp);
    }
}

fn copy_tree(from: &Path, to: &Path) -> std::io::Result<()> {
    const SKIP: [&str; 8] = ["locks", "Cache", "Code Cache", "GPUCache", "DawnCache", "GrShaderCache", "ShaderCache", "Crashpad"];
    fs::create_dir_all(to)?;
    for e in fs::read_dir(from)? {
        let e = e?;
        let name = e.file_name();
        if SKIP.iter().any(|s| name.to_string_lossy().eq_ignore_ascii_case(s)) {
            continue;
        }
        let ty = e.file_type()?;
        if ty.is_dir() {
            copy_tree(&e.path(), &to.join(&name))?;
        } else if ty.is_file() {
            // Backup zips are never changed once written, so they are hard-linked: instant, no
            // extra disk space (backups can be gigabytes), and the old folder keeps its own name for
            // each. Files that get rewritten later (settings) are copied, so the two stay apart.
            let in_backups = from.file_name().is_some_and(|n| n == "backups");
            if in_backups && fs::hard_link(e.path(), to.join(&name)).is_ok() {
                continue;
            }
            // Browser data files can be held open by a running WebView; those are skipped.
            if let Err(err) = fs::copy(e.path(), to.join(&name))
                && !from.components().any(|c| c.as_os_str() == "EBWebView")
            {
                return Err(err);
            }
        }
    }
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    copy_old_data();
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
            commands::load_theme,
            commands::read_text,
            commands::read_text_optional,
            storage::write_text,
            storage::backup_theme,
            commands::backups_dir,
            commands::notices_path,
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
            intro::read_intro,
            intro::write_intro,
            storage::open_project,
            storage::close_project,
            storage::changed_files,
            storage::accept_changes,
            storage::save_files,
            storage::list_backups,
            storage::restore_backup,
            storage::existing_files,
            storage::copy_media_into_theme,
            storage::write_report,
            storage::make_theme_dirs,
            importing::inspect_theme_import,
            importing::import_theme,
            assets::asset_library_dir,
            assets::list_library_assets,
            assets::add_library_assets,
            assets::remove_library_asset,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    #[test]
    fn app_id_matches_config() {
        let conf: serde_json::Value = serde_json::from_str(include_str!("../tauri.conf.json")).unwrap();
        assert_eq!(conf["identifier"], super::APP_ID);
    }

    #[test]
    fn copies_a_data_folder_without_locks_or_caches() {
        let base = std::env::temp_dir().join(format!("ccs-migrate-{}", std::process::id()));
        let old = base.join("old");
        std::fs::create_dir_all(old.join("backups")).unwrap();
        std::fs::create_dir_all(old.join("locks")).unwrap();
        std::fs::create_dir_all(old.join("EBWebView/Default/Cache")).unwrap();
        std::fs::write(old.join("settings.json"), "{}").unwrap();
        std::fs::write(old.join("backups/a.zip"), "z").unwrap();
        std::fs::write(old.join("locks/x.lock"), "").unwrap();
        std::fs::write(old.join("EBWebView/Default/Cache/data"), "c").unwrap();
        std::fs::write(old.join("EBWebView/Default/prefs"), "p").unwrap();
        let new = base.join("new");
        super::copy_tree(&old, &new).unwrap();
        assert!(new.join("settings.json").is_file() && new.join("backups/a.zip").is_file() && new.join("EBWebView/Default/prefs").is_file());
        assert!(!new.join("locks").exists() && !new.join("EBWebView/Default/Cache").exists());
        // A backup is the same file under both names (hard link), and deleting one keeps the other.
        std::fs::remove_file(new.join("backups/a.zip")).unwrap();
        assert_eq!(std::fs::read_to_string(old.join("backups/a.zip")).unwrap(), "z");
        // Settings are a real copy: changing the new one leaves the old one alone.
        std::fs::write(new.join("settings.json"), "{\"x\":1}").unwrap();
        assert_eq!(std::fs::read_to_string(old.join("settings.json")).unwrap(), "{}");
        std::fs::remove_dir_all(&base).unwrap();
    }
}
