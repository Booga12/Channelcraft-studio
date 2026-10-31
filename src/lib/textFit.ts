// How many lines a piece of text takes in the preview, for the Text card's "Goes onto 2 lines"
// warning and its Make it fit button.

/** The smallest size Make it fit goes down to (a share of the screen height): below this the
 * text can't be read on a TV. */
export const MIN_FIT_SIZE = 0.02;

/**
 * Counts the lines in a text's boxes: one box per line fragment of each text node, as
 * Range.getClientRects gives them for the text nodes only (not the elements around them, whose
 * own box would count as an extra line). Boxes on one line can sit at slightly different heights
 * (a ▶ drawn from a fallback font, say), so a box starts a new line only when its middle is below
 * the line so far.
 */
export function countLines(rects: Iterable<{ top: number; bottom: number; width: number }>): number {
  const boxes = [...rects].filter((r) => r.width > 0 && r.bottom > r.top).sort((a, b) => a.top - b.top);
  let lines = 0;
  let bottom = -Infinity;
  for (const r of boxes) {
    if ((r.top + r.bottom) / 2 > bottom) {
      lines++;
      bottom = r.bottom;
    } else bottom = Math.max(bottom, r.bottom);
  }
  return Math.max(1, lines);
}

/** The boxes of the text nodes inside `node`, line fragment by line fragment. */
export function textRects(node: Node): DOMRect[] {
  const out: DOMRect[] = [];
  const walk = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
  const range = document.createRange();
  for (let t = walk.nextNode(); t; t = walk.nextNode()) {
    if (!t.textContent?.trim()) continue;
    range.selectNodeContents(t);
    out.push(...range.getClientRects());
  }
  return out;
}
