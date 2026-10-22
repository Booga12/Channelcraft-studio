// RetroBat's intro video settings: the [SplashScreen] section of retrobat.ini, which RetroBat.exe
// reads before it starts the frontend. Edits change only the lines of the keys that changed, so
// the file's comments and layout stay as they were.

use crate::commands::{err, CmdResult, Roots};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Manager, State};

const SECTION: &str = "SplashScreen";
const VIDEO_EXT: [&str; 6] = ["mp4", "mkv", "avi", "webm", "mov", "wmv"];

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct IntroSettings {
    /// EnableIntro: play a video before the interface.
    enable_intro: bool,
    /// FileName: the video to play when not random.
    file_name: String,
    /// FilePath: "default" (RetroBat's video folder) or a folder of your own.
    file_path: String,
    /// RandomVideo: a random video from the folder each time.
    random_video: bool,
    /// VideoDelay: milliseconds between the video starting and the interface starting.
    video_delay: u32,
    /// WaitForVideoEnd: load the interface only after the video.
    wait_for_video_end: bool,
    /// KillVideoWhenESReady: stop the video once the interface has loaded.
    kill_video_when_es_ready: bool,
    /// GamepadVideoKill: a gamepad button skips the video (XInput only).
    gamepad_video_kill: bool,
}

impl Default for IntroSettings {
    /// RetroBat's own defaults, used for keys the file doesn't have.
    fn default() -> Self {
        IntroSettings {
            enable_intro: true,
            file_name: "retrobat-neon.mp4".into(),
            file_path: "default".into(),
            random_video: false,
            video_delay: 1000,
            wait_for_video_end: true,
            kill_video_when_es_ready: false,
            gamepad_video_kill: true,
        }
    }
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct VideoFile {
    name: String,
    path: String,
    size: u64,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct IntroInfo {
    settings: IntroSettings,
    /// retrobat.ini exists (it is created when RetroBat first runs).
    found: bool,
    /// The folder the videos come from, resolved.
    folder: String,
    videos: Vec<VideoFile>,
}

fn ini_path(root: &Path) -> PathBuf {
    root.join("retrobat.ini")
}

fn default_video_dir(root: &Path) -> PathBuf {
    root.join("emulationstation").join(".emulationstation").join("video")
}

fn unquote(v: &str) -> String {
    let v = v.trim();
    v.strip_prefix('"').and_then(|s| s.strip_suffix('"')).unwrap_or(v).to_string()
}

/// The `key=value` pairs of one section, ignoring comments. Keys are matched without case.
fn section_values(text: &str, section: &str) -> Vec<(String, String)> {
    let mut inside = false;
    let mut out = Vec::new();
    for line in text.lines() {
        let t = line.trim();
        if t.starts_with('[') && t.ends_with(']') {
            inside = t[1..t.len() - 1].trim().eq_ignore_ascii_case(section);
            continue;
        }
        if !inside || t.is_empty() || t.starts_with(';') || t.starts_with('#') {
            continue;
        }
        if let Some((k, v)) = t.split_once('=') {
            out.push((k.trim().to_string(), unquote(v)));
        }
    }
    out
}

pub(crate) fn parse(text: &str) -> IntroSettings {
    let mut s = IntroSettings::default();
    let flag = |v: &str| v.trim() == "1" || v.trim().eq_ignore_ascii_case("true");
    for (k, v) in section_values(text, SECTION) {
        match k.to_ascii_lowercase().as_str() {
            "enableintro" => s.enable_intro = flag(&v),
            "filename" => s.file_name = v,
            "filepath" => s.file_path = if v.is_empty() { "default".into() } else { v },
            "randomvideo" => s.random_video = flag(&v),
            "videodelay" => s.video_delay = v.trim().parse().unwrap_or(s.video_delay),
            "waitforvideoend" => s.wait_for_video_end = flag(&v),
            "killvideowhenesready" => s.kill_video_when_es_ready = flag(&v),
            "gamepadvideokill" => s.gamepad_video_kill = flag(&v),
            _ => {}
        }
    }
    s
}

/// The keys as RetroBat writes them, with values in its format (1/0, quoted names).
fn entries(s: &IntroSettings) -> Vec<(&'static str, String)> {
    let b = |v: bool| if v { "1".to_string() } else { "0".to_string() };
    vec![
        ("EnableIntro", b(s.enable_intro)),
        ("FileName", format!("\"{}\"", s.file_name)),
        ("FilePath", format!("\"{}\"", s.file_path)),
        ("RandomVideo", b(s.random_video)),
        ("VideoDelay", s.video_delay.to_string()),
        ("WaitForVideoEnd", b(s.wait_for_video_end)),
        ("KillVideoWhenESReady", b(s.kill_video_when_es_ready)),
        ("GamepadVideoKill", b(s.gamepad_video_kill)),
    ]
}

/// Sets `key=value` lines in `section`, changing only those lines. Keys that aren't there are
/// added at the end of the section; a missing section is added at the end of the file.
pub(crate) fn apply(text: &str, section: &str, values: &[(&str, String)]) -> String {
    let eol = if text.contains("\r\n") { "\r\n" } else { "\n" };
    let mut lines: Vec<String> = text.split(eol).map(|l| l.to_string()).collect();
    let mut start: Option<usize> = None;
    let mut end = lines.len();
    for (i, l) in lines.iter().enumerate() {
        let t = l.trim();
        if t.starts_with('[') && t.ends_with(']') {
            if start.is_some() {
                end = i;
                break;
            }
            if t[1..t.len() - 1].trim().eq_ignore_ascii_case(section) {
                start = Some(i);
            }
        }
    }
    let Some(start) = start else {
        let mut out = text.trim_end_matches(['\r', '\n']).to_string();
        out.push_str(eol);
        out.push_str(eol);
        out.push_str(&format!("[{section}]{eol}"));
        for (k, v) in values {
            out.push_str(&format!("{k}={v}{eol}"));
        }
        return out;
    };
    let mut missing = Vec::new();
    for (k, v) in values {
        let found = (start + 1..end).find(|&i| {
            let t = lines[i].trim_start();
            !t.starts_with(';') && !t.starts_with('#') && t.split_once('=').is_some_and(|(key, _)| key.trim().eq_ignore_ascii_case(k))
        });
        match found {
            Some(i) => {
                // Keep the key's spelling and anything before the "=" as it was.
                let eq = lines[i].find('=').unwrap();
                lines[i] = format!("{}={}", &lines[i][..eq], v);
            }
            None => missing.push(format!("{k}={v}")),
        }
    }
    if !missing.is_empty() {
        // After the section's last line with content, so blank lines before the next section stay.
        let mut at = end;
        while at > start + 1 && lines[at - 1].trim().is_empty() {
            at -= 1;
        }
        for (n, l) in missing.into_iter().enumerate() {
            lines.insert(at + n, l);
        }
    }
    lines.join(eol)
}

fn list_videos(dir: &Path) -> Vec<VideoFile> {
    let mut out: Vec<VideoFile> = fs::read_dir(dir)
        .into_iter()
        .flatten()
        .flatten()
        .filter(|e| e.file_type().is_ok_and(|t| t.is_file()))
        .filter(|e| e.path().extension().and_then(|x| x.to_str()).is_some_and(|x| VIDEO_EXT.contains(&x.to_ascii_lowercase().as_str())))
        .map(|e| VideoFile {
            name: e.file_name().to_string_lossy().into_owned(),
            path: e.path().to_string_lossy().into_owned(),
            size: e.metadata().map(|m| m.len()).unwrap_or(0),
        })
        .collect();
    out.sort_by_key(|v| v.name.to_lowercase());
    out
}

fn info(app: &AppHandle, root: &Path) -> IntroInfo {
    let path = ini_path(root);
    let text = fs::read_to_string(&path).ok();
    let settings = text.as_deref().map(parse).unwrap_or_default();
    let folder = if settings.file_path.eq_ignore_ascii_case("default") { default_video_dir(root) } else { PathBuf::from(&settings.file_path) };
    // A folder of your own may be outside RetroBat; the preview needs to read its videos.
    if folder.is_dir() {
        let _ = app.asset_protocol_scope().allow_directory(&folder, false);
    }
    IntroInfo { found: text.is_some(), folder: folder.to_string_lossy().into_owned(), videos: list_videos(&folder), settings }
}

#[tauri::command(async)]
pub fn read_intro(app: AppHandle, roots: State<Roots>) -> CmdResult<IntroInfo> {
    Ok(info(&app, &roots.root()?))
}

/// Writes the settings into retrobat.ini. The first time, the file is copied to
/// retrobat.ini.channelcraft-backup (kept from then on, so it holds the file as it was).
#[tauri::command(async)]
pub fn write_intro(app: AppHandle, roots: State<Roots>, settings: IntroSettings) -> CmdResult<IntroInfo> {
    let root = roots.root()?;
    if settings.file_name.contains(['\\', '/', ':', '"']) || settings.file_name.trim().is_empty() {
        return Err("The video must be a file name in the video folder".into());
    }
    if settings.file_path.contains('"') || (!settings.file_path.eq_ignore_ascii_case("default") && !Path::new(&settings.file_path).is_dir()) {
        return Err(format!("The video folder {} doesn't exist", settings.file_path));
    }
    if settings.video_delay > 60_000 {
        return Err("The delay can be at most 60 seconds".into());
    }
    let path = ini_path(&root);
    let current = fs::read_to_string(&path).unwrap_or_default();
    let backup = root.join("retrobat.ini.channelcraft-backup");
    if path.is_file() && !backup.exists() {
        fs::copy(&path, &backup).map_err(err)?;
    }
    let text = apply(&current, SECTION, &entries(&settings));
    // Through a temporary file, so a failed write never leaves half a file.
    let tmp = root.join("retrobat.ini.ccs-tmp");
    fs::write(&tmp, text).map_err(err)?;
    fs::rename(&tmp, &path).map_err(err)?;
    Ok(info(&app, &root))
}

#[cfg(test)]
mod tests {
    use super::*;

    const INI: &str = "; RETROBAT GLOBAL CONFIG FILE\r\n\r\n[RetroBat]\r\n\r\nLanguageDetection=1\r\n\r\n[SplashScreen]\r\n\r\n; Set if video introduction is played.\r\nEnableIntro=1\r\n\r\n; The name of the video file.\r\nFileName=\"retrobat-ps2.mp4\"\r\n\r\nFilePath=\"default\"\r\nRandomVideo=0\r\nVideoDelay=1000\r\nWaitForVideoEnd=1\r\n\r\n[Other]\r\nX=1\r\n";

    #[test]
    fn reads_the_section() {
        let s = parse(INI);
        assert!(s.enable_intro);
        assert_eq!(s.file_name, "retrobat-ps2.mp4");
        assert_eq!(s.file_path, "default");
        assert!(!s.random_video);
        assert_eq!(s.video_delay, 1000);
        // Not in the file: RetroBat's default.
        assert!(s.gamepad_video_kill);
    }

    #[test]
    fn changes_only_the_changed_lines() {
        let mut s = parse(INI);
        s.enable_intro = false;
        s.file_name = "retrobat-neon.mp4".into();
        let out = apply(INI, SECTION, &entries(&s));
        assert!(out.contains("; Set if video introduction is played.\r\nEnableIntro=0\r\n"));
        assert!(out.contains("FileName=\"retrobat-neon.mp4\"\r\n"));
        assert!(out.contains("[RetroBat]\r\n\r\nLanguageDetection=1\r\n"));
        // Missing keys go at the end of the section, before the blank line and [Other].
        assert!(out.contains("WaitForVideoEnd=1\r\nKillVideoWhenESReady=0\r\nGamepadVideoKill=1\r\n\r\n[Other]\r\nX=1\r\n"));
        assert_eq!(parse(&out), s);
        // Writing the same settings again changes nothing.
        assert_eq!(apply(&out, SECTION, &entries(&s)), out);
    }

    #[test]
    fn adds_a_missing_section() {
        let out = apply("[RetroBat]\nA=1\n", SECTION, &[("EnableIntro", "0".into())]);
        assert_eq!(out, "[RetroBat]\nA=1\n\n[SplashScreen]\nEnableIntro=0\n");
    }

    #[test]
    fn ignores_commented_keys() {
        let out = apply("[SplashScreen]\n;EnableIntro=1\nEnableIntro=1\n", SECTION, &[("EnableIntro", "0".into())]);
        assert_eq!(out, "[SplashScreen]\n;EnableIntro=1\nEnableIntro=0\n");
    }

    /// Read-only check on a real file: CCS_RETROBAT_INI=<path> cargo test -- --ignored real_ini --nocapture
    #[test]
    #[ignore]
    fn real_ini_round_trip() {
        let Ok(p) = std::env::var("CCS_RETROBAT_INI") else { return };
        let text = fs::read_to_string(p).unwrap();
        let s = parse(&text);
        println!("{s:?}");
        // Writing what is there keeps every original line (missing keys may be added).
        let same = apply(&text, SECTION, &entries(&s));
        for line in text.lines() {
            assert!(same.lines().any(|l| l == line) || line.trim().starts_with("FileName") || line.trim().starts_with("FilePath"), "lost: {line}");
        }
        let mut t = s.clone();
        t.enable_intro = !t.enable_intro;
        let changed = apply(&same, SECTION, &entries(&t));
        assert_eq!(parse(&changed), t);
        assert_eq!(apply(&changed, SECTION, &entries(&s)), same);
    }
}
