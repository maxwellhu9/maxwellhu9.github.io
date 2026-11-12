// islands.js: the floating islands further down the page, one per project
// or chapter. Each <canvas class="island" data-island="..."> gets a scene.
//
// The ground under each island never changes, so it's drawn once into a
// hidden canvas. Every frame we copy that in and draw the scene on top.
// Islands only animate while they're on screen.

(() => {
  if (!window.Iso) return;
  const { S, tree, islandBase, scale2x } = Iso;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const K = 2;

  // A filled circle drawn on a "right wall" plane (y = yp), using thin strips
  function discY(g, yp, u, v, r, c) {
    for (let dv = -r; dv < r; dv += 0.5) {
      const half = Math.sqrt(Math.max(0, r * r - (dv + 0.25) ** 2));
      if (half > 0) g.onY(yp, u - half, v + dv, half * 2, 0.5, c);
    }
  }
  // A filled circle in screen space (for puffs of smoke)
  function puff(g, cx, cy, r, c) {
    for (let dy = -r; dy <= r; dy++) {
      const half = Math.round(Math.sqrt(r * r - dy * dy));
      g.px(cx - half, cy + dy, half * 2 + 1, 1, c);
    }
  }

  // ---- Little sprites, doubled with Scale2x for smooth edges ----
  const BOT = scale2x(['..a...', '.hhhh.', '.heeh.', '.hhhh.', 'bbbbbb', '.bbbb.', '.b..b.']);
  const ROBOT = scale2x(['....a....', '..hhhhh..', '..heheh..', '..hhhhh..', '.bbbbbbb.', 'abbbbbbba', '.bbbbbbb.', '..bb.bb..']);
  const STAR = scale2x(['..y..', '.yyy.', 'yyyyy', '.yyy.', '.y.y.']);

  // ================= Scenes =================
  // Each scene says how big its island is (n), how tall its tallest thing is
  // (zMax, so the canvas is tall enough), and how to draw itself at time t.

  const SCENES = {
    // DMG-01: a giant Game Boy, playing a tiny game
    gameboy: {
      n: 56, zMax: 44, seed: 3,
      draw(g, t) {
        tree(g, 8, 8, 0, 'pine');
        tree(g, 47, 9, 0, 'round');
        g.box(16, 32, 0, 26, 6, 40, S('#d8d4cc'));
        g.onY(38, 18.5, 18, 21, 19, '#5b5f6b');                 // bezel
        g.onY(38, 21, 20.5, 16, 14, '#9bbc0f');                 // screen
        g.onY(38, 21, 20.5, 16, 2.5, '#306230');                // ground in the game
        for (let i = 0; i < 3; i++) {                           // pipes scrolling past
          const u = 21 + ((((i * 6 - t * 0.06) % 16) + 16) % 16);
          if (u < 35.5) g.onY(38, u, 23, 1.5, 2 + (i % 2) * 1.5, '#306230');
        }
        const jump = Math.max(0, Math.sin(t / 14)) * 5;
        g.onY(38, 24.5, 23 + jump, 2, 3, '#0f380f');            // the hero, jumping
        discY(g, 38, 33, 31, 1.5, '#8bac0f');                   // sun in the game
        discY(g, 38, 19.8, 29, 0.6, '#ff4d4d');                 // power light
        g.onY(38, 19, 8.25, 7, 2.5, '#2b2f3a');                 // d-pad
        g.onY(38, 21.25, 6, 2.5, 7, '#2b2f3a');
        discY(g, 38, 33.5, 9, 1.6, '#b03060');                  // B
        discY(g, 38, 37.5, 10.5, 1.6, '#b03060');               // A
        g.onY(38, 25.5, 3, 3, 0.8, '#8a8f99');                  // select / start
        g.onY(38, 30, 3, 3, 0.8, '#8a8f99');
        for (let k = 0; k < 4; k++) g.wline([35 + k, 38, 1], [37 + k, 38, 5], '#a8a39a'); // speaker
        g.box(40, 44, 0, 10, 8, 2, S('#7a7f8a'));               // a cartridge on the grass
        g.onZ(2, 41.5, 45, 6, 5.5, '#f2c94c');
        g.box(5, 44, 0, 4, 3, 2, S('#9aa1ab'));                 // rocks
        g.box(8, 47, 0, 3, 2, 1.5, S('#9aa1ab'));
      },
    },

    // Paper Trading Exchange: a little exchange building, a live ticker,
    // and the four kinds of trading bots wandering around outside
    exchange: {
      n: 56, zMax: 38, seed: 7,
      prices: Array.from({ length: 24 }, (_, i) => 50 + Math.sin(i / 2.5) * 12),
      draw(g, t) {
        tree(g, 49, 7, 0, 'round');
        g.box(6, 8, 0, 34, 24, 24, S('#ece6da'));               // building
        for (let u = 9; u < 38; u += 5.5) {                     // columns
          g.onY(32, u, 3, 2.6, 17, '#fbf8f2');
          g.onY(32, u + 2, 3, 0.6, 17, '#d5cdbd');
        }
        g.onY(32, 6, 20, 34, 4, '#d5cdbd');                     // frieze
        g.onY(32, 20, 0, 6, 9, '#8f5d30');                      // doors
        const roof = S('#c46a4a');                              // gabled roof
        g.quad([6, 8, 24], [23, 8, 32], [23, 32, 32], [6, 32, 24], roof.top);
        g.quad([23, 8, 32], [40, 8, 24], [40, 32, 24], [23, 32, 32], roof.right);
        g.poly([g.P(6, 32, 24), g.P(40, 32, 24), g.P(23, 32, 32)], '#f6f1e8');
        g.box(8, 32, 0, 30, 3, 1.5, S('#d9d2c4'));              // steps
        g.box(10, 35, 0, 26, 2, 0.8, S('#d9d2c4'));

        g.box(45, 31, 0, 1.2, 1.2, 12, S('#6f7987'));           // ticker board on posts
        g.box(52, 31, 0, 1.2, 1.2, 12, S('#6f7987'));
        g.box(42, 30, 11, 14, 2, 10, S('#2b2f3a'));
        const ps = this.prices;
        if (t - (this.lastTick || 0) > 10) {                   // new price every ~10 frames
          this.lastTick = t;
          ps.shift();
          ps.push(Math.max(22, Math.min(78, ps[ps.length - 1] + (Math.random() - 0.47) * 9)));
        }
        const c = ps[ps.length - 1] >= ps[0] ? '#5be08a' : '#ff6b6b';
        let prev = null;
        ps.forEach((p, i) => {
          const pt = [43 + i * 0.5, 32, 12.5 + ((p - 20) / 60) * 7];
          if (prev) g.wline(prev, pt, c);
          prev = pt;
        });

        // value, momentum, noise, market maker
        const bots = ['#4f8fd6', '#e86f51', '#f2c94c', '#6abe78'];
        bots.forEach((color, i) => {
          const along = (Math.sin(t / 90 + i * 1.7) + 1) / 2;
          const [sx, sy] = g.P(8 + along * 34, 42 + (i % 2) * 6, 0);
          const hop = Math.abs(Math.sin(t / 8 + i)) > 0.8 ? 1 : 0;
          g.sprite(BOT, sx - 6, sy - 14 - hop, { a: '#6f7987', h: '#d9dee5', e: '#2b2f3a', b: color });
        });
      },
    },

    // NASA × Break Through Tech: a rocket on the pad, venting steam
    rocket: {
      n: 56, zMax: 52, seed: 12,
      draw(g, t) {
        tree(g, 6, 48, 0, 'pine');
        g.box(10, 10, 0, 36, 36, 2, S('#b9c1cb'));             // launch pad
        for (let u = 10; u < 46; u += 4) {                      // hazard stripes
          g.onY(46, u, 0, 2, 2, '#f2c94c');
          g.onX(46, u, 0, 2, 2, '#f2c94c');
        }
        g.box(36, 13, 2, 5, 5, 46, S('#e86f51'));               // service tower
        for (let z = 4; z < 46; z += 6) {
          g.wline([36, 18, z], [41, 18, z + 6], '#b8532f');
          g.wline([41, 18, z], [36, 18, z + 6], '#b8532f');
        }
        g.box(29, 15, 32, 7, 2, 1.5, S('#e86f51'));             // access arm
        g.box(21.5, 21.5, 2, 5, 5, 4, S('#6f7987'));           // engine
        g.box(17, 22, 4, 3, 4, 9, S('#e86f51'));               // fins
        g.box(22, 28, 4, 4, 3, 9, S('#e86f51'));
        g.box(28, 22, 4, 3, 4, 9, S('#e86f51'));
        const body = S('#f4f6fa');
        g.box(20, 20, 6, 8, 8, 30, body);                       // body
        g.onY(28, 20, 26, 8, 2, '#2f6fde');                     // blue band
        g.onX(28, 20, 26, 8, 2, '#2f6fde');
        discY(g, 28, 24, 31, 1.9, '#3d4a63');                   // porthole
        discY(g, 28, 24, 31, 1.2, '#7fd1ff');
        g.poly([g.P(20, 28, 36), g.P(28, 28, 36), g.P(24, 24, 47)], body.left);  // nose cone
        g.poly([g.P(28, 20, 36), g.P(28, 28, 36), g.P(24, 24, 47)], body.right);
        g.poly([g.P(22.5, 25.5, 43), g.P(25.5, 25.5, 43), g.P(24, 24, 47)], '#e86f51');
        // steam rolling out from under the rocket
        const [bx, by] = g.P(26, 26, 2);
        for (let i = 0; i < 6; i++) {
          const age = (t * 0.6 + i * 12) % 70;
          const side = i % 2 ? 1 : -1;
          g.ctx.globalAlpha = Math.max(0, 0.85 - age / 80);
          puff(g, bx + side * age * 0.5, by - age * 0.15, 3 + age / 9, '#ffffff');
        }
        g.ctx.globalAlpha = 1;
      },
    },

    // Research: a hotel with a review sign, and a robot trying to decide
    // whether to trust it. One star keeps flickering.
    hotel: {
      n: 56, zMax: 50, seed: 21,
      draw(g, t) {
        tree(g, 46, 8, 0, 'round');
        tree(g, 6, 40, 0, 'blossom');
        g.box(10, 8, 0, 28, 22, 36, S('#f3dcae'));             // hotel
        for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) {
          const lit = (r * 7 + c * 3) % 5 === 0;
          g.onY(30, 12 + c * 6.5, 9 + r * 7, 3.5, 4.5, lit ? '#ffe69a' : '#9cc3e8');
          g.onX(38, 10 + c * 5, 9 + r * 7, 3, 4.5, lit ? '#ffe69a' : '#7fa7d9');
        }
        g.onY(30, 21, 0, 6, 7, '#8f5d30');                      // door
        g.box(19, 30, 7, 10, 3, 1, S('#e86f51'));               // awning
        g.box(9, 7, 36, 30, 24, 2, S('#c46a4a'));               // roof
        g.box(14, 17, 38, 1, 1, 4, S('#6f7987'));               // sign posts
        g.box(33, 17, 38, 1, 1, 4, S('#6f7987'));
        g.box(12, 17, 41, 24, 1.5, 8, S('#2f6fde'));            // review sign
        for (let i = 0; i < 5; i++) {
          const [sx, sy] = g.P(14.5 + i * 4.3, 18.5, 47.5);
          const fake = i === 4 && Math.sin(t / 12) > 0;         // the suspicious fifth star
          g.sprite(STAR, sx - 5, sy - 5, { y: fake ? '#5e88c0' : '#ffd36b' });
        }
        // the robot (our language model) and its thought bubble
        const [rx, ry] = g.P(44, 42, 0);
        g.sprite(ROBOT, rx - 9, ry - 16, { a: '#6f7987', h: '#d9dee5', e: '#2f6fde', b: '#9aa1ab' });
        const bubbleX = rx - 4, bubbleY = ry - 38;
        g.px(bubbleX, bubbleY, 20, 14, '#ffffff');
        g.px(bubbleX + 2, bubbleY + 14, 3, 2, '#ffffff');
        g.px(bubbleX, bubbleY + 16, 2, 2, '#ffffff');
        if (Math.floor(t / 70) % 2) {
          g.sprite(STAR, bubbleX + 5, bubbleY + 2, { y: '#ffd36b' });
        } else {                                                // a question mark
          const q = ['.qqq.', 'q...q', '...q.', '..q..', '.....', '..q..'];
          g.sprite(scale2x(q), bubbleX + 5, bubbleY + 1, { q: '#2b2f3a' });
        }
      },
    },

    // Small islands for the rest of my GitHub: just a tree and a crate in the
    // project's color
    mini: {
      n: 28, zMax: 24,
      draw(g, t, el) {
        tree(g, 10, 9, 0, el.dataset.tree || 'round');
        g.box(17, 17, 0, 5, 5, 4, S(el.dataset.accent || '#e86f51'));
        g.box(5, 21, 0, 3, 2, 1.5, S('#9aa1ab'));
      },
    },
  };

  // ================= Set up each island canvas =================

  const islands = [];
  document.querySelectorAll('canvas.island').forEach((canvas, i) => {
    const scene = SCENES[canvas.dataset.island];
    if (!scene || !canvas.getContext) return;
    const n = scene.n;
    const unit = n / 56;
    const W = n * 2 * K + 16;
    const OX = W / 2;
    const OY = scene.zMax * K + 26;
    const H = Math.ceil(OY + (Math.max(n + 6 * unit, 0.59 * n + 51 * unit) + 24 * unit) * K + 6);

    const g = Iso.create(canvas, { W, H, OX, OY, K });
    const base = document.createElement('canvas');
    const bg = Iso.create(base, { W, H, OX, OY, K });
    islandBase(bg, { n, seed: scene.seed || i * 13 + 5 });

    const island = { canvas, g, base, scene, W, H, t: 0, visible: false };
    island.render = () => {
      g.ctx.clearRect(0, 0, W, H);
      g.ctx.drawImage(base, 0, 0);
      scene.draw(g, island.t, canvas);
    };
    island.fit = () => Iso.fit(canvas, W, 1.5);
    island.fit();
    island.render();
    canvas.style.animationDelay = `${-(i * 1.3) % 6}s`; // islands bob out of sync
    islands.push(island);
  });

  window.addEventListener('resize', () => islands.forEach((isl) => isl.fit()));
  if (reduceMotion || !islands.length) return;

  const watcher = new IntersectionObserver((entries) => {
    for (const e of entries) {
      const isl = islands.find((x) => x.canvas === e.target);
      if (isl) isl.visible = e.isIntersecting;
    }
  });
  islands.forEach((isl) => watcher.observe(isl.canvas));

  let last = 0;
  function frame(now) {
    const dt = last ? Math.min((now - last) / (1000 / 60), 3) : 1;
    last = now;
    for (const isl of islands) {
      if (!isl.visible) continue;
      isl.t += dt;
      isl.render();
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
