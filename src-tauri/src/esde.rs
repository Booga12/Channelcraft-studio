// Export for ES-DE (#49): writes the zip the converter (src/lib/theme/esde.ts) planned. The
// converter decides every file; this only writes them, reading copies from the RetroBat folder.

use crate::commands::{err, is_inside, CmdResult, Roots};
use crate::storage::unique_id;
use base64::Engine;
use serde::Deserialize;
use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};

/// One file of the exported theme: written from `text`, copied from `src`, or from base64 `data`
/// (a picture the app drew, such as an SVG logo turned into a PNG).
#[derive(Deserialize, Debug)]
pub struct EsdeEntry {
    pub dest: String,
    pub text: Option<String>,
    pub src: Option<String>,
    #[serde(default)]
    pub data: Option<String>,
}

/// A zip path is a plain relative path: no drive, no leading slash, no "..".
fn safe_dest(dest: &str) -> bool {
    !dest.is_empty() && !dest.starts_with(['/', '\\']) && !dest.contains(':') && !dest.split(['/', '\\']).any(|p| p == ".." || p.is_empty())
}

/// Writes the entries to `dest` as a zip. Copied files must be inside `allowed` (the RetroBat
/// folder); returns how many files went in.
pub(crate) fn write_esde_zip(entries: &[EsdeEntry], dest: &Path, allowed: &Path) -> CmdResult<usize> {
    for e in entries {
        if !safe_dest(&e.dest) {
            return Err(format!("Not a file name for the zip: {}", e.dest));
        }
        if let Some(src) = &e.src {
            if !is_inside(Path::new(src), allowed) {
                return Err(format!("{src} is outside the RetroBat folder"));
            }
        }
    }
    let parent = dest.parent().map(Path::to_path_buf).unwrap_or_else(|| PathBuf::from("."));
    let tmp = parent.join(format!(".{}.{}.ccs-tmp", dest.file_name().map(|n| n.to_string_lossy().into_owned()).unwrap_or_default(), unique_id()));
    let result = (|| -> CmdResult<usize> {
        let file = fs::File::create(&tmp).map_err(err)?;
        let mut zip = zip::ZipWriter::new(std::io::BufWriter::new(file));
        let deflate = zip::write::SimpleFileOptions::default().compression_method(zip::CompressionMethod::Deflated).large_file(true);
        let store = zip::write::SimpleFileOptions::default().compression_method(zip::CompressionMethod::Stored).large_file(true);
        let mut n = 0;
        for e in entries {
            let name = e.dest.replace('\\', "/");
            if let Some(text) = &e.text {
                zip.start_file(name, deflate).map_err(err)?;
                zip.write_all(text.as_bytes()).map_err(err)?;
            } else if let Some(src) = &e.src {
                let mut reader = fs::File::open(src).map_err(|e| format!("{src}: {e}"))?;
                // Pictures, videos, sounds and fonts are compressed already.
                let lower = name.to_lowercase();
                let packed = [".png", ".jpg", ".jpeg", ".webp", ".gif", ".mp4", ".webm", ".mkv", ".ogg", ".mp3", ".wav", ".ttf", ".otf"].iter().any(|x| lower.ends_with(x));
                zip.start_file(name, if packed { store } else { deflate }).map_err(err)?;
                std::io::copy(&mut reader, &mut zip).map_err(err)?;
            } else if let Some(data) = &e.data {
                let bytes = base64::engine::general_purpose::STANDARD.decode(data).map_err(err)?;
                zip.start_file(name, store).map_err(err)?;
                zip.write_all(&bytes).map_err(err)?;
            } else {
                continue;
            }
            n += 1;
        }
        let mut w = zip.finish().map_err(err)?;
        w.flush().map_err(err)?;
        drop(w);
        fs::rename(&tmp, dest).map_err(err)?;
        Ok(n)
    })();
    if result.is_err() {
        let _ = fs::remove_file(&tmp);
    }
    result
}

/// Export for ES-DE: writes the converted theme to `dest` as a zip.
#[tauri::command(async)]
pub fn export_esde(roots: tauri::State<Roots>, dest: String, entries: Vec<EsdeEntry>) -> CmdResult<usize> {
    let root = roots.root()?;
    write_esde_zip(&entries, Path::new(&dest), &root)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Read;

    fn tmp_dir(tag: &str) -> PathBuf {
        let d = std::env::temp_dir().join(format!("ccs-esde-{tag}-{}", unique_id()));
        fs::create_dir_all(&d).unwrap();
        d
    }

    #[test]
    fn writes_text_and_copies() {
        let root = tmp_dir("ok");
        fs::create_dir_all(root.join("themes/t/art")).unwrap();
        fs::write(root.join("themes/t/art/a.png"), b"PNGDATA").unwrap();
        let dest = root.join("out.zip");
        let entries = vec![
            EsdeEntry { dest: "t-es-de/theme.xml".into(), text: Some("<theme/>".into()), src: None, data: None },
            EsdeEntry { dest: "t-es-de/art/a.png".into(), text: None, src: Some(root.join("themes/t/art/a.png").to_string_lossy().into_owned()), data: None },
            EsdeEntry { dest: "t-es-de/art/b.png".into(), text: None, src: None, data: Some("UE5HMg==".into()) },
        ];
        assert_eq!(write_esde_zip(&entries, &dest, &root).unwrap(), 3);
        let mut z = zip::ZipArchive::new(fs::File::open(&dest).unwrap()).unwrap();
        let mut s = String::new();
        z.by_name("t-es-de/theme.xml").unwrap().read_to_string(&mut s).unwrap();
        assert_eq!(s, "<theme/>");
        let mut b = Vec::new();
        z.by_name("t-es-de/art/a.png").unwrap().read_to_end(&mut b).unwrap();
        assert_eq!(b, b"PNGDATA");
        let mut c = Vec::new();
        z.by_name("t-es-de/art/b.png").unwrap().read_to_end(&mut c).unwrap();
        assert_eq!(c, b"PNG2");
        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn refuses_bad_paths() {
        let root = tmp_dir("bad");
        let dest = root.join("out.zip");
        let outside = std::env::temp_dir().join("elsewhere.png").to_string_lossy().into_owned();
        assert!(write_esde_zip(&[EsdeEntry { dest: "../x".into(), text: Some("x".into()), src: None, data: None }], &dest, &root).is_err());
        assert!(write_esde_zip(&[EsdeEntry { dest: "C:/x".into(), text: Some("x".into()), src: None, data: None }], &dest, &root).is_err());
        assert!(write_esde_zip(&[EsdeEntry { dest: "t/x.png".into(), text: None, src: Some(outside), data: None }], &dest, &root).is_err());
        assert!(!dest.exists());
        let _ = fs::remove_dir_all(&root);
    }
}
