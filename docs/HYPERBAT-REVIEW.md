# Review: Hyperbat ThemeCreator v2.2 compared with ChannelCraft Studio

Reviewed 2026-10-21 from `F:\Browser download\Hyperbat ThemeCreator v2.2_full.rar`. The archive was unpacked into a temporary folder and read only; the program was never run.

## What it is

- A Python/Tkinter program (PyInstaller). Its helper modules ship as readable `.py` files; the main window is inside the .exe.
- It makes **screens for the one4all4one / Hyperbat theme** by BobMorane, not whole themes:
  - a game screen (`customView name="hyperbat" inherits="gamecarousel"`)
  - a console screen (`view name="system"`)
  - a default screen per console
- You place picture layers on a 1920×1080 canvas (or import a Photoshop .psd), add a video frame, pick animations from a library with preview videos, and set a border shader. It writes theme.xml, the images and a `project_data.json`.
- Its output only works inside that theme. It uses `${bobmediapath}`, `${IfnoextGamethemeexist}` and the theme's own shader in `_common/shaders/`.
- **Licence.** The Hyperbat theme is CC BY-NC-SA 4.0 (non-commercial, share-alike). The creator tool ships no licence, so it is all rights reserved by default. ChannelCraft is MIT and public, so it takes **ideas only**: no code, shaders, animation files or preview videos are copied.

## What it does better (and RetroBat really supports)

1. **Animations replay as you move.**
   - Its storyboards run on `open`, `activateNext` and `activatePrev`, so the box art and logo animate in again on every game or console you scroll to.
   - It also has exit animations (`deactivateNext` / `deactivatePrev`) that zoom and fade the old ones out.
   - RetroBat's emulationstation.exe contains all six event names.
   - ChannelCraft only uses `activate` (once, when the screen appears) and endless loops, so scrolling feels static.
2. **Multi-step "arrive, bounce, settle" animations.** Several animations in one storyboard, chained with `begin` delays, with `bump` and `easeInQuint` easing and width/height squash. ChannelCraft's presets are a single move each.
3. **Framed videos and pictures.**
   - It adds rounded corners, up to three gradient borders, and inner and outer shadow through a shader.
   - RetroBat ships its own `:/shaders/border.glsl`, with a border, corner radius, inner and outer shadow, and saturation.
   - ChannelCraft only uses `shadow.glsl`, so its videos and screenshots are plain rectangles.
   - Caveat: border.glsl skips pictures whose corners are see-through, such as most logos. Logo tiles need a rounded panel picture behind the logo instead.
4. **Video frames in the right shapes.** Ready-made 4:3, 16:9 and portrait frames, using `maxSize` so videos keep their shape.
5. **You see an animation before choosing it.** Each one in its library has a short preview clip.
6. **Per-game screens.** A screen can be shown only for one game or one console (`{game:system:theme} == '…'`, and per-game folders). ChannelCraft has per-console values, but no per-game screens.
7. **Photoshop import.** It turns PSD layers into placed pictures.
8. **Four languages** (English, French, Spanish, Polish).

## Where it is weaker (things ChannelCraft should not copy)

- **It writes theme.xml from scratch every time** (ElementTree and minidom). Comments, formatting and hand edits are lost, nothing is backed up, and a locked file gets saved as `theme_1.xml` instead.
- **Its output depends on one theme** and its media folder, so it can't be used on any other theme.
- **XML mistakes:**
  - empty `begin=""` and `duration=""` attributes
  - a misspelt easing, `mode="easyIn"`, which RetroBat doesn't know
  - debug `print` calls left in
  - positions written with 12 decimals
- **No checks** on imported files.
- **Confusing for beginners:**
  - raw shader fields ("borderSize 2", "Gradient mode (from 0 to 4)")
  - "RepeatAt (ms)" and event extraction
  - pixel sizes, and a separate "theme size" to set
  - 18 kinds of confirmation dialog

## Mistakes ChannelCraft is making

| # | Problem | Effect in RetroBat |
|---|---|---|
| A | Animations only play when a screen opens | Moving between games or consoles feels static |
| B | Tiles, videos and screenshots have no frames; the selected tile is a flat fill | Looks unfinished next to Hyperbat |
| C | One console-screen style per design | Little choice; carousel styles don't follow the design |
| D | No moving or "colour wave" backgrounds | Fewer ways to change the look |
| E | 8-bit preset "doesn't show up" on a fresh theme | Not reproduced. In memory, all 19 designs apply and save from New theme (`src/lib/starter.test.ts`). It needs your exact steps in the app. |
| F | Speed not measured on big themes | Unknown; to measure with your largest themes before changing anything |

## Proposed changes, in batches

1. **Motion that follows you.**
   - Entrance animations replay on `activateNext` / `activatePrev`, with optional exit animations.
   - Multi-step "arrive and bounce" presets.
   - The picker plays each animation on a small sample.
   - One "Motion style" choice per design, still with RetroBat's Motion On/Off option.
2. **Polished frames and tiles.**
   - A "Frame" setting on videos, screenshots and box art: rounded corners, a border in the design's accent colour, and a soft shadow (RetroBat's own border.glsl).
   - Designs get rounded tile pictures.
   - The selected tile glows and grows (carousel `logoScale`, plus a selection picture in the accent colour) instead of a flat fill.
3. **More console-screen styles per design.**
   - Every design offers its matching carousel styles: wheel, cover flow, arc, grid, row.
   - Switching design or style updates colours, fonts, artwork, data and animations together.
   - It all appears in RetroBat's System view style menu.
4. **Colour waves.**
   - Moving wave, gradient and stripe backgrounds drawn in the design's colours.
   - They follow the Color set, and move slowly (or stay still with Motion Off).
5. **Speed.** Time opening, editing and previewing your biggest themes (RELOAD, ARTFLIX), then fix the slowest steps.
6. **Easier start.**
   - New theme becomes three steps: look, console style, colours.
   - Plain words everywhere; no raw shader or millisecond fields.

## Done (2026-10-21)

- **Batch 1, motion** (commit 2281438).
  - What RetroBat does, from its source (batocera-emulationstation):
    - On game lists, `activate` already replays on every game.
    - On the console screen, only storyboards without an event replay (on every console), so ChannelCraft's console-screen entrances never played. That is now fixed, and old ones are flagged with a button to fix them.
  - New presets: Slide with the list (`activateNext` / `activatePrev`), Drop and bounce, Pop and bounce, Swing in, Zoom down, Rise then float, Pop then pulse.
  - New setting: how an element leaves when you move on (game lists only).
  - The preview plays RetroBat's own timing and easings, and replays in the direction you moved.
- **Batch 2, frames and tiles** (commit 18cd082).
  - A Frame setting gives rounded corners, plus a border and drop shadow through RetroBat's built-in border shader.
  - Designs frame screenshots and videos and round the covers.
  - Console tiles get depth, and the selected tile a ring and glow in the accent colour.
  - The preview draws all of these.
- **Found while doing it:** two save bugs that damaged "My Theme", both fixed with tests.
  - Updating menu options made overlapping edits, which cut theme.xml in the wrong place.
  - An undo after a save let the next save write the menu option files empty.

  These bugs, not the design, are why the 8-bit theme didn't show in RetroBat.

## Safety

- Backup before this work: git tag `backup-before-hyperbat-review`, plus a full copy of the repository at `C:\Users\fatbo\Documents\projects\channelcraft-studio-backup-2026-10-21.bundle`.
- Your themes in RetroBat were only read.
