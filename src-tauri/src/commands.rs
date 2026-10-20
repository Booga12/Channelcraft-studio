use serde::Serialize;
use std::fs;
use std::io::Write;
use std::path::{Component, Path, PathBuf};
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Manager, State};
use walkdir::WalkDir;

type CmdResult<T> = Result<T, String>;

fn err<E: std::fmt::Display>(e: E) -> String {
    e.to_string()
}

/// The RetroBat folder the user picked. Every write must land inside its themes folder
/// (or be the es_settings.cfg file), so a bug in the UI can't touch anything else.
#[derive(Default)]
pub struct Roots(pub Mutex<Option<PathBuf>>);

impl Roots {
    fn root(&self) -> CmdResult<PathBuf> {
        self.0.lock().unwrap().clone().ok_or_else(|| "RetroBat folder is not set".into())
    }
}

fn es_home(root: &Path) -> PathBuf {
    root.join("emulationstation").join(".emulationstation")
}

fn themes_dir(root: &Path) -> PathBuf {
    es_home(root).join("themes")
}

/// Lexically normalizes a path (resolves `.` and `..`) without touching the disk.
fn normalize(p: &Path) -> PathBuf {
    let mut out = PathBuf::new();
    for c in p.components() {
        match c {
            Component::ParentDir => {
                out.pop();
            }
            Component::CurDir => {}
            other => out.push(other.as_os_str()),
        }
    }
    out
}

fn is_inside(child: &Path, parent: &Path) -> bool {
    let c = normalize(child).to_string_lossy().to_lowercase();
    let p = normalize(parent).to_string_lossy().to_lowercase();
    let p = p.trim_end_matches(['\\', '/']);
    c.len() > p.len() && c.starts_with(p) && matches!(c.as_bytes()[p.len()], b'\\' | b'/')
}

fn ensure_writable(roots: &Roots, path: &Path) -> CmdResult<()> {
    let root = roots.root()?;
    if is_inside(path, &themes_dir(&root)) {
        Ok(())
    } else {
        Err(format!("Refusing to write outside the RetroBat themes folder: {}", path.display()))
    }
}

fn valid_theme_name(name: &str) -> CmdResult<()> {
    let bad = name.trim().is_empty()
        || name.contains(['\\', '/', ':', '*', '?', '"', '<', '>', '|'])
        || name.starts_with('.')
        || name.ends_with([' ', '.']);
    if bad {
        Err(format!("\"{name}\" is not a valid folder name"))
    } else {
        Ok(())
    }
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RootInfo {
    root: String,
    themes_dir: String,
    es_home: String,
    resources_dir: String,
    active_theme: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ThemeInfo {
    name: String,
    path: String,
    preview: Option<String>,
    modified: u64,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FileEntry {
    rel: String,
    kind: &'static str,
    size: u64,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TextFile {
    path: String,
    text: String,
    bom: bool,
}

fn file_kind(path: &Path) -> &'static str {
    let ext = path.extension().and_then(|e| e.to_str()).unwrap_or("").to_lowercase();
    match ext.as_str() {
        "xml" => "xml",
        "png" | "jpg" | "jpeg" | "svg" | "gif" | "webp" | "bmp" => "image",
        "ttf" | "otf" => "font",
        "mp4" | "webm" | "mkv" | "avi" => "video",
        "ogg" | "wav" | "mp3" | "flac" => "sound",
        "glsl" => "shader",
        "md" | "txt" | "info" | "cfg" => "text",
        _ => "other",
    }
}

fn read_text_file(path: &Path) -> CmdResult<TextFile> {
    let bytes = fs::read(path).map_err(|e| format!("{}: {e}", path.display()))?;
    let (bom, body) = match bytes.strip_prefix(&[0xEF, 0xBB, 0xBF]) {
        Some(rest) => (true, rest),
        None => (false, &bytes[..]),
    };
    let text = match String::from_utf8(body.to_vec()) {
        Ok(s) => s,
        // Fall back to Latin-1 so odd files still open instead of failing.
        Err(_) => body.iter().map(|&b| b as char).collect(),
    };
    Ok(TextFile { path: path.to_string_lossy().into_owned(), text, bom })
}

fn active_theme(root: &Path) -> Option<String> {
    let cfg = fs::read_to_string(es_home(root).join("es_settings.cfg")).ok()?;
    let line = cfg.lines().find(|l| l.contains("name=\"ThemeSet\""))?;
    let start = line.find("value=\"")? + 7;
    let end = line[start..].find('"')? + start;
    Some(unescape_attr(&line[start..end]))
}

fn unescape_attr(s: &str) -> String {
    s.replace("&quot;", "\"").replace("&apos;", "'").replace("&lt;", "<").replace("&gt;", ">").replace("&amp;", "&")
}

fn escape_attr(s: &str) -> String {
    s.replace('&', "&amp;").replace('"', "&quot;").replace('<', "&lt;").replace('>', "&gt;")
}

fn root_info(root: &Path) -> RootInfo {
    RootInfo {
        root: root.to_string_lossy().into_owned(),
        themes_dir: themes_dir(root).to_string_lossy().into_owned(),
        es_home: es_home(root).to_string_lossy().into_owned(),
        resources_dir: root.join("emulationstation").join("resources").to_string_lossy().into_owned(),
        active_theme: active_theme(root),
    }
}

/// Looks for `X:\RetroBat` on every drive letter.
#[tauri::command]
pub fn detect_retrobat() -> Option<String> {
    for letter in b'C'..=b'Z' {
        let p = PathBuf::from(format!("{}:\\RetroBat", letter as char));
        if themes_dir(&p).is_dir() {
            return Some(p.to_string_lossy().into_owned());
        }
    }
    None
}

#[tauri::command]
pub fn set_retrobat_root(app: AppHandle, roots: State<Roots>, path: String) -> CmdResult<RootInfo> {
    let root = PathBuf::from(&path);
    if !themes_dir(&root).is_dir() {
        return Err(format!("No EmulationStation themes folder found in {path}. Pick the folder that contains RetroBat.exe."));
    }
    let scope = app.asset_protocol_scope();
    scope.allow_directory(&root, true).map_err(err)?;
    *roots.0.lock().unwrap() = Some(root.clone());
    Ok(root_info(&root))
}

#[tauri::command]
pub fn root_status(roots: State<Roots>) -> CmdResult<RootInfo> {
    Ok(root_info(&roots.root()?))
}

#[tauri::command]
pub fn list_themes(roots: State<Roots>) -> CmdResult<Vec<ThemeInfo>> {
    let dir = themes_dir(&roots.root()?);
    let mut out = Vec::new();
    for entry in fs::read_dir(&dir).map_err(err)?.flatten() {
        let p = entry.path();
        if !p.join("theme.xml").is_file() {
            continue;
        }
        let preview = ["preview.png", "preview.jpg", "_inc/images/preview.png", "screenshot.png"]
            .iter()
            .map(|f| p.join(f))
            .find(|f| f.is_file())
            .map(|f| f.to_string_lossy().into_owned());
        let modified = fs::metadata(p.join("theme.xml"))
            .and_then(|m| m.modified())
            .ok()
            .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
            .map(|d| d.as_secs())
            .unwrap_or(0);
        out.push(ThemeInfo {
            name: entry.file_name().to_string_lossy().into_owned(),
            path: p.to_string_lossy().into_owned(),
            preview,
            modified,
        });
    }
    out.sort_by_key(|t| t.name.to_lowercase());
    Ok(out)
}

#[tauri::command]
pub fn list_theme_files(dir: String) -> CmdResult<Vec<FileEntry>> {
    let base = PathBuf::from(&dir);
    let mut out = Vec::new();
    for e in WalkDir::new(&base).into_iter().flatten() {
        if !e.file_type().is_file() {
            continue;
        }
        let rel = e.path().strip_prefix(&base).map_err(err)?.to_string_lossy().replace('\\', "/");
        out.push(FileEntry { kind: file_kind(e.path()), size: e.metadata().map(|m| m.len()).unwrap_or(0), rel });
    }
    Ok(out)
}

/// Reads every XML file in a theme in one round trip.
#[tauri::command]
pub fn read_theme_xml(dir: String) -> CmdResult<Vec<TextFile>> {
    let mut out = Vec::new();
    for e in WalkDir::new(&dir).into_iter().flatten() {
        if e.file_type().is_file() && file_kind(e.path()) == "xml" {
            out.push(read_text_file(e.path())?);
        }
    }
    Ok(out)
}

#[tauri::command]
pub fn read_text(path: String) -> CmdResult<TextFile> {
    read_text_file(Path::new(&path))
}

#[tauri::command]
pub fn read_text_optional(path: String) -> Option<TextFile> {
    read_text_file(Path::new(&path)).ok()
}

/// Writes through a temp file and rename, keeping the BOM state the file had.
#[tauri::command]
pub fn write_text(roots: State<Roots>, path: String, text: String, bom: bool) -> CmdResult<()> {
    let p = PathBuf::from(&path);
    ensure_writable(&roots, &p)?;
    if let Some(parent) = p.parent() {
        fs::create_dir_all(parent).map_err(err)?;
    }
    let tmp = p.with_extension("ccs-tmp");
    {
        let mut f = fs::File::create(&tmp).map_err(err)?;
        if bom {
            f.write_all(&[0xEF, 0xBB, 0xBF]).map_err(err)?;
        }
        f.write_all(text.as_bytes()).map_err(err)?;
        f.sync_all().map_err(err)?;
    }
    fs::rename(&tmp, &p).map_err(|e| {
        let _ = fs::remove_file(&tmp);
        err(e)
    })
}

fn timestamp() -> String {
    let secs = SystemTime::now().duration_since(UNIX_EPOCH).map(|d| d.as_secs()).unwrap_or(0);
    // UTC yyyymmdd-hhmmss without pulling in a date crate.
    let days = secs / 86400;
    let (h, m, s) = ((secs / 3600) % 24, (secs / 60) % 60, secs % 60);
    let z = days as i64 + 719468;
    let era = z.div_euclid(146097);
    let doe = z - era * 146097;
    let yoe = (doe - doe / 1460 + doe / 36524 - doe / 146096) / 365;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = doy - (153 * mp + 2) / 5 + 1;
    let mo = if mp < 10 { mp + 3 } else { mp - 9 };
    let y = yoe + era * 400 + if mo <= 2 { 1 } else { 0 };
    format!("{y:04}{mo:02}{d:02}-{h:02}{m:02}{s:02}")
}

/// Zips a whole theme folder into the app's backups folder and returns the zip path. With `keep`,
/// only that many of the newest backups of this theme are kept.
#[tauri::command]
pub fn backup_theme(app: AppHandle, dir: String, keep: Option<usize>) -> CmdResult<String> {
    let src = PathBuf::from(&dir);
    let name = src.file_name().map(|n| n.to_string_lossy().into_owned()).unwrap_or_else(|| "theme".into());
    let backups = app.path().app_data_dir().map_err(err)?.join("backups");
    fs::create_dir_all(&backups).map_err(err)?;
    let zip_path = backups.join(format!("{name}-{}.zip", timestamp()));
    zip_dir(&src, &name, &zip_path)?;
    if let Some(keep) = keep.filter(|k| *k > 0) {
        let prefix = format!("{name}-");
        let mut mine: Vec<PathBuf> = fs::read_dir(&backups)
            .map_err(err)?
            .flatten()
            .map(|e| e.path())
            .filter(|p| {
                let f = p.file_name().map(|f| f.to_string_lossy().into_owned()).unwrap_or_default();
                // "<name>-yyyymmdd-hhmmss.zip": the timestamp sorts by age.
                f.starts_with(&prefix) && f.ends_with(".zip") && f.len() == prefix.len() + 19
            })
            .collect();
        mine.sort();
        let excess = mine.len().saturating_sub(keep);
        for old in &mine[..excess] {
            let _ = fs::remove_file(old);
        }
    }
    Ok(zip_path.to_string_lossy().into_owned())
}

/// Zips a theme to a file the user chose, ready to share or copy to another RetroBat.
#[tauri::command]
pub fn export_theme(dir: String, dest: String) -> CmdResult<String> {
    let src = PathBuf::from(&dir);
    if !src.join("theme.xml").is_file() {
        return Err(format!("{dir} is not a theme folder"));
    }
    let name = src.file_name().map(|n| n.to_string_lossy().into_owned()).unwrap_or_else(|| "theme".into());
    zip_dir(&src, &name, Path::new(&dest))?;
    Ok(dest)
}

fn zip_dir(src: &Path, name: &str, zip_path: &Path) -> CmdResult<()> {
    let file = fs::File::create(zip_path).map_err(err)?;
    let mut zip = zip::ZipWriter::new(file);
    let opts = zip::write::SimpleFileOptions::default().compression_method(zip::CompressionMethod::Deflated);
    for e in WalkDir::new(&src).into_iter().flatten() {
        if !e.file_type().is_file() {
            continue;
        }
        let rel = e.path().strip_prefix(&src).map_err(err)?.to_string_lossy().replace('\\', "/");
        zip.start_file(format!("{name}/{rel}"), opts).map_err(err)?;
        let mut f = fs::File::open(e.path()).map_err(err)?;
        std::io::copy(&mut f, &mut zip).map_err(err)?;
    }
    zip.finish().map_err(err)?;
    Ok(())
}

#[tauri::command]
pub fn backups_dir(app: AppHandle) -> CmdResult<String> {
    Ok(app.path().app_data_dir().map_err(err)?.join("backups").to_string_lossy().into_owned())
}

/// Writes binary data (base64) inside the themes folder, e.g. a preview.png or artwork.
#[tauri::command]
pub fn write_binary(roots: State<Roots>, path: String, base64: String) -> CmdResult<()> {
    use base64::Engine;
    let p = PathBuf::from(&path);
    ensure_writable(&roots, &p)?;
    let bytes = base64::engine::general_purpose::STANDARD.decode(base64.as_bytes()).map_err(err)?;
    if let Some(parent) = p.parent() {
        fs::create_dir_all(parent).map_err(err)?;
    }
    fs::write(&p, bytes).map_err(err)
}

/// Copies every file of a folder (from any installed theme) into a theme's subfolder, keeping
/// files that are already there. Returns how many files were copied.
#[tauri::command]
pub fn copy_folder_into_theme(roots: State<Roots>, src: String, theme_dir: String, dest_rel: String) -> CmdResult<usize> {
    let root = roots.root()?;
    let src_p = PathBuf::from(&src);
    if !is_inside(&src_p, &themes_dir(&root)) {
        return Err("Art can only be copied from installed themes".into());
    }
    let dest = PathBuf::from(&theme_dir).join(&dest_rel);
    ensure_writable(&roots, &dest)?;
    fs::create_dir_all(&dest).map_err(err)?;
    let mut n = 0;
    for e in fs::read_dir(&src_p).map_err(err)?.flatten() {
        let p = e.path();
        if !p.is_file() {
            continue;
        }
        let target = dest.join(e.file_name());
        if !target.exists() {
            fs::copy(&p, &target).map_err(err)?;
            n += 1;
        }
    }
    Ok(n)
}

fn recovery_path(app: &AppHandle, key: &str) -> CmdResult<PathBuf> {
    let safe: String = key.chars().map(|c| if c.is_ascii_alphanumeric() || c == '-' || c == '_' { c } else { '_' }).collect();
    let dir = app.path().app_data_dir().map_err(err)?.join("recovery");
    fs::create_dir_all(&dir).map_err(err)?;
    Ok(dir.join(format!("{safe}.json")))
}

/// Keeps unsaved edits outside the theme, so they can be offered back after a crash.
#[tauri::command]
pub fn save_recovery(app: AppHandle, key: String, data: String) -> CmdResult<()> {
    fs::write(recovery_path(&app, &key)?, data).map_err(err)
}

#[tauri::command]
pub fn load_recovery(app: AppHandle, key: String) -> CmdResult<Option<String>> {
    Ok(fs::read_to_string(recovery_path(&app, &key)?).ok())
}

#[tauri::command]
pub fn clear_recovery(app: AppHandle, key: String) -> CmdResult<()> {
    let p = recovery_path(&app, &key)?;
    if p.exists() {
        fs::remove_file(p).map_err(err)?;
    }
    Ok(())
}

/// Systems that have a scraped gamelist in RetroBat's roms folder.
#[tauri::command]
pub fn list_gamelists(roots: State<Roots>) -> CmdResult<Vec<String>> {
    let roms = roots.root()?.join("roms");
    let mut out: Vec<String> = fs::read_dir(&roms)
        .map_err(err)?
        .flatten()
        .filter(|e| e.path().join("gamelist.xml").is_file())
        .map(|e| e.file_name().to_string_lossy().into_owned())
        .collect();
    out.sort();
    Ok(out)
}

#[tauri::command]
pub fn read_gamelist(roots: State<Roots>, system: String) -> CmdResult<Option<TextFile>> {
    if system.contains(['\\', '/', ':']) || system.starts_with('.') {
        return Err("Bad system name".into());
    }
    let p = roots.root()?.join("roms").join(&system).join("gamelist.xml");
    Ok(read_text_file(&p).ok())
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FontEntry {
    name: String,
    path: String,
    source: String,
}

/// Fonts that can be copied into a theme: Windows fonts and the fonts of installed themes.
#[tauri::command]
pub fn list_fonts(roots: State<Roots>) -> CmdResult<Vec<FontEntry>> {
    let mut out = Vec::new();
    let is_font = |p: &Path| matches!(p.extension().and_then(|e| e.to_str()).map(|e| e.to_lowercase()).as_deref(), Some("ttf") | Some("otf"));
    let stem = |p: &Path| p.file_stem().map(|s| s.to_string_lossy().into_owned()).unwrap_or_default();
    if let Ok(root) = roots.root() {
        for e in WalkDir::new(themes_dir(&root)).max_depth(6).into_iter().flatten() {
            if e.file_type().is_file() && is_font(e.path()) {
                let theme = e.path().strip_prefix(themes_dir(&root)).ok().and_then(|r| r.components().next()).map(|c| c.as_os_str().to_string_lossy().into_owned()).unwrap_or_default();
                out.push(FontEntry { name: stem(e.path()), path: e.path().to_string_lossy().into_owned(), source: format!("Theme: {theme}") });
            }
        }
    }
    let mut win_dirs = vec![PathBuf::from(std::env::var("WINDIR").unwrap_or_else(|_| "C:\\Windows".into())).join("Fonts")];
    if let Ok(local) = std::env::var("LOCALAPPDATA") {
        win_dirs.push(PathBuf::from(local).join("Microsoft").join("Windows").join("Fonts"));
    }
    for d in win_dirs {
        if let Ok(rd) = fs::read_dir(&d) {
            for e in rd.flatten() {
                let p = e.path();
                if p.is_file() && is_font(&p) {
                    out.push(FontEntry { name: stem(&p), path: p.to_string_lossy().into_owned(), source: "Windows".into() });
                }
            }
        }
    }
    Ok(out)
}

/// Copies a font file into the theme's fonts folder; returns its theme-relative path.
#[tauri::command]
pub fn add_font_to_theme(roots: State<Roots>, theme_dir: String, src: String) -> CmdResult<String> {
    let src_p = PathBuf::from(&src);
    let file_name = src_p.file_name().ok_or("No file name")?.to_string_lossy().into_owned();
    let target = PathBuf::from(&theme_dir).join("_inc").join("fonts").join(&file_name);
    ensure_writable(&roots, &target)?;
    if !target.exists() {
        fs::create_dir_all(target.parent().unwrap()).map_err(err)?;
        fs::copy(&src_p, &target).map_err(err)?;
    }
    Ok(format!("_inc/fonts/{file_name}"))
}

/// Downloads an open-licence font from the Google Fonts repository into the theme.
#[tauri::command]
pub fn download_font(roots: State<Roots>, theme_dir: String, url: String, file_name: String) -> CmdResult<String> {
    const ALLOWED: &str = "https://raw.githubusercontent.com/google/fonts/main/";
    if !url.starts_with(ALLOWED) || file_name.contains(['\\', '/', ':']) {
        return Err("Fonts can only be downloaded from the Google Fonts repository".into());
    }
    let target = PathBuf::from(&theme_dir).join("_inc").join("fonts").join(&file_name);
    ensure_writable(&roots, &target)?;
    if !target.exists() {
        let resp = ureq::get(&url).call().map_err(|e| format!("Download failed: {e}"))?;
        let mut bytes = Vec::new();
        // Fonts are small; refuse anything over 20 MB.
        let mut reader = std::io::Read::take(resp.into_reader(), 20 * 1024 * 1024);
        std::io::Read::read_to_end(&mut reader, &mut bytes).map_err(err)?;
        fs::create_dir_all(target.parent().unwrap()).map_err(err)?;
        fs::write(&target, bytes).map_err(err)?;
    }
    Ok(format!("_inc/fonts/{file_name}"))
}

fn copy_dir(src: &Path, dest: &Path) -> CmdResult<()> {
    for e in WalkDir::new(src).into_iter().flatten() {
        let rel = e.path().strip_prefix(src).map_err(err)?;
        let target = dest.join(rel);
        if e.file_type().is_dir() {
            fs::create_dir_all(&target).map_err(err)?;
        } else {
            fs::copy(e.path(), &target).map_err(err)?;
        }
    }
    Ok(())
}

fn new_theme_path(roots: &Roots, name: &str) -> CmdResult<PathBuf> {
    valid_theme_name(name)?;
    let dest = themes_dir(&roots.root()?).join(name.trim());
    if dest.exists() {
        return Err(format!("A theme folder named \"{}\" already exists", name.trim()));
    }
    Ok(dest)
}

#[tauri::command]
pub fn copy_theme(roots: State<Roots>, src: String, name: String) -> CmdResult<String> {
    let dest = new_theme_path(&roots, &name)?;
    copy_dir(Path::new(&src), &dest)?;
    Ok(dest.to_string_lossy().into_owned())
}

#[tauri::command]
pub fn create_theme_from_starter(app: AppHandle, roots: State<Roots>, name: String) -> CmdResult<String> {
    let dest = new_theme_path(&roots, &name)?;
    let starter = app
        .path()
        .resolve("starter-theme", tauri::path::BaseDirectory::Resource)
        .map_err(err)?;
    let starter = if starter.join("theme.xml").is_file() {
        starter
    } else {
        // `tauri dev` runs from the source tree.
        PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("resources").join("starter-theme")
    };
    copy_dir(&starter, &dest)?;
    Ok(dest.to_string_lossy().into_owned())
}

/// Copies a file the user picked into the theme and returns its theme-relative path.
#[tauri::command]
pub fn import_asset(roots: State<Roots>, theme_dir: String, src: String, dest_rel_dir: String) -> CmdResult<String> {
    let src_p = PathBuf::from(&src);
    let file_name = src_p.file_name().ok_or("No file name")?.to_string_lossy().into_owned();
    let dir = PathBuf::from(&theme_dir).join(&dest_rel_dir);
    let mut target = dir.join(&file_name);
    ensure_writable(&roots, &target)?;
    let (stem, ext) = match file_name.rsplit_once('.') {
        Some((s, e)) => (s.to_string(), format!(".{e}")),
        None => (file_name.clone(), String::new()),
    };
    let mut n = 2;
    while target.exists() {
        target = dir.join(format!("{stem}-{n}{ext}"));
        n += 1;
    }
    fs::create_dir_all(&dir).map_err(err)?;
    fs::copy(&src_p, &target).map_err(err)?;
    let rel = target.strip_prefix(&theme_dir).map_err(err)?.to_string_lossy().replace('\\', "/");
    Ok(rel)
}

/// Moves a theme folder to the Recycle Bin after zipping a backup of it. The theme RetroBat is
/// currently using can't be deleted, so RetroBat always has a theme to start with.
#[tauri::command]
pub fn delete_theme(app: AppHandle, roots: State<Roots>, dir: String) -> CmdResult<String> {
    let root = roots.root()?;
    let path = PathBuf::from(&dir);
    let themes = themes_dir(&root);
    let is_direct_child = path.parent().map(|p| normalize(p).to_string_lossy().to_lowercase() == normalize(&themes).to_string_lossy().to_lowercase()).unwrap_or(false);
    if !is_inside(&path, &themes) || !is_direct_child || !path.join("theme.xml").is_file() {
        return Err(format!("{dir} is not a theme folder"));
    }
    let name = path.file_name().map(|n| n.to_string_lossy().into_owned()).unwrap_or_default();
    if active_theme(&root).is_some_and(|a| a.eq_ignore_ascii_case(&name)) {
        return Err(format!("\"{name}\" is the theme RetroBat is using. Pick another theme in RetroBat (or use “Use in RetroBat” on another one) before deleting it."));
    }
    let backup = backup_theme(app, dir.clone(), None)?;
    trash::delete(&path).map_err(|e| format!("Couldn't move the theme to the Recycle Bin: {e}"))?;
    Ok(backup)
}

/// Theme option choices RetroBat saved for this theme, as raw `key=value` text.
#[tauri::command]
pub fn read_themesettings(roots: State<Roots>, theme: String) -> CmdResult<String> {
    let p = es_home(&roots.root()?).join("themesettings").join(format!("{theme}.cfg"));
    Ok(fs::read_to_string(p).unwrap_or_default())
}

/// Sets `ThemeSet` in es_settings.cfg, after copying the file to es_settings.cfg.bak.
#[tauri::command]
pub fn set_active_theme(roots: State<Roots>, theme: String) -> CmdResult<()> {
    let root = roots.root()?;
    if !themes_dir(&root).join(&theme).join("theme.xml").is_file() {
        return Err(format!("Theme \"{theme}\" not found"));
    }
    let cfg_path = es_home(&root).join("es_settings.cfg");
    let line = format!("<string name=\"ThemeSet\" value=\"{}\" />", escape_attr(&theme));
    let text = if cfg_path.is_file() {
        let cur = fs::read_to_string(&cfg_path).map_err(err)?;
        fs::copy(&cfg_path, cfg_path.with_extension("cfg.bak")).map_err(err)?;
        if let Some(pos) = cur.find("name=\"ThemeSet\"") {
            let start = cur[..pos].rfind('<').ok_or("Malformed es_settings.cfg")?;
            let end = cur[pos..].find('>').ok_or("Malformed es_settings.cfg")? + pos + 1;
            format!("{}{}{}", &cur[..start], line, &cur[end..])
        } else if let Some(pos) = cur.rfind("</config>") {
            let eol = if cur.contains("\r\n") { "\r\n" } else { "\n" };
            format!("{}\t{}{}{}", &cur[..pos], line, eol, &cur[pos..])
        } else {
            return Err("es_settings.cfg has no <config> element".into());
        }
    } else {
        format!("<?xml version=\"1.0\"?>\r\n<config>\r\n\t{line}\r\n</config>\r\n")
    };
    fs::write(&cfg_path, text).map_err(err)
}

#[tauri::command]
pub fn launch_retrobat(roots: State<Roots>) -> CmdResult<()> {
    let root = roots.root()?;
    let exe = root.join("RetroBat.exe");
    if !exe.is_file() {
        return Err(format!("{} not found", exe.display()));
    }
    std::process::Command::new(&exe).current_dir(&root).spawn().map_err(err)?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn inside_checks() {
        let p = Path::new(r"M:\Retrobat\emulationstation\.emulationstation\themes");
        assert!(is_inside(Path::new(r"M:\Retrobat\emulationstation\.emulationstation\themes\x\theme.xml"), p));
        assert!(is_inside(Path::new(r"m:\retrobat\EmulationStation\.emulationstation\themes\x"), p));
        assert!(!is_inside(Path::new(r"M:\Retrobat\emulationstation\.emulationstation\themes"), p));
        assert!(!is_inside(Path::new(r"M:\Retrobat\emulationstation\.emulationstation\themes\..\es_settings.cfg"), p));
        assert!(!is_inside(Path::new(r"M:\Retrobat\emulationstation\.emulationstation\themes2\a"), p));
    }

    #[test]
    fn theme_names() {
        assert!(valid_theme_name("Booga's WiiTheme v6").is_ok());
        assert!(valid_theme_name("a/b").is_err());
        assert!(valid_theme_name("..").is_err());
        assert!(valid_theme_name(" ").is_err());
    }

    #[test]
    fn timestamp_shape() {
        assert_eq!(timestamp().len(), 15);
    }
}
