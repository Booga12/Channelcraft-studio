// Development only: when the UI runs in a plain browser (not inside Tauri), route the Tauri
// commands to the read-only dev server bridge in dev/fs-middleware.js.
//
// Demo mode (the dev server started with CCS_DEMO_ROOT, for recording the website's how-to clips;
// see dev/guides/README.md) also answers the plugin calls the app's flows need: the settings
// store, file dialogs (answered by the recorder through window.__ccsDemo), message boxes (drawn
// in the page so they show in the clips), and opener/updater calls (nothing happens).
import { mockIPC, mockWindows } from '@tauri-apps/api/mocks';

interface DemoControl {
  /** Answers for the next file dialogs (open/save), in order; null cancels. */
  dialogs: (string | string[] | null)[];
  /** Every dialog asked for so far, newest last (the recorder waits on this). */
  asked: { kind: string; options: unknown; at: number }[];
  /** Answers message boxes at once instead of showing them: 'ok' or 'cancel'. */
  autoAnswer: 'ok' | 'cancel' | null;
}

declare global {
  interface Window {
    __ccsDemo?: DemoControl;
  }
}

let demoMode: Promise<boolean> | null = null;
function isDemo(): Promise<boolean> {
  demoMode ??= fetch('/__dev/cmd/__demo', { method: 'POST', body: '{}' })
    .then((r) => r.json())
    .then((d: { ok: boolean }) => d.ok)
    .catch(() => false);
  return demoMode;
}

const store = new Map<string, unknown>();

/** A Windows 11 style message box in the page (a real one can't be filmed in a browser). */
function messageBox(message: string, title: string | undefined, kind: string | undefined, labels: [string, string | null]): Promise<string> {
  return new Promise((done) => {
    const wrap = document.createElement('div');
    wrap.setAttribute('data-demo-dialog', '');
    wrap.style.cssText = 'position:fixed;inset:0;z-index:2147483000;pointer-events:auto;display:grid;place-items:center;background:rgba(0,0,0,.28);font-family:"Segoe UI Variable Text","Segoe UI",system-ui,sans-serif;animation:ccsDemoFade .12s ease-out';
    const icon = kind === 'warning' ? '⚠️' : kind === 'error' ? '⛔' : 'ℹ️';
    const box = document.createElement('div');
    box.setAttribute('role', 'alertdialog');
    box.setAttribute('aria-label', title ?? 'ChannelCraft Studio');
    box.style.cssText = 'width:min(460px,90vw);background:#2b2b2b;color:#fff;border:1px solid #3d3d3d;border-radius:8px;box-shadow:0 24px 64px rgba(0,0,0,.55);overflow:hidden;animation:ccsDemoPop .16s cubic-bezier(.2,.9,.3,1.2)';
    box.innerHTML = `
      <div style="display:flex;align-items:center;gap:8px;height:32px;padding:0 12px;font-size:12px;color:#ddd"><span style="font-size:13px">${icon}</span><span class="t"></span></div>
      <div class="m" style="padding:14px 24px 22px;font-size:14px;line-height:1.45;white-space:pre-wrap"></div>
      <div style="display:flex;justify-content:flex-end;gap:8px;padding:18px 24px;background:#202020;border-top:1px solid #353535"></div>`;
    (box.querySelector('.t') as HTMLElement).textContent = title ?? 'ChannelCraft Studio';
    (box.querySelector('.m') as HTMLElement).textContent = message;
    const bar = box.lastElementChild as HTMLElement;
    const close = (label: string) => {
      wrap.remove();
      done(label);
    };
    labels.forEach((label, i) => {
      if (label === null) return;
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = label;
      b.setAttribute('data-demo-button', i === 0 ? 'ok' : 'cancel');
      b.style.cssText = `min-width:96px;height:32px;padding:0 14px;border-radius:4px;font:inherit;font-size:14px;cursor:default;${i === 0 ? 'background:#4cc2ff;color:#000;border:1px solid #4cc2ff' : 'background:#373737;color:#fff;border:1px solid #444'}`;
      b.onclick = () => close(label);
      bar.appendChild(b);
    });
    if (!document.getElementById('ccs-demo-style')) {
      const st = document.createElement('style');
      st.id = 'ccs-demo-style';
      st.textContent = '@keyframes ccsDemoFade{from{opacity:0}}@keyframes ccsDemoPop{from{opacity:0;transform:scale(.96)}}';
      document.head.appendChild(st);
    }
    wrap.appendChild(box);
    document.body.appendChild(wrap);
  });
}

async function demoPlugin(cmd: string, args: Record<string, unknown>): Promise<unknown> {
  const ctl = window.__ccsDemo!;
  const [plugin, fn] = cmd.slice('plugin:'.length).split('|');
  if (plugin === 'store') {
    const key = `${args.rid ?? 1}:${args.key}`;
    if (fn === 'load' || fn === 'get_store') return 1;
    if (fn === 'get') return store.has(key) ? [store.get(key), true] : [null, false];
    if (fn === 'set') return void store.set(key, args.value);
    if (fn === 'has') return store.has(key);
    if (fn === 'delete') return store.delete(key);
    return null;
  }
  if (plugin === 'dialog') {
    ctl.asked.push({ kind: fn, options: args.options ?? args, at: Date.now() });
    if (fn === 'open' || fn === 'save') return ctl.dialogs.length ? ctl.dialogs.shift() : null;
    if (fn === 'message') {
      const b = args.buttons as string | { OkCancelCustom?: [string, string]; OkCustom?: string } | undefined;
      const labels: [string, string | null] =
        b === 'YesNo' ? ['Yes', 'No'] : b === 'OkCancel' ? ['Ok', 'Cancel'] : typeof b === 'object' && b?.OkCancelCustom ? b.OkCancelCustom : typeof b === 'object' && b?.OkCustom ? [b.OkCustom, null] : ['Ok', null];
      if (ctl.autoAnswer) return ctl.autoAnswer === 'ok' || labels[1] === null ? labels[0] : labels[1];
      return messageBox(String(args.message ?? ''), args.title as string | undefined, args.kind as string | undefined, labels);
    }
    return null;
  }
  // opener, updater (no update), process, window, event...: nothing happens.
  return null;
}

export function installBrowserMock() {
  mockWindows('main');
  mockIPC(async (cmd, args) => {
    if (cmd.startsWith('plugin:') && (await isDemo())) {
      window.__ccsDemo ??= { dialogs: [], asked: [], autoAnswer: null };
      return demoPlugin(cmd, (args ?? {}) as Record<string, unknown>);
    }
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
  // The recorder sets its answers before the app asks; make the object exist from the start.
  void isDemo().then((d) => d && (window.__ccsDemo ??= { dialogs: [], asked: [], autoAnswer: null }));
}
