// User preferences, kept in the webview's local storage.

/** The panels that open from the tool dock beside the preview. */
export type PanelId = 'elements' | 'library' | 'assets' | 'presets' | 'variables' | 'options' | 'history' | 'files';

export type Mode = 'system' | 'light' | 'dark';

export const ACCENTS: Record<string, { label: string; base: string; strong: string }> = {
  channelcraft: { label: 'ChannelCraft', base: '#6d7ff2', strong: '#5163e6' },
  blue: { label: 'Blue', base: '#378ef0', strong: '#2680eb' },
  violet: { label: 'Violet', base: '#9a7cf5', strong: '#7e5bef' },
  green: { label: 'Green', base: '#33b07a', strong: '#22975f' },
  orange: { label: 'Orange', base: '#f08a3a', strong: '#e2711d' },
  pink: { label: 'Pink', base: '#ec5b9c', strong: '#d93f84' },
};

const DEFAULTS = {
  snap: true,
  showGrid: false,
  gridSize: 0.05,
  showSafeArea: false,
  showRulers: true,
  units: '%' as '%' | 'px',
  autosaveMinutes: 0,
  keepRecovery: true,
  backupsKeep: 10,
  accent: 'channelcraft',
  /** Light, dark, or whatever Windows uses. */
  mode: 'system' as Mode,
  uiScale: 1,
  realArtwork: true,
  /** Animations play in the preview. */
  playAnimations: true,
  /** Small movements are shown bigger in the preview, to check them (never saved into the theme). */
  boostMotion: false,
  /** The dock panel stays open while working on the preview. */
  pinPanel: false,
  panelWidth: 320,
  inspectorWidth: 340,
};

type Values = typeof DEFAULTS;

function load(): Values {
  try {
    const raw = localStorage.getItem('ccs.prefs');
    if (raw) {
      const saved = JSON.parse(raw) as Record<string, unknown>;
      // The docked-panel workspaces of older versions no longer apply.
      delete saved.workspace;
      delete saved.customWorkspaces;
      return { ...DEFAULTS, ...saved } as Values;
    }
  } catch {
    // Unreadable preferences: fall back to defaults.
  }
  return structuredClone(DEFAULTS);
}

class Prefs {
  v = $state<Values>(load());

  save() {
    try {
      localStorage.setItem('ccs.prefs', JSON.stringify($state.snapshot(this.v)));
    } catch {
      // Preferences are a convenience; ignore storage failures.
    }
    this.applyLook();
  }

  set<K extends keyof Values>(key: K, value: Values[K]) {
    this.v[key] = value;
    this.save();
  }

  /** Whether the app is drawn dark right now (the mode, or Windows' choice for "system"). */
  dark = $state(false);
  #watching = false;

  /** Light or dark, accent colour and UI size, applied to the document and the window frame. */
  applyLook() {
    if (typeof document === 'undefined') return;
    const media = window.matchMedia?.('(prefers-color-scheme: dark)');
    if (!this.#watching && media) {
      this.#watching = true;
      media.addEventListener('change', () => this.v.mode === 'system' && this.applyLook());
    }
    const mode = this.v.mode ?? 'system';
    this.dark = mode === 'dark' || (mode === 'system' && !!media?.matches);
    const root = document.documentElement;
    root.classList.toggle('dark', this.dark);
    root.style.colorScheme = this.dark ? 'dark' : 'light';
    const a = ACCENTS[this.v.accent] ?? ACCENTS.channelcraft;
    const s = root.style;
    s.setProperty('--brand', a.base);
    s.setProperty('--brand-strong', a.strong);
    s.setProperty('--brand-soft', hexAlpha(a.base, this.dark ? 0.2 : 0.14));
    s.setProperty('zoom', String(this.v.uiScale));
    // The title bar follows too (null hands it back to Windows).
    if ('__TAURI_INTERNALS__' in window) {
      import('@tauri-apps/api/window')
        .then(({ getCurrentWindow }) => getCurrentWindow().setTheme(mode === 'system' ? null : mode))
        .catch(() => {});
    }
  }

  setMode(mode: Mode) {
    this.set('mode', mode);
  }
}

function hexAlpha(hex: string, a: number) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}

export const prefs = new Prefs();
