// The asset library: the user's own pictures, videos, sounds and fonts, kept in the app's data
// folder (never in the installer or a theme), ready to drag onto a theme element.

use crate::commands::{err, is_inside, CmdResult};
use crate::importing::{check_file, copy_checked, kind_of, Kind};
use serde::Serialize;
use std::fs;
use std::path::{Path, PathBuf};
use std::time::UNIX_EPOCH;
use tauri::{AppHandle, Manager};
use walkdir::WalkDir;

/// Most files listed, so a huge folder can't stall the panel.
const MAX_LISTED: usize = 5000;

#[derive(Serialize)]
pub struct LibraryAsset {
    path: String,
    /// Path inside the library, with forward slashes.
    rel: String,
    kind: &'static str,
    size: u64,
    /// Unix seconds.
    modified: u64,
}

#[derive(Serialize)]
pub struct AddResult {
    added: Vec<String>,
    /// Files already in the library with the same contents (nothing copied).
    existing: Vec<String>,
    problems: Vec<String>,
}

fn kind_name(k: Kind) -> Option<&'static str> {
    match k {
        Kind::Image => Some("image"),
        Kind::Video => Some("video"),
        Kind::Sound => Some("sound"),
        Kind::Font => Some("font"),
        _ => None,
    }
}

fn library_dir(app: &AppHandle) -> CmdResult<PathBuf> {
    let d = app.path().app_data_dir().map_err(err)?.join("assets");
    fs::create_dir_all(&d).map_err(err)?;
    app.asset_protocol_scope().allow_directory(&d, true).map_err(err)?;
    Ok(d)
}

fn list_in(dir: &Path) -> Vec<LibraryAsset> {
    let mut out = Vec::new();
    // Links are not followed: the library only shows what is really in its folder.
    for e in WalkDir::new(dir).max_depth(6).into_iter().filter_map(Result::ok) {
        if !e.file_type().is_file() {
            continue;
        }
        let name = e.file_name().to_string_lossy();
        if name.ends_with(".ccs-tmp") {
            continue;
        }
        let Some(kind) = kind_of(&name).ok().and_then(kind_name) else { continue };
        let Ok(meta) = e.metadata() else { continue };
        let rel = e.path().strip_prefix(dir).map(|r| r.to_string_lossy().replace('\\', "/")).unwrap_or_default();
        out.push(LibraryAsset {
            path: e.path().to_string_lossy().into_owned(),
            rel,
            kind,
            size: meta.len(),
            modified: meta.modified().ok().and_then(|t| t.duration_since(UNIX_EPOCH).ok()).map(|d| d.as_secs()).unwrap_or(0),
        });
        if out.len() >= MAX_LISTED {
            break;
        }
    }
    out.sort_by(|a, b| a.rel.to_lowercase().cmp(&b.rel.to_lowercase()));
    out
}

/// Copies checked files into `<dir>/<kind>s/`. A file with the same name and different contents
/// is kept as "name-2"; nothing in the library is ever overwritten.
fn add_to(dir: &Path, paths: &[String]) -> AddResult {
    let mut res = AddResult { added: vec![], existing: vec![], problems: vec![] };
    for src in paths {
        let src_p = PathBuf::from(src);
        let name = src_p.file_name().map(|n| n.to_string_lossy().into_owned()).unwrap_or_else(|| src.clone());
        if is_inside(&src_p, dir) {
            res.existing.push(src.clone());
            continue;
        }
        let kind = match check_file(&src_p, None) {
            Ok(k) => k,
            Err(e) => {
                res.problems.push(e);
                continue;
            }
        };
        let Some(k) = kind_name(kind) else {
            res.problems.push(format!("{name} isn't a picture, video, sound or font."));
            continue;
        };
        let into = dir.join(format!("{k}s"));
        let before = into.join(&name).is_file();
        match copy_checked(&src_p, &into) {
            Ok(t) => {
                let same_name = t.file_name().map(|n| n.to_string_lossy() == name.as_str()).unwrap_or(false);
                if before && same_name {
                    res.existing.push(t.to_string_lossy().into_owned());
                } else {
                    res.added.push(t.to_string_lossy().into_owned());
                }
            }
            Err(e) => res.problems.push(format!("{name}: {e}")),
        }
    }
    res
}

#[tauri::command(async)]
pub fn asset_library_dir(app: AppHandle) -> CmdResult<String> {
    Ok(library_dir(&app)?.to_string_lossy().into_owned())
}

#[tauri::command(async)]
pub fn list_library_assets(app: AppHandle) -> CmdResult<Vec<LibraryAsset>> {
    Ok(list_in(&library_dir(&app)?))
}

#[tauri::command(async)]
pub fn add_library_assets(app: AppHandle, paths: Vec<String>) -> CmdResult<AddResult> {
    Ok(add_to(&library_dir(&app)?, &paths))
}

/// Moves a library file to the Recycle Bin (only files inside the library).
#[tauri::command(async)]
pub fn remove_library_asset(app: AppHandle, path: String) -> CmdResult<()> {
    let dir = library_dir(&app)?;
    let p = PathBuf::from(&path);
    if !is_inside(&p, &dir) || !p.is_file() {
        return Err(format!("{path} is not in the asset library"));
    }
    trash::delete(&p).map_err(|e| format!("Couldn't move it to the Recycle Bin: {e}"))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::unique_id;

    #[test]
    fn adds_by_kind_without_overwriting() {
        let base = std::env::temp_dir().join(format!("ccs-assets-{}", unique_id()));
        let lib = base.join("lib");
        let src = base.join("src");
        fs::create_dir_all(&lib).unwrap();
        fs::create_dir_all(src.join("b")).unwrap();
        let png = b"\x89PNG\r\n\x1a\n0000";
        fs::write(src.join("bg.png"), png).unwrap();
        fs::write(src.join("b").join("bg.png"), b"\x89PNG\r\n\x1a\n1111").unwrap();
        fs::write(src.join("tool.exe"), b"MZ").unwrap();
        let s = |p: PathBuf| p.to_string_lossy().into_owned();
        let r = add_to(&lib, &[s(src.join("bg.png")), s(src.join("tool.exe"))]);
        assert_eq!(r.added.len(), 1);
        assert_eq!(r.problems.len(), 1);
        assert!(lib.join("images/bg.png").is_file());
        // Same file again: reused. Different file with that name: kept as bg-2.png.
        let r = add_to(&lib, &[s(src.join("bg.png")), s(src.join("b").join("bg.png"))]);
        assert_eq!((r.added.len(), r.existing.len()), (1, 1));
        assert_eq!(fs::read(lib.join("images/bg.png")).unwrap(), png);
        assert!(lib.join("images/bg-2.png").is_file());
        let listed = list_in(&lib);
        assert_eq!(listed.iter().map(|a| (a.rel.as_str(), a.kind)).collect::<Vec<_>>(), vec![("images/bg-2.png", "image"), ("images/bg.png", "image")]);
        fs::remove_dir_all(&base).unwrap();
    }
}
