// RetroBat's own clock (Window.cpp's mClock), drawn over every screen when its "Show clock"
// setting is on. A theme styles it only with a <text name="clock"> in the "screen" view; without
// one RetroBat puts it at the bottom right in the button hints' font (#58).
import { isVisible } from '../render';
import type { PropDef, ResolvedElement, Resolution } from './resolver';

export interface RetroBatClock {
  /** The clock as a part to draw (type "clock", so the preview shows the time). */
  el: ResolvedElement;
  /** Placed by the theme's Screen overlay, not RetroBat's default spot. */
  themed: boolean;
}

/** Whether a Screen overlay part is the one that styles RetroBat's own clock. */
export function isThemedClock(el: ResolvedElement): boolean {
  return el.name === 'clock' && el.type === 'text';
}

const prop = (name: string, value: string) => ({ name, raw: value, value, conditional: false }) as PropDef;

/** Window.cpp's starting props for mClock: at 94% of the width in a box 5% wide, its line's bottom at 99.65% of the height. */
function clockDefaults(color: string, fs: number): Map<string, PropDef> {
  const top = Math.round((0.9965 - fs * 1.5) * 10000) / 10000;
  return new Map<string, PropDef>([
    ['pos', prop('pos', `0.94 ${top}`)],
    ['size', prop('size', '0.05 0')],
    ['alignment', prop('alignment', 'right')],
    ['verticalAlignment', prop('verticalAlignment', 'top')],
    ['fontSize', prop('fontSize', String(fs))],
    ['color', prop('color', color)],
  ]);
}

const historyOf = (props: Map<string, PropDef>) => new Map<string, PropDef[]>([...props].map(([k, v]) => [k, [v]]));

/** RetroBat's clock as it draws it, or null when the theme hides it. */
export function retrobatClock(res: Resolution | null | undefined): RetroBatClock | null {
  const own = res?.views.get('screen')?.elements.get('clock');
  // RetroBat looks the clock up as a text: a <clock name="clock"> doesn't style it (it is a second clock).
  if (own && isThemedClock(own)) {
    if (!isVisible(own)) return null;
    // applyTheme only changes what the theme sets, so the rest keeps mClock's defaults
    // (small font, grey). The button hints' font isn't used when a text clock exists.
    const props = clockDefaults('777777FF', 0.035);
    const history = historyOf(props);
    for (const [k, v] of own.props) props.set(k, v);
    for (const [k, v] of own.history) history.set(k, v);
    return { el: { ...own, type: 'clock', props, history }, themed: true };
  }
  // Window.cpp: no themed clock, so it takes the console screen's button hints' color and font.
  const help = res?.views.get('system')?.elements.get('help');
  const hint = help?.type === 'helpsystem' ? help : undefined;
  const color = hint?.props.get('textColor')?.value ?? '777777FF';
  const font = hint?.props.get('fontPath');
  const size = hint?.props.get('fontSize')?.value;
  // A font or size from the hints is RetroBat's medium size unless set; otherwise its small one.
  const fs = parseFloat(size ?? '') || (font || size ? 0.045 : 0.035);
  const props = clockDefaults(color, fs);
  const history = historyOf(props);
  if (font) {
    props.set('fontPath', font);
    history.set('fontPath', hint!.history.get('fontPath') ?? [font]);
  }
  return { el: { name: 'clock', type: 'clock', extra: null, defs: [], props, history, complex: [], conditional: false, unknownConditions: 0, order: 0 }, themed: false };
}
