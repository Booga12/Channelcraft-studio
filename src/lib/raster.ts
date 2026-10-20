// Turns generated SVG artwork into PNG in the webview, for art RetroBat's SVG renderer can't
// draw the same way (patterns, gradient fades).

/** PNG of an SVG at its own width and height, as base64 (no data: prefix). */
export async function svgToPngBase64(svg: string): Promise<string> {
  const img = new Image();
  await new Promise<void>((ok, bad) => {
    img.onload = () => ok();
    img.onerror = () => bad(new Error('SVG could not be drawn'));
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  });
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth || 1920;
  canvas.height = img.naturalHeight || 1080;
  canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/png').split(',')[1];
}
