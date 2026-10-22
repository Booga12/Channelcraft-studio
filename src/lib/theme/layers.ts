// Layer order from the Layers panel's drag and drop, written as zIndex values. RetroBat draws
// higher zIndex on top; elements with the same zIndex keep their order in the files. zIndex is a
// decimal there, so a layer dropped between two others can usually take a value between theirs
// and nothing else needs to change.

export interface Layer {
  name: string;
  z: number;
}

const round = (n: number) => Math.round(n * 1000) / 1000;

/**
 * The layers top first with `moving` taken out and put back before `before` (null = at the
 * bottom), keeping their own order.
 */
export function reorder(layers: Layer[], moving: string[], before: string | null): Layer[] {
  const set = new Set(moving);
  const moved = layers.filter((l) => set.has(l.name));
  const rest = layers.filter((l) => !set.has(l.name));
  let at = before === null ? rest.length : rest.findIndex((l) => l.name === before);
  if (at < 0) at = rest.length;
  return [...rest.slice(0, at), ...moved, ...rest.slice(at)];
}

/**
 * New zIndex values that draw `order` (top first) in that order. Moved layers fit between their
 * neighbours; a layer that is not moved keeps its value unless something now below it is drawn
 * higher, in which case it is lifted just above. Returns only the values that change.
 */
export function zIndexFor(order: Layer[], moved: Set<string>): Record<string, number> {
  const up = [...order].reverse(); // bottom first
  const out: Record<string, number> = {};
  let prev = -Infinity;
  let prevMoved = false;
  for (let i = 0; i < up.length; i++) {
    const l = up[i];
    if (!moved.has(l.name)) {
      // Unmoved layers that tie with an unmoved layer below keep their file order: fine as is.
      const ok = l.z > prev || (l.z === prev && !prevMoved);
      const z = ok ? l.z : round(Math.floor(prev) + 1);
      if (z !== l.z) out[l.name] = z;
      prev = z;
      prevMoved = false;
      continue;
    }
    // A run of moved layers shares the room between the layer below and the next unmoved one above.
    let j = i;
    while (j < up.length && moved.has(up[j].name)) j++;
    const run = up.slice(i, j);
    const ceil = j < up.length ? up[j].z : Infinity;
    const floor = Number.isFinite(prev) ? prev : Math.min(0, ...run.map((r) => r.z), Number.isFinite(ceil) ? ceil - run.length - 1 : 0);
    const room = ceil - floor;
    run.forEach((r, k) => {
      let z: number;
      if (Number.isFinite(ceil) && room > 0.01 * (run.length + 1)) z = round(floor + (room * (k + 1)) / (run.length + 1));
      else z = round(Math.floor(floor) + k + 1);
      // A whole number when one fits, so the files stay tidy.
      const whole = Math.floor(floor) + k + 1;
      if (whole > (k ? prev : floor) && whole < ceil) z = whole;
      if (!(z > prev)) z = round(prev + 1);
      if (z !== r.z) out[r.name] = z;
      prev = z;
    });
    prevMoved = true;
    i = j - 1;
  }
  return out;
}
