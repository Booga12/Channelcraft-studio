# Plan for the next session

Written 2026-10-21, after stages 1–7 and the first RetroBat test. Start here, in this order. Each step says what "done" looks like.

## Before anything: check the state

- `git status` is clean on `main`; the last commit is the test notes (c93b7f9) or this plan.
- `pnpm vitest run` (96 front-end tests) and `cargo test` in `src-tauri` (24) pass.
- The rules from the hand-off still apply: never write to `M:\Retrobat` in tests, backups before writes, the user does the RetroBat clicks (Use in RetroBat, Launch), nothing personal in a public build.

## 1. Find what is still "broken in RetroBat" (highest priority)

The user said some things they add in the editor show in the app but not in RetroBat. Only one cause (game video on the console screen) is fixed so far.

- Ask the user for side-by-side screenshots: the app preview and RetroBat, same screen, same console.
- For each difference, read the theme file read-only and compare with RetroBat's source (ThemeData.cpp, SystemView.cpp, DetailedContainer.cpp, the view's element names). Likely causes to check first:
  - element types or names RetroBat doesn't draw on that view (not built-in, no `extra="true"`, not an auto-extra type)
  - properties the preview draws but RetroBat ignores for that element type
  - `{game:…}` bindings on other screens without a current game
  - paths that resolve in the preview but not relative to the file RetroBat reads them from
- Done when: each difference is either fixed (the preview shows what RetroBat shows, or the editor warns and offers the right setting) with a test, or written down as a known gap.

## 2. Get "My Theme" back to a saved state with menu options

- The saved "My Theme" has no `_inc/ccs/options.xml`. The user adds them again (File → RetroBat menu options…) and saves.
- Then, read-only, confirm the option files are on disk.
- Find out why they went missing (undo after adding? a later design apply?). If the app can lose them silently, fix that.

## 3. Check the menu options one by one in RetroBat

Not yet seen individually:
- Each colour set switches the design artwork (`_inc/ccs/art/<design>-<set>/`).
- Motion Off stops animations on every screen.
- A per-console Gamelist view style and Color set.
- Also from earlier stages, never seen in RetroBat: per-console values (stage 5), retuned animations, the shadow shader, the splash "dark rectangle" case.
- Done when: each result is in the notes table of `docs/CLEAN-WINDOWS-TEST.md`.

## 4. Added by the user (2026-10-21)

### a. Add buttons fill in the right data by themselves

The side buttons in the Add panel (picture, text, panel/box, clock, rating star, video) should add an element that already shows the data it's meant to, without the user setting it up.
- For each button and each screen, pick the binding RetroBat really fills there. On a game list: the game's picture, name/description, rating, video. On the console screen there is no current game, so use per-system data or a random game (`{random…}`), as in the console-screen fix.
- Clock and other auto types work anywhere; check RetroBat draws the element on that view (built-in name, `extra="true"`, or an auto-extra type).
- Done when: each button, on each screen, adds something that shows in the preview and in RetroBat with no further edits. Add tests.

### b. Console tiles look more refined, and the 8-bit preset on a fresh theme

- The console-screen tiles (picture 2: flat translucent boxes with logos, the selected one plain yellow) should look more finished and professional: for example rounded corners, a subtle border or gradient, a shadow, and a clearer selected tile (glow, scale, accent border) instead of a flat fill. Same for the other tile/box styles in the designs.
- Bug: starting a fresh theme and clicking a preset such as the 8-bit one doesn't show up. Reproduce it from the start screen, find why (not applied, not drawn, or not saved), fix it, and add a test.
- Done when: the tiles look better in the preview and in RetroBat, and every preset on a fresh theme shows at once.

### c. Review Hyperbat ThemeCreator v2.2

- The file is `F:\Browser download\Hyperbat ThemeCreator v2.2_full.rar`. The project's page says it is fully compatible with RetroBat: https://github.com/BobMoraneRetro/one4all4one-hyperbat-bobmorane
- It is someone else's program from a download, so: unpack a copy into a new, empty scratch folder, read it only, and never run it.
- Review: what it does, how it writes themes, whether its output really matches what RetroBat reads (check against RetroBat's source as above), anything risky, and which ideas would be worth adding to ChannelCraft Studio. Respect its licence; don't copy its code or art.
- Done when: a short written review with findings and suggestions.

## 5. Smaller fixes already known

- Set a Content-Security-Policy in `tauri.conf.json` (`csp` is `null`), then check the preview, fonts, videos and asset protocol still load.
- Imported file names aren't checked against RetroBat's reserved folder names.
- A theme's own fonts aren't licence-checked on import (warn only).
- Bring the "Verification status" section of `MIGRATION-FROM-OLD-STUDIO.md` up to date after each step.

## 6. Release (when the above is settled)

- `pnpm release:check` passes.
- Run `docs/CLEAN-WINDOWS-TEST.md` on the VMs (needs Hyper-V or VirtualBox on this PC, or another machine).
- Decide on code signing (SmartScreen warns without it) and on WebView2 `embedBootstrapper` vs `offlineInstaller`.

## 7. Make it easy to share with friends

The user wants friends to be able to download and use the app. The installer and the "nothing personal inside" check already exist (stage 7).
- A download page: a GitHub repository (public, or private and invite-only) with a Releases page holding the installer. Explain each step to the user first; making a repo public or posting a release is their decision and their click.
- A short "Getting started" page for friends: download, install, what SmartScreen shows and how to get past it, point the app at RetroBat, make a copy of a theme before editing.
- Updates: add Tauri's updater so friends get new versions inside the app, with signed update files (the signing key stays private, never in the repo).
- Optional: code signing, so Windows stops warning "unknown publisher" (costs money; explain the options).
- Done when: a friend on another PC can go from the link to editing a copy of a theme without help.

## Things for the user to decide

- Whether to restore the themes deleted on 2026-10-20 at 23:30 (Booga's WiiTheme v4, Booga's wiiTheme, Booga's wiiTheme copy). They are in the Recycle Bin, and each has a "before delete" backup zip.
- Whether app data (`%APPDATA%\com.channelcraft.studio`) should stay after uninstall.
