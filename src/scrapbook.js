import { FRAME, onMotion, still, tick } from "./clock.js";
import { drawDoodles } from "./doodles.js";

drawDoodles();

// The films' landing (launch/src/butterfly/Butterfly.tsx, land()): a piece falls the last few frames with its
// offsets shrinking by 1 - u², then settles with a damped overshoot whose swing depends on its material. Here
// it is sampled at 12 fps and every frame is held (step-end), like stop motion. Pieces are never hidden: before
// a piece lands it is simply in place, and it only hops up and settles when it reaches the reader.
const MOTION = {
  paper: { lead: 2, dx: 0, dy: -20, rot: 3, sc: 0.05, w: 0.5 },
  card: { lead: 2, dx: 8, dy: -24, rot: -4.5, sc: 0.06, w: 0.6 },
  stamp: { lead: 1, dx: 0, dy: -8, rot: 1.5, sc: 0.14, w: 0.9 },
};
const MATERIAL = [
  [".chapter-label, .section-title, .drawer-title", "stamp"],
  [".beat, .index-card, .end-card", "card"],
];
const PER_FRAME = FRAME / (1000 / 60); // film frames (60 fps) per held frame

function landFrames(mat) {
  const m = MOTION[mat];
  const contact = m.lead * PER_FRAME;
  const frames = [];
  for (let n = 0; n <= m.lead + 7; n++) {
    const t = n * PER_FRAME; // film frames since the fall began
    const u = Math.min(1, t / contact);
    const q = 1 - u * u;
    const tau = Math.max(0, t - contact);
    const kk = q - (tau > 0 ? Math.exp(-tau / 6) * Math.sin(m.w * tau) * (1.4 / (contact * m.w)) : 0);
    const sq = mat === "stamp" && tau > 0 ? Math.exp(-tau / 3) * Math.sin(0.9 * tau) : 0;
    frames.push({
      transform: `translate(${(m.dx * q).toFixed(2)}px, ${(m.dy * q).toFixed(2)}px) rotate(${(m.rot * kk).toFixed(3)}deg) scale(${((1 + m.sc * kk) * (1 + 0.05 * sq)).toFixed(4)}, ${((1 + m.sc * kk) * (1 - 0.07 * sq)).toFixed(4)})`,
      easing: "steps(1, end)",
    });
  }
  frames.push({ transform: "none" });
  return frames;
}
const KEYFRAMES = Object.fromEntries(Object.keys(MOTION).map((mat) => [mat, landFrames(mat)]));

function land(el) {
  const mat = MATERIAL.find(([selector]) => el.matches(selector))?.[1] ?? "paper";
  const frames = KEYFRAMES[mat];
  el.animate(frames, { duration: (frames.length - 1) * FRAME, easing: "linear" });
}

// Labels type themselves in, a few characters a held frame, with a caret that rests a moment at the end.
// The full text stays in the document for screen readers; the typed copy is decoration.
function type(label) {
  const text = label.textContent;
  if (!text.trim() || label.querySelector("a, span")) return;
  label.innerHTML = '<span class="sr-only"></span><span class="typed" aria-hidden="true"></span>';
  label.firstChild.textContent = text;
  const typed = label.lastChild;
  for (const ch of text) {
    const span = document.createElement("span");
    span.textContent = ch;
    typed.append(span);
  }
  const chars = typed.children;
  const caret = document.createElement("i");
  caret.className = "caret";
  const step = Math.max(2, Math.ceil(chars.length / 18));
  let shown = 0;
  let rest = 0;
  tick(() => {
    if (shown < chars.length) {
      for (let k = 0; k < step && shown < chars.length; k++) chars[shown++].classList.add("on");
      chars[shown - 1].after(caret);
      return true;
    }
    if (rest++ < 10) {
      caret.style.opacity = rest % 4 < 2 ? "1" : "0";
      return true;
    }
    caret.remove();
    return false;
  });
}

// chapter 2: the scraps from the pile fly into the notebook, one after another, and their files appear
function gather(stage) {
  const rows = [...stage.querySelectorAll(".nb-row")];
  const ease = (u) => 1 - (1 - u) ** 3;
  stage.querySelectorAll(".mini").forEach((mini, i) => {
    const row = rows[i];
    if (!row) return;
    const a = mini.getBoundingClientRect();
    const b = row.getBoundingClientRect();
    const dx = b.left + 20 - (a.left + a.width / 2);
    const dy = b.top + b.height / 2 - (a.top + a.height / 2);
    const lift = -60 - Math.abs(dx) * 0.15;
    const n = 9;
    const frames = [];
    for (let k = 0; k <= n; k++) {
      const u = ease(k / n);
      frames.push({
        transform: `translate(${(dx * u).toFixed(1)}px, ${(dy * u + lift * 4 * u * (1 - u)).toFixed(1)}px) rotate(${((1 - u) * 6).toFixed(2)}deg) scale(${(1 - 0.65 * u).toFixed(3)})`,
        opacity: k === n ? 0 : 1,
        easing: "steps(1, end)",
      });
    }
    const delay = i * 3 * FRAME;
    mini.animate(frames, { duration: n * FRAME, delay, fill: "forwards" });
    setTimeout(() => row.classList.add("is-in"), delay + (n - 1) * FRAME);
  });
}

// chapter 5: the pinned specimens let go of their pins and fly up and away; live butterflies follow
function release(spread) {
  spread.querySelectorAll(".release img").forEach((img, i) => {
    const n = 16;
    const side = i % 2 ? 1 : -1;
    const frames = [];
    for (let k = 0; k <= n; k++) {
      const u = k / n;
      frames.push({
        transform: `translate(${(side * 120 * u + side * 40 * Math.sin(u * 6)).toFixed(1)}px, ${(-520 * u * u - 30 * u).toFixed(1)}px) rotate(${(side * 18 * u).toFixed(1)}deg) scale(${k % 2 ? 0.25 : 1}, 1)`,
        opacity: u > 0.8 ? (1 - u) * 5 : 1,
        easing: "steps(1, end)",
      });
    }
    img.animate(frames, { duration: n * FRAME, delay: i * 2 * FRAME, fill: "forwards" });
  });
  dispatchEvent(new Event("butterflies:release"));
}

// the day goes by as you read: dawn at the top, golden hour by the lift-off, night at the close
const LIGHT = [
  [0, [255, 190, 140, 0.11]],
  [0.18, [255, 236, 205, 0.03]],
  [0.5, [255, 236, 205, 0]],
  [0.64, [255, 176, 92, 0.09]],
  [0.74, [140, 110, 170, 0.1]],
  [0.84, [32, 54, 118, 0.14]],
  [1, [20, 30, 70, 0.18]],
];
const sky = document.createElement("div");
sky.className = "daylight";
sky.setAttribute("aria-hidden", "true");
document.body.prepend(sky);
let lightShown = -1;
function light() {
  // only the landing's day passes, and only in daylight: the night theme is already night
  if (document.documentElement.dataset.page !== "home" || document.documentElement.dataset.theme === "dark") {
    if (lightShown !== -2) sky.style.backgroundColor = "";
    lightShown = -2;
    return false;
  }
  const max = document.documentElement.scrollHeight - innerHeight;
  const q = Math.round((max > 0 ? Math.min(1, scrollY / max) : 0) * 120) / 120;
  if (q === lightShown) return false;
  lightShown = q;
  let i = 0;
  while (i < LIGHT.length - 2 && q > LIGHT[i + 1][0]) i++;
  const [p0, c0] = LIGHT[i];
  const [p1, c1] = LIGHT[i + 1];
  const u = Math.min(1, Math.max(0, (q - p0) / (p1 - p0)));
  const c = c0.map((v, k) => v + (c1[k] - v) * u);
  sky.style.backgroundColor = `rgb(${c[0].toFixed(0)} ${c[1].toFixed(0)} ${c[2].toFixed(0)} / ${c[3].toFixed(3)})`;
  return false;
}

const observer = new IntersectionObserver(
  (entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      const el = entry.target;
      observer.unobserve(el);
      if (still()) continue;
      if (el.matches(".doodle, .note")) el.classList.add("is-landed");
      else if (el.matches(".specimen-label")) type(el);
      else if (el.matches(".gather-stage")) gather(el);
      else if (el.matches(".ch-ready")) release(el);
      else land(el);
      if (el.matches(".settle")) setTimeout(() => dispatchEvent(new Event("scrapbook:settled")), 900);
    }
  },
  { rootMargin: "0px 0px -12% 0px" },
);
// the two choreographed beats wait until most of their spread is in view
const beats = new IntersectionObserver(
  (entries) => {
    for (const entry of entries) {
      if (entry.intersectionRatio < 0.5) continue;
      beats.unobserve(entry.target);
      observer.observe(entry.target);
    }
  },
  { threshold: [0.5] },
);

addEventListener("scroll", () => still() || tick(light), { passive: true });
let started = false;
onMotion((isStill) => {
  document.documentElement.classList.toggle("story-motion", !isStill);
  if (isStill) {
    lightShown = -1;
    sky.style.backgroundColor = "";
    return;
  }
  tick(light);
  if (started) return;
  started = true;
  // a page opened on a #section skips the entrances above it
  for (const el of document.querySelectorAll(".settle, .doodle, .note, .specimen-label")) {
    if (location.hash && el.getBoundingClientRect().bottom < innerHeight) continue;
    if (el.matches(".doodle, .note")) el.classList.add("will-land");
    observer.observe(el);
  }
  for (const el of document.querySelectorAll(".gather-stage, .ch-ready")) beats.observe(el);
});
