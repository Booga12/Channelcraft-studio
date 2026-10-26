// A small log of problems on this PC: crashes of the program and errors in its pages. It never
// leaves the PC by itself; "Report a problem" shows it, and the user decides whether to attach it.
// %LOCALAPPDATA%\com.channelcraft.studio\logs\problems.log, kept under 256 KB (oldest lines go).

use crate::commands::CmdResult;
use std::fs;
use std::io::Write;
use std::path::PathBuf;
use std::time::{SystemTime, UNIX_EPOCH};

const MAX_LOG: u64 = 256 * 1024;
const KEEP: usize = 128 * 1024;
/// Longest entry accepted from the pages.
const MAX_ENTRY: usize = 4000;

fn log_file() -> Option<PathBuf> {
    let base = std::env::var_os("LOCALAPPDATA").map(PathBuf::from)?;
    Some(base.join(crate::APP_ID).join("logs").join("problems.log"))
}

/// "2026-10-26 14:03:09 UTC" for a time in seconds since 1970.
fn stamp(secs: u64) -> String {
    let days = (secs / 86_400) as i64;
    let rem = secs % 86_400;
    // Days to a civil date (Howard Hinnant's algorithm).
    let z = days + 719_468;
    let era = z.div_euclid(146_097);
    let doe = z - era * 146_097;
    let yoe = (doe - doe / 1460 + doe / 36_524 - doe / 146_096) / 365;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = doy - (153 * mp + 2) / 5 + 1;
    let m = if mp < 10 { mp + 3 } else { mp - 9 };
    let y = yoe + era * 400 + i64::from(m <= 2);
    format!("{y:04}-{m:02}-{d:02} {:02}:{:02}:{:02} UTC", rem / 3600, rem % 3600 / 60, rem % 60)
}

/// Adds an entry to the log, dropping the oldest part when it gets big. Never fails loudly: a
/// problem log that can't be written must not cause problems of its own.
pub fn append(kind: &str, text: &str) {
    let Some(path) = log_file() else { return };
    let _ = fs::create_dir_all(path.parent().unwrap_or(&path));
    if fs::metadata(&path).map(|m| m.len() > MAX_LOG).unwrap_or(false)
        && let Ok(old) = fs::read_to_string(&path)
    {
        let mut cut = old.len().saturating_sub(KEEP);
        while !old.is_char_boundary(cut) {
            cut += 1;
        }
        let rest = &old[cut..];
        let rest = rest.find('\n').map(|i| &rest[i + 1..]).unwrap_or(rest);
        let _ = fs::write(&path, rest);
    }
    let secs = SystemTime::now().duration_since(UNIX_EPOCH).map(|d| d.as_secs()).unwrap_or(0);
    let entry: String = text.chars().take(MAX_ENTRY).collect();
    if let Ok(mut f) = fs::OpenOptions::new().create(true).append(true).open(&path) {
        let _ = writeln!(f, "[{}] {kind} (v{}): {}", stamp(secs), env!("CARGO_PKG_VERSION"), entry.trim_end());
    }
}

/// Writes crashes of the program to the log, then lets them go on as before.
pub fn install_panic_hook() {
    let previous = std::panic::take_hook();
    std::panic::set_hook(Box::new(move |info| {
        append("Crash", &info.to_string());
        previous(info);
    }));
}

/// An error from the pages (an exception or a failed promise nothing caught).
#[tauri::command]
pub fn log_problem(text: String) {
    append("Error", &text);
}

/// The end of the log (the newest entries), or "" when there is none.
#[tauri::command]
pub fn read_problem_log() -> String {
    let Some(text) = log_file().and_then(|p| fs::read_to_string(p).ok()) else { return String::new() };
    let mut cut = text.len().saturating_sub(16 * 1024);
    while !text.is_char_boundary(cut) {
        cut += 1;
    }
    text[cut..].to_string()
}

/// Where the log is, to show it in Explorer.
#[tauri::command]
pub fn problem_log_path() -> CmdResult<String> {
    log_file().map(|p| p.to_string_lossy().into_owned()).ok_or_else(|| "No local app data folder".into())
}

#[tauri::command]
pub fn clear_problem_log() -> CmdResult<()> {
    if let Some(p) = log_file().filter(|p| p.exists()) {
        fs::remove_file(p).map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::stamp;

    #[test]
    fn stamps_are_readable_dates() {
        assert_eq!(stamp(0), "1970-01-01 00:00:00 UTC");
        assert_eq!(stamp(951_782_400), "2000-02-29 00:00:00 UTC");
        assert_eq!(stamp(1_793_008_122), "2026-10-26 09:48:42 UTC");
    }
}
