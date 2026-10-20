// User preferences and the workspace layout, kept in the webview's local storage.

export type PanelId = 'properties' | 'elements' | 'library' | 'presets' | 'variables' | 'options' | 'history' | 'files';

export interface Workspace {
  name: string;
  dockSide: 'right' | 'left';
  dockWidth: number;
  /** Tabs in the upper and lower panel groups, in order. */
  top: PanelId[];
  bottom: PanelId[];
  split: number;
  /** Panels the user closed. */
  hidden?: PanelId[];
  showRail: boolean;
  showOptionsBar: boolean;
}

export const ACCENTS: Record<string, { label: string; base: string; strong: string }> = {
  blue: { label: 'Blue', base: '#378ef0', strong: '#2680eb' },
  violet: { label: 'Violet', base: '#9a7cf5', strong: '#7e5bef' },
  green: { label: 'Green', base: '#33b07a', strong: '#22975f' },
  orange: { label: 'Orange', base: '#f08a3a', strong: '#e2711d' },
  pink: { label: 'Pink', base: '#ec5b9c', strong: '#d93f84' },
};

export const BUILTIN_WORKSPACES: Workspace[] = [
  {
    name: 'Essentials',
    dockSide: 'right',
    dockWidth: 330,
    top: ['properties'],
    bottom: ['elements', 'library', 'presets', 'variables', 'options', 'history', 'files'],
    split: 0.56,
    showRail: true,
    showOptionsBar: true,
  },
  {
    name: 'Layout',
    dockSide: 'right',
    dockWidth: 330,
    top: ['elements', 'history'],
    bottom: ['properties', 'presets', 'library'],
    split: 0.45,
    showRail: true,
    showOptionsBar: true,
  },
  {
    name: 'Colour',
    dockSide: 'right',
    dockWidth: 360,
    top: ['variables', 'options'],
    bottom: ['properties', 'elements', 'presets'],
    split: 0.55,
    showRail: true,
    showOptionsBar: false,
  },
  {
    name: 'Focus',
    dockSide: 'right',
    dockWidth: 300,
    top: ['properties'],
    bottom: ['elements'],
    split: 0.6,
    showRail: false,
    showOptionsBar: true,
  },
];

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
  accent: 'blue',
  uiScale: 1,
  realArtwork: true,
  workspace: BUILTIN_WORKSPACES[0] as Workspace,
  customWorkspaces: [] as Workspace[],
};

type Values = typeof DEFAULTS;

function load(): Values {
  try {
    const raw = localStorage.getItem('ccs.prefs');
    if (raw) {
      const v = { ...DEFAULTS, ...JSON.parse(raw) } as Values;
      // Workspaces saved before a panel existed get it appended, so nothing goes missing.
      const all: PanelId[] = ['properties', 'elements', 'library', 'presets', 'variables', 'options', 'history', 'files'];
      const seen = new Set([...v.workspace.top, ...v.workspace.bottom]);
      v.workspace = { ...v.workspace, bottom: [...v.workspace.bottom, ...all.filter((p) => !seen.has(p) && !v.workspace.hidden?.includes(p))] };
      return v;
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

  setWorkspace(ws: Workspace) {
    this.v.workspace = structuredClone($state.snapshot(ws) as Workspace);
    this.save();
  }

  saveWorkspaceAs(name: string) {
    const ws = { ...structuredClone($state.snapshot(this.v.workspace) as Workspace), name };
    this.v.customWorkspaces = [...this.v.customWorkspaces.filter((w) => w.name !== name), ws];
    this.v.workspace = ws;
    this.save();
  }

  deleteWorkspace(name: string) {
    this.v.customWorkspaces = this.v.customWorkspaces.filter((w) => w.name !== name);
    this.save();
  }

  /** Moves a panel tab to the other group, or hides it (group null). */
  movePanel(id: PanelId, to: 'top' | 'bottom' | null) {
    const ws = this.v.workspace;
    ws.top = ws.top.filter((p) => p !== id);
    ws.bottom = ws.bottom.filter((p) => p !== id);
    ws.hidden = (ws.hidden ?? []).filter((p) => p !== id);
    if (to === 'top') ws.top.push(id);
    else if (to === 'bottom') ws.bottom.push(id);
    else ws.hidden.push(id);
    this.save();
  }

  /** Accent colour and UI size, applied as CSS on the document. */
  applyLook() {
    if (typeof document === 'undefined') return;
    const a = ACCENTS[this.v.accent] ?? ACCENTS.blue;
    const s = document.documentElement.style;
    s.setProperty('--accent', a.base);
    s.setProperty('--accent-strong', a.strong);
    s.setProperty('--accent-soft', hexAlpha(a.base, 0.18));
    s.setProperty('zoom', String(this.v.uiScale));
  }
}

function hexAlpha(hex: string, a: number) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}

export const prefs = new Prefs();
