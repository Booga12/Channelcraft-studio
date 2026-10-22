// Names, help and icons for the theme's screens (theme.xml views and RetroBat's loading screens).
import type { Component } from 'svelte';
import LayoutGridIcon from '@lucide/svelte/icons/layout-grid';
import ListIcon from '@lucide/svelte/icons/list';
import ListVideoIcon from '@lucide/svelte/icons/list-video';
import GalleryHorizontalIcon from '@lucide/svelte/icons/gallery-horizontal';
import SettingsIcon from '@lucide/svelte/icons/settings';
import MonitorIcon from '@lucide/svelte/icons/monitor';
import SparklesIcon from '@lucide/svelte/icons/sparkles';
import RocketIcon from '@lucide/svelte/icons/rocket';
import FileIcon from '@lucide/svelte/icons/file';
import { ed } from '$lib/editor.svelte';
import { viewHelp, viewLabel } from '$lib/friendly';
import type { Ratio } from '$lib/theme/context';

export interface Screen {
  id: string;
  view: string;
  file: string;
}

const ICONS: Record<string, Component> = {
  system: LayoutGridIcon,
  basic: ListIcon,
  detailed: ListIcon,
  video: ListVideoIcon,
  grid: LayoutGridIcon,
  gamecarousel: GalleryHorizontalIcon,
  menu: SettingsIcon,
  screen: MonitorIcon,
  splash: SparklesIcon,
};

const FILES: Record<string, { label: string; help: string }> = {
  'splash.xml': { label: 'Loading screen', help: 'splash.xml: what RetroBat shows while it starts up.' },
  'gamesplash.xml': { label: 'Game launch screen', help: 'gamesplash.xml: what RetroBat shows while a game starts.' },
};

export const RATIOS: { v: Ratio; label: string }[] = [
  { v: '16/9', label: 'Widescreen TV (16:9)' },
  { v: '16/10', label: 'Laptop (16:10)' },
  { v: '4/3', label: 'Old TV (4:3)' },
];

export function screenIcon(t: Screen): Component {
  return t.file === 'gamesplash.xml' ? RocketIcon : (ICONS[t.view] ?? FileIcon);
}

export function screenLabel(t: Screen): string {
  if (FILES[t.file]) return FILES[t.file].label;
  // RetroBat reads its loading screen from splash.xml, not from theme.xml's splash view.
  if (t.view === 'splash') return 'Splash (theme.xml)';
  return viewLabel(t.view, ed.themeRes?.views.get(t.view)?.displayName);
}

export function screenHelp(t: Screen): string {
  if (FILES[t.file]) return FILES[t.file].help;
  const hasSplashFile = ed.screens.some((s) => s.file === 'splash.xml');
  if (t.view === 'splash') return `RetroBat 8 reads its loading screen from splash.xml${hasSplashFile ? ' (the Loading screen)' : ''}, not from this view in theme.xml.`;
  return viewHelp(t.view) ?? t.view;
}

export const isCurrent = (t: Screen) => ed.view === t.view && ed.screenFile === t.file;
