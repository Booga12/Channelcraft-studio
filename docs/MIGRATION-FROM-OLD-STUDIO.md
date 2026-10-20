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

## Verification status (honest)

- Done: read the old source, its docs and git state; compared it with this app's code; confirmed the zip matches the folder; checked the RetroBat version.
- Not done: no code changed; the old app was not built or run; nothing tested in RetroBat for this plan.
