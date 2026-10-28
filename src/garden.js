import "./garden.css";
import { FRAME, onMotion, tick } from "./clock.js";

// The hero's park moves like the films, on the site's 12 fps clock (every frame held, like stop motion). On a fresh
// load it assembles itself like a pop-up book; then the clouds drift in seamless loops, the stars twinkle out of
// step, the moon's halo, the sun and the lamp breathe, and the scene's butterflies hover over the lavender. The
// layers shift with the pointer (the foreground most) and sink as the hero scrolls away, so more sky shows. Nothing
// runs while the hero is off screen, the tab is hidden, or motion is stilled; then the park rests, composed.
const hero = document.querySelector(".hero");
const garden = hero?.querySelector(".garden");

const PER_FRAME = FRAME / (1000 / 60); // film frames (60 fps) per held frame
const SHIFT_X = 14; // pointer shift of the nearest layer, css px
const SHIFT_Y = 6;
const SINK = 0.32; // the nearest layer sinks by this share of the scroll

// the films' GO curve, Easing.bezier(0.42, 0, 0.25, 1): x(t) solved by Newton, y(t) = 3t² - 2t³
function go(u) {
  let t = u;
  for (let i = 0; i < 5; i++) t -= (((1.51 * t - 1.77) * t + 1.26) * t - u) / ((4.53 * t - 3.54) * t + 1.26);
  return t * t * (3 - 2 * t);
}
// 0 → 1 → 0 once per period, eased at both turns
const breathe = (t, period, phase = 0) => go(1 - Math.abs(2 * ((t / period + phase) % 1) - 1));

// The films' landing (Butterfly.tsx land()): offsets shrink by 1 - u² until contact, then a damped settle whose
// swing carries the scale (a pop-up flap springing upright) and the turn. Offsets are in canvas px; the second
// number is the held frame each part starts on (or later, once its image has decoded).
const ENTER = [
  [".g-sun, .g-moon", 1, { lead: 3, dy: 40, sc: -0.45, w: 0.9 }],
  [".g-clouds-far", 2, { lead: 4, dx: 260, w: 0.5 }],
  [".g-clouds-mid", 3, { lead: 4, dx: 340, w: 0.5 }],
  [".g-clouds-near", 4, { lead: 4, dx: 420, w: 0.5 }],
  [".g-far", 3, { lead: 3, dy: 90, w: 0.6 }],
  [".g-lawn", 5, { lead: 3, dy: 180, w: 0.6 }],
  [".g-trees", 7, { lead: 3, dy: 220, sc: -0.18, w: 0.7 }],
  [".g-lamp, .g-glow", 7, { lead: 3, dy: 220, sc: -0.22, w: 0.8 }],
  [".g-lavender", 9, { lead: 3, dy: 200, sc: -0.3, w: 0.9 }],
  [".g-bench", 11, { lead: 3, dy: 150, sc: -0.25, rot: 3, w: 0.8 }],
];
const FLICKER = [0, 0.9, 0.15, 0, 0.75, 0.3, 1]; // the lamp catching, held frame by held frame
const FLAP = [1, 0.5, 0.14, 0.5]; // wing widths through one beat (4 held frames)

function land(m, n) {
  const contact = m.lead * PER_FRAME;
  const t = n * PER_FRAME;
  const u = Math.min(1, t / contact);
  const q = 1 - u * u;
  const tau = Math.max(0, t - contact);
  const kk = q - (tau > 0 ? Math.exp(-tau / 6) * Math.sin(m.w * tau) * (1.4 / (contact * m.w)) : 0);
  return { dx: (m.dx ?? 0) * q, dy: (m.dy ?? 0) * q, rot: (m.rot ?? 0) * kk, sc: 1 + (m.sc ?? 0) * kk };
}

if (garden) {
  const scene = garden.querySelector(".g-scene");
  const layers = [...garden.querySelectorAll("[data-depth]")].map((el) => ({
    el,
    depth: +el.dataset.depth,
    drift: +el.dataset.drift || 0,
    twinkle: el.dataset.twinkle?.split(",").map(Number),
  }));
  layers.filter((l) => l.drift).forEach((l, i) => (l.phase = i * 0.29));
  layers
    .filter((l) => l.el.matches(".g-bf"))
    .forEach((l, i) => Object.assign(l, { flyer: true, seed: i * 2.1 + 0.7, start: 12 + i }));
  for (const [selector, start, motion] of ENTER) {
    for (const l of layers) if (l.el.matches(selector)) Object.assign(l, { motion, start });
  }
  // the companion's resting butterfly stays put (companion.js reads its box); it only flies in and basks
  const resting = { el: garden.querySelector(".g-companion"), flyer: true, start: 14 };
  const halo = garden.querySelector(".g-halo");
  const sun = garden.querySelector(".g-sun");
  const glow = garden.querySelector(".g-glow");
  const fine = matchMedia("(hover: hover) and (pointer: fine)");

  let still = true;
  let seen = false;
  let stop = null;
  let last = 0;
  let t = 0; // garden seconds, advanced only while running
  let tx = 0; // pointer target, -1..1 across the viewport
  let ty = 0;
  let px = 0;
  let py = 0;
  let sink = 0;
  let c = 1; // css px per canvas px
  let height = 0;
  let entrance = null; // { n: held frames since it began, ready: Map(el -> the frame its image was ready on) }

  function measure() {
    c = scene.offsetWidth / 2400 || 1;
    height = hero.offsetHeight;
  }

  // where one part is in the entrance (null once it has settled)
  function entering(l) {
    if (!entrance || l.start == null) return null;
    const n = entrance.n - Math.max(l.start, entrance.ready.get(l.el) ?? Infinity);
    if (l.flyer) return n < 0 ? { away: true } : n < 6 ? { fly: n / 6 } : null;
    return n < 0 ? land(l.motion, 0) : n <= l.motion.lead + 7 ? land(l.motion, n) : null;
  }

  // a butterfly flying in along a falling curve (1 - u²) from (dx, dy) canvas px
  const flyIn = (e, dx, dy) => {
    const q = 1 - e.fly * e.fly;
    return [dx * q * c, dy * q * c, 30 * q];
  };

  function frame(time) {
    const dt = Math.min(time - (last || time - FRAME), 2 * FRAME) / 1000;
    last = time;
    t += dt;
    const k = fine.matches ? 1 : 0;
    px += (tx * k - px) * 0.3;
    py += (ty * k - py) * 0.3;
    sink += (Math.min(Math.max(scrollY, 0), height) * SINK * k - sink) * 0.5;
    if (entrance) entrance.n++;
    let busy = false;
    for (const l of layers) {
      const e = entering(l);
      if (e) busy = true;
      let x = -px * SHIFT_X * l.depth + (e?.dx ?? 0) * c;
      let y = -py * SHIFT_Y * l.depth + sink * l.depth + (e?.dy ?? 0) * c;
      let rot = e?.rot ?? 0;
      let scale = e?.sc ?? 1;
      if (l.flyer) {
        // a slow loop around its spot over the lavender, a bob on each downstroke, turned into its drift
        const a = t * 0.8 + l.seed;
        const b = t * 1.1 + l.seed * 1.7;
        const beat = Math.floor(t * 12 + l.seed * 5) % 4;
        x += (55 * Math.sin(a) + 18 * Math.sin(2.3 * b)) * c;
        y += (26 * Math.sin(b) - 10 * FLAP[beat]) * c;
        rot = 14 * Math.cos(a);
        if (e?.away) scale = 0;
        else if (e?.fly != null) {
          const [fx, fy, fr] = flyIn(e, l.seed > 3 ? 420 : -420, -260);
          x += fx;
          y += fy;
          rot += fr;
        }
        l.el.children[0].style.transform = l.el.children[1].style.transform = `scaleX(${FLAP[beat]})`;
      }
      if (l.drift) l.el.style.translate = `${(-66.6667 * ((t / l.drift + l.phase) % 1)).toFixed(4)}% 0`;
      if (l.twinkle) l.el.style.opacity = (0.45 + 0.55 * breathe(t, l.twinkle[0], l.twinkle[1])).toFixed(3);
      l.el.style.transform =
        `translate3d(${x.toFixed(2)}px,${y.toFixed(2)}px,0)` +
        (rot ? ` rotate(${rot.toFixed(2)}deg)` : "") +
        (scale !== 1 ? ` scale(${scale ? scale.toFixed(4) : 0})` : "");
    }
    if (halo) {
      const b = breathe(t, 7.4);
      halo.style.opacity = (0.7 + 0.3 * b).toFixed(3);
      halo.style.transform = `scale(${(1 + 0.04 * b).toFixed(4)})`;
    }
    if (sun) sun.style.opacity = (0.86 + 0.14 * breathe(t, 9.6)).toFixed(3);
    if (glow) {
      const n = entrance ? entrance.n - Math.max(10, entrance.ready.get(glow) ?? Infinity) : FLICKER.length;
      const b = 0.7 * breathe(t, 5.2) + 0.3 * breathe(t, 2.3, 0.4);
      glow.style.opacity = n < 0 ? "0" : n < FLICKER.length ? `${FLICKER[n]}` : (0.84 + 0.16 * b).toFixed(3);
      if (n < FLICKER.length) busy = true;
    }
    // the companion basks with its wings open, now and then two slow beats
    if (resting.el && !resting.el.hidden) {
      const e = entering(resting);
      const slow = Math.floor(t * 6) % 40;
      resting.el.children[0].style.transform = resting.el.children[1].style.transform = `scaleX(${slow < 4 && !e ? FLAP[slow] : 1})`;
      if (e?.away) resting.el.style.transform = "scale(0)";
      else if (e?.fly != null) {
        const [fx, fy, fr] = flyIn(e, 380, -300);
        resting.el.style.transform = `translate3d(${fx.toFixed(2)}px,${fy.toFixed(2)}px,0) rotate(${(-fr).toFixed(2)}deg)`;
      } else resting.el.style.removeProperty("transform");
      if (e) busy = true;
    }
    if (entrance && !busy) entrance = null;
  }

  // the composed state: what reduced motion and a stilled garden show
  function rest() {
    for (const el of garden.querySelectorAll("[data-depth], .g-halo, .g-bf > i, .g-companion")) {
      for (const name of ["transform", "translate", "opacity"]) el.style.removeProperty(name);
    }
    t = 0;
    px = py = sink = 0;
    entrance = null;
  }

  function update() {
    const run = seen && !still;
    garden.classList.toggle("is-live", !still);
    if (run && !stop) {
      last = 0;
      stop = tick((time) => frame(time));
    } else if (!run && stop) {
      stop();
      stop = null;
    }
  }

  // A fresh load (not back/forward, not opened mid-page) assembles the park like a pop-up book. Each part starts
  // once its image has decoded, or after 1.2 s regardless; the headline and the editor never wait.
  function assemble() {
    const nav = performance.getEntriesByType("navigation")[0];
    if (nav?.type === "back_forward" || location.hash || scrollY > height / 3) return;
    entrance = { n: 0, ready: new Map() };
    const parts = [...layers.map((l) => l.el), resting.el].filter(Boolean);
    const ready = (el) => entrance && !entrance.ready.has(el) && entrance.ready.set(el, entrance.n);
    setTimeout(() => parts.forEach(ready), 1200);
    for (const el of parts) {
      const src = getComputedStyle(el.matches(".g-bf") ? el.firstElementChild : el).backgroundImage.match(/url\(["']?([^"')]+)/)?.[1];
      if (!src || !el.getClientRects().length) {
        ready(el);
        continue;
      }
      const img = new Image();
      img.src = src;
      img.decode().then(
        () => ready(el),
        () => ready(el),
      );
    }
    frame(performance.now()); // pose everything now, so nothing shows assembled before the clock's first frame
  }

  // After the page has loaded, fetch and decode the other theme's images so the first toggle cross-fades into a
  // park that is already there.
  function warm() {
    const other = document.documentElement.dataset.theme === "dark" ? "day" : "night";
    const narrow = garden.clientWidth / garden.clientHeight < 0.55; // garden.css hides the bench, lamp and glow
    for (const el of garden.querySelectorAll(narrow ? ".g-layer:not(.g-bench, .g-lamp, .g-glow), .g-free" : ".g-layer, .g-free")) {
      const src = getComputedStyle(el).getPropertyValue(`--${other}`).match(/url\(["']?([^"')]+)/)?.[1];
      if (!src) continue;
      const img = new Image();
      img.src = src;
      img.decode().catch(() => {});
    }
  }

  measure();
  new ResizeObserver(measure).observe(garden);
  new IntersectionObserver(([entry]) => {
    seen = entry.isIntersecting;
    update();
  }).observe(hero);
  onMotion((isStill) => {
    still = isStill;
    if (still) rest();
    update();
  });
  if (!still) assemble();
  addEventListener("pageshow", (event) => {
    if (event.persisted) entrance = null;
  });
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
  const idle = window.requestIdleCallback ?? ((fn) => setTimeout(fn, 1));
  if (document.readyState === "complete") idle(warm);
  else addEventListener("load", () => idle(warm), { once: true });
}
