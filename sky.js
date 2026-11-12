// sky.js: the sky behind the whole page.
//
// Scrolling moves you through a day: a dreamy pastel morning at the top,
// a peach-and-lavender sunset in the middle, and a purple night with pink
// clouds, stars, and a crescent moon at the bottom.
//
// Clouds are soft cumulus shapes shaded in three tones (a lavender
// underside, a pink middle, a cream top). They sit at three depths, and far
// clouds move less when you scroll or move the mouse than near ones. That
// difference (parallax) is what makes a flat screen feel deep.
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

  // ---- Colors ----
  // Reads both "#rrggbb" and "rgb(r,g,b)", so mixed colors can be mixed again
  const toRgb = (c) => {
    if (c.startsWith('rgb')) return c.match(/\d+/g).slice(0, 3).map(Number);
    const n = parseInt(c.slice(1), 16);
    return [n >> 16, (n >> 8) & 255, n & 255];
  };
  const lerp = (a, b, k) => a + (b - a) * k;
  const mixColor = (c1, c2, k) => { const a = toRgb(c1), b = toRgb(c2); return `rgb(${a.map((v, i) => Math.round(lerp(v, b[i], k))).join(',')})`; };
  const smooth = (e0, e1, x) => { const k = Math.max(0, Math.min(1, (x - e0) / (e1 - e0))); return k * k * (3 - 2 * k); };

  // Sky gradient, keyed to how far down the page you are (0 = top, 1 = bottom)
  const STOPS = [
    { at: 0.0,  top: '#9cc3ec', bottom: '#f3e7f3' },
    { at: 0.35, top: '#a6c2ee', bottom: '#f9e2ea' },
    { at: 0.55, top: '#aaa7e4', bottom: '#ffd3c3' },
    { at: 0.7,  top: '#9b8ad8', bottom: '#f6b6c8' },
    { at: 0.86, top: '#4a3a86', bottom: '#a36cb8' },
    { at: 1.0,  top: '#2e2463', bottom: '#7a4c9e' },
  ];
  function skyAt(p) {
    let i = 0;
    while (i < STOPS.length - 2 && p > STOPS[i + 1].at) i++;
    const a = STOPS[i], b = STOPS[i + 1];
    const k = Math.max(0, Math.min(1, (p - a.at) / (b.at - a.at)));
    return { top: mixColor(a.top, b.top, k), bottom: mixColor(a.bottom, b.bottom, k) };
  }

  // How much of each time of day we're in
  const phases = (p) => {
    const night = smooth(0.78, 0.94, p);
    const sunset = smooth(0.42, 0.62, p) * (1 - night);
    return { day: 1 - sunset - night, sunset, night };
  };
  // Pick a color for the current time of day: [day, sunset, night]
  const tint = (ph, [d, s, n]) => mixColor(mixColor(d, s, ph.sunset / Math.max(0.001, ph.sunset + ph.day)), n, ph.night);

  const CLOUD = {
    shade: ['#c9c4ec', '#b8a2dc', '#7f5fb0'],   // lavender underside
    mid:   ['#f4eef9', '#ffc6cf', '#d295cf'],   // body: white, then pink, then rose
    light: ['#ffffff', '#fff1d4', '#f6c3e4'],   // sunlit top: white, then cream-gold, then pink
  };

  // ---- Scenery ----
  const rand = (a, b) => a + Math.random() * (b - a);
  const DEPTHS = [0.35, 0.6, 1];

  // A cumulus cloud: a wide base of puffs with bigger puffs piled in the middle
  function makeCloud(depth, scale) {
    const n = 6 + Math.floor(Math.random() * 4);
    const puffs = [];
    for (let k = 0; k < n; k++) {
      const u = n === 1 ? 0 : k / (n - 1) - 0.5;           // -0.5 .. 0.5 across the cloud
      const hump = 1 - Math.abs(u) * 1.4;                   // taller in the middle
      puffs.push({ dx: u * 70 * scale + rand(-3, 3), dy: -hump * 12 * scale + rand(-2, 2), r: (7 + hump * 9 + rand(0, 3)) * scale });
    }
    for (let k = 0; k < 2; k++) puffs.push({ dx: rand(-14, 14) * scale, dy: -20 * scale + rand(-3, 3), r: rand(7, 10) * scale });
    return { depth, puffs, sprite: null, key: '' };
  }
  const clouds = Array.from({ length: 18 }, (_, i) => {
    const depth = DEPTHS[i % 3];
    const c = makeCloud(depth, depth * rand(0.75, 1.15));
    return Object.assign(c, { x: Math.random(), ny: Math.random(), speed: rand(0.03, 0.08) });
  });
  // A low bank of clouds along the bottom of the screen
  const bank = Array.from({ length: 30 }, (_, i) => ({ u: i / 29 + rand(-0.015, 0.015), r: rand(20, 34), dy: rand(-8, 6) }));

  // Stars in three sizes, plus twinkling 4-point sparkles
  const stars = Array.from({ length: 160 }, () => {
    const r = Math.random();
    return { x: Math.random(), y: Math.random(), phase: Math.random() * 6.28, speed: rand(18, 40), size: r < 0.08 ? 2 : r < 0.35 ? 1 : 0 };
  });
  const sparkles = Array.from({ length: 26 }, () => ({ x: Math.random(), y: Math.random() * 0.85, phase: Math.random() * 6.28, speed: rand(30, 60) }));
  const petals = Array.from({ length: 7 }, () => ({ x: Math.random(), y: Math.random(), vx: rand(0.00012, 0.00028), vy: rand(0.00018, 0.0003), spin: Math.random() * 6.28 }));
  const motes = Array.from({ length: 40 }, () => ({ x: Math.random(), y: Math.random(), v: rand(0.0002, 0.0006), sway: Math.random() * 6.28, push: [0, 0] }));
  let shooting = null;
  let nextShoot = rand(400, 900);
  // Fireflies that circle the project islands from sunset into night
  const islandEls = Array.from(document.querySelectorAll('canvas.island'));
  const fireflies = islandEls.flatMap((el) => Array.from({ length: 3 }, (_, k) => ({
    el, a: Math.random() * 6.28, r: rand(0.35, 0.6), speed: rand(0.004, 0.009) * (k % 2 ? 1 : -1), bob: Math.random() * 6.28,
  })));
  const roomEl = document.querySelector('.room');

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
  function disc(c2, cx, cy, r, color) {
    c2.fillStyle = color;
    for (let dy = -r; dy <= r; dy++) {
      const half = Math.round(Math.sqrt(r * r - dy * dy));
      c2.fillRect(Math.round(cx - half), Math.round(cy + dy), half * 2 + 1, 1);
    }
  }

  // Draw one cloud into its own little canvas, in three tones. It's only
  // redrawn when the time-of-day colors change, so scrolling stays smooth.
  function cloudSprite(c, cols) {
    const key = cols.join();
    if (c.sprite && c.key === key) return c.sprite;
    const pad = 4;
    const minX = Math.min(...c.puffs.map((p) => p.dx - p.r)) - pad, maxX = Math.max(...c.puffs.map((p) => p.dx + p.r)) + pad;
    const minY = Math.min(...c.puffs.map((p) => p.dy - p.r)) - pad, maxY = Math.max(...c.puffs.map((p) => p.dy + p.r)) + pad + 4;
    const s = c.sprite || document.createElement('canvas');
    s.width = Math.ceil(maxX - minX); s.height = Math.ceil(maxY - minY);
    const g = s.getContext('2d');
    g.clearRect(0, 0, s.width, s.height);
    const ox = -minX, oy = -minY;
    for (const p of c.puffs) disc(g, ox + p.dx + 1, oy + p.dy + 3, Math.round(p.r), cols[0]);                    // underside
    for (const p of c.puffs) disc(g, ox + p.dx, oy + p.dy, Math.round(p.r), cols[1]);                            // body
    for (const p of c.puffs) disc(g, ox + p.dx - p.r * 0.25, oy + p.dy - p.r * 0.3, Math.round(p.r * 0.6), cols[2]); // sunlit top
    c.sprite = s; c.key = key; c.ox = ox; c.oy = oy;
    return s;
  }

  // A 4-point sparkle that grows and shrinks
  function sparkle(x, y, size, color) {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, 1, 1);
    if (size >= 1) { ctx.fillRect(x - 1, y, 3, 1); ctx.fillRect(x, y - 1, 1, 3); }
    if (size >= 2) { ctx.fillRect(x - 2, y, 1, 1); ctx.fillRect(x + 2, y, 1, 1); ctx.fillRect(x, y - 2, 1, 1); ctx.fillRect(x, y + 2, 1, 1); }
  }

  let t = 0;
  function draw() {
    const scrollY = window.scrollY;
    const p = docH > vh ? Math.min(1, scrollY / (docH - vh)) : 0;
    const ph = phases(p);
    const sky = skyAt(p);

    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, sky.top);
    grad.addColorStop(1, sky.bottom);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Stars and the moon come out at night
    if (ph.night > 0) {
      for (const s of stars) {
        const tw = 0.55 + 0.45 * Math.sin(t / s.speed + s.phase);
        const sx = Math.round(s.x * w - mouse.x * 4), sy = Math.round(s.y * h * 0.75 - mouse.y * 3);
        ctx.fillStyle = s.size === 2 ? '#fff6dc' : '#ffffff';
        ctx.globalAlpha = ph.night * tw * (s.size === 0 ? 0.55 : 1);
        ctx.fillRect(sx, sy, 1, 1);
        if (s.size === 2) { ctx.globalAlpha *= 0.45; ctx.fillRect(sx - 1, sy, 3, 1); ctx.fillRect(sx, sy - 1, 1, 3); }
      }
      if (shooting) {
        const k = shooting.age / shooting.life;
        for (let i = 0; i < 10; i++) {
          ctx.globalAlpha = ph.night * (1 - k) * (1 - i / 10) * 0.9;
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(Math.round(shooting.x - i * 1.6), Math.round(shooting.y - i * 0.7), 1, 1);
        }
      }
      const moonX = w * 0.18 - mouse.x * 6, moonY = h * 0.16 - mouse.y * 4;
      ctx.globalAlpha = ph.night * 0.08;
      disc(ctx, moonX, moonY, 24, '#fff1c8');
      ctx.globalAlpha = ph.night * 0.12;
      disc(ctx, moonX, moonY, 16, '#fff1c8');
      ctx.globalAlpha = ph.night;
      disc(ctx, moonX, moonY, 10, '#fff6d8');
      disc(ctx, moonX + 5, moonY - 3, 9, sky.top);                // carve out a crescent
      ctx.globalAlpha = 1;
    }

    // The sun sinks as you scroll down, with a soft wide glow
    const sunAlpha = 1 - smooth(0.72, 0.86, p);
    if (sunAlpha > 0) {
      const sunX = w * 0.84 - mouse.x * 6, sunY = h * (0.13 + p * 0.85) - mouse.y * 4;
      const sunColor = mixColor('#fff4c2', '#ffb27a', smooth(0.3, 0.8, p));
      for (const [r, a] of [[46, 0.06], [32, 0.12], [22, 0.3], [14, 1]]) {
        ctx.globalAlpha = sunAlpha * a;
        disc(ctx, sunX, sunY, r, sunColor);
      }
      ctx.globalAlpha = 1;
    }

    // Twinkling sparkles: pale gold in the day, pink-white at night
    const sparkleColor = tint(ph, ['#fffbe6', '#ffe6a6', '#ffe0f6']);
    for (const s of sparkles) {
      const k = Math.sin(t / s.speed + s.phase);
      if (k < 0.2) continue;
      ctx.globalAlpha = (0.45 + 0.5 * ph.night) * k;
      sparkle(Math.round(s.x * w - mouse.x * 5), Math.round(s.y * h - mouse.y * 4), k > 0.85 ? 2 : k > 0.5 ? 1 : 0, sparkleColor);
    }
    ctx.globalAlpha = 1;

    // Soft glow behind the room, so it reads as a little floating world
    if (roomEl) {
      const r = roomEl.getBoundingClientRect();
      if (r.bottom > 0 && r.top < vh) {
        const cx = (r.left + r.width / 2) / PIX, cy = (r.top + r.height * 0.45) / PIX;
        for (const [rad, a] of [[r.width * 0.42, 0.06], [r.width * 0.3, 0.07]]) {
          ctx.globalAlpha = a * (1 - ph.night * 0.5);
          disc(ctx, cx, cy, Math.round(rad / PIX), '#fffaf0');
        }
        ctx.globalAlpha = 1;
      }
    }

    // Clouds at three depths, shaded in three tones
    const phq = phases(Math.round(p * 100) / 100);              // 1% steps, so clouds aren't redrawn every pixel of scroll
    const cols = [tint(phq, CLOUD.shade), tint(phq, CLOUD.mid), tint(phq, CLOUD.light)];
    for (const c of clouds) {
      const span = ((docH - vh) * c.depth) / PIX + h + 80;
      const cy = c.ny * span - 40 - (scrollY * c.depth) / PIX - mouse.y * 10 * c.depth;
      if (cy < -60 || cy > h + 60) continue;
      const cx = ((c.x * (w + 200)) % (w + 200)) - 100 - mouse.x * 18 * c.depth;
      const s = cloudSprite(c, cols);
      ctx.globalAlpha = 0.55 + 0.4 * c.depth;                    // far clouds are fainter
      ctx.drawImage(s, Math.round(cx - c.ox), Math.round(cy - c.oy));
    }
    ctx.globalAlpha = 1;

    // A soft bank of clouds along the bottom edge, strongest at sunset and night
    ctx.globalAlpha = 0.35 + 0.5 * (ph.sunset + ph.night);
    const bankY = h + 16;                                       // sits low, below the footer text
    for (const b of bank) disc(ctx, b.u * w - mouse.x * 8, bankY + b.dy + 4, Math.round(b.r), cols[0]);
    for (const b of bank) disc(ctx, b.u * w - mouse.x * 8, bankY + b.dy, Math.round(b.r), cols[1]);
    ctx.globalAlpha *= 0.45;                                    // a soft sunlit glow along the top, not separate balls
    for (const b of bank) disc(ctx, b.u * w - mouse.x * 8 - b.r * 0.1, bankY + b.dy - b.r * 0.45, Math.round(b.r * 0.55), cols[2]);
    ctx.globalAlpha = 1;

    // Petals drifting through the daytime sky
    if (ph.day > 0) {
      for (const pt of petals) {
        const x = Math.round(pt.x * w), y = Math.round(pt.y * h);
        ctx.globalAlpha = ph.day * 0.7;
        ctx.fillStyle = '#f7c6d4';
        ctx.fillRect(x, y, 2, 1);
        if (Math.sin(t / 20 + pt.spin) > 0) ctx.fillRect(x + 1, y + 1, 1, 1);
      }
      ctx.globalAlpha = 1;
    }

    // Fireflies circling the project islands as sunset turns to night
    const dusk = smooth(0.55, 0.8, p);
    if (dusk > 0) {
      for (const f of fireflies) {
        const r = f.el.getBoundingClientRect();
        if (r.bottom < 0 || r.top > vh) continue;
        const cx = (r.left + r.width / 2) / PIX, cy = (r.top + r.height * 0.42) / PIX;
        const fx = cx + Math.cos(f.a) * (r.width / PIX) * f.r, fy = cy + Math.sin(f.a) * (r.height / PIX) * f.r * 0.6 + Math.sin(t / 40 + f.bob) * 3;
        const pulse = 0.55 + 0.45 * Math.sin(t / 22 + f.bob);
        ctx.fillStyle = '#ffe58a';
        ctx.globalAlpha = dusk * pulse * 0.25;
        ctx.fillRect(Math.round(fx) - 1, Math.round(fy) - 1, 3, 3);
        ctx.globalAlpha = dusk * pulse;
        ctx.fillRect(Math.round(fx), Math.round(fy), 1, 1);
      }
      ctx.globalAlpha = 1;
    }

    // Floating specks: pollen in the day, golden at sunset, fireflies at night.
    // They drift away from the mouse.
    const moteColor = tint(ph, ['#ffffff', '#ffd27a', '#fff1a0']);
    for (const m of motes) {
      const mx = m.x * w + Math.sin(t / 60 + m.sway) * 4 + m.push[0];
      const my = m.y * h + m.push[1];
      ctx.globalAlpha = (0.45 + 0.35 * ph.night) * (0.6 + 0.4 * Math.sin(t / 25 + m.sway));
      ctx.fillStyle = moteColor;
      ctx.fillRect(Math.round(mx), Math.round(my), 1, 1);
      if (ph.night > 0.5) { ctx.globalAlpha *= 0.3; ctx.fillRect(Math.round(mx) - 1, Math.round(my) - 1, 3, 3); }
    }
    ctx.globalAlpha = 1;
  }

  function update(dt) {
    t += dt;
    mouse.x += (mouse.tx - mouse.x) * 0.05 * dt;
    mouse.y += (mouse.ty - mouse.y) * 0.05 * dt;
    for (const c of clouds) c.x += (c.speed * c.depth * dt) / w;
    for (const pt of petals) {
      pt.x += pt.vx * dt; pt.y += pt.vy * dt;
      if (pt.y > 1.02 || pt.x > 1.02) { pt.y = -0.02; pt.x = Math.random() * 0.8; }
    }
    for (const f of fireflies) f.a += f.speed * dt;
    if (shooting) {
      shooting.age += dt; shooting.x += 2.4 * dt; shooting.y += 1.05 * dt;
      if (shooting.age > shooting.life) shooting = null;
    } else if ((nextShoot -= dt) <= 0) {
      shooting = { x: rand(0.1, 0.6) * w, y: rand(0.05, 0.3) * h, age: 0, life: 40 };
      nextShoot = rand(500, 1100);   // roughly every 8 to 18 seconds
    }
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
