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

// The sky's own motion, shared by the hero and every sky panel: the clouds drift in seamless loops, the stars
// twinkle out of step, the moon's halo and the sun breathe.
function sky(root) {
  const drifts = [...root.querySelectorAll("[data-drift]")].map((el, i) => [el, +el.dataset.drift, i * 0.29]);
  const twinkles = [...root.querySelectorAll("[data-twinkle]")].map((el) => [el, ...el.dataset.twinkle.split(",").map(Number)]);
  const halo = root.querySelector(".g-halo");
  const sun = root.querySelector(".g-sun");
  return (t) => {
    for (const [el, period, phase] of drifts) el.style.translate = `${(-66.6667 * ((t / period + phase) % 1)).toFixed(4)}% 0`;
    for (const [el, period, phase] of twinkles) el.style.opacity = (0.45 + 0.55 * breathe(t, period, phase)).toFixed(3);
    if (halo) {
      const b = breathe(t, 7.4);
      halo.style.opacity = (0.7 + 0.3 * b).toFixed(3);
      halo.style.transform = `scale(${(1 + 0.04 * b).toFixed(4)})`;
    }
    if (sun) sun.style.opacity = (0.86 + 0.14 * breathe(t, 9.6)).toFixed(3);
  };
}

// When the reader reaches for the theme switch (hover, focus or press), fetch and decode the other theme's images
// so the toggle cross-fades into a sky that is (nearly) there, without every visit paying for both themes.
function warm(root, skip = "") {
  const other = document.documentElement.dataset.theme === "dark" ? "day" : "night";
  for (const el of root.querySelectorAll(`:is(.g-layer, .g-free)${skip}`)) {
    const src = getComputedStyle(el).getPropertyValue(`--${other}`).match(/url\(["']?([^"')]+)/)?.[1];
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

if (garden) {
  const scene = garden.querySelector(".g-scene");
  const layers = [...garden.querySelectorAll("[data-depth]")].map((el) => ({ el, depth: +el.dataset.depth, sink: +el.dataset.sink }));
  layers.filter((l) => l.el.matches(".g-bf")).forEach((l, i) => Object.assign(l, { flyer: true, seed: i * 2.1 + 0.7 }));
  // the companion's resting butterfly stays put (companion.js reads its box and hides it while it is out)
  const resting = garden.querySelector(".g-companion");
  const glow = garden.querySelector(".g-glow");
  const ambient = sky(garden);
  const time = clock();
  const fine = matchMedia("(hover: hover) and (pointer: fine)");

  let tx = 0; // pointer target, -1..1 across the viewport
  let ty = 0;
  let px = 0;
  let py = 0;
  let sink = 0;
  let c = 1; // css px per canvas px
  let height = 0;

  function measure() {
    c = scene.offsetWidth / 2400 || 1;
    height = hero.offsetHeight;
  }

  function frame(now) {
    const t = time(now);
    ambient(t);
    const k = fine.matches ? 1 : 0;
    px += (tx * k - px) * 0.3;
    py += (ty * k - py) * 0.3;
    sink += (Math.min(Math.max(scrollY, 0), height) * SINK - sink) * 0.5;
    for (const l of layers) {
      let x = px * SHIFT_X * l.depth;
      let y = py * SHIFT_Y * l.depth + sink * l.sink;
      let turn = "";
      if (l.flyer) {
        // a slow loop around its spot over the lavender, a bob on each downstroke, turned into its drift
        const a = t * 0.8 + l.seed;
        const b = t * 1.1 + l.seed * 1.7;
        const beat = Math.floor(t * 12 + l.seed * 5) % 4;
        x += (55 * Math.sin(a) + 18 * Math.sin(2.3 * b)) * c;
        y += (26 * Math.sin(b) - 10 * FLAP[beat]) * c;
        turn = ` rotate(${(14 * Math.cos(a)).toFixed(2)}deg)`;
        l.el.children[0].style.transform = l.el.children[1].style.transform = `scaleX(${FLAP[beat]})`;
      }
      l.el.style.transform = `translate3d(${x.toFixed(2)}px,${y.toFixed(2)}px,0)${turn}`;
    }
    if (glow) glow.style.opacity = (0.84 + 0.16 * (0.7 * breathe(t, 5.2) + 0.3 * breathe(t, 2.3, 0.4))).toFixed(3);
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
    px = py = sink = 0;
  }

  measure();
  new ResizeObserver(measure).observe(garden);
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

// Sky panels ([data-sky], e.g. behind the closing call to action): the hero's sky without the ground, built here so
// the markup stays one element. Apart from their own haze-free sky base they use the hero's files (its wide or narrow
// choice), so they download almost nothing new.
const SKY =
  '<i class="g-layer g-sky"></i><i class="g-sun g-day"></i>' +
  '<i class="g-free g-stars g-night" data-twinkle="4.3,0"></i><i class="g-free g-stars-2 g-night" data-twinkle="6.1,0.45"></i>' +
  '<i class="g-free g-moon g-night"><i class="g-halo"></i></i>' +
  '<i class="g-layer g-clouds g-clouds-far" data-drift="640"></i><i class="g-layer g-clouds g-clouds-mid" data-drift="460"></i>' +
  '<i class="g-layer g-clouds g-clouds-near" data-drift="330"></i>';
const TWINS = ["g-clouds-far", "g-clouds-mid", "g-clouds-near"];

for (const panel of document.querySelectorAll("[data-sky]")) {
  panel.innerHTML = SKY;
  const share = () => {
    for (const name of TWINS) {
      const twin = getComputedStyle(garden.querySelector(`.${name}`));
      const mine = panel.querySelector(`.${name}`).style;
      for (const theme of ["--day", "--night"]) mine.setProperty(theme, twin.getPropertyValue(theme));
    }
  };
  if (garden) {
    share();
    new ResizeObserver(share).observe(garden);
  }
  const ambient = sky(panel);
  const time = clock();
  animate(panel, (now) => ambient(time(now)), () => (compose(panel), time()));
  intent(() => warm(panel));
}
