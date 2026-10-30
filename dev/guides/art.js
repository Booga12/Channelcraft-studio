// Runs in a browser page (make-demo.mjs loads it into Edge): draws the demo library's artwork
// on canvases. Everything is generated from the game's title, style and palette, so the art is
// original, the same every run, and has nothing from real games in it.
// window.ART.{cover, shot, logo, fanart, wallpaper, intro} each return a data: URL.
(() => {
  // ---- helpers ----------------------------------------------------------------------------
  function rng(seed) {
    let h = 1779033703 ^ seed.length;
    for (let i = 0; i < seed.length; i++) {
      h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
      h = (h << 13) | (h >>> 19);
    }
    let a = h >>> 0;
    const r = () => {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    r.range = (lo, hi) => lo + r() * (hi - lo);
    r.int = (lo, hi) => Math.floor(lo + r() * (hi - lo + 1));
    r.pick = (arr) => arr[Math.floor(r() * arr.length)];
    return r;
  }
  const canvas = (w, h) => {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    return c;
  };
  const rgb = (hex) => {
    const n = parseInt(hex.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  };
  const css = ([r, g, b], a = 1) => `rgba(${Math.round(r)},${Math.round(g)},${Math.round(b)},${a})`;
  const mix = (a, b, t) => {
    const x = typeof a === 'string' ? rgb(a) : a;
    const y = typeof b === 'string' ? rgb(b) : b;
    return [x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t];
  };
  const shade = (c, t) => (t < 0 ? mix(c, '#000000', -t) : mix(c, '#ffffff', t));
  const lum = (c) => {
    const [r, g, b] = typeof c === 'string' ? rgb(c) : c;
    return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  };
  const glow = (g, x, y, r, color, a = 1) => {
    const rad = g.createRadialGradient(x, y, 0, x, y, r);
    rad.addColorStop(0, css(rgb(color), a));
    rad.addColorStop(1, css(rgb(color), 0));
    g.fillStyle = rad;
    g.fillRect(x - r, y - r, r * 2, r * 2);
  };

  // ---- painted scenes (covers, fanart, wallpapers) -------------------------------------------
  function sky(g, w, h, p, r) {
    const grad = g.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, p[0]);
    grad.addColorStop(0.75, p[1]);
    grad.addColorStop(1, css(shade(p[1], -0.2)));
    g.fillStyle = grad;
    g.fillRect(0, 0, w, h);
    if (lum(p[0]) < 0.3) {
      for (let i = 0; i < (w * h) / 2500; i++) {
        g.fillStyle = `rgba(255,255,255,${r.range(0.2, 0.9)})`;
        const s = r() < 0.08 ? 2.2 : r.range(0.6, 1.4);
        g.fillRect(r() * w, r() * h * 0.7, s, s);
      }
    }
  }
  function mountains(g, w, h, base, color, rough, r) {
    g.fillStyle = color;
    g.beginPath();
    g.moveTo(0, h);
    let y = base;
    for (let x = 0; x <= w + 40; x += w / 18) {
      y = base + r.range(-rough, rough);
      g.lineTo(x, y);
    }
    g.lineTo(w, h);
    g.closePath();
    g.fill();
  }
  function sun(g, x, y, rad, p, striped) {
    glow(g, x, y, rad * 2.4, p[2], 0.45);
    const grad = g.createLinearGradient(0, y - rad, 0, y + rad);
    grad.addColorStop(0, p[3]);
    grad.addColorStop(1, p[2]);
    g.save();
    g.beginPath();
    g.arc(x, y, rad, 0, Math.PI * 2);
    g.clip();
    g.fillStyle = grad;
    g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
    if (striped) {
      g.globalCompositeOperation = 'destination-out';
      for (let i = 0; i < 7; i++) {
        const yy = y + rad * (0.1 + i * 0.13);
        g.fillRect(x - rad, yy, rad * 2, 2 + i * 1.6);
      }
    }
    g.restore();
  }
  function figure(g, x, y, s, color, facing = 1, pose = 0) {
    // A stylised hero silhouette: head, torso, arms and legs as thick round strokes.
    g.save();
    g.translate(x, y);
    g.scale(s * facing, s);
    g.strokeStyle = color;
    g.fillStyle = color;
    g.lineCap = 'round';
    g.lineJoin = 'round';
    g.lineWidth = 15;
    g.beginPath();
    g.arc(0, -92, 13, 0, Math.PI * 2);
    g.fill();
    g.beginPath();
    g.moveTo(0, -74);
    g.lineTo(-4, -30);
    g.stroke();
    g.lineWidth = 11;
    g.beginPath();
    g.moveTo(-2, -68);
    g.lineTo(26, -60 - pose * 20);
    g.lineTo(46, -78 - pose * 22);
    g.moveTo(-2, -68);
    g.lineTo(-24, -52);
    g.lineTo(-14, -34);
    g.stroke();
    g.lineWidth = 13;
    g.beginPath();
    g.moveTo(-4, -30);
    g.lineTo(18, 0);
    g.lineTo(26, 30);
    g.moveTo(-4, -30);
    g.lineTo(-22, 2);
    g.lineTo(-34, 30);
    g.stroke();
    g.restore();
  }
  function ship(g, x, y, s, p) {
    g.save();
    g.translate(x, y);
    g.scale(s, s);
    glow(g, 0, 70, 70, p[2], 0.9);
    glow(g, -26, 62, 30, p[3], 0.8);
    glow(g, 26, 62, 30, p[3], 0.8);
    const body = g.createLinearGradient(-60, 0, 60, 0);
    body.addColorStop(0, '#5b6378');
    body.addColorStop(0.5, '#e8ecf5');
    body.addColorStop(1, '#4a5163');
    g.fillStyle = body;
    g.beginPath();
    g.moveTo(0, -90);
    g.lineTo(18, -30);
    g.lineTo(70, 30);
    g.lineTo(70, 48);
    g.lineTo(22, 40);
    g.lineTo(12, 58);
    g.lineTo(-12, 58);
    g.lineTo(-22, 40);
    g.lineTo(-70, 48);
    g.lineTo(-70, 30);
    g.lineTo(-18, -30);
    g.closePath();
    g.fill();
    g.fillStyle = css(rgb(p[2]));
    g.fillRect(-70, 30, 16, 18);
    g.fillRect(54, 30, 16, 18);
    const glass = g.createLinearGradient(0, -60, 0, -10);
    glass.addColorStop(0, p[3]);
    glass.addColorStop(1, css(shade(p[2], -0.4)));
    g.fillStyle = glass;
    g.beginPath();
    g.ellipse(0, -30, 9, 24, 0, 0, Math.PI * 2);
    g.fill();
    g.restore();
  }
  function blockCube(g, x, y, s, color) {
    const c = typeof color === 'string' ? rgb(color) : color;
    g.fillStyle = css(shade(c, 0.25));
    g.beginPath();
    g.moveTo(x, y - s * 0.5);
    g.lineTo(x + s, y);
    g.lineTo(x, y + s * 0.5);
    g.lineTo(x - s, y);
    g.closePath();
    g.fill();
    g.fillStyle = css(c);
    g.beginPath();
    g.moveTo(x - s, y);
    g.lineTo(x, y + s * 0.5);
    g.lineTo(x, y + s * 1.6);
    g.lineTo(x - s, y + s * 1.1);
    g.closePath();
    g.fill();
    g.fillStyle = css(shade(c, -0.3));
    g.beginPath();
    g.moveTo(x + s, y);
    g.lineTo(x, y + s * 0.5);
    g.lineTo(x, y + s * 1.6);
    g.lineTo(x + s, y + s * 1.1);
    g.closePath();
    g.fill();
  }
  function tree(g, x, base, hgt, color) {
    g.fillStyle = color;
    g.beginPath();
    g.moveTo(x, base - hgt);
    g.lineTo(x + hgt * 0.28, base);
    g.lineTo(x - hgt * 0.28, base);
    g.closePath();
    g.fill();
  }

  function paintScene(g, w, h, spec, r, { title = true } = {}) {
    const p = spec.palette;
    const style = spec.style;
    const U = Math.min(w, h) / 600;
    sky(g, w, h, p, r);
    const horizon = h * (title ? 0.64 : 0.6);
    if (style === 'racer') {
      sun(g, w * 0.5, horizon - h * 0.11, w * 0.2, p, true);
      mountains(g, w, h, horizon - h * 0.03, css(shade(p[0], -0.2)), h * 0.05, r);
      g.fillStyle = css(shade(p[0], -0.55));
      g.fillRect(0, horizon, w, h - horizon);
      g.strokeStyle = css(rgb(p[2]), 0.85);
      g.lineWidth = 2 * U;
      g.shadowColor = p[2];
      g.shadowBlur = 12 * U;
      for (let i = -12; i <= 12; i++) {
        g.beginPath();
        g.moveTo(w / 2 + i * w * 0.02, horizon);
        g.lineTo(w / 2 + i * w * 0.22, h);
        g.stroke();
      }
      for (let k = 1; k < 12; k++) {
        const yy = horizon + (h - horizon) * Math.pow(k / 11, 2.2);
        g.beginPath();
        g.moveTo(0, yy);
        g.lineTo(w, yy);
        g.stroke();
      }
      g.shadowBlur = 0;
      // The car from behind.
      const cx = w * 0.5;
      const cy = h * 0.86;
      const cw = w * 0.36;
      g.fillStyle = '#0d0d14';
      g.fillRect(cx - cw * 0.48, cy + cw * 0.08, cw * 0.18, cw * 0.14);
      g.fillRect(cx + cw * 0.3, cy + cw * 0.08, cw * 0.18, cw * 0.14);
      const body = g.createLinearGradient(0, cy - cw * 0.2, 0, cy + cw * 0.12);
      body.addColorStop(0, css(shade(p[2], 0.2)));
      body.addColorStop(1, css(shade(p[2], -0.45)));
      g.fillStyle = body;
      g.beginPath();
      g.moveTo(cx - cw * 0.5, cy + cw * 0.12);
      g.lineTo(cx - cw * 0.46, cy - cw * 0.06);
      g.lineTo(cx - cw * 0.26, cy - cw * 0.2);
      g.lineTo(cx + cw * 0.26, cy - cw * 0.2);
      g.lineTo(cx + cw * 0.46, cy - cw * 0.06);
      g.lineTo(cx + cw * 0.5, cy + cw * 0.12);
      g.closePath();
      g.fill();
      g.fillStyle = 'rgba(20,20,40,.85)';
      g.fillRect(cx - cw * 0.22, cy - cw * 0.17, cw * 0.44, cw * 0.09);
      for (const s of [-1, 1]) {
        glow(g, cx + s * cw * 0.36, cy + cw * 0.02, cw * 0.12, '#ff2d55', 0.9);
        g.fillStyle = '#ff6b81';
        g.fillRect(cx + s * cw * 0.36 - cw * 0.07, cy - cw * 0.005, cw * 0.14, cw * 0.035);
      }
    } else if (style === 'shmup') {
      glow(g, w * 0.72, h * 0.28, w * 0.5, p[2], 0.25);
      g.fillStyle = css(shade(p[1], 0.15));
      g.beginPath();
      g.arc(w * 0.78, h * 0.22, w * 0.16, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = css(shade(p[1], -0.25), 0.8);
      g.beginPath();
      g.arc(w * 0.74, h * 0.2, w * 0.15, 0, Math.PI * 2);
      g.fill();
      for (let i = 0; i < 5; i++) {
        g.strokeStyle = css(rgb(p[3]), 0.75);
        g.lineWidth = 3 * U;
        g.shadowColor = p[3];
        g.shadowBlur = 10 * U;
        const lx = w * r.range(0.2, 0.8);
        g.beginPath();
        g.moveTo(lx, h * r.range(0.1, 0.4));
        g.lineTo(lx, h * r.range(0.45, 0.6));
        g.stroke();
      }
      g.shadowBlur = 0;
      for (let i = 0; i < 6; i++) {
        const ex = w * r.range(0.1, 0.9);
        const ey = h * r.range(0.12, 0.45);
        glow(g, ex, ey, 26 * U, p[2], 0.7);
        g.fillStyle = css(shade(p[2], -0.3));
        g.beginPath();
        g.moveTo(ex, ey + 14 * U);
        g.lineTo(ex + 16 * U, ey - 8 * U);
        g.lineTo(ex - 16 * U, ey - 8 * U);
        g.closePath();
        g.fill();
      }
      ship(g, w * 0.5, h * 0.72, 1.6 * U * (title ? 1 : 0.8), p);
    } else if (style === 'platformer') {
      sun(g, w * r.range(0.15, 0.85), h * (title ? 0.42 : 0.2), w * 0.07, p, false);
      for (let k = 0; k < 4; k++) {
        g.fillStyle = 'rgba(255,255,255,.85)';
        const cx = w * r.range(0.05, 0.95);
        const cy = h * (title ? r.range(0.4, 0.5) : r.range(0.12, 0.4));
        for (let j = 0; j < 4; j++) {
          g.beginPath();
          g.arc(cx + j * 22 * U, cy + (j % 2) * 6 * U, (18 + (j % 2) * 8) * U, 0, Math.PI * 2);
          g.fill();
        }
      }
      const green = mix(p[2], '#3a9d23', 0.55);
      for (let layer = 0; layer < 3; layer++) {
        g.fillStyle = css(shade(green, -0.15 - layer * 0.18));
        g.beginPath();
        g.moveTo(0, h);
        for (let x = 0; x <= w; x += 8) g.lineTo(x, horizon + layer * h * 0.07 + Math.sin(x / (w * 0.12) + layer * 2 + r() * 0.05) * h * 0.035);
        g.lineTo(w, h);
        g.fill();
      }
      for (let i = 0; i < 3; i++) {
        const px = w * (0.08 + i * 0.3 + r.range(0, 0.06));
        const py = h * (0.56 - (i % 2) * 0.06 + r.range(-0.02, 0.02));
        g.fillStyle = css(shade(p[2], -0.4));
        g.beginPath();
        g.roundRect(px, py, w * 0.2, h * 0.04, 8 * U);
        g.fill();
        g.fillStyle = css(green);
        g.beginPath();
        g.roundRect(px, py, w * 0.2, h * 0.015, 6 * U);
        g.fill();
        for (let c = 0; c < 3; c++) {
          glow(g, px + w * (0.04 + c * 0.06), py - h * 0.04, 16 * U, '#ffd166', 0.8);
          g.fillStyle = '#ffd166';
          g.beginPath();
          g.ellipse(px + w * (0.04 + c * 0.06), py - h * 0.04, 7 * U, 10 * U, 0, 0, Math.PI * 2);
          g.fill();
        }
      }
      // The hero: a round fellow with a cape, mid-jump.
      const hx = w * r.range(0.32, 0.62);
      const hy = h * r.range(0.72, 0.78);
      const R = 60 * U;
      g.fillStyle = css(shade(p[2], -0.2));
      g.beginPath();
      g.moveTo(hx - R * 0.5, hy - R * 0.3);
      g.quadraticCurveTo(hx - R * 2, hy + R * 0.2, hx - R * 1.6, hy + R * 1.1);
      g.lineTo(hx, hy + R * 0.3);
      g.fill();
      const bodyGrad = g.createRadialGradient(hx - R * 0.3, hy - R * 0.4, R * 0.1, hx, hy, R);
      bodyGrad.addColorStop(0, css(shade(p[3], 0.1)));
      bodyGrad.addColorStop(1, css(shade(p[2], -0.1)));
      g.fillStyle = bodyGrad;
      g.beginPath();
      g.arc(hx, hy, R, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#fff';
      for (const s of [-1, 1]) {
        g.beginPath();
        g.ellipse(hx + s * R * 0.32 + R * 0.12, hy - R * 0.15, R * 0.2, R * 0.28, 0, 0, Math.PI * 2);
        g.fill();
      }
      g.fillStyle = '#1a1a2e';
      for (const s of [-1, 1]) {
        g.beginPath();
        g.arc(hx + s * R * 0.32 + R * 0.2, hy - R * 0.12, R * 0.1, 0, Math.PI * 2);
        g.fill();
      }
    } else if (style === 'rpg') {
      g.fillStyle = css(rgb(p[3]), 0.9);
      g.beginPath();
      g.arc(w * 0.75, h * 0.2, w * 0.07, 0, Math.PI * 2);
      g.fill();
      glow(g, w * 0.75, h * 0.2, w * 0.25, p[3], 0.3);
      mountains(g, w, h, horizon - h * 0.12, css(shade(p[0], 0.15)), h * 0.06, r);
      // The castle on its cliff.
      const cx = w * 0.32;
      const cb = horizon - h * 0.02;
      g.fillStyle = css(shade(p[0], -0.35));
      g.beginPath();
      g.moveTo(cx - w * 0.3, h);
      g.lineTo(cx - w * 0.18, cb);
      g.lineTo(cx + w * 0.2, cb);
      g.lineTo(cx + w * 0.32, h);
      g.fill();
      for (const [dx, tw, th] of [
        [-0.12, 0.06, 0.2],
        [-0.03, 0.08, 0.3],
        [0.08, 0.06, 0.22],
      ]) {
        const tx = cx + w * dx;
        g.fillRect(tx, cb - h * th, w * tw, h * th);
        g.beginPath();
        g.moveTo(tx - w * 0.01, cb - h * th);
        g.lineTo(tx + (w * tw) / 2, cb - h * th - h * 0.08);
        g.lineTo(tx + w * tw + w * 0.01, cb - h * th);
        g.fill();
        g.fillStyle = css(rgb(p[2]), 0.95);
        g.fillRect(tx + w * tw * 0.4, cb - h * th * 0.75, w * tw * 0.2, h * 0.025);
        g.fillStyle = css(shade(p[0], -0.35));
      }
      g.fillStyle = 'rgba(255,255,255,.08)';
      for (let i = 0; i < 4; i++) g.fillRect(0, horizon + i * h * 0.04, w, h * 0.02);
      figure(g, w * 0.7, h * 0.93, 1.5 * U, css(shade(p[0], -0.7)), -1, 1);
      g.strokeStyle = css(rgb(p[3]));
      g.lineWidth = 5 * U;
      g.beginPath();
      g.moveTo(w * 0.7 - 46 * 1.5 * U, h * 0.93 - 78 * 1.5 * U - 22 * 1.5 * U);
      g.lineTo(w * 0.7 - 70 * 1.5 * U, h * 0.93 - 175 * 1.5 * U);
      g.stroke();
    } else if (style === 'fighter' || style === 'brawler') {
      g.save();
      g.translate(w / 2, h * 0.55);
      for (let i = 0; i < 28; i++) {
        g.rotate((Math.PI * 2) / 28);
        g.fillStyle = css(rgb(p[2]), i % 2 ? 0.16 : 0.06);
        g.beginPath();
        g.moveTo(0, 0);
        g.lineTo(w, -w * 0.08);
        g.lineTo(w, w * 0.08);
        g.fill();
      }
      g.restore();
      if (style === 'brawler') {
        for (let i = 0; i < 14; i++) {
          const bw = w * r.range(0.05, 0.11);
          const bh = h * r.range(0.15, 0.4);
          const bx = (i / 14) * w;
          g.fillStyle = css(shade(p[0], -0.3));
          g.fillRect(bx, horizon - bh, bw, bh + h);
          for (let y = horizon - bh + 8 * U; y < horizon; y += 14 * U)
            for (let x = bx + 5 * U; x < bx + bw - 6 * U; x += 10 * U) if (r() < 0.45) {
              g.fillStyle = css(rgb(r() < 0.5 ? p[2] : p[3]), 0.7);
              g.fillRect(x, y, 5 * U, 7 * U);
            }
        }
        glow(g, w * 0.25, horizon - h * 0.3, w * 0.12, p[2], 0.6);
      }
      g.fillStyle = css(shade(p[0], -0.5));
      g.fillRect(0, horizon + h * 0.06, w, h);
      glow(g, w / 2, h * 0.6, w * 0.2, p[3], 0.7);
      figure(g, w * 0.3, h * 0.92, 1.8 * U, css(shade(p[2], -0.65)), 1, 1);
      figure(g, w * 0.7, h * 0.92, 1.8 * U, css(shade(p[1], -0.7)), -1, 0);
    } else if (style === 'puzzle') {
      const colours = [rgb(p[2]), rgb(p[3]), shade(p[1], 0.3), mix(p[2], p[3], 0.5)];
      for (let i = 0; i < 26; i++) {
        const s = r.range(26, 64) * U;
        blockCube(g, w * r.range(0.05, 0.95), h * r.range(0.25, 0.92), s, r.pick(colours));
      }
      for (let i = 0; i < 30; i++) glow(g, r() * w, r() * h, r.range(3, 10) * U, p[3], 0.8);
    } else if (style === 'sports') {
      g.fillStyle = css(mix(p[0], '#2d6a4f', 0.6));
      g.fillRect(0, horizon, w, h);
      for (let i = 0; i < 8; i++) {
        g.fillStyle = `rgba(255,255,255,${i % 2 ? 0.05 : 0})`;
        g.fillRect(0, horizon + ((h - horizon) * i) / 8, w, (h - horizon) / 8);
      }
      for (const lx of [0.15, 0.85]) glow(g, w * lx, h * 0.12, w * 0.25, '#ffffff', 0.5);
      const bx = w * 0.56;
      const by = h * 0.58;
      const br = w * 0.17;
      for (let i = 1; i < 6; i++) glow(g, bx - i * br * 0.5, by + i * br * 0.25, br * (1 - i * 0.12), p[2], 0.25);
      const ballGrad = g.createRadialGradient(bx - br * 0.3, by - br * 0.3, br * 0.1, bx, by, br);
      ballGrad.addColorStop(0, '#ffffff');
      ballGrad.addColorStop(1, css(shade(p[2], -0.1)));
      g.fillStyle = ballGrad;
      g.beginPath();
      g.arc(bx, by, br, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = css(shade(p[2], -0.5));
      g.lineWidth = 6 * U;
      g.beginPath();
      g.arc(bx, by, br * 0.98, 0, Math.PI * 2);
      g.moveTo(bx - br, by);
      g.quadraticCurveTo(bx, by - br * 0.5, bx + br, by);
      g.moveTo(bx, by - br);
      g.quadraticCurveTo(bx + br * 0.5, by, bx, by + br);
      g.stroke();
    } else {
      // adventure: a forest at dusk and a lantern.
      for (let layer = 0; layer < 4; layer++) {
        const col = css(shade(mix(p[0], p[1], 0.3), -0.1 - layer * 0.2));
        for (let i = 0; i < 16; i++) tree(g, (i / 15) * w + r.range(-20, 20) * U, horizon + layer * h * 0.08, h * r.range(0.25, 0.45), col);
      }
      g.fillStyle = css(shade(p[0], -0.7));
      g.fillRect(0, horizon + h * 0.28, w, h);
      glow(g, w * 0.55, h * 0.72, w * 0.35, p[2], 0.6);
      figure(g, w * 0.48, h * 0.94, 1.4 * U, css(shade(p[0], -0.8)), 1, 1);
      glow(g, w * 0.48 + 66 * 1.4 * U, h * 0.94 - 110 * 1.4 * U, 40 * U, p[3], 1);
      for (let i = 0; i < 24; i++) glow(g, r() * w, h * r.range(0.3, 0.85), r.range(3, 7) * U, p[3], 0.9);
    }
    const v = g.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.max(w, h) * 0.75);
    v.addColorStop(0, 'rgba(0,0,0,0)');
    v.addColorStop(1, 'rgba(0,0,0,.55)');
    g.fillStyle = v;
    g.fillRect(0, 0, w, h);
  }

  function fitTitle(g, text, maxW, maxH, font, maxSize) {
    const words = text.toUpperCase().split(' ');
    for (let size = maxSize; size > 12; size -= 2) {
      g.font = `${size}px ${font}`;
      const lines = [];
      let line = '';
      for (const wd of words) {
        const test = line ? `${line} ${wd}` : wd;
        if (g.measureText(test).width > maxW && line) {
          lines.push(line);
          line = wd;
        } else line = test;
      }
      lines.push(line);
      const widest = Math.max(...lines.map((l) => g.measureText(l).width));
      if (lines.length <= 2 && widest <= maxW && lines.length * size * 1.02 <= maxH) return { size, lines };
    }
    return { size: 14, lines: [text.toUpperCase()] };
  }
  const FONTS = ['"Arial Black", sans-serif', 'Impact, "Arial Black", sans-serif', '"Segoe UI Black", "Arial Black", sans-serif', '"Arial Black", sans-serif'];
  const fontFor = (spec) => rng(spec.title + 'font').pick(FONTS);
  function drawTitle(g, spec, cx, top, maxW, maxH, maxSize) {
    const font = fontFor(spec);
    const { size, lines } = fitTitle(g, spec.title, maxW, maxH, font, maxSize);
    g.font = `${size}px ${font}`;
    g.textAlign = 'center';
    g.textBaseline = 'top';
    const p = spec.palette;
    lines.forEach((l, i) => {
      const y = top + i * size * 1.02;
      const grad = g.createLinearGradient(0, y, 0, y + size);
      grad.addColorStop(0, p[3]);
      grad.addColorStop(0.55, css(mix(p[3], p[2], 0.6)));
      grad.addColorStop(1, p[2]);
      g.lineJoin = 'round';
      g.shadowColor = 'rgba(0,0,0,.6)';
      g.shadowBlur = size * 0.25;
      g.shadowOffsetY = size * 0.06;
      g.strokeStyle = css(shade(p[0], -0.65));
      g.lineWidth = Math.max(4, size * 0.16);
      g.strokeText(l, cx, y);
      g.shadowColor = 'transparent';
      g.fillStyle = grad;
      g.fillText(l, cx, y);
    });
    return top + lines.length * size * 1.02;
  }
  const TAGLINE = {
    platformer: 'A JUMP-AND-RUN ADVENTURE',
    shmup: 'BLAST THROUGH THE STARS',
    racer: 'FULL SPEED AHEAD',
    puzzle: 'THE ADDICTIVE PUZZLE GAME',
    rpg: 'AN EPIC QUEST AWAITS',
    fighter: 'THE ULTIMATE SHOWDOWN',
    brawler: 'TAKE BACK THE STREETS',
    sports: 'GAME ON!',
    adventure: 'A JOURNEY INTO THE UNKNOWN',
  };

  function cover(spec, w = 600, h = 800) {
    const c = canvas(w, h);
    const g = c.getContext('2d');
    const r = rng(spec.title);
    paintScene(g, w, h, spec, r);
    const band = 56;
    const bg = g.createLinearGradient(0, 0, 0, band);
    bg.addColorStop(0, 'rgba(10,10,18,.95)');
    bg.addColorStop(1, 'rgba(10,10,18,.75)');
    g.fillStyle = bg;
    g.fillRect(0, 0, w, band);
    g.fillStyle = spec.palette[2];
    g.fillRect(0, band - 4, w, 4);
    g.font = '600 18px "Segoe UI", sans-serif';
    g.textBaseline = 'middle';
    g.textAlign = 'left';
    g.fillStyle = '#fff';
    g.letterSpacing = '4px';
    g.fillText(spec.band, 22, band / 2);
    g.textAlign = 'right';
    g.fillStyle = 'rgba(255,255,255,.7)';
    g.fillText(`${spec.players} PLAYER${spec.players === '1' ? '' : 'S'}`, w - 22, band / 2);
    g.letterSpacing = '0px';
    const end = drawTitle(g, spec, w / 2, band + 34, w - 70, 230, 96);
    g.font = '700 17px "Segoe UI", sans-serif';
    g.letterSpacing = '3px';
    g.textAlign = 'center';
    g.textBaseline = 'top';
    g.fillStyle = 'rgba(255,255,255,.9)';
    g.shadowColor = 'rgba(0,0,0,.8)';
    g.shadowBlur = 6;
    g.fillText(TAGLINE[spec.style] ?? '', w / 2, end + 12);
    g.shadowBlur = 0;
    g.letterSpacing = '0px';
    g.fillStyle = 'rgba(10,10,18,.8)';
    g.fillRect(0, h - 44, w, 44);
    g.font = '600 16px "Segoe UI", sans-serif';
    g.textBaseline = 'middle';
    g.textAlign = 'left';
    g.fillStyle = 'rgba(255,255,255,.85)';
    g.fillText(spec.pub, 20, h - 22);
    g.textAlign = 'right';
    g.fillText(spec.year.slice(0, 4), w - 20, h - 22);
    const gloss = g.createLinearGradient(0, 0, w, h);
    gloss.addColorStop(0, 'rgba(255,255,255,.12)');
    gloss.addColorStop(0.35, 'rgba(255,255,255,0)');
    g.fillStyle = gloss;
    g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(0,0,0,.6)';
    g.lineWidth = 6;
    g.strokeRect(0, 0, w, h);
    return c.toDataURL('image/jpeg', 0.9);
  }

  function logo(spec, w = 800, h = 300) {
    const c = canvas(w, h);
    const g = c.getContext('2d');
    const p = spec.palette;
    const font = fontFor(spec);
    const { size, lines } = fitTitle(g, spec.title, w - 60, h - 70, font, 150);
    const total = lines.length * size * 1.02;
    const top = (h - total) / 2 - 10;
    g.save();
    const sw = g.createLinearGradient(w * 0.15, 0, w * 0.85, 0);
    sw.addColorStop(0, css(rgb(p[2]), 0));
    sw.addColorStop(0.5, css(rgb(p[2]), 0.95));
    sw.addColorStop(1, css(rgb(p[2]), 0));
    g.fillStyle = sw;
    g.beginPath();
    g.ellipse(w / 2, top + total + 14, w * 0.36, 7, 0, 0, Math.PI * 2);
    g.fill();
    g.restore();
    g.font = `${size}px ${font}`;
    drawTitle(g, spec, w / 2, top, w - 60, h - 70, 150);
    return c.toDataURL('image/png');
  }

  function fanart(spec, w = 1280, h = 720) {
    const c = canvas(w, h);
    paintScene(c.getContext('2d'), w, h, spec, rng(spec.title + 'fan'), { title: false });
    return c.toDataURL('image/jpeg', 0.88);
  }
  const wallpaper = (spec) => fanart({ title: spec.file, ...spec }, 1920, 1080);

  // ---- pixel-art "screenshots" (and the frames of the game videos) -------------------------
  const SPRITES = {
    hero: ['....KKKK....', '...KAAAAK...', '..KAAAAAAK..', '..KAWKAWKK..', '..KAAAAAAK..', '...KAAAAK...', '..KBBBBBBK..', '.KBBBBBBBBK.', '.KBBKBBKBBK.', '..KBBBBBBK..', '..KKK..KKK..', '.KKK....KKK.'],
    ship: ['.....K.....', '....KWK....', '....KWK....', '...KAWAK...', '...KAWAK...', '..KAAAAAK..', '.KAAKAKAAK.', 'KAAAKAKAAAK', 'KBK.KAK.KBK', '.K..KBK..K.', '....K.K....'],
    enemy: ['..KKKKK..', '.KAAAAAK.', 'KAWKAWKAK', 'KAAAAAAAK', '.KAKAKAK.', 'K.K...K.K'],
    car: ['......KKKKKKKKKKKK......', '.....KAAAAAAAAAAAAK.....', '....KAWWWWWWWWWWWWAK....', '...KAAAAAAAAAAAAAAAAK...', '.KKAAAAAAAAAAAAAAAAAAKK.', 'KRRAAAAAAAAAAAAAAAAAARRK', 'KAAAAKKKKKKKKKKKKKAAAAAK', 'KKKKKK............KKKKKK', '.KKKK..............KKKK.'],
    fighter: ['...KKKK...', '..KAAAAK..', '..KAWAWK..', '..KAAAAK..', '...KAAK...', '.KKBBBBKK.', 'KAABBBBAAK', 'KA.BBBB.AK', 'KA.BBBB.AK', '...CCCC...', '..CC..CC..', '..CC..CC..', '..CC..CC..', '.KKK..KKK.'],
    tree: ['...KKK...', '..KGGGK..', '.KGGHGGK.', 'KGGGGGHGK', 'KGHGGGGGK', '.KGGGHGK.', '..KKTKK..', '....T....', '...TTT...'],
  };
  function sprite(g, name, x, y, s, colours) {
    const rows = SPRITES[name];
    rows.forEach((row, j) => {
      for (let i = 0; i < row.length; i++) {
        const ch = row[i];
        if (ch === '.') continue;
        g.fillStyle = colours[ch] ?? '#000';
        g.fillRect(Math.round(x + i * s), Math.round(y + j * s), s, s);
      }
    });
  }
  function bands(g, w, h, from, to, n, y0 = 0, y1 = h) {
    for (let i = 0; i < n; i++) {
      g.fillStyle = css(mix(from, to, i / (n - 1)));
      g.fillRect(0, Math.floor(y0 + ((y1 - y0) * i) / n), w, Math.ceil((y1 - y0) / n) + 1);
    }
  }
  function px(g, text, x, y, size, colour, align = 'left') {
    g.font = `bold ${size}px "Courier New", Consolas, monospace`;
    g.textAlign = align;
    g.textBaseline = 'top';
    g.fillStyle = '#000';
    g.fillText(text, x + 1, y + 1);
    g.fillStyle = colour;
    g.fillText(text, x, y);
  }

  function paintPixels(g, w, h, spec, t) {
    const p = spec.palette;
    const r = rng(spec.title + 'shot');
    const A = p[2];
    const B = css(shade(p[2], -0.35));
    const W = '#ffffff';
    const K = '#101018';
    const hud = (left, right) => {
      px(g, left, 6, 5, 9, W);
      px(g, right, w - 6, 5, 9, p[3] === '#ffffff' ? '#ffe066' : p[3], 'right');
    };
    const style = spec.style;
    if (style === 'platformer') {
      bands(g, w, h, p[0], p[1], 10);
      const scroll = t * 40;
      for (let layer = 0; layer < 2; layer++) {
        g.fillStyle = css(shade(mix(p[2], '#3a9d23', 0.6), -0.2 - layer * 0.2));
        for (let x = 0; x < w; x++) {
          const hh = 30 + layer * 18 + Math.sin((x + scroll * (0.3 + layer * 0.3)) / (26 - layer * 6)) * 10;
          g.fillRect(x, h - 32 - hh, 1, hh);
        }
      }
      const tile = 16;
      for (let x = -(scroll % tile); x < w; x += tile)
        for (let y = h - 32; y < h; y += tile) {
          g.fillStyle = css(shade(p[2], -0.45));
          g.fillRect(x, y, tile, tile);
          g.fillStyle = css(shade(p[2], -0.25));
          g.fillRect(x + 1, y + 1, tile - 3, tile - 3);
        }
      g.fillStyle = css(mix(p[2], '#3a9d23', 0.6));
      g.fillRect(0, h - 33, w, 4);
      for (let i = 0; i < 4; i++) {
        const bx = ((i * 110 - scroll * 1.0) % (w + 120)) + (i * 110 - scroll < -100 ? w + 120 : 0);
        const by = h - 80 - (i % 2) * 34;
        g.fillStyle = css(shade(p[2], -0.4));
        g.fillRect(Math.round(bx), by, 56, 10);
        g.fillStyle = css(mix(p[2], '#3a9d23', 0.6));
        g.fillRect(Math.round(bx), by, 56, 3);
        for (let c = 0; c < 3; c++) {
          const bob = Math.round(Math.sin(t * 4 + c + i) * 2);
          g.fillStyle = '#ffd166';
          g.fillRect(Math.round(bx) + 8 + c * 16, by - 14 + bob, 6, 8);
          g.fillStyle = '#fff3b0';
          g.fillRect(Math.round(bx) + 9 + c * 16, by - 13 + bob, 2, 3);
        }
      }
      const jump = Math.abs(Math.sin(t * 2.2)) * 34;
      sprite(g, 'hero', 90, h - 32 - 24 - jump, 2, { K, A, B, W });
      sprite(g, 'enemy', 210 - ((t * 30) % 60), h - 32 - 12, 2, { K, A: css(shade(p[1], -0.3)), W });
      hud(`SCORE ${String(4200 + Math.floor(t * 50) * 10).padStart(6, '0')}`, `x03  TIME ${287 - Math.floor(t)}`);
    } else if (style === 'shmup') {
      g.fillStyle = p[0];
      g.fillRect(0, 0, w, h);
      for (let layer = 1; layer <= 3; layer++)
        for (let i = 0; i < 40; i++) {
          const sx = (r() * w) | 0;
          const sy = ((r() * h + t * 30 * layer) % h) | 0;
          g.fillStyle = `rgba(255,255,255,${0.25 * layer})`;
          g.fillRect(sx, sy, layer > 2 ? 2 : 1, layer > 2 ? 2 : 1);
        }
      g.fillStyle = css(shade(p[1], 0.2));
      g.beginPath();
      g.arc(w * 0.8, ((h * 0.2 + t * 6) % (h + 80)) - 20, 34, 0, Math.PI * 2);
      g.fill();
      const sx = w / 2 + Math.sin(t * 1.3) * 60;
      for (let i = 0; i < 6; i++) {
        g.fillStyle = p[3];
        const by = h - 50 - ((t * 240 + i * 34) % 200);
        g.fillRect(Math.round(sx) + 9, Math.round(by), 3, 8);
      }
      sprite(g, 'ship', sx - 11 + 0, h - 46, 2, { K, A: '#c9d1e0', W: p[3], B: A });
      g.fillStyle = A;
      g.fillRect(Math.round(sx) + 7, h - 22 + ((t * 20) % 3), 8, 4);
      for (let i = 0; i < 8; i++) {
        const ex = 30 + (i % 4) * 70 + Math.sin(t * 2 + i) * 16;
        const ey = 40 + Math.floor(i / 4) * 34 + Math.cos(t * 1.5 + i) * 6;
        sprite(g, 'enemy', ex, ey, 2, { K, A: i % 2 ? A : css(shade(p[3], -0.2)), W });
      }
      const ex = (t * 3) % 1;
      g.fillStyle = css(rgb('#ffd166'), 1 - ex);
      g.beginPath();
      g.arc(w * 0.3, h * 0.45, 6 + ex * 14, 0, Math.PI * 2);
      g.fill();
      hud(`1UP ${String(18300 + Math.floor(t * 40) * 10).padStart(7, '0')}`, `HI 0250000`);
    } else if (style === 'racer') {
      const hz = Math.floor(h * 0.45);
      bands(g, w, h, p[0], p[1], 8, 0, hz);
      g.fillStyle = p[2];
      g.beginPath();
      g.arc(w / 2, hz - 10, 30, Math.PI, 0);
      g.fill();
      g.fillStyle = css(shade(p[0], -0.25));
      for (let x = 0; x < w; x++) {
        const mh = 10 + Math.abs(Math.sin((x + t * 4) / 23)) * 16 + Math.sin(x / 7) * 3;
        g.fillRect(x, hz - mh, 1, mh);
      }
      const curve = Math.sin(t * 0.6) * 0.7;
      for (let y = hz; y < h; y++) {
        const q = (y - hz) / (h - hz);
        const z = 1 / (q + 0.02);
        const roadW = 12 + q * w * 1.2;
        const cx = w / 2 + curve * (1 - q) * (1 - q) * 120;
        const stripe = Math.floor(z * 1.5 + t * 22) % 2;
        g.fillStyle = stripe ? css(mix(p[0], '#2d6a4f', 0.5)) : css(shade(mix(p[0], '#2d6a4f', 0.5), -0.15));
        g.fillRect(0, y, w, 1);
        g.fillStyle = stripe ? '#e63946' : '#f1faee';
        g.fillRect(Math.round(cx - roadW / 2 - roadW * 0.06), y, Math.round(roadW * 1.12), 1);
        g.fillStyle = stripe ? '#555a66' : '#5f6573';
        g.fillRect(Math.round(cx - roadW / 2), y, Math.round(roadW), 1);
        if (stripe) {
          g.fillStyle = '#f1faee';
          g.fillRect(Math.round(cx - roadW * 0.015), y, Math.max(1, Math.round(roadW * 0.03)), 1);
        }
      }
      sprite(g, 'car', w / 2 - 24 + Math.sin(t * 1.4) * 10, h - 30, 2, { K, A, W: '#a8dadc', R: '#ff3b3b' });
      const rival = (t * 0.25) % 1;
      sprite(g, 'car', w / 2 + 20 - rival * 30, hz + 10 + rival * 40, 1, { K, A: p[3] === '#ffffff' ? '#3a86ff' : p[3], W: '#a8dadc', R: '#ff3b3b' });
      hud(`LAP 2/3   ${(184 + Math.round(Math.sin(t) * 9)).toString()} KM/H`, `POS 2ND`);
    } else if (style === 'puzzle') {
      const cell = Math.floor(h / 24);
      for (let y = 0; y < h; y += 16)
        for (let x = 0; x < w; x += 16) {
          g.fillStyle = (x + y) % 32 ? css(shade(p[0], 0.05)) : css(shade(p[0], -0.1));
          g.fillRect(x, y, 16, 16);
        }
      const cols = 10;
      const rows = 20;
      const wx = Math.floor((w - cols * cell) / 2);
      const wy = Math.floor((h - rows * cell) / 2) + 6;
      g.fillStyle = 'rgba(0,0,0,.7)';
      g.fillRect(wx - 3, wy - 3, cols * cell + 6, rows * cell + 6);
      g.fillStyle = css(shade(p[1], 0.3));
      g.fillRect(wx - 3, wy - 3, cols * cell + 6, 2);
      const colours = [A, p[3], css(shade(p[1], 0.4)), css(mix(A, p[3], 0.5)), '#ff6b6b'];
      const block = (cx, cy, col) => {
        g.fillStyle = col;
        g.fillRect(wx + cx * cell, wy + cy * cell, cell - 1, cell - 1);
        g.fillStyle = 'rgba(255,255,255,.45)';
        g.fillRect(wx + cx * cell, wy + cy * cell, cell - 1, 2);
        g.fillStyle = 'rgba(0,0,0,.3)';
        g.fillRect(wx + cx * cell, wy + cy * cell + cell - 3, cell - 1, 2);
      };
      for (let y = 12; y < rows; y++) for (let x = 0; x < cols; x++) if (r() < 0.25 + (y - 12) * 0.08) block(x, y, r.pick(colours));
      const fall = Math.floor((t * 3) % 11);
      for (const [dx, dy] of [
        [0, 0],
        [1, 0],
        [1, 1],
        [2, 1],
      ])
        block(3 + dx, fall + dy, colours[0]);
      px(g, 'NEXT', wx + cols * cell + 14, wy, 9, W);
      for (const [dx, dy] of [
        [0, 0],
        [0, 1],
        [1, 1],
      ]) {
        g.fillStyle = colours[1];
        g.fillRect(wx + cols * cell + 16 + dx * cell, wy + 16 + dy * cell, cell - 1, cell - 1);
      }
      px(g, 'SCORE', 10, wy, 9, W);
      px(g, String(12640 + Math.floor(t * 4) * 20), 10, wy + 12, 9, p[3] === '#ffffff' ? '#ffe066' : p[3]);
      px(g, 'LEVEL 7', 10, wy + 32, 9, W);
    } else if (style === 'rpg') {
      const T = 16;
      const map = (x, y) => {
        const n = Math.sin(x * 0.7 + spec.title.length) + Math.cos(y * 0.9) + Math.sin((x + y) * 0.35);
        if (n > 1.5) return 'water';
        if (Math.abs(y - 9 - Math.round(Math.sin(x * 0.5) * 1.5)) < 1) return 'path';
        if (n < -1.3) return 'tree';
        return 'grass';
      };
      for (let y = 0; y < Math.ceil(h / T); y++)
        for (let x = 0; x < Math.ceil(w / T); x++) {
          const k = map(x, y);
          const gx = x * T;
          const gy = y * T;
          if (k === 'water') {
            g.fillStyle = '#2a6f97';
            g.fillRect(gx, gy, T, T);
            g.fillStyle = '#61a5c2';
            const wv = Math.floor((t * 6 + x + y) % 4);
            g.fillRect(gx + 2 + wv, gy + 5, 6, 1);
            g.fillRect(gx + 8 - wv, gy + 11, 5, 1);
          } else if (k === 'path') {
            g.fillStyle = '#d4a373';
            g.fillRect(gx, gy, T, T);
            g.fillStyle = '#c08552';
            g.fillRect(gx + 3, gy + 4, 2, 2);
            g.fillRect(gx + 11, gy + 10, 2, 2);
          } else {
            g.fillStyle = (x + y) % 2 ? css(mix(p[1], '#55a630', 0.6)) : css(shade(mix(p[1], '#55a630', 0.6), -0.07));
            g.fillRect(gx, gy, T, T);
            if (k === 'tree') sprite(g, 'tree', gx - 1, gy - 2, 2, { K, G: '#2b9348', H: '#80b918', T: '#7f5539' });
          }
        }
      g.fillStyle = '#9c6644';
      g.fillRect(w - 92, 26, 54, 34);
      g.fillStyle = A;
      g.beginPath();
      g.moveTo(w - 98, 28);
      g.lineTo(w - 65, 8);
      g.lineTo(w - 32, 28);
      g.fill();
      g.fillStyle = '#3d2b1f';
      g.fillRect(w - 70, 44, 10, 16);
      const step = Math.floor(t * 4) % 2;
      sprite(g, 'hero', w / 2 - 12, h / 2 - 20 + step, 2, { K, A: '#ffd7ba', B: A, W });
      g.fillStyle = 'rgba(16,16,40,.92)';
      g.fillRect(8, h - 58, w - 16, 50);
      g.strokeStyle = '#ffffff';
      g.lineWidth = 2;
      g.strokeRect(9, h - 57, w - 18, 48);
      const say = 'Welcome to Brookhaven! The crystals have gone quiet...';
      px(g, say.slice(0, Math.min(say.length, Math.floor(t * 18) + 12)), 18, h - 48, 10, W);
      px(g, 'HP 42/42   MP 17/20', 18, h - 30, 9, p[3] === '#ffffff' ? '#ffe066' : p[3]);
    } else if (style === 'fighter' || style === 'brawler') {
      bands(g, w, h, p[0], p[1], 8, 0, h * 0.7);
      g.fillStyle = css(shade(p[0], -0.3));
      for (let i = 0; i < 12; i++) {
        const bw = 18 + ((i * 7) % 20);
        const bh = 30 + ((i * 37) % 60);
        g.fillRect(i * 28 - 4, h * 0.7 - bh, bw, bh);
        g.fillStyle = A;
        for (let y = h * 0.7 - bh + 4; y < h * 0.7 - 4; y += 8) if ((i + y) % 3) g.fillRect(i * 28, y, 3, 3);
        g.fillStyle = css(shade(p[0], -0.3));
      }
      for (let y = Math.floor(h * 0.7); y < h; y += 6) {
        g.fillStyle = (y / 6) % 2 ? css(shade(p[1], -0.5)) : css(shade(p[1], -0.6));
        g.fillRect(0, y, w, 6);
      }
      const sway = Math.sin(t * 3) * 6;
      sprite(g, 'fighter', w * 0.32 + sway, h * 0.7 - 50, 3, { K, A: '#f4a261', W: '#fff', B: A, C: css(shade(A, -0.4)) });
      sprite(g, 'fighter', w * 0.58 - sway, h * 0.7 - 50, 3, { K, A: '#e9c46a', W: '#fff', B: p[3] === '#ffffff' ? '#3a86ff' : p[3], C: '#264653' });
      const hp1 = 0.8 - ((t * 0.05) % 0.3);
      for (const [x, v, al] of [
        [8, hp1, 'left'],
        [w - 128, 0.55, 'right'],
      ]) {
        g.fillStyle = '#000';
        g.fillRect(x, 18, 120, 9);
        g.fillStyle = '#ffd166';
        g.fillRect(al === 'left' ? x + 1 : x + 1 + 118 * (1 - v), 19, 118 * v, 7);
      }
      px(g, String(64 - Math.floor(t)), w / 2, 14, 14, W, 'center');
      px(g, style === 'brawler' ? 'PLAYER 1' : 'RYO', 8, 30, 8, W);
      px(g, style === 'brawler' ? 'BOSS' : 'KAITO', w - 8, 30, 8, W, 'right');
    } else if (style === 'sports') {
      for (let y = 0; y < h; y += 20) {
        g.fillStyle = (y / 20) % 2 ? '#2d6a4f' : '#40916c';
        g.fillRect(0, y, w, 20);
      }
      g.strokeStyle = 'rgba(255,255,255,.8)';
      g.lineWidth = 2;
      g.strokeRect(16, 24, w - 32, h - 40);
      g.beginPath();
      g.moveTo(w / 2, 24);
      g.lineTo(w / 2, h - 16);
      g.stroke();
      g.beginPath();
      g.arc(w / 2, h / 2 + 4, 26, 0, Math.PI * 2);
      g.stroke();
      for (let i = 0; i < 10; i++) {
        const tx = 40 + ((i * 53 + Math.sin(t * 1.5 + i) * 14) % (w - 80));
        const ty = 40 + ((i * 37 + Math.cos(t + i) * 10) % (h - 80));
        g.fillStyle = i % 2 ? A : '#f1faee';
        g.fillRect(Math.round(tx), Math.round(ty), 6, 8);
        g.fillStyle = '#ffd7ba';
        g.fillRect(Math.round(tx) + 1, Math.round(ty) - 3, 4, 3);
      }
      g.fillStyle = '#fff';
      g.beginPath();
      g.arc(w / 2 + Math.sin(t * 2) * 50, h / 2 + Math.cos(t * 1.7) * 30, 3, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = 'rgba(0,0,0,.75)';
      g.fillRect(w / 2 - 70, 2, 140, 16);
      px(g, `HOME 2 - 1 AWAY  ${String(64 + Math.floor(t)).padStart(2, '0')}:12`, w / 2, 5, 8, W, 'center');
    } else {
      bands(g, w, h, p[0], p[1], 8, 0, h);
      for (let layer = 0; layer < 3; layer++)
        for (let i = -1; i < 14; i++) {
          const x = ((i * 30 - t * 10 * (layer + 1)) % (w + 60)) - 30;
          const th = 40 + ((i * 17 + layer * 11) % 40);
          g.fillStyle = css(shade(mix(p[0], '#1b4332', 0.5), -0.1 - layer * 0.2));
          g.beginPath();
          g.moveTo(x, h - 40 - layer * 6 - th);
          g.lineTo(x + 14, h - 40 - layer * 6);
          g.lineTo(x - 14, h - 40 - layer * 6);
          g.fill();
        }
      g.fillStyle = css(shade(p[0], -0.6));
      g.fillRect(0, h - 40, w, 40);
      const lx = w * 0.4;
      glow(g, lx + 26, h - 70, 60, p[2], 0.6 + Math.sin(t * 6) * 0.08);
      sprite(g, 'hero', lx, h - 40 - 24, 2, { K, A: '#ffd7ba', B: css(shade(p[1], -0.2)), W });
      g.fillStyle = p[3];
      g.fillRect(lx + 26, h - 62, 4, 6);
      for (let i = 0; i < 14; i++) {
        g.fillStyle = css(rgb(p[3]), 0.5 + 0.5 * Math.sin(t * 3 + i));
        g.fillRect(Math.round((r() * w + Math.sin(t + i) * 8) % w), Math.round(r() * (h - 60)), 2, 2);
      }
      hud('LANTERN OIL ||||||||', `GEMS ${12 + Math.floor(t / 2)}`);
    }
  }

  function shot(spec, t = 1.3, handheld = false) {
    const [bw, bh, s] = handheld ? [240, 160, 3] : [320, 240, 2];
    const low = canvas(bw, bh);
    const g = low.getContext('2d');
    g.imageSmoothingEnabled = false;
    paintPixels(g, bw, bh, spec, t);
    const c = canvas(bw * s, bh * s);
    const o = c.getContext('2d');
    o.imageSmoothingEnabled = false;
    o.drawImage(low, 0, 0, bw * s, bh * s);
    return c.toDataURL('image/png');
  }

  /** A title card for the intro video: frame `i` of `n`. */
  function intro(i, n, w = 1280, h = 720) {
    const c = canvas(w, h);
    const g = c.getContext('2d');
    const t = i / n;
    const p = ['#090a1a', '#2b1055', '#ff4f8b', '#7df9ff'];
    const grad = g.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, p[0]);
    grad.addColorStop(1, p[1]);
    g.fillStyle = grad;
    g.fillRect(0, 0, w, h);
    const hz = h * 0.62;
    g.strokeStyle = 'rgba(255,79,139,.7)';
    g.lineWidth = 2;
    for (let k = -14; k <= 14; k++) {
      g.beginPath();
      g.moveTo(w / 2 + k * 18, hz);
      g.lineTo(w / 2 + k * 160, h);
      g.stroke();
    }
    for (let k = 0; k < 12; k++) {
      const q = (k / 12 + t * 0.6) % 1;
      const y = hz + (h - hz) * q * q;
      g.beginPath();
      g.moveTo(0, y);
      g.lineTo(w, y);
      g.stroke();
    }
    const a = Math.min(1, t * 3) * Math.min(1, (1 - t) * 4);
    g.globalAlpha = a;
    glow(g, w / 2, h * 0.42, 420, p[2], 0.35);
    g.font = `${90 + t * 14}px "Arial Black", sans-serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.shadowColor = p[3];
    g.shadowBlur = 30;
    g.fillStyle = '#ffffff';
    g.fillText('ARCADE NIGHT', w / 2, h * 0.42);
    g.shadowBlur = 0;
    g.font = '600 26px "Segoe UI", sans-serif';
    g.letterSpacing = '10px';
    g.fillStyle = p[3];
    g.fillText('PRESS START', w / 2, h * 0.56);
    g.letterSpacing = '0px';
    g.globalAlpha = 1;
    return c.toDataURL('image/jpeg', 0.9);
  }

  window.ART = { cover, logo, fanart, wallpaper, shot, intro };
})();
