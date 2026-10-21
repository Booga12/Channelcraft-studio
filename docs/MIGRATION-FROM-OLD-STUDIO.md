# Bringing the old Studio's RetroBat work into this app

Review date: 2026-10-20. Nothing has been changed in either app yet. This is the comparison and
the proposed plan, for you to approve before the work starts.

## Which app is which

| | **This app (the one to keep)** | **Old app (reference only)** |
| --- | --- | --- |
| Folder | `Documents\projects\channelcraft-studio` | `Documents\Codex\2026-10-15\i-w\boogastation-studio` |
| Technology | Tauri 2 (Rust) + SvelteKit 5 / TypeScript, its own window | .NET Framework C# server + plain HTML/JS, browser tab or WebView2 window |
| State | Git, latest commit `37e5268`, clean | Git `c5e71b2` plus **uncommitted** desktop work (left untouched) |
| Themes it can edit | Any installed theme: lossless XML editing, follows includes, subsets, variables and conditions (all 7 installed themes round-trip byte for byte) | Only its own starter and your personal theme (needs `theme.xml`, `splash.xml`, `_inc/systems/logos`) |

The attached `boogastation-studio.zip` is identical to that folder (checked by file hashes),
including the uncommitted changes. Neither was modified. Installed RetroBat is version
**8.3.1.1-stable** (`M:\Retrobat\emulationstation\version.info`).

## Comparison

✅ = has it, ◐ = partly, ✗ = missing.

| Capability | This app | Old app | What to do |
| --- | --- | --- | --- |
| Own desktop window, no browser | ✅ Tauri | ◐ WebView2 host, not fully tested | Keep this app's. Don't port the HTTP server or WebView2 host |
| Opens any theme without breaking it | ✅ | ✗ | Keep |
| Visual editing, drag/resize/snap, layers, undo, history | ✅ | ✅ | Keep this app's |
| Designs, layouts, element library, fonts, animations | ✅ | ◐ 8 presets | Keep this app's |
| New theme from a neutral starter | ✅ | ✅ | Keep this app's. Check the starter has no personal content (it doesn't today) |
| Real game data in the preview | ✅ name, art, video, description… | ✅ | Port the old app's honesty rules: label sample data as "Sample", show missing fields as unavailable, treat `gametime` as seconds, allow fractional stars |
| Finding a console's ROM folder | ◐ assumes `roms\<name>` | ◐ hard-coded `gc → gamecube` | Read each system's `<path>` from `es_systems.cfg` |
| **Backup before saving** | ◐ one zip per session, no manifest | ✅ zip with manifest, project ID, file hashes | **Port** |
| **Restore a backup** | ✗ no restore screen | ✅ checks everything first, restores the exact snapshot, backs up the current state first | **Port** |
| **Saving all files together** | ◐ each file written safely on its own, but a multi-file save can stop half way | ✅ whole theme staged in a sibling folder, checked, swapped in, recovery journal | **Port**, adapted to Rust |
| **Changed outside the app** | ✗ | ✅ file fingerprints; asks you to reopen | **Port** |
| **Two windows on one theme** | ✗ | ✅ project lock | **Port** (lock per theme) |
| Temp files and failed exports | ◐ fixed `.ccs-tmp` name; export writes straight onto the target zip | ✅ unique temp, keeps the old export on failure | **Fix** |
| Save As / copy | ✅ duplicate theme | ◐ plain copy | Make it transactional as well |
| **Matching video + cover for the console screen** | ✗ RetroBat's `{random}` / `{random:image}` pick different games | ✅ featured game from one real `<game>` entry, both files copied in (hashed names), per-console `if="${system.theme} == '…'"` blocks | **Port**. Exports get bigger, and these files must never go into the public program |
| **Media Health** (missing/broken art and video, duplicates, missing descriptions, CSV) | ✗ | ✅ read-only, skips links, 10,000 cap | **Port** |
| Per-console accent colours (`consoleAccent` variables with `if`) | ◐ palettes are global | ✅ global or per console | **Port** |
| Per-console background import | ◐ console art import from other themes | ✅ copied into the theme, relative paths | **Port** |
| Gentle "bob" motion: amount and speed per element/group; video always static | ◐ 10 animation presets, no amount/speed controls | ✅ | **Port** as controls on top of the presets |
| Shape shadows (`:/shaders/shadow.glsl`) | ✗ | ✅ | **Port**. Preview is only an approximation |
| Screen transitions (Fade / Slide / Instant, `defaultTransition`) | ✗ | ✅ with the "set RetroBat to Auto" note | **Port** |
| Splash screen editing | ◐ `splash` view only | ✅ title, rule, positions | Look at how RetroBat 8.3 really draws the splash first (the dark rectangle bug is open) |
| Checking typed values (numbers, colours, ranges) | ◐ | ✅ | **Port** |
| Import a theme ZIP/folder safely | ✗ | ✗ | New work, using the old app's zip checks (unsafe paths, links, size, file-count limits) |
| App data separate from themes | ✅ Tauri AppData | ✅ (uncommitted) plus portable mode | Optional portable mode later |
| Clean public package | ◐ installer builds, never checked | ✗ old ZIPs contain personal media | New: allowlist, licence files (downloaded fonts need their OFL text), WebView2 install setting, clean-Windows test |
| Tests | ✅ 66 automated tests (XML round-trip, resolver, designs, editor) | ✅ Python/Node suites | Add Rust tests for the ported safety code |

## What not to bring over

- The C# server, its HTTP API and the browser UI. This app is already a native window.
- The old compile model, which writes `studio.json` and regenerates `_inc/editor/overrides.xml`. It depends on your personal theme's element names. This app edits the theme's XML directly and keeps everything else intact. Generated parts stay in clearly marked blocks.
- Anything personal: Booga's wiiTheme, BOOGASTATION wording, game media, game lists, reports, preferences, paths.

## Proposed plan, in stages

Each stage is a separate commit with tests. After each stage you can try it before the next one.

1. **Safety (first, because everything else writes files).**
   - Backups with a manifest and hashes.
   - A Restore screen with full pre-checks that restores the exact snapshot.
   - Staged whole-theme saves with a recovery journal, checked when a theme opens.
   - External-change detection, a per-theme lock, and unique temp files.
   - Safe export and Save As.
2. **RetroBat accuracy.**
   - A capability profile for RetroBat 8.3.1.1, built from the official THEMES.md and your installed themes. The preview flags anything RetroBat can't do.
   - ROM folders read from es_systems.
   - Sample data labelled "Sample"; real metadata formatted the old app's way.
   - Screen transition setting.
   - A look at the splash screen.
3. **Matching console video and cover.** Choose a featured game per console (or Automatic), with copied media and per-console blocks. Saved pairs are kept if the ROM drive is unplugged.
4. **Media Health** scan with progress, cancel and CSV export.
5. **Per-console colours and backgrounds**, motion amount and speed controls (video stays still), shape shadows.
6. **Import** theme ZIPs and folders, and assets with real content checks (pictures actually decode).
7. **Public package**: program plus neutral starter only, licences, clean-Windows and native RetroBat checklist.

## Stage 1 — done (2026-10-20)

Code: `src-tauri/src/storage.rs` (new), `src/lib/components/RestoreDialog.svelte` (new), saving and opening in `src/lib/editor.svelte.ts`.

- **Saves are one transaction.** All changed files are staged in a `.channelcraft-save-…` folder next to the theme. A journal (in the app's data folder, `transactions/`) records each step, then the files are swapped in. If the app stops part-way, the next time the theme is opened the partial save is undone and you are told.
- **Backups have a manifest** (`channelcraft-backup.json`): theme folder id, every file, its SHA-256, the reason and the time. They are written through a temp file, so a failed backup never leaves a broken zip.
- **Restore screen** (File → Restore a backup…, or Settings → Saving & backups).
  - Before anything changes, it checks the backup's id and every file's hash, and refuses unsafe paths, links, files missing from the list or duplicated, and backups over 16 GB or 100,000 files.
  - It backs up the current state, unpacks the backup into a staging folder, then swaps the whole folder (journaled too). Files added after the backup are removed.
  - Older backups without a manifest are listed but can't be restored automatically.
- **Changed outside the app.** The size and time of each XML file are remembered. Coming back to the window offers a reload. Saving a file another program changed asks first ("Save mine anyway" / "Don't save"). File → Reload from disk is new.
- **Theme lock.** A lock file in the app's data folder, held while a theme is open, so a second ChannelCraft window can't open it. The OS releases it if the app crashes.
- **Safe export and copies.**
  - Export and single-file writes use unique temp names and replace the target only when complete.
  - Export refuses to zip into the theme itself.
  - Duplicate (Save As) and New theme copy through a staging folder (empty folders kept) and never overwrite.
- The window can't be closed while a save, backup or restore is running.
- Edits made while a save is running stay unsaved.
- Tests:
  - 13 Rust tests: multi-file save, an interrupted save undone, an interrupted restore undone, six kinds of bad backups rejected without changes, exact restore, safe export, staged copy, the lock, atomic writes.
  - 1 editor test: one save call, the changed-elsewhere question, backup before saving.
  - A real-theme round trip on temp copies of v5 and carbon: the restored theme is byte-identical. Times for carbon (2,155 files): save 0.02 s, backup 2 s, restore 8 s.
- Not verified yet:
  - The real window (Tauri) hasn't been tried by hand: restore with RetroBat running, the focus reload, the second-window lock.
  - Disk-full and power-loss behaviour beyond the simulated half-done states.

## Stage 2 — done (2026-10-20)

Facts come from RetroBat's own source (RetroBat-Official/emulationstation, master at `08305947`), not from guesses.

- **Property profile.** `src/lib/theme/retrobat-profile.json` is the element/property table from `es-core/src/ThemeData.cpp` (38 element types, 485 properties, plus inheritance such as clock → text).
  - The property panel marks properties RetroBat skips with "RetroBat ignores this".
  - A test applies every design, with every system layout, plus every plain layout, the starter and every Add-panel item, and fails on any property RetroBat would skip. The only one found was the clock's `format`, which is now removed.
- **Clock.** RetroBat has no clock `format`. Its own `ClockMode12` setting picks 12 or 24 hours, and `DrawClock` shows or hides the clock (`ClockComponent.cpp`). The preview reads both from es_settings.cfg; your RetroBat is set to 12 hours.
- **Screen transitions.** `<theme defaultTransition>` (fade / slide / instant) is used only when RetroBat's Transition Style is Auto, and the Instant power saver overrides it (`ViewController.cpp`).
  - The Options panel sets it in theme.xml.
  - It warns when RetroBat's own settings would override it.
- **ROM folders.** These are read from each system's es_systems.cfg `<path>` (`~` means the emulationstation folder). Folders on other drives are allowed for the preview.
- **Game data.** Hidden games are skipped, and `../` and `~/` media paths are understood. `gametime` stays in seconds.
  - Stars fill to the exact rating (0.7 = 3.5 stars), as RetroBat draws them.
  - The "Sample game" label explains that its details are made up.
- **Loading screens.**
  - RetroBat reads `splash.xml` (start-up) and `gamesplash.xml` (game launch) on their own; they replace its built-in ones. They now appear as **Loading screen** and **Game launch screen** tabs, and edits go into those files.
  - Following `Splash.cpp`, only extras plus the built-in `background`, `label` and `progressbar` / `progressbar:active` are drawn. Other elements are listed as "RetroBat won't draw here".
  - The drawing order is fixed: extras below zIndex 5, then the background, extras 5–10, the bar, the label, then extras 10 and up.
  - The built-in parts start from RetroBat's placement: the background is centred, the label sits at 78 % height, and the bar uses its grey and red defaults unless themed.
  - theme.xml's own `splash` view is labelled as not used for the loading screen.
- **SVG stretching.** RetroBat stretches an SVG to an element's exact size; the preview now does too. v5's thin splash accent line drew as a dot before.
- **Splash "dark rectangle" (still open).**
  - Current v5 / Booga's wiiTheme splash.xml has no setting that explains it: the background is hidden, and every extra has an explicit origin.
  - One way RetroBat produces exactly that picture: a splash `background` with `pos` but no `origin` keeps RetroBat's centring, so a dark full-screen picture at `pos 0 0` covers the top-left quarter.
  - The preview now shows that case as RetroBat would. Checking it in RetroBat is still needed.
- Tests: 79 frontend tests (profile, splash order and defaults from v5 read-only, splash editing goes to splash.xml, gamelist parsing, transition setting) and 16 Rust tests (adds ROM-folder resolution and es_settings reading).

## Stage 3 — done (2026-10-20)

- **Insert → Matching game video & cover…** (also in the Add panel on the System screen) opens a window listing every console with scraped games. Each console can be set to Off, Automatic, or one chosen game.
- **Automatic** picks the first game (hidden games skipped) whose video and cover (box art, then thumbnail, then screenshot) actually exist on disk. A chosen game without both files gets a clear message, and nothing changes.
- **Copying.** The two files are copied into `_inc/ccs/featured/` under their SHA-256 (each stored once), so the theme works without the games drive. The theme gets bigger, and these files must never go into the public program.
- **Per-console blocks.** `_inc/ccs/featured.xml` holds one `<view name="system" if="${system.theme} == '…'">` block per console, setting `ccs_featured_video` and `ccs_featured_cover`.
  - It is included at the end of theme.xml, after the two elements' own hidden definitions, so consoles without a pair show neither.
  - RetroBat evaluates `${system.theme}` inside `if` itself (ThemeData.cpp `parseFilterAttributes`, MathExpr).
- **Saved choices** sit in a comment at the top of featured.xml. If a console's ROM folder can't be read, its saved pair is kept.
- **Undo.** One undo step per Apply. Nothing changes when every copy fails.
- The preview plays a theme's own video files.
- Tests:
  - an editor test: automatic picking skips a game without video; the blocks and paths are right; the include comes after the elements; a paired console shows the pair and others hide it; a bad choice is reported and the old pair kept; undo
  - a Rust test of hashed copies
- Browser preview check: the window lists your real consoles and games (for example 8 GameCube games with a video and a cover). Copying itself only works in the app.
- Not verified: RetroBat showing the pair natively.

## Stage 4 — done (2026-10-20)

- **File → Check game media…** reads each console's gamelist.xml (from its es_systems path) and reports:
  - games with no video, no cover art or no description
  - files a game names that aren't on disk (picture, video, manual and other tags)
  - games listed twice
- It only reads. Hidden games are skipped, non-gamelist files ignored, and findings capped at 10,000.
- It shows progress and can be stopped. You can filter by kind and console, and save a CSV (UTF-8 with BOM for Excel) wherever you choose.
- Your library: 134 games on 14 consoles in about 0.5 s. 32 findings (16 no video, 9 no cover, 7 no description), no broken paths.
- A file being there doesn't prove its video plays in RetroBat; the window says so.

## Stage 5 — done (2026-10-20)

- **Per-console colours, pictures and settings.** The Properties, Colours and Presets tabs have an "All consoles / Only ‹console›" switch.
  - With "Only", an edit is written as a second definition right after the shared one, with `if="${system.theme} == 'snes'"`. Variables and single properties both work.
  - RetroBat honours `if` on single variables (`ThemeData::parseVariable`) and on single properties (`parseElement`), and the later definition wins.
  - Palettes, colour edits, positions and pictures all follow the switch. A per-console background is: select the background, choose "Only", pick a picture.
  - "‹console› has N own values" lists them, with Reset for each or all. Rows show a "This console only" badge.
  - A shared edit that the shown console overrides changes the shared value and says why the preview didn't move.
  - Caveat: a colour that lives in a colour-set file (for example "Color set: Dark") gets its console value in that same file, so it applies only with that colour set.
- **Resolver fix.** Each file's `<variables>` are now read before the rest of that file, as RetroBat's `appendFile` does.
- **Motion amount and speed.** Each animation has "How much it moves" (25–300 %) and "Time for one move" (0.2–20 s).
  - These change the storyboard's from, to and duration in place, so extras such as `begin` and lower-case `autoreverse` stay.
  - Hand-written bobs of the same shape are recognised (for example Booga's v4).
  - "Use this for all N … here" matches every element on the screen that has the same animation.
  - `duration` can't use variables in RetroBat (`ThemeStoryboard.cpp` reads it as a number), so the speed is written on each animation.
  - Videos only get entrance animations, never loops.
  - The preview now accepts RetroBat's spellings: `autoreverse` or `autoReverse`, `mode` or `easingMode` in any case, and its cubic, quint and bump easings.
- **Shape shadows.** Pictures have "Soft shadow under the shape" with a distance from 1 to 24 px, written as `<shader><path>:/shaders/shadow.glsl</path><shadowOffset>N</shadowOffset></shader>`.
  - Read from RetroBat's own `shadow.glsl`: it is always black at half strength and moves down-right, with a default of 6 px. Its `blur` value is never used, so it isn't offered.
  - A picture that already has another shader is left alone.
  - The preview uses a CSS drop-shadow, which is close but not exact.
- Checked in the browser preview (read-only, in memory):
  - Neon palette applied to SNES only: SNES accent FF2BD6, N64 kept 4C8DFF.
  - Float at 200 % with 3 s per move.
  - 4 px shadow drawn.
  - No console errors.

## Stage 6 — done (2026-10-20)

- **Import a theme** (start screen) takes a .zip or a folder. Nothing is written until you press Import.
  - It looks inside first and shows how many files come in, which are left out and why.
  - It finds the theme: the shallowest folder with a theme.xml, so GitHub zips such as `es-theme-x-master/` work. "-master" and "-main" are dropped from the suggested name.
  - It refuses a source with two themes, no theme.xml, or a theme.xml without `<theme>`.
  - It is added as a new folder in RetroBat's themes folder, never over an existing one. It is unpacked into a hidden `.channelcraft-import-*` folder and moved into place in one step. On any error nothing is left behind.
- **Content checks** (`src-tauri/src/importing.rs`), shared by theme and file import:
  - Only theme file types come in: XML, pictures, fonts, sounds, videos, shaders, plain text, `collections.info` and LICENSE/README.
  - Programs, scripts and archives are never copied.
  - Pictures, fonts, sounds and videos must really be that kind of file. Their first bytes are checked, and any real format of the kind is accepted, because RetroBat reads by content (carbon ships a WebP named `konami.png`).
  - XML and text must not be binary, and an SVG must be an SVG.
- **Safety limits:**
  - Unsafe paths (`..`, drive letters, absolute paths) refuse the whole zip.
  - Links, including Windows junctions, are left out.
  - The same name twice (ignoring case) is refused.
  - Caps are 50,000 files, 8 GB in total and 2 GB per file.
  - A zip entry that unpacks to over 400× its packed size (and over 64 MB) is refused, and every file must unpack to exactly the size its zip claims.
  - System clutter (`__MACOSX`, `.git`, `Thumbs.db`, `._*`) is skipped.
  - A source that contains RetroBat's themes folder is refused.
- **Single files.** "Import…" for pictures, fonts, sounds and videos, fonts added from Windows, downloaded fonts, and art copied from installed themes all go through the same checks.
  - Pictures, fonts, sounds and videos have size limits: 64 MB, 32 MB, 256 MB and 2 GB.
  - The file must be the kind the setting needs.
  - Copies are written through a temp file and renamed into place.
  - If the same file is already there, it is reused instead of making "-2" copies.
- Checked with your installed themes, read-only (each imported into a temp folder and compared byte for byte):

  | Theme | Files | Size | Time | Left out |
  |---|---|---|---|---|
  | v5 | 1,327 | 50 MB | 1.4 s | nothing |
  | carbon | 2,154 | 148 MB | 2.1 s | one `.pdn` Paint.NET file |
  | ARTFLIX | 3,023 | 386 MB | — | nothing |
  | RELOAD | 5,170 | 1.3 GB | — | `.old`, `.m3u` and `.gitignore` files |
  | BatWiiCera | 733 | — | — | its `_plaza` add-on: shell scripts, an AppImage, a `.love` and a `.tar.gz` |

- Browser preview: the Import card and dialog render. Picking files needs the app window, because the browser has no file picker.
- Still to do: imported file names aren't checked against RetroBat's own reserved folders, and a theme's fonts aren't licence-checked (stage 7).

## Stage 7 — done (2026-10-20)

- **Nothing personal in the build.**
  - App id changed from `com.fatbo.channelcraft-studio` to `com.channelcraft.studio`. On the first start, the old data folders (Roaming: backups, settings, recovery, journals; Local: the window's saved preferences) are copied to the new name, minus lock files and web caches. The old folders are left as they are. The old folder is found by pattern (`com.*.channelcraft-studio`), so no user name is built into the program.
  - Publisher, copyright and descriptions are neutral ("ChannelCraft Studio"); Cargo no longer says "A Tauri App" by "you".
  - Release builds no longer contain the source-folder fallback for bundled files (`dev_resource` is debug-only). `pnpm release:check` builds with the home, Cargo, rustup and project folders remapped (`--remap-path-prefix`).
  - Test names that used a personal theme name are neutral now.
- **`pnpm release:check`** (`scripts/check-release.mjs`):
  - It builds the installer and runs the licence check.
  - It scans the installer, the program, the bundled resources and the web files for this PC's user name and home folder, the git name and e-mail, and the words in the untracked `.release-private-words` (personal theme and brand names, the RetroBat drive path). It searches for each both as UTF-8 and as UTF-16.
  - It fails on any bundled file other than the starter theme and the notices, or on any game, media or RetroBat data file.
- First run: the installer is 4.1 MB and passed. As a cross-check, the debug program contains the user name 389 times; the release program and the installer contain it 0 times. The installer is compressed, so the real proof is the scan of the release program and bundled files, which are what it contains.
- **Licences** (`pnpm notices`, `scripts/third-party-notices.mjs`):
  - 289 packages are compiled into the app: 255 Rust crates for Windows (no build or dev dependencies) and 34 npm packages in the window's code.
  - All are permissive (MIT, Apache-2.0, BSD, ISC, Zlib, Unicode, MPL-2.0, CDLA-Permissive), and the script fails on anything else.
  - `THIRD-PARTY-NOTICES.txt` has every licence text. It is installed with the app and opened from Settings → About.
  - Nine packages ship no licence file of their own, so their entry names the standard licence and links to the source.
- **Fonts.**
  - A downloaded free font now comes with its `‹family›-OFL.txt`. If the licence can't be downloaded, the font isn't added. All 20 catalogue fonts were checked to have one.
  - A font downloaded by an older version gets its licence the next time it's picked (best effort).
  - The "On this PC" font list says Windows fonts often can't be shared.
- **Icon.** A new Cc icon replaces Tauri's logo (source in `src-tauri/icons/source/icon.svg`). Template SVGs are removed.
- **Installer.**
  - One NSIS installer that installs for the current user, so no admin rights are needed.
  - WebView2 comes from the embedded bootstrapper, which installs it silently when missing but needs the internet. `offlineInstaller` is the alternative; it adds about 130 MB.
- **Licence: MIT** (`LICENSE`, "ChannelCraft Studio contributors").
  - The installer shows it as its licence page and installs it as `LICENSE.txt`.
  - Settings → About shows it in full.
  - The release check fails if it's missing or not bundled.
- **Settings → About.** It shows the version, says the app isn't made by the RetroBat team, explains that files stay on the PC (the only time it goes online is a free-font download), and opens the licences.
- **`docs/CLEAN-WINDOWS-TEST.md`.** A test plan for three VMs (Windows 11; Windows 10 not updated; Windows 10 offline without WebView2), covering install, first start, every stage, RetroBat itself, uninstall and upgrade.
- Still open:
  - The installer isn't code-signed, so SmartScreen will warn.
  - A Content-Security-Policy isn't set yet (`csp: null`).

## After stage 7: first test in the app and RetroBat (2026-10-20)

- **Data move on first start.** Backup zips (4.2 GB here) are hard-linked into the new folder rather than copied, so the first start isn't slowed and uses no extra space. Settings are still copied. Checked on this PC: all 12 backups, settings and window preferences came across, and the app started in about 4 s.
- **Console screen and game data.**
  - RetroBat's console screen has no current game (`SystemView.cpp`), so `{game:…}` stays empty there.
  - "My Theme" had a video playing `{game:video}` on it: RetroBat showed nothing, while the preview showed a sample video.
  - The preview now leaves such media empty (a red "empty in RetroBat" frame), counts them in a note, and offers "Use a random game's video/picture" (`{random}`, `{random:image}`, …). Game artwork pasted onto the console screen converts automatically.
- **Design colours are shared variables** (`designText`, `designAccent`, …) in a marked block at the top of theme.xml, so they show in the Colours tab and a colour set can redefine them. Before, with a design applied, RetroBat's Color set did nothing visible.
- **Storyboards** now follow RetroBat: one per event, a later one replaces it, an empty one removes it.
- **RetroBat menu options** (File → RetroBat menu options…, or the Options tab). Choices appear in RetroBat's Theme configuration:
  - System view style: console-screen layouts.
  - Gamelist view style: designs, and RetroBat allows a per-console choice.
  - Color set: each design's colours plus the palettes, recolouring the artwork too, via `_inc/ccs/art/<design>-<set>/` and `${designArtSet}`.
  - Motion: On / Off, where Off is empty storyboards.

  The current layout and design move into their option files unchanged (paths rebased, fixed design colours linked). Parts you added stay in theme.xml for every style. Running it again keeps the styles you kept. Applying a design directly is blocked once options exist. Files: `_inc/ccs/options.xml`, `_inc/ccs/options/*.xml`.
- Not yet seen in RetroBat: the menu options, the colour-set artwork switch, and Motion Off.

## Verification status (honest)

- Done:
  - Read the old source, its docs and git state; compared it with this app's code; confirmed the zip matches the folder; checked the RetroBat version.
  - Stages 1–7, with automated tests (87 front end, 22 Rust) and browser-preview checks (read-only).
- Not done:
  - The clean-Windows plan hasn't been run (no VM here).
  - The data-folder copy to the new app id hasn't been seen on a real start yet.
  - Theme import hasn't been run from the native app window (its file pickers).
  - Nothing from these stages has been tried in RetroBat itself: per-console values, retuned storyboards and the shadow shader are written to match RetroBat's source, not seen on screen.
  - The native app window hasn't been tested by hand for the new safety features.
