// @ts-nocheck — plain dev-server JS, not part of the app bundle.
// Development only, and only when CCS_DEMO_ROOT is set (see dev/guides/README.md): the write
// commands, working on a made-up demo RetroBat so the website's how-to clips can be recorded in a
// plain browser. Without CCS_DEMO_ROOT none of this is loaded and the dev bridge stays read-only.
//
// Safety:
// - Every path the page sends is a "virtual" path (C:\RetroBat, C:\Users\Player\...) that is
//   mapped to a folder inside CCS_DEMO_ROOT. A path that maps anywhere else is refused before the
//   command runs, and every file operation checks again that it stays inside CCS_DEMO_ROOT.
// - Theme writes also follow the app's own rule (src-tauri/src/commands.rs ensure_writable): only
//   inside the RetroBat themes folder (plus es_settings.cfg and retrobat.ini, as the app does).
// - The virtual paths keep the user's real folders out of the clips: the clips show C:\RetroBat.
import { createHash } from 'node:crypto';
import {
  appendFileSync,
  copyFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { basename, dirname, extname, join, relative, resolve } from 'node:path';
import AdmZip from 'adm-zip';

export const VIRTUAL_ROOT = 'C:\\RetroBat';
export const VIRTUAL_HOME = 'C:\\Users\\Player';
export const VIRTUAL_APPDATA = 'C:\\Users\\Player\\AppData\\Roaming\\com.channelcraft.studio';

/** The folders inside a demo root (make-demo.mjs builds them). */
export function demoLayout(demoRoot) {
  const d = resolve(demoRoot);
  return {
    demo: d,
    retrobat: join(d, 'RetroBat'),
    home: join(d, 'Users', 'Player'),
    appData: join(d, 'AppData'),
    recycle: join(d, 'Recycle Bin'),
    cache: join(d, '.cache'),
  };
}

const lower = (p) => p.toLowerCase();
const isInside = (child, parent) => {
  const c = lower(resolve(child));
  const p = lower(resolve(parent)).replace(/[\\/]+$/, '');
  return c.length > p.length && c.startsWith(p) && (c[p.length] === '\\' || c[p.length] === '/');
};
const isAbs = (s) => /^[A-Za-z]:[\\/]/.test(s) || s.startsWith('\\\\');

export function demoBridge(demoRoot, h) {
  const L = demoLayout(demoRoot);
  if (!existsSync(join(L.retrobat, 'emulationstation', '.emulationstation', 'themes'))) {
    throw new Error(`CCS_DEMO_ROOT=${demoRoot} has no demo RetroBat yet. Run: node dev/guides/make-demo.mjs`);
  }
  // Longest first, so AppData wins over the home folder.
  const MAP = [
    [VIRTUAL_APPDATA, L.appData],
    [VIRTUAL_HOME, L.home],
    [VIRTUAL_ROOT, L.retrobat],
  ];

  const insideDemo = (p) => isInside(p, L.demo);
  const must = (p) => {
    if (!insideDemo(p)) throw new Error(`Refused: ${p} is outside the demo folder`);
    return p;
  };

  /** A virtual path from the page → the real path in the demo folder (or an error). */
  function toReal(s) {
    if (typeof s !== 'string' || !isAbs(s)) return s;
    for (const [v, r] of MAP) {
      const head = s.slice(0, v.length);
      const next = s[v.length];
      if (lower(head.replace(/\//g, '\\')) === lower(v) && (next === undefined || next === '\\' || next === '/')) {
        const real = resolve(r + s.slice(v.length));
        if (real !== resolve(r) && !isInside(real, r)) throw new Error(`Refused: ${s} leaves the demo folder`);
        return real;
      }
    }
    throw new Error(`Refused: ${s} is outside the demo RetroBat (only ${VIRTUAL_ROOT} and ${VIRTUAL_HOME} exist here)`);
  }
  /** A real path in the demo folder → what the page sees. */
  function toVirtual(s) {
    if (typeof s !== 'string' || !isAbs(s)) return s;
    for (const [v, r] of MAP) {
      if (lower(s) === lower(r)) return v;
      if (lower(s).startsWith(lower(r) + '\\') || lower(s).startsWith(lower(r) + '/')) return v + s.slice(r.length).replace(/\//g, '\\');
    }
    return s;
  }
  const deep = (f) => {
    const walk = (v) => (typeof v === 'string' ? f(v) : Array.isArray(v) ? v.map(walk) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, walk(x)])) : v);
    return walk;
  };

  // ---- small helpers mirroring src-tauri/src --------------------------------------------------

  const themesDir = () => join(L.retrobat, 'emulationstation', '.emulationstation', 'themes');
  const esHome = () => join(L.retrobat, 'emulationstation', '.emulationstation');
  const appDir = (sub) => {
    const d = must(join(L.appData, sub));
    mkdirSync(d, { recursive: true });
    return d;
  };
  const ensureWritable = (p) => {
    if (!isInside(p, themesDir())) throw `Refusing to write outside the RetroBat themes folder: ${p}`;
    must(p);
  };
  const hex = (b) => Buffer.from(b).toString('hex');
  const sha = (buf) => createHash('sha256').update(buf).digest('hex');
  const projectKey = (dir) => sha(lower(resolve(dir)).replace(/[\\/]+$/, '')).slice(0, 32);
  let counter = 0;
  const uniqueId = () => `${Date.now().toString(16)}${process.pid.toString(16)}${(counter++).toString(16)}`;
  const nowSecs = () => Math.floor(Date.now() / 1000);
  const timestamp = () => new Date().toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 15);

  function writeAtomic(p, bytes) {
    must(p);
    mkdirSync(dirname(p), { recursive: true });
    const tmp = join(dirname(p), `.${basename(p)}.${uniqueId()}.ccs-tmp`);
    try {
      writeFileSync(tmp, bytes);
      renameSync(tmp, p);
    } catch (e) {
      rmSync(tmp, { force: true });
      throw e;
    }
  }
  const copyFile = (src, dest) => {
    must(src);
    must(dest);
    mkdirSync(dirname(dest), { recursive: true });
    copyFileSync(src, dest);
  };
  const withBom = (text, bom) => Buffer.concat([bom ? Buffer.from([0xef, 0xbb, 0xbf]) : Buffer.alloc(0), Buffer.from(text, 'utf8')]);

  function safeRel(rel) {
    const bad =
      !rel ||
      rel.includes('\\') ||
      rel.includes(':') ||
      rel.startsWith('/') ||
      rel.split('/').some((part) => !part || part === '.' || part === '..' || /[. ]$/.test(part) || /[<>"|?*]/.test(part) || /[\x00-\x1f]/.test(part));
    if (bad) throw `Unsafe file path in the request: ${rel}`;
  }
  function validThemeName(name) {
    const bad = !name.trim() || /[\\/:*?"<>|]/.test(name) || name.startsWith('.') || /[ .]$/.test(name);
    if (bad) throw `"${name}" is not a valid folder name`;
  }
  function newThemePath(name) {
    validThemeName(name);
    const dest = join(themesDir(), name.trim());
    if (existsSync(dest)) throw `A theme folder named "${name.trim()}" already exists`;
    return dest;
  }

  // importing.rs: kinds, limits and content checks.
  const EXEC = 'exe dll bat cmd com scr ps1 psm1 vbs vbe js jse wsf wsh hta msi msp lnk url jar sh py reg cpl sys pif appx msix appimage love so dylib deb rpm run bin ahk'.split(' ');
  const ARCH = 'zip 7z rar gz tgz tar xz bz2'.split(' ');
  const LABEL = { xml: 'XML file', image: 'picture', font: 'font', sound: 'sound', video: 'video', text: 'text file' };
  const MAX = { image: 64 << 20, font: 32 << 20, sound: 256 << 20, video: 2 * 1024 ** 3, xml: 16 << 20, text: 16 << 20 };
  const extOf = (name) => {
    const b = name.split('/').pop();
    const i = b.lastIndexOf('.');
    return i > 0 ? b.slice(i + 1).toLowerCase() : '';
  };
  function kindOf(name) {
    const e = extOf(name);
    const base = name.split('/').pop().toUpperCase();
    if (e === 'xml') return 'xml';
    if (['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'bmp'].includes(e)) return 'image';
    if (['ttf', 'otf'].includes(e)) return 'font';
    if (['wav', 'ogg', 'mp3', 'flac'].includes(e)) return 'sound';
    if (['mp4', 'm4v', 'mov', 'mkv', 'webm', 'avi', 'mpg', 'mpeg'].includes(e)) return 'video';
    if (['glsl', 'glslp', 'txt', 'md', 'json', 'cfg', 'ini', 'csv', 'info'].includes(e)) return 'text';
    if (!e && ['LICENSE', 'LICENCE', 'README', 'COPYING', 'AUTHORS', 'CREDITS', 'OFL'].includes(base)) return 'text';
    if (EXEC.includes(e)) throw 'programs and scripts are never imported';
    if (ARCH.includes(e)) throw "archives inside a theme aren't unpacked or copied";
    if (!e) throw "files without a type aren't used by themes";
    throw `“.${e}” files aren't used by RetroBat themes`;
  }
  function checkContent(name, kind, head, size) {
    const e = extOf(name);
    const textLike = kind === 'xml' || kind === 'text' || e === 'svg';
    if (size === 0) {
      if (textLike) return;
      throw `the ${LABEL[kind]} is empty`;
    }
    const starts = (m) => head.subarray(0, m.length).equals(Buffer.from(m));
    const at = (i, m) => head.subarray(i, i + m.length).equals(Buffer.from(m));
    let ok = true;
    if (kind === 'image' && e !== 'svg') ok = starts('\x89PNG\r\n\x1a\n'.split('').map((c) => c.charCodeAt(0))) || starts([0xff, 0xd8, 0xff]) || starts('GIF87a') || starts('GIF89a') || (starts('RIFF') && at(8, 'WEBP')) || starts('BM');
    if (kind === 'font') ok = starts([0, 1, 0, 0]) || starts('true') || starts('OTTO') || starts('ttcf');
    if (kind === 'sound') ok = (starts('RIFF') && at(8, 'WAVE')) || starts('OggS') || starts('fLaC') || starts('ID3') || (head.length > 1 && head[0] === 0xff && (head[1] & 0xe0) === 0xe0);
    if (kind === 'video') ok = ['ftyp', 'moov', 'mdat', 'free', 'wide', 'skip'].some((m) => at(4, m)) || starts([0x1a, 0x45, 0xdf, 0xa3]) || (starts('RIFF') && at(8, 'AVI ')) || starts([0, 0, 1, 0xba]) || starts([0, 0, 1, 0xb3]);
    if (!ok) throw `it isn't really a ${LABEL[kind]} (its contents aren't a ${LABEL[kind]} format)`;
    if (textLike && !(starts([0xff, 0xfe]) || starts([0xfe, 0xff])) && head.includes(0)) throw `the ${e === 'svg' ? 'SVG picture' : LABEL[kind]} contains binary data`;
  }
  const readHead = (p) => readFileSync(p).subarray(0, 8192);
  function checkFile(src, want) {
    const name = basename(src);
    const st = lstatSync(src);
    if (st.isSymbolicLink() || !st.isFile()) throw `${name} is a link or folder, not a file.`;
    let kind;
    try {
      kind = kindOf(name);
    } catch (r) {
      throw `${name} can't be used: ${r}.`;
    }
    if (want && want !== kind) throw `${name} is a ${LABEL[kind]}, but a ${LABEL[want]} is needed here.`;
    if (st.size > MAX[kind]) throw `${name} is too large for a ${LABEL[kind]} (${st.size >> 20} MB; the limit is ${MAX[kind] >> 20} MB).`;
    try {
      checkContent(name, kind, readHead(src), st.size);
    } catch (r) {
      throw `${name} can't be used: ${r}.`;
    }
    return kind;
  }
  const fileHash = (p) => sha(readFileSync(p));
  /** importing.rs copy_checked: keep the name; the same file is reused, another gets -2, -3… */
  function copyChecked(src, dir) {
    const fileName = basename(src);
    const i = fileName.lastIndexOf('.');
    const [stem, ext] = i > 0 ? [fileName.slice(0, i), fileName.slice(i)] : [fileName, ''];
    let target = join(dir, fileName);
    let n = 2;
    while (existsSync(target)) {
      if (statSync(target).size === statSync(src).size && fileHash(target) === fileHash(src)) return target;
      target = join(dir, `${stem}-${n}${ext}`);
      n++;
    }
    copyFile(src, target);
    return target;
  }

  const fileKind = (p) => h.kind(p);
  const isWorkDir = (name) => name.startsWith('.channelcraft-');
  function themeFiles(dir) {
    const out = [];
    const walk = (d) => {
      for (const name of readdirSync(d)) {
        const p = join(d, name);
        const st = lstatSync(p);
        if (st.isDirectory()) {
          if (d === dir && isWorkDir(name)) continue;
          walk(p);
        } else if (st.isFile() && !name.endsWith('.ccs-tmp')) out.push([p, relative(dir, p).replace(/\\/g, '/')]);
      }
    };
    walk(dir);
    return out;
  }
  const stamp = (p) => {
    try {
      const s = statSync(p);
      return `${s.size}:${s.mtimeMs}`;
    } catch {
      return null;
    }
  };
  const relKey = (rel) => lower(rel.replace(/\\/g, '/'));
  const xmlStamps = (dir) => new Map(themeFiles(dir).filter(([p]) => fileKind(p) === 'xml').map(([p, rel]) => [relKey(rel), stamp(p)]));

  // ---- backups (storage.rs: zips with a manifest of every file's SHA-256) ---------------------

  const MANIFEST = 'channelcraft-backup.json';
  const themeName = (dir) => basename(dir) || 'theme';
  function zipTheme(src, prefix, dest, note) {
    if (isInside(dest, src)) throw 'Choose a place outside the theme folder for the zip.';
    must(dest);
    const zip = new AdmZip();
    const files = {};
    for (const [p, rel] of themeFiles(src)) {
      const data = readFileSync(p);
      zip.addFile(`${prefix}/${rel}`, data);
      files[rel] = sha(data);
    }
    if (note != null) {
      const m = { version: 1, app: 'ChannelCraft Studio', project: projectKey(src), theme: prefix, created: nowSecs(), note, prefix, files };
      zip.addFile(MANIFEST, Buffer.from(JSON.stringify(m, null, 2)));
    }
    writeAtomic(dest, zip.toBuffer());
  }
  function makeBackup(dir, note) {
    const backups = appDir('backups');
    const name = themeName(dir);
    let path = join(backups, `${name}-${timestamp()}.zip`);
    for (let n = 2; existsSync(path); n++) path = join(backups, `${name}-${timestamp()}-${n}.zip`);
    zipTheme(dir, name, path, note);
    return path;
  }
  const readManifest = (zip) => {
    try {
      return JSON.parse(zip.readAsText(MANIFEST));
    } catch {
      return null;
    }
  };

  // ---- open themes ------------------------------------------------------------------------------

  const projects = new Map();

  // ---- es_settings.cfg and retrobat.ini -------------------------------------------------------

  const escAttr = (s) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  function writeEsSettings(settings) {
    const cfg = join(esHome(), 'es_settings.cfg');
    let text = existsSync(cfg) ? readFileSync(cfg, 'utf8') : '<?xml version="1.0"?>\r\n<config>\r\n</config>\r\n';
    if (existsSync(cfg)) copyFile(cfg, cfg + '.bak');
    for (const [kind, name, value] of settings) {
      const line = `<${kind} name="${name}" value="${escAttr(value)}" />`;
      const pos = text.indexOf(`name="${name}"`);
      if (pos >= 0) {
        const start = text.lastIndexOf('<', pos);
        const end = text.indexOf('>', pos) + 1;
        text = text.slice(0, start) + line + text.slice(end);
      } else {
        const at = text.lastIndexOf('</config>');
        const eol = text.includes('\r\n') ? '\r\n' : '\n';
        text = `${text.slice(0, at)}\t${line}${eol}${text.slice(at)}`;
      }
    }
    writeAtomic(cfg, text);
  }
  function iniApply(text, section, values) {
    const eol = text.includes('\r\n') ? '\r\n' : '\n';
    const lines = text.split(eol);
    let start = -1;
    let end = lines.length;
    for (let i = 0; i < lines.length; i++) {
      const t = lines[i].trim();
      if (t.startsWith('[') && t.endsWith(']')) {
        if (start >= 0) {
          end = i;
          break;
        }
        if (lower(t.slice(1, -1).trim()) === lower(section)) start = i;
      }
    }
    if (start < 0) return `${text.replace(/[\r\n]+$/, '')}${eol}${eol}[${section}]${eol}${values.map(([k, v]) => `${k}=${v}${eol}`).join('')}`;
    const missing = [];
    for (const [k, v] of values) {
      let found = -1;
      for (let i = start + 1; i < end; i++) {
        const t = lines[i].trimStart();
        if (!t.startsWith(';') && !t.startsWith('#') && t.includes('=') && lower(t.split('=')[0].trim()) === lower(k)) found = i;
      }
      if (found >= 0) lines[found] = `${lines[found].slice(0, lines[found].indexOf('='))}=${v}`;
      else missing.push(`${k}=${v}`);
    }
    let at = end;
    while (at > start + 1 && !lines[at - 1].trim()) at--;
    lines.splice(at, 0, ...missing);
    return lines.join(eol);
  }

  // ---- the explorer panel (explorer.rs) ---------------------------------------------------------

  const THEME_DIR_FOR = { image: '_inc/images', video: '_inc/videos', sound: '_inc/sounds', font: '_inc/fonts' };
  function classify(name, size) {
    try {
      const k = kindOf(name);
      if (!THEME_DIR_FOR[k]) return ['other', "Themes can't use this kind of file"];
      if (size > MAX[k]) return [k, `Too large for a ${LABEL[k]} (${size >> 20} MB; the limit is ${MAX[k] >> 20} MB)`];
      return [k, null];
    } catch (why) {
      return ['other', `Can't be used: ${why}`];
    }
  }
  const secs = (st) => Math.floor(st.mtimeMs / 1000);
  function entryOf(p) {
    let st;
    try {
      st = lstatSync(p);
    } catch {
      return null;
    }
    const name = basename(p);
    if (st.isSymbolicLink() || name.startsWith('.') || name.endsWith('.ccs-tmp') || lower(name) === 'desktop.ini') return null;
    if (st.isDirectory()) return { name, path: p, isDir: true, kind: '', size: 0, modified: secs(st), problem: null, items: null };
    if (!st.isFile()) return null;
    const [kind, problem] = classify(name, st.size);
    return { name, path: p, isDir: false, kind, size: st.size, modified: secs(st), problem, items: null };
  }
  const natural = (a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
  const sortEntries = (v) => v.sort((a, b) => Number(b.isDir) - Number(a.isDir) || natural(a.name, b.name));
  function walkUsable(dir, visit) {
    const go = (d, depth) => {
      if (depth > 6) return;
      for (const name of readdirSync(d)) {
        const p = join(d, name);
        const e = entryOf(p);
        if (!e) continue;
        if (e.isDir) go(p, depth + 1);
        else visit(e);
      }
    };
    go(dir, 1);
  }
  function addInto(theme, paths) {
    const res = { added: [], existing: [], problems: [] };
    const relOf = (p) => relative(theme, p).replace(/\\/g, '/');
    for (const src of paths) {
      const name = basename(src);
      if (isInside(src, theme)) {
        res.existing.push(relOf(src));
        continue;
      }
      let kind;
      try {
        kind = checkFile(src);
      } catch (e) {
        res.problems.push(String(e));
        continue;
      }
      const dirRel = THEME_DIR_FOR[kind];
      if (!dirRel) {
        res.problems.push(`${name} isn't a picture, video, sound or font.`);
        continue;
      }
      const dir = join(theme, dirRel);
      const before = existsSync(join(dir, name));
      const t = copyChecked(src, dir);
      (before && basename(t) === name ? res.existing : res.added).push(relOf(t));
    }
    return res;
  }

  // ---- fonts (downloads are cached, so re-recording doesn't hit the network) ------------------

  const cacheFile = (name) => {
    mkdirSync(join(L.cache, 'net'), { recursive: true });
    return join(L.cache, 'net', name);
  };
  async function cachedFetch(url, { json = false, headers = {} } = {}) {
    const f = cacheFile(sha(url).slice(0, 24) + (json ? '.json' : '.bin'));
    if (existsSync(f)) return json ? JSON.parse(readFileSync(f, 'utf8')) : readFileSync(f);
    const r = await fetch(url, { headers });
    if (!r.ok) throw Object.assign(new Error(`HTTP ${r.status}`), { status: r.status });
    if (json) {
      const text = await r.text();
      const v = JSON.parse(text.slice(text.indexOf(text.trimStart()[0] === '[' ? '[' : '{')));
      writeFileSync(f, JSON.stringify(v));
      return v;
    }
    const buf = Buffer.from(await r.arrayBuffer());
    writeFileSync(f, buf);
    return buf;
  }

  // ---- the commands ---------------------------------------------------------------------------

  const commands = {
    // The recorder checks the id, so it never records with a server meant for another folder.
    __demo: () => ({ demo: true, root: L.retrobat, id: createHash('sha256').update(L.demo.toLowerCase()).digest('hex').slice(0, 12) }),
    detect_retrobat: () => L.retrobat,
    list_themes: () =>
      readdirSync(themesDir())
        .filter((name) => !name.startsWith('.') && existsSync(join(themesDir(), name, 'theme.xml')))
        .map((name) => {
          const p = join(themesDir(), name);
          const preview = ['preview.png', 'preview.jpg', '_inc/images/preview.png', 'screenshot.png'].map((f) => join(p, f)).find((f) => existsSync(f)) ?? null;
          return { name, path: p, preview, modified: Math.floor(statSync(join(p, 'theme.xml')).mtimeMs / 1000) };
        })
        .sort((a, b) => lower(a.name).localeCompare(lower(b.name))),
    list_fonts: () => {
      const out = [];
      walkUsable(themesDir(), (e) => {
        if (e.kind === 'font') out.push({ name: e.name.replace(/\.[^.]+$/, ''), path: e.path, source: `Theme: ${relative(themesDir(), e.path).split(/[\\/]/)[0]}` });
      });
      const winFonts = join(L.demo, 'Windows', 'Fonts');
      if (existsSync(winFonts)) for (const n of readdirSync(winFonts)) if (/\.(ttf|otf)$/i.test(n)) out.push({ name: n.replace(/\.[^.]+$/, ''), path: join(winFonts, n), source: 'Windows' });
      return out;
    },
    backups_dir: () => appDir('backups'),
    notices_path: () => {
      const p = join(L.appData, 'THIRD-PARTY-NOTICES.txt');
      if (!existsSync(p)) throw 'The licences file is missing from this copy of the app.';
      return p;
    },
    read_text_optional: ({ path }) => (existsSync(path) && insideDemo(path) && statSync(path).isFile() ? h.readText(path) : null),

    // storage.rs
    write_text: ({ path, text, bom }) => {
      ensureWritable(path);
      writeAtomic(path, withBom(text, bom));
    },
    write_binary: ({ path, base64 }) => {
      ensureWritable(path);
      writeAtomic(path, Buffer.from(base64, 'base64'));
    },
    open_project: ({ dir }) => {
      ensureWritable(join(dir, 'theme.xml'));
      projects.set(projectKey(dir), { stamps: xmlStamps(dir) });
      return { recovered: null };
    },
    close_project: ({ dir }) => {
      projects.delete(projectKey(dir));
    },
    changed_files: ({ dir }) => {
      const open = projects.get(projectKey(dir));
      if (!open) throw "This theme isn't open";
      const now = xmlStamps(dir);
      const out = [...now].filter(([k, v]) => open.stamps.get(k) !== v).map(([k]) => k);
      out.push(...[...open.stamps.keys()].filter((k) => !now.has(k)));
      return out.sort();
    },
    accept_changes: ({ dir }) => {
      const open = projects.get(projectKey(dir));
      if (!open) throw "This theme isn't open";
      open.stamps = xmlStamps(dir);
    },
    save_files: ({ dir, files, force }) => {
      for (const f of files) {
        safeRel(f.rel);
        ensureWritable(join(dir, f.rel));
      }
      const open = projects.get(projectKey(dir));
      if (!open) throw "This theme isn't open for editing. Open it again and save.";
      if (!force) {
        const changed = files.filter((f) => stamp(join(dir, f.rel)) !== (open.stamps.get(relKey(f.rel)) ?? null)).map((f) => f.rel);
        if (changed.length) throw `CHANGED_OUTSIDE:${JSON.stringify(changed)}`;
      }
      // Staged first, then swapped in (the app journals this; a demo folder doesn't need to).
      const staged = files.map((f) => (f.remove ? null : withBom(f.text, f.bom)));
      files.forEach((f, i) => {
        const target = join(dir, f.rel);
        if (f.remove) rmSync(must(target), { force: true });
        else writeAtomic(target, staged[i]);
        const s = stamp(target);
        if (s) open.stamps.set(relKey(f.rel), s);
        else open.stamps.delete(relKey(f.rel));
      });
    },
    backup_theme: ({ dir, keep, note }) => {
      const zip = makeBackup(must(dir), note ?? 'before saving');
      if (keep > 0) {
        const prefix = `${themeName(dir)}-`;
        const backups = appDir('backups');
        const mine = readdirSync(backups)
          .filter((f) => f.startsWith(prefix) && f.endsWith('.zip') && f.length === prefix.length + 19)
          .sort();
        for (const old of mine.slice(0, Math.max(0, mine.length - keep))) rmSync(join(backups, old), { force: true });
      }
      return zip;
    },
    list_backups: ({ dir }) => {
      const backups = appDir('backups');
      const name = themeName(dir);
      const key = projectKey(dir);
      const out = [];
      for (const fileName of readdirSync(backups)) {
        if (!fileName.startsWith(`${name}-`) || !lower(fileName).endsWith('.zip')) continue;
        const path = join(backups, fileName);
        const st = statSync(path);
        let zip;
        try {
          zip = new AdmZip(path);
        } catch {
          out.push({ path, fileName, created: secs(st), note: '', size: st.size, files: 0, restorable: false, problem: "This zip can't be read (it may be damaged)." });
          continue;
        }
        const m = readManifest(zip);
        if (m && m.theme === name) {
          const mine = m.project === key;
          out.push({ path, fileName, created: m.created, note: m.note, size: st.size, files: Object.keys(m.files).length, restorable: mine, problem: mine ? null : 'Made from a theme folder with the same name somewhere else.' });
        }
      }
      return out.sort((a, b) => b.created - a.created || b.fileName.localeCompare(a.fileName));
    },
    restore_backup: ({ dir, zip: zipPath }) => {
      ensureWritable(join(dir, 'theme.xml'));
      const open = projects.get(projectKey(dir));
      if (!open) throw 'Open the theme before restoring one of its backups.';
      if (!isInside(zipPath, appDir('backups'))) throw "Pick a backup from ChannelCraft's backups list.";
      const zip = new AdmZip(zipPath);
      const m = readManifest(zip);
      if (!m) throw "This zip has no ChannelCraft file check list, so it can't be restored automatically.";
      if (m.project !== projectKey(dir)) throw 'This backup belongs to a different theme folder. Open that theme to restore it.';
      const files = {};
      for (const e of zip.getEntries()) {
        if (e.entryName === MANIFEST || e.isDirectory) continue;
        const rel = e.entryName.slice(m.prefix.length + 1);
        safeRel(rel);
        const data = e.getData();
        if (m.files[rel] !== sha(data)) throw `The backup failed its integrity check (${rel} is damaged). Nothing was changed.`;
        files[rel] = data;
      }
      if (Object.keys(files).length !== Object.keys(m.files).length) throw 'The backup is incomplete: some files on its check list are missing. Nothing was changed.';
      const before = makeBackup(dir, 'before restoring a backup');
      const id = uniqueId();
      const stage = join(dirname(dir), `.channelcraft-restore-${id}`);
      const previous = join(dirname(dir), `.channelcraft-previous-${id}`);
      for (const [rel, data] of Object.entries(files)) {
        const t = must(join(stage, rel));
        mkdirSync(dirname(t), { recursive: true });
        writeFileSync(t, data);
      }
      renameSync(must(dir), must(previous));
      renameSync(stage, dir);
      rmSync(must(previous), { recursive: true, force: true });
      open.stamps = xmlStamps(dir);
      return before;
    },
    export_theme: ({ dir, dest }) => {
      if (!existsSync(join(dir, 'theme.xml'))) throw `${dir} is not a theme folder`;
      zipTheme(dir, themeName(dir), must(dest), null);
      return dest;
    },
    copy_theme: ({ src, name }) => {
      const dest = newThemePath(name);
      copyDirStaged(must(src), dest);
      return dest;
    },
    create_theme_from_starter: ({ name }) => {
      const dest = newThemePath(name);
      copyDirStaged(h.starterDir, dest, true);
      return dest;
    },
    make_theme_dirs: ({ themeDir, rels }) => {
      if (!existsSync(join(themeDir, 'theme.xml'))) throw `${themeDir} is not a theme folder`;
      let made = 0;
      for (const rel of rels) {
        safeRel(rel);
        const p = join(themeDir, rel);
        ensureWritable(join(p, 'x'));
        if (!existsSync(p)) {
          mkdirSync(p, { recursive: true });
          made++;
        }
      }
      return made;
    },
    write_report: ({ path, text }) => {
      if (extname(path).toLowerCase() !== '.csv') throw 'Reports are saved as .csv files.';
      writeAtomic(path, withBom(text, true));
    },
    write_design_file: ({ path, text }) => {
      if (extname(path).toLowerCase() !== '.ccdesign') throw 'Designs are saved as .ccdesign files.';
      if (text.length > 64 * 1024) throw 'That design is too big to save.';
      writeAtomic(path, Buffer.from(text));
    },
    existing_files: ({ paths }) => paths.map((p) => existsSync(p) && statSync(p).isFile()),
    copy_media_into_theme: ({ themeDir, src, destRelDir }) => {
      ensureWritable(join(themeDir, destRelDir, 'x'));
      safeRel(destRelDir);
      const ext = extOf(src);
      if (!['mp4', 'mkv', 'webm', 'avi', 'png', 'jpg', 'jpeg', 'webp', 'gif', 'svg'].includes(ext)) throw `${src} is not a picture or video RetroBat can show`;
      const rel = `${destRelDir}/${fileHash(must(src)).slice(0, 32)}.${ext}`;
      const target = join(themeDir, rel);
      if (!existsSync(target)) copyFile(src, target);
      return rel;
    },
    copy_sound_into_theme: ({ themeDir, src, destRelDir }) => {
      ensureWritable(join(themeDir, destRelDir, 'x'));
      safeRel(destRelDir);
      const ext = extOf(src);
      if (!['mp3', 'ogg', 'wav', 'flac', 'mod', 'xm', 's3m', 'it'].includes(ext)) throw `${src} isn't a sound RetroBat can play (mp3, ogg, wav or flac)`;
      let stem = basename(src).replace(/\.[^.]+$/, '').replace(/[^\p{L}\p{N} \-_()'.,&]/gu, '_').trim().replace(/^\.+|\.+$/g, '').slice(0, 80) || 'music';
      for (let i = 1; i < 1000; i++) {
        const rel = `${destRelDir}/${i === 1 ? stem : `${stem} (${i})`}.${ext}`;
        const target = join(themeDir, rel);
        if (existsSync(target)) {
          if (readFileSync(target).equals(readFileSync(must(src)))) return rel;
          continue;
        }
        copyFile(src, target);
        return rel;
      }
      throw 'Too many files with that name';
    },

    // commands.rs
    copy_folder_into_theme: ({ src, themeDir, destRel }) => {
      if (!isInside(src, themesDir())) throw 'Art can only be copied from installed themes';
      const dest = join(themeDir, destRel);
      ensureWritable(dest);
      mkdirSync(dest, { recursive: true });
      let n = 0;
      for (const name of readdirSync(src)) {
        const p = join(src, name);
        if (!statSync(p).isFile()) continue;
        const target = join(dest, name);
        try {
          if (!existsSync(target)) {
            checkFile(p);
            copyFile(p, target);
            n++;
          }
        } catch {
          // Not a real picture: it stays behind.
        }
      }
      return n;
    },
    save_recovery: ({ key, data }) => writeAtomic(join(appDir('recovery'), `${key.replace(/[^A-Za-z0-9_-]/g, '_')}.json`), data),
    load_recovery: ({ key }) => {
      const p = join(appDir('recovery'), `${key.replace(/[^A-Za-z0-9_-]/g, '_')}.json`);
      return existsSync(p) ? readFileSync(p, 'utf8') : null;
    },
    clear_recovery: ({ key }) => {
      rmSync(join(appDir('recovery'), `${key.replace(/[^A-Za-z0-9_-]/g, '_')}.json`), { force: true });
    },
    add_font_to_theme: ({ themeDir, src }) => {
      const target = join(themeDir, '_inc', 'fonts', basename(src));
      ensureWritable(target);
      checkFile(must(src), 'font');
      if (!existsSync(target)) copyFile(src, target);
      return `_inc/fonts/${basename(src)}`;
    },
    download_font: async ({ themeDir, url, fileName }) => {
      const ALLOWED = 'https://raw.githubusercontent.com/google/fonts/main/';
      if (!url.startsWith(ALLOWED) || /[\\/:]/.test(fileName)) throw 'Fonts can only be downloaded from the Google Fonts repository';
      const target = join(themeDir, '_inc', 'fonts', fileName);
      ensureWritable(target);
      const dirUrl = url.slice(0, url.lastIndexOf('/'));
      const family = dirUrl.split('/').pop() || 'font';
      const licence = join(dirname(target), `${family}-OFL.txt`);
      if (!existsSync(target)) {
        let bytes;
        try {
          bytes = await cachedFetch(url);
        } catch (e) {
          throw `Download failed: ${e.message ?? e}`;
        }
        try {
          checkContent(fileName, 'font', bytes.subarray(0, 8192), bytes.length);
        } catch (r) {
          throw `The download isn't a usable font: ${r}.`;
        }
        if (!existsSync(licence)) {
          const ofl = (await cachedFetch(`${dirUrl}/OFL.txt`)).toString('utf8');
          if (!ofl.toUpperCase().includes('SIL OPEN FONT LICENSE')) throw "The font's licence file isn't the Open Font License, so the font wasn't added.";
          writeAtomic(licence, ofl);
        }
        writeAtomic(target, bytes);
      }
      return `_inc/fonts/${fileName}`;
    },
    google_fonts: async () => {
      try {
        const v = await cachedFetch('https://fonts.google.com/metadata/fonts', { json: true });
        return (v.familyMetadataList ?? []).map((f) => ({ family: f.family, category: f.category ?? '' }));
      } catch (e) {
        throw `The Google Fonts list couldn't be downloaded (${e.message ?? e})`;
      }
    },
    google_font_file: async ({ family }) => {
      const dir = family.replace(/[^A-Za-z0-9]/g, '').toLowerCase();
      if (!dir) throw 'No such font';
      let v;
      try {
        v = await cachedFetch(`https://api.github.com/repos/google/fonts/contents/ofl/${dir}`, { json: true, headers: { 'User-Agent': 'ChannelCraft-Studio', Accept: 'application/vnd.github+json' } });
      } catch (e) {
        throw e.status === 404 ? `“${family}” isn't under the Open Font License in Google Fonts, so it can't be added to a shareable theme.` : `Google Fonts couldn't be reached (${e.message ?? e})`;
      }
      const files = v.filter((f) => lower(f.name).endsWith('.ttf')).map((f) => [f.name, f.download_url]);
      const upright = (n) => !lower(n).includes('italic');
      const pick = files.find(([n]) => n.endsWith('-Regular.ttf')) ?? files.find(([n]) => n.includes('[') && upright(n)) ?? files.find(([n]) => upright(n)) ?? files[0];
      if (!pick) throw `No font file found for “${family}”`;
      return { url: pick[1], file_name: pick[0].replace(/[[\],]/g, '_') };
    },
    import_asset: ({ themeDir, src, destRelDir }) => {
      const want = { '_inc/images': 'image', '_inc/fonts': 'font', '_inc/sounds': 'sound', '_inc/videos': 'video' }[destRelDir];
      checkFile(must(src), want);
      const dir = join(themeDir, destRelDir);
      ensureWritable(join(dir, 'x'));
      return relative(themeDir, copyChecked(src, dir)).replace(/\\/g, '/');
    },
    delete_theme: ({ dir }) => {
      const themes = themesDir();
      if (!isInside(dir, themes) || lower(resolve(dirname(dir))) !== lower(resolve(themes)) || !existsSync(join(dir, 'theme.xml'))) throw `${dir} is not a theme folder`;
      const name = basename(dir);
      if (lower(h.activeTheme() ?? '') === lower(name)) throw `"${name}" is the theme RetroBat is using. Pick another theme in RetroBat (or use “Use in RetroBat” on another one) before deleting it.`;
      // The demo's own "Recycle Bin".
      mkdirSync(L.recycle, { recursive: true });
      renameSync(dir, must(join(L.recycle, `${name} (${uniqueId()})`)));
    },
    set_active_theme: ({ theme }) => {
      if (!existsSync(join(themesDir(), theme, 'theme.xml'))) throw `Theme "${theme}" not found`;
      writeEsSettings([['string', 'ThemeSet', theme]]);
    },
    enable_theme_music: () =>
      writeEsSettings([
        ['bool', 'audio.bgmusic', 'true'],
        ['bool', 'audio.thememusics', 'true'],
      ]),
    // There is no real RetroBat to start; the page carries on as if it started.
    launch_retrobat: () => {
      console.log('[demo] launch_retrobat (nothing is started in the demo)');
    },
    retrobat_running: () => false,
    close_retrobat: () => null,

    // intro.rs
    write_intro: ({ settings: s }) => {
      if (/[\\/:"]/.test(s.fileName) || !s.fileName.trim()) throw 'The video must be a file name in the video folder';
      if (s.filePath.includes('"') || (lower(s.filePath) !== 'default' && !(insideDemo(s.filePath) && existsSync(s.filePath)))) throw `The video folder ${s.filePath} doesn't exist`;
      if (s.videoDelay > 60000) throw 'The delay can be at most 60 seconds';
      const ini = join(L.retrobat, 'retrobat.ini');
      const cur = existsSync(ini) ? readFileSync(ini, 'utf8') : '';
      const backup = join(L.retrobat, 'retrobat.ini.channelcraft-backup');
      if (existsSync(ini) && !existsSync(backup)) copyFile(ini, backup);
      const b = (v) => (v ? '1' : '0');
      const text = iniApply(cur, 'SplashScreen', [
        ['EnableIntro', b(s.enableIntro)],
        ['FileName', `"${s.fileName}"`],
        ['FilePath', `"${s.filePath}"`],
        ['RandomVideo', b(s.randomVideo)],
        ['VideoDelay', String(s.videoDelay)],
        ['WaitForVideoEnd', b(s.waitForVideoEnd)],
        ['KillVideoWhenESReady', b(s.killVideoWhenEsReady)],
        ['GamepadVideoKill', b(s.gamepadVideoKill)],
      ]);
      writeAtomic(ini, text);
      return h.commands.read_intro();
    },

    // importing.rs
    inspect_theme_import: ({ source }) => importPlan(source).plan,
    import_theme: ({ source, name }) => {
      const dest = newThemePath(name);
      const { keep } = importPlan(source);
      const stage = join(themesDir(), `.channelcraft-import-${uniqueId()}`);
      try {
        for (const [rel, read] of keep) {
          const t = must(join(stage, rel));
          mkdirSync(dirname(t), { recursive: true });
          writeFileSync(t, read());
        }
        if (existsSync(dest)) throw `${dest} already exists. Nothing was imported.`;
        renameSync(stage, dest);
      } finally {
        if (existsSync(stage)) rmSync(stage, { recursive: true, force: true });
      }
      return dest;
    },

    // assets.rs
    asset_library_dir: () => appDir('assets'),
    list_library_assets: () => {
      const dir = appDir('assets');
      const out = [];
      walkUsable(dir, (e) => {
        if (THEME_DIR_FOR[e.kind]) out.push({ path: e.path, rel: relative(dir, e.path).replace(/\\/g, '/'), kind: e.kind, size: e.size, modified: e.modified });
      });
      return out.sort((a, b) => lower(a.rel).localeCompare(lower(b.rel)));
    },
    add_library_assets: ({ paths }) => {
      const dir = appDir('assets');
      const res = { added: [], existing: [], problems: [] };
      for (const src of paths) {
        if (isInside(src, dir)) {
          res.existing.push(src);
          continue;
        }
        let kind;
        try {
          kind = checkFile(src);
        } catch (e) {
          res.problems.push(String(e));
          continue;
        }
        if (!THEME_DIR_FOR[kind]) {
          res.problems.push(`${basename(src)} isn't a picture, video, sound or font.`);
          continue;
        }
        const into = join(dir, `${kind}s`);
        const before = existsSync(join(into, basename(src)));
        const t = copyChecked(src, into);
        (before && basename(t) === basename(src) ? res.existing : res.added).push(t);
      }
      return res;
    },
    remove_library_asset: ({ path }) => {
      if (!isInside(path, appDir('assets')) || !existsSync(path)) throw `${path} is not in the asset library`;
      mkdirSync(L.recycle, { recursive: true });
      renameSync(path, must(join(L.recycle, `${uniqueId()}-${basename(path)}`)));
    },

    // explorer.rs
    explorer_list: ({ path }) => {
      if (!existsSync(path) || !statSync(path).isDirectory()) throw `${path} is not a folder`;
      const entries = sortEntries(readdirSync(path).map((n) => entryOf(join(path, n))).filter(Boolean));
      for (const e of entries) if (e.isDir) e.items = Math.min(readdirSync(e.path).length, 101);
      const parent = dirname(path);
      return { path, parent: parent !== path && insideDemo(parent) && parent !== L.demo && lower(parent) !== lower(join(L.demo, 'Users')) ? parent : null, entries, total: entries.length, truncated: false };
    },
    explorer_search: ({ path, query }) => {
      const q = lower(query.trim());
      const out = [];
      if (q) walkUsable(path, (e) => lower(e.name).includes(q) && out.push(e));
      return { entries: sortEntries(out), truncated: false };
    },
    explorer_folder_files: ({ path }) => {
      if (!existsSync(path) || !statSync(path).isDirectory()) throw `${path} is not a folder`;
      const files = [];
      walkUsable(path, (e) => !e.problem && files.push({ path: e.path, size: e.size }));
      return { files: files.sort((a, b) => natural(a.path, b.path)), truncated: false };
    },
    explorer_places: () => {
      const out = [];
      for (const name of ['Desktop', 'Downloads', 'Pictures', 'Videos', 'Music', 'Documents']) {
        const d = join(L.home, name);
        if (existsSync(d)) out.push({ name, path: d, group: 'place', detail: '' });
      }
      const root = L.retrobat;
      out.push({ name: 'RetroBat folder', path: root, group: 'retrobat', detail: toVirtual(root) });
      if (existsSync(join(root, 'roms'))) out.push({ name: 'Games and their art', path: join(root, 'roms'), group: 'retrobat', detail: 'roms: box art, logos, videos' });
      const n = readdirSync(themesDir()).filter((t) => existsSync(join(themesDir(), t, 'theme.xml'))).length;
      out.push({ name: 'Installed themes', path: themesDir(), group: 'retrobat', detail: `${n} installed` });
      return out;
    },
    explorer_add_to_theme: ({ themeDir, paths }) => {
      if (!existsSync(join(themeDir, 'theme.xml'))) throw `${themeDir} is not a theme folder`;
      ensureWritable(join(themeDir, 'theme.xml'));
      return addInto(themeDir, paths);
    },

    // problems.rs
    log_problem: ({ text }) => {
      mkdirSync(L.appData, { recursive: true });
      appendFileSync(must(join(L.appData, 'problems.log')), `[${new Date().toISOString()}] ${text}\n`);
      console.warn('[demo] problem logged:', text.slice(0, 300));
    },
    read_problem_log: () => {
      const p = join(L.appData, 'problems.log');
      return existsSync(p) ? readFileSync(p, 'utf8').slice(-64 * 1024) : '';
    },
    problem_log_path: () => join(L.appData, 'problems.log'),
    clear_problem_log: () => {
      rmSync(join(L.appData, 'problems.log'), { force: true });
    },
  };

  function copyDirStaged(src, dest, plain = false) {
    const stage = must(join(dirname(dest), `.channelcraft-copy-${uniqueId()}`));
    try {
      mkdirSync(stage, { recursive: true });
      const walk = (d) => {
        for (const name of readdirSync(d)) {
          const p = join(d, name);
          const st = lstatSync(p);
          const rel = relative(src, p);
          if (st.isDirectory()) {
            if (d === src && isWorkDir(name)) continue;
            mkdirSync(join(stage, rel), { recursive: true });
            walk(p);
          } else if (st.isFile() && !name.endsWith('.ccs-tmp')) {
            if (plain) {
              mkdirSync(dirname(join(stage, rel)), { recursive: true });
              copyFileSync(p, join(stage, rel));
            } else copyFile(p, join(stage, rel));
          }
        }
      };
      walk(src);
      if (existsSync(dest)) throw `${dest} already exists`;
      renameSync(stage, dest);
    } finally {
      if (existsSync(stage)) rmSync(stage, { recursive: true, force: true });
    }
  }

  /** importing.rs plan(): the shallowest folder with a theme.xml, and every file that passes. */
  function importPlan(source) {
    must(source);
    if (isInside(themesDir(), source) || lower(resolve(source)) === lower(resolve(themesDir()))) throw "Pick one theme, not a folder that holds RetroBat's themes folder.";
    const st = lstatSync(source);
    let entries;
    let outer;
    if (st.isDirectory()) {
      outer = basename(source);
      entries = themeFiles(source).map(([p, rel]) => ({ rel, size: statSync(p).size, read: () => readFileSync(p) }));
    } else {
      if (extname(source).toLowerCase() !== '.zip') throw 'Pick a theme folder or a .zip file.';
      outer = basename(source, extname(source));
      let zip;
      try {
        zip = new AdmZip(source);
      } catch (e) {
        throw `This zip can't be read (${e.message ?? e}). It may be damaged or not a zip file.`;
      }
      entries = zip
        .getEntries()
        .filter((e) => !e.isDirectory)
        .map((e) => {
          const rel = e.entryName.replace(/\\/g, '/');
          safeRel(rel);
          return { rel, size: e.header.size, read: () => e.getData() };
        });
    }
    const clutter = (rel) => rel.split('/').some((p) => ['__macosx', '.git', '.svn', '.github', '.ds_store', 'thumbs.db', 'desktop.ini'].includes(lower(p)) || p.startsWith('._') || p.startsWith('.channelcraft-') || lower(p).endsWith('.ccs-tmp'));
    entries = entries.filter((e) => !clutter(e.rel));
    const roots = entries.filter((e) => lower(e.rel.split('/').pop()) === 'theme.xml').map((e) => (e.rel.includes('/') ? e.rel.slice(0, e.rel.lastIndexOf('/')) : ''));
    if (!roots.length) throw "There's no theme.xml in here, so it isn't a RetroBat theme.";
    const depth = (d) => (d ? d.split('/').length : 0);
    const min = Math.min(...roots.map(depth));
    const top = roots.filter((d) => depth(d) === min);
    if (top.length > 1) throw `This holds ${top.length} themes (${top.join(', ')}). Import them one at a time.`;
    const root = top[0];
    const prefix = root ? `${root}/` : '';
    const keep = [];
    const skipped = [];
    let outside = 0;
    let bytes = 0;
    for (const e of entries) {
      if (!e.rel.startsWith(prefix)) {
        outside++;
        continue;
      }
      const rel = e.rel.slice(prefix.length);
      let kind;
      try {
        kind = kindOf(rel);
        checkContent(rel, kind, e.read().subarray(0, 8192), e.size);
      } catch (reason) {
        skipped.push({ path: rel, reason: String(reason) });
        continue;
      }
      bytes += e.size;
      keep.push([rel, e.read]);
    }
    let base = (root ? root.split('/').pop() : outer).replace(/[\\/:*?"<>|\x00-\x1f]/g, ' ');
    for (const s of ['-master', '-main', '_master', '_main']) if (lower(base).endsWith(s)) base = base.slice(0, -s.length);
    base = base.trim().replace(/^\.+/, '').replace(/[. ]+$/, '') || 'Imported theme';
    let suggestedName = base;
    for (let i = 2; existsSync(join(themesDir(), suggestedName)); i++) suggestedName = `${base} (${i})`;
    return { plan: { suggestedName, root, files: keep.length, bytes, skipped, outside, hasSplash: keep.some(([r]) => lower(r) === 'splash.xml') }, keep };
  }

  return {
    layout: L,
    commands,
    insideDemo,
    toRealArgs: deep(toReal),
    toVirtualValue: deep(toVirtual),
    toReal,
    /** [real, virtual] folder pairs, for turning real paths in messages into what the page sees. */
    virtualPairs: MAP.map(([v, r]) => [r, v]),
  };
}
