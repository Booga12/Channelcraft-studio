// @ts-nocheck — plain dev-server JS, not part of the app bundle.
// Development only: a read-only stand-in for the Rust commands, so the UI can run in a plain
// browser (`pnpm dev`) against real themes. It never writes anything; write commands fail.
import { existsSync, readdirSync, readFileSync, statSync, createReadStream } from 'node:fs';
import { join, relative, resolve, extname, basename } from 'node:path';

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
  const esHome = () => join(root, 'emulationstation', '.emulationstation');
  const themesDir = () => join(esHome(), 'themes');
  const inside = (p) => root && resolve(p).toLowerCase().startsWith(resolve(root).toLowerCase() + '\\');
  const activeTheme = () => {
    try {
      const m = readFileSync(join(esHome(), 'es_settings.cfg'), 'utf8').match(/name="ThemeSet" value="([^"]*)"/);
      return m ? m[1] : null;
    } catch {
      return null;
    }
  };
  const rootInfo = () => ({ root, themesDir: themesDir(), esHome: esHome(), resourcesDir: join(root, 'emulationstation', 'resources'), activeTheme: activeTheme() });
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
    read_text: ({ path }) => readText(guard(path)),
    read_text_optional: ({ path }) => (existsSync(path) && inside(path) ? readText(path) : null),
    read_themesettings: ({ theme }) => {
      const p = join(esHome(), 'themesettings', `${theme}.cfg`);
      return existsSync(p) ? readFileSync(p, 'utf8') : '';
    },
    backups_dir: () => '(browser preview)',
  };

  return {
    name: 'channelcraft-dev-fs',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = new URL(req.url, 'http://localhost');
        if (url.pathname === '/__dev/file') {
          const p = url.searchParams.get('path') ?? '';
          if (!inside(p) || !existsSync(p)) {
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
            res.end(JSON.stringify({ ok: true, value: fn(body ? JSON.parse(body) : {}) ?? null }));
          } catch (e) {
            res.end(JSON.stringify({ ok: false, error: String(e.message ?? e) }));
          }
          return;
        }
        next();
      });
    },
  };
}
