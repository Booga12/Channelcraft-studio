# Recording the website's how-to clips

The clips on the website's Guides pages (`channelcraft-website/static/guides/`) are recorded
automatically. The app's UI runs in Microsoft Edge (through Playwright) against a **made-up demo
RetroBat**, and its screen is captured. These tools are for development only and are not part of
the app build.

## One command

```sh
node dev/guides/record.mjs                          # every guide in scripts/
node dev/guides/record.mjs first-theme              # one guide
node dev/guides/record.mjs first-theme/open-wizard  # one step (the steps before it run unrecorded)
```

Node must be on PATH (in PowerShell:
`$env:PATH = "$env:APPDATA\fnm\node-versions\v24.22.0\installation;$env:PATH"`). Run the commands
from the studio folder. `pnpm install` must have run (it gets `playwright-core`, `ffmpeg-static`
and `adm-zip`). The browser is the installed Edge, so nothing else is downloaded.

Each run does the following:

1. Rebuilds the demo RetroBat (`make-demo.mjs`) before every guide, so every guide starts from
   the same state.
2. Starts the dev server on port 1430 with `CCS_DEMO_ROOT` set, or reuses one that is already
   serving *this* demo folder. A server that isn't in demo mode is never used.
3. Opens a fresh Edge profile at 1440×900 with dark mode, the default accent, "Show my own games"
   on and libretro-thumbnails off. Requests for libretro thumbnails are also blocked.
4. Runs each step, records it, and writes `static/guides/<guide>/<step>.webm`, `.mp4` and `.jpg`
   in the website. It also updates `src/lib/guides/clips.json` (see "The clip manifest" below).

A step fails, and nothing is written for it, if any of these happen during the clip: an error
toast, a page error, a console error, a page reload, or a failed demo command.

Options:

- `--headed`: shows the browser so you can watch.
- `--speed 1.2`: makes the actions faster.
- `--keep-server`: leaves the dev server running.
- `--no-demo`: doesn't rebuild the demo folder.
- `--keep-frames`: keeps the captured frames in the temp folder.
- `--port`, `--demo-root`, `--out <website folder>`: change where things are.

## The demo RetroBat

```sh
node dev/guides/make-demo.mjs            # rebuild ../guides-demo (fast after the first time)
node dev/guides/make-demo.mjs --regen-art
```

The demo lives in `G:\projects\channelcraft\guides-demo`, outside both repos. The page sees its
folders under made-up paths, so the clips never show real folders:

| The app sees | On disk (in `guides-demo`) |
| --- | --- |
| `C:\RetroBat` | `RetroBat\` |
| `C:\Users\Player\…` (Music, Pictures, Videos, Downloads…) | `Users\Player\` |
| `C:\Users\Player\AppData\Roaming\com.channelcraft.studio` (backups, recovery, library) | `AppData\` |
| deleted themes and library files | `Recycle Bin\` |

What's in it:

- **6 systems, 40 games** (snes, megadrive, n64, psx, gba, arcade). Every title, studio and
  description is invented (`demo-library.mjs`).
- **Artwork drawn by `art.js`:** box art, pixel-art screenshots, logos and fanart. The first two
  games of each system also get a gameplay video.
- **Music and an intro video:** three generated chiptune songs in Music (`music.mjs`). The intro
  video "Arcade Night.mp4" is in RetroBat's video folder and in Videos.
- **Wallpapers in Pictures,** and `Downloads\Sunset Drive.zip` (a theme to import).
- **Stock RetroBat files:** the carbon theme, EmulationStation's `resources` and `es_systems.cfg`.
  These are read once from `M:\RetroBat` (`--stock` changes this) into `guides-demo\.cache\stock`.
  Nothing is written there, and none of that install's games, media, settings or other themes are
  read.

`.cache` keeps the stock files and the generated art between runs. The art is drawn again when
`art.js`, `demo-library.mjs` or `music.mjs` change.

## Demo mode of the dev bridge

`dev/fs-middleware.js` is the read-only stand-in for the Rust commands when the UI runs in a
plain browser. Only when `CCS_DEMO_ROOT` is set does it load `dev/demo-bridge.js`, which adds the
write commands. They mirror `src-tauri/src/*.rs`: saving with backups, restoring, copying art and
sounds, fonts, importing, exporting, the explorer and the asset library.

The demo bridge has these limits:

- Every path from the page is mapped from the virtual paths above. A path that maps outside
  `CCS_DEMO_ROOT` is refused before the command runs, and every file operation checks again.
- Theme writes follow the app's own rule: only inside the themes folder, plus `es_settings.cfg`
  and `retrobat.ini` as the app does.
- RetroBat is never started: "Try in RetroBat" carries on as if it had.
- Fonts (Google Fonts list, font files, OFL texts) are downloaded once into `.cache\net`.

`src/lib/devmock.ts` handles the plugin calls in demo mode:

- **Settings store:** kept in memory.
- **File dialogs:** answered from `window.__ccsDemo.dialogs`, which the scripts fill with
  `ctx.answerDialog('C:\\Users\\Player\\Music\\Neon Skyline.ogg')`.
- **Message boxes (`ask`):** drawn in the page as a Windows 11-style box, so they appear in the
  clip. Answer them with `ctx.answerMessage('ok' | 'cancel')`.
- **Opener and updater:** do nothing.

Without `CCS_DEMO_ROOT`, `pnpm dev` works as it always has.

## Writing a guide script

Put one file per guide in `scripts/` (see `scripts/first-theme.mjs`):

```js
export default {
  slug: 'first-theme', title: 'Make your first theme', order: 2,
  prefs: {},                         // over the base prefs (dark, default accent, onlineArt off)
  localStorage: { 'ccs.tourDone': '1' },
  cursorStart: [1180, 700],
  async setup(ctx) {},               // runs before the first step, not recorded
  steps: [{
    id: 'open-wizard', title: '…',
    poster: 'end' | 'start' | <seconds> | '<mark name>',  // the JPG still
    loop: 'fade' | 'cut',            // fade blends the end back into the first frame
    leadIn: 700, hold: 1300,         // calm time before and after the action
    async run(ctx) { … },
  }],
};
```

`ctx` provides these actions:

- `click(target)`, `hover(target)`, `moveTo(target)`
- `type(text, { into, clear })`, `press(key)`
- `scroll(target, dy)`, `drag(from, to)`
- `pause(ms)`, `place(x, y)`
- `answerDialog(path)`, `answerMessage('ok')`
- `clip.mark(name)`
- `page` (the Playwright page)

A target can be a Playwright locator, a selector string, or `{ x, y }`.

Aim for clips of 4–14 s. The encoder raises compression until each file is under 1.5 MB.

More step fields:

- `shows`: what happens in the clip, in plain words, and `uiLabels`: the app's exact labels used.
  Both go into the manifest for the website's guide text.
- `before(ctx)` / `after(ctx)`: setup and tidy-up around the clip, not recorded.
- `skipped: 'why'`: no clip (the installer, RetroBat itself, Windows File Explorer). With
  `still(ctx)` the screen it sets up is saved as `<step>.jpg` (without the pointer).
- `ctx.clip.cut(async () => …, { keep, tail })`: a long wait (e.g. a theme being built) becomes a
  jump cut: the first `keep` and last `tail` seconds stay.

A guide can also have `context(browserContext)` (e.g. a route that makes RetroBat "not found" for
the first-start guide) and `ready(page)` (what to wait for instead of the start screen).
`helpers.mjs` has the shared moves: `quickTheme` (make a theme with the wizard, unrecorded),
`showScreen`, `appMenu(ctx, 'File', 'Share theme…')`, `pickOption` for native selects, `toast`.

## The clip manifest

`channelcraft-website/src/lib/guides/clips.json`:

```json
{ "version": 2, "guides": [ { "slug": "first-theme", "title": "…", "order": 2, "steps": [
  { "id": "open-wizard", "title": "…", "shows": "…", "uiLabels": ["…"],
    "webm": "/guides/first-theme/open-wizard.webm", "mp4": "…", "poster": "….jpg",
    "seconds": 8.57, "width": 1440, "height": 900, "frames": 245, "bytes": {…}, "posterAt": 5.9,
    "appVersion": "0.2.4", "recorded": "…" },
  { "id": "download", "title": "…", "skipped": "why there is no clip", "poster": "(optional still)" }
] } ] }
```

`node dev/guides/manifest.mjs` refreshes the words (titles, `shows`, `uiLabels`, skipped reasons)
from the scripts without recording again, and lists steps that aren't recorded yet or files that
are missing.
