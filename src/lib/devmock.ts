// Development only: when the UI runs in a plain browser (not inside Tauri), route the Tauri
// commands to the read-only dev server bridge in dev/fs-middleware.js.
import { mockIPC, mockWindows } from '@tauri-apps/api/mocks';

export function installBrowserMock() {
  mockWindows('main');
  mockIPC(async (cmd, args) => {
    if (cmd.startsWith('plugin:store|')) {
      if (cmd === 'plugin:store|get') return [null, false];
      return cmd === 'plugin:store|load' ? 1 : null;
    }
    if (cmd.startsWith('plugin:')) return null;
    const res = await fetch(`/__dev/cmd/${cmd}`, { method: 'POST', body: JSON.stringify(args ?? {}) });
    const data = (await res.json()) as { ok: boolean; value?: unknown; error?: string };
    if (!data.ok) throw data.error;
    return data.value;
  });
  const internals = (window as unknown as { __TAURI_INTERNALS__: { convertFileSrc: (p: string) => string } }).__TAURI_INTERNALS__;
  internals.convertFileSrc = (p: string) => `/__dev/file?path=${encodeURIComponent(p)}`;
}
