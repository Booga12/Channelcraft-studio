use serde::Serialize;
use std::fs;
use std::path::{Component, Path, PathBuf};
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Manager, State};
use walkdir::WalkDir;

pub(crate) type CmdResult<T> = Result<T, String>;

// Every command is sync: Tauri then runs it on a worker thread instead of the window's thread,
// so slow work (zipping backups, scanning folders, downloads) never freezes the window.

pub(crate) fn err<E: std::fmt::Display>(e: E) -> String {
    e.to_string()
}

/// The RetroBat folder the user picked. Every write must land inside its themes folder
/// (or be the es_settings.cfg file), so a bug in the UI can't touch anything else.
#[derive(Default)]
pub struct Roots(pub Mutex<Option<PathBuf>>);

impl Roots {
    pub(crate) fn root(&self) -> CmdResult<PathBuf> {
        self.0.lock().unwrap().clone().ok_or_else(|| "RetroBat folder is not set".into())
    }
}

fn es_home(root: &Path) -> PathBuf {
    root.join("emulationstation").join(".emulationstation")
}

pub(crate) fn themes_dir(root: &Path) -> PathBuf {
    es_home(root).join("themes")
}

/// Lexically normalizes a path (resolves `.` and `..`) without touching the disk.
pub(crate) fn normalize(p: &Path) -> PathBuf {
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

pub(crate) fn is_inside(child: &Path, parent: &Path) -> bool {
    let c = normalize(child).to_string_lossy().to_lowercase();
    let p = normalize(parent).to_string_lossy().to_lowercase();
    let p = p.trim_end_matches(['\\', '/']);
    c.len() > p.len() && c.starts_with(p) && matches!(c.as_bytes()[p.len()], b'\\' | b'/')
}

pub(crate) fn ensure_writable(roots: &Roots, path: &Path) -> CmdResult<()> {
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
    es: EsSettings,
}

/// RetroBat settings that change how a theme looks, read from es_settings.cfg (RetroBat's own
/// defaults when a setting isn't there).
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EsSettings {
    /// Clock in 12 hours with AM/PM (ClockMode12).
    clock12: bool,
    /// The clock is shown at all (DrawClock); the theme can't override it.
    draw_clock: bool,
    /// "auto" lets the theme choose its screen transition; anything else overrides the theme.
    transition_style: String,
    /// "instant" turns every transition off.
    power_saver: String,
}

fn es_value(cfg: &str, name: &str) -> Option<String> {
    let key = format!("name=\"{name}\"");
    let line = cfg.lines().find(|l| l.contains(&key))?;
    let start = line.find("value=\"")? + 7;
    let end = line[start..].find('"')? + start;
    Some(unescape_attr(&line[start..end]))
}

fn es_settings(root: &Path) -> EsSettings {
    let cfg = fs::read_to_string(es_home(root).join("es_settings.cfg")).unwrap_or_default();
    let flag = |name: &str, default: bool| es_value(&cfg, name).map(|v| v == "true").unwrap_or(default);
    EsSettings {
        clock12: flag("ClockMode12", false),
        draw_clock: flag("DrawClock", true),
        transition_style: es_value(&cfg, "TransitionStyle").filter(|v| !v.is_empty()).unwrap_or_else(|| "auto".into()),
        power_saver: es_value(&cfg, "PowerSaverMode").unwrap_or_else(|| "disabled".into()),
    }
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

pub(crate) fn file_kind(path: &Path) -> &'static str {
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

pub(crate) fn active_theme(root: &Path) -> Option<String> {
    es_value(&fs::read_to_string(es_home(root).join("es_settings.cfg")).ok()?, "ThemeSet")
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
        es: es_settings(root),
    }
}

/// Looks for `X:\RetroBat` on every drive letter.
#[tauri::command(async)]
pub fn detect_retrobat() -> CmdResult<Option<String>> {
    for letter in b'C'..=b'Z' {
        let p = PathBuf::from(format!("{}:\\RetroBat", letter as char));
        if themes_dir(&p).is_dir() {
            return Ok(Some(p.to_string_lossy().into_owned()));
        }
    }
    Ok(None)
}

#[tauri::command(async)]
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

#[tauri::command(async)]
pub fn root_status(roots: State<Roots>) -> CmdResult<RootInfo> {
    Ok(root_info(&roots.root()?))
}

#[tauri::command(async)]
pub fn list_themes(roots: State<Roots>) -> CmdResult<Vec<ThemeInfo>> {
    let dir = themes_dir(&roots.root()?);
    let mut out = Vec::new();
    for entry in fs::read_dir(&dir).map_err(err)?.flatten() {
        let p = entry.path();
        // Folders starting with "." are ChannelCraft's own work folders (or hidden ones).
        if !p.join("theme.xml").is_file() || entry.file_name().to_string_lossy().starts_with('.') {
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

#[tauri::command(async)]
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
#[tauri::command(async)]
pub fn read_theme_xml(dir: String) -> CmdResult<Vec<TextFile>> {
    let mut out = Vec::new();
    for e in WalkDir::new(&dir).into_iter().flatten() {
        if e.file_type().is_file() && file_kind(e.path()) == "xml" {
            out.push(read_text_file(e.path())?);
        }
    }
    Ok(out)
}

#[derive(Serialize)]
pub struct LoadedTheme {
    entries: Vec<FileEntry>,
    xml: Vec<TextFile>,
}

/// Lists a theme's files and reads its XML in one walk of the folder, reading the XML files on
/// several threads (big themes have thousands of them, and a slow drive makes one-by-one reads
/// the slowest part of opening a theme).
#[tauri::command(async)]
pub fn load_theme(dir: String) -> CmdResult<LoadedTheme> {
    let base = PathBuf::from(&dir);
    let mut entries = Vec::new();
    let mut xml_paths = Vec::new();
    for e in WalkDir::new(&base).into_iter().flatten() {
        if !e.file_type().is_file() {
            continue;
        }
        let rel = e.path().strip_prefix(&base).map_err(err)?.to_string_lossy().replace('\\', "/");
        let kind = file_kind(e.path());
        if kind == "xml" {
            xml_paths.push(e.path().to_path_buf());
        }
        entries.push(FileEntry { kind, size: e.metadata().map(|m| m.len()).unwrap_or(0), rel });
    }
    let xml = read_parallel(&xml_paths)?;
    Ok(LoadedTheme { entries, xml })
}

/// Reads text files on a few threads, keeping their order.
fn read_parallel(paths: &[PathBuf]) -> CmdResult<Vec<TextFile>> {
    let threads = std::thread::available_parallelism().map(|n| n.get()).unwrap_or(4).clamp(1, 8);
    let chunk = paths.len().div_ceil(threads).max(1);
    let parts: Vec<CmdResult<Vec<TextFile>>> = std::thread::scope(|s| {
        let handles: Vec<_> = paths.chunks(chunk).map(|part| s.spawn(move || part.iter().map(|p| read_text_file(p)).collect::<CmdResult<Vec<_>>>())).collect();
        handles.into_iter().map(|h| h.join().unwrap_or_else(|_| Err("A file reader stopped unexpectedly".into()))).collect()
    });
    let mut out = Vec::with_capacity(paths.len());
    for p in parts {
        out.extend(p?);
    }
    Ok(out)
}

#[tauri::command(async)]
pub fn read_text(path: String) -> CmdResult<TextFile> {
    read_text_file(Path::new(&path))
}

#[tauri::command(async)]
pub fn read_text_optional(path: String) -> CmdResult<Option<TextFile>> {
    Ok(read_text_file(Path::new(&path)).ok())
}

pub(crate) fn timestamp() -> String {
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

#[tauri::command(async)]
pub fn backups_dir(app: AppHandle) -> CmdResult<String> {
    Ok(app.path().app_data_dir().map_err(err)?.join("backups").to_string_lossy().into_owned())
}

/// A bundled resource in the source tree, for `tauri dev`. Release builds never look there, so the
/// developer's folder path isn't built into the app.
pub(crate) fn dev_resource(rel: &str) -> Option<PathBuf> {
    #[cfg(debug_assertions)]
    return Some(PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("resources").join(rel));
    #[cfg(not(debug_assertions))]
    {
        let _ = rel;
        None
    }
}

/// The open-source licences file installed with the app.
#[tauri::command(async)]
pub fn notices_path(app: AppHandle) -> CmdResult<String> {
    let installed = app.path().resolve("THIRD-PARTY-NOTICES.txt", tauri::path::BaseDirectory::Resource).map_err(err)?;
    let p = if installed.is_file() { installed } else { dev_resource("THIRD-PARTY-NOTICES.txt").unwrap_or_default() };
    if !p.is_file() {
        return Err("The licences file is missing from this copy of the app.".into());
    }
    Ok(p.to_string_lossy().into_owned())
}

/// Writes binary data (base64) inside the themes folder, e.g. a preview.png or artwork.
#[tauri::command(async)]
pub fn write_binary(roots: State<Roots>, path: String, base64: String) -> CmdResult<()> {
    use base64::Engine;
    let p = PathBuf::from(&path);
    ensure_writable(&roots, &p)?;
    let bytes = base64::engine::general_purpose::STANDARD.decode(base64.as_bytes()).map_err(err)?;
    crate::storage::write_atomic(&p, &bytes)
}

/// Copies every file of a folder (from any installed theme) into a theme's subfolder, keeping
/// files that are already there. Returns how many files were copied.
#[tauri::command(async)]
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
        // Only real pictures and the like; anything else in that folder stays behind.
        if !target.exists() && crate::importing::check_file(&p, None).is_ok() {
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
#[tauri::command(async)]
pub fn save_recovery(app: AppHandle, key: String, data: String) -> CmdResult<()> {
    fs::write(recovery_path(&app, &key)?, data).map_err(err)
}

#[tauri::command(async)]
pub fn load_recovery(app: AppHandle, key: String) -> CmdResult<Option<String>> {
    Ok(fs::read_to_string(recovery_path(&app, &key)?).ok())
}

#[tauri::command(async)]
pub fn clear_recovery(app: AppHandle, key: String) -> CmdResult<()> {
    let p = recovery_path(&app, &key)?;
    if p.exists() {
        fs::remove_file(p).map_err(err)?;
    }
    Ok(())
}

/// A system's ROM folder from its es_systems.cfg `<path>`: `~` is RetroBat's emulationstation
/// folder and relative paths start there too; without a path it's `roms\<name>`.
fn rom_dir(root: &Path, name: &str, raw: Option<&str>) -> PathBuf {
    let es = root.join("emulationstation");
    match raw.map(str::trim).filter(|r| !r.is_empty()) {
        None => root.join("roms").join(name),
        Some(r) => {
            let r = r.replace('/', "\\");
            let p = if let Some(rest) = r.strip_prefix('~') {
                es.join(rest.trim_start_matches('\\'))
            } else if Path::new(&r).is_absolute() {
                PathBuf::from(&r)
            } else {
                es.join(&r)
            };
            normalize(&p)
        }
    }
}

#[derive(serde::Deserialize)]
pub struct SystemPath {
    name: String,
    path: Option<String>,
}

/// Systems (by name) that have a scraped gamelist.xml in their ROM folder.
#[tauri::command(async)]
pub fn list_gamelists(roots: State<Roots>, systems: Option<Vec<SystemPath>>) -> CmdResult<Vec<String>> {
    let root = roots.root()?;
    let mut out: Vec<String> = match systems {
        Some(list) => list.into_iter().filter(|s| rom_dir(&root, &s.name, s.path.as_deref()).join("gamelist.xml").is_file()).map(|s| s.name).collect(),
        None => fs::read_dir(root.join("roms"))
            .map_err(err)?
            .flatten()
            .filter(|e| e.path().join("gamelist.xml").is_file())
            .map(|e| e.file_name().to_string_lossy().into_owned())
            .collect(),
    };
    out.sort();
    out.dedup();
    Ok(out)
}

/// A system's gamelist.xml. Its folder is allowed for the preview, so its pictures and videos
/// show even when the ROMs are on another drive.
#[tauri::command(async)]
pub fn read_gamelist(app: AppHandle, roots: State<Roots>, system: String, path: Option<String>) -> CmdResult<Option<TextFile>> {
    if system.contains(['\\', '/', ':']) || system.starts_with('.') {
        return Err("Bad system name".into());
    }
    let root = roots.root()?;
    let dir = rom_dir(&root, &system, path.as_deref());
    let p = dir.join("gamelist.xml");
    if !p.is_file() {
        return Ok(None);
    }
    if !is_inside(&dir, &root) {
        app.asset_protocol_scope().allow_directory(&dir, true).map_err(err)?;
    }
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
#[tauri::command(async)]
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
#[tauri::command(async)]
pub fn add_font_to_theme(roots: State<Roots>, theme_dir: String, src: String) -> CmdResult<String> {
    let src_p = PathBuf::from(&src);
    let file_name = src_p.file_name().ok_or("No file name")?.to_string_lossy().into_owned();
    let target = PathBuf::from(&theme_dir).join("_inc").join("fonts").join(&file_name);
    ensure_writable(&roots, &target)?;
    crate::importing::check_file(&src_p, Some(crate::importing::Kind::Font))?;
    if !target.exists() {
        fs::create_dir_all(target.parent().unwrap()).map_err(err)?;
        fs::copy(&src_p, &target).map_err(err)?;
    }
    Ok(format!("_inc/fonts/{file_name}"))
}

/// Downloads an open-licence font from the Google Fonts repository into the theme.
#[tauri::command(async)]
pub fn download_font(roots: State<Roots>, theme_dir: String, url: String, file_name: String) -> CmdResult<String> {
    const ALLOWED: &str = "https://raw.githubusercontent.com/google/fonts/main/";
    if !url.starts_with(ALLOWED) || file_name.contains(['\\', '/', ':']) {
        return Err("Fonts can only be downloaded from the Google Fonts repository".into());
    }
    let target = PathBuf::from(&theme_dir).join("_inc").join("fonts").join(&file_name);
    ensure_writable(&roots, &target)?;
    // The Open Font License must travel with the font: OFL.txt from the font's folder goes next to it.
    let (dir_url, _) = url.rsplit_once('/').ok_or("Bad font address")?;
    let family = dir_url.rsplit('/').next().unwrap_or("font");
    let licence = target.with_file_name(format!("{family}-OFL.txt"));
    if !target.exists() {
        let resp = ureq::get(&url).call().map_err(|e| format!("Download failed: {e}"))?;
        let mut bytes = Vec::new();
        // Fonts are small; refuse anything over 20 MB.
        let mut reader = std::io::Read::take(resp.into_reader(), 20 * 1024 * 1024);
        std::io::Read::read_to_end(&mut reader, &mut bytes).map_err(err)?;
        crate::importing::check_content(&file_name, crate::importing::Kind::Font, &bytes[..bytes.len().min(8192)], bytes.len() as u64).map_err(|r| format!("The download isn't a usable font: {r}."))?;
        if !licence.exists() {
            fetch_ofl(dir_url, &licence).map_err(|e| format!("{e}, so the font wasn't added."))?;
        }
        crate::storage::write_atomic(&target, &bytes)?;
    } else if !licence.exists() {
        // A font downloaded by an older version: add its licence when we can.
        let _ = fetch_ofl(dir_url, &licence);
    }
    Ok(format!("_inc/fonts/{file_name}"))
}

fn fetch_ofl(dir_url: &str, dest: &Path) -> CmdResult<()> {
    let resp = ureq::get(&format!("{dir_url}/OFL.txt")).call().map_err(|e| format!("The font's licence couldn't be downloaded ({e})"))?;
    let mut text = String::new();
    std::io::Read::read_to_string(&mut std::io::Read::take(resp.into_reader(), 256 * 1024), &mut text).map_err(err)?;
    if !text.to_ascii_uppercase().contains("SIL OPEN FONT LICENSE") {
        return Err("The font's licence file isn't the Open Font License".into());
    }
    fs::create_dir_all(dest.parent().ok_or("No folder")?).map_err(err)?;
    crate::storage::write_atomic(dest, text.as_bytes())
}

pub(crate) fn new_theme_path(roots: &Roots, name: &str) -> CmdResult<PathBuf> {
    valid_theme_name(name)?;
    let dest = themes_dir(&roots.root()?).join(name.trim());
    if dest.exists() {
        return Err(format!("A theme folder named \"{}\" already exists", name.trim()));
    }
    Ok(dest)
}

/// Copies a file the user picked into the theme and returns its theme-relative path.
#[tauri::command(async)]
pub fn import_asset(roots: State<Roots>, theme_dir: String, src: String, dest_rel_dir: String) -> CmdResult<String> {
    use crate::importing::{check_file, copy_checked, Kind};
    let src_p = PathBuf::from(&src);
    let want = match dest_rel_dir.as_str() {
        "_inc/images" => Some(Kind::Image),
        "_inc/fonts" => Some(Kind::Font),
        "_inc/sounds" => Some(Kind::Sound),
        "_inc/videos" => Some(Kind::Video),
        _ => None,
    };
    check_file(&src_p, want)?;
    let dir = PathBuf::from(&theme_dir).join(&dest_rel_dir);
    ensure_writable(&roots, &dir.join("x"))?;
    let target = copy_checked(&src_p, &dir)?;
    let rel = target.strip_prefix(&theme_dir).map_err(err)?.to_string_lossy().replace('\\', "/");
    Ok(rel)
}

/// Moves a theme folder to the Recycle Bin, which is the way back (no backup zip: copying a
/// whole theme first made deleting slow). The theme RetroBat is currently using can't be
/// deleted, so RetroBat always has a theme to start with.
#[tauri::command(async)]
pub fn delete_theme(roots: State<Roots>, dir: String) -> CmdResult<()> {
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
    trash::delete(&path).map_err(|e| format!("Couldn't move the theme to the Recycle Bin: {e}"))?;
    Ok(())
}

/// Theme option choices RetroBat saved for this theme, as raw `key=value` text.
#[tauri::command(async)]
pub fn read_themesettings(roots: State<Roots>, theme: String) -> CmdResult<String> {
    let p = es_home(&roots.root()?).join("themesettings").join(format!("{theme}.cfg"));
    Ok(fs::read_to_string(p).unwrap_or_default())
}

/// Sets `ThemeSet` in es_settings.cfg, after copying the file to es_settings.cfg.bak.
#[tauri::command(async)]
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

#[tauri::command(async)]
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
    fn load_theme_matches_listing_and_reading_separately() {
        let dir = std::env::temp_dir().join(format!("ccs-load-{}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        for i in 0..40 {
            let sub = dir.join(format!("_inc/{}", i % 5));
            fs::create_dir_all(&sub).unwrap();
            fs::write(sub.join(format!("f{i}.xml")), format!("<theme>{i}</theme>")).unwrap();
            fs::write(sub.join(format!("p{i}.png")), b"\x89PNG").unwrap();
        }
        fs::write(dir.join("theme.xml"), "<theme/>").unwrap();
        let d = dir.to_string_lossy().into_owned();
        let all = load_theme(d.clone()).unwrap();
        let list = list_theme_files(d.clone()).unwrap();
        let xml = read_theme_xml(d).unwrap();
        assert_eq!(all.entries.iter().map(|e| &e.rel).collect::<Vec<_>>(), list.iter().map(|e| &e.rel).collect::<Vec<_>>());
        assert_eq!(all.xml.iter().map(|f| (&f.path, &f.text)).collect::<Vec<_>>(), xml.iter().map(|f| (&f.path, &f.text)).collect::<Vec<_>>());
        assert_eq!(all.xml.len(), 41);
        fs::remove_dir_all(&dir).unwrap();
    }

    /// Read-only timing on a real theme: CCS_REAL_THEME=<theme folder> cargo test -- --ignored timing --nocapture
    #[test]
    #[ignore]
    fn timing_on_a_real_theme() {
        let Ok(d) = std::env::var("CCS_REAL_THEME") else { return };
        let t = std::time::Instant::now();
        let a = list_theme_files(d.clone()).unwrap();
        let b = read_theme_xml(d.clone()).unwrap();
        let old = t.elapsed();
        let t = std::time::Instant::now();
        let all = load_theme(d).unwrap();
        let new = t.elapsed();
        assert_eq!((a.len(), b.len()), (all.entries.len(), all.xml.len()));
        println!("{} files, {} xml: separately {:?}, together {:?}", a.len(), b.len(), old, new);
    }

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
        assert!(valid_theme_name("Jane's Theme v6").is_ok());
        assert!(valid_theme_name("a/b").is_err());
        assert!(valid_theme_name("..").is_err());
        assert!(valid_theme_name(" ").is_err());
    }

    #[test]
    fn reads_es_settings_values() {
        let cfg = "<config>
	<bool name=\"ClockMode12\" value=\"true\" />
	<string name=\"ThemeSet\" value=\"Jane&apos;s\" />
</config>";
        assert_eq!(es_value(cfg, "ClockMode12").as_deref(), Some("true"));
        assert_eq!(es_value(cfg, "ThemeSet").as_deref(), Some("Jane's"));
        assert_eq!(es_value(cfg, "DrawClock"), None);
    }

    #[test]
    fn finds_rom_folders_like_retrobat() {
        let root = Path::new(r"M:\Retrobat");
        assert_eq!(rom_dir(root, "snes", Some(r"~\..\roms\snes")), PathBuf::from(r"M:\Retrobat\roms\snes"));
        assert_eq!(rom_dir(root, "kodi", Some(r"~\..\kodi")), PathBuf::from(r"M:\Retrobat\kodi"));
        assert_eq!(rom_dir(root, "x", Some(r"D:\Games\x")), PathBuf::from(r"D:\Games\x"));
        assert_eq!(rom_dir(root, "x", None), PathBuf::from(r"M:\Retrobat\roms\x"));
    }

    #[test]
    fn timestamp_shape() {
        assert_eq!(timestamp().len(), 15);
    }
}

// ---- the whole Google Fonts library ----

#[derive(Serialize, Clone)]
pub struct GoogleFont {
    family: String,
    category: String,
}

static GOOGLE_FONTS: Mutex<Option<Vec<GoogleFont>>> = Mutex::new(None);

/// Every family in Google Fonts (name and category), fetched once per session.
#[tauri::command]
pub fn google_fonts() -> CmdResult<Vec<GoogleFont>> {
    if let Some(list) = GOOGLE_FONTS.lock().map_err(err)?.as_ref() {
        return Ok(list.clone());
    }
    let resp = ureq::get("https://fonts.google.com/metadata/fonts").call().map_err(|e| format!("The Google Fonts list couldn't be downloaded ({e})"))?;
    let mut text = String::new();
    std::io::Read::read_to_string(&mut std::io::Read::take(resp.into_reader(), 20 * 1024 * 1024), &mut text).map_err(err)?;
    // The reply may start with a guard line before the JSON.
    let json = text.trim_start_matches(|c| c != '{');
    let v: serde_json::Value = serde_json::from_str(json).map_err(|e| format!("The Google Fonts list couldn't be read ({e})"))?;
    let list: Vec<GoogleFont> = v["familyMetadataList"]
        .as_array()
        .ok_or("The Google Fonts list is in an unexpected format")?
        .iter()
        .filter_map(|f| Some(GoogleFont { family: f["family"].as_str()?.to_string(), category: f["category"].as_str().unwrap_or("").to_string() }))
        .collect();
    *GOOGLE_FONTS.lock().map_err(err)? = Some(list.clone());
    Ok(list)
}

#[derive(Serialize)]
pub struct GoogleFontFile {
    url: String,
    file_name: String,
}

/// Where a Google Fonts family's regular font file is in the Google Fonts repository (Open Font
/// License families only, so the licence can travel with the font).
#[tauri::command]
pub fn google_font_file(family: String) -> CmdResult<GoogleFontFile> {
    let dir: String = family.chars().filter(|c| c.is_ascii_alphanumeric()).collect::<String>().to_ascii_lowercase();
    if dir.is_empty() {
        return Err("No such font".into());
    }
    let api = format!("https://api.github.com/repos/google/fonts/contents/ofl/{dir}");
    let resp = ureq::get(&api)
        .set("User-Agent", "ChannelCraft-Studio")
        .set("Accept", "application/vnd.github+json")
        .call()
        .map_err(|e| match e {
            ureq::Error::Status(404, _) => format!("“{family}” isn't under the Open Font License in Google Fonts, so it can't be added to a shareable theme."),
            e => format!("Google Fonts couldn't be reached ({e})"),
        })?;
    let mut body = String::new();
    std::io::Read::read_to_string(&mut std::io::Read::take(resp.into_reader(), 4 * 1024 * 1024), &mut body).map_err(err)?;
    let v: serde_json::Value = serde_json::from_str(&body).map_err(|e| format!("Unexpected reply from GitHub ({e})"))?;
    let files: Vec<(String, String)> = v
        .as_array()
        .ok_or("Unexpected reply from GitHub")?
        .iter()
        .filter_map(|f| Some((f["name"].as_str()?.to_string(), f["download_url"].as_str()?.to_string())))
        .filter(|(n, _)| n.to_ascii_lowercase().ends_with(".ttf"))
        .collect();
    let upright = |n: &str| !n.to_ascii_lowercase().contains("italic");
    let pick = files
        .iter()
        .find(|(n, _)| n.ends_with("-Regular.ttf"))
        .or_else(|| files.iter().find(|(n, _)| n.contains('[') && upright(n)))
        .or_else(|| files.iter().find(|(n, _)| upright(n)))
        .or_else(|| files.first())
        .ok_or_else(|| format!("No font file found for “{family}”"))?;
    let file_name = pick.0.replace(['[', ']', ','], "_");
    Ok(GoogleFontFile { url: pick.1.clone(), file_name })
}
