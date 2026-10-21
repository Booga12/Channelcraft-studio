# Clean-Windows test plan

How to check a public build on a computer that has never had ChannelCraft Studio, its developer tools, or your themes on it. Tick each box. Anything that fails goes in the notes at the end, with a screenshot.

## Machines

Use virtual machines (Hyper-V "Quick Create", or VirtualBox) so you can throw them away afterwards:

| # | Windows | WebView2 | Network | Account |
|---|---|---|---|---|
| A | Windows 11 23H2 or later, fresh install | built in | online | standard user (not admin) |
| B | Windows 10 22H2, fresh install, **not updated** | maybe missing | online | standard user |
| C | Windows 10 22H2, WebView2 removed (Apps → Microsoft Edge WebView2 Runtime → Uninstall) | missing | **offline** | standard user |

Machine C shows what happens with no WebView2 and no internet. The installer uses the WebView2 *bootstrapper*, which needs the internet, so the expected result is a clear failure, not a hang. If that matters, switch `webviewInstallMode` in `src-tauri/tauri.conf.json` to `offlineInstaller` (adds about 130 MB to the installer) and repeat.

## RetroBat on the test machine

Never point a test machine at your own RetroBat. On each VM:

1. Download RetroBat from retrobat.org and install it to `C:\RetroBat`. It needs no games.
2. Start it once and quit, so `emulationstation\.emulationstation` is created.
3. Copy in one theme that is free to share (for example es-theme-carbon from GitHub), plus a .zip of another for the import test.

## What's checked before testing (on the build machine)

- [ ] `pnpm release:check` passes. It builds the installer, checks licences, and confirms nothing personal is inside (user name, home folder, git name and email, the words in `.release-private-words`) and that only the starter theme is bundled.
- [ ] Copy only `src-tauri/target/release/bundle/nsis/ChannelCraft Studio_<version>_x64-setup.exe` to the VM. Nothing else.

## Install

- [ ] Double-click the installer as a standard user. It installs without asking for admin rights (current-user install).
- [ ] SmartScreen may warn, because the installer isn't code-signed. Note what it says.
- [ ] Machine B and C: note whether WebView2 gets installed (B) or the failure message (C).
- [ ] Start-menu entry "ChannelCraft Studio" with the Cc icon. The window and taskbar icon are the Cc icon, not Tauri's.
- [ ] Settings → Apps lists "ChannelCraft Studio" with publisher "ChannelCraft Studio".

## First start

- [ ] The app opens. With RetroBat at `C:\RetroBat` it's found automatically; otherwise "Choose RetroBat folder…" works.
- [ ] The getting-started guide appears once.
- [ ] Settings → About shows the version, and "Show file" for open-source licences opens Explorer at `THIRD-PARTY-NOTICES.txt`.
- [ ] `%APPDATA%\com.channelcraft.studio` is created. No folder with any other name appears.

## Each feature (on the VM's own RetroBat)

Stage 1, safety:
- [ ] Open carbon and choose "Make a copy and edit it". Change a colour, Save. A backup appears in Settings → Saving & backups → Show backups.
- [ ] Edit the copy's theme.xml in Notepad while it's open in the app, then switch back. The app asks about the outside change.
- [ ] File → Restore a backup… restores the first backup exactly.
- [ ] Open the same theme in a second app window (start the app twice). The second one is refused.

Stage 2, RetroBat accuracy:
- [ ] The clock follows RetroBat's 12/24-hour setting.
- [ ] Theme options → Screen transition.

Stage 3, matching video and cover: needs scraped games, so skip on a clean VM or scrape one console.

Stage 4, media check:
- [ ] File → Check game media… runs and saves a CSV that opens in Excel or Notepad with accents intact.

Stage 5:
- [ ] Presets → "Only ‹console›" → a palette changes only that console. Switching console in the toolbar shows the difference.
- [ ] An animation with "How much it moves" and "Time for one move".
- [ ] A picture with "Soft shadow under the shape".

Stage 6, import:
- [ ] Start screen → Import a theme → the .zip. The summary appears, the theme imports, and it opens.
- [ ] Import the same .zip again. The name gets " (2)", and nothing is overwritten.
- [ ] Rename a .txt file to `.png` and Import… it as a picture. It's refused with a clear message.
- [ ] Download a free font. `_inc/fonts` gets the font and a `‹family›-OFL.txt`.
- [ ] Machine C (offline): a free-font download fails with a message, and no font without a licence is left behind.

In RetroBat itself (the most important part, since none of this has been seen natively yet):
- [ ] "Use in RetroBat", then Launch. The edited theme shows: colours, the per-console palette on its console only, animations moving at the chosen size and speed, the shadow under the picture, and the loading screen.

## Uninstall

- [ ] Settings → Apps → ChannelCraft Studio → Uninstall removes the program and Start-menu entry.
- [ ] Your themes in RetroBat are untouched.
- [ ] `%APPDATA%\com.channelcraft.studio` (backups, settings) is left in place on purpose; note whether that's wanted.

## Upgrade from an earlier build (on your own PC only)

- [x] With the old build's data in `%APPDATA%\com.<old name>.channelcraft-studio`, install the new build and start it.
  - `%APPDATA%\com.channelcraft.studio` appears with the same backups and settings, and the old folder is still there.
  - Your editor preferences (Settings) are kept.
  - Restore a backup lists the old backups.

## Notes

| Machine | Step | What happened | Screenshot |
|---|---|---|---|
| Own PC (release build, not installed) | Upgrade data move | 12 backups hard-linked, settings and preferences kept, start-up about 4 s | — |
| Own PC | Console screen | A `{game:video}` video showed nothing in RetroBat; fixed: the preview marks it and offers a random game's video | RetroBat Theme configuration screenshot |
| Own PC | RetroBat menu options | All four options listed in RetroBat; switching changed the theme | user report |
