// Supplied pixel-art cutouts, with lightweight live effects in source-image
// coordinates. The illustration, canvas and effects always scale together.
(() => {
  'use strict';
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const scenes = [];
  const heights = { gameboy: 504, exchange: 486, rocket: 528, hotel: 522 };
  const miniNames = ['time-machine', 'chomper', 'desk-dragon', 'mood-ring',
    'cooldown', 'yer-a-wizard-harry', 'gatherly', 'layover'];
  let miniIndex = 0;
  const pixel = (ctx, x, y, w, h, color) => {
    ctx.fillStyle = color;
    ctx.fillRect(Math.round(x), Math.round(y), w, h);
  };
  function sparkle(ctx, x, y, alpha) {
    ctx.globalAlpha = alpha;
    pixel(ctx, x - 2, y, 5, 1, '#fff6ca');
    pixel(ctx, x, y - 2, 1, 5, '#fff6ca');
    ctx.globalAlpha = 1;
  }
  function puff(ctx, x, y, r) {
    for (let dy = -r; dy <= r; dy++) {
      const half = Math.floor(Math.sqrt(r * r - dy * dy));
      pixel(ctx, x - half, y + dy, half * 2 + 1, 1, '#fff3e7');
    }
  }
  function effects(ctx, name, t) {
    if (name === 'gameboy') {
      // A quiet LCD reflection and power light leave the supplied cat intact.
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(132, 54); ctx.lineTo(182, 65);
      ctx.lineTo(181, 108); ctx.lineTo(130, 96); ctx.closePath();
      ctx.clip();
      ctx.globalAlpha = .07;
      pixel(ctx, 128, 52 + Math.floor(t / 4) % 60, 58, 2, '#fff6cd');
      ctx.restore();
      ctx.globalAlpha = .3 + .25 * Math.sin(t / 24);
      pixel(ctx, 124, 94, 2, 2, '#e6df9b');
    } else if (name === 'exchange') {
      // Moving quotes and a price glint on the existing chalkboard.
      const points = [[132,144],[140,135],[151,141],[164,127],[175,132],[184,121]];
      const i = Math.floor(t / 12) % points.length;
      sparkle(ctx, ...points[i], .45 + .25 * Math.sin(t / 9));
      for (let j = 0; j < 4; j++) {
        ctx.globalAlpha = .18 + .18 * (1 + Math.sin(t / 15 + j));
        pixel(ctx, 138 + j * 8, 154 - j, 3, 1, ['#b3c979','#e7b992','#d3ba75','#adc6ad'][j]);
      }
    } else if (name === 'rocket') {
      // Pixel steam drifts away from the engine, as in the original scene.
      for (let i = 0; i < 6; i++) {
        const age = (t * .35 + i * 11) % 66;
        ctx.globalAlpha = (1 - age / 66) * .24;
        puff(ctx, 155 + (i % 2 ? 1 : -1) * age * .55, 175 - age * .12, 2 + Math.floor(age / 13));
      }
      sparkle(ctx, 246, 153, .25 + .2 * Math.sin(t / 22));
    } else if (name === 'hotel') {
      // Warm lamps and a fifth review star that gently flickers.
      const glow = .08 + .1 * (1 + Math.sin(t / 36));
      ctx.globalAlpha = glow;
      pixel(ctx, 78, 159, 5, 6, '#fff2ab');
      pixel(ctx, 181, 164, 5, 6, '#fff2ab');
      for (let i = 0; i < 5; i++) {
        sparkle(ctx, 57 + i * 2, 167 + i * .4, i === 4 ? .15 + .35 * (1 + Math.sin(t / 12)) : .35);
      }
    } else if (name === 'mood-ring') {
      sparkle(ctx, 39, 39, .25 + .3 * (1 + Math.sin(t / 25)));
      sparkle(ctx, 129, 37, .25 + .3 * (1 + Math.sin(t / 25 + 2)));
    } else if (name === 'yer-a-wizard-harry') {
      sparkle(ctx, 148, 39, .3 + .25 * (1 + Math.sin(t / 17)));
    }
    ctx.globalAlpha = 1;
  }

  document.querySelectorAll('canvas.island').forEach((canvas, index) => {
    const mini = canvas.dataset.island === 'mini';
    const name = mini ? (canvas.dataset.project || miniNames[miniIndex++]) : canvas.dataset.island;
    if (!name || (!mini && !heights[name])) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const width = mini ? 128 : 360;
    const height = mini ? 189 : heights[name];
    // A 2x backing store preserves the cutouts when browser/device scale changes.
    canvas.width = width * 2;
    canvas.height = height * 2;
    ctx.imageSmoothingEnabled = false;
    const art = new Image();
    const scene = { canvas, name, art, ctx, visible: false, t: index * 37 };
    scene.render = () => {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (!art.complete || !art.naturalWidth) return;
      const scale = mini ? 124 / art.naturalWidth : 1;
      const x = Math.round((width - art.naturalWidth * scale) / 2);
      const y = Math.round((height - art.naturalHeight * scale) / 2);
      ctx.setTransform(scale * 2, 0, 0, scale * 2, x * 2, y * 2);
      ctx.drawImage(art, 0, 0);
      if (!motion.matches) effects(ctx, name, scene.t);
    };
    scene.fit = () => {
      const available = canvas.parentElement.clientWidth || width;
      const size = Math.min(width, available);
      canvas.style.width = `${size}px`;
      canvas.style.height = `${size * height / width}px`;
    };
    art.addEventListener('load', scene.render);
    art.addEventListener('error', () => console.warn(`Unable to load project artwork: ${name}`));
    art.src = `assets/world/${name}.webp`;
    scene.fit(); scene.render();
    canvas.style.animationDelay = `${-(index * 1.3) % 6}s`;
    scenes.push(scene);
  });

  let raf = 0, last = 0;
  function canAnimate() {
    return !motion.matches && !document.hidden && scenes.some(scene => scene.visible);
  }
  function frame(now) {
    raf = 0;
    if (!canAnimate()) return;
    const dt = last ? Math.min((now - last) / (1000 / 60), 3) : 1;
    last = now;
    scenes.forEach(scene => {
      if (!scene.visible) return;
      scene.t += dt; scene.render();
    });
    raf = requestAnimationFrame(frame);
  }
  function syncAnimation() {
    if (canAnimate()) {
      if (!raf) raf = requestAnimationFrame(frame);
    } else {
      if (raf) cancelAnimationFrame(raf);
      raf = 0; last = 0;
    }
  }
  const watcher = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      const scene = scenes.find(scene => scene.canvas === entry.target);
      if (scene) scene.visible = entry.isIntersecting;
    });
    syncAnimation();
  });
  scenes.forEach(scene => watcher.observe(scene.canvas));
  window.addEventListener('resize', () => scenes.forEach(scene => scene.fit()));
  document.addEventListener('visibilitychange', syncAnimation);
  motion.addEventListener('change', () => {
    scenes.forEach(scene => scene.render()); syncAnimation();
  });
})();
