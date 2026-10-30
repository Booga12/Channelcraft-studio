// Injected into the page by record.mjs (before the app loads): a visible mouse pointer for the
// clips (a headless browser draws none), with eased gliding and a soft click ripple; plus a watch
// for error toasts, and the demo preferences on the first load of a fresh profile.
(() => {
  if (window.__cursor) return;
  const cfg = window.__ccsRecordConfig ?? {};

  // Preferences and first-run flags, once per fresh profile (a reload keeps what the guide changed).
  try {
    if (!sessionStorage.getItem('ccs.record.init')) {
      sessionStorage.setItem('ccs.record.init', '1');
      for (const [k, v] of Object.entries(cfg.localStorage ?? {})) localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v));
    }
  } catch {
    // Storage blocked: the app falls back to its defaults.
  }

  const style = document.createElement('style');
  style.textContent = `
    vite-error-overlay { display: none !important; }
    #__demo_cursor { position: fixed; left: 0; top: 0; width: 28px; height: 28px; z-index: 2147483647; pointer-events: none; will-change: transform; transition: opacity .25s; }
    #__demo_cursor svg { width: 100%; height: 100%; overflow: visible; transform-origin: 3px 3px; transition: transform .12s cubic-bezier(.3,.7,.4,1); }
    #__demo_cursor.down svg { transform: scale(.86); }
    .__demo_ripple { position: fixed; z-index: 2147483646; pointer-events: none; width: 46px; height: 46px; margin: -23px 0 0 -23px; border-radius: 50%;
      border: 2px solid rgba(255,255,255,.85); background: radial-gradient(circle, rgba(255,255,255,.28), rgba(255,255,255,.08) 60%, transparent 70%);
      box-shadow: 0 0 0 1px rgba(0,0,0,.25), 0 0 18px rgba(255,255,255,.25); animation: __demo_ripple .55s cubic-bezier(.2,.7,.3,1) forwards; }
    @keyframes __demo_ripple { from { transform: scale(.25); opacity: .95; } to { transform: scale(1); opacity: 0; } }
  `;

  const el = document.createElement('div');
  el.id = '__demo_cursor';
  // A crisp Windows-style arrow with a soft shadow; its tip (3,3) is the hot spot.
  el.innerHTML = `<svg viewBox="0 0 28 28"><defs><filter id="__dcs" x="-50%" y="-50%" width="200%" height="200%"><feDropShadow dx="0.6" dy="1.4" stdDeviation="1.3" flood-color="#000" flood-opacity=".45"/></filter></defs>
    <path filter="url(#__dcs)" d="M3 3 L3 22.5 L8.2 17.6 L11.6 25.4 L15.1 23.9 L11.8 16.3 L18.9 16.3 Z" fill="#fff" stroke="#111" stroke-width="1.4" stroke-linejoin="round"/></svg>`;

  let x = cfg.cursorStart?.[0] ?? 960;
  let y = cfg.cursorStart?.[1] ?? 620;
  let anim = 0;
  const place = () => {
    el.style.transform = `translate(${x - 3}px, ${y - 3}px)`;
  };
  place();

  const mount = () => {
    if (!style.isConnected) document.head?.appendChild(style);
    if (!el.isConnected) document.documentElement.appendChild(el);
  };
  const start = () => {
    mount();
    // Keep it there if the app replaces the document's children.
    new MutationObserver(mount).observe(document.documentElement, { childList: true });
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();

  const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

  /** Glides to (tx, ty) along a gentle curve; resolves when it arrives. */
  function glide(tx, ty, ms) {
    const id = ++anim;
    const sx = x;
    const sy = y;
    const dx = tx - sx;
    const dy = ty - sy;
    const dist = Math.hypot(dx, dy);
    // A slight bow to the path, like a hand moving a mouse.
    const bow = Math.min(60, dist * 0.12);
    const cx = sx + dx / 2 - (dy / (dist || 1)) * bow;
    const cy = sy + dy / 2 + (dx / (dist || 1)) * bow;
    const t0 = performance.now();
    return new Promise((done) => {
      const frame = (now) => {
        if (id !== anim) return done();
        const t = Math.min(1, (now - t0) / ms);
        const e = ease(t);
        x = (1 - e) * (1 - e) * sx + 2 * (1 - e) * e * cx + e * e * tx;
        y = (1 - e) * (1 - e) * sy + 2 * (1 - e) * e * cy + e * e * ty;
        place();
        if (t < 1) requestAnimationFrame(frame);
        else done();
      };
      requestAnimationFrame(frame);
    });
  }

  function ripple() {
    const r = document.createElement('div');
    r.className = '__demo_ripple';
    r.style.left = `${x}px`;
    r.style.top = `${y}px`;
    document.documentElement.appendChild(r);
    setTimeout(() => r.remove(), 700);
  }

  window.__cursor = {
    glide,
    ripple,
    get pos() {
      return [x, y];
    },
    set(nx, ny) {
      anim++;
      x = nx;
      y = ny;
      place();
    },
    down() {
      el.classList.add('down');
    },
    up() {
      el.classList.remove('down');
    },
    show(on = true) {
      el.style.opacity = on ? '1' : '0';
    },
  };

  // Error toasts (svelte-sonner) and uncaught errors, for the recorder to check after each step.
  window.__ccsErrors = [];
  const watch = () => {
    new MutationObserver(() => {
      for (const t of document.querySelectorAll('[data-sonner-toast][data-type="error"]')) {
        if (t.dataset.ccsSeen) continue;
        t.dataset.ccsSeen = '1';
        window.__ccsErrors.push(`toast: ${t.textContent?.trim()}`);
      }
    }).observe(document.documentElement, { childList: true, subtree: true });
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', watch);
  else watch();
  window.addEventListener('error', (e) => window.__ccsErrors.push(`error: ${e.message}`));
  window.addEventListener('unhandledrejection', (e) => window.__ccsErrors.push(`unhandled: ${e.reason?.message ?? e.reason}`));
})();
