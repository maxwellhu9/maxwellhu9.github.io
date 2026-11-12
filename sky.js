// sky.js: the sky behind the whole page.
//
// Scrolling moves you through a day: morning at the top of the page,
// golden afternoon in the middle, sunset, then night with stars at the
// bottom. Clouds sit at three depths. Far clouds move less when you scroll
// or move the mouse than near ones, and that difference (parallax) is what
// makes a flat screen feel deep.
//
// The canvas is drawn at half resolution and scaled up with crisp pixels,
// so it matches the pixel-art islands.

(() => {
  const canvas = document.getElementById('sky');
  if (!canvas || !canvas.getContext) return;
  const ctx = canvas.getContext('2d');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const PIX = 2; // one sky pixel = 2×2 CSS pixels

  let w = 0, h = 0, docH = 0, vh = 0;

  // ---- Time of day, keyed to how far down the page you are ----
  const STOPS = [
    { at: 0.0,  top: '#a8cfe5', bottom: '#edf4ed' },
    { at: 0.4,  top: '#a5c6df', bottom: '#f7ead8' },
    { at: 0.7,  top: '#afa3ca', bottom: '#e9c6b3' },
    { at: 0.87, top: '#575574', bottom: '#9783a4' },
    { at: 1.0,  top: '#343752', bottom: '#625975' },
  ];
  const hexToRgb = (hex) => { const n = parseInt(hex.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; };
  const lerp = (a, b, k) => a + (b - a) * k;
  const lerpColor = (c1, c2, k) => { const a = hexToRgb(c1), b = hexToRgb(c2); return `rgb(${a.map((v, i) => Math.round(lerp(v, b[i], k))).join(',')})`; };
  const smooth = (e0, e1, x) => { const k = Math.max(0, Math.min(1, (x - e0) / (e1 - e0))); return k * k * (3 - 2 * k); };

  function skyAt(p) {
    let i = 0;
    while (i < STOPS.length - 2 && p > STOPS[i + 1].at) i++;
    const a = STOPS[i], b = STOPS[i + 1];
    const k = Math.max(0, Math.min(1, (p - a.at) / (b.at - a.at)));
    return { top: lerpColor(a.top, b.top, k), bottom: lerpColor(a.bottom, b.bottom, k) };
  }

  // ---- Scenery ----
  const rand = (a, b) => a + Math.random() * (b - a);
  const DEPTHS = [0.35, 0.6, 1];

  const clouds = Array.from({ length: 16 }, (_, i) => {
    const depth = DEPTHS[i % 3];
    const size = depth * rand(0.8, 1.3);
    const puffs = Array.from({ length: 4 + Math.floor(Math.random() * 3) }, (_, k) => ({
      dx: (k - 2) * 9 * size + rand(-3, 3), dy: rand(-6, 2) * size, r: rand(7, 12) * size,
    }));
    return { depth, x: Math.random(), ny: Math.random(), puffs, speed: rand(0.03, 0.08) };
  });
  const stars = Array.from({ length: 140 }, () => ({ x: Math.random(), y: Math.random(), phase: Math.random() * 6.28, big: Math.random() < 0.15 }));
  const motes = Array.from({ length: 45 }, () => ({ x: Math.random(), y: Math.random(), v: rand(0.0002, 0.0006), sway: Math.random() * 6.28, push: [0, 0] }));

  // Mouse position, from -1 to 1 on each axis, eased so it glides
  const mouse = { x: 0, y: 0, tx: 0, ty: 0, px: -999, py: -999 };

  function resize() {
    vh = window.innerHeight;
    w = Math.ceil(window.innerWidth / PIX);
    h = Math.ceil(vh / PIX);
    canvas.width = w;
    canvas.height = h;
    docH = document.documentElement.scrollHeight;
  }

  // A filled circle made of pixel rows
  function disc(cx, cy, r, color) {
    ctx.fillStyle = color;
    for (let dy = -r; dy <= r; dy++) {
      const half = Math.round(Math.sqrt(r * r - dy * dy));
      ctx.fillRect(Math.round(cx - half), Math.round(cy + dy), half * 2 + 1, 1);
    }
  }

  let t = 0;
  function draw() {
    const scrollY = window.scrollY;
    const p = docH > vh ? Math.min(1, scrollY / (docH - vh)) : 0;
    const night = smooth(0.78, 0.97, p);
    const sky = skyAt(p);

    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, sky.top);
    grad.addColorStop(1, sky.bottom);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Stars come out at night
    if (night > 0) {
      for (const s of stars) {
        const tw = 0.6 + 0.4 * Math.sin(t / 30 + s.phase);
        ctx.globalAlpha = night * tw;
        ctx.fillStyle = '#ffffff';
        const sx = Math.round(s.x * w - mouse.x * 4), sy = Math.round(s.y * h * 0.8 - mouse.y * 3);
        ctx.fillRect(sx, sy, 1, 1);
        if (s.big) { ctx.globalAlpha *= 0.5; ctx.fillRect(sx - 1, sy, 3, 1); ctx.fillRect(sx, sy - 1, 1, 3); }
      }
      ctx.globalAlpha = night;
      disc(w * 0.16 - mouse.x * 6, h * 0.16 - mouse.y * 4, 9, '#fff6d8'); // moon
      disc(w * 0.16 - mouse.x * 6 + 4, h * 0.16 - mouse.y * 4 - 3, 8, sky.top);
      ctx.globalAlpha = 1;
    }

    // The sun sinks as you scroll down
    const sunAlpha = 1 - smooth(0.72, 0.86, p);
    if (sunAlpha > 0) {
      const sunX = w * 0.84 - mouse.x * 6, sunY = h * (0.13 + p * 0.85) - mouse.y * 4;
      const sunColor = lerpColor('#fff4b8', '#ffab6e', smooth(0.3, 0.8, p));
      ctx.globalAlpha = sunAlpha * 0.25;
      disc(sunX, sunY, 26, sunColor);
      ctx.globalAlpha = sunAlpha * 0.45;
      disc(sunX, sunY, 19, sunColor);
      ctx.globalAlpha = sunAlpha;
      disc(sunX, sunY, 13, sunColor);
      ctx.globalAlpha = 1;
    }

    // Clouds at three depths. Scrolling moves near clouds more than far ones.
    const cloudColor = lerpColor('#ffffff', '#c9b6e6', smooth(0.6, 0.95, p));
    const shadeColor = lerpColor('#dcebf7', '#9e86c4', smooth(0.5, 0.95, p));
    ctx.globalAlpha = 1 - night * 0.55;
    for (const c of clouds) {
      const span = ((docH - vh) * c.depth) / PIX + h + 80;
      const cy = c.ny * span - 40 - (scrollY * c.depth) / PIX - mouse.y * 10 * c.depth;
      if (cy < -40 || cy > h + 40) continue;
      const cx = ((c.x * (w + 160)) % (w + 160)) - 80 - mouse.x * 18 * c.depth;
      for (const pf of c.puffs) disc(cx + pf.dx, cy + pf.dy + 3, Math.round(pf.r), shadeColor);
      for (const pf of c.puffs) disc(cx + pf.dx, cy + pf.dy, Math.round(pf.r), cloudColor);
    }
    ctx.globalAlpha = 1;

    // Floating specks: pollen in the day, fireflies at night.
    // They drift away from the mouse.
    const moteColor = lerpColor('#ffffff', '#fff1a0', night);
    for (const m of motes) {
      const mx = m.x * w + Math.sin(t / 60 + m.sway) * 4 + m.push[0];
      const my = m.y * h + m.push[1];
      ctx.globalAlpha = (0.45 + 0.35 * night) * (0.6 + 0.4 * Math.sin(t / 25 + m.sway));
      ctx.fillStyle = moteColor;
      ctx.fillRect(Math.round(mx), Math.round(my), 1, 1);
      if (night > 0.5) { ctx.globalAlpha *= 0.3; ctx.fillRect(Math.round(mx) - 1, Math.round(my) - 1, 3, 3); }
    }
    ctx.globalAlpha = 1;
  }

  function update(dt) {
    t += dt;
    mouse.x += (mouse.tx - mouse.x) * 0.05 * dt;
    mouse.y += (mouse.ty - mouse.y) * 0.05 * dt;
    for (const c of clouds) c.x += (c.speed * c.depth * dt) / w;
    for (const m of motes) {
      m.y -= m.v * dt;
      if (m.y < -0.02) { m.y = 1.02; m.x = Math.random(); }
      const sx = m.x * w + m.push[0], sy = m.y * h + m.push[1];
      const dx = sx - mouse.px, dy = sy - mouse.py;
      const d = Math.hypot(dx, dy);
      if (d < 30 && d > 0) { m.push[0] += (dx / d) * (30 - d) * 0.06 * dt; m.push[1] += (dy / d) * (30 - d) * 0.06 * dt; }
      m.push[0] *= 0.97; m.push[1] *= 0.97; // slowly drift back
    }
  }

  window.addEventListener('pointermove', (e) => {
    mouse.tx = (e.clientX / window.innerWidth - 0.5) * 2;
    mouse.ty = (e.clientY / window.innerHeight - 0.5) * 2;
    mouse.px = e.clientX / PIX;
    mouse.py = e.clientY / PIX;
  });

  resize();
  window.addEventListener('resize', () => { resize(); draw(); });
  window.addEventListener('load', () => { docH = document.documentElement.scrollHeight; });

  if (reduceMotion) {
    draw();
    window.addEventListener('scroll', draw, { passive: true });
    return;
  }

  let last = 0;
  function frame(now) {
    const dt = last ? Math.min((now - last) / (1000 / 60), 3) : 1;
    last = now;
    update(dt);
    draw();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
