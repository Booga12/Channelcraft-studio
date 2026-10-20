# ChannelCraft Studio

A desktop theme editor for RetroBat (Batocera-EmulationStation themes), built with Tauri 2, SvelteKit and Svelte 5.

- Opens any installed theme, resolves its includes, theme options (subsets), variables and conditions the way ES does, and shows a live mock preview per view and system.
- Edit properties in typed form panels, drag elements in the preview, edit variables (e.g. colour sets), add or delete elements.
- Saving edits the XML text in place, so comments, formatting, BOMs and line endings stay as they were. A zip backup of the theme goes to `%APPDATA%\com.fatbo.channelcraft-studio\backups` before the first save of a session.
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
