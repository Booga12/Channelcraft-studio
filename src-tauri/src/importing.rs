// Bringing files from outside into RetroBat's themes folder: whole themes (a .zip or a folder) and
// single pictures, fonts, sounds and videos.
//
// Every file is checked before it is copied:
// - its type must be one a RetroBat theme uses (XML, pictures, fonts, sounds, videos, shaders,
//   plain text); programs and scripts are never copied;
// - its first bytes must match its extension (a ".png" that isn't a PNG is left out);
// - paths can't leave the theme folder, links are left out, and sizes and file counts are capped,
//   so a damaged or hostile zip can't fill the disk.
// A theme is unpacked into a hidden staging folder and moved into place in one step at the end,
// and never over an existing theme.

use crate::commands::{err, is_inside, new_theme_path, themes_dir, CmdResult, Roots};
use crate::storage::{safe_rel, unique_id, WORK_PREFIX};
use serde::Serialize;
use sha2::{Digest, Sha256};
use std::collections::HashSet;
use std::fs;
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use tauri::State;
use walkdir::WalkDir;

const MAX_FILES: usize = 50_000;
const MAX_BYTES: u64 = 8 * 1024 * 1024 * 1024;
const MAX_FILE: u64 = 2 * 1024 * 1024 * 1024;
/// A zip entry that unpacks to more than this many times its packed size, and is big, is refused.
const MAX_RATIO: u64 = 400;
const HEAD: usize = 8192;

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub(crate) enum Kind {
    Xml,
    Image,
    Font,
    Sound,
    Video,
    Text,
}

impl Kind {
    pub(crate) fn label(self) -> &'static str {
        match self {
            Kind::Xml => "XML file",
            Kind::Image => "picture",
            Kind::Font => "font",
            Kind::Sound => "sound",
            Kind::Video => "video",
            Kind::Text => "text file",
        }
    }
    /// Largest single file accepted when importing one asset.
    pub(crate) fn max_asset(self) -> u64 {
        match self {
            Kind::Image => 64 << 20,
            Kind::Font => 32 << 20,
            Kind::Sound => 256 << 20,
            Kind::Video => MAX_FILE,
            Kind::Xml | Kind::Text => 16 << 20,
        }
    }
}

fn ext_of(name: &str) -> String {
    let base = name.rsplit('/').next().unwrap_or(name);
    match base.rsplit_once('.') {
        Some((stem, e)) if !stem.is_empty() => e.to_ascii_lowercase(),
        _ => String::new(),
    }
}

/// The kind of theme file an extension stands for, or why it isn't imported.
pub(crate) fn kind_of(name: &str) -> Result<Kind, String> {
    let ext = ext_of(name);
    let base = name.rsplit('/').next().unwrap_or(name).to_ascii_uppercase();
    Ok(match ext.as_str() {
        "xml" => Kind::Xml,
        "png" | "jpg" | "jpeg" | "gif" | "svg" | "webp" | "bmp" => Kind::Image,
        "ttf" | "otf" => Kind::Font,
        "wav" | "ogg" | "mp3" | "flac" => Kind::Sound,
        "mp4" | "m4v" | "mov" | "mkv" | "webm" | "avi" | "mpg" | "mpeg" => Kind::Video,
        // collections.info is how RetroBat themes list their custom collections.
        "glsl" | "glslp" | "txt" | "md" | "json" | "cfg" | "ini" | "csv" | "info" => Kind::Text,
        "" if matches!(base.as_str(), "LICENSE" | "LICENCE" | "README" | "COPYING" | "AUTHORS" | "CREDITS" | "OFL") => Kind::Text,
        "exe" | "dll" | "bat" | "cmd" | "com" | "scr" | "ps1" | "psm1" | "vbs" | "vbe" | "js" | "jse" | "wsf" | "wsh" | "hta" | "msi" | "msp" | "lnk" | "url" | "jar" | "sh" | "py" | "reg" | "cpl" | "sys" | "pif" | "appx" | "msix" | "appimage" | "love" | "so" | "dylib" | "deb" | "rpm" | "run" | "bin" | "ahk" => {
            return Err("programs and scripts are never imported".into())
        }
        "zip" | "7z" | "rar" | "gz" | "tgz" | "tar" | "xz" | "bz2" => return Err("archives inside a theme aren't unpacked or copied".into()),
        "" => return Err("files without a type aren't used by themes".into()),
        e => return Err(format!("“.{e}” files aren't used by RetroBat themes")),
    })
}

/// Whether the first bytes of a file fit its extension. `head` is up to the first 8 KB.
pub(crate) fn check_content(name: &str, kind: Kind, head: &[u8], size: u64) -> Result<(), String> {
    let ext = ext_of(name);
    let text_like = matches!(kind, Kind::Xml | Kind::Text) || ext == "svg";
    if size == 0 {
        return if text_like { Ok(()) } else { Err(format!("the {} is empty", kind.label())) };
    }
    let starts = |m: &[u8]| head.starts_with(m);
    let at = |i: usize, m: &[u8]| head.len() >= i + m.len() && &head[i..i + m.len()] == m;
    // RetroBat (FreeImage, VLC, SDL) reads these by their contents, not their extension, so any
    // real format of the right kind is fine: themes do ship WebPs named .png (carbon's konami.png).
    let ok = match kind {
        Kind::Image if ext != "svg" => starts(b"\x89PNG\r\n\x1a\n") || starts(&[0xFF, 0xD8, 0xFF]) || starts(b"GIF87a") || starts(b"GIF89a") || (starts(b"RIFF") && at(8, b"WEBP")) || starts(b"BM"),
        Kind::Font => starts(&[0, 1, 0, 0]) || starts(b"true") || starts(b"OTTO") || starts(b"ttcf"),
        Kind::Sound => (starts(b"RIFF") && at(8, b"WAVE")) || starts(b"OggS") || starts(b"fLaC") || starts(b"ID3") || (head.len() > 1 && head[0] == 0xFF && head[1] & 0xE0 == 0xE0),
        Kind::Video => [b"ftyp", b"moov", b"mdat", b"free", b"wide", b"skip"].iter().any(|m| at(4, *m)) || starts(&[0x1A, 0x45, 0xDF, 0xA3]) || (starts(b"RIFF") && at(8, b"AVI ")) || starts(&[0, 0, 1, 0xBA]) || starts(&[0, 0, 1, 0xB3]),
        _ => true,
    };
    if !ok {
        return Err(format!("it isn't really a {} (its contents aren't a {} format)", kind.label(), kind.label()));
    }
    if text_like {
        let utf16 = starts(&[0xFF, 0xFE]) || starts(&[0xFE, 0xFF]);
        if !utf16 && head.contains(&0) {
            return Err(format!("the {} contains binary data", if ext == "svg" { "SVG picture" } else { kind.label() }));
        }
        if ext == "svg" && !utf16 {
            let text = String::from_utf8_lossy(head).to_ascii_lowercase();
            if !text.contains("<svg") && size as usize <= head.len() {
                return Err("it isn't an SVG picture".into());
            }
        }
    }
    Ok(())
}

/// System clutter that zips and copied folders often carry.
fn is_clutter(rel: &str) -> bool {
    rel.split('/').any(|p| {
        let l = p.to_ascii_lowercase();
        l == "__macosx" || l == ".git" || l == ".svn" || l == ".github" || l == ".ds_store" || l == "thumbs.db" || l == "desktop.ini" || p.starts_with("._") || p.starts_with(WORK_PREFIX) || l.ends_with(".ccs-tmp")
    })
}

// ---- theme import ------------------------------------------------------------------------

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Skipped {
    pub path: String,
    pub reason: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportPlan {
    /// Folder name to use; already free in the themes folder.
    pub suggested_name: String,
    /// Where theme.xml was found inside the source ("" when at the top).
    pub root: String,
    pub files: usize,
    pub bytes: u64,
    pub skipped: Vec<Skipped>,
    /// Files outside the theme's own folder in the source, left out.
    pub outside: usize,
    pub has_splash: bool,
}

struct Entry {
    rel: String,
    size: u64,
    /// Zip index, or the file on disk.
    src: Src,
}

enum Src {
    Zip(usize),
    Disk(PathBuf),
}

enum Source {
    Zip(zip::ZipArchive<fs::File>, PathBuf),
    Dir(PathBuf),
}

fn open_source(source: &Path) -> CmdResult<Source> {
    let meta = fs::symlink_metadata(source).map_err(|e| format!("{}: {e}", source.display()))?;
    if meta.is_dir() {
        return Ok(Source::Dir(source.to_path_buf()));
    }
    if !source.extension().is_some_and(|e| e.eq_ignore_ascii_case("zip")) {
        return Err("Pick a theme folder or a .zip file.".into());
    }
    let f = fs::File::open(source).map_err(err)?;
    let z = zip::ZipArchive::new(f).map_err(|e| format!("This zip can't be read ({e}). It may be damaged or not a zip file."))?;
    Ok(Source::Zip(z, source.to_path_buf()))
}

#[cfg(windows)]
pub(crate) fn is_reparse(meta: &fs::Metadata) -> bool {
    use std::os::windows::fs::MetadataExt;
    meta.file_attributes() & 0x400 != 0
}
#[cfg(not(windows))]
pub(crate) fn is_reparse(_meta: &fs::Metadata) -> bool {
    false
}

/// Every file in the source, with links already left out (listed in `skipped`).
fn list_entries(src: &mut Source, skipped: &mut Vec<Skipped>) -> CmdResult<Vec<Entry>> {
    let mut out = Vec::new();
    let mut total: u64 = 0;
    match src {
        Source::Zip(z, _) => {
            for i in 0..z.len() {
                let e = z.by_index_raw(i).map_err(err)?;
                let name = e.name().replace('\\', "/");
                let rel = name.trim_end_matches('/').to_string();
                if e.is_dir() || rel.is_empty() {
                    continue;
                }
                if safe_rel(&rel).is_err() {
                    return Err(format!("This zip has a file with an unsafe path ({name}), so nothing was imported."));
                }
                if e.unix_mode().is_some_and(|m| m & 0o170000 == 0o120000) {
                    skipped.push(Skipped { path: rel, reason: "links are never imported".into() });
                    continue;
                }
                let (size, packed) = (e.size(), e.compressed_size());
                if size > 64 << 20 && packed > 0 && size / packed > MAX_RATIO {
                    return Err(format!("{rel} would unpack to {} MB from {} KB, which looks like a damaged or hostile zip. Nothing was imported.", size >> 20, packed >> 10));
                }
                total += size;
                out.push(Entry { rel, size, src: Src::Zip(i) });
                if out.len() > MAX_FILES || total > MAX_BYTES {
                    return Err("This is larger than ChannelCraft imports (50,000 files or 8 GB).".into());
                }
            }
        }
        Source::Dir(dir) => {
            for e in WalkDir::new(&*dir).follow_links(false).into_iter().filter_entry(|e| e.depth() == 0 || !is_clutter(&e.file_name().to_string_lossy())) {
                let e = e.map_err(err)?;
                if e.depth() == 0 {
                    continue;
                }
                let rel = e.path().strip_prefix(&*dir).map_err(err)?.to_string_lossy().replace('\\', "/");
                let meta = fs::symlink_metadata(e.path()).map_err(err)?;
                if meta.file_type().is_symlink() || is_reparse(&meta) {
                    skipped.push(Skipped { path: rel, reason: "links are never imported".into() });
                    continue;
                }
                if !meta.is_file() {
                    continue;
                }
                safe_rel(&rel)?;
                total += meta.len();
                out.push(Entry { rel, size: meta.len(), src: Src::Disk(e.path().to_path_buf()) });
                if out.len() > MAX_FILES || total > MAX_BYTES {
                    return Err("This is larger than ChannelCraft imports (50,000 files or 8 GB).".into());
                }
            }
        }
    }
    Ok(out)
}

/// Opens one entry for reading, limited to its stated size plus one byte (to notice lies).
fn reader<'a>(src: &'a mut Source, e: &Entry) -> CmdResult<Box<dyn Read + 'a>> {
    Ok(match (&e.src, src) {
        (Src::Zip(i), Source::Zip(z, _)) => Box::new(z.by_index(*i).map_err(|x| format!("{}: {x}", e.rel))?.take(e.size + 1)),
        (Src::Disk(p), _) => Box::new(fs::File::open(p).map_err(|x| format!("{}: {x}", e.rel))?.take(e.size + 1)),
        _ => return Err("internal: mixed sources".into()),
    })
}

fn read_head(r: &mut dyn Read) -> CmdResult<Vec<u8>> {
    let mut head = vec![0u8; HEAD];
    let mut n = 0;
    while n < HEAD {
        let k = r.read(&mut head[n..]).map_err(err)?;
        if k == 0 {
            break;
        }
        n += k;
    }
    head.truncate(n);
    Ok(head)
}

struct Planned {
    plan: ImportPlan,
    keep: Vec<(String, Entry)>,
}

fn source_name(src: &Source) -> String {
    match src {
        Source::Zip(_, p) => p.file_stem().map(|s| s.to_string_lossy().into_owned()).unwrap_or_default(),
        Source::Dir(p) => p.file_name().map(|s| s.to_string_lossy().into_owned()).unwrap_or_default(),
    }
}

fn clean_name(raw: &str) -> String {
    let mut n: String = raw.chars().map(|c| if matches!(c, '\\' | '/' | ':' | '*' | '?' | '"' | '<' | '>' | '|') || (c as u32) < 32 { ' ' } else { c }).collect();
    for suffix in ["-master", "-main", "_master", "_main"] {
        if n.to_ascii_lowercase().ends_with(suffix) {
            n.truncate(n.len() - suffix.len());
        }
    }
    let n = n.trim().trim_start_matches('.').trim_end_matches(['.', ' ']).to_string();
    if n.is_empty() {
        "Imported theme".into()
    } else {
        n
    }
}

fn free_name(themes: &Path, base: &str) -> String {
    if !themes.join(base).exists() {
        return base.to_string();
    }
    (2..).map(|i| format!("{base} ({i})")).find(|n| !themes.join(n).exists()).unwrap()
}

/// Finds the theme inside the source and checks every file that would be imported.
fn plan(src: &mut Source, themes: &Path) -> CmdResult<Planned> {
    let mut skipped = Vec::new();
    let entries = list_entries(src, &mut skipped)?;
    let entries: Vec<Entry> = entries.into_iter().filter(|e| !is_clutter(&e.rel)).collect();
    // The theme is the shallowest folder with a theme.xml.
    let root = {
        let roots: Vec<&str> = entries.iter().filter(|e| e.rel.rsplit('/').next().is_some_and(|b| b.eq_ignore_ascii_case("theme.xml"))).map(|e| e.rel.rsplit_once('/').map(|(d, _)| d).unwrap_or("")).collect();
        let depth = |d: &str| if d.is_empty() { 0 } else { d.split('/').count() };
        let min = roots.iter().map(|d| depth(d)).min().ok_or("There's no theme.xml in here, so it isn't a RetroBat theme.")?;
        let top: Vec<&str> = roots.iter().copied().filter(|d| depth(d) == min).collect();
        if top.len() > 1 {
            return Err(format!("This holds {} themes ({}). Import them one at a time.", top.len(), top.join(", ")));
        }
        top[0].to_string()
    };
    let prefix = if root.is_empty() { String::new() } else { format!("{root}/") };
    let mut keep = Vec::new();
    let mut outside = 0;
    let mut seen = HashSet::new();
    let mut bytes = 0;
    for e in entries {
        let Some(rel) = e.rel.strip_prefix(&prefix).map(str::to_string) else {
            outside += 1;
            continue;
        };
        if !seen.insert(rel.to_lowercase()) {
            return Err(format!("{rel} appears twice, so it isn't clear which one to use. Nothing was imported."));
        }
        let kind = match kind_of(&rel) {
            Ok(k) => k,
            Err(reason) => {
                skipped.push(Skipped { path: rel, reason });
                continue;
            }
        };
        if e.size > MAX_FILE {
            skipped.push(Skipped { path: rel, reason: "it is over 2 GB".into() });
            continue;
        }
        let head = read_head(&mut *reader(src, &e)?)?;
        if let Err(reason) = check_content(&rel, kind, &head, e.size) {
            skipped.push(Skipped { path: rel, reason });
            continue;
        }
        if rel.eq_ignore_ascii_case("theme.xml") && !String::from_utf8_lossy(&head).contains("<theme") {
            return Err("Its theme.xml has no <theme> in it, so it isn't a RetroBat theme.".into());
        }
        bytes += e.size;
        keep.push((rel, e));
    }
    if !keep.iter().any(|(r, _)| r.eq_ignore_ascii_case("theme.xml")) {
        return Err("Its theme.xml didn't pass the checks, so nothing can be imported.".into());
    }
    let outer = source_name(src);
    let base = clean_name(if root.is_empty() { &outer } else { root.rsplit('/').next().unwrap() });
    let plan = ImportPlan {
        suggested_name: free_name(themes, &base),
        has_splash: keep.iter().any(|(r, _)| r.eq_ignore_ascii_case("splash.xml")),
        root,
        files: keep.len(),
        bytes,
        skipped,
        outside,
    };
    Ok(Planned { plan, keep })
}

fn check_source(roots: &Roots, source: &Path) -> CmdResult<PathBuf> {
    let themes = themes_dir(&roots.root()?);
    if is_inside(&themes, source) {
        return Err("Pick one theme, not a folder that holds RetroBat's themes folder.".into());
    }
    Ok(themes)
}

/// Looks inside a theme .zip or folder without changing anything.
#[tauri::command(async)]
pub fn inspect_theme_import(roots: State<Roots>, source: String) -> CmdResult<ImportPlan> {
    let source = PathBuf::from(source);
    let themes = check_source(&roots, &source)?;
    let mut src = open_source(&source)?;
    Ok(plan(&mut src, &themes)?.plan)
}

/// Imports a theme .zip or folder as a new theme folder named `name`. Returns its path.
#[tauri::command(async)]
pub fn import_theme(roots: State<Roots>, source: String, name: String) -> CmdResult<String> {
    let source = PathBuf::from(source);
    let themes = check_source(&roots, &source)?;
    let dest = new_theme_path(&roots, &name)?;
    import_into(&source, &themes, &dest)?;
    Ok(dest.to_string_lossy().into_owned())
}

fn import_into(source: &Path, themes: &Path, dest: &Path) -> CmdResult<()> {
    let mut src = open_source(source)?;
    let planned = plan(&mut src, themes)?;
    let stage = themes.join(format!("{WORK_PREFIX}import-{}", unique_id()));
    let result = (|| {
        fs::create_dir_all(&stage).map_err(err)?;
        for (rel, e) in &planned.keep {
            let target = stage.join(rel);
            fs::create_dir_all(target.parent().unwrap()).map_err(err)?;
            let mut out = fs::File::create(&target).map_err(|x| format!("{rel}: {x}"))?;
            let n = std::io::copy(&mut *reader(&mut src, e)?, &mut out).map_err(|x| format!("{rel}: {x}"))?;
            if n != e.size {
                return Err(format!("{rel} isn't the size the zip says ({n} bytes instead of {}). The zip may be damaged. Nothing was imported.", e.size));
            }
            out.flush().map_err(err)?;
        }
        if dest.exists() {
            return Err(format!("{} already exists. Nothing was imported.", dest.display()));
        }
        fs::rename(&stage, dest).map_err(err)
    })();
    if result.is_err() && stage.exists() {
        let _ = fs::remove_dir_all(&stage);
    }
    result
}

// ---- single files ------------------------------------------------------------------------

/// Checks one file the user picked before it is copied into a theme; returns its kind.
pub(crate) fn check_file(src: &Path, want: Option<Kind>) -> CmdResult<Kind> {
    let name = src.file_name().map(|n| n.to_string_lossy().into_owned()).ok_or("No file name")?;
    let meta = fs::symlink_metadata(src).map_err(|e| format!("{}: {e}", src.display()))?;
    if meta.file_type().is_symlink() || is_reparse(&meta) || !meta.is_file() {
        return Err(format!("{name} is a link or folder, not a file."));
    }
    let kind = kind_of(&name).map_err(|r| format!("{name} can't be used: {r}."))?;
    if let Some(w) = want.filter(|w| *w != kind) {
        return Err(format!("{name} is a {}, but a {} is needed here.", kind.label(), w.label()));
    }
    if meta.len() > kind.max_asset() {
        return Err(format!("{name} is too large for a {} ({} MB; the limit is {} MB).", kind.label(), meta.len() >> 20, kind.max_asset() >> 20));
    }
    let head = read_head(&mut fs::File::open(src).map_err(err)?)?;
    check_content(&name, kind, &head, meta.len()).map_err(|r| format!("{name} can't be used: {r}."))?;
    Ok(kind)
}

fn file_hash(p: &Path) -> CmdResult<Vec<u8>> {
    let mut h = Sha256::new();
    std::io::copy(&mut fs::File::open(p).map_err(err)?, &mut h).map_err(err)?;
    Ok(h.finalize().to_vec())
}

/// Copies a checked file into `dir`, keeping its name. The same file already there is reused; a
/// different file with that name gets "-2", "-3"… Returns the file's path.
pub(crate) fn copy_checked(src: &Path, dir: &Path) -> CmdResult<PathBuf> {
    let file_name = src.file_name().ok_or("No file name")?.to_string_lossy().into_owned();
    let (stem, ext) = match file_name.rsplit_once('.') {
        Some((s, e)) => (s.to_string(), format!(".{e}")),
        None => (file_name.clone(), String::new()),
    };
    let mut target = dir.join(&file_name);
    let mut n = 2;
    let mut src_hash: Option<Vec<u8>> = None;
    while target.exists() {
        if fs::metadata(&target).map(|m| m.len()).ok() == fs::metadata(src).map(|m| m.len()).ok() {
            if src_hash.is_none() {
                src_hash = Some(file_hash(src)?);
            }
            if src_hash.as_deref() == Some(&file_hash(&target)?[..]) {
                return Ok(target);
            }
        }
        target = dir.join(format!("{stem}-{n}{ext}"));
        n += 1;
    }
    fs::create_dir_all(dir).map_err(err)?;
    let tmp = dir.join(format!("{}.{}.ccs-tmp", file_name, unique_id()));
    let copied = fs::copy(src, &tmp).map_err(err).and_then(|_| fs::rename(&tmp, &target).map_err(err));
    if copied.is_err() {
        let _ = fs::remove_file(&tmp);
    }
    copied?;
    Ok(target)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn tmp(name: &str) -> PathBuf {
        let d = std::env::temp_dir().join(format!("ccs-import-{name}-{}", unique_id()));
        fs::create_dir_all(&d).unwrap();
        d
    }

    const PNG: &[u8] = b"\x89PNG\r\n\x1a\n\0\0\0\rIHDR";

    #[test]
    fn checks_types_and_contents() {
        assert_eq!(kind_of("a/b.PNG").unwrap(), Kind::Image);
        assert!(kind_of("run.exe").unwrap_err().contains("never"));
        assert!(kind_of("x.psd").is_err());
        assert_eq!(kind_of("LICENSE").unwrap(), Kind::Text);
        assert!(check_content("a.png", Kind::Image, PNG, 20).is_ok());
        assert!(check_content("a.png", Kind::Image, b"<html>", 6).unwrap_err().contains("isn't really"));
        // A WebP named .png (as carbon ships) is still a real picture to RetroBat.
        assert!(check_content("konami.png", Kind::Image, b"RIFF\0\0\0\0WEBPVP8X", 16).is_ok());
        assert_eq!(kind_of("collections.info").unwrap(), Kind::Text);
        assert!(check_content("a.svg", Kind::Image, b"<?xml version=\"1.0\"?><svg/>", 26).is_ok());
        assert!(check_content("a.svg", Kind::Image, b"hello", 5).is_err());
        assert!(check_content("a.xml", Kind::Xml, b"<theme>\0", 8).is_err());
        assert!(check_content("a.ttf", Kind::Font, &[0, 1, 0, 0, 9], 5).is_ok());
        assert!(check_content("a.mp4", Kind::Video, b"\0\0\0\x18ftypmp42", 12).is_ok());
        assert!(check_content("a.ogg", Kind::Sound, b"<html>", 6).is_err());
        assert!(check_content("a.png", Kind::Image, b"", 0).is_err());
    }

    fn write_zip(path: &Path, files: &[(&str, &[u8])]) {
        let mut z = zip::ZipWriter::new(fs::File::create(path).unwrap());
        for (name, data) in files {
            z.start_file(*name, zip::write::SimpleFileOptions::default()).unwrap();
            z.write_all(data).unwrap();
        }
        z.finish().unwrap();
    }

    #[test]
    fn imports_a_github_style_zip_leaving_out_what_doesnt_belong() {
        let work = tmp("zip");
        let themes = work.join("themes");
        fs::create_dir_all(themes.join("es-theme-x")).unwrap();
        let zip = work.join("es-theme-x-master.zip");
        write_zip(
            &zip,
            &[
                ("es-theme-x-master/theme.xml", b"<theme><formatVersion>7</formatVersion></theme>"),
                ("es-theme-x-master/_inc/logo.png", PNG),
                ("es-theme-x-master/_inc/fake.png", b"MZ\x90\0 not a png"),
                ("es-theme-x-master/tools/setup.exe", b"MZ"),
                ("es-theme-x-master/README.md", b"# x"),
                ("__MACOSX/es-theme-x-master/._theme.xml", b"junk"),
                ("other.txt", b"outside"),
            ],
        );
        let mut src = open_source(&zip).unwrap();
        let p = plan(&mut src, &themes).unwrap().plan;
        // "-master" goes, and the name already taken gets a number.
        assert_eq!(p.suggested_name, "es-theme-x (2)");
        assert_eq!(p.root, "es-theme-x-master");
        assert_eq!(p.files, 3);
        assert_eq!(p.outside, 1);
        let reasons: Vec<String> = p.skipped.iter().map(|s| format!("{}: {}", s.path, s.reason)).collect();
        assert!(reasons.iter().any(|r| r.starts_with("_inc/fake.png: it isn't really a picture")), "{reasons:?}");
        assert!(reasons.iter().any(|r| r.starts_with("tools/setup.exe: programs")), "{reasons:?}");
        let dest = themes.join(&p.suggested_name);
        import_into(&zip, &themes, &dest).unwrap();
        assert!(dest.join("theme.xml").is_file());
        assert!(dest.join("_inc/logo.png").is_file());
        assert!(!dest.join("_inc/fake.png").exists());
        assert!(!dest.join("tools").exists());
        // No staging folder is left behind, and an existing theme is never overwritten.
        assert_eq!(fs::read_dir(&themes).unwrap().count(), 2);
        assert!(import_into(&zip, &themes, &dest).unwrap_err().contains("already exists"));
        assert_eq!(fs::read_dir(&themes).unwrap().count(), 2);
        fs::remove_dir_all(&work).unwrap();
    }

    #[test]
    fn refuses_unsafe_or_unclear_zips() {
        let work = tmp("bad");
        let themes = work.join("themes");
        fs::create_dir_all(&themes).unwrap();
        let cases: [(&str, Vec<(&str, &[u8])>, &str); 5] = [
            ("escape", vec![("theme.xml", b"<theme/>"), ("../../evil.xml", b"<x/>")], "unsafe path"),
            ("none", vec![("readme.txt", b"hi")], "no theme.xml"),
            ("two", vec![("a/theme.xml", b"<theme/>"), ("b/theme.xml", b"<theme/>")], "Import them one at a time"),
            ("notheme", vec![("theme.xml", b"<html></html>")], "no <theme>"),
            ("twice", vec![("theme.xml", b"<theme/>"), ("A.png", PNG), ("a.png", PNG)], "appears twice"),
        ];
        for (name, files, want) in cases {
            let zip = work.join(format!("{name}.zip"));
            write_zip(&zip, &files);
            let mut src = open_source(&zip).unwrap();
            let e = plan(&mut src, &themes).err().unwrap_or_default();
            assert!(e.contains(want), "{name}: {e}");
        }
        assert_eq!(fs::read_dir(&themes).unwrap().count(), 0);
        fs::remove_dir_all(&work).unwrap();
    }

    /// Imports a real theme folder (read only) into a temp folder and reports what was left out:
    /// CCS_REAL_THEME="M:\...\themes\X" cargo test --release real_theme_import -- --ignored --nocapture
    #[test]
    #[ignore]
    fn real_theme_import() {
        let Ok(src) = std::env::var("CCS_REAL_THEME") else { return };
        let src = PathBuf::from(src);
        let work = tmp("real");
        let themes = work.join("themes");
        fs::create_dir_all(&themes).unwrap();
        let t = std::time::Instant::now();
        let p = plan(&mut open_source(&src).unwrap(), &themes).unwrap().plan;
        println!("plan: {} files, {} MB, {} left out, {:?}", p.files, p.bytes >> 20, p.skipped.len(), t.elapsed());
        for s in p.skipped.iter().take(30) {
            println!("  left out {}: {}", s.path, s.reason);
        }
        let dest = themes.join(&p.suggested_name);
        let t = std::time::Instant::now();
        import_into(&src, &themes, &dest).unwrap();
        println!("import: {:?}", t.elapsed());
        // Every kept file is byte-identical to the original.
        let mut n = 0;
        for e in WalkDir::new(&dest).into_iter().flatten().filter(|e| e.file_type().is_file()) {
            let rel = e.path().strip_prefix(&dest).unwrap();
            assert_eq!(file_hash(e.path()).unwrap(), file_hash(&src.join(rel)).unwrap(), "{}", rel.display());
            n += 1;
        }
        assert_eq!(n, p.files);
        fs::remove_dir_all(&work).unwrap();
    }

    #[test]
    fn imports_a_folder_and_checks_single_files() {
        let work = tmp("dir");
        let themes = work.join("themes");
        fs::create_dir_all(&themes).unwrap();
        let theme = work.join("My Downloaded Theme");
        fs::create_dir_all(theme.join("art")).unwrap();
        fs::write(theme.join("theme.xml"), b"\xEF\xBB\xBF<theme></theme>").unwrap();
        fs::write(theme.join("art/bg.png"), PNG).unwrap();
        fs::write(theme.join("Thumbs.db"), b"junk").unwrap();
        let dest = themes.join("My Downloaded Theme");
        import_into(&theme, &themes, &dest).unwrap();
        assert!(dest.join("art/bg.png").is_file());
        assert!(!dest.join("Thumbs.db").exists());
        // Single files: right kind, real contents, the same file reused.
        assert_eq!(check_file(&theme.join("art/bg.png"), Some(Kind::Image)).unwrap(), Kind::Image);
        assert!(check_file(&theme.join("art/bg.png"), Some(Kind::Font)).unwrap_err().contains("a font is needed"));
        fs::write(work.join("fake.ttf"), b"<html>").unwrap();
        assert!(check_file(&work.join("fake.ttf"), Some(Kind::Font)).unwrap_err().contains("isn't really"));
        let into = work.join("into");
        let a = copy_checked(&theme.join("art/bg.png"), &into).unwrap();
        let b = copy_checked(&theme.join("art/bg.png"), &into).unwrap();
        assert_eq!(a, b);
        fs::write(work.join("bg.png"), [PNG, b"different"].concat()).unwrap();
        assert!(copy_checked(&work.join("bg.png"), &into).unwrap().ends_with("bg-2.png"));
        fs::remove_dir_all(&work).unwrap();
    }
}
