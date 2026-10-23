// Updates from the GitHub releases, through Tauri's updater (signed; see scripts/release.mjs).
// Installed copies look once, quietly, shortly after starting; Settings can look on demand.
import { check, type Update } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';

class Updates {
  /** A newer version that can be installed, once one has been found. */
  available = $state<Update | null>(null);
  state = $state<'idle' | 'checking' | 'installing' | 'failed'>('idle');
  error = $state('');

  /** Looks for a newer version. Returns a message to show, or null when quiet and nothing's new. */
  async check(quiet = false): Promise<string | null> {
    if (import.meta.env.DEV) return quiet ? null : 'Updates are only checked in the installed app.';
    this.state = 'checking';
    try {
      const u = await check();
      this.state = 'idle';
      this.available = u;
      if (u) return `ChannelCraft Studio ${u.version} is available.`;
      return quiet ? null : 'You have the latest version.';
    } catch (e) {
      this.state = quiet ? 'idle' : 'failed';
      this.error = String(e);
      return quiet ? null : `Couldn't check for updates (${e}).`;
    }
  }

  /** Downloads and installs the update, then restarts the app. */
  async install() {
    const u = this.available;
    if (!u) return;
    this.state = 'installing';
    try {
      await u.downloadAndInstall();
      await relaunch();
    } catch (e) {
      this.state = 'failed';
      this.error = String(e);
    }
  }
}

export const updates = new Updates();
