# ChannelCraft Studio

A desktop theme editor for RetroBat (Batocera-EmulationStation themes), built with Tauri 2, SvelteKit and Svelte 5.

- Opens any installed theme, resolves its includes, theme options (subsets), variables and conditions the way ES does, and shows a live mock preview per view and system.
- Edit properties in typed form panels, drag elements in the preview, edit variables (e.g. colour sets), add or delete elements.
- Saving edits the XML text in place, so comments, formatting, BOMs and line endings stay as they were. A zip backup of the theme goes to `%APPDATA%\com.channelcraft.studio\backups` before the first save of a session.
- Per-game looks: on the game-list screens (detailed, video, grid, game carousel), "Only this game" puts changes in RetroBat's per-game files, the way RetroBat 8.3 reads them. A new theme comes with `games/<console>/` folders (one per console with games), a `games/README.txt`, and a `<gameextras>` pointer that tries `games/<console>/<rom name>/theme.xml`, then `games/<console>/_default/theme.xml`, then `games/_default/theme.xml`. Themes with their own layout (such as Hyperbat's `_gametheme/<console>/hyperbat/...` with console defaults) are followed too; a game that used a console default starts from a copy of it. The preview shows each game with its own file. Paths are written `./`-anchored, as RetroBat only resolves those relative to the file.
- Assets panel: keep your own pictures, videos, sounds and fonts (in `%APPDATA%\com.channelcraft.studiossets`, added with Add or by dropping files from Explorer) and drag one onto an element in the preview, Layers or Properties. It is copied into the theme's `_inc` folder (never over a different file) and linked with a theme-relative path, as a normal undoable edit.
- Create a theme from the bundled starter, or duplicate an existing one; set it as RetroBat's theme and launch RetroBat.

## Develop

```bash
pnpm install
pnpm tauri dev      # desktop app
pnpm dev            # UI only, in a browser: reads themes through a read-only dev bridge, never writes
pnpm exec vitest run
pnpm check
pnpm tauri build    # MSI and NSIS installers in src-tauri/target/release/bundle
```

The tests read the themes in `M:\Retrobat` (read-only) and are skipped if that folder doesn't exist.

## Layout

- `src/lib/xml/cst.ts`: lossless XML parser and in-place edit patches
- `src/lib/theme/`: theme loading, resolution, expressions, schema and edit helpers
- `src/lib/editor.svelte.ts`: editor state, undo/redo, saving
- `src/lib/components/`: UI
- `src-tauri/src/commands.rs`: file access; writes are limited to the RetroBat themes folder
- `src-tauri/resources/starter-theme/`: template for new themes

## Licence

MIT, see [LICENSE](LICENSE). Open-source software it is built with is listed in `src-tauri/resources/THIRD-PARTY-NOTICES.txt` (`pnpm notices` regenerates it).
