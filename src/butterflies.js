import "./butterflies.css";
import { onMotion, tick as onFrame } from "./clock.js";

// Desktop display size in css px (phones 0.7×); 2× sprites, body on the centre axis.
// sizes include the torn paper margin around each butterfly
export const SPECIES = [
  { id: "small-blue", src: "/scrapbook/fly/small-blue.webp", w: 121, h: 97 },
  { id: "morpho", src: "/scrapbook/fly/morpho.webp", w: 145, h: 113 },
  { id: "brimstone", src: "/scrapbook/fly/brimstone.webp", w: 129, h: 98 },
  { id: "cabbage-white", src: "/scrapbook/fly/cabbage-white.webp", w: 125, h: 89 },
  { id: "peacock", src: "/scrapbook/fly/peacock.webp", w: 133, h: 94 },
];
const IGNORE =
  "a,button,input,textarea,select,summary,label,[contenteditable],[tabindex],iframe,.demo,.addon-search";
const DEG = Math.PI / 180;
const phone = matchMedia("(max-width: 699px)");
const rand = (min, max) => min + Math.random() * (max - min);
const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
const flying = (b) => b.anim?.fly;

const layer = document.createElement("div");
layer.className = "bf-layer";
layer.setAttribute("aria-hidden", "true");
document.body.append(layer);

const flock = [];
const active = new Set();
let spots = new Map(); // perch element -> landing point in layer coordinates
let ox = 0; // layer origin in page coordinates
let oy = 0;
let scale = 1;
let running = false;
let motion; // aborts the interaction listeners
let measureTimer;
const io = new IntersectionObserver((entries) => {
  for (const { target, isIntersecting } of entries) {
    const b = flock.find((b) => b.el === target);
    if (b) {
      b.seen = isIntersecting;
      rest(b);
    }
  }
});

function hatch(sp) {
  const { w, h, src } = sp;
  layer.insertAdjacentHTML(
    "beforeend",
    `<i class="bf-shadow" style="width:${w + 16}px;height:${h + 16}px;background-image:url(${src.replace(".webp", "-shadow.webp")})"></i>` +
      `<div class="bf" style="width:${w}px;height:${h}px;--src:url(${src})"><div class="bf-stage"><i></i><i></i></div></div>`,
  );
  const el = layer.lastChild;
  const b = { sp, el, shadow: el.previousSibling, wings: el.firstChild.children, x: 0, y: 0, a: 0 };
  flock.push(b);
  io.observe(el);
  return b;
}

function drop(b) {
  active.delete(b);
  clearTimeout(b.timer);
  io.unobserve(b.el);
  b.el.remove();
  b.shadow.remove();
  flock.splice(flock.indexOf(b), 1);
}

function draw(b, x, y, a, lift = 0, wing = 0) {
  const { w, h } = b.sp;
  const size = scale * (1 + 0.12 * lift);
  const spread = size * (1 + 0.3 * lift);
  const offset = (4 + 34 * lift) * scale;
  b.el.style.transform = `translate3d(${x - w / 2}px,${y - h / 2}px,0) rotate(${a}deg) scale(${size})`;
  b.wings[0].style.transform = `rotateY(${wing}deg)`;
  b.wings[1].style.transform = `rotateY(${-wing}deg)`;
  // The shadow narrows as the wings rise and drifts away as the butterfly lifts.
  b.shadow.style.transform = `translate3d(${x - w / 2 - 8 + offset * 0.8}px,${y - h / 2 - 8 + offset}px,0) rotate(${a}deg) scale(${spread * Math.cos(wing * DEG)},${spread})`;
  b.shadow.style.opacity = lift ? `calc(var(--bf-shadow) * ${1 - 0.5 * lift})` : "";
}

function mark(b, fly) {
  b.el.classList.toggle("bf-fly", fly);
  b.shadow.classList.toggle("bf-fly", fly);
}

function play(b, anim) {
  anim.t = 0;
  b.anim = anim;
  mark(b, !!anim.fly);
  active.add(b);
  if (!running) {
    running = true;
    onFrame(tick);
  }
}

function stop(b) {
  active.delete(b);
  b.anim = null;
  mark(b, false);
  draw(b, b.x, b.y, b.a);
}

// runs on the site's 12 fps clock (held frames, like stop motion)
function tick(now) {
  for (const b of active) {
    const f = b.anim;
    const dt = Math.min(now - (f.last ?? now), 120) / 1000;
    f.last = now;
    const u = Math.min((f.t += dt) / f.d, 1);
    if (f.fly) glide(b, f, u, dt);
    else draw(b, b.x, b.y, b.a, 0, (f.amp * (1 - Math.cos(2 * Math.PI * f.n * u))) / 2);
    if (u < 1) continue;
    if (f.fly) play(b, { n: 2, amp: 40, d: 0.9 }); // land with a couple of slower beats
    else {
      stop(b);
      rest(b);
    }
  }
  if (active.size) return true;
  running = false;
  return false;
}

// A cubic bezier from the takeoff point whose last leg leads head-first into the perch (b.x, b.y).
function glide(b, f, u, dt) {
  const s = (1 - Math.cos(Math.PI * u)) / 2;
  const m = 1 - s;
  const x2 = b.x - Math.sin(b.a * DEG) * f.c;
  const y2 = b.y + Math.cos(b.a * DEG) * f.c;
  const x = m * m * m * f.x0 + 3 * m * s * (m * f.x1 + s * x2) + s * s * s * b.x;
  const y = m * m * m * f.y0 + 3 * m * s * (m * f.y1 + s * y2) + s * s * s * b.y;
  const dx = m * m * (f.x1 - f.x0) + 2 * m * s * (x2 - f.x1) + s * s * (b.x - x2);
  const dy = m * m * (f.y1 - f.y0) + 2 * m * s * (y2 - f.y1) + s * s * (b.y - y2);
  const len = Math.hypot(dx, dy) || 1;
  const arc = Math.sin(Math.PI * u);
  const wobble = arc * 9 * Math.sin(f.t * 11 + f.seed);
  const left = f.d - f.t;
  f.ph += 2 * Math.PI * dt * (left > 0.4 ? f.hz : 3 + ((f.hz - 3) * left) / 0.4);
  const turn = Math.atan2(dx, -dy) / DEG - f.hd;
  f.hd += ((((turn % 360) + 540) % 360) - 180) * Math.min(1, dt * 12);
  const lift = Math.max(0, arc * (f.lift + 0.06 * Math.sin(f.ph)));
  const wing = (72 * clamp(left / 0.25, 0, 1) * (1 - Math.cos(f.ph))) / 2;
  draw(b, x - (dy / len) * wobble, y + (dx / len) * wobble, f.hd, lift, wing);
}

// perched butterflies keep still on their own (the companion is the one that moves by itself)
function rest(b) {
  clearTimeout(b.timer);
}

function free(el, b) {
  const { x, y } = spots.get(el);
  const gap = (o) => Math.hypot(o.x - x, o.y - y) > (o.sp.w + b.sp.w) * 0.45 * scale;
  return flock.every((o) => o === b || !o.perch || (o.perch !== el && gap(o)));
}

// Fly to a free perch, preferring ones in view; `enter` flies in from past the nearest screen edge.
function takeoff(b, px, py, enter) {
  if (document.hidden || flock.filter(flying).length > 1) return;
  const vx = scrollX - ox;
  const vy = scrollY - oy;
  const [vw, vh] = [innerWidth, innerHeight];
  let to;
  let best = Infinity;
  for (const [el, s] of spots) {
    if (el === b.perch || !free(el, b) || Math.hypot(s.x - px, s.y - py) < 220) continue;
    const seen = s.x > vx + 40 && s.x < vx + vw - 40 && s.y > vy + 40 && s.y < vy + vh - 40;
    const hop = Math.abs(Math.hypot(s.x - b.x, s.y - b.y) - rand(250, 600));
    const score = (seen ? 0 : enter ? Infinity : 1e5) + hop;
    if (score < best) [best, to] = [score, el];
  }
  if (!to) return;
  const s = spots.get(to);
  let [x0, y0, a0] = [b.x, b.y, b.a];
  if (enter) {
    // Never from below the end of the page, which would make it taller.
    const end = vy + vh + 200 > document.documentElement.scrollHeight - oy;
    const gaps = [s.x - vx, vx + vw - s.x, s.y - vy, end ? Infinity : vy + vh - s.y];
    const edge = gaps.indexOf(Math.min(...gaps));
    const out = b.sp.w;
    x0 = edge === 0 ? vx - out : edge === 1 ? vx + vw + out : s.x + rand(-150, 150);
    y0 = edge === 2 ? vy - out : edge === 3 ? vy + vh + out : s.y + rand(-150, 150);
    a0 = Math.atan2(s.x - x0, y0 - s.y) / DEG;
  }
  let dx = Math.sin(a0 * DEG);
  let dy = -Math.cos(a0 * DEG);
  if (!enter) {
    // Flee from the pointer first.
    const away = Math.hypot(x0 - px, y0 - py) || 1;
    dx = dx / 2 + (x0 - px) / away;
    dy = dy / 2 + (y0 - py) / away;
  }
  const chord = Math.hypot(s.x - x0, s.y - y0);
  const reach = clamp(chord / 2, 60, 240) / (Math.hypot(dx, dy) || 1);
  const bend = rand(-0.3, 0.3);
  const x1 = x0 + dx * reach - (s.y - y0) * bend;
  const y1 = y0 + dy * reach + (s.x - x0) * bend;
  const c = clamp(chord * 0.35, 40, 180);
  const length = (chord + Math.hypot(x1 - x0, y1 - y0) + Math.hypot(s.x - x1, s.y - y1) + c) / 2;
  // Land facing the way it arrives: head down when coming from above (same footprint as head up).
  Object.assign(b, { perch: to, x: s.x, y: s.y, a: (s.y > y0 ? 180 : 0) + rand(-10, 10) });
  clearTimeout(b.timer);
  const d = clamp(length / rand(250, 450), 0.8, 3);
  const lift = Math.min(1, chord / 450);
  play(b, { fly: true, x0, y0, x1, y1, c, d, lift, ph: 0, hd: a0, seed: rand(0, 6), hz: b.sp.w > 120 ? 4 : 6 });
  return true;
}

function startle(event, radius) {
  const x = event.pageX - ox;
  const y = event.pageY - oy;
  let near;
  for (const b of flock) {
    const distance = Math.hypot(b.x - x, b.y - y);
    if (!flying(b) && distance < radius) [radius, near] = [distance, b];
  }
  if (near) takeoff(near, x, y);
}

function onMove(event) {
  if (event.pointerType !== "touch") startle(event, 110);
}

function onTap(event) {
  if (event.target.closest?.(IGNORE) || getSelection()?.isCollapsed === false) return;
  startle(event, 160);
}

// the story's lift-off: every perched butterfly in view takes off (story.js fires this at chapter 5)
function release() {
  if (!motion) return;
  for (const b of flock) if (b.seen && !b.anim) takeoff(b, b.x, b.y + 400);
}

function onVisibility() {
  for (const b of flock) {
    if (document.hidden) stop(b);
    rest(b);
  }
}

function setMotion(isStill) {
  motion?.abort();
  motion = isStill ? null : new AbortController();
  for (const b of flock) {
    stop(b);
    rest(b);
  }
  if (!motion) return;
  const options = { passive: true, signal: motion.signal };
  addEventListener("pointermove", onMove, options);
  addEventListener("click", onTap, options);
  addEventListener("butterflies:release", release, options);
  document.addEventListener("visibilitychange", onVisibility, options);
}

// Cache perch landing points, dropping the ones where a resting butterfly would cover text.
function measure() {
  const box = layer.getBoundingClientRect();
  ox = box.left + scrollX;
  oy = box.top + scrollY;
  scale = phone.matches ? 0.7 : 1;
  const text = [];
  const range = document.createRange();
  for (const root of document.querySelectorAll("main, header, footer")) {
    if (root.parentElement.closest("main, header, footer")) continue;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      if (!walker.currentNode.data.trim()) continue;
      range.selectNodeContents(walker.currentNode);
      text.push(...range.getClientRects());
    }
    for (const el of root.querySelectorAll("iframe,input,textarea,select")) text.push(...el.getClientRects());
  }
  // Half the resting footprint of the largest butterfly, with room for tilt and raised wings.
  const fw = 72 * scale;
  const fh = 58 * scale;
  const covers = (x, y) => (r) =>
    r.left < x + fw && r.right > x - fw && r.top < y + fh && r.bottom > y - fh;
  spots = new Map();
  for (const el of document.querySelectorAll("[data-perch]")) {
    if (!el.getClientRects().length) continue;
    const r = el.getBoundingClientRect();
    const [fx, fy] = `${el.dataset.perch},`.split(",").map((v) => (v.trim() && isFinite(v) ? +v : 0.5));
    const x = r.left + fx * r.width;
    const y = r.top + fy * r.height;
    if (!text.some(covers(x, y))) spots.set(el, { x: x - box.left, y: y - box.top });
  }
}

function home(b, el) {
  if (!spots.has(el) || !free(el, b)) el = [...spots.keys()].find((p) => free(p, b));
  if (!el) return false;
  Object.assign(b, spots.get(el), { perch: el, a: rand(-10, 10) });
  draw(b, b.x, b.y, b.a);
  return true;
}

// Keep butterflies on their perches as the layout changes, and match the wanted count.
function sync() {
  const seeded = [...document.querySelectorAll("[data-perch][data-butterfly]")];
  let want = parseInt(document.body.dataset.butterflies ?? 3);
  if (!(want >= 0)) want = 3;
  want = Math.min(want, phone.matches ? 2 : want, seeded.length || want);
  for (const b of flock) {
    const s = spots.get(b.perch);
    if (!s) {
      stop(b);
      b.perch = null;
    } else {
      Object.assign(b, s);
      if (!b.anim) draw(b, b.x, b.y, b.a);
    }
  }
  while (flock.length > want) drop(flock.at(-1));
  for (const b of [...flock]) if (!b.perch && !home(b)) drop(b);
  for (let i = flock.length; i < want; i++) {
    const el = seeded[i];
    const b = hatch(SPECIES.find((sp) => sp.id === el?.dataset.butterfly) ?? SPECIES[i % SPECIES.length]);
    if (!home(b, el)) return drop(b);
  }
}

function remeasure() {
  clearTimeout(measureTimer);
  measureTimer = setTimeout(() => {
    measure();
    sync();
  }, 150);
}

measure();
sync();
onMotion(setMotion);
addEventListener("resize", remeasure);
addEventListener("scrapbook:settled", remeasure); // a card finished landing, so its perches moved
new ResizeObserver(remeasure).observe(document.body);
document.fonts.ready.then(remeasure);
