// @ts-nocheck — plain dev-server JS, not part of the app bundle.
// Development only: a read-only stand-in for the Rust commands, so the UI can run in a plain
// browser (`pnpm dev`) against real themes. It never writes anything; write commands fail.
// The one exception is demo mode (CCS_DEMO_ROOT set, for recording the website's how-to clips):
// then dev/demo-bridge.js adds the write commands, confined to that demo folder.
import { existsSync, readdirSync, readFileSync, statSync, createReadStream } from 'node:fs';
import { join, relative, resolve, extname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const MIME = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.ogg': 'audio/ogg',
  '.wav': 'audio/wav',
  '.mp3': 'audio/mpeg',
  '.flac': 'audio/flac',
};

function kind(p) {
  const e = extname(p).toLowerCase().slice(1);
  if (e === 'xml') return 'xml';
  if (['png', 'jpg', 'jpeg', 'svg', 'gif', 'webp', 'bmp'].includes(e)) return 'image';
  if (['ttf', 'otf'].includes(e)) return 'font';
  if (['mp4', 'webm', 'mkv', 'avi'].includes(e)) return 'video';
  if (['ogg', 'wav', 'mp3', 'flac'].includes(e)) return 'sound';
  if (e === 'glsl') return 'shader';
  return 'other';
}

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

function readText(p) {
  const buf = readFileSync(p);
  const bom = buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf;
  return { path: p, text: buf.subarray(bom ? 3 : 0).toString('utf8'), bom };
}

export function devFs() {
  let root = null;
  // Demo mode: set up in configureServer, only when CCS_DEMO_ROOT is set (see dev/guides/README.md).
  let demo = null;
  const esHome = () => join(root, 'emulationstation', '.emulationstation');
  const themesDir = () => join(esHome(), 'themes');
  const inside = (p) => (demo ? demo.insideDemo(p) : root && resolve(p).toLowerCase().startsWith(resolve(root).toLowerCase() + '\\'));
  const activeTheme = () => {
    try {
      const m = readFileSync(join(esHome(), 'es_settings.cfg'), 'utf8').match(/name="ThemeSet" value="([^"]*)"/);
      return m ? m[1] : null;
    } catch {
      return null;
    }
  };
  // The same RetroBat settings the app reads (see es_settings in src-tauri/src/commands.rs).
  const esSettings = () => {
    let cfg = '';
    try {
      cfg = readFileSync(join(esHome(), 'es_settings.cfg'), 'utf8');
    } catch {}
    const get = (n) => cfg.match(new RegExp(`name="${n}" value="([^"]*)"`))?.[1];
    const es = { clock12: get('ClockMode12') === 'true', drawClock: get('DrawClock') !== 'false', transitionStyle: get('TransitionStyle') || 'auto', powerSaver: get('PowerSaverMode') || 'disabled' };
    // The demo answers like the app does (commands.rs es_settings), music settings included.
    if (demo) Object.assign(es, { music: get('audio.bgmusic') !== 'false', themeMusic: get('audio.thememusics') !== 'false' });
    return es;
  };
  const rootInfo = () => ({ root, themesDir: themesDir(), esHome: esHome(), resourcesDir: join(root, 'emulationstation', 'resources'), activeTheme: activeTheme(), es: esSettings() });
  const guard = (p) => {
    if (!inside(p)) throw new Error(`Outside the RetroBat folder: ${p}`);
    return p;
  };

  const commands = {
    detect_retrobat: () => {
      for (let c = 67; c <= 90; c++) {
        const p = `${String.fromCharCode(c)}:\\RetroBat`;
        if (existsSync(join(p, 'emulationstation', '.emulationstation', 'themes'))) return p;
      }
      return null;
    },
    set_retrobat_root: ({ path }) => {
      if (!existsSync(join(path, 'emulationstation', '.emulationstation', 'themes'))) throw new Error(`No themes folder in ${path}`);
      root = path;
      return rootInfo();
    },
    root_status: () => rootInfo(),
    list_themes: () =>
      readdirSync(themesDir())
        .map((name) => join(themesDir(), name))
        .filter((p) => existsSync(join(p, 'theme.xml')))
        .map((p) => {
          const preview = ['preview.png', 'preview.jpg', '_inc/images/preview.png', 'screenshot.png'].map((f) => join(p, f)).find((f) => existsSync(f)) ?? null;
          return { name: basename(p), path: p, preview, modified: 0 };
        })
        .sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase())),
    list_theme_files: ({ dir }) => walk(guard(dir)).map((p) => ({ rel: relative(dir, p).replace(/\\/g, '/'), kind: kind(p), size: statSync(p).size })),
    read_theme_xml: ({ dir }) => walk(guard(dir)).filter((p) => kind(p) === 'xml').map(readText),
    // Read-only: retrobat.ini's [SplashScreen] section and the videos it can play.
    read_intro: () => {
      const ini = join(root, 'retrobat.ini');
      const text = existsSync(ini) ? readFileSync(ini, 'utf8') : '';
      const vals = {};
      let inside = false;
      for (const line of text.split(/\r?\n/)) {
        const t = line.trim();
        if (t.startsWith('[') && t.endsWith(']')) inside = t.slice(1, -1).trim().toLowerCase() === 'splashscreen';
        else if (inside && t && !t.startsWith(';') && t.includes('=')) {
          const i = t.indexOf('=');
          vals[t.slice(0, i).trim().toLowerCase()] = t.slice(i + 1).trim().replace(/^"(.*)"$/, '$1');
        }
      }
      const flag = (k, d) => (k in vals ? vals[k] === '1' || vals[k].toLowerCase() === 'true' : d);
      const settings = {
        enableIntro: flag('enableintro', true),
        fileName: vals.filename ?? 'retrobat-neon.mp4',
        filePath: vals.filepath || 'default',
        randomVideo: flag('randomvideo', false),
        videoDelay: Number(vals.videodelay ?? 1000) || 0,
        waitForVideoEnd: flag('waitforvideoend', true),
        killVideoWhenEsReady: flag('killvideowhenesready', false),
        gamepadVideoKill: flag('gamepadvideokill', true),
      };
      const folder = settings.filePath.toLowerCase() === 'default' ? join(esHome(), 'video') : settings.filePath;
      const videos = existsSync(folder)
        ? readdirSync(folder)
            .filter((n) => /\.(mp4|mkv|avi|webm|mov|wmv)$/i.test(n))
            .sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()))
            .map((name) => ({ name, path: join(folder, name), size: statSync(join(folder, name)).size }))
        : [];
      return { settings, found: !!text, folder, videos };
    },
    load_theme: ({ dir }) => {
      const files = walk(guard(dir));
      return {
        entries: files.map((p) => ({ rel: relative(dir, p).replace(/\\/g, '/'), kind: kind(p), size: statSync(p).size })),
        xml: files.filter((p) => kind(p) === 'xml').map(readText),
      };
    },
    read_text: ({ path }) => readText(guard(path)),
    read_text_optional: ({ path }) => (existsSync(path) && inside(path) ? readText(path) : null),
    read_themesettings: ({ theme }) => {
      const p = join(esHome(), 'themesettings', `${theme}.cfg`);
      return existsSync(p) ? readFileSync(p, 'utf8') : '';
    },
    backups_dir: () => '(browser preview)',
    // Saving is the app's job; the browser preview only reads.
    open_project: () => ({ recovered: null }),
    close_project: () => null,
    changed_files: () => [],
    accept_changes: () => null,
    list_backups: () => [],
    existing_files: ({ paths }) => paths.map((p) => existsSync(p)),
    copy_media_into_theme: () => {
      throw 'The browser preview is read-only: copying videos and covers works in the app.';
    },
    load_recovery: () => null,
    save_recovery: () => null,
    clear_recovery: () => null,
    list_gamelists: () =>
      readdirSync(join(root, 'roms'))
        .filter((s) => existsSync(join(root, 'roms', s, 'gamelist.xml')))
        .sort(),
    read_gamelist: ({ system }) => {
      const p = join(root, 'roms', system, 'gamelist.xml');
      return existsSync(p) ? readText(p) : null;
    },
    list_fonts: () =>
      walk(themesDir())
        .filter((p) => /\.(ttf|otf)$/i.test(p))
        .map((p) => ({ name: basename(p).replace(/\.[^.]+$/, ''), path: p, source: `Theme: ${relative(themesDir(), p).split(/[\\/]/)[0]}` })),
  };

  // Real demo paths in error messages are shown as the page sees them (C:\RetroBat...).
  const virtualText = (text) => {
    if (!demo) return text;
    let t = String(text);
    for (const [r, v] of demo.virtualPairs) t = t.split(r).join(v);
    return t;
  };

  return {
    name: 'channelcraft-dev-fs',
    apply: 'serve',
    async configureServer(server) {
      if (process.env.CCS_DEMO_ROOT) {
        // Loaded only in demo mode, so the normal dev bridge stays exactly as it was.
        const { demoBridge } = await import('./demo-bridge.js');
        demo = demoBridge(process.env.CCS_DEMO_ROOT, {
          kind,
          readText,
          activeTheme,
          commands,
          starterDir: fileURLToPath(new URL('../src-tauri/resources/starter-theme', import.meta.url)),
        });
        Object.assign(commands, demo.commands);
        server.config.logger.info(`
  ChannelCraft demo mode: writes go only to ${demo.layout.demo}
`);
      }
      server.middlewares.use(async (req, res, next) => {
        const url = new URL(req.url, 'http://localhost');
        if (url.pathname === '/__dev/file') {
          let p = url.searchParams.get('path') ?? '';
          if (demo) {
            try {
              p = demo.toReal(p);
            } catch {
              p = '';
            }
          }
          if (!p || !inside(p) || !existsSync(p)) {
            res.statusCode = 404;
            return res.end();
          }
          res.setHeader('Content-Type', MIME[extname(p).toLowerCase()] ?? 'application/octet-stream');
          return createReadStream(p).pipe(res);
        }
        if (url.pathname.startsWith('/__dev/cmd/') && req.method === 'POST') {
          const cmd = url.pathname.slice('/__dev/cmd/'.length);
          let body = '';
          for await (const chunk of req) body += chunk;
          res.setHeader('Content-Type', 'application/json');
          try {
            const fn = commands[cmd];
            if (!fn) throw new Error(`Browser preview is read-only: "${cmd}" is only available in the desktop app`);
            if (demo) {
              const value = await fn(demo.toRealArgs(body ? JSON.parse(body) : {}));
              res.end(JSON.stringify({ ok: true, value: demo.toVirtualValue(value ?? null) }));
            } else res.end(JSON.stringify({ ok: true, value: fn(body ? JSON.parse(body) : {}) ?? null }));
          } catch (e) {
            res.end(JSON.stringify({ ok: false, error: virtualText(String(e?.message ?? e)) }));
            if (demo) console.warn(`[demo] ${cmd} failed:`, virtualText(String(e?.message ?? e)));
          }
          return;
        }
        next();
      });
    },
  };
}
