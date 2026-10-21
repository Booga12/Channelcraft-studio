// Safe saving, backups and restore for theme folders.
//
// - A save writes all of a theme's changed files as one transaction. The new contents are staged
//   in a work folder next to the theme, a journal records every step, and only then are the files
//   swapped in. If the app stops half way (crash, power cut), the next time the theme is opened
//   the journal is used to undo the partial save, so a theme is never left half saved.
// - Backups are zips with a manifest: the theme's project id, every file and its SHA-256. Restore
//   checks the whole backup before touching anything, backs up the current state, then swaps the
//   complete folder (again journaled), so files added after the backup are gone afterwards.
// - An open theme is locked with a lock file this app holds, so two windows can't edit it at
//   once, and the size and time of each XML file is remembered to notice changes made by other
//   programs before they would be overwritten.

use crate::commands::{ensure_writable, err, file_kind, is_inside, new_theme_path, normalize, timestamp, CmdResult, Roots};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::{BTreeMap, HashMap};
use std::fs;
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Manager, State};
use walkdir::WalkDir;

const MANIFEST: &str = "channelcraft-backup.json";
/// Folders this module makes next to a theme start with this, so they're easy to recognise.
pub(crate) const WORK_PREFIX: &str = ".channelcraft-";
const RESTORE_MAX_BYTES: u64 = 16 * 1024 * 1024 * 1024;
const RESTORE_MAX_FILES: usize = 100_000;

type Stamp = (u64, u128);

pub struct OpenProject {
    /// Held open for as long as the theme is open; the OS releases it if the app dies.
    _lock: fs::File,
    /// Size and modification time of each XML file (by lower-case relative path).
    stamps: HashMap<String, Stamp>,
}

#[derive(Default)]
pub struct Projects(pub Mutex<HashMap<String, OpenProject>>);

// ---- small helpers -------------------------------------------------------------------------

fn hex(bytes: &[u8]) -> String {
    bytes.iter().map(|b| format!("{b:02x}")).collect()
}

/// Stable id of a theme folder: a hash of its full path.
pub(crate) fn project_key(dir: &Path) -> String {
    let norm = normalize(dir).to_string_lossy().to_lowercase();
    hex(&Sha256::digest(norm.trim_end_matches(['\\', '/']).as_bytes()))[..32].to_string()
}

pub(crate) fn unique_id() -> String {
    static COUNTER: AtomicU64 = AtomicU64::new(0);
    let nanos = SystemTime::now().duration_since(UNIX_EPOCH).map(|d| d.as_nanos()).unwrap_or(0);
    format!("{nanos:x}{:x}{:x}", std::process::id(), COUNTER.fetch_add(1, Ordering::Relaxed))
}

fn now_secs() -> u64 {
    SystemTime::now().duration_since(UNIX_EPOCH).map(|d| d.as_secs()).unwrap_or(0)
}

fn stamp(p: &Path) -> Option<Stamp> {
    let m = fs::metadata(p).ok()?;
    let t = m.modified().ok()?.duration_since(UNIX_EPOCH).ok()?.as_nanos();
    Some((m.len(), t))
}

fn rel_key(rel: &str) -> String {
    rel.replace('\\', "/").to_lowercase()
}

fn is_work_dir(name: &str) -> bool {
    name.starts_with(WORK_PREFIX)
}

/// Every file of a theme that belongs in a backup or export (no temp files, no links).
fn theme_files(dir: &Path) -> impl Iterator<Item = (PathBuf, String)> + '_ {
    WalkDir::new(dir)
        .into_iter()
        .filter_entry(|e| e.depth() == 0 || !is_work_dir(&e.file_name().to_string_lossy()))
        .flatten()
        .filter(|e| e.file_type().is_file() && !e.file_name().to_string_lossy().ends_with(".ccs-tmp"))
        .filter_map(move |e| {
            let rel = e.path().strip_prefix(dir).ok()?.to_string_lossy().replace('\\', "/");
            Some((e.path().to_path_buf(), rel))
        })
}

fn xml_stamps(dir: &Path) -> HashMap<String, Stamp> {
    theme_files(dir)
        .filter(|(p, _)| file_kind(p) == "xml")
        .filter_map(|(p, rel)| stamp(&p).map(|s| (rel_key(&rel), s)))
        .collect()
}

/// A relative path from a backup or the UI that can't escape the theme folder.
pub(crate) fn safe_rel(rel: &str) -> CmdResult<()> {
    let bad = rel.is_empty()
        || rel.contains('\\')
        || rel.contains(':')
        || rel.starts_with('/')
        || rel.split('/').any(|part| {
            part.is_empty() || part == "." || part == ".." || part.ends_with(['.', ' ']) || part.contains(['<', '>', '"', '|', '?', '*']) || part.chars().any(|c| (c as u32) < 32)
        });
    if bad {
        Err(format!("Unsafe file path in the request: {rel}"))
    } else {
        Ok(())
    }
}

/// Writes a file through a uniquely named temp file next to it, then renames it into place.
pub(crate) fn write_atomic(path: &Path, bytes: &[u8]) -> CmdResult<()> {
    let parent = path.parent().ok_or("No parent folder")?;
    fs::create_dir_all(parent).map_err(err)?;
    let name = path.file_name().map(|n| n.to_string_lossy().into_owned()).unwrap_or_default();
    let tmp = parent.join(format!(".{name}.{}.ccs-tmp", unique_id()));
    let result = (|| {
        let mut f = fs::File::create(&tmp).map_err(err)?;
        f.write_all(bytes).map_err(err)?;
        f.sync_all().map_err(err)?;
        drop(f);
        fs::rename(&tmp, path).map_err(err)
    })();
    if result.is_err() {
        let _ = fs::remove_file(&tmp);
    }
    result
}

fn with_bom(text: &str, bom: bool) -> Vec<u8> {
    let mut out = Vec::with_capacity(text.len() + 3);
    if bom {
        out.extend_from_slice(&[0xEF, 0xBB, 0xBF]);
    }
    out.extend_from_slice(text.as_bytes());
    out
}

fn data_dir(app: &AppHandle, sub: &str) -> CmdResult<PathBuf> {
    let d = app.path().app_data_dir().map_err(err)?.join(sub);
    fs::create_dir_all(&d).map_err(err)?;
    Ok(d)
}

// ---- journal and recovery ------------------------------------------------------------------

#[derive(Serialize, Deserialize, Clone)]
struct JournalEntry {
    rel: String,
    slot: usize,
    existed: bool,
    /// The file is deleted by this save (a file the editor made and then undid).
    #[serde(default)]
    remove: bool,
}

#[derive(Serialize, Deserialize, Clone)]
struct Journal {
    version: u32,
    /// "files": some files replaced; "swap": the whole folder replaced (restore).
    kind: String,
    dir: String,
    /// Staging folder (a sibling of the theme).
    work: String,
    /// The theme's previous folder while it is being swapped (restore only).
    previous: Option<String>,
    /// "prepared" until every step is done, then "committed".
    state: String,
    entries: Vec<JournalEntry>,
}

fn journal_path(journals: &Path, dir: &Path) -> PathBuf {
    journals.join(format!("{}.json", project_key(dir)))
}

fn write_journal(path: &Path, j: &Journal) -> CmdResult<()> {
    write_atomic(path, serde_json::to_string_pretty(j).map_err(err)?.as_bytes())
}

/// Removes a work folder, but only one this module made next to `dir`.
fn remove_work_dir(dir: &Path, work: &Path) -> CmdResult<()> {
    let name = work.file_name().map(|n| n.to_string_lossy().into_owned()).unwrap_or_default();
    let same_parent = work.parent().map(normalize) == dir.parent().map(normalize);
    if !is_work_dir(&name) || !same_parent {
        return Err(format!("Refusing to remove an unexpected folder: {}", work.display()));
    }
    if work.exists() {
        fs::remove_dir_all(work).map_err(err)?;
    }
    Ok(())
}

/// Finishes or undoes an interrupted save or restore of `dir`. Returns a message when something
/// had to be put right.
fn recover(journals: &Path, dir: &Path) -> CmdResult<Option<String>> {
    let jp = journal_path(journals, dir);
    let Ok(text) = fs::read_to_string(&jp) else { return Ok(None) };
    let j: Journal = serde_json::from_str(&text).map_err(|e| format!("The recovery record for this theme is damaged ({e}). It was kept at {}.", jp.display()))?;
    if project_key(Path::new(&j.dir)) != project_key(dir) {
        return Err("The recovery record does not belong to this theme.".into());
    }
    let work = PathBuf::from(&j.work);
    let message = match j.kind.as_str() {
        "files" => {
            if j.state == "committed" {
                None
            } else {
                // Put every file back the way it was, newest step first.
                for e in j.entries.iter().rev() {
                    let target = dir.join(&e.rel);
                    let old = work.join("old").join(e.slot.to_string());
                    let new = work.join("new").join(e.slot.to_string());
                    if old.exists() {
                        if target.exists() {
                            fs::remove_file(&target).map_err(err)?;
                        }
                        fs::rename(&old, &target).map_err(err)?;
                    } else if !e.existed && !new.exists() && target.exists() {
                        fs::remove_file(&target).map_err(err)?;
                    }
                }
                Some("A save of this theme was interrupted (for example by a crash or power cut), so it was undone. The theme is exactly as it was before that save.".to_string())
            }
        }
        "swap" => {
            let previous = PathBuf::from(j.previous.as_deref().ok_or("Recovery record is incomplete")?);
            let msg = if !dir.exists() && previous.exists() {
                // Stopped between the two renames: put the original folder back.
                fs::rename(&previous, dir).map_err(err)?;
                Some("A restore of this theme was interrupted, so it was undone. The theme is as it was before the restore.".to_string())
            } else {
                None
            };
            remove_work_dir(dir, &previous)?;
            msg
        }
        other => return Err(format!("Unknown recovery record kind: {other}")),
    };
    remove_work_dir(dir, &work)?;
    fs::remove_file(&jp).map_err(err)?;
    Ok(message)
}

// ---- journaled multi-file save --------------------------------------------------------------

#[derive(Deserialize, Clone)]
pub struct SaveFile {
    pub rel: String,
    pub text: String,
    pub bom: bool,
    /// Delete the file instead of writing it.
    #[serde(default)]
    pub remove: bool,
}

/// Writes all `files` into `dir` as one transaction (see the top of this file).
fn save_transaction(journals: &Path, dir: &Path, files: &[SaveFile]) -> CmdResult<()> {
    for f in files {
        safe_rel(&f.rel)?;
    }
    recover(journals, dir)?;
    let parent = dir.parent().ok_or("Theme has no parent folder")?;
    let work = parent.join(format!("{WORK_PREFIX}save-{}", unique_id()));
    fs::create_dir_all(work.join("new")).map_err(err)?;
    fs::create_dir_all(work.join("old")).map_err(err)?;
    let entries: Vec<JournalEntry> = files.iter().enumerate().map(|(i, f)| JournalEntry { rel: f.rel.clone(), slot: i, existed: dir.join(&f.rel).exists(), remove: f.remove }).collect();
    let jp = journal_path(journals, dir);
    let mut journal = Journal { version: 1, kind: "files".into(), dir: dir.to_string_lossy().into_owned(), work: work.to_string_lossy().into_owned(), previous: None, state: "prepared".into(), entries: entries.clone() };

    let staged = (|| {
        for (i, f) in files.iter().enumerate() {
            if f.remove {
                continue;
            }
            let p = work.join("new").join(i.to_string());
            let mut file = fs::File::create(&p).map_err(err)?;
            file.write_all(&with_bom(&f.text, f.bom)).map_err(err)?;
            file.sync_all().map_err(err)?;
        }
        Ok::<(), String>(())
    })();
    if let Err(e) = staged {
        let _ = remove_work_dir(dir, &work);
        return Err(format!("Nothing was saved: {e}"));
    }
    write_journal(&jp, &journal)?;

    let swapped = (|| {
        for e in &entries {
            let target = dir.join(&e.rel);
            if let Some(p) = target.parent() {
                fs::create_dir_all(p).map_err(err)?;
            }
            if e.existed {
                fs::rename(&target, work.join("old").join(e.slot.to_string())).map_err(|x| format!("{}: {x}", e.rel))?;
            }
            if !e.remove {
                fs::rename(work.join("new").join(e.slot.to_string()), &target).map_err(|x| format!("{}: {x}", e.rel))?;
            }
        }
        Ok::<(), String>(())
    })();
    if let Err(e) = swapped {
        recover(journals, dir)?;
        return Err(format!("The save couldn't finish ({e}), so it was undone and your theme is unchanged. Close programs that may be using the theme's files (RetroBat, an editor) and try again."));
    }
    journal.state = "committed".into();
    write_journal(&jp, &journal)?;
    recover(journals, dir)?;
    Ok(())
}

// ---- backups -------------------------------------------------------------------------------

#[derive(Serialize, Deserialize)]
struct Manifest {
    version: u32,
    app: String,
    project: String,
    theme: String,
    /// Unix seconds.
    created: u64,
    note: String,
    /// Folder name inside the zip that holds the theme's files.
    prefix: String,
    /// Relative path → SHA-256 of every file.
    files: BTreeMap<String, String>,
}

/// Reads through to the zip while hashing what passes.
struct HashingReader<R> {
    inner: R,
    hash: Sha256,
}

impl<R: Read> Read for HashingReader<R> {
    fn read(&mut self, buf: &mut [u8]) -> std::io::Result<usize> {
        let n = self.inner.read(buf)?;
        self.hash.update(&buf[..n]);
        Ok(n)
    }
}

/// Zips a theme to `dest` (through a temp file, so an existing zip survives a failure). With a
/// `note`, a backup manifest with every file's hash is added.
fn zip_theme(src: &Path, prefix: &str, dest: &Path, note: Option<&str>) -> CmdResult<()> {
    if is_inside(dest, src) {
        return Err("Choose a place outside the theme folder for the zip.".into());
    }
    let parent = dest.parent().ok_or("No folder for the zip")?;
    fs::create_dir_all(parent).map_err(err)?;
    let tmp = parent.join(format!(".{}.{}.ccs-tmp", dest.file_name().map(|n| n.to_string_lossy().into_owned()).unwrap_or_default(), unique_id()));
    let result = (|| {
        let file = fs::File::create(&tmp).map_err(err)?;
        let mut zip = zip::ZipWriter::new(std::io::BufWriter::new(file));
        let deflate = zip::write::SimpleFileOptions::default().compression_method(zip::CompressionMethod::Deflated).large_file(true);
        // Pictures, videos, sounds and fonts are already compressed: storing them is much faster.
        let store = zip::write::SimpleFileOptions::default().compression_method(zip::CompressionMethod::Stored).large_file(true);
        let mut hashes = BTreeMap::new();
        for (path, rel) in theme_files(src) {
            let packed = matches!(file_kind(&path), "image" | "video" | "sound" | "font") && !rel.to_lowercase().ends_with(".svg");
            zip.start_file(format!("{prefix}/{rel}"), if packed { store } else { deflate }).map_err(err)?;
            let mut reader = HashingReader { inner: fs::File::open(&path).map_err(|e| format!("{rel}: {e}"))?, hash: Sha256::new() };
            std::io::copy(&mut reader, &mut zip).map_err(err)?;
            hashes.insert(rel, hex(&reader.hash.finalize()));
        }
        if let Some(note) = note {
            let m = Manifest { version: 1, app: "ChannelCraft Studio".into(), project: project_key(src), theme: prefix.into(), created: now_secs(), note: note.into(), prefix: prefix.into(), files: hashes };
            zip.start_file(MANIFEST, deflate).map_err(err)?;
            zip.write_all(serde_json::to_string_pretty(&m).map_err(err)?.as_bytes()).map_err(err)?;
        }
        let mut w = zip.finish().map_err(err)?;
        w.flush().map_err(err)?;
        w.get_ref().sync_all().map_err(err)?;
        drop(w);
        fs::rename(&tmp, dest).map_err(err)
    })();
    if result.is_err() {
        let _ = fs::remove_file(&tmp);
    }
    result
}

fn theme_name(dir: &Path) -> String {
    dir.file_name().map(|n| n.to_string_lossy().into_owned()).unwrap_or_else(|| "theme".into())
}

/// Makes a backup zip in `backups`, named `<theme>-<yyyymmdd-hhmmss>.zip`.
fn make_backup(backups: &Path, dir: &Path, note: &str) -> CmdResult<PathBuf> {
    let name = theme_name(dir);
    let mut path = backups.join(format!("{name}-{}.zip", timestamp()));
    let mut n = 2;
    while path.exists() {
        path = backups.join(format!("{name}-{}-{n}.zip", timestamp()));
        n += 1;
    }
    zip_theme(dir, &name, &path, Some(note))?;
    Ok(path)
}

/// Zips a whole theme into the app's backups folder and returns the zip path. With `keep`, only
/// that many of the newest backups of this theme are kept.
#[tauri::command(async)]
pub fn backup_theme(app: AppHandle, dir: String, keep: Option<usize>, note: Option<String>) -> CmdResult<String> {
    let src = PathBuf::from(&dir);
    let backups = data_dir(&app, "backups")?;
    let zip_path = make_backup(&backups, &src, note.as_deref().unwrap_or("before saving"))?;
    if let Some(keep) = keep.filter(|k| *k > 0) {
        let prefix = format!("{}-", theme_name(&src));
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

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BackupInfo {
    path: String,
    file_name: String,
    /// Unix seconds.
    created: u64,
    note: String,
    size: u64,
    files: usize,
    restorable: bool,
    problem: Option<String>,
}

fn read_manifest(zip: &mut zip::ZipArchive<fs::File>) -> Option<Manifest> {
    let mut f = zip.by_name(MANIFEST).ok()?;
    if f.size() > 64 * 1024 * 1024 {
        return None;
    }
    let mut text = String::new();
    f.read_to_string(&mut text).ok()?;
    serde_json::from_str(&text).ok()
}

fn list_backups_in(backups: &Path, dir: &Path) -> CmdResult<Vec<BackupInfo>> {
    let name = theme_name(dir);
    let key = project_key(dir);
    let prefix = format!("{name}-");
    let mut out = Vec::new();
    let Ok(rd) = fs::read_dir(backups) else { return Ok(out) };
    for e in rd.flatten() {
        let path = e.path();
        let file_name = e.file_name().to_string_lossy().into_owned();
        if !file_name.starts_with(&prefix) || !file_name.to_lowercase().ends_with(".zip") {
            continue;
        }
        let meta = e.metadata().map_err(err)?;
        let modified = meta.modified().ok().and_then(|t| t.duration_since(UNIX_EPOCH).ok()).map(|d| d.as_secs()).unwrap_or(0);
        let Ok(file) = fs::File::open(&path) else { continue };
        let Ok(mut zip) = zip::ZipArchive::new(file) else {
            out.push(BackupInfo { path: path.to_string_lossy().into_owned(), file_name, created: modified, note: String::new(), size: meta.len(), files: 0, restorable: false, problem: Some("This zip can't be read (it may be damaged).".into()) });
            continue;
        };
        match read_manifest(&mut zip) {
            Some(m) if m.theme == name => {
                let mine = m.project == key;
                out.push(BackupInfo {
                    path: path.to_string_lossy().into_owned(),
                    file_name,
                    created: m.created,
                    note: m.note,
                    size: meta.len(),
                    files: m.files.len(),
                    restorable: mine,
                    problem: (!mine).then(|| "Made from a theme folder with the same name somewhere else.".to_string()),
                });
            }
            Some(_) => {}
            None => {
                // Made before backups had a manifest: listed, but it can't be checked, so it can't be restored here.
                let ours = !zip.is_empty() && zip.name_for_index(0).is_some_and(|n| n.starts_with(&format!("{name}/")));
                if ours {
                    out.push(BackupInfo {
                        path: path.to_string_lossy().into_owned(),
                        file_name,
                        created: modified,
                        note: String::new(),
                        size: meta.len(),
                        files: zip.len(),
                        restorable: false,
                        problem: Some("Made by an older version without a file check list, so it can't be restored automatically. Unzip it into a separate folder to look at it.".into()),
                    });
                }
            }
        }
    }
    out.sort_by(|a, b| b.created.cmp(&a.created).then(b.file_name.cmp(&a.file_name)));
    Ok(out)
}

#[tauri::command(async)]
pub fn list_backups(app: AppHandle, dir: String) -> CmdResult<Vec<BackupInfo>> {
    list_backups_in(&data_dir(&app, "backups")?, Path::new(&dir))
}

/// Checks a backup completely: manifest, project, safe paths, no links, limits, every hash.
/// Returns the entry index for each relative path.
fn inspect_backup(zip: &mut zip::ZipArchive<fs::File>, dir: &Path) -> CmdResult<BTreeMap<String, usize>> {
    let manifest = read_manifest(zip).ok_or("This zip has no ChannelCraft file check list, so it can't be restored automatically. Unzip it into a separate folder to look at it.")?;
    if manifest.version != 1 {
        return Err("This backup was made by a newer version of ChannelCraft Studio.".into());
    }
    if manifest.project != project_key(dir) {
        return Err("This backup belongs to a different theme folder. Open that theme to restore it.".into());
    }
    let prefix = format!("{}/", manifest.prefix);
    let mut found: BTreeMap<String, usize> = BTreeMap::new();
    let mut total: u64 = 0;
    for i in 0..zip.len() {
        let mut entry = zip.by_index(i).map_err(err)?;
        let name = entry.name().to_string();
        if name == MANIFEST {
            continue;
        }
        if entry.is_dir() {
            if name.starts_with(&prefix) {
                continue;
            }
            return Err(format!("Unexpected folder in the backup: {name}"));
        }
        let rel = name.strip_prefix(&prefix).ok_or_else(|| format!("Unexpected file in the backup: {name}"))?.to_string();
        safe_rel(&rel)?;
        if entry.unix_mode().is_some_and(|m| m & 0o170000 == 0o120000) {
            return Err(format!("The backup contains a link, which can't be restored safely: {rel}"));
        }
        let expected = manifest.files.get(&rel).ok_or_else(|| format!("A file in the backup isn't on its check list: {rel}"))?;
        if found.contains_key(&rel) || found.keys().any(|k| k.eq_ignore_ascii_case(&rel)) {
            return Err(format!("The backup contains the same file twice: {rel}"));
        }
        total += entry.size();
        if total > RESTORE_MAX_BYTES || found.len() >= RESTORE_MAX_FILES {
            return Err("The backup is larger than ChannelCraft can restore (16 GB or 100,000 files).".into());
        }
        let mut hash = Sha256::new();
        let mut buf = vec![0u8; 1 << 16];
        loop {
            let n = entry.read(&mut buf).map_err(|e| format!("{rel}: {e}"))?;
            if n == 0 {
                break;
            }
            hash.update(&buf[..n]);
        }
        if &hex(&hash.finalize()) != expected {
            return Err(format!("The backup failed its integrity check ({rel} is damaged). Nothing was changed."));
        }
        found.insert(rel, i);
    }
    if found.len() != manifest.files.len() {
        return Err("The backup is incomplete: some files on its check list are missing. Nothing was changed.".into());
    }
    if !found.contains_key("theme.xml") {
        return Err("The backup has no theme.xml. Nothing was changed.".into());
    }
    Ok(found)
}

/// Restores `zip` over `dir` exactly (files added since are removed). The current state is
/// backed up first; returns that backup's path.
fn restore_into(journals: &Path, backups: &Path, dir: &Path, zip_path: &Path) -> CmdResult<PathBuf> {
    if !is_inside(zip_path, backups) {
        return Err("Pick a backup from ChannelCraft's backups list.".into());
    }
    let mut zip = zip::ZipArchive::new(fs::File::open(zip_path).map_err(err)?).map_err(|e| format!("The backup can't be read: {e}"))?;
    let files = inspect_backup(&mut zip, dir)?;
    recover(journals, dir)?;
    let before = make_backup(backups, dir, "before restoring a backup")?;
    let parent = dir.parent().ok_or("Theme has no parent folder")?;
    let id = unique_id();
    let stage = parent.join(format!("{WORK_PREFIX}restore-{id}"));
    let previous = parent.join(format!("{WORK_PREFIX}previous-{id}"));
    let extracted = (|| {
        for (rel, i) in &files {
            let target = stage.join(rel);
            fs::create_dir_all(target.parent().unwrap()).map_err(err)?;
            let mut entry = zip.by_index(*i).map_err(err)?;
            let mut out = fs::File::create(&target).map_err(err)?;
            std::io::copy(&mut entry, &mut out).map_err(|e| format!("{rel}: {e}"))?;
            out.sync_all().map_err(err)?;
        }
        Ok::<(), String>(())
    })();
    if let Err(e) = extracted {
        let _ = remove_work_dir(dir, &stage);
        return Err(format!("Nothing was changed: the backup couldn't be unpacked ({e})."));
    }
    let jp = journal_path(journals, dir);
    let mut journal = Journal { version: 1, kind: "swap".into(), dir: dir.to_string_lossy().into_owned(), work: stage.to_string_lossy().into_owned(), previous: Some(previous.to_string_lossy().into_owned()), state: "prepared".into(), entries: vec![] };
    write_journal(&jp, &journal)?;
    if let Err(e) = fs::rename(dir, &previous) {
        recover(journals, dir)?;
        return Err(format!("Nothing was changed: the theme folder couldn't be replaced ({e}). Close RetroBat and any program using the theme's files, then try again."));
    }
    if let Err(e) = fs::rename(&stage, dir) {
        recover(journals, dir)?;
        return Err(format!("Nothing was changed: the restored theme couldn't be put in place ({e})."));
    }
    journal.state = "committed".into();
    write_journal(&jp, &journal)?;
    recover(journals, dir)?;
    Ok(before)
}

// ---- open projects: lock, recovery, change detection ----------------------------------------

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OpenInfo {
    /// Set when an interrupted save or restore had to be put right.
    recovered: Option<String>,
}

fn take_lock(locks: &Path, dir: &Path) -> CmdResult<fs::File> {
    let f = fs::OpenOptions::new().create(true).truncate(false).write(true).open(locks.join(format!("{}.lock", project_key(dir)))).map_err(err)?;
    f.try_lock().map_err(|_| "This theme is open in another ChannelCraft Studio window. Close it there first.".to_string())?;
    Ok(f)
}

/// Opens a theme for editing: locks it, repairs an interrupted save or restore, and remembers its
/// XML files' state. Opening the same theme again (reload) keeps the lock.
#[tauri::command(async)]
pub fn open_project(app: AppHandle, roots: State<Roots>, projects: State<Projects>, dir: String) -> CmdResult<OpenInfo> {
    let path = PathBuf::from(&dir);
    ensure_writable(&roots, &path.join("theme.xml"))?;
    let key = project_key(&path);
    let mut map = projects.0.lock().unwrap();
    let lock = match map.remove(&key) {
        Some(p) => p._lock,
        None => take_lock(&data_dir(&app, "locks")?, &path)?,
    };
    let recovered = recover(&data_dir(&app, "transactions")?, &path)?;
    map.insert(key, OpenProject { _lock: lock, stamps: xml_stamps(&path) });
    Ok(OpenInfo { recovered })
}

#[tauri::command(async)]
pub fn close_project(projects: State<Projects>, dir: String) -> CmdResult<()> {
    projects.0.lock().unwrap().remove(&project_key(Path::new(&dir)));
    Ok(())
}

/// XML files (relative paths) that were added, removed or changed by another program since the
/// theme was opened or last saved.
#[tauri::command(async)]
pub fn changed_files(projects: State<Projects>, dir: String) -> CmdResult<Vec<String>> {
    let path = PathBuf::from(&dir);
    let map = projects.0.lock().unwrap();
    let open = map.get(&project_key(&path)).ok_or("This theme isn't open")?;
    let now = xml_stamps(&path);
    let mut out: Vec<String> = now.iter().filter(|(k, v)| open.stamps.get(*k) != Some(v)).map(|(k, _)| k.clone()).collect();
    out.extend(open.stamps.keys().filter(|k| !now.contains_key(*k)).cloned());
    out.sort();
    Ok(out)
}

/// Marks the theme's current files as seen (after the user chose to keep their own version).
#[tauri::command(async)]
pub fn accept_changes(projects: State<Projects>, dir: String) -> CmdResult<()> {
    let path = PathBuf::from(&dir);
    let mut map = projects.0.lock().unwrap();
    let open = map.get_mut(&project_key(&path)).ok_or("This theme isn't open")?;
    open.stamps = xml_stamps(&path);
    Ok(())
}

/// Saves changed files as one transaction. Unless `force`, refuses with `CHANGED_OUTSIDE:[...]`
/// when any of them was changed by another program since it was read.
#[tauri::command(async)]
pub fn save_files(app: AppHandle, roots: State<Roots>, projects: State<Projects>, dir: String, files: Vec<SaveFile>, force: bool) -> CmdResult<()> {
    let path = PathBuf::from(&dir);
    for f in &files {
        safe_rel(&f.rel)?;
        ensure_writable(&roots, &path.join(&f.rel))?;
    }
    let key = project_key(&path);
    let mut map = projects.0.lock().unwrap();
    let open = map.get_mut(&key).ok_or("This theme isn't open for editing. Open it again and save.")?;
    if !force {
        let changed: Vec<&str> = files.iter().filter(|f| stamp(&path.join(&f.rel)) != open.stamps.get(&rel_key(&f.rel)).copied()).map(|f| f.rel.as_str()).collect();
        if !changed.is_empty() {
            return Err(format!("CHANGED_OUTSIDE:{}", serde_json::to_string(&changed).map_err(err)?));
        }
    }
    save_transaction(&data_dir(&app, "transactions")?, &path, &files)?;
    for f in &files {
        match stamp(&path.join(&f.rel)) {
            Some(s) => {
                open.stamps.insert(rel_key(&f.rel), s);
            }
            None => {
                open.stamps.remove(&rel_key(&f.rel));
            }
        }
    }
    Ok(())
}

#[tauri::command(async)]
pub fn restore_backup(app: AppHandle, roots: State<Roots>, projects: State<Projects>, dir: String, zip: String) -> CmdResult<String> {
    let path = PathBuf::from(&dir);
    ensure_writable(&roots, &path.join("theme.xml"))?;
    let key = project_key(&path);
    let mut map = projects.0.lock().unwrap();
    let open = map.get_mut(&key).ok_or("Open the theme before restoring one of its backups.")?;
    let before = restore_into(&data_dir(&app, "transactions")?, &data_dir(&app, "backups")?, &path, Path::new(&zip))?;
    open.stamps = xml_stamps(&path);
    Ok(before.to_string_lossy().into_owned())
}

// ---- single files, export and copies -------------------------------------------------------

/// Writes one text file through a temp file and rename, keeping the BOM state the file had.
#[tauri::command(async)]
pub fn write_text(roots: State<Roots>, path: String, text: String, bom: bool) -> CmdResult<()> {
    let p = PathBuf::from(&path);
    ensure_writable(&roots, &p)?;
    write_atomic(&p, &with_bom(&text, bom))
}

/// Zips a theme to a file the user chose, ready to share or copy to another RetroBat. An
/// existing zip there is only replaced once the new one is complete.
#[tauri::command(async)]
pub fn export_theme(dir: String, dest: String) -> CmdResult<String> {
    let src = PathBuf::from(&dir);
    if !src.join("theme.xml").is_file() {
        return Err(format!("{dir} is not a theme folder"));
    }
    zip_theme(&src, &theme_name(&src), Path::new(&dest), None)?;
    Ok(dest)
}

/// Copies a folder to `dest` through a staging folder next to it, so a failed copy never leaves a
/// half-made theme behind.
fn copy_dir_staged(src: &Path, dest: &Path) -> CmdResult<()> {
    let parent = dest.parent().ok_or("No parent folder")?;
    let stage = parent.join(format!("{WORK_PREFIX}copy-{}", unique_id()));
    let result = (|| {
        fs::create_dir_all(&stage).map_err(err)?;
        for (path, rel) in theme_files(src) {
            let target = stage.join(&rel);
            fs::create_dir_all(target.parent().unwrap()).map_err(err)?;
            fs::copy(&path, &target).map_err(|e| format!("{rel}: {e}"))?;
        }
        // Keep empty folders (some themes need them, e.g. an empty logos folder).
        for e in WalkDir::new(src).into_iter().filter_entry(|e| e.depth() == 0 || !is_work_dir(&e.file_name().to_string_lossy())).flatten() {
            if e.file_type().is_dir() {
                let rel = e.path().strip_prefix(src).map_err(err)?;
                fs::create_dir_all(stage.join(rel)).map_err(err)?;
            }
        }
        if dest.exists() {
            return Err(format!("{} already exists", dest.display()));
        }
        fs::rename(&stage, dest).map_err(err)
    })();
    if result.is_err() && stage.exists() {
        let _ = fs::remove_dir_all(&stage);
    }
    result
}

#[tauri::command(async)]
pub fn copy_theme(roots: State<Roots>, src: String, name: String) -> CmdResult<String> {
    let dest = new_theme_path(&roots, &name)?;
    copy_dir_staged(Path::new(&src), &dest)?;
    Ok(dest.to_string_lossy().into_owned())
}

#[tauri::command(async)]
pub fn create_theme_from_starter(app: AppHandle, roots: State<Roots>, name: String) -> CmdResult<String> {
    let dest = new_theme_path(&roots, &name)?;
    let starter = app.path().resolve("starter-theme", tauri::path::BaseDirectory::Resource).map_err(err)?;
    let starter = if starter.join("theme.xml").is_file() { starter } else { crate::commands::dev_resource("starter-theme").ok_or("The starter theme is missing from this copy of the app.")? };
    copy_dir_staged(&starter, &dest)?;
    Ok(dest.to_string_lossy().into_owned())
}

/// Saves a report (CSV) where the user chose in the save dialog. Only .csv files, never inside a
/// RetroBat themes folder by accident of a typo: the extension is required.
#[tauri::command(async)]
pub fn write_report(path: String, text: String) -> CmdResult<()> {
    let p = PathBuf::from(&path);
    if !p.extension().is_some_and(|e| e.eq_ignore_ascii_case("csv")) {
        return Err("Reports are saved as .csv files.".into());
    }
    // A UTF-8 BOM lets Excel show accents and symbols correctly.
    write_atomic(&p, &with_bom(&text, true))
}

// ---- game media copied into a theme --------------------------------------------------------

/// Which of these files exist (game media named in gamelists often doesn't).
#[tauri::command(async)]
pub fn existing_files(paths: Vec<String>) -> Vec<bool> {
    paths.iter().map(|p| Path::new(p).is_file()).collect()
}

/// Copies a file into `<theme>/<dest_rel_dir>/` named by its SHA-256, so the same picture or video
/// is stored once and travels with the theme. Returns the path relative to the theme folder.
fn copy_hashed(src: &Path, dir: &Path, dest_rel_dir: &str) -> CmdResult<String> {
    safe_rel(dest_rel_dir)?;
    let ext = src.extension().map(|e| e.to_string_lossy().to_lowercase()).filter(|e| matches!(e.as_str(), "mp4" | "mkv" | "webm" | "avi" | "png" | "jpg" | "jpeg" | "webp" | "gif" | "svg")).ok_or_else(|| format!("{} is not a picture or video RetroBat can show", src.display()))?;
    let mut hash = Sha256::new();
    std::io::copy(&mut fs::File::open(src).map_err(|e| format!("{}: {e}", src.display()))?, &mut hash).map_err(err)?;
    let name = format!("{}.{ext}", &hex(&hash.finalize())[..32]);
    let rel = format!("{dest_rel_dir}/{name}");
    let target = dir.join(&rel);
    if !target.is_file() {
        fs::create_dir_all(target.parent().unwrap()).map_err(err)?;
        let tmp = target.with_extension(format!("{}.ccs-tmp", unique_id()));
        let copied = fs::copy(src, &tmp).map_err(err).and_then(|_| fs::rename(&tmp, &target).map_err(err));
        if copied.is_err() {
            let _ = fs::remove_file(&tmp);
        }
        copied?;
    }
    Ok(rel)
}

#[tauri::command(async)]
pub fn copy_media_into_theme(roots: State<Roots>, theme_dir: String, src: String, dest_rel_dir: String) -> CmdResult<String> {
    let dir = PathBuf::from(&theme_dir);
    ensure_writable(&roots, &dir.join(&dest_rel_dir).join("x"))?;
    copy_hashed(Path::new(&src), &dir, &dest_rel_dir)
}

#[cfg(test)]
mod tests {
    use super::*;

    /// A scratch folder with `themes/My Theme`, a journals folder and a backups folder.
    struct Scratch {
        base: PathBuf,
    }
    impl Scratch {
        fn new(tag: &str) -> Self {
            let base = std::env::temp_dir().join(format!("ccs-storage-{tag}-{}", unique_id()));
            let theme = base.join("themes").join("My Theme");
            fs::create_dir_all(theme.join("_inc")).unwrap();
            fs::create_dir_all(base.join("journals")).unwrap();
            fs::create_dir_all(base.join("backups")).unwrap();
            fs::write(theme.join("theme.xml"), "<theme>one</theme>").unwrap();
            fs::write(theme.join("_inc").join("colors.xml"), "<theme>red</theme>").unwrap();
            fs::write(theme.join("_inc").join("bg.png"), vec![7u8; 4096]).unwrap();
            Scratch { base }
        }
        fn theme(&self) -> PathBuf {
            self.base.join("themes").join("My Theme")
        }
        fn journals(&self) -> PathBuf {
            self.base.join("journals")
        }
        fn backups(&self) -> PathBuf {
            self.base.join("backups")
        }
        fn read(&self, rel: &str) -> String {
            fs::read_to_string(self.theme().join(rel)).unwrap()
        }
        fn leftovers(&self) -> Vec<String> {
            fs::read_dir(self.base.join("themes")).unwrap().flatten().map(|e| e.file_name().to_string_lossy().into_owned()).filter(|n| n != "My Theme").collect()
        }
    }
    impl Drop for Scratch {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(&self.base);
        }
    }

    fn file(rel: &str, text: &str) -> SaveFile {
        SaveFile { rel: rel.into(), text: text.into(), bom: false, remove: false }
    }

    #[test]
    fn saves_several_files_as_one_transaction() {
        let s = Scratch::new("save");
        save_transaction(&s.journals(), &s.theme(), &[file("theme.xml", "<theme>two</theme>"), file("_inc/colors.xml", "<theme>blue</theme>"), file("_inc/new/extra.xml", "<theme/>")]).unwrap();
        assert_eq!(s.read("theme.xml"), "<theme>two</theme>");
        assert_eq!(s.read("_inc/colors.xml"), "<theme>blue</theme>");
        assert_eq!(s.read("_inc/new/extra.xml"), "<theme/>");
        assert!(s.leftovers().is_empty(), "work folders were cleaned up: {:?}", s.leftovers());
        assert!(fs::read_dir(s.journals()).unwrap().next().is_none());
    }

    #[test]
    fn a_save_can_delete_a_file_and_be_undone() {
        let s = Scratch::new("remove");
        let dir = s.theme();
        let gone = SaveFile { rel: "_inc/colors.xml".into(), text: String::new(), bom: false, remove: true };
        save_transaction(&s.journals(), &dir, &[file("theme.xml", "<theme>two</theme>"), gone.clone(), SaveFile { rel: "never.xml".into(), ..gone }]).unwrap();
        assert_eq!(s.read("theme.xml"), "<theme>two</theme>");
        assert!(!dir.join("_inc/colors.xml").exists());
        assert!(!dir.join("never.xml").exists());
        assert!(s.leftovers().is_empty());
    }

    #[test]
    fn undoes_a_save_that_stopped_half_way() {
        let s = Scratch::new("crash");
        let dir = s.theme();
        // Simulate a crash after theme.xml was swapped in and colors.xml was moved out, before
        // its new version was put in place, and a new file was already added.
        let work = s.base.join("themes").join(".channelcraft-save-test");
        fs::create_dir_all(work.join("new")).unwrap();
        fs::create_dir_all(work.join("old")).unwrap();
        fs::rename(dir.join("theme.xml"), work.join("old").join("0")).unwrap();
        fs::write(dir.join("theme.xml"), "<theme>two</theme>").unwrap();
        fs::rename(dir.join("_inc/colors.xml"), work.join("old").join("1")).unwrap();
        fs::write(work.join("new").join("1"), "<theme>blue</theme>").unwrap();
        fs::write(dir.join("added.xml"), "<theme/>").unwrap();
        let j = Journal {
            version: 1,
            kind: "files".into(),
            dir: dir.to_string_lossy().into_owned(),
            work: work.to_string_lossy().into_owned(),
            previous: None,
            state: "prepared".into(),
            entries: vec![JournalEntry { rel: "theme.xml".into(), slot: 0, existed: true, remove: false }, JournalEntry { rel: "_inc/colors.xml".into(), slot: 1, existed: true, remove: false }, JournalEntry { rel: "added.xml".into(), slot: 2, existed: false, remove: false }],
        };
        write_journal(&journal_path(&s.journals(), &dir), &j).unwrap();
        let msg = recover(&s.journals(), &dir).unwrap();
        assert!(msg.unwrap().contains("undone"));
        assert_eq!(s.read("theme.xml"), "<theme>one</theme>");
        assert_eq!(s.read("_inc/colors.xml"), "<theme>red</theme>");
        assert!(!dir.join("added.xml").exists());
        assert!(s.leftovers().is_empty());
        // Nothing left to recover the second time.
        assert!(recover(&s.journals(), &dir).unwrap().is_none());
    }

    #[test]
    fn refuses_paths_that_leave_the_theme() {
        let s = Scratch::new("paths");
        for bad in ["../x.xml", "a/../../x.xml", "C:/x.xml", "/x.xml", "a\\b.xml", "con./x.xml", ""] {
            assert!(save_transaction(&s.journals(), &s.theme(), &[file(bad, "x")]).is_err(), "{bad}");
        }
    }

    #[test]
    fn backup_lists_and_restores_the_exact_snapshot() {
        let s = Scratch::new("restore");
        let dir = s.theme();
        let zip = make_backup(&s.backups(), &dir, "before saving").unwrap();
        // Later edits: a change, a deletion and a new file.
        fs::write(dir.join("theme.xml"), "<theme>changed</theme>").unwrap();
        fs::remove_file(dir.join("_inc/colors.xml")).unwrap();
        fs::write(dir.join("later.xml"), "<theme/>").unwrap();

        let list = list_backups_in(&s.backups(), &dir).unwrap();
        assert_eq!(list.len(), 1);
        assert!(list[0].restorable);
        assert_eq!(list[0].files, 3);
        assert_eq!(list[0].note, "before saving");

        let before = restore_into(&s.journals(), &s.backups(), &dir, &zip).unwrap();
        assert_eq!(s.read("theme.xml"), "<theme>one</theme>");
        assert_eq!(s.read("_inc/colors.xml"), "<theme>red</theme>");
        assert_eq!(fs::read(dir.join("_inc/bg.png")).unwrap(), vec![7u8; 4096]);
        assert!(!dir.join("later.xml").exists(), "files added after the backup are removed");
        assert!(s.leftovers().is_empty());
        // The state before the restore was backed up and can itself be restored.
        restore_into(&s.journals(), &s.backups(), &dir, &before).unwrap();
        assert_eq!(s.read("theme.xml"), "<theme>changed</theme>");
        assert!(dir.join("later.xml").exists());
    }

    /// Writes a zip with the given entries and manifest file list.
    fn forged_backup(s: &Scratch, dir: &Path, entries: &[(&str, &[u8])], listed: &[(&str, &[u8])], project: Option<String>) -> PathBuf {
        let path = s.backups().join(format!("My Theme-forged-{}.zip", unique_id()));
        let mut zip = zip::ZipWriter::new(fs::File::create(&path).unwrap());
        let opts = zip::write::SimpleFileOptions::default();
        for (name, data) in entries {
            zip.start_file(*name, opts).unwrap();
            zip.write_all(data).unwrap();
        }
        let files = listed.iter().map(|(r, d)| (r.to_string(), hex(&Sha256::digest(d)))).collect();
        let m = Manifest { version: 1, app: "x".into(), project: project.unwrap_or_else(|| project_key(dir)), theme: "My Theme".into(), created: 1, note: "n".into(), prefix: "My Theme".into(), files };
        zip.start_file(MANIFEST, opts).unwrap();
        zip.write_all(serde_json::to_string(&m).unwrap().as_bytes()).unwrap();
        zip.finish().unwrap();
        path
    }

    #[test]
    fn rejects_bad_backups_without_changing_anything() {
        let s = Scratch::new("bad");
        let dir = s.theme();
        let t: &[u8] = b"<theme/>";
        let cases = [
            ("tampered", forged_backup(&s, &dir, &[("My Theme/theme.xml", b"<theme>evil</theme>")], &[("theme.xml", t)], None)),
            ("traversal", forged_backup(&s, &dir, &[("My Theme/theme.xml", t), ("My Theme/../evil.xml", t)], &[("theme.xml", t), ("../evil.xml", t)], None)),
            ("unlisted", forged_backup(&s, &dir, &[("My Theme/theme.xml", t), ("My Theme/extra.xml", t)], &[("theme.xml", t)], None)),
            ("incomplete", forged_backup(&s, &dir, &[("My Theme/theme.xml", t)], &[("theme.xml", t), ("gone.xml", t)], None)),
            ("other project", forged_backup(&s, &dir, &[("My Theme/theme.xml", t)], &[("theme.xml", t)], Some("0".repeat(32)))),
            ("no theme.xml", forged_backup(&s, &dir, &[("My Theme/a.xml", t)], &[("a.xml", t)], None)),
        ];
        for (what, zip) in cases {
            assert!(restore_into(&s.journals(), &s.backups(), &dir, &zip).is_err(), "{what} was accepted");
            assert_eq!(s.read("theme.xml"), "<theme>one</theme>", "{what} changed the theme");
        }
        // Only the forged zips exist: no before-restore backup was made for rejected ones.
        assert_eq!(fs::read_dir(s.backups()).unwrap().count(), 6);
        // A backup from outside the backups folder is refused too.
        let outside = s.base.join("elsewhere.zip");
        fs::copy(make_backup(&s.backups(), &dir, "x").unwrap(), &outside).unwrap();
        assert!(restore_into(&s.journals(), &s.backups(), &dir, &outside).is_err());
    }

    #[test]
    fn undoes_a_restore_that_stopped_between_the_folder_swaps() {
        let s = Scratch::new("swap");
        let dir = s.theme();
        let parent = s.base.join("themes");
        let stage = parent.join(".channelcraft-restore-t");
        let previous = parent.join(".channelcraft-previous-t");
        fs::create_dir_all(&stage).unwrap();
        fs::write(stage.join("theme.xml"), "<theme>backup</theme>").unwrap();
        let j = Journal { version: 1, kind: "swap".into(), dir: dir.to_string_lossy().into_owned(), work: stage.to_string_lossy().into_owned(), previous: Some(previous.to_string_lossy().into_owned()), state: "prepared".into(), entries: vec![] };
        write_journal(&journal_path(&s.journals(), &dir), &j).unwrap();
        fs::rename(&dir, &previous).unwrap();
        assert!(recover(&s.journals(), &dir).unwrap().is_some());
        assert_eq!(s.read("theme.xml"), "<theme>one</theme>");
        assert!(s.leftovers().is_empty());
    }

    #[test]
    fn export_keeps_the_old_zip_until_the_new_one_is_complete() {
        let s = Scratch::new("export");
        let dest = s.base.join("out").join("My Theme.zip");
        fs::create_dir_all(dest.parent().unwrap()).unwrap();
        fs::write(&dest, "old export").unwrap();
        // Zipping into the theme itself is refused, and the existing export is untouched.
        assert!(zip_theme(&s.theme(), "My Theme", &s.theme().join("x.zip"), None).is_err());
        zip_theme(&s.theme(), "My Theme", &dest, None).unwrap();
        let mut archive = zip::ZipArchive::new(fs::File::open(&dest).unwrap()).unwrap();
        let mut names: Vec<String> = (0..archive.len()).map(|i| archive.by_index(i).unwrap().name().to_string()).collect();
        names.sort();
        assert_eq!(names, vec!["My Theme/_inc/bg.png", "My Theme/_inc/colors.xml", "My Theme/theme.xml"]);
        assert_eq!(archive.by_name("My Theme/_inc/bg.png").unwrap().compression(), zip::CompressionMethod::Stored);
        assert_eq!(archive.by_name("My Theme/theme.xml").unwrap().compression(), zip::CompressionMethod::Deflated);
        let left: Vec<_> = fs::read_dir(dest.parent().unwrap()).unwrap().flatten().map(|e| e.file_name()).collect();
        assert_eq!(left.len(), 1, "no temp files left: {left:?}");
    }

    #[test]
    fn copies_through_a_staging_folder_and_keeps_empty_folders() {
        let s = Scratch::new("copy");
        fs::create_dir_all(s.theme().join("_inc/systems/logos")).unwrap();
        let dest = s.base.join("themes").join("Copy");
        copy_dir_staged(&s.theme(), &dest).unwrap();
        assert_eq!(fs::read_to_string(dest.join("theme.xml")).unwrap(), "<theme>one</theme>");
        assert!(dest.join("_inc/systems/logos").is_dir());
        assert!(copy_dir_staged(&s.theme(), &dest).is_err(), "never copies over an existing folder");
        assert!(!s.leftovers().iter().any(|n| n.starts_with(WORK_PREFIX)));
    }

    #[test]
    fn copies_game_media_once_under_its_hash() {
        let s = Scratch::new("media");
        let src = s.base.join("cover.PNG");
        fs::write(&src, b"picture").unwrap();
        let a = copy_hashed(&src, &s.theme(), "_inc/ccs/featured").unwrap();
        let again = copy_hashed(&src, &s.theme(), "_inc/ccs/featured").unwrap();
        assert_eq!(a, again);
        assert!(a.starts_with("_inc/ccs/featured/") && a.ends_with(".png"));
        assert_eq!(fs::read(s.theme().join(&a)).unwrap(), b"picture");
        assert_eq!(fs::read_dir(s.theme().join("_inc/ccs/featured")).unwrap().count(), 1);
        assert!(copy_hashed(&s.base.join("notes.txt"), &s.theme(), "_inc/ccs/featured").is_err());
        assert!(copy_hashed(&src, &s.theme(), "../outside").is_err());
    }

    #[test]
    fn a_theme_can_only_be_locked_once() {
        let s = Scratch::new("lock");
        let a = take_lock(&s.base, &s.theme()).unwrap();
        assert!(take_lock(&s.base, &s.theme()).is_err());
        drop(a);
        assert!(take_lock(&s.base, &s.theme()).is_ok());
    }

    #[test]
    fn writes_single_files_atomically_with_unique_temp_names() {
        let s = Scratch::new("atomic");
        let p = s.theme().join("theme.xml");
        write_atomic(&p, &with_bom("<theme/>", true)).unwrap();
        assert_eq!(fs::read(&p).unwrap()[..3], [0xEF, 0xBB, 0xBF]);
        assert!(!fs::read_dir(s.theme()).unwrap().flatten().any(|e| e.file_name().to_string_lossy().ends_with(".ccs-tmp")));
    }

    /// Runs on a temp copy of an installed theme (never the theme itself):
    /// `CCS_REAL_THEME=<theme folder> cargo test real_theme -- --ignored --nocapture`
    #[test]
    #[ignore]
    fn real_theme_round_trip() {
        let Ok(src) = std::env::var("CCS_REAL_THEME") else { return };
        let s = Scratch::new("real");
        let dir = s.theme();
        fs::remove_dir_all(&dir).unwrap();
        let t = std::time::Instant::now();
        copy_dir_staged(Path::new(&src), &dir).unwrap();
        println!("copy: {:?}", t.elapsed());
        let original: BTreeMap<String, String> = theme_files(&dir).map(|(p, r)| (r, hex(&Sha256::digest(fs::read(p).unwrap())))).collect();
        let t = std::time::Instant::now();
        let zip = make_backup(&s.backups(), &dir, "before saving").unwrap();
        println!("backup of {} files, {} MB: {:?}", original.len(), fs::metadata(&zip).unwrap().len() / 1_000_000, t.elapsed());
        let t = std::time::Instant::now();
        let text = fs::read_to_string(dir.join("theme.xml")).unwrap();
        save_transaction(&s.journals(), &dir, &[SaveFile { rel: "theme.xml".into(), text: format!("{text}<!-- edited -->"), bom: false, remove: false }]).unwrap();
        println!("save: {:?}", t.elapsed());
        fs::write(dir.join("added.xml"), "<theme/>").unwrap();
        let t = std::time::Instant::now();
        restore_into(&s.journals(), &s.backups(), &dir, &zip).unwrap();
        println!("restore (checks every hash, backs up first): {:?}", t.elapsed());
        let after: BTreeMap<String, String> = theme_files(&dir).map(|(p, r)| (r, hex(&Sha256::digest(fs::read(p).unwrap())))).collect();
        assert_eq!(original, after, "restored theme is identical to the original");
    }
}
