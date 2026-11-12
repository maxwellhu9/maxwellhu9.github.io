// The approved illustration stays unchanged above a separate floating-island
// canvas. Hotspots and effects use the source image's 1312 × 1199 coordinates.
(() => {
  'use strict';
  const room = document.querySelector('.room');
  const artwork = document.getElementById('room-art');
  const overlay = document.getElementById('room-overlay');
  const layer = room?.querySelector('.room-hotspots');
  if (!room || !artwork || !overlay || !layer) return;

  const ART = { width: 1312, height: 1199 };
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const status = document.querySelector('.room-status');
  const defaultStatus = status?.textContent || '';
  const ctx = overlay.getContext('2d');
  overlay.width = ART.width;
  overlay.height = ART.height;
  ctx.imageSmoothingEnabled = false;
  const drawIsland = createIsland();

  // The new island reference has enough source detail to share the room's
  // effective pixel density. Keep its grass, cliff and waterfall together, so
  // the stream bends over its original bank without a join between sprites.
  function createIsland() {
    const canvas = document.getElementById('room-island');
    if (!canvas) return () => {};
    const ground = canvas.getContext('2d');
    const W = 1312, H = 1576;
    canvas.width = W; canvas.height = H;
    ground.imageSmoothingEnabled = false;
    const cached = document.createElement('canvas');
    cached.width = W; cached.height = H;
    const base = cached.getContext('2d');
    base.imageSmoothingEnabled = false;
    const image = new Image();
    let loaded = false, time = 0;

    // Remove only connected backdrop pixels. Interior colors and texture are
    // never quantized or repainted. Sampling each source row follows its sky
    // gradient rather than using a single blue chroma key.
    function cutoutBackdrop(image) {
      const source = document.createElement('canvas');
      source.width = image.naturalWidth; source.height = image.naturalHeight;
      const sourceCtx = source.getContext('2d');
      sourceCtx.drawImage(image, 0, 0);
      const pixels = sourceCtx.getImageData(0, 0, source.width, source.height).data;
      const crop = { x: 208, y: 520, width: 890, height: 490 };
      const art = document.createElement('canvas');
      art.width = crop.width; art.height = crop.height;
      const artCtx = art.getContext('2d');
      artCtx.drawImage(image, crop.x, crop.y, crop.width, crop.height,
        0, 0, crop.width, crop.height);
      const data = artCtx.getImageData(0, 0, crop.width, crop.height);
      const count = crop.width * crop.height;
      const visited = new Uint8Array(count), queue = new Int32Array(count);
      const backdrop = new Uint8Array(count);
      for (let y = 0; y < crop.height; y++) {
        const row = (crop.y + y) * source.width * 4;
        const left = row + 8 * 4, right = row + (source.width - 9) * 4;
        for (let x = 0; x < crop.width; x++) {
          const u = (crop.x + x - 8) / (source.width - 17);
          const i = y * crop.width + x;
          let distance = 0;
          for (let c = 0; c < 3; c++) {
            const bg = pixels[left + c] * (1 - u) + pixels[right + c] * u;
            distance = Math.max(distance, Math.abs(data.data[i * 4 + c] - bg));
          }
          backdrop[i] = distance < 30 ? 1 : 0;
        }
      }
      let head = 0, tail = 0;
      function add(i) {
        if (visited[i] || !backdrop[i]) return;
        visited[i] = 1; queue[tail++] = i;
      }
      for (let x = 0; x < crop.width; x++) {
        add(x); add((crop.height - 1) * crop.width + x);
      }
      for (let y = 0; y < crop.height; y++) {
        add(y * crop.width); add(y * crop.width + crop.width - 1);
      }
      while (head < tail) {
        const i = queue[head++], x = i % crop.width;
        data.data[i * 4 + 3] = 0;
        if (x) add(i - 1);
        if (x < crop.width - 1) add(i + 1);
        if (i >= crop.width) add(i - crop.width);
        if (i < count - crop.width) add(i + crop.width);
      }
      artCtx.putImageData(data, 0, 0);
      // Exclude the reference bedroom. The original approved room, its overlay
      // and its eight hotspot polygons keep their existing coordinates.
      artCtx.globalCompositeOperation = 'destination-in';
      artCtx.beginPath();
      const boundary = [[208,520],[299,520],[299,596],[661,772],
        [1017,596],[1017,520],[1098,520],[1098,1010],[208,1010]];
      boundary.forEach(([x,y],i) => {
        if (i) artCtx.lineTo(x - crop.x, y - crop.y);
        else artCtx.moveTo(x - crop.x, y - crop.y);
      });
      artCtx.closePath(); artCtx.fill();
      artCtx.globalCompositeOperation = 'source-over';
      return { art, crop };
    }

    function render(t = time) {
      time = t;
      ground.clearRect(0, 0, W, H);
      if (!loaded) return;
      ground.drawImage(cached, 0, 0);
      if (motion.matches) return;
      ground.save();
      // One transform maps both the source bank and the live water highlights.
      ground.setTransform(1.5, 0, 0, 1.6, -330, -56);
      ground.beginPath();
      const water = [[747,716],[799,698],[856,727],[879,751],
        [886,880],[867,922],[809,931],[792,895],[788,789],[766,759]];
      water.forEach(([x,y],i) => i ? ground.lineTo(x,y) : ground.moveTo(x,y));
      ground.closePath(); ground.clip();
      // Short, staggered streaks follow the lip and fall, leaving the source's
      // layered blue water, foam and soft shadows intact.
      for (let i = 0; i < 7; i++) {
        const y = 762 + (time * .52 + i * 23) % 145;
        ground.fillStyle = i % 2 ? 'rgba(244,253,255,.3)' : 'rgba(180,232,252,.22)';
        ground.fillRect(798 + i * 12, Math.floor(y), 2, 5 + i % 3 * 3);
      }
      for (let i = 0; i < 3; i++) {
        const age = (time * .006 + i / 3) % 1;
        ground.fillStyle = `rgba(249,255,255,${Math.sin(age * Math.PI) * .35})`;
        ground.fillRect(Math.round(762 + age * 75), Math.round(718 + age * 30), 5, 2);
      }
      ground.restore();
    }
    image.addEventListener('load', () => {
      const { art, crop } = cutoutBackdrop(image);
      base.setTransform(1.5, 0, 0, 1.6, -330, -56);
      base.drawImage(art, crop.x, crop.y);
      loaded = true; render();
    }, { once: true });
    image.addEventListener('error', () => console.warn('Unable to load the room island artwork.'), { once: true });
    image.src = 'assets/world/room-island-detailed.png';
    return render;
  }

  // Rectangles position the buttons and hover brackets. Optional polygons make
  // the click area follow the object, without capturing the empty floor nearby.
  const OBJECTS = [
    { id: 'window', label: 'Window · about me', target: '#about',
      rect: [310, 282, 288, 369], sparkle: [566, 344],
      shape: [[310, 406], [598, 282], [598, 509], [310, 651]] },
    { id: 'posters', label: 'Posters · experience', target: '#experience',
      rect: [733, 194, 407, 369], sparkle: [815, 255],
      shape: [[733, 194], [1140, 389], [1140, 563], [993, 506], [993, 452], [858, 397], [733, 369]] },
    { id: 'stand', label: 'Nightstand · contact', target: '#contact',
      rect: [1000, 612, 187, 268], sparkle: [1118, 734],
      shape: [[1059, 612], [1154, 632], [1187, 714], [1187, 845], [1120, 880], [1000, 828], [1000, 708], [1040, 689]] },
    { id: 'shelf', label: 'Bookshelf · research', target: '#research',
      rect: [143, 546, 206, 334], sparkle: [328, 626],
      shape: [[143, 575], [286, 546], [349, 555], [349, 805], [207, 880], [143, 845]] },
    { id: 'laptop', label: 'Laptop · stock exchange', target: '#proj-exchange',
      rect: [429, 478, 152, 143], sparkle: [511, 500],
      shape: [[431, 515], [514, 481], [534, 549], [581, 578], [483, 621], [434, 590]] },
    // The reference contains a desk accessory here, not a Game Boy sprite.
    // Retain the emulator's existing interaction without altering the artwork.
    { id: 'gameboy', label: 'Desk gadget · DMG-01', target: '#proj-dmg',
      rect: [415, 589, 55, 44], sparkle: [451, 602],
      shape: [[416, 600], [438, 589], [466, 603], [470, 619], [451, 633], [419, 619]] },
    { id: 'max', label: 'Max · say hi', target: null,
      rect: [498, 703, 158, 250],
      shape: [[514, 703], [619, 703], [656, 773], [643, 855], [643, 933], [601, 953], [509, 924], [498, 788]] },
    { id: 'cat', label: 'Byte the cat · pet her', target: null,
      rect: [646, 898, 149, 93],
      shape: [[655, 898], [712, 904], [757, 899], [790, 919], [795, 968], [773, 987], [678, 991], [646, 971]] },
  ];

  function position(el, [x, y, width, height]) {
    Object.assign(el.style, {
      left: `${x / ART.width * 100}%`, top: `${y / ART.height * 100}%`,
      width: `${width / ART.width * 100}%`, height: `${height / ART.height * 100}%`,
    });
  }

  // Pixel effects retain the previous display scale: one effect pixel is four
  // image pixels. The overlay and image have exactly the same intrinsic ratio.
  const PIX = 4;
  const xy = (x, y) => [Math.round(x / PIX), Math.round(y / PIX)];
  function pixel(x, y, width, height, color) {
    ctx.fillStyle = color;
    ctx.fillRect(Math.round(x) * PIX, Math.round(y) * PIX, width * PIX, height * PIX);
  }
  function sprite(rows, x, y, palette) {
    rows.forEach((row, j) => {
      for (let i = 0; i < row.length; i++) {
        if (row[i] !== '.') pixel(x + i, y + j, 1, 1, palette[row[i]]);
      }
    });
  }
  const FONT = { h: ['h..', 'h..', 'hhh', 'h.h', 'h.h'], i: ['h', '.', 'h', 'h', 'h'], '!': ['h', 'h', 'h', '.', 'h'] };
  const HEART = ['.p.p.', 'ppppp', '.ppp.', '..p..'];
  const MOTES = [[378, 449], [410, 424], [489, 383], [548, 366], [371, 536], [506, 476]];

  let ready = artwork.complete && artwork.naturalWidth > 0;
  let visible = false;
  let t = 0;
  let last = 0;
  let raf = 0;
  let hiUntil = 0;
  let hovered = null;
  let clicked = false;
  let sparkle = null;
  const hearts = [];

  function drawAmbient() {
    if (motion.matches) return;
    // Tiny, slow dust motes stay inside the sunlit window. The reference's
    // colors, lighting, character, plants and cats are never repainted.
    MOTES.forEach(([x, y], i) => {
      ctx.globalAlpha = .06 + .09 * (.5 + .5 * Math.sin(t / 43 + i * 1.7));
      const [px, py] = xy(x + Math.sin(t / 100 + i) * 4, y + Math.sin(t / 85 + i) * 8);
      pixel(px, py, 1, 1, '#fff1c7');
    });
    ctx.globalAlpha = 1;
  }
  function drawHi() {
    if (t >= hiUntil) return;
    const [x, y] = xy(627, 681);
    pixel(x, y, 13, 8, '#fff9ed');
    pixel(x - 1, y + 1, 15, 6, '#fff9ed');
    pixel(x + 1, y + 8, 2, 2, '#fff9ed');
    let cursor = x + 2;
    for (const ch of 'hi!') {
      sprite(FONT[ch], cursor, y + 2, { h: '#553b39' });
      cursor += FONT[ch][0].length + 1;
    }
  }
  function drawHearts() {
    const [x, y] = xy(703, 879);
    for (const heart of hearts) {
      ctx.globalAlpha = Math.min(1, heart.life / 20);
      sprite(HEART, x + heart.dx, y + heart.y, { p: '#ff7aa2' });
    }
    ctx.globalAlpha = 1;
  }
  function drawBrackets(object) {
    const [x, y, w, h] = object.rect;
    const [x1, y1] = xy(x, y), [x2, y2] = xy(x + w, y + h);
    const length = 4, color = '#ffd27a';
    ctx.globalAlpha = motion.matches ? 1 : .8 + .2 * Math.sin(t / 8);
    pixel(x1, y1, length, 1, color); pixel(x1, y1, 1, length, color);
    pixel(x2 - length, y1, length, 1, color); pixel(x2 - 1, y1, 1, length, color);
    pixel(x1, y2 - 1, length, 1, color); pixel(x1, y2 - length, 1, length, color);
    pixel(x2 - length, y2 - 1, length, 1, color); pixel(x2 - 1, y2 - length, 1, length, color);
    ctx.globalAlpha = 1;
  }
  function drawSparkle() {
    if (clicked || motion.matches) return;
    if (!sparkle || t - sparkle.start > 70) {
      const choices = OBJECTS.filter(object => object.target && object !== sparkle?.object);
      sparkle = { object: choices[Math.floor(Math.random() * choices.length)], start: t };
    }
    const age = t - sparkle.start;
    if (age > 40) return;
    const size = Math.floor((age < 20 ? age : 40 - age) / 7) + 1;
    const [x, y] = xy(...sparkle.object.sparkle);
    pixel(x - size, y, size * 2 + 1, 1, '#fff9ed');
    pixel(x, y - size, 1, size * 2 + 1, '#fff9ed');
  }
  function drawOverlay() {
    drawIsland(t);
    ctx.clearRect(0, 0, ART.width, ART.height);
    if (!ready) return;
    drawAmbient(); drawHearts(); drawHi();
    if (hovered) drawBrackets(hovered);
    else drawSparkle();
  }

  // Content continues to come from the existing cards below the room.
  const dialog = document.getElementById('panel');
  const panelTitle = dialog.querySelector('.panel-title');
  const panelBody = dialog.querySelector('.panel-body');
  function openPanel(object) {
    const source = document.querySelector(object.target);
    if (!source) return;
    const heading = source.querySelector('h2, h3');
    panelTitle.textContent = heading ? heading.textContent : object.label;
    panelBody.replaceChildren();
    for (const child of source.children) {
      if (child === heading) continue;
      const copy = child.cloneNode(true);
      copy.removeAttribute('id');
      copy.querySelectorAll('[id]').forEach(node => node.removeAttribute('id'));
      panelBody.appendChild(copy);
    }
    dialog.showModal();
  }
  dialog.querySelector('.panel-close').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });

  layer.replaceChildren();
  for (const object of OBJECTS) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'hotspot';
    button.setAttribute('aria-label', object.label);
    button.setAttribute('data-room-object', object.id);
    position(button, object.rect);
    if (object.shape) {
      const [x, y, w, h] = object.rect;
      button.style.clipPath = `polygon(${object.shape.map(([px, py]) => `${(px - x) / w * 100}% ${(py - y) / h * 100}%`).join(',')})`;
    }
    const show = () => {
      hovered = object;
      if (status) status.textContent = object.label;
      drawOverlay();
    };
    const hide = () => {
      if (hovered === object) hovered = null;
      if (status) status.textContent = hovered?.label || defaultStatus;
      drawOverlay();
    };
    button.addEventListener('pointerenter', show);
    button.addEventListener('focus', show);
    button.addEventListener('pointerleave', hide);
    button.addEventListener('blur', hide);
    button.addEventListener('click', () => {
      clicked = true;
      if (object.target) openPanel(object);
      else if (object.id === 'max') hiUntil = motion.matches ? Infinity : t + 150;
      else if (object.id === 'cat') {
        for (let i = 0; i < 3; i++) hearts.push({ dx: i * 4 - 4, y: -2 - i * 3, life: 60 + i * 10 });
      }
      drawOverlay();
    });
    layer.appendChild(button);
  }

  function canAnimate() { return ready && visible && !document.hidden && !motion.matches; }
  function frame(now) {
    raf = 0;
    if (!canAnimate()) return;
    const dt = last ? Math.min((now - last) / (1000 / 60), 3) : 1;
    last = now;
    t += dt;
    for (const heart of hearts) { heart.y -= .15 * dt; heart.life -= dt; }
    while (hearts.length && hearts[0].life <= 0) hearts.shift();
    drawOverlay();
    raf = requestAnimationFrame(frame);
  }
  function syncAnimation() {
    if (canAnimate()) {
      if (!raf) raf = requestAnimationFrame(frame);
    } else {
      if (raf) cancelAnimationFrame(raf);
      raf = 0; last = 0;
      drawOverlay();
    }
  }
  artwork.addEventListener('load', () => {
    ready = true;
    drawOverlay(); syncAnimation();
  }, { once: true });
  artwork.addEventListener('error', () => {
    ready = false;
    if (status) status.textContent = 'The room artwork could not load.';
    syncAnimation();
  }, { once: true });
  new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    syncAnimation();
  }).observe(room);
  document.addEventListener('visibilitychange', syncAnimation);
  motion.addEventListener('change', () => {
    if (!motion.matches && hiUntil === Infinity) hiUntil = t + 150;
    syncAnimation();
  });
  drawOverlay();
})();
