// The Explorer panel: look through any folder on the PC (or the theme's own folder) and copy many
// files into the theme at once.
//
// Safety: everything outside the RetroBat themes folder is only read. Listing never follows links
// or junctions, skips hidden and system files, and lets the window show pictures from just the
// folders being looked at (one level each, not their subfolders). Copies go through the same
// checks as a single import (check_file, copy_checked) and only into the open theme's
// _inc/images, _inc/videos, _inc/sounds and _inc/fonts (ensure_writable).

use crate::commands::{ensure_writable, is_inside, themes_dir, CmdResult, Roots};
use crate::importing::{check_file, copy_checked, is_reparse, kind_of, Kind};
use serde::Serialize;
use std::fs;
use std::path::{Path, PathBuf};
use std::time::UNIX_EPOCH;
use tauri::{AppHandle, Manager, State};
use walkdir::WalkDir;

/// Most entries listed for one folder, so a huge folder can't stall the panel.
pub(crate) const MAX_LISTED: usize = 2000;
/// Most files a search returns, and most entries it looks at.
const MAX_FOUND: usize = 2000;
const MAX_VISITED: usize = 50_000;
/// How deep "everything in this folder" and search go.
const MAX_DEPTH: usize = 6;
/// Most files taken from one ticked folder.
const MAX_FOLDER_FILES: usize = 5000;
/// Most entries of one folder looked at closely (the rest are only counted), so a folder with
/// millions of files can't stall the panel.
const MAX_SCANNED: usize = 10_000;
/// Folders' item counts stop here (shown as "100+").
const MAX_COUNTED: usize = 100;

#[derive(Serialize, Debug, Clone)]
pub struct Entry {
    name: String,
    path: String,
    #[serde(rename = "isDir")]
    is_dir: bool,
    /// image, video, sound or font for files a theme can use; "other" for the rest; "" for folders.
    kind: &'static str,
    size: u64,
    /// Unix seconds.
    modified: u64,
    /// Why a file can't be added (wrong type, too large), or null when it can.
    problem: Option<String>,
    /// For folders: how many things are inside (up to MAX_COUNTED + 1).
    items: Option<usize>,
}

#[derive(Serialize, Debug)]
pub struct Listing {
    path: String,
    parent: Option<String>,
    entries: Vec<Entry>,
    /// Entries in the folder before the cap (hidden and system files not counted).
    total: usize,
    truncated: bool,
}

#[derive(Serialize, Debug)]
pub struct Place {
    name: String,
    path: String,
    /// "place", "drive" or "retrobat"
    group: &'static str,
    detail: String,
}

#[derive(Serialize, Debug, Default)]
pub struct AddResult {
    /// Theme-relative paths of files copied in.
    added: Vec<String>,
    /// Theme-relative paths of files that were already there (same contents, nothing copied).
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

fn theme_dir_for(k: Kind) -> Option<&'static str> {
    match k {
        Kind::Image => Some("_inc/images"),
        Kind::Video => Some("_inc/videos"),
        Kind::Sound => Some("_inc/sounds"),
        Kind::Font => Some("_inc/fonts"),
        _ => None,
    }
}

#[cfg(windows)]
fn is_hidden(name: &str, meta: &fs::Metadata) -> bool {
    use std::os::windows::fs::MetadataExt;
    // FILE_ATTRIBUTE_HIDDEN | FILE_ATTRIBUTE_SYSTEM
    name.starts_with('.') || meta.file_attributes() & 0x6 != 0
}
#[cfg(not(windows))]
fn is_hidden(name: &str, _meta: &fs::Metadata) -> bool {
    name.starts_with('.')
}

fn secs(meta: &fs::Metadata) -> u64 {
    meta.modified().ok().and_then(|t| t.duration_since(UNIX_EPOCH).ok()).map(|d| d.as_secs()).unwrap_or(0)
}

/// What a file is to a theme: its kind name and, when it can't be added, why. Only the name and
/// size are used here, so listing stays quick; the full check happens when it is copied.
fn classify(name: &str, size: u64) -> (&'static str, Option<String>) {
    match kind_of(name) {
        Ok(k) => match kind_name(k) {
            Some(n) if size > k.max_asset() => (n, Some(format!("Too large for a {} ({} MB; the limit is {} MB)", k.label(), size >> 20, k.max_asset() >> 20))),
            Some(n) => (n, None),
            None => ("other", Some("Themes can't use this kind of file".into())),
        },
        Err(why) => ("other", Some(format!("Can't be used: {why}"))),
    }
}

/// One entry of a folder, or None for links, junctions, hidden and system files.
fn entry_of(path: &Path) -> Option<Entry> {
    let meta = fs::symlink_metadata(path).ok()?;
    let name = path.file_name()?.to_string_lossy().into_owned();
    if meta.file_type().is_symlink() || is_reparse(&meta) || is_hidden(&name, &meta) || name.ends_with(".ccs-tmp") {
        return None;
    }
    if meta.is_dir() {
        // Counted later, only for the folders that are shown.
        return Some(Entry { name, path: path.to_string_lossy().into_owned(), is_dir: true, kind: "", size: 0, modified: secs(&meta), problem: None, items: None });
    }
    if !meta.is_file() {
        return None;
    }
    let (kind, problem) = classify(&name, meta.len());
    Some(Entry { name, path: path.to_string_lossy().into_owned(), is_dir: false, kind, size: meta.len(), modified: secs(&meta), problem, items: None })
}

fn sort_entries(v: &mut [Entry]) {
    v.sort_by(|a, b| b.is_dir.cmp(&a.is_dir).then_with(|| natural_cmp(&a.name, &b.name)));
}

/// Name order the way Explorer shows it: "2.png" before "10.png", ignoring case.
fn natural_cmp(a: &str, b: &str) -> std::cmp::Ordering {
    let (a, b) = (a.to_lowercase(), b.to_lowercase());
    let (mut x, mut y) = (a.chars().peekable(), b.chars().peekable());
    loop {
        match (x.peek().copied(), y.peek().copied()) {
            (None, None) => return std::cmp::Ordering::Equal,
            (None, _) => return std::cmp::Ordering::Less,
            (_, None) => return std::cmp::Ordering::Greater,
            (Some(c), Some(d)) if c.is_ascii_digit() && d.is_ascii_digit() => {
                let take = |it: &mut std::iter::Peekable<std::str::Chars>| {
                    let mut s = String::new();
                    while let Some(&ch) = it.peek() {
                        if !ch.is_ascii_digit() {
                            break;
                        }
                        s.push(ch);
                        it.next();
                    }
                    s
                };
                let (n, m) = (take(&mut x), take(&mut y));
                let (nt, mt) = (n.trim_start_matches('0'), m.trim_start_matches('0'));
                let o = nt.len().cmp(&mt.len()).then_with(|| nt.cmp(mt));
                if o != std::cmp::Ordering::Equal {
                    return o;
                }
            }
            (Some(c), Some(d)) => {
                if c != d {
                    return c.cmp(&d);
                }
                x.next();
                y.next();
            }
        }
    }
}

pub(crate) fn list_in(dir: &Path) -> CmdResult<Listing> {
    let meta = fs::metadata(dir).map_err(|e| format!("{} can't be opened: {e}", dir.display()))?;
    if !meta.is_dir() {
        return Err(format!("{} is not a folder", dir.display()));
    }
    let mut entries = Vec::new();
    let mut extra = 0;
    for e in fs::read_dir(dir).map_err(|e| format!("{} can't be opened: {e}", dir.display()))?.filter_map(Result::ok) {
        if entries.len() >= MAX_SCANNED {
            // Past this, entries are only counted (hidden files included).
            extra += 1;
            continue;
        }
        if let Some(en) = entry_of(&e.path()) {
            entries.push(en);
        }
    }
    let total = entries.len() + extra;
    sort_entries(&mut entries);
    // Folders come first, so a cap keeps the folders and drops the last files.
    let truncated = total > MAX_LISTED;
    entries.truncate(MAX_LISTED);
    for en in entries.iter_mut().filter(|e| e.is_dir) {
        en.items = fs::read_dir(&en.path).ok().map(|d| d.take(MAX_COUNTED + 1).count());
    }
    Ok(Listing { path: dir.to_string_lossy().into_owned(), parent: dir.parent().map(|p| p.to_string_lossy().into_owned()), entries, total, truncated })
}

/// Lets the window show pictures and videos from one folder (not its subfolders).
fn allow_view(app: &AppHandle, dir: &Path) {
    let scope = app.asset_protocol_scope();
    let _ = scope.allow_directory(dir, false);
    // The protocol checks a file's real location (see assets.rs).
    if let Ok(real) = fs::canonicalize(dir) {
        let _ = scope.allow_directory(real, false);
    }
}

#[tauri::command(async)]
pub fn explorer_list(app: AppHandle, path: String) -> CmdResult<Listing> {
    let dir = PathBuf::from(&path);
    let listing = list_in(&dir)?;
    allow_view(&app, &dir);
    Ok(listing)
}

pub(crate) fn search_in(dir: &Path, query: &str) -> (Vec<Entry>, bool) {
    let q = query.trim().to_lowercase();
    let mut out = Vec::new();
    if q.is_empty() {
        return (out, false);
    }
    let mut visited = 0;
    let mut truncated = false;
    let walker = WalkDir::new(dir).min_depth(1).max_depth(MAX_DEPTH).into_iter().filter_entry(|e| {
        // Hidden and system folders, links and junctions aren't searched.
        let name = e.file_name().to_string_lossy();
        fs::symlink_metadata(e.path()).map(|m| !(m.file_type().is_symlink() || is_reparse(&m) || is_hidden(&name, &m))).unwrap_or(false)
    });
    for e in walker.filter_map(Result::ok) {
        visited += 1;
        if visited > MAX_VISITED || out.len() >= MAX_FOUND {
            truncated = true;
            break;
        }
        if e.file_type().is_file()
            && e.file_name().to_string_lossy().to_lowercase().contains(&q)
            && let Some(en) = entry_of(e.path())
        {
            out.push(en);
        }
    }
    sort_entries(&mut out);
    (out, truncated)
}

#[derive(Serialize, Debug)]
pub struct Found {
    entries: Vec<Entry>,
    /// The search stopped early (too many files); refine it to see the rest.
    truncated: bool,
}

/// Files whose names contain `query`, in a folder and the folders inside it.
#[tauri::command(async)]
pub fn explorer_search(app: AppHandle, path: String, query: String) -> CmdResult<Found> {
    let dir = PathBuf::from(&path);
    if !dir.is_dir() {
        return Err(format!("{path} is not a folder"));
    }
    let (entries, truncated) = search_in(&dir, &query);
    let mut seen = std::collections::HashSet::new();
    for e in &entries {
        if let Some(parent) = Path::new(&e.path).parent()
            && seen.insert(parent.to_path_buf())
        {
            allow_view(&app, parent);
        }
    }
    Ok(Found { entries, truncated })
}

#[derive(Serialize, Debug)]
pub struct FolderFile {
    path: String,
    size: u64,
}

/// Every file a theme can use in a folder and the folders inside it (for ticking a folder). Stops
/// after MAX_FOLDER_FILES files or MAX_VISITED entries looked at (truncated is then true).
pub(crate) fn usable_in(dir: &Path) -> (Vec<FolderFile>, bool) {
    let mut out = Vec::new();
    let mut visited = 0;
    let walker = WalkDir::new(dir).min_depth(1).max_depth(MAX_DEPTH).into_iter().filter_entry(|e| {
        let name = e.file_name().to_string_lossy();
        fs::symlink_metadata(e.path()).map(|m| !(m.file_type().is_symlink() || is_reparse(&m) || is_hidden(&name, &m))).unwrap_or(false)
    });
    let mut truncated = false;
    for e in walker.filter_map(Result::ok) {
        visited += 1;
        if visited > MAX_VISITED {
            truncated = true;
            break;
        }
        if !e.file_type().is_file() {
            continue;
        }
        let Ok(meta) = e.metadata() else { continue };
        let (_, problem) = classify(&e.file_name().to_string_lossy(), meta.len());
        if problem.is_none() {
            out.push(FolderFile { path: e.path().to_string_lossy().into_owned(), size: meta.len() });
            if out.len() >= MAX_FOLDER_FILES {
                truncated = true;
                break;
            }
        }
    }
    out.sort_by(|a, b| natural_cmp(&a.path, &b.path));
    (out, truncated)
}

#[derive(Serialize, Debug)]
pub struct FolderFiles {
    files: Vec<FolderFile>,
    truncated: bool,
}

#[tauri::command(async)]
pub fn explorer_folder_files(path: String) -> CmdResult<FolderFiles> {
    let dir = PathBuf::from(&path);
    if !dir.is_dir() {
        return Err(format!("{path} is not a folder"));
    }
    let (files, truncated) = usable_in(&dir);
    Ok(FolderFiles { files, truncated })
}

/// Places to start from: Windows' own folders, the drives, and RetroBat's folders.
#[tauri::command(async)]
pub fn explorer_places(app: AppHandle, roots: State<Roots>) -> CmdResult<Vec<Place>> {
    let mut out = Vec::new();
    let p = app.path();
    for (name, dir) in [("Desktop", p.desktop_dir()), ("Downloads", p.download_dir()), ("Pictures", p.picture_dir()), ("Videos", p.video_dir()), ("Music", p.audio_dir()), ("Documents", p.document_dir())] {
        if let Ok(d) = dir
            && d.is_dir()
        {
            out.push(Place { name: name.into(), path: d.to_string_lossy().into_owned(), group: "place", detail: String::new() });
        }
    }
    #[cfg(windows)]
    for letter in b'A'..=b'Z' {
        let root = format!("{}:\\", letter as char);
        if Path::new(&root).is_dir() {
            out.push(Place { name: format!("Drive {}:", letter as char), path: root, group: "drive", detail: String::new() });
        }
    }
    #[cfg(not(windows))]
    out.push(Place { name: "Computer".into(), path: "/".into(), group: "drive", detail: String::new() });
    if let Ok(root) = roots.root() {
        let themes = themes_dir(&root);
        out.push(Place { name: "RetroBat folder".into(), path: root.to_string_lossy().into_owned(), group: "retrobat", detail: root.to_string_lossy().into_owned() });
        let roms = root.join("roms");
        if roms.is_dir() {
            out.push(Place { name: "Games and their art".into(), path: roms.to_string_lossy().into_owned(), group: "retrobat", detail: "roms: box art, logos, videos".into() });
        }
        if themes.is_dir() {
            let n = fs::read_dir(&themes).map(|d| d.filter_map(Result::ok).filter(|e| e.path().join("theme.xml").is_file()).count()).unwrap_or(0);
            out.push(Place { name: "Installed themes".into(), path: themes.to_string_lossy().into_owned(), group: "retrobat", detail: format!("{n} installed") });
        }
    }
    Ok(out)
}

/// Copies files into the theme, each into the folder for its kind. A file already in the theme
/// is left where it is; the same file twice is reused; a different file with the same name gets
/// "-2". Problems are listed per file and don't stop the rest.
pub(crate) fn add_into(theme: &Path, paths: &[String], writable: impl Fn(&Path) -> CmdResult<()>) -> AddResult {
    let mut res = AddResult::default();
    let rel_of = |p: &Path| p.strip_prefix(theme).map(|r| r.to_string_lossy().replace('\\', "/")).unwrap_or_else(|_| p.to_string_lossy().into_owned());
    for src in paths {
        let src_p = PathBuf::from(src);
        let name = src_p.file_name().map(|n| n.to_string_lossy().into_owned()).unwrap_or_else(|| src.clone());
        if is_inside(&src_p, theme) {
            res.existing.push(rel_of(&src_p));
            continue;
        }
        let kind = match check_file(&src_p, None) {
            Ok(k) => k,
            Err(e) => {
                res.problems.push(e);
                continue;
            }
        };
        let Some(dir_rel) = theme_dir_for(kind) else {
            res.problems.push(format!("{name} isn't a picture, video, sound or font."));
            continue;
        };
        let dir = theme.join(dir_rel);
        if let Err(e) = writable(&dir.join("x")) {
            res.problems.push(e);
            continue;
        }
        // Files copy_checked could reuse: the name and its "-2", "-3"... versions already there.
        let (stem, ext) = match name.rsplit_once('.') {
            Some((s, e)) => (s.to_string(), format!(".{e}")),
            None => (name.clone(), String::new()),
        };
        let mut there = std::collections::HashSet::new();
        let (mut cand, mut n) = (dir.join(&name), 2);
        while cand.exists() {
            there.insert(cand.clone());
            cand = dir.join(format!("{stem}-{n}{ext}"));
            n += 1;
        }
        match copy_checked(&src_p, &dir) {
            Ok(t) => {
                if there.contains(&t) {
                    res.existing.push(rel_of(&t));
                } else {
                    res.added.push(rel_of(&t));
                }
            }
            Err(e) => res.problems.push(format!("{name}: {e}")),
        }
    }
    res
}

#[tauri::command(async)]
pub fn explorer_add_to_theme(roots: State<Roots>, theme_dir: String, paths: Vec<String>) -> CmdResult<AddResult> {
    let theme = PathBuf::from(&theme_dir);
    if !theme.join("theme.xml").is_file() {
        return Err(format!("{theme_dir} is not a theme folder"));
    }
    ensure_writable(&roots, &theme.join("theme.xml"))?;
    Ok(add_into(&theme, &paths, |p| ensure_writable(&roots, p)))
}

#[cfg(test)]
mod tests {
    use super::*;

    const PNG: &[u8] = b"\x89PNG\r\n\x1a\n\0\0\0\rIHDR\0\0\0\x01\0\0\0\x01\x08\x06\0\0\0";

    fn tmp(name: &str) -> PathBuf {
        let d = std::env::temp_dir().join(format!("ccs-explorer-{name}-{}", std::process::id()));
        let _ = fs::remove_dir_all(&d);
        fs::create_dir_all(&d).unwrap();
        d
    }

    #[test]
    fn lists_folders_first_in_natural_order_and_says_what_each_file_is() {
        let d = tmp("list");
        fs::create_dir(d.join("Logos")).unwrap();
        fs::write(d.join("Logos").join("a.png"), PNG).unwrap();
        fs::write(d.join("10.png"), PNG).unwrap();
        fs::write(d.join("2.png"), PNG).unwrap();
        fs::write(d.join("song.ogg"), b"OggS").unwrap();
        fs::write(d.join("readme.txt"), b"hi").unwrap();
        fs::write(d.join("tool.exe"), b"MZ").unwrap();
        fs::write(d.join(".hidden.png"), PNG).unwrap();
        let l = list_in(&d).unwrap();
        let names: Vec<_> = l.entries.iter().map(|e| e.name.as_str()).collect();
        assert_eq!(names, ["Logos", "2.png", "10.png", "readme.txt", "song.ogg", "tool.exe"]);
        assert!(l.entries[0].is_dir && l.entries[0].items == Some(1));
        assert_eq!(l.entries[1].kind, "image");
        assert!(l.entries[1].problem.is_none());
        assert_eq!(l.entries[4].kind, "sound");
        assert!(l.entries[3].problem.is_some(), "a text file can't be added");
        assert!(l.entries[5].problem.as_deref().unwrap().contains("never"), "programs are refused");
        assert!(!l.truncated && l.total == 6);
        assert!(list_in(&d.join("2.png")).is_err(), "a file isn't a folder");
        fs::remove_dir_all(&d).unwrap();
    }

    #[test]
    fn caps_huge_folders_but_keeps_every_folder() {
        let d = tmp("cap");
        fs::create_dir(d.join("zzz-folder")).unwrap();
        for i in 0..(MAX_LISTED + 5) {
            fs::write(d.join(format!("f{i}.png")), PNG).unwrap();
        }
        let l = list_in(&d).unwrap();
        assert!(l.truncated);
        assert_eq!(l.entries.len(), MAX_LISTED);
        assert_eq!(l.total, MAX_LISTED + 6);
        assert!(l.entries[0].is_dir, "folders stay at the top when the list is cut");
        fs::remove_dir_all(&d).unwrap();
    }

    #[test]
    fn searches_inside_folders_and_takes_whole_folders() {
        let d = tmp("search");
        fs::create_dir_all(d.join("a").join("b")).unwrap();
        fs::write(d.join("a").join("b").join("Mario-logo.png"), PNG).unwrap();
        fs::write(d.join("a").join("mario.txt"), b"x").unwrap();
        fs::write(d.join("luigi.png"), PNG).unwrap();
        let (found, cut) = search_in(&d, "MARIO");
        assert!(!cut);
        assert_eq!(found.iter().map(|e| e.name.as_str()).collect::<Vec<_>>(), ["Mario-logo.png", "mario.txt"]);
        assert!(search_in(&d, "  ").0.is_empty());
        let (all, cut) = usable_in(&d);
        assert!(!cut);
        assert_eq!(all.len(), 2, "only files a theme can use: {all:?}");
        assert!(all.iter().all(|f| f.size as usize == PNG.len()));
        fs::remove_dir_all(&d).unwrap();
    }

    #[test]
    fn adds_many_files_into_the_right_folders_and_reports_the_rest() {
        let src = tmp("add-src");
        let theme = tmp("add-theme");
        fs::write(theme.join("theme.xml"), "<theme/>").unwrap();
        fs::write(src.join("sky.png"), PNG).unwrap();
        fs::write(src.join("song.ogg"), b"OggS\0\x02rest").unwrap();
        fs::write(src.join("notes.txt"), b"x").unwrap();
        fs::write(src.join("fake.png"), b"<html>").unwrap();
        let paths: Vec<String> = ["sky.png", "song.ogg", "notes.txt", "fake.png"].iter().map(|n| src.join(n).to_string_lossy().into_owned()).collect();
        let r = add_into(&theme, &paths, |_| Ok(()));
        assert_eq!(r.added, ["_inc/images/sky.png", "_inc/sounds/song.ogg"]);
        assert_eq!(r.problems.len(), 2, "{:?}", r.problems);
        assert!(theme.join("_inc/images/sky.png").is_file());
        // The same file again is reused, a file already in the theme stays where it is.
        let again = add_into(&theme, &[paths[0].clone(), theme.join("_inc/images/sky.png").to_string_lossy().into_owned()], |_| Ok(()));
        assert!(again.added.is_empty());
        assert_eq!(again.existing, ["_inc/images/sky.png", "_inc/images/sky.png"]);
        // A different file with the same name gets "-2".
        let other = src.join("x");
        fs::create_dir_all(&other).unwrap();
        fs::write(other.join("sky.png"), [PNG, b"more"].concat()).unwrap();
        let r2 = add_into(&theme, &[other.join("sky.png").to_string_lossy().into_owned()], |_| Ok(()));
        assert_eq!(r2.added, ["_inc/images/sky-2.png"]);
        // Adding that one again finds its "-2" copy: already there, nothing copied.
        let r3 = add_into(&theme, &[other.join("sky.png").to_string_lossy().into_owned()], |_| Ok(()));
        assert!(r3.added.is_empty());
        assert_eq!(r3.existing, ["_inc/images/sky-2.png"]);
        // Nothing is written where writing isn't allowed.
        let denied = add_into(&theme, &[src.join("sky.png").to_string_lossy().into_owned()], |_| Err("no".into()));
        assert_eq!(denied.problems, ["no"]);
        fs::remove_dir_all(&src).unwrap();
        fs::remove_dir_all(&theme).unwrap();
    }

    #[test]
    fn natural_order() {
        let mut v = vec!["img10.png", "img2.png", "Img1.png", "b.png", "a10b.png", "a9b.png"];
        v.sort_by(|a, b| natural_cmp(a, b));
        assert_eq!(v, ["a9b.png", "a10b.png", "b.png", "Img1.png", "img2.png", "img10.png"]);
    }
}
