// iso.js: a tiny toolkit for isometric pixel art on a <canvas>.
// room.js and islands.js both draw with it.
//
// The 3D world: x runs toward the lower-right, y toward the lower-left,
// z straight up. P(x, y, z) turns a world point into a screen pixel with
// the classic 2:1 isometric projection. K is "pixels per world unit":
// K = 2 means every object gets twice as many pixels as before, so the
// art has finer detail without changing any of the world coordinates.

window.Iso = (() => {
  // ---- Colors ----
  // amt > 0 blends toward white, amt < 0 toward black
  function mix(hex, amt) {
    const n = parseInt(hex.slice(1), 16);
    const target = amt > 0 ? 255 : 0, p = Math.abs(amt);
    const ch = (v) => Math.round(v + (target - v) * p);
    return `rgb(${ch(n >> 16)},${ch((n >> 8) & 255)},${ch(n & 255)})`;
  }

  // Lighter top, base-color left face, darker right face, bright edge line:
  // that's the whole lighting model.
  const shadeCache = {};
  const S = (base) => (shadeCache[base] ||= {
    top: mix(base, 0.2), left: base, right: mix(base, -0.16), edge: mix(base, 0.42),
  });

  // Seeded random numbers, so generated scenery looks the same every visit
  function rng(seed) {
    let s = seed;
    return () => (s = (s * 16807) % 2147483647) / 2147483647;
  }

  // ---- Scale2x (EPX) ----
  // Doubles a sprite's size, but instead of making each pixel a blocky 2×2
  // square, it looks at the neighbors and rounds off diagonal staircases.
  // It's the same trick old emulators used to smooth out game graphics.
  function scale2x(rows) {
    const h = rows.length, w = rows[0].length;
    const get = (x, y) => (x < 0 || y < 0 || x >= w || y >= h ? '.' : rows[y][x]);
    const out = Array.from({ length: h * 2 }, () => new Array(w * 2));
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const p = get(x, y), a = get(x, y - 1), b = get(x + 1, y), c = get(x - 1, y), d = get(x, y + 1);
        out[2 * y][2 * x]         = c === a && c !== d && a !== b ? a : p;
        out[2 * y][2 * x + 1]     = a === b && a !== c && b !== d ? b : p;
        out[2 * y + 1][2 * x]     = d === c && d !== b && c !== a ? c : p;
        out[2 * y + 1][2 * x + 1] = b === d && b !== a && d !== c ? d : p;
      }
    }
    return out.map((r) => r.join(''));
  }

  // ---- Display size ----
  // Pick a CSS scale where each art pixel lands on a whole number of
  // *device* pixels (on a retina screen, 1.5 CSS px = exactly 3 device px).
  // That keeps every pixel the same size and razor sharp.
  function fit(el, W, maxScale = 1.5) {
    const avail = el.parentElement.clientWidth;
    const dpr = window.devicePixelRatio || 1;
    const s = Math.min(maxScale, avail / W);
    if (s < 1) { el.style.width = '100%'; return; } // phones: fill the width, tiny unevenness is fine
    el.style.width = (Math.floor(s * dpr) / dpr) * W + 'px';
  }

  function create(canvas, { W, H, OX, OY, K = 2 }) {
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');

    const P = (x, y, z) => [OX + (x - y) * K, OY + ((x + y) / 2 - z) * K];

    // Fill a polygon one pixel row at a time, with hard edges. (The canvas's
    // built-in fill() anti-aliases, which smears pixel art.)
    function poly(pts, color) {
      ctx.fillStyle = color;
      let minY = Infinity, maxY = -Infinity;
      for (const p of pts) { minY = Math.min(minY, p[1]); maxY = Math.max(maxY, p[1]); }
      for (let row = Math.floor(minY); row < Math.ceil(maxY); row++) {
        const sy = row + 0.5;
        const xs = [];
        for (let i = 0; i < pts.length; i++) {
          const [x1, y1] = pts[i];
          const [x2, y2] = pts[(i + 1) % pts.length];
          if ((y1 <= sy && y2 > sy) || (y2 <= sy && y1 > sy)) xs.push(x1 + ((sy - y1) / (y2 - y1)) * (x2 - x1));
        }
        xs.sort((a, b) => a - b);
        for (let i = 0; i + 1 < xs.length; i += 2) {
          const a = Math.round(xs[i]), b = Math.round(xs[i + 1]);
          if (b > a) ctx.fillRect(a, row, b - a, 1);
        }
      }
    }

    const px = (x, y, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(Math.round(x), Math.round(y), w, h); };

    // Pixel-perfect line between two screen points (Bresenham's algorithm)
    function line(x0, y0, x1, y1, c) {
      x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
      const dx = Math.abs(x1 - x0), sx = x0 < x1 ? 1 : -1;
      const dy = -Math.abs(y1 - y0), sy = y0 < y1 ? 1 : -1;
      let err = dx + dy;
      ctx.fillStyle = c;
      for (;;) {
        ctx.fillRect(x0, y0, 1, 1);
        if (x0 === x1 && y0 === y1) break;
        const e2 = 2 * err;
        if (e2 >= dy) { err += dy; x0 += sx; }
        if (e2 <= dx) { err += dx; y0 += sy; }
      }
    }
    const wline = (a, b, c) => line(...P(...a), ...P(...b), c);
    const dot = (x, y, z, c, size = 1) => { const [sx, sy] = P(x, y, z); px(sx, sy, size, size, c); };

    const quad = (a, b, c, d, color) => poly([P(...a), P(...b), P(...c), P(...d)], color);

    // Flat rectangles on each plane: onX = the left wall, onY = the right wall, onZ = the floor
    const onX = (xp, y, z, w, h, c) => quad([xp, y, z], [xp, y + w, z], [xp, y + w, z + h], [xp, y, z + h], c);
    const onY = (yp, x, z, w, h, c) => quad([x, yp, z], [x + w, yp, z], [x + w, yp, z + h], [x, yp, z + h], c);
    const onZ = (zp, x, y, w, d, c) => quad([x, y, zp], [x + w, y, zp], [x + w, y + d, zp], [x, y + d, zp], c);

    // A solid block. From this angle we only ever see three faces.
    function box(x, y, z, w, d, h, s) {
      if (s.left)  quad([x, y + d, z], [x + w, y + d, z], [x + w, y + d, z + h], [x, y + d, z + h], s.left);
      if (s.right) quad([x + w, y, z], [x + w, y + d, z], [x + w, y + d, z + h], [x + w, y, z + h], s.right);
      if (s.top)   quad([x, y, z + h], [x + w, y, z + h], [x + w, y + d, z + h], [x, y + d, z + h], s.top);
      if (s.edge && s.top && w >= 2 && d >= 2) { // a thin highlight where light catches the top edges
        wline([x, y + d, z + h], [x + w, y + d, z + h], s.edge);
        wline([x + w, y, z + h], [x + w, y + d, z + h], s.edge);
      }
    }

    // Sprites are arrays of strings: each character is one pixel, '.' is empty
    function sprite(rows, x, y, pal, flip = false) {
      x = Math.round(x); y = Math.round(y);
      rows.forEach((row, j) => {
        for (let i = 0; i < row.length; i++) {
          const ch = row[i];
          if (ch === '.') continue;
          px(flip ? x + row.length - 1 - i : x + i, y + j, 1, 1, pal[ch]);
        }
      });
    }

    return { ctx, W, H, K, P, poly, px, line, wline, dot, quad, onX, onY, onZ, box, sprite };
  }

  // ---- Floating-island underside ----
  // A grassy slab whose top is at height z0, with layers of dirt and stone
  // underneath that step inward as they go down, like an upside-down
  // ziggurat. That stepped taper is what sells "floating island".
  const GROUND = {
    grass: '#7cc66a', grassDark: '#5fae55', grassLight: '#a3dc87', grassSide: '#5fae55',
    layers: ['#a8774a', '#8f6440', '#7a6f78', '#655d6b', '#544d5c'],
  };

  function islandBase(g, { x = 0, y = 0, n, m = n, z0 = 0, seed = 1, grassTop = true }) {
    const r = rng(seed);
    const size = Math.min(n, m);
    const steps = [
      { inset: 0.0,  depth: 6 },
      { inset: 0.05, depth: 12 },
      { inset: 0.17, depth: 12 },
      { inset: 0.29, depth: 11 },
      { inset: 0.41, depth: 10 },
    ];
    const unit = size / 56; // islands of any size keep the same proportions
    let z = z0;
    steps.forEach((st, i) => {
      const inset = st.inset * size;
      const h = st.depth * unit;
      const bx = x + inset, by = y + inset, bw = n - inset * 2, bd = m - inset * 2;
      const color = GROUND.layers[Math.min(i, GROUND.layers.length - 1)];
      const s = S(color);
      g.box(bx, by, z - h, bw, bd, h, {
        top: i === 0 && grassTop ? GROUND.grass : null, left: s.left, right: s.right,
      });
      // Specks of rock in the dirt
      const specks = Math.round((bw + bd) * 0.5);
      for (let k = 0; k < specks; k++) {
        const onLeft = r() < 0.5;
        const u = r(), v = r();
        const c = r() < 0.5 ? mix(color, -0.25) : mix(color, 0.18);
        if (onLeft) g.dot(bx + u * bw, by + bd, z - h + v * h, c, r() < 0.3 ? 2 : 1);
        else g.dot(bx + bw, by + u * bd, z - h + v * h, c, r() < 0.3 ? 2 : 1);
      }
      z -= h;
    });

    // Grass lip hanging over the top edges, with a few drips
    g.onY(y + m, x, z0 - 2 * unit, n, 2 * unit, GROUND.grassSide);
    g.onX(x + n, y, z0 - 2 * unit, m, 2 * unit, GROUND.grassSide);
    for (let u = 1; u < n - 1; u += 2 + r() * 4) g.onY(y + m, x + u, z0 - (3 + r() * 3) * unit, 1.2, 2 * unit, GROUND.grassSide);
    for (let u = 1; u < m - 1; u += 2 + r() * 4) g.onX(x + n, y + u, z0 - (3 + r() * 3) * unit, 1.2, 2 * unit, GROUND.grassSide);

    // Roots dangling from the underside
    for (let k = 0; k < Math.round(size / 9); k++) {
      const front = r() < 0.5;
      const u = 0.15 + r() * 0.7;
      const len = (8 + r() * 14) * unit;
      const top = [front ? x + u * n : x + n, front ? y + m : y + u * m, z0 - 6 * unit];
      g.wline(top, [top[0], top[1], top[2] - len], r() < 0.5 ? '#6b4a2b' : GROUND.grassDark);
    }

    // Grass texture and a few flowers on top
    if (grassTop) {
      const flowers = ['#ffffff', '#ffd36b', '#ff8fb1', '#a7c7ff'];
      for (let k = 0; k < n * m / 14; k++) {
        const c = r() < 0.5 ? GROUND.grassDark : GROUND.grassLight;
        g.dot(x + r() * n, y + r() * m, z0, c);
      }
      for (let k = 0; k < n * m / 160; k++) {
        g.dot(x + 1 + r() * (n - 2), y + 1 + r() * (m - 2), z0, flowers[Math.floor(r() * flowers.length)], 2);
      }
    }
  }

  // ---- Trees, built from stacked blocks like voxel art ----
  function tree(g, x, y, z, kind = 'round') {
    const trunk = S('#8f5d30');
    if (kind === 'pine') {
      g.box(x - 1, y - 1, z, 2, 2, 4, trunk);
      const tiers = [[6, 4], [4.8, 8], [3.6, 12], [2.2, 16], [1, 19]];
      tiers.forEach(([half, h], i) => g.box(x - half, y - half, z + h, half * 2, half * 2, 4, S(i % 2 ? '#4a9a4f' : '#3d8445')));
    } else if (kind === 'palm') {
      for (let i = 0; i < 6; i++) g.box(x - 1 + i * 0.4, y - 1 - i * 0.2, z + i * 3, 2, 2, 3, trunk);
      const top = [x + 2.4, y - 1.2, z + 18];
      const leaf = S('#5fb35a');
      g.box(top[0] - 7, top[1] - 1, top[2], 14, 2, 1, leaf);
      g.box(top[0] - 1, top[1] - 7, top[2], 2, 14, 1, leaf);
      g.box(top[0] - 2, top[1] - 2, top[2] + 1, 4, 4, 2, S('#79c96a'));
    } else {
      const leaf = kind === 'blossom' ? ['#f29fb5', '#ffc2d4'] : ['#5fb35a', '#8fd17a'];
      g.box(x - 1, y - 1, z, 2, 2, 6, trunk);
      g.box(x - 5, y - 5, z + 6, 10, 10, 7, S(leaf[0]));
      g.box(x - 3.5, y - 3.5, z + 13, 7, 7, 3, S(leaf[1]));
    }
  }

  return { create, S, mix, rng, scale2x, fit, islandBase, tree };
})();
