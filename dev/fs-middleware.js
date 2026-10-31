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
  // Where Publish to the gallery goes in the browser preview (VITE_GALLERY_SITE, e.g. a local website dev server).
  let gallerySite = '';
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
    // Like src-tauri/src/gallery.rs: the theme zipped in memory (nothing is written) and sent to VITE_GALLERY_SITE.
    // Console art the same as another theme's is left out (the art folders are guessed by name here), files
    // Import would refuse are left out and listed, media is stored, and text deflated within the server's limits.
    publish_theme: async ({ dir, name, maker }) => {
      const site = gallerySite.trim().replace(/\/+$/, '');
      if (!site) throw 'In the browser preview, publishing needs VITE_GALLERY_SITE set to a website dev server (e.g. http://localhost:5173). Set it and restart pnpm dev.';
      const themes = demo ? join(demo.layout.retrobat, 'emulationstation', '.emulationstation', 'themes') : themesDir();
      if (!inside(dir) || !resolve(dir).toLowerCase().startsWith(resolve(themes).toLowerCase() + '\\')) throw "Only themes in RetroBat's themes folder can be published.";
      if (!existsSync(join(dir, 'theme.xml'))) throw `${dir} is not a theme folder`;
      const { default: AdmZip } = await import('adm-zip');
      const zip = new AdmZip();
      const prefix = basename(dir);
      // The other themes' art folders, by kind.
      const words = { logos: ['logo', 'wheel', 'marquee'], consoles: ['console', 'device', 'controller', 'hardware'] };
      const others = readdirSync(themes)
        .map((n) => join(themes, n))
        .filter((t) => !basename(t).startsWith('.') && resolve(t).toLowerCase() !== resolve(dir).toLowerCase() && existsSync(join(t, 'theme.xml')));
      const artDirs = { logos: new Set(), consoles: new Set() };
      for (const t of others)
        for (const p of walk(t)) {
          const d = resolve(p, '..');
          const folder = basename(d).toLowerCase();
          for (const f of ['logos', 'consoles']) if (words[f].some((w) => folder.includes(w))) artDirs[f].add(d);
        }
      const same = (f, p) => {
        const size = statSync(p).size;
        for (const d of artDirs[f]) {
          const o = join(d, basename(p));
          if (existsSync(o) && statSync(o).size === size && readFileSync(o).equals(readFileSync(p))) return true;
        }
        return false;
      };
      const allowed = /\.(xml|png|jpe?g|gif|svg|webp|bmp|ttf|otf|wav|ogg|mp3|flac|mp4|m4v|mov|mkv|webm|avi|mpe?g|glslp?|txt|md|json|cfg|ini|csv|info)$/i;
      const bare = /(^|\/)(LICEN[CS]E|README|COPYING|AUTHORS|CREDITS|OFL)$/i;
      const text = /\.(xml|glslp?|txt|md|json|cfg|ini|csv|info)$/i;
      const clutter = (rel) => rel.split('/').some((p) => ['__macosx', '.git', '.svn', '.github', '.ds_store', 'thumbs.db', 'desktop.ini'].includes(p.toLowerCase()) || p.startsWith('._') || p.startsWith('.channelcraft-'));
      // The server's limits on deflated files (channelcraft-website/src/lib/server/gallery/check.ts), the manifest's share kept back.
      let packed = 1;
      let total = 200;
      const left = new Set();
      const leftOut = [];
      for (const p of walk(dir)) {
        const rel = relative(dir, p).replace(/\\/g, '/');
        if (clutter(rel) || rel.endsWith('.ccs-tmp') || rel.toLowerCase() === 'channelcraft.json') continue;
        const art = /^_inc\/systems\/(logos|consoles)\/[^/]+$/i.exec(rel);
        if (art && same(art[1].toLowerCase(), p)) {
          left.add(art[1].toLowerCase());
          continue;
        }
        if (!allowed.test(rel) && !bare.test(rel)) {
          leftOut.push(rel);
          continue;
        }
        const data = readFileSync(p);
        zip.addFile(`${prefix}/${rel}`, data);
        const deflate = (text.test(rel) || bare.test(rel)) && data.length <= 1048576 && packed < 200 && total + data.length <= 1048576;
        if (deflate) {
          packed++;
          total += data.length;
        } else zip.getEntry(`${prefix}/${rel}`).header.method = 0;
      }
      leftOut.sort();
      const folders = ['logos', 'consoles'].filter((f) => left.has(f));
      if (folders.length) zip.addFile(`${prefix}/channelcraft.json`, Buffer.from(JSON.stringify({ gallery: 1, systemArtLeftOut: '_inc/systems', folders })));
      const form = new FormData();
      form.append('name', String(name ?? '').trim());
      form.append('maker', String(maker ?? '').trim());
      form.append('app', 'dev');
      form.append('theme', new Blob([zip.toBuffer()], { type: 'application/zip' }), `${prefix}.zip`);
      let res;
      try {
        res = await fetch(`${site}/api/gallery/publish`, { method: 'POST', body: form, signal: AbortSignal.timeout(120000) });
      } catch {
        throw "Couldn't reach the gallery. Check your internet connection and try again.";
      }
      const data = await res.json().catch(() => null);
      if (res.ok && data?.slug && data?.url) return { slug: data.slug, url: data.url, leftOut };
      throw data?.error || `The gallery turned the theme down (error ${res.status}).`;
    },
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
      gallerySite = server.config.env?.VITE_GALLERY_SITE || process.env.VITE_GALLERY_SITE || '';
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
            } else res.end(JSON.stringify({ ok: true, value: (await fn(body ? JSON.parse(body) : {})) ?? null }));
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
