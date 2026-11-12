// room.js: draws Maxwell's isometric room on its floating island and makes
// the objects in it clickable. The drawing toolkit lives in iso.js.
//
// Every object has a position in a little 3D world measured in "room units".
// The floor is 96 × 96 units and the walls are 72 tall. iso.js turns those
// into pixels at K = 2 pixels per unit.
//
// The clickable objects are invisible <button>s laid over the canvas, so they
// work with a keyboard and screen readers too.

(() => {
  const room = document.querySelector('.room');
  const canvas = document.getElementById('room-canvas');
  if (!room || !canvas || !canvas.getContext || !window.Iso) return;

  const K = 2;
  const W = 472, H = 452;
  const OX = 236, OY = 160;            // screen position of the room's back corner
  const X = 96, Y = 96, Z = 72;        // floor is X by Y, walls are Z tall

  const g = Iso.create(canvas, { W, H, OX, OY, K });
  const { ctx, P, poly, px, wline, dot, onX, onY, onZ, box, sprite } = g;
  const S = Iso.S;

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const statusEl = document.querySelector('.room-status');
  const DEFAULT_STATUS = statusEl ? statusEl.textContent : '';

  // ---- Palette: sunny morning ----
  const C = {
    wallL: '#f3f6f9', wallR: '#e6edf3', wallStripeL: '#e9eef3', wallStripeR: '#dde6ee',
    wallCap: '#cfd9e3', trim: '#ffffff', trimShade: '#d3dce5',
    floor: '#e0ab72', floorLine: '#cd955d', floorLight: '#eabc8a', slabL: '#b9834f', slabR: '#9c6a3c',
    wood: '#b77a45', woodDark: '#8f5d30', woodLight: '#d39c63', shelfBack: '#7d5129',
    sky1: '#8fcdf2', sky2: '#acdbf6', sky3: '#cdeafa', cloud: '#ffffff', sun: '#fff1a6', sunGlow: '#fff8d6',
    leaf: '#5fb35a', leafDark: '#3f8f44', leafLight: '#8fd17a', pot: '#e07a52',
    ink: '#2b2f3a', metal: '#a3acb8', metalDark: '#6f7987',
    curtain: '#f5d06f', curtainDark: '#e0b44a',
    rug: '#7fa7d9', rugDark: '#5e88c0', rugLight: '#b3cdee',
    blanket: '#7fa7d9', sheet: '#ffffff',
    cork: '#d4a067', corkDark: '#bb874f',
    screen: '#1f2738', up: '#5be08a', down: '#ff6b6b',
    gb: '#cfcbc3', gbBezel: '#5b5f6b', gbScreen: '#9bbc0f', gbPixel: '#306230',
    cat: '#f0a35e', catDark: '#c9783a', catLight: '#ffe0bf', catEye: '#2b2f3a', nose: '#f28b9b',
    door: '#c88d55', doorDark: '#a46f3c', knob: '#f2c94c',
    chair: '#3d4a63', accent: '#2f6fde', heart: '#ff7aa2',
    water: '#7fd1ff', waterLight: '#d9f3ff', waterDark: '#4fb3ea',
  };

  // ================= Clickable objects =================
  // Each one is a 3D box [x, y, z, w, d, h]. Its on-screen hit area is
  // worked out from that box, so moving an object moves its button too.

  const OBJECTS = [
    { id: 'door',    label: 'Door · contact',            target: '#contact',       box: [0, 76, 0, 1, 20, 53] },
    { id: 'shelf',   label: 'Bookshelf · research',      target: '#research',      box: [0, 50, 0, 12, 22, 64] },
    { id: 'cork',    label: 'Corkboard · experience',    target: '#experience',    box: [0, 10, 34, 1, 24, 18] },
    { id: 'window',  label: 'Window · about me',         target: '#about',         box: [27, 0, 20, 38, 1, 46] },
    { id: 'monitor', label: 'Computer · stock exchange', target: '#proj-exchange', box: [70, 4, 28, 18, 6, 15] },
    { id: 'gameboy', label: 'Game Boy · DMG-01',         target: '#proj-dmg',      box: [86, 10, 28, 6, 3, 9] },
    { id: 'cat',     label: 'Byte the cat · pet her',    target: null,             box: null },
  ];

  function screenBox([x, y, z, w, d, h]) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const cx of [x, x + w]) for (const cy of [y, y + d]) for (const cz of [z, z + h]) {
      const [sx, sy] = P(cx, cy, cz);
      x0 = Math.min(x0, sx); y0 = Math.min(y0, sy); x1 = Math.max(x1, sx); y1 = Math.max(y1, sy);
    }
    return [Math.floor(x0) - 2, Math.floor(y0) - 2, Math.ceil(x1 - x0) + 4, Math.ceil(y1 - y0) + 4];
  }
  for (const o of OBJECTS) if (o.box) o.screen = screenBox(o.box);

  // ================= Scenery data, generated once =================

  const seeded = Iso.rng(11);
  const books = [];
  for (const shelfZ of [2, 16, 30, 44]) {
    let y = 52;
    while (y < 70) {
      if (seeded() < 0.12) { y += 1.5; continue; }
      const w = 1.5 + Math.floor(seeded() * 3) * 0.5;
      const h = 7 + Math.floor(seeded() * 5);
      if (y + w > 70) break;
      books.push({ y, z: shelfZ, w, h, c: ['#e86f51', '#4f8fd6', '#f2c94c', '#6abe78', '#9b7fd1', '#f29fb5', '#3d4a63', '#ffffff', '#5bc0c9'][Math.floor(seeded() * 9)] });
      y += w;
    }
  }
  const seams = [];
  for (let i = 0; i < 24; i++) for (let k = 0; k < 2; k++) seams.push({ y: i * 4, x: (i * 29 + k * 47 + 11) % X });
  const grain = Array.from({ length: 40 }, () => ({ x: seeded() * 84, y: Math.floor(seeded() * 24) * 4 + 2, len: 4 + seeded() * 10 }));

  // The island never changes, so draw it once into a spare canvas and
  // copy that in every frame instead of redrawing hundreds of shapes.
  const islandLayer = document.createElement('canvas');
  {
    const ig = Iso.create(islandLayer, { W, H, OX, OY, K });
    Iso.islandBase(ig, { x: -8, y: -8, n: X + 16, z0: -6, seed: 4 });
  }

  // ================= Things that move =================

  let t = 0;
  const clouds = [{ u: 36, v: 50, w: 8 }, { u: 50, v: 44, w: 6 }, { u: 22, v: 54, w: 7 }];
  const birds = [];
  const motes = Array.from({ length: 16 }, () => newMote(true));
  function newMote(anyHeight) {
    const along = Math.random();
    return { x: 36 + along * 20 + Math.random() * 16, y: along * 50, z: anyHeight ? Math.random() * 30 : 0, v: 0.03 + Math.random() * 0.04 };
  }
  const prices = Array.from({ length: 31 }, (_, i) => 50 + Math.sin(i / 3) * 10);
  const hearts = [];
  const cat = { x: 46, y: 66, faceLeft: true, walking: false, idle: 0, step: 0 };
  const catGoal = { x: 46, y: 66 };
  let hovered = null;
  let clickedSomething = false;
  let sparkle = null;

  // ================= The room shell =================

  function drawShell() {
    // Walls run from below the floor (z = -6) so their outer edges meet the floor slab
    box(0, -4, -6, X, 4, Z + 6, { top: C.trim, left: C.wallR, right: C.wallCap });
    box(-4, -4, -6, 4, Y + 4, Z + 6, { top: C.trim, left: C.wallCap, right: C.wallL });
    for (let y = 4; y < Y; y += 4) wline([0, y, 0], [0, y, Z], C.wallStripeL); // wallpaper stripes
    for (let x = 4; x < X; x += 4) wline([x, 0, 0], [x, 0, Z], C.wallStripeR);
    onX(0, 0, 0, Y, 3, C.trim);                                   // baseboards
    wline([0, 0, 3], [0, Y, 3], C.trimShade);
    onY(0, 0, 0, X, 3, C.trim);
    wline([0, 0, 3], [X, 0, 3], C.trimShade);
    wline([0, 0, 0], [0, 0, Z], C.wallCap);                       // the corner crease

    box(0, 0, -6, X, Y, 6, { top: C.floor, left: C.slabL, right: C.slabR }); // floor
    for (let y = 4; y < Y; y += 4) wline([0, y, 0], [X, y, 0], C.floorLine);   // planks
    for (const s of seams) wline([s.x, s.y, 0], [s.x, s.y + 4, 0], C.floorLine);
    for (const gr of grain) wline([gr.x, gr.y, 0], [gr.x + gr.len, gr.y, 0], C.floorLight);
  }

  // Fairy lights strung along the top of both walls
  function drawLights() {
    const bulbs = ['#ff8a7a', '#ffd36b', '#7fd1ff', '#9be38a'];
    const sag = (u) => Z - 5 - 3 * Math.sin(Math.PI * ((u % 24) / 24));
    for (let u = 0; u < X; u += 0.5) {
      wline([u, 0.5, sag(u)], [u + 0.5, 0.5, sag(u + 0.5)], '#9aa1ab');
      wline([0.5, u, sag(u)], [0.5, u + 0.5, sag(u + 0.5)], '#9aa1ab');
    }
    let k = 0;
    for (let u = 6; u < X; u += 6, k++) {
      const on = reduceMotion || Math.sin(t / 25 + k) > -0.6;
      for (const [x, y] of [[u, 0.5], [0.5, u]]) {
        const [sx, sy] = P(x, y, sag(u) - 1);
        if (on) { ctx.globalAlpha = 0.35; px(sx - 2, sy - 1, 6, 5, bulbs[k % 4]); } // glow
        ctx.globalAlpha = on ? 1 : 0.45;
        px(sx, sy, 2, 3, bulbs[k % 4]);
      }
    }
    ctx.globalAlpha = 1;
  }

  // ================= Things on the walls =================

  function drawDoor() {
    onX(0, 76, 0, 20, 53, C.trim);
    onX(0, 78, 0, 16, 50, C.door);
    for (const z of [4, 27]) {
      onX(0, 80, z, 12, 19, C.doorDark);
      onX(0, 80.6, z + 0.6, 11.4, 18.4, '#d49a62');
      onX(0, 80.6, z + 0.6, 10.8, 17.8, C.door);
    }
    const [kx, ky] = P(0, 91, 25);
    px(kx - 1, ky - 1, 3, 3, C.knob);
  }

  function drawCorkboard() {
    onX(0, 10, 34, 24, 18, C.wood);
    onX(0, 11, 35, 22, 16, C.cork);
    for (let i = 0; i < 40; i++) dot(0, 12 + ((i * 13) % 20), 36 + ((i * 7) % 14), C.corkDark);
    const notes = [[13, 44, 6, 5, '#fff6a8'], [21, 45, 7, 5, '#cfe3ff'], [14, 37, 7, 5, '#ffd1dc'], [24, 37, 6, 6, '#c9f2d0'], [29, 45, 3, 4, '#ffffff']];
    for (const [y, z, w, h, c] of notes) {
      onX(0, y, z, w, h, c);
      for (let l = 1.5; l < h - 1; l += 1.2) wline([0, y + 1, z + h - l], [0, y + w - 1.5, z + h - l], 'rgba(0,0,0,0.13)');
      const [sx, sy] = P(0, y + w / 2, z + h);
      px(sx - 1, sy - 1, 2, 2, '#e03b3b');
    }
  }

  function drawClock() {
    const cu = 15, cv = 53;
    for (let dv = -5; dv < 5; dv += 0.5) {
      const half = Math.sqrt(Math.max(0, 25 - (dv + 0.25) ** 2));
      onY(0, cu - half, cv + dv, half * 2, 0.5, C.ink);
    }
    for (let dv = -4.3; dv < 4.3; dv += 0.5) {
      const half = Math.sqrt(Math.max(0, 18.5 - (dv + 0.25) ** 2));
      onY(0, cu - half, cv + dv, half * 2, 0.5, '#ffffff');
    }
    for (let h = 0; h < 12; h += 3) dot(cu + Math.sin(h / 6 * Math.PI) * 3.4, 0, cv + Math.cos(h / 6 * Math.PI) * 3.4, C.ink);
    // The clock shows the visitor's real time
    const now = new Date();
    const hand = (angle, len, c) => wline([cu, 0, cv], [cu + Math.sin(angle) * len, 0, cv + Math.cos(angle) * len], c);
    hand(((now.getHours() % 12) + now.getMinutes() / 60) / 12 * Math.PI * 2, 2.4, C.ink);
    hand((now.getMinutes() / 60) * Math.PI * 2, 3.6, C.accent);
  }

  function drawWindow() {
    // Sky, clipped by hand to the glass (x 34..58, z 26..60)
    const skyRect = (u, v, w, h, c) => {
      const a = Math.max(u, 34), b = Math.min(u + w, 58);
      const lo = Math.max(v, 26), hi = Math.min(v + h, 60);
      if (b > a && hi > lo) onY(0, a, lo, b - a, hi - lo, c);
    };
    skyRect(34, 48, 24, 12, C.sky1);
    skyRect(34, 37, 24, 11, C.sky2);
    skyRect(34, 26, 24, 11, C.sky3);
    for (let dv = -4; dv < 4; dv += 0.5) {
      const half = Math.sqrt(Math.max(0, 16 - (dv + 0.25) ** 2));
      skyRect(52 - half, 54 + dv, half * 2, 0.5, dv > -2.5 && dv < 2 ? C.sun : C.sunGlow);
    }
    for (const c of clouds) {
      skyRect(c.u, c.v, c.w, 2, C.cloud);
      skyRect(c.u + 1.5, c.v + 2, c.w - 4, 1.5, C.cloud);
      skyRect(c.u + 0.5, c.v - 0.5, c.w - 1, 0.5, '#e4f2fb');
    }
    for (let u = 34; u < 58; u += 1) skyRect(u, 26, 1, 2 + ((u * 7) % 3), u % 3 < 1 ? C.leafDark : C.leaf);
    for (const b of birds) {
      const [sx, sy] = P(b.u, 0, b.v);
      const up = Math.floor(b.flap / 8) % 2;
      for (const [dx, dy] of up ? [[-2, 0], [-1, 1], [0, 2], [1, 1], [2, 0]] : [[-2, 2], [-1, 1], [0, 2], [1, 1], [2, 2]]) px(sx + dx, sy + dy, 1, 1, C.ink);
    }
    ctx.globalAlpha = 0.25; // a glint across the glass
    poly([P(36, 0, 58), P(40, 0, 58), P(36, 0, 50)], '#ffffff');
    ctx.globalAlpha = 1;

    // Frame and cross bars
    onY(0, 32, 24, 28, 2, C.trim);
    onY(0, 32, 60, 28, 2, C.trim);
    onY(0, 32, 24, 2, 38, C.trim);
    onY(0, 58, 24, 2, 38, C.trim);
    onY(0, 45.5, 26, 1.5, 34, C.trim);
    onY(0, 34, 42.5, 24, 1.5, C.trim);
    box(31, 0, 22.5, 30, 3, 1.5, S(C.trim)); // sill
    box(52, 0.5, 24, 3, 2, 2, S(C.pot));      // cactus
    box(52.8, 1, 26, 1.4, 1, 4, S(C.leaf));
    box(51.8, 1, 27, 1, 1, 1.5, S(C.leaf));

    // Curtains and rod
    for (const u of [27, 60]) {
      onY(0.3, u, 20, 5, 44, C.curtain);
      for (let k = 0.75; k < 5; k += 1.25) wline([u + k, 0.3, 20], [u + k, 0.3, 64], C.curtainDark);
      onY(0.3, u, 38, 5, 1.5, C.curtainDark); // tie-back
    }
    wline([26, 0.5, 65], [66, 0.5, 65], C.metalDark);
    wline([26, 0.5, 65.5], [66, 0.5, 65.5], C.metal);
  }

  function drawPoster() {
    onY(0, 70, 52, 18, 14, C.woodDark);
    onY(0, 71, 53, 16, 12, '#dff1fb');
    poly([P(72, 0, 55), P(77, 0, 62), P(82, 0, 55)], '#7fa7d9');
    poly([P(75.5, 0, 59.5), P(77, 0, 62), P(78.5, 0, 59.5)], '#ffffff');
    poly([P(78, 0, 55), P(82, 0, 59), P(86, 0, 55)], '#5e88c0');
    onY(0, 71, 53, 16, 2.5, C.leaf);
    const [sx, sy] = P(84, 0, 62);
    px(sx - 1, sy - 1, 3, 3, C.sun);
  }

  // ================= Furniture =================

  function drawRug() {
    onZ(0, 22, 46, 46, 38, C.rugDark);
    onZ(0, 23, 47, 44, 36, C.rug);
    onZ(0, 27, 51, 36, 28, C.rugLight);
    onZ(0, 28, 52, 34, 26, C.rug);
    onZ(0, 39, 60, 12, 10, C.rugLight);
    onZ(0, 40, 61, 10, 8, C.rug);
    for (let u = 23; u < 67; u += 2) { dot(u, 84, 0, C.rugLight); dot(u, 46, 0, C.rugLight); } // tassels
  }

  function drawSunbeam() {
    ctx.globalAlpha = 0.25;
    poly([P(34, 0, 0), P(58, 0, 0), P(76, 50, 0), P(52, 50, 0)], '#fff6d0');
    ctx.globalAlpha = 1;
  }

  function drawBed() {
    box(2, 0, 0, 32, 3, 22, S(C.wood));           // headboard
    onY(3, 5, 10, 26, 9, C.woodDark);             // headboard panel
    onY(3, 5.5, 10.5, 25, 8, C.wood);
    box(2, 3, 0, 32, 40, 7, S(C.woodDark));       // frame
    box(3, 3, 7, 30, 39, 4, S(C.sheet));          // mattress
    box(6, 5, 11, 22, 7, 3, S('#f4f6fa'));        // pillow
    wline([6, 8.5, 14], [28, 8.5, 14], '#e3e8f0');
    box(2.5, 17, 6, 31, 26.5, 6.5, S(C.blanket)); // blanket draped over the sides
    for (let y = 20; y < 43; y += 3.5) wline([2.5, y, 12.5], [33.5, y, 12.5], C.rugLight); // plaid
    for (let x = 5.5; x < 33; x += 3.5) wline([x, 17, 12.5], [x, 43.5, 12.5], C.rugLight);
    wline([2.5, 17, 12.5], [33.5, 17, 12.5], '#9cbde6');  // turned-down edge
  }

  function drawShelf() {
    box(0, 50, 0, 12, 22, 58, S(C.wood));
    onX(12, 51.5, 2, 19, 54, C.shelfBack);
    for (const b of books) {
      onX(12, b.y, b.z, b.w, b.h, b.c);
      wline([12, b.y, b.z + b.h - 2], [12, b.y + b.w, b.z + b.h - 2], 'rgba(0,0,0,0.2)');
      wline([12, b.y, b.z + 1.5], [12, b.y + b.w, b.z + 1.5], 'rgba(0,0,0,0.2)');
    }
    for (const z of [14, 28, 42]) onX(12, 51.5, z, 19, 2, C.woodLight);
    box(3, 55, 58, 5, 5, 4, S(C.pot));            // plant on top
    const [sx, sy] = P(5.5, 57.5, 62);
    for (const [dx, dy, w, h, c] of [[-4, -16, 3, 14, C.leaf], [1, -20, 3, 18, C.leafDark], [5, -14, 3, 12, C.leafLight], [-7, -10, 3, 8, C.leafLight], [-1, -12, 2, 10, C.leafLight]]) px(sx + dx, sy + dy, w, h, c);
    box(3, 63, 58, 7, 6, 1.5, S('#4f8fd6'));      // books lying flat
    box(3.5, 63.5, 59.5, 6, 5, 1.5, S('#f2c94c'));
  }

  function drawDesk() {
    box(78, 2, 0, 15, 16, 26, S(C.wood));         // drawers
    for (const z of [9, 18]) wline([78, 18, z], [93, 18, z], C.woodDark);
    for (const z of [5, 14, 22]) { const [sx, sy] = P(85.5, 18, z); px(sx - 1, sy, 3, 1, C.knob); }
    box(63, 16, 0, 2, 2, 26, S(C.woodDark));      // front leg
    box(62, 1, 26, 32, 19, 2, S(C.woodLight));    // desktop

    box(64, 4, 28, 4, 4, 1, S(C.metalDark));      // lamp
    box(65.5, 5.5, 29, 1, 1, 9, S(C.metal));
    box(63, 4, 37, 6, 5, 3, S('#e86f51'));

    box(78, 4, 28, 2, 2, 3, S(C.metalDark));      // monitor stand
    box(70, 4, 30, 18, 2, 13, S(C.ink));          // monitor
    onY(6, 71, 31, 16, 11, C.screen);
    drawChart();
    box(71, 9, 28, 14, 4, 0.8, S('#e3e8ee'));     // keyboard
    for (let r = 0; r < 3; r++) for (let c = 0; c < 13; c++) dot(71.6 + c, 9.8 + r * 1.1, 28.8, '#b9c1cb');

    box(86, 10, 28, 6, 2, 9, S(C.gb));            // Game Boy, standing up
    onY(12, 86.8, 32.3, 4.4, 4, C.gbBezel);
    onY(12, 87.4, 32.8, 3.2, 2.8, C.gbScreen);
    onY(12, 87.6 + (Math.floor(t / 12) % 3) * 0.6, 34.3, 1, 0.6, C.gbPixel); // something is "playing"
    onY(12, 87.4, 29.8, 2, 0.6, C.ink);           // d-pad
    onY(12, 88.1, 29.1, 0.6, 2, C.ink);
    onY(12, 90.3, 30, 0.8, 0.8, '#b03060');       // A/B
    onY(12, 91.1, 30.6, 0.8, 0.8, '#b03060');

    box(81, 13, 28, 3, 3, 4, S('#4f8fd6'));       // mug
    onZ(32, 81.5, 13.5, 2, 2, '#6b4226');
    ctx.globalAlpha = 0.65;
    for (let i = 0; i < 4; i++) {
      const life = (t / 2 + i * 8) % 30;
      const [sx, sy] = P(82.5, 14.5, 33 + life / 3);
      px(sx + Math.round(Math.sin((t + i * 20) / 10) * 1.5), sy, 1, 2, '#ffffff');
    }
    ctx.globalAlpha = 1;
  }

  function drawChart() {
    const c = prices[prices.length - 1] >= prices[0] ? C.up : C.down;
    for (const z of [34, 37, 40]) wline([71, 6, z], [87, 6, z], '#2a3348');
    let prev = null;
    prices.forEach((p, i) => {
      const pt = [71.5 + i * 0.5, 6, 32.3 + ((p - 20) / 60) * 8.7];
      if (prev) wline(prev, pt, c);
      prev = pt;
    });
    onY(6, 72, 41, 4, 0.6, c);                    // tiny ticker label
    onY(6, 77, 41, 3, 0.6, '#8a94a8');
  }

  function drawChair() {
    box(72, 24, 0, 10, 8, 1, S(C.metalDark));
    for (const [x, y] of [[72, 24], [81, 24], [72, 31], [81, 31]]) { const [sx, sy] = P(x, y, 0); px(sx - 1, sy, 3, 2, C.ink); }
    box(76, 27, 1, 2, 2, 10, S(C.metalDark));
    box(71, 22, 11, 12, 10, 2, S(C.chair));
    box(71, 31, 13, 12, 2, 13, S(C.chair));
    onY(33, 72.5, 15, 9, 9, '#4a5874');
  }

  function drawPlant() {
    box(86, 58, 0, 9, 9, 9, S(C.pot));
    onZ(9, 87, 59, 7, 7, '#6b4a2b');
    const [sx, sy] = P(90.5, 62.5, 9);
    const leaves = [
      [-2, -36, 5, 36, C.leafDark], [-12, -24, 7, 20, C.leaf], [6, -28, 7, 24, C.leaf],
      [-18, -14, 7, 10, C.leafLight], [12, -16, 7, 12, C.leafLight], [-8, -40, 5, 16, C.leaf],
      [4, -44, 5, 20, C.leafLight], [-1, -48, 3, 10, C.leafLight],
    ];
    for (const [dx, dy, w, h, c] of leaves) px(sx + dx, sy + dy, w, h, c);
  }

  // A little stream runs off the island's edge and falls into the sky
  function drawWaterfall() {
    const x = X + 8, y0 = Y - 30, w = 7;
    onZ(-6, X, y0, 8, w, C.waterDark);
    onZ(-6, X + 0.5, y0 + 1, 7.5, w - 2, C.water);
    const top = -6, bottom = -62;
    onX(x, y0, bottom, w, top - bottom, C.water);
    for (let i = 0; i < 9; i++) { // streaks sliding down
      const lane = y0 + 0.6 + (i % 5) * 1.3;
      const z = top - ((t * 0.5 + i * 7.3) % (top - bottom));
      onX(x + 0.1, lane, z - 4, 0.6, 4, i % 2 ? C.waterLight : C.waterDark);
    }
    ctx.globalAlpha = 0.5; // fades out into mist at the bottom
    onX(x + 0.1, y0 - 1, bottom - 4, w + 2, 10, '#ffffff');
    ctx.globalAlpha = 1;
  }

  function drawMotes() {
    ctx.globalAlpha = 0.8;
    for (const m of motes) dot(m.x, m.y, m.z, '#fffbe6');
    ctx.globalAlpha = 1;
  }

  // ================= Byte the cat =================
  // Drawn as small pixel sprites, then doubled with Scale2x so she keeps
  // smooth edges at this resolution instead of looking chunky.

  const CAT_PAL = { b: C.cat, d: C.catDark, l: C.catLight, e: C.catEye, p: C.nose };
  const big = (frames) => frames.map(Iso.scale2x);
  const CAT_WALK = big([
    ['...........b..b.', '...........bbbb.', 'd..........ebeb.', 'd.bbbbbbbbbbbpb.',
     '.dbbdbbdbbbbbl..', '..bbbbbbbbbbl...', '..b.b......b.b..', '..b.b......b.b..'],
    ['...........b..b.', '...........bbbb.', '.d.........ebeb.', 'd.bbbbbbbbbbbpb.',
     'd.bbdbbdbbbbbl..', '..bbbbbbbbbbl...', '...b.b....b.b...', '..b...b..b...b..'],
  ]);
  const [CAT_SIT, CAT_SLEEP, HEART] = big([
    ['.......b..b.', '.......bbbb.', '.......ebeb.', '.......bbpb.', '......bbbbl.',
     '.....bbdbbl.', '....bbbbbbl.', 'd..bbdbbbbb.', 'dddbbbbbbbb.', '...bb.bb.bb.'],
    ['.......b..b.', '......bbbbbb', '....bbdbbbeb', '..bbbbbbbbbb',
     'ddbbdbbdbbbb', 'dbbbbbbbbbbl', '.bbbbbbbbbb.'],
    ['.p.p.', 'ppppp', '.ppp.', '..p..'],
  ]);

  // The cat walks around the front of the room, away from the furniture
  const clampCat = (gl) => ({ x: Math.max(18, Math.min(80, gl.x)), y: Math.max(46, Math.min(90, gl.y)) });

  function updateCat(dt) {
    const goal = clampCat(catGoal);
    const dx = goal.x - cat.x, dy = goal.y - cat.y;
    const dist = Math.hypot(dx, dy);
    if (dist > 1.5) {
      cat.x += (dx / dist) * 0.35 * dt;
      cat.y += (dy / dist) * 0.35 * dt;
      cat.faceLeft = dx - dy < 0; // on screen, "right" is x minus y
      cat.walking = true;
      cat.idle = 0;
      cat.step += dt;
    } else {
      cat.walking = false;
      cat.idle += dt;
    }
    for (const h of hearts) { h.y -= 0.5 * dt; h.life -= dt; }
    while (hearts.length && hearts[0].life <= 0) hearts.shift();
  }

  function drawCat() {
    const [sx, sy] = P(cat.x, cat.y, 0);
    const flip = cat.faceLeft;
    let rows;
    if (cat.walking) rows = CAT_WALK[Math.floor(cat.step / 8) % 2];
    else if (cat.idle > 600) rows = CAT_SLEEP; // about 10 seconds without moving: nap time
    else rows = CAT_SIT;
    const w = rows[0].length, h = rows.length;
    const left = Math.round(sx - w / 2), top = Math.round(sy - h);
    ctx.globalAlpha = 0.18;
    px(left + 3, top + h - 1, w - 6, 3, '#5a3c1e'); // shadow
    ctx.globalAlpha = 1;
    sprite(rows, left, top, CAT_PAL, flip);

    if (rows === CAT_SLEEP && !reduceMotion) {
      const z = (t / 3) % 30;
      ctx.globalAlpha = 1 - z / 30;
      const zx = left + (flip ? -6 : w + 2) + z / 3, zy = top - 4 - z;
      px(zx, zy, 5, 1, C.ink); px(zx + 3, zy + 1, 1, 1, C.ink); px(zx + 2, zy + 2, 1, 1, C.ink);
      px(zx + 1, zy + 3, 1, 1, C.ink); px(zx, zy + 4, 5, 1, C.ink);
      ctx.globalAlpha = 1;
    }
    for (const hrt of hearts) {
      ctx.globalAlpha = Math.min(1, hrt.life / 20);
      sprite(HEART, left + hrt.dx, top + hrt.y, { p: C.heart });
    }
    ctx.globalAlpha = 1;
    const catObj = OBJECTS.find((o) => o.id === 'cat');
    catObj.screen = [left - 3, top - 3, w + 6, h + 6];
    place(catObj.el, catObj.screen);
  }

  function petCat() {
    cat.idle = 0;
    for (let i = 0; i < 3; i++) hearts.push({ dx: i * 8, y: -4 - i * 6, life: 60 + i * 10 });
    if (reduceMotion) draw();
  }

  // ================= Hover brackets and sparkles =================

  function drawBrackets(o) {
    const [x, y, w, h] = o.screen;
    const L = 7, x2 = x + w - 2, y2 = y + h - 2, c = C.accent;
    ctx.globalAlpha = 0.75 + 0.25 * Math.sin(t / 8);
    px(x, y, L, 2, c); px(x, y, 2, L, c);
    px(x2 - L + 2, y, L, 2, c); px(x2, y, 2, L, c);
    px(x, y2, L, 2, c); px(x, y2 - L + 2, 2, L, c);
    px(x2 - L + 2, y2, L, 2, c); px(x2, y2 - L + 2, 2, L, c);
    ctx.globalAlpha = 1;
  }

  // Until the visitor clicks something, a twinkle hops between objects
  // to hint that they're clickable.
  function drawSparkle() {
    if (clickedSomething) return;
    if (!sparkle || t - sparkle.start > 70) {
      const choices = OBJECTS.filter((o) => o.target && o !== sparkle?.obj);
      sparkle = { obj: choices[Math.floor(Math.random() * choices.length)], start: t };
    }
    const age = t - sparkle.start;
    if (age > 40) return;
    const size = (age < 20 ? Math.floor(age / 5) : Math.floor((40 - age) / 5)) + 1;
    const [x, y, w] = sparkle.obj.screen;
    const cx = x + w - 4, cy = y + 4;
    px(cx - size, cy, size * 2 + 1, 1, '#ffffff');
    px(cx, cy - size, 1, size * 2 + 1, '#ffffff');
    px(cx - 1, cy - 1, 3, 3, C.knob);
  }

  // ================= Update + draw =================

  function update(dt) {
    t += dt;
    for (const c of clouds) {
      c.u += 0.02 * dt;
      if (c.u > 60) c.u = 34 - c.w;
    }
    if (Math.random() < 0.004 * dt && birds.length < 3) birds.push({ u: 34, v: 46 + Math.random() * 10, flap: 0 });
    for (const b of birds) { b.u += 0.2 * dt; b.flap += dt; }
    while (birds.length && birds[0].u > 58) birds.shift();
    for (let i = 0; i < motes.length; i++) {
      const m = motes[i];
      m.z += m.v * dt;
      if (m.z > 32) motes[i] = newMote(false);
    }
    if (Math.floor(t / 10) !== Math.floor((t - dt) / 10)) {
      const last = prices[prices.length - 1];
      prices.shift();
      prices.push(Math.max(22, Math.min(78, last + (Math.random() - 0.47) * 7)));
    }
    updateCat(dt);
  }

  // Painter's algorithm: draw from the back of the room to the front
  function draw() {
    ctx.clearRect(0, 0, W, H);
    ctx.drawImage(islandLayer, 0, 0);
    drawWaterfall();
    drawShell();
    drawDoor();
    drawCorkboard();
    drawClock();
    drawWindow();
    drawPoster();
    drawLights();
    drawRug();
    drawSunbeam();
    drawBed();
    drawShelf();
    drawDesk();
    drawChair();
    drawPlant();
    drawMotes();
    drawCat();
    if (hovered) drawBrackets(hovered);
    else if (!reduceMotion) drawSparkle();
  }

  // ================= Buttons over the canvas =================

  function place(el, [x, y, w, h]) {
    el.style.left = (x / W) * 100 + '%';
    el.style.top = (y / H) * 100 + '%';
    el.style.width = (w / W) * 100 + '%';
    el.style.height = (h / H) * 100 + '%';
  }

  const layer = room.querySelector('.room-hotspots');
  for (const o of OBJECTS) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'hotspot';
    b.setAttribute('aria-label', o.label);
    if (o.screen) place(b, o.screen);
    const show = () => {
      hovered = o.target ? o : null;
      if (statusEl) statusEl.textContent = o.label;
      if (reduceMotion) draw();
    };
    const hide = () => {
      hovered = null;
      if (statusEl) statusEl.textContent = DEFAULT_STATUS;
      if (reduceMotion) draw();
    };
    b.addEventListener('pointerenter', show);
    b.addEventListener('focus', show);
    b.addEventListener('pointerleave', hide);
    b.addEventListener('blur', hide);
    b.addEventListener('click', () => {
      clickedSomething = true;
      if (o.target) openPanel(o);
      else petCat();
    });
    layer.appendChild(b);
    o.el = b;
  }

  // The cat walks toward the spot on the floor under the pointer.
  // This runs the projection backwards: screen point -> floor point (z = 0).
  room.addEventListener('pointermove', (e) => {
    const rect = canvas.getBoundingClientRect();
    const sx = (((e.clientX - rect.left) / rect.width) * W - OX) / K;
    const sy = (((e.clientY - rect.top) / rect.height) * H - OY) / K;
    catGoal.x = (sx + 2 * sy) / 2;
    catGoal.y = (2 * sy - sx) / 2;
  });

  // ================= Popup panel =================
  // The popup copies its content from the matching card further down the
  // page, so each piece of text only lives in one place in the HTML.

  const dialog = document.getElementById('panel');
  const panelTitle = dialog.querySelector('.panel-title');
  const panelBody = dialog.querySelector('.panel-body');

  function openPanel(o) {
    const src = document.querySelector(o.target);
    if (!src) return;
    const heading = src.querySelector('h2, h3');
    panelTitle.textContent = heading ? heading.textContent : o.label;
    panelBody.replaceChildren();
    for (const child of src.children) {
      if (child === heading) continue;
      const copy = child.cloneNode(true);
      copy.removeAttribute('id');
      copy.querySelectorAll('[id]').forEach((n) => n.removeAttribute('id'));
      panelBody.appendChild(copy);
    }
    dialog.showModal();
  }

  dialog.querySelector('.panel-close').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', (e) => { if (e.target === dialog) dialog.close(); }); // click outside

  // ================= Size + animation loop =================

  const fit = () => Iso.fit(room, W, 1.5);
  fit();
  window.addEventListener('resize', fit);

  let running = false;
  let last = 0;

  function frame(now) {
    if (!running) return;
    const dt = last ? Math.min((now - last) / (1000 / 60), 3) : 1;
    last = now;
    update(dt);
    draw();
    requestAnimationFrame(frame);
  }

  draw();
  if (!reduceMotion) {
    new IntersectionObserver(([entry]) => {
      running = entry.isIntersecting;
      last = 0;
      if (running) requestAnimationFrame(frame);
    }).observe(room);
  }
})();
