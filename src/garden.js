import { FRAME, onMotion, tick } from "./clock.js";

// The hero's park moves like the films, on the site's 12 fps clock (every frame held, like stop motion): the clouds
// drift in seamless loops, the stars twinkle out of step, the moon's halo, the sun and the lamp breathe, and the
// scene's butterflies hover over the lavender. The view shifts behind the panel's edge with the pointer (the far
// scene most, data-depth) and, as the hero scrolls
// away, the terrain folds down from the back like a pop-up book (data-sink): the far treeline sinks most, behind the
// lawn, which sinks behind the lavender and the bench, so no gap ever opens and the sky grows. Nothing runs while the
// hero is off screen, the tab is hidden, or motion is stilled; then the park rests, composed.
const hero = document.querySelector(".hero");
const garden = hero?.querySelector(".garden");

const SHIFT_X = 14; // pointer shift of the farthest layer (data-depth 1), css px
const SHIFT_Y = 6;
const SINK = 0.39; // the far treeline (data-sink 1) sinks by this share of the scroll

// the films' GO curve, Easing.bezier(0.42, 0, 0.25, 1): x(t) solved by Newton, y(t) = 3t² - 2t³
function go(u) {
  let t = u;
  for (let i = 0; i < 5; i++) t -= (((1.51 * t - 1.77) * t + 1.26) * t - u) / ((4.53 * t - 3.54) * t + 1.26);
  return t * t * (3 - 2 * t);
}
// 0 → 1 → 0 once per period, eased at both turns
const breathe = (t, period, phase = 0) => go(1 - Math.abs(2 * ((t / period + phase) % 1) - 1));

const FLAP = [1, 0.5, 0.14, 0.5]; // wing widths through one beat (4 held frames)

// Runs `frame` on the clock while `root` is on screen and motion is on; `rest` returns it to its composed state.
function animate(root, frame, rest) {
  let still = true;
  let seen = false;
  let stop = null;
  const update = () => {
    root.classList.toggle("is-live", !still);
    if (seen && !still) stop ??= tick(frame);
    else if (stop) {
      stop();
      stop = null;
    }
  };
  new IntersectionObserver(([entry]) => {
    seen = entry.isIntersecting;
    update();
  }).observe(root);
  onMotion((isStill) => {
    still = isStill;
    if (still) rest();
    update();
  });
}

// a panel at rest: every inline motion removed (its custom properties stay)
function compose(root) {
  for (const el of root.querySelectorAll("[style]")) {
    for (const name of ["transform", "translate", "opacity"]) el.style.removeProperty(name);
  }
}

// garden seconds: advanced only while a panel runs, at most two held frames at a time
function clock() {
  let t = 0;
  let last = 0;
  return (time) => {
    if (time === undefined) return (t = last = 0);
    t += Math.min(time - (last || time - FRAME), 2 * FRAME) / 1000;
    last = time;
    return t;
  };
}

// The sky's own motion, shared by the hero and every park panel: the clouds drift in seamless loops, the stars
// twinkle out of step, the moon's halo, the sun and the lamp's glow breathe.
function sky(root) {
  const drifts = [...root.querySelectorAll("[data-drift]")].map((el, i) => [el, +el.dataset.drift, i * 0.29]);
  const twinkles = [...root.querySelectorAll("[data-twinkle]")].map((el) => [el, ...el.dataset.twinkle.split(",").map(Number)]);
  const halo = root.querySelector(".g-halo");
  const sun = root.querySelector(".g-sun");
  const glow = root.querySelector(".g-glow");
  return (t) => {
    for (const [el, period, phase] of drifts) el.style.translate = `${(-66.6667 * ((t / period + phase) % 1)).toFixed(4)}% 0`;
    for (const [el, period, phase] of twinkles) el.style.opacity = (0.45 + 0.55 * breathe(t, period, phase)).toFixed(3);
    if (halo) {
      const b = breathe(t, 7.4);
      halo.style.opacity = (0.7 + 0.3 * b).toFixed(3);
      halo.style.transform = `scale(${(1 + 0.04 * b).toFixed(4)})`;
    }
    if (sun) sun.style.opacity = (0.86 + 0.14 * breathe(t, 9.6)).toFixed(3);
    if (glow) glow.style.opacity = (0.84 + 0.16 * (0.7 * breathe(t, 5.2) + 0.3 * breathe(t, 2.3, 0.4))).toFixed(3);
  };
}

// When the reader reaches for the theme switch (hover, focus or press), fetch and decode the other theme's images
// so the toggle cross-fades into a sky that is (nearly) there, without every visit paying for both themes.
function warm(root, skip = "") {
  const other = document.documentElement.dataset.theme === "dark" ? "day" : "night";
  for (const el of root.querySelectorAll(`:is(.g-layer, .g-free)${skip}, .g-flock .g-${other}`)) {
    const src = getComputedStyle(el).getPropertyValue(el.matches(".g-bf") ? "--bf" : `--${other}`).match(/url\(["']?([^"')]+)/)?.[1];
    if (!src) continue;
    const img = new Image();
    img.src = src;
    img.decode().catch(() => {});
  }
}
const intent = (fn) => {
  const toggle = document.querySelector(".theme-toggle");
  const types = ["pointerenter", "focus", "pointerdown"];
  const once = () => {
    for (const type of types) toggle.removeEventListener(type, once);
    fn();
  };
  for (const type of types) toggle?.addEventListener(type, once);
};

// The park's butterflies by day and moths by night live inside the panel: up in the free sky beside the title and
// over the lavender near the frame's edges, a few moths circling the lamppost's glow. They never fly in front of a
// line of text, a control or the editor: the free space is a grid measured from the live layout (every text line and
// control on the hero and the header lying on it, the circle around "write.", the editor, each grown by a margin),
// split into connected zones, and every flight is planned through free cells only. Far ones (high in the sky) are
// smaller and softer, near ones (low, by the frame) a little larger. Flutter (wing beats with a bob on each
// downstroke) alternates with short glides; at most CAP move at once, the rest bask on the lavender. Still or reduced
// motion leaves them perched or hanging still where they are.
const BF = "/scrapbook/garden/bf/";
// sprite heights at 96 px wide, and how a species flies: held frames per wing beat at 12 fps, cruise in px/s
const ART = {
  "small-blue": [73, 2, 52], morpho: [71, 4, 64], brimstone: [68, 3, 58], "cabbage-white": [63, 3, 54], peacock: [62, 3, 60],
  "sage-hairstreak": [75, 2, 50], "lilac-argus": [69, 2, 50], clearwing: [60, 3, 48], swallowtail: [82, 4, 66],
  "rosy-maple": [54, 2, 46], "lavender-emperor": [57, 3, 50],
};
// [species, theme, habitat]: sky (far, small, always flying), bed (lavender by the frame, perches), lamp (circles the glow)
const CAST = [
  ["cabbage-white", "day", "sky"], ["brimstone", "day", "sky"], ["lilac-argus", "day", "sky"], ["sage-hairstreak", "day", "sky"],
  ["clearwing", "day", "sky"], ["peacock", "day", "bed"], ["swallowtail", "day", "bed"], ["morpho", "day", "bed"], ["small-blue", "day", "bed"],
  ["rosy-maple", "night", "lamp"], ["lavender-emperor", "night", "lamp"], ["rosy-maple", "night", "lamp"], ["lavender-emperor", "night", "sky"],
  ["rosy-maple", "night", "sky"], ["cabbage-white", "night", "bed"], ["lavender-emperor", "night", "bed"],
];
const CAP = 7; // moving at once
const CELL = 16; // free-space grid, px
const CLEAR = 36; // a butterfly's centre keeps this far from text, controls and the editor (half its width, its bob and the pointer shift)
const POSE = [1, 0.62, 0.3, 0.62]; // wing widths through a beat (never edge-on: at scene scale a closed pair reads as a speck)
const DEG = Math.PI / 180;
const rnd = (a, b) => a + Math.random() * (b - a);

function flockOf(garden, hero) {
  const host = garden.querySelector(".g-flock");
  const companion = host.querySelector(".g-companion");
  const birds = CAST.map(([id, theme, habitat], i) => {
    const [h, beat, cruise] = ART[id];
    host.insertAdjacentHTML("beforeend", `<i class="g-bf g-${theme}" style="--bf:url(${BF}${id}.webp);--ar:${(96 / h).toFixed(3)}"><i></i><i></i></i>`);
    const el = host.lastElementChild;
    return { el, wings: el.children, id, theme, habitat, beat, cruise, seed: i * 1.37, x: 0, y: 0, vx: 0, vy: 0, tilt: 0, mode: "fly", t: 0, path: [], size: 20 };
  });
  let W = 0;
  let H = 0;
  let cols = 0;
  let rows = 0;
  let free = new Uint8Array(0);
  let zone = new Int16Array(0);
  let zones = [];
  let bedTop = 0;
  let lantern = null;

  const cellOf = (x, y) => {
    const cx = Math.floor(x / CELL);
    const cy = Math.floor(y / CELL);
    return cx < 0 || cy < 0 || cx >= cols || cy >= rows ? -1 : cy * cols + cx;
  };
  const isFree = (x, y) => {
    const c = cellOf(x, y);
    return c >= 0 && free[c] === 1;
  };
  const centre = (c) => [(c % cols) * CELL + CELL / 2, Math.floor(c / cols) * CELL + CELL / 2];
  const clearLine = (x0, y0, x1, y1) => {
    const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 6);
    for (let i = 1; i <= n; i++) if (!isFree(x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * i) / n)) return false;
    return true;
  };
  const neighbours = (c) => {
    const x = c % cols;
    return [x > 0 ? c - 1 : -1, x < cols - 1 ? c + 1 : -1, c - cols, c + cols].filter((n) => n >= 0 && n < free.length && free[n]);
  };

  // the free grid and its zones, from the live layout
  function measure() {
    const g = garden.getBoundingClientRect();
    [W, H] = [g.width, g.height];
    [cols, rows] = [Math.ceil(W / CELL), Math.ceil(H / CELL)];
    free = new Uint8Array(cols * rows);
    for (let c = 0; c < free.length; c++) {
      const [x, y] = centre(c);
      free[c] = x > 16 && x < W - 16 && y > 16 && y < H - 16 ? 1 : 0;
    }
    const block = (r, m = CLEAR) => {
      if (!r.width && !r.height) return;
      const x0 = Math.max(0, Math.floor((r.left - g.left - m) / CELL));
      const x1 = Math.min(cols - 1, Math.floor((r.right - g.left + m) / CELL));
      const y0 = Math.max(0, Math.floor((r.top - g.top - m) / CELL));
      const y1 = Math.min(rows - 1, Math.floor((r.bottom - g.top + m) / CELL));
      for (let y = y0; y <= y1; y++) if (x1 >= x0) free.fill(0, y * cols + x0, y * cols + x1 + 1);
    };
    const range = document.createRange();
    for (const root of [document.querySelector(".site-header"), hero.querySelector(".title-card")]) {
      if (!root) continue;
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      while (walker.nextNode()) {
        if (!walker.currentNode.data.trim()) continue;
        range.selectNodeContents(walker.currentNode);
        for (const r of range.getClientRects()) block(r);
      }
    }
    for (const el of document.querySelectorAll(".site-header :is(a, button), .hero :is(a, button), .ink-word .doodle, .demo-print")) {
      for (const r of el.getClientRects()) block(r);
    }
    if (companion) block(companion.getBoundingClientRect(), 24);
    // connected zones of free cells; slivers too small to fly in are given up
    zone = new Int16Array(free.length).fill(-1);
    zones = [];
    for (let c0 = 0; c0 < free.length; c0++) {
      if (!free[c0] || zone[c0] >= 0) continue;
      const cells = [c0];
      zone[c0] = zones.length;
      for (let i = 0; i < cells.length; i++) {
        for (const n of neighbours(cells[i])) {
          if (zone[n] < 0) {
            zone[n] = zones.length;
            cells.push(n);
          }
        }
      }
      zones.push({ cells, day: 0, night: 0 });
    }
    for (const z of zones) if (z.cells.length < 40) for (const c of z.cells) [free[c], zone[c]] = [0, -1];
    zones = zones.filter((z) => z.cells.length >= 40);
    zones.forEach((z, i) => z.cells.forEach((c) => (zone[c] = i)));
    // the lavender beds, and the lamp's lantern when it shows in free space
    const lav = garden.querySelector(".g-lavender")?.getBoundingClientRect();
    bedTop = lav?.height ? lav.top - g.top + 0.12 * lav.height : H * 0.75;
    const lamp = garden.querySelector(".g-lamp");
    const lr = lamp?.getClientRects().length ? lamp.getBoundingClientRect() : null;
    lantern = null;
    if (lr) {
      const [lx, ly, r] = [lr.left - g.left + 0.5 * lr.width, lr.top - g.top + 0.156 * lr.height, Math.max(26, lr.width * 0.7)];
      const around = [0, 1, 2, 3, 4, 5, 6, 7].every((k) => isFree(lx + 1.25 * r * Math.cos(k * 0.785), ly + 0.6 * r * Math.sin(k * 0.785)));
      if (around) lantern = { x: lx, y: ly, r };
    }
    // keep the ones still in free space where they are; place the rest
    for (const b of birds) {
      const c = b.zone ? cellOf(b.x, b.y) : -1;
      if (c >= 0 && zone[c] >= 0 && b.mode !== "orbit") {
        b.zone = zones[zone[c]];
        b.zone[b.theme]++;
        b.path = [];
      } else place(b);
    }
  }

  // a free cell of a zone, high (sky) or low (bed) as the bird likes, some way from `from`
  function pick(z, habitat, from) {
    let best = z.cells[0];
    let score = -Infinity;
    for (let k = 0; k < 16; k++) {
      const c = z.cells[Math.floor(Math.random() * z.cells.length)];
      const [x, y] = centre(c);
      const want = habitat === "bed" ? y > bedTop : y < bedTop - 24;
      const s = (want ? 1000 : 0) - (from ? Math.abs(Math.hypot(x - from[0], y - from[1]) - 150) : 0) + Math.random() * 40;
      if (s > score) [best, score] = [c, s];
    }
    return best;
  }

  function place(b) {
    b.path = [];
    b.zone = null;
    b.el.style.removeProperty("display");
    if (b.habitat === "lamp" && lantern) {
      Object.assign(b, { mode: "orbit", a: rnd(0, 6.28), w: rnd(1.8, 2.8) * (b.seed % 2 > 1 ? -1 : 1), size: Math.round(rnd(22, 27)), x: lantern.x, y: lantern.y });
      b.el.style.width = `${b.size}px`;
      b.el.classList.add("lit");
      return draw(b, 0, 0);
    }
    b.el.classList.remove("lit");
    const habitat = b.habitat === "lamp" ? "sky" : b.habitat;
    const suits = (c) => (habitat === "bed" ? centre(c)[1] > bedTop : centre(c)[1] < bedTop - 24);
    // each theme's cast shares out the zones on its own: about one bird per 30,000 px² of free sky
    const room = zones.filter((z) => z[b.theme] < z.cells.length / 120 && z.cells.some(suits));
    const z = room.sort((p, q) => p[b.theme] / p.cells.length - q[b.theme] / q.cells.length)[0];
    if (!z) return b.el.style.setProperty("display", "none");
    z[b.theme]++;
    b.zone = z;
    const [x, y] = centre(pick(z, habitat));
    // far (high, central) ones small and soft, near ones low by the frame's edges a little larger
    const near = Math.min(1, Math.max(0, (y - H * 0.2) / (H * 0.65))) * 0.7 + (Math.abs(x - W / 2) / (W / 2)) * 0.3;
    Object.assign(b, { x, y, vx: 0, vy: 0, tilt: 0, size: Math.round(22 + 14 * near + (b.id === "morpho" || b.id === "swallowtail" ? 4 : 0)) });
    b.el.style.width = `${b.size}px`;
    b.el.style.setProperty("--fade", (0.7 + 0.3 * near).toFixed(2));
    b.mode = habitat === "bed" ? "perch" : "fly";
    b.t = rnd(1, 7);
    draw(b, 0, 0);
  }

  // a path through the free cells of its zone: straight when the line is clear, else the grid's shortest route with
  // only the turns a straight line can't skip
  function route(b, to) {
    const [tx, ty] = centre(to);
    if (clearLine(b.x, b.y, tx, ty)) return [[tx, ty]];
    const from = cellOf(b.x, b.y);
    if (from < 0 || zone[from] !== zone[to]) return [];
    const prev = new Int32Array(free.length).fill(-1);
    const queue = [from];
    prev[from] = from;
    for (let i = 0; i < queue.length && prev[to] < 0; i++) {
      for (const n of neighbours(queue[i])) {
        if (prev[n] < 0) {
          prev[n] = queue[i];
          queue.push(n);
        }
      }
    }
    if (prev[to] < 0) return [];
    const cells = [];
    for (let c = to; c !== from; c = prev[c]) cells.unshift(c);
    const path = [];
    let [ax, ay] = [b.x, b.y];
    for (let i = 0; i < cells.length; i++) {
      const next = centre(cells[Math.min(i + 1, cells.length - 1)]);
      if (i === cells.length - 1 || !clearLine(ax, ay, next[0], next[1])) {
        const p = centre(cells[i]);
        path.push(p);
        [ax, ay] = p;
      }
    }
    return path;
  }

  function draw(b, ox, oy, wing = 1) {
    const h = (b.size * ART[b.id][0]) / 96;
    b.el.style.transform = `translate3d(${(b.x + ox - b.size / 2).toFixed(1)}px,${(b.y + oy - h / 2).toFixed(1)}px,0) rotate(${b.tilt.toFixed(1)}deg)`;
    b.wings[0].style.transform = b.wings[1].style.transform = `scaleX(${wing})`;
  }

  // one held frame: steering through the free cells, beats and glides, perching, the lamp's moths
  function frame(t, dt, sink, px) {
    const theme = document.documentElement.dataset.theme === "dark" ? "night" : "day";
    const cast = birds.filter((b) => b.theme === theme && b.el.style.display !== "none");
    let moving = cast.filter((b) => b.mode !== "perch").length;
    const ox = px * 7; // the lavender's pointer shift
    for (const b of cast) {
      const beat = Math.floor(t * 12 + b.seed * 3) % b.beat;
      const wingAt = (k) => POSE[Math.floor((k * 4) / b.beat)];
      if (b.mode === "orbit") {
        // around the lantern, nearer (larger, brighter) in front of it, with a jitter
        b.a += b.w * dt;
        const r = lantern.r * (1 + 0.18 * Math.sin(3 * b.a + b.seed));
        b.x = lantern.x + r * Math.cos(b.a);
        b.y = lantern.y + 0.45 * r * Math.sin(b.a) + 3 * Math.sin(t * 7 + b.seed);
        b.tilt = 25 * Math.sign(b.w) * Math.cos(b.a);
        b.el.style.setProperty("--fade", (0.65 + 0.35 * (0.5 + 0.5 * Math.sin(b.a))).toFixed(2));
        draw(b, ox, sink * 0.8, wingAt(beat));
        continue;
      }
      if (b.mode === "perch") {
        // basking on the lavender (it sinks with it): wings open, now and then two slow beats
        b.t -= dt;
        if (b.t <= 0 && moving < CAP) {
          [b.mode, b.y, b.vy, b.path] = ["fly", b.y + sink * 0.8, -b.cruise * 0.6, []];
          moving++;
        } else {
          const bask = Math.floor(t * 6 + b.seed * 5) % 36;
          draw(b, ox, sink * 0.8, bask < 4 ? POSE[bask] : 1);
          continue;
        }
      }
      // flying: follow the planned path, a new goal when it is reached (beds may land there)
      if (!b.path.length) {
        const landing = b.habitat === "bed" && Math.random() < 0.45;
        const c = pick(b.zone, landing ? "bed" : b.habitat, [b.x, b.y]);
        b.path = route(b, c);
        b.land = landing && centre(c)[1] > bedTop;
        b.glide = Math.random() < 0.4 ? Math.round(rnd(4, 9)) : 0;
        if (!b.path.length) [b.x, b.y] = centre(c);
      }
      const [gx, gy] = b.path[0] ?? [b.x, b.y];
      const d = Math.hypot(gx - b.x, gy - b.y) || 1;
      const speed = b.cruise * (b.glide ? 0.8 : 1);
      const k = Math.min(1, 4 * dt);
      b.vx += (((gx - b.x) / d) * speed - b.vx) * k;
      b.vy += (((gy - b.y) / d) * speed - b.vy) * k + (b.glide ? 12 * dt : 0);
      const nx = b.x + b.vx * dt;
      const ny = b.y + b.vy * dt;
      if (isFree(nx, ny)) [b.x, b.y] = [nx, ny];
      else [b.vx, b.vy, b.path] = [-b.vx * 0.3, -b.vy * 0.3, []];
      if (d < 10) {
        b.path.shift();
        if (!b.path.length && b.land) {
          [b.mode, b.t, b.tilt, b.y] = ["perch", rnd(3, 9), rnd(-12, 12), b.y - sink * 0.8];
          draw(b, ox, sink * 0.8, 1);
          continue;
        }
      }
      if (b.glide) b.glide--;
      const heading = Math.atan2(b.vx, -b.vy) / DEG;
      b.tilt += (Math.max(-30, Math.min(30, heading)) - b.tilt) * 0.4;
      const wing = b.glide ? 1 : wingAt(beat);
      draw(b, ox, b.glide ? 0 : -3 * (1 - wing) * (b.size / 20), wing);
    }
  }

  // still: each where it is (the perched ones on the lavender), wings open
  function rest() {
    for (const b of birds) if (b.el.style.display !== "none") draw(b, 0, 0, 1);
  }

  return { measure, frame, rest };
}

if (garden) {
  const layers = [...garden.querySelectorAll("[data-depth]")].map((el) => ({ el, depth: +el.dataset.depth, sink: +el.dataset.sink }));
  // the companion's resting butterfly stays put (companion.js reads its box and hides it while it is out)
  const resting = garden.querySelector(".g-companion");
  const flock = flockOf(garden, hero);
  const ambient = sky(garden);
  const time = clock();
  const fine = matchMedia("(hover: hover) and (pointer: fine)");

  let tx = 0; // pointer target, -1..1 across the viewport
  let ty = 0;
  let px = 0;
  let py = 0;
  let sink = 0;
  let height = 0;

  function measure() {
    height = garden.offsetHeight;
    flock.measure();
  }

  let last = 0;
  function frame(now) {
    const t = time(now);
    const dt = Math.min(Math.max(t - last, 0), 0.2);
    last = t;
    ambient(t);
    const k = fine.matches ? 1 : 0;
    px += (tx * k - px) * 0.3;
    py += (ty * k - py) * 0.3;
    sink += (Math.min(Math.max(scrollY, 0), height) * SINK - sink) * 0.5;
    for (const l of layers) {
      l.el.style.transform = `translate3d(${(px * SHIFT_X * l.depth).toFixed(2)}px,${(py * SHIFT_Y * l.depth + sink * l.sink).toFixed(2)}px,0)`;
    }
    flock.frame(t, dt, sink, px);
    // the companion basks with its wings open, now and then two slow beats
    if (resting && !resting.hidden) {
      const slow = Math.floor(t * 6) % 40;
      resting.children[0].style.transform = resting.children[1].style.transform = `scaleX(${slow < 4 ? FLAP[slow] : 1})`;
    }
  }

  // the composed state: what reduced motion and a stilled garden show
  function rest() {
    compose(garden);
    time();
    last = 0;
    px = py = sink = 0;
    flock.rest();
  }

  measure();
  // the title's text settles when its font arrives: the flock's free space follows it and the editor, once a frame
  let pending = 0;
  const remeasure = () => (pending ||= requestAnimationFrame(() => ((pending = 0), measure())));
  const resized = new ResizeObserver(remeasure);
  for (const el of [garden, hero.querySelector(".title-card"), hero.querySelector(".demo-print")]) if (el) resized.observe(el);
  document.fonts.ready.then(remeasure);
  animate(garden, frame, rest);
  addEventListener(
    "pointermove",
    (event) => {
      if (event.pointerType === "touch") return;
      tx = (event.clientX / innerWidth) * 2 - 1;
      ty = (event.clientY / innerHeight) * 2 - 1;
    },
    { passive: true },
  );
  document.documentElement.addEventListener("pointerleave", () => {
    tx = ty = 0;
  });
  // garden.css hides the bench, lamp, glow and trees on narrow panels
  intent(() => warm(garden, garden.clientWidth / garden.clientHeight < 0.55 ? ":not(.g-bench, .g-lamp, .g-glow, .g-trees, .g-tree)" : ""));
}

// Park panels (.park, behind the window of "built around writing" and the closing call to action): the hero's park in
// the hero's files (garden.css), with its sky's motion and nothing else.
for (const panel of document.querySelectorAll(".park")) {
  const ambient = sky(panel);
  const time = clock();
  animate(panel, (now) => ambient(time(now)), () => (compose(panel), time()));
  intent(() => warm(panel));
}
