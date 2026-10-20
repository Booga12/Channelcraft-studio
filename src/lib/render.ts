import type { ResolvedElement } from './theme/resolver';

/** ES default draw order when a theme sets no zIndex. */
export function defaultZ(el: ResolvedElement): number {
  const n = el.name;
  if (n === 'background') return 0;
  if (n === 'logo' || n === 'logoText') return 50;
  if (n === 'gamelist') return 20;
  if (n === 'systemcarousel') return 40;
  if (n === 'help') return 100;
  if (n === 'md_image' || n === 'md_video' || n === 'md_thumbnail') return 30;
  if (n === 'md_marquee') return 35;
  if (n.startsWith('md_')) return 40;
  return 10;
}

export function zOf(el: ResolvedElement): number {
  const z = parseFloat(el.props.get('zIndex')?.value ?? '');
  return Number.isFinite(z) ? z : defaultZ(el);
}

export function isVisible(el: ResolvedElement): boolean {
  const v = el.props.get('visible')?.value.trim().toLowerCase();
  return v !== 'false' && v !== '0';
}

export const TYPE_ICON: Record<string, string> = {
  image: '▣',
  text: 'T',
  textlist: '≡',
  rating: '★',
  datetime: '◷',
  clock: '◷',
  video: '▶',
  ninepatch: '▢',
  carousel: '⇆',
  imagegrid: '▦',
  gridtile: '▦',
  helpsystem: 'ⓘ',
  sound: '♪',
  container: '⬚',
  stackpanel: '⬚',
};

/** In the system view `logo` and `logoText` style each carousel entry rather than drawing on their own. */
export function isCarouselPart(view: string, el: ResolvedElement): boolean {
  return view === 'system' && (el.name === 'logo' || el.name === 'logoText');
}
