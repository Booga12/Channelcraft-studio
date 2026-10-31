// Publishing a theme to the gallery on the website: a .zip like the one Share theme makes, sent
// with a theme name and a maker name. Sent from here, not the webview, so the webview stays
// offline.
//
// The gallery zip leaves out the console logos and pictures the New theme wizard copied from
// another installed theme (about 70 MB): only files that are the same as that theme's, so the
// maker's own stay in. A small manifest (channelcraft.json at the theme's top) says so, and
// Import a theme fills in what's missing from the user's own themes (fill_console_art). Files
// Import would refuse are left out too. Pictures, fonts, sounds and videos are stored and only
// a little text deflated, so the server can check the zip without unpacking much.

use crate::commands::{copy_art_folder, err, file_kind, is_inside, normalize, themes_dir, CmdResult, Roots};
use crate::importing::{check_content, file_hash, is_clutter, kind_of, read_head, Kind};
use crate::storage::{theme_files, theme_name, unique_id, zip_theme_as, ZipPlan, WORK_PREFIX};
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use std::fs;
use std::io::Read;
use std::path::{Path, PathBuf};
use std::time::Duration;
use walkdir::WalkDir;

/// The biggest theme the gallery takes (the server checks too).
const MAX_BYTES: u64 = 25 * 1024 * 1024;
/// The gallery's address, the same as GALLERY_SITE in src/lib/gallery.ts (a test checks they
/// match). Release builds send themes only here, whatever the webview asks for.
const GALLERY_SITE: &str = "https://channelcraft-website.channelcraftstudio.workers.dev";
/// The gallery manifest's file name, at the theme's top.
pub(crate) const GALLERY_MANIFEST: &str = "channelcraft.json";
/// Where the wizard puts the console art it copies (themeOptions.ts importConsoleArt), and the
/// two folders in it.
const ART_DIR: &str = "_inc/systems";
const ART_FOLDERS: [&str; 2] = ["logos", "consoles"];
/// What the server unpacks, kept small for the free plan's CPU limit: the same as LIMITS
/// packedFiles, packedFileBytes and packedTotalBytes in
/// channelcraft-website/src/lib/server/gallery/check.ts. Text past these is stored.
const PACKED_FILES: usize = 200;
const PACKED_FILE_BYTES: u64 = 1024 * 1024;
const PACKED_TOTAL_BYTES: u64 = 1024 * 1024;

/// What a gallery zip's channelcraft.json says.
#[derive(Serialize, Deserialize, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub(crate) struct GalleryManifest {
    pub gallery: u32,
    /// The folder the console art was left out of ("_inc/systems").
    #[serde(default)]
    pub system_art_left_out: Option<String>,
    /// Which of its folders were left out ("logos", "consoles").
    #[serde(default)]
    pub folders: Vec<String>,
}

/// The files in this theme's console art folders that are the same (name and bytes) as one in
/// the art folders of another installed theme the wizard could copy from. Lowercase paths.
fn borrowed_art(src: &Path, themes: &Path, names: &HashSet<String>) -> HashSet<String> {
    let mut out = HashSet::new();
    let mine: Vec<(&str, Vec<PathBuf>)> = ART_FOLDERS
        .into_iter()
        .map(|f| (f, fs::read_dir(src.join(ART_DIR).join(f)).map(|d| d.flatten().map(|e| e.path()).filter(|p| p.is_file()).collect()).unwrap_or_default()))
        .filter(|(_, v): &(&str, Vec<PathBuf>)| !v.is_empty())
        .collect();
    if mine.is_empty() {
        return out;
    }
    let me = normalize(src).to_string_lossy().to_lowercase();
    let Ok(dirs) = fs::read_dir(themes) else { return out };
    let others: Vec<(PathBuf, ConsoleArt)> = dirs
        .flatten()
        .map(|e| e.path())
        .filter(|d| !d.file_name().is_some_and(|n| n.to_string_lossy().starts_with('.')) && d.join("theme.xml").is_file() && normalize(d).to_string_lossy().to_lowercase() != me)
        .map(|d| {
            let art = scan_console_art(&d, names);
            (d, art)
        })
        .filter(|(_, a)| a.logo_count >= 10)
        .collect();
    for (f, files) in mine {
        // Each theme's folder for these, as the wizard (and Import's refill) picks it.
        let from: Vec<PathBuf> = others.iter().filter_map(|(d, a)| if f == "logos" { a.logos.as_deref() } else { a.consoles.as_deref() }.filter(|s| !s.is_empty()).map(|s| d.join(s))).collect();
        for p in files {
            let (Some(name), Ok(meta)) = (p.file_name(), fs::metadata(&p)) else { continue };
            let mut hash = None;
            let same = from.iter().any(|dir| {
                let o = dir.join(name);
                if !fs::metadata(&o).is_ok_and(|m| m.is_file() && m.len() == meta.len()) {
                    return false;
                }
                let h = hash.get_or_insert_with(|| file_hash(&p).ok());
                h.is_some() && file_hash(&o).ok() == *h
            });
            if same {
                out.insert(format!("{ART_DIR}/{f}/{}", name.to_string_lossy()).to_lowercase());
            }
        }
    }
    out
}

/// What gallery_zip left out.
#[derive(Debug, Default)]
pub(crate) struct GalleryZip {
    /// The console art folders some files were left out of (they come back on Import).
    #[allow(dead_code)] // read by the tests
    pub folders: Vec<&'static str>,
    /// Files the gallery doesn't take, by relative path.
    pub skipped: Vec<String>,
}

/// Zips a theme for the gallery: console art copied from other themes in `themes` left out, the
/// manifest added (when any was), files Import would refuse left out, and media stored. Text is
/// deflated only within the server's limits.
pub(crate) fn gallery_zip(src: &Path, prefix: &str, dest: &Path, themes: &Path, names: &HashSet<String>) -> CmdResult<GalleryZip> {
    let borrowed = borrowed_art(src, themes, names);
    let folders: Vec<&'static str> = ART_FOLDERS.into_iter().filter(|f| borrowed.iter().any(|b| b.starts_with(&format!("{ART_DIR}/{f}/")))).collect();
    let manifest = GalleryManifest { gallery: 1, system_art_left_out: Some(ART_DIR.into()), folders: folders.iter().map(|f| f.to_string()).collect() };
    let json = serde_json::to_string(&manifest).map_err(err)?;
    let extra = (!folders.is_empty()).then_some((GALLERY_MANIFEST, json.as_bytes()));
    // The manifest is deflated too, so it counts.
    let (mut packed, mut total) = extra.map_or((0, 0), |(_, j)| (1, j.len() as u64));
    // File → whether it's deflated.
    let mut keep: HashMap<String, bool> = HashMap::new();
    let mut skipped = Vec::new();
    for (path, rel) in theme_files(src) {
        let l = rel.to_lowercase();
        if l == GALLERY_MANIFEST || is_clutter(&rel) || borrowed.contains(&l) {
            continue;
        }
        // Import's own checks: its type, then its first bytes.
        let ok = kind_of(&rel).ok().and_then(|kind| {
            let size = fs::metadata(&path).ok()?.len();
            let head = read_head(&mut fs::File::open(&path).ok()?).ok()?;
            check_content(&rel, kind, &head, size).ok().map(|_| (kind, size))
        });
        let Some((kind, size)) = ok else {
            skipped.push(rel);
            continue;
        };
        let deflate = matches!(kind, Kind::Xml | Kind::Text) && size <= PACKED_FILE_BYTES && packed < PACKED_FILES && total + size <= PACKED_TOTAL_BYTES;
        if deflate {
            packed += 1;
            total += size;
        }
        keep.insert(rel, deflate);
    }
    skipped.sort();
    let leave_out = |rel: &str| !keep.contains_key(rel);
    let store = |_: &Path, rel: &str| !keep.get(rel).copied().unwrap_or(false);
    let plan = ZipPlan { leave_out: &leave_out, store: &store, extra };
    zip_theme_as(src, prefix, dest, None, Some(&plan))?;
    Ok(GalleryZip { folders, skipped })
}

/// Where an installed theme keeps its system logos and console pictures, found the way the New
/// theme wizard does (themeOptions.ts scanConsoleArt): the folders with the most pictures named
/// after systems.
#[derive(Debug, Default)]
pub(crate) struct ConsoleArt {
    pub logos: Option<String>,
    pub consoles: Option<String>,
    pub logo_count: usize,
    pub console_count: usize,
}

pub(crate) fn scan_console_art(theme: &Path, names: &HashSet<String>) -> ConsoleArt {
    // Folder → pictures named after a system, in the order first seen.
    let mut counts: Vec<(String, usize)> = Vec::new();
    for e in WalkDir::new(theme).into_iter().filter_entry(|e| e.depth() == 0 || !e.file_name().to_string_lossy().starts_with(WORK_PREFIX)).flatten() {
        if !e.file_type().is_file() || file_kind(e.path()) != "image" {
            continue;
        }
        let Ok(rel) = e.path().strip_prefix(theme) else { continue };
        let rel = rel.to_string_lossy().replace('\\', "/");
        let (dir, file) = rel.rsplit_once('/').unwrap_or(("", &rel));
        let stem = file.rsplit_once('.').map(|(s, _)| s).unwrap_or(file).to_lowercase();
        if names.contains(&stem) {
            match counts.iter_mut().find(|(d, _)| d == dir) {
                Some((_, n)) => *n += 1,
                None => counts.push((dir.to_string(), 1)),
            }
        }
    }
    // The biggest, the first one on a tie (as the wizard's stable sort).
    let best = |ok: &dyn Fn(&str, usize) -> bool| counts.iter().filter(|(d, n)| ok(d, *n)).fold(None::<&(String, usize)>, |b, c| if b.is_some_and(|b| b.1 >= c.1) { b } else { Some(c) });
    let has = |d: &str, words: &[&str]| words.iter().any(|w| d.to_lowercase().contains(w));
    let logos = best(&|d, n| n >= 5 && has(d, &["logo", "wheel", "marquee"])).or_else(|| best(&|_, _| true));
    let consoles = best(&|d, n| n >= 5 && has(d, &["console", "device", "controller", "hardware"]));
    ConsoleArt { logos: logos.map(|l| l.0.clone()), consoles: consoles.map(|c| c.0.clone()), logo_count: logos.map_or(0, |l| l.1), console_count: consoles.map_or(0, |c| c.1) }
}

/// The installed theme to borrow console art from, as the wizard picks it: at least 10 logos, the
/// most logos and console pictures. Folders in `skip` aren't looked at.
pub(crate) fn console_art_source(themes: &Path, names: &HashSet<String>, skip: &Path) -> Option<(PathBuf, ConsoleArt)> {
    let mut dirs: Vec<PathBuf> = fs::read_dir(themes)
        .ok()?
        .flatten()
        .filter(|e| !e.file_name().to_string_lossy().starts_with('.') && e.path().join("theme.xml").is_file() && e.path() != skip)
        .map(|e| e.path())
        .collect();
    dirs.sort_by_key(|d| d.file_name().map(|n| n.to_string_lossy().to_lowercase()));
    dirs.into_iter()
        .map(|d| {
            let art = scan_console_art(&d, names);
            (d, art)
        })
        .filter(|(_, a)| a.logo_count >= 10)
        .fold(None, |b: Option<(PathBuf, ConsoleArt)>, c| match b {
            Some(b) if b.1.logo_count + b.1.console_count >= c.1.logo_count + c.1.console_count => Some(b),
            _ => Some(c),
        })
}

/// Fills in the console art a gallery zip left out, in the theme being imported at `dest`, from
/// the user's installed themes. Returns the sentence to show after the import.
pub(crate) fn fill_console_art(m: &GalleryManifest, themes: &Path, dest: &Path, skip: &Path, names: &HashSet<String>) -> CmdResult<Option<String>> {
    let Some(dir) = m.system_art_left_out.as_deref().filter(|d| !d.is_empty() && crate::storage::safe_rel(d).is_ok()) else { return Ok(None) };
    let folders: Vec<&str> = m.folders.iter().map(String::as_str).filter(|f| ART_FOLDERS.contains(f)).collect();
    if m.gallery < 1 || folders.is_empty() {
        return Ok(None);
    }
    const MISSING: &str = "Console logos and pictures don't come with gallery themes, and none of your themes has them to copy, so the console logos are missing.";
    let Some((from, art)) = console_art_source(themes, names, skip) else { return Ok(Some(MISSING.into())) };
    let mut n = 0;
    for f in folders {
        let src = match f {
            "logos" => art.logos.as_deref(),
            _ => art.consoles.as_deref(),
        };
        // Not the theme's top folder: only a folder of pictures.
        if let Some(src) = src.filter(|s| !s.is_empty()) {
            n += copy_art_folder(&from.join(src), &dest.join(dir).join(f), Some(Kind::Image))?;
        }
    }
    if n == 0 {
        return Ok(Some(MISSING.into()));
    }
    Ok(Some(format!("Console logos and pictures don't come with gallery themes, so {n} were copied from your theme “{}”.", theme_name(&from))))
}
const OFFLINE: &str = "Couldn't reach the gallery. Check your internet connection and try again.";

#[derive(Serialize, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Published {
    slug: String,
    url: String,
    /// Files the gallery doesn't take, left out of the zip.
    left_out: Vec<String>,
}

/// Zips the theme in `dir` (as Share theme does) and sends it to `{site}/api/gallery/publish`.
/// `systems` are the systems' theme names (as in es_systems.cfg), used to find borrowed console art.
#[tauri::command(async)]
pub fn publish_theme(roots: tauri::State<Roots>, dir: String, name: String, maker: String, site: String, systems: Option<Vec<String>>) -> CmdResult<Published> {
    let themes = themes_dir(&roots.root()?);
    let names: HashSet<String> = systems.unwrap_or_default().iter().map(|s| s.to_lowercase()).collect();
    publish_from(&themes, &dir, &name, &maker, &site, &names)
}

fn publish_from(themes: &Path, dir: &str, name: &str, maker: &str, site: &str, names: &HashSet<String>) -> CmdResult<Published> {
    let src = PathBuf::from(dir);
    if !is_inside(&src, themes) {
        return Err("Only themes in RetroBat's themes folder can be published.".into());
    }
    if !src.join("theme.xml").is_file() {
        return Err(format!("{dir} is not a theme folder"));
    }
    let endpoint = endpoint(site, cfg!(debug_assertions))?;
    let clean = |s: &str| s.chars().filter(|c| !c.is_control()).collect::<String>().trim().to_string();
    let (name, maker) = (clean(name), clean(maker));
    let (name, maker) = (name.as_str(), maker.as_str());
    if name.is_empty() || maker.is_empty() {
        return Err("Give the theme a name and say who made it.".into());
    }
    let prefix = theme_name(&src);
    let tmp = std::env::temp_dir().join(format!("channelcraft-publish-{}.zip", unique_id()));
    let packed = (|| {
        let made = gallery_zip(&src, &prefix, &tmp, themes, names)?;
        if fs::metadata(&tmp).map_err(err)?.len() > MAX_BYTES {
            return Err(format!("The theme is too big: the limit is {} MB.", MAX_BYTES / 1024 / 1024));
        }
        Ok((fs::read(&tmp).map_err(err)?, made.skipped))
    })();
    let _ = fs::remove_file(&tmp);
    let (bytes, skipped) = packed?;

    let boundary = format!("----ChannelCraft{}", unique_id());
    let body = multipart(&boundary, &[("name", name), ("maker", maker), ("app", env!("CARGO_PKG_VERSION"))], &format!("{prefix}.zip"), &bytes);
    let agent = ureq::AgentBuilder::new()
        .timeout_connect(Duration::from_secs(15))
        // Per read and write, so a slow upload still finishes but a stalled one stops.
        .timeout_read(Duration::from_secs(90))
        .timeout_write(Duration::from_secs(90))
        // And never more than 20 minutes in all (25 MB on a slow line), even if bytes trickle in.
        .timeout(Duration::from_secs(20 * 60))
        // The publish address never redirects: don't send the theme anywhere else.
        .redirects(0)
        .build();
    let resp = agent
        .post(&endpoint)
        .set("Content-Type", &format!("multipart/form-data; boundary={boundary}"))
        .set("User-Agent", concat!("ChannelCraft-Studio/", env!("CARGO_PKG_VERSION")))
        .send_bytes(&body);
    let (status, text) = match resp {
        Ok(r) => (r.status(), read_body(r)),
        Err(ureq::Error::Status(code, r)) => (code, read_body(r)),
        Err(ureq::Error::Transport(_)) => return Err(OFFLINE.into()),
    };
    let mut out = reply(status, &text, site.trim().trim_end_matches('/'))?;
    out.left_out = skipped;
    Ok(out)
}

/// The publish address for a gallery site. Release builds take only GALLERY_SITE; dev builds
/// (`dev`) also take another https site or a dev server on this PC.
fn endpoint(site: &str, dev: bool) -> CmdResult<String> {
    let site = site.trim().trim_end_matches('/');
    let local = ["http://localhost", "http://127.0.0.1"].iter().any(|h| site == *h || site.starts_with(&format!("{h}:")));
    let https = site.starts_with("https://") && !site[8..].contains(['/', '?', '#', '@', '\\']);
    let ok = if dev { https || local } else { site == GALLERY_SITE };
    if !ok {
        return Err("The gallery address isn't right. Please report this.".into());
    }
    Ok(format!("{site}/api/gallery/publish"))
}

fn read_body(r: ureq::Response) -> String {
    let mut s = String::new();
    let _ = r.into_reader().take(1024 * 1024).read_to_string(&mut s);
    s
}

/// What the server's reply means: the theme's page, or one sentence to show the user.
fn reply(status: u16, text: &str, site: &str) -> CmdResult<Published> {
    let v: Option<serde_json::Value> = serde_json::from_str(text).ok();
    if (200..300).contains(&status) {
        let get = |k: &str| v.as_ref().and_then(|v| v[k].as_str()).map(str::to_string).filter(|s| !s.is_empty());
        // The link the user can open must be a gallery page on the same site.
        let page = format!("{site}/gallery/");
        return match (get("slug"), get("url")) {
            (Some(slug), Some(url)) if url.starts_with(&page) && !url.chars().any(|c| c.is_whitespace() || c.is_control()) => Ok(Published { slug, url, left_out: Vec::new() }),
            _ => Err("The gallery sent back an answer the app doesn't understand. Please try again later.".into()),
        };
    }
    if let Some(e) = v.as_ref().and_then(|v| v["error"].as_str()).map(str::trim).filter(|s| !s.is_empty()) {
        return Err(e.chars().take(300).collect());
    }
    Err(match status {
        413 => format!("The theme is too big: the limit is {} MB.", MAX_BYTES / 1024 / 1024),
        429 => "You've published a lot today. Please try again tomorrow.".into(),
        500..=599 => "The gallery isn't working right now. Please try again later.".into(),
        _ => format!("The gallery turned the theme down (error {status})."),
    })
}

/// A multipart/form-data body: text fields, then the theme zip as "theme".
fn multipart(boundary: &str, fields: &[(&str, &str)], file_name: &str, zip: &[u8]) -> Vec<u8> {
    let mut b = Vec::with_capacity(zip.len() + 1024);
    for (k, v) in fields {
        b.extend_from_slice(format!("--{boundary}\r\nContent-Disposition: form-data; name=\"{k}\"\r\n\r\n{v}\r\n").as_bytes());
    }
    // Plain ASCII file name: the server doesn't need the real one.
    let safe: String = file_name.chars().map(|c| if c.is_ascii_alphanumeric() || "._- ".contains(c) { c } else { '_' }).collect();
    b.extend_from_slice(format!("--{boundary}\r\nContent-Disposition: form-data; name=\"theme\"; filename=\"{safe}\"\r\nContent-Type: application/zip\r\n\r\n").as_bytes());
    b.extend_from_slice(zip);
    b.extend_from_slice(format!("\r\n--{boundary}--\r\n").as_bytes());
    b
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn only_https_or_a_local_dev_server() {
        assert_eq!(endpoint("https://example.workers.dev/", true).unwrap(), "https://example.workers.dev/api/gallery/publish");
        assert_eq!(endpoint("http://localhost:5173", true).unwrap(), "http://localhost:5173/api/gallery/publish");
        assert!(endpoint("http://example.com", true).is_err());
        assert!(endpoint("http://localhost.evil.com", true).is_err());
        assert!(endpoint("file:///c:/x", true).is_err());
        assert!(endpoint("https://evil.example/steal?", true).is_err());
        assert!(endpoint("https://user@evil.example", true).is_err());
    }

    #[test]
    fn release_builds_send_only_to_the_gallery() {
        assert_eq!(endpoint(GALLERY_SITE, false).unwrap(), format!("{GALLERY_SITE}/api/gallery/publish"));
        assert!(endpoint("https://evil.example", false).is_err());
        assert!(endpoint("http://localhost:5173", false).is_err());
    }

    #[test]
    fn the_site_matches_the_webviews() {
        let ts = include_str!("../../src/lib/gallery.ts");
        assert!(ts.contains(&format!("'{GALLERY_SITE}'")), "GALLERY_SITE differs from src/lib/gallery.ts");
    }

    #[test]
    fn reads_the_servers_reply() {
        let site = "https://x.dev";
        assert_eq!(reply(201, r#"{"slug":"neon","url":"https://x.dev/gallery/neon"}"#, site).unwrap(), Published { slug: "neon".into(), url: "https://x.dev/gallery/neon".into(), left_out: vec![] });
        assert!(reply(201, "not json", site).is_err());
        assert!(reply(201, r#"{"slug":"a","url":"javascript:alert(1)"}"#, site).is_err());
        assert!(reply(201, r#"{"slug":"a","url":"https://evil.example/gallery/a"}"#, site).is_err());
        assert!(reply(201, r#"{"slug":"a","url":"https://x.dev.evil.example/gallery/a"}"#, site).is_err());
        assert_eq!(reply(400, r#"{"error":"The theme has no theme.xml."}"#, site).unwrap_err(), "The theme has no theme.xml.");
        assert!(reply(429, "", site).unwrap_err().contains("tomorrow"));
        assert!(reply(502, "<html>", site).unwrap_err().contains("isn't working"));
        assert!(reply(413, "", site).unwrap_err().contains("25 MB"));
        // A redirect isn't followed: it's just a failure.
        assert!(reply(302, "", site).unwrap_err().contains("302"));
    }

    /// A made-up theme sent to a stand-in server on this PC.
    #[test]
    fn publishes_to_a_server() {
        use std::io::Write;
        let themes = std::env::temp_dir().join(format!("ccs-publish-{}", unique_id())).join("themes");
        let dir = themes.join("Demo Theme");
        fs::create_dir_all(dir.join(".git")).unwrap();
        fs::write(dir.join("theme.xml"), "<theme/>").unwrap();
        fs::write(dir.join("preview.png"), PNG).unwrap();
        // Left out, not a reason to refuse the whole theme.
        fs::write(dir.join("layers.psd"), b"8BPS").unwrap();
        fs::write(dir.join(".git/HEAD"), "ref: main").unwrap();
        let none = HashSet::new();
        let publish = |site: String| publish_from(&themes, &dir.to_string_lossy(), " Demo ", "Sam", &site, &none);
        let listener = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
        let port = listener.local_addr().unwrap().port();
        let server = std::thread::spawn(move || {
            let (mut s, _) = listener.accept().unwrap();
            let mut got = Vec::new();
            let mut buf = [0u8; 8192];
            // Read the headers, then the body by its length.
            loop {
                let n = s.read(&mut buf).unwrap();
                got.extend_from_slice(&buf[..n]);
                let text = String::from_utf8_lossy(&got).to_string();
                if let Some(end) = text.find("\r\n\r\n") {
                    let len: usize = text.lines().find_map(|l| l.to_ascii_lowercase().strip_prefix("content-length:").map(|v| v.trim().parse().unwrap())).unwrap_or(0);
                    if got.len() >= end + 4 + len {
                        break;
                    }
                }
            }
            let body = format!(r#"{{"slug":"demo-theme","url":"http://127.0.0.1:{port}/gallery/demo-theme"}}"#);
            write!(s, "HTTP/1.1 201 Created\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}", body.len()).unwrap();
            String::from_utf8_lossy(&got).to_string()
        });
        let out = publish(format!("http://127.0.0.1:{port}")).unwrap();
        assert_eq!(out.slug, "demo-theme");
        assert_eq!(out.left_out, vec!["layers.psd"]);
        let req = server.join().unwrap();
        assert!(req.starts_with("POST /api/gallery/publish "));
        assert!(req.contains("name=\"name\"\r\n\r\nDemo\r\n") && req.contains("name=\"maker\"\r\n\r\nSam\r\n"));
        assert!(req.contains("filename=\"Demo Theme.zip\"") && req.contains("Demo Theme/preview.png"));
        assert!(!req.contains("layers.psd") && !req.contains(".git/"));
        // Nobody listening: the plain offline sentence.
        let closed = std::net::TcpListener::bind("127.0.0.1:0").unwrap().local_addr().unwrap().port();
        assert_eq!(publish(format!("http://127.0.0.1:{closed}")).unwrap_err(), OFFLINE);
        // A theme outside the themes folder isn't sent.
        let other = themes.parent().unwrap().join("Elsewhere");
        fs::create_dir_all(&other).unwrap();
        fs::write(other.join("theme.xml"), "<theme/>").unwrap();
        let err = publish_from(&themes, &other.to_string_lossy(), "Demo", "Sam", &format!("http://127.0.0.1:{closed}"), &none).unwrap_err();
        assert_eq!(err, "Only themes in RetroBat's themes folder can be published.");
        let sneaky = format!("{}\\..\\..\\Elsewhere", dir.display());
        assert!(publish_from(&themes, &sneaky, "Demo", "Sam", "http://127.0.0.1:1", &none).unwrap_err().starts_with("Only themes"));
        fs::remove_dir_all(themes.parent().unwrap()).unwrap();
    }

    /// By hand, against a website dev server: CCS_GALLERY_SITE=http://localhost:5173 and
    /// CCS_GALLERY_DIR=<a theme folder>; CCS_GALLERY_ZIP=<path> also keeps the zip that was sent.
    /// cargo test publishes_to_a_dev_site -- --ignored --nocapture
    #[test]
    #[ignore]
    fn publishes_to_a_dev_site() {
        let site = std::env::var("CCS_GALLERY_SITE").expect("CCS_GALLERY_SITE");
        let dir = std::env::var("CCS_GALLERY_DIR").expect("CCS_GALLERY_DIR");
        let src = PathBuf::from(&dir);
        let themes = src.parent().unwrap().to_path_buf();
        // The systems' theme names, from the es_systems.cfg next to the themes folder.
        let cfg = fs::read_to_string(themes.with_file_name("es_systems.cfg")).unwrap_or_default();
        let names: HashSet<String> = cfg.split("<theme>").skip(1).filter_map(|s| s.split_once("</theme>")).map(|(t, _)| t.trim().to_lowercase()).collect();
        if let Ok(out) = std::env::var("CCS_GALLERY_ZIP") {
            let made = gallery_zip(&src, &theme_name(&src), &PathBuf::from(out), &themes, &names).unwrap();
            println!("zip: left out art in {:?}, skipped {:?}", made.folders, made.skipped);
        }
        let name = std::env::var("CCS_GALLERY_NAME").unwrap_or_else(|_| theme_name(&src));
        match publish_from(&themes, &dir, &name, "Sam Pixel", &site, &names) {
            Ok(p) => println!("published: {} {} (left out {:?})", p.slug, p.url, p.left_out),
            Err(e) => println!("refused: {e}"),
        }
    }

    #[test]
    fn builds_a_multipart_body() {
        let body = multipart("XX", &[("name", "Neon “Nights”"), ("maker", "Sam")], "Neon/Nights.zip", b"PK");
        let s = String::from_utf8(body).unwrap();
        assert!(s.starts_with("--XX\r\nContent-Disposition: form-data; name=\"name\"\r\n\r\nNeon “Nights”\r\n"));
        assert!(s.contains("name=\"theme\"; filename=\"Neon_Nights.zip\"\r\nContent-Type: application/zip\r\n\r\nPK\r\n--XX--\r\n"));
    }

    const PNG: &[u8] = b"\x89PNG\r\n\x1a\n\0\0\0\rIHDR";

    /// Twelve made-up systems, and an installed theme with their logos and console pictures.
    fn systems() -> HashSet<String> {
        (1..=12).map(|i| format!("sys{i}")).collect()
    }

    fn art_theme(themes: &Path) {
        let carbon = themes.join("carbon");
        fs::create_dir_all(carbon.join("art/logos")).unwrap();
        fs::create_dir_all(carbon.join("art/consoles")).unwrap();
        fs::write(carbon.join("theme.xml"), "<theme/>").unwrap();
        for s in systems() {
            fs::write(carbon.join(format!("art/logos/{s}.png")), PNG).unwrap();
            fs::write(carbon.join(format!("art/consoles/{s}.png")), PNG).unwrap();
        }
    }

    /// A made-up theme with console art where the wizard puts it: some copied, some the maker's.
    fn made_theme(dir: &Path) {
        for f in ["_inc/systems/logos", "_inc/systems/consoles", "_inc/images", "_inc/sounds", "_inc/systems/xml", ".git"] {
            fs::create_dir_all(dir.join(f)).unwrap();
        }
        fs::write(dir.join("theme.xml"), "<theme><include>./_inc/big.xml</include></theme>").unwrap();
        fs::write(dir.join("_inc/big.xml"), format!("<theme>{}</theme>", "x".repeat(1536 * 1024))).unwrap();
        // 300 per-system XMLs of 5 KB: more than the server unpacks.
        for i in 0..300 {
            fs::write(dir.join(format!("_inc/systems/xml/s{i:03}.xml")), format!("<theme>{}</theme>", "y".repeat(5000))).unwrap();
        }
        fs::write(dir.join("preview.png"), PNG).unwrap();
        fs::write(dir.join("_inc/images/bg.png"), PNG).unwrap();
        fs::write(dir.join("_inc/images/frame.svg"), "<svg/>").unwrap();
        fs::write(dir.join("_inc/sounds/click.ogg"), b"OggS....").unwrap();
        fs::write(dir.join("_inc/systems/logos/sys1.png"), PNG).unwrap();
        fs::write(dir.join("_inc/systems/consoles/sys1.png"), PNG).unwrap();
        // The maker's own: a new name, and a known name with other bytes.
        fs::write(dir.join("_inc/systems/logos/mine.png"), [PNG, b"mine"].concat()).unwrap();
        fs::write(dir.join("_inc/systems/logos/sys2.png"), [PNG, b"redrawn"].concat()).unwrap();
        // Files Import would refuse, and clutter.
        fs::write(dir.join("_inc/images/layers.psd"), b"8BPS").unwrap();
        fs::write(dir.join("theme.xml.bak"), "<theme/>").unwrap();
        fs::write(dir.join("_inc/images/fake.png"), "not a picture").unwrap();
        fs::write(dir.join(".git/config"), "[core]").unwrap();
        fs::write(dir.join("Thumbs.db"), b"\0\0").unwrap();
        // An old manifest in the folder isn't sent twice.
        fs::write(dir.join(GALLERY_MANIFEST), "{}").unwrap();
    }

    fn entries(zip: &Path) -> Vec<(String, zip::CompressionMethod, u64)> {
        let mut a = zip::ZipArchive::new(fs::File::open(zip).unwrap()).unwrap();
        (0..a.len()).map(|i| a.by_index_raw(i).map(|e| (e.name().to_string(), e.compression(), e.size())).unwrap()).collect()
    }

    /// The server's limits on deflated files (check.ts) hold.
    fn fits_the_server(got: &[(String, zip::CompressionMethod, u64)]) {
        let packed: Vec<u64> = got.iter().filter(|e| e.1 == zip::CompressionMethod::Deflated).map(|e| e.2).collect();
        assert!(packed.len() <= PACKED_FILES, "{} deflated", packed.len());
        assert!(packed.iter().all(|&n| n <= PACKED_FILE_BYTES));
        assert!(packed.iter().sum::<u64>() <= PACKED_TOTAL_BYTES, "{} bytes deflated", packed.iter().sum::<u64>());
    }

    #[test]
    fn the_limits_match_the_server() {
        // Read at run time: the website is a separate repo, next to this one in the workspace.
        let Ok(ts) = fs::read_to_string(concat!(env!("CARGO_MANIFEST_DIR"), "/../../channelcraft-website/src/lib/server/gallery/check.ts")) else { return };
        assert!(ts.contains(&format!("packedFiles: {PACKED_FILES},")));
        assert!(ts.contains("packedFileBytes: 1024 * 1024,") && PACKED_FILE_BYTES == 1024 * 1024);
        assert!(ts.contains("packedTotalBytes: 1024 * 1024,") && PACKED_TOTAL_BYTES == 1024 * 1024);
    }

    #[test]
    fn the_gallery_zip_leaves_out_console_art() {
        use zip::CompressionMethod::{Deflated, Stored};
        let base = std::env::temp_dir().join(format!("ccs-gzip-{}", unique_id()));
        let themes = base.join("themes");
        art_theme(&themes);
        let dir = themes.join("Made");
        made_theme(&dir);
        let out = base.join("out.zip");
        let made = gallery_zip(&dir, "Made", &out, &themes, &systems()).unwrap();
        assert_eq!(made.folders, vec!["logos", "consoles"]);
        assert_eq!(made.skipped, vec!["_inc/images/fake.png", "_inc/images/layers.psd", "theme.xml.bak"]);
        let got = entries(&out);
        let method = |n: &str| got.iter().find(|(x, _, _)| x == n).map(|e| e.1);
        // Only the copied art is left out.
        assert_eq!(method("Made/_inc/systems/logos/sys1.png"), None);
        assert_eq!(method("Made/_inc/systems/consoles/sys1.png"), None);
        assert_eq!(method("Made/_inc/systems/logos/mine.png"), Some(Stored));
        assert_eq!(method("Made/_inc/systems/logos/sys2.png"), Some(Stored));
        assert!(!got.iter().any(|(n, _, _)| n.contains(".git/") || n.ends_with("Thumbs.db") || n.ends_with(".psd") || n.ends_with(".bak")), "{got:?}");
        assert_eq!(method("Made/theme.xml"), Some(Deflated));
        assert_eq!(method("Made/preview.png"), Some(Stored));
        assert_eq!(method("Made/_inc/images/frame.svg"), Some(Stored));
        assert_eq!(method("Made/_inc/sounds/click.ogg"), Some(Stored));
        // Text over 1 MB is stored, and the rest is deflated only while under the server's limits.
        assert_eq!(method("Made/_inc/big.xml"), Some(Stored));
        assert_eq!(got.iter().filter(|(n, _, _)| n.starts_with("Made/_inc/systems/xml/")).count(), 300);
        assert!(got.iter().any(|(n, m, _)| n.starts_with("Made/_inc/systems/xml/") && *m == Stored));
        assert!(got.iter().filter(|e| e.1 == Deflated).count() > 150);
        fits_the_server(&got);
        assert_eq!(got.iter().filter(|(n, _, _)| n == "Made/channelcraft.json").count(), 1);
        assert_eq!(method("Made/channelcraft.json"), Some(Deflated));
        let mut a = zip::ZipArchive::new(fs::File::open(&out).unwrap()).unwrap();
        let mut text = String::new();
        a.by_name("Made/channelcraft.json").unwrap().read_to_string(&mut text).unwrap();
        assert_eq!(text, r#"{"gallery":1,"systemArtLeftOut":"_inc/systems","folders":["logos","consoles"]}"#);
        // Share theme is unchanged: it has everything.
        let shared = base.join("shared.zip");
        crate::storage::zip_theme(&dir, "Made", &shared, None).unwrap();
        assert!(entries(&shared).iter().any(|(n, _, _)| n == "Made/_inc/systems/logos/sys1.png"));
        // No theme to borrow from: the art stays in, and there's no manifest.
        fs::remove_dir_all(themes.join("carbon")).unwrap();
        let made = gallery_zip(&dir, "Made", &out, &themes, &systems()).unwrap();
        assert!(made.folders.is_empty());
        let got = entries(&out);
        assert!(got.iter().any(|(n, _, _)| n == "Made/_inc/systems/logos/sys1.png"));
        assert!(!got.iter().any(|(n, _, _)| n.ends_with(GALLERY_MANIFEST)));
        fits_the_server(&got);
        fs::remove_dir_all(&base).unwrap();
    }

    /// The four wizard-made themes of the demo RetroBat (dev/guides/README.md), read only: their
    /// gallery zips are under the limit, and the art comes back from the other themes.
    #[test]
    fn demo_themes_fit_the_gallery() {
        let demo = PathBuf::from(r"G:\projects\channelcraft\guides-demo\RetroBat\emulationstation\.emulationstation");
        let themes = demo.join("themes");
        if !themes.join("es-theme-carbon").is_dir() {
            return;
        }
        let cfg = fs::read_to_string(demo.join("es_systems.cfg")).unwrap();
        let names: HashSet<String> = cfg.split("<theme>").skip(1).filter_map(|s| s.split_once("</theme>")).map(|(t, _)| t.trim().to_lowercase()).collect();
        let base = std::env::temp_dir().join(format!("ccs-gdemo-{}", unique_id()));
        fs::create_dir_all(&base).unwrap();
        for name in ["Arcade Nights", "Neon Sunset", "Pocket Pixels", "Rainy Sunday"] {
            let src = themes.join(name);
            let out = base.join(format!("{name}.zip"));
            let made = gallery_zip(&src, name, &out, &themes, &names).unwrap();
            let left = made.folders;
            let size = fs::metadata(&out).unwrap().len();
            println!("{name}: gallery zip {:.2} MB, left out {left:?}, skipped {:?}", size as f64 / 1048576.0, made.skipped);
            assert!(size < MAX_BYTES, "{name} is {size} bytes");
            assert!(!left.is_empty());
            let got = entries(&out);
            assert!(!got.iter().any(|(n, _, _)| n.to_lowercase().contains("_inc/systems/logos/")));
            fits_the_server(&got);
            // What Import does with it, into a temp folder.
            let m = GalleryManifest { gallery: 1, system_art_left_out: Some(ART_DIR.into()), folders: left.iter().map(|f| f.to_string()).collect() };
            let dest = base.join(name);
            let note = fill_console_art(&m, &themes, &dest, &src, &names).unwrap().unwrap();
            println!("  {note}");
            // From carbon, or from another demo theme with the same art copied in.
            assert!(note.contains("were copied from your theme"), "{note}");
            assert!(fs::read_dir(dest.join("_inc/systems/logos")).unwrap().count() >= 10);
        }
        fs::remove_dir_all(&base).unwrap();
    }
}
