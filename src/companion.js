// One small blue goes through the story with the reader. It starts on the app icon in the hero; as the
// page scrolls it flies from perch to perch ([data-companion="n"], in order), along a path that leaves
// through the page gutter, so it never crosses the reading column, and it lands where the next chapter
// begins. Its progress follows the scroll position with a little lag; scrolling back retraces it. It is
// drawn on the 12 fps clock, idle while perched, and with reduced motion (or the garden stilled) it stays
// on the icon.
import "./butterflies.css";
import { onMotion, tick } from "./clock.js";

const SRC = "/scrapbook/fly/small-blue.webp";
const phone = matchMedia("(max-width: 699px)");

const layer = document.createElement("div");
layer.className = "companion-layer";
layer.setAttribute("aria-hidden", "true");
layer.innerHTML = `<i class="bf-shadow companion-shadow" style="width:120px;height:96px;background-image:url(${SRC.replace(".webp", "-shadow.webp")})"></i><div class="bf companion" style="width:104px;height:80px;--src:url(${SRC})"><div class="bf-stage"><i></i><i></i></div></div>`;
document.body.append(layer);
document.documentElement.dataset.companionReady = "";
const el = layer.querySelector(".companion");
const shadow = layer.querySelector(".companion-shadow");
const wings = el.firstChild.children;

let stops = []; // [{ x, y, a, at }] perch points in page coordinates, `at` = the scroll position it belongs to
let gutter = 0; // x of the left gutter's middle; the right one mirrors it
let size = 1;
let shown = 0; // the progress being drawn, eases toward `target`
let target = 0;
let running = false;
let motion = false;
let beat = 0; // wing phase in held frames
let breathTimer;
let away = false;

function measure() {
  size = phone.matches ? 0.62 : 0.78;
  const points = [...document.querySelectorAll("[data-companion]")]
    .filter((p) => p.getClientRects().length)
    .sort((p, q) => p.dataset.companion - q.dataset.companion);
  const vh = innerHeight;
  stops = points.map((p) => {
    const r = p.getBoundingClientRect();
    const icon = p.matches(".hero-icon");
    const x = r.left + scrollX + r.width / 2;
    const y = r.top + scrollY + (icon ? r.height * 0.5 : Math.min(r.height * 0.15, 40));
    // on the icon it is exactly the size of the printed butterfly it replaces
    const k = icon ? (r.width * 0.56) / 104 : size;
    return { x, y, k, a: Number(p.dataset.heading ?? (icon ? 19 : -14)), at: icon ? 0 : Math.max(0, y - vh * 0.42) };
  });
  // keep anchors increasing even if two perches sit at the same height
  for (let i = 1; i < stops.length; i++) stops[i].at = Math.max(stops[i].at, stops[i - 1].at + 120);
  const wrap = document.querySelector("main .wrap")?.getBoundingClientRect();
  gutter = wrap ? Math.max(24, wrap.left / 2) : 24;
  onScroll();
  draw(shown);
}

// where the reader is: a stop index plus the fraction of the flight to the next stop
function progressAt(y) {
  if (!stops.length) return 0;
  let i = 0;
  while (i < stops.length - 1 && y >= stops[i + 1].at) i++;
  if (i === stops.length - 1) return i;
  const span = stops[i + 1].at - stops[i].at;
  const u = (y - stops[i].at) / span;
  // perched for the first and last stretch of each span, flying in between
  const fly = Math.min(1, Math.max(0, (u - 0.2) / 0.6));
  return i + fly;
}

const ease = (u) => u * u * (3 - 2 * u);
function pose(p) {
  const i = Math.min(Math.floor(p), stops.length - 1);
  const a = stops[i];
  const b = stops[i + 1];
  const u = p - i;
  if (!b || u <= 0) return { x: a.x, y: a.y, a: a.a, k: a.k, flying: false };
  // leave through the nearer gutter so the path never crosses the reading column
  const left = (a.x + b.x) / 2 < scrollX + innerWidth / 2;
  const gx = scrollX + (left ? gutter : innerWidth - gutter);
  const dy = b.y - a.y;
  const c1 = [gx, a.y + dy * 0.3];
  const c2 = [gx, b.y - dy * 0.3];
  const s = ease(u);
  const m = 1 - s;
  const x = m * m * m * a.x + 3 * m * m * s * c1[0] + 3 * m * s * s * c2[0] + s * s * s * b.x;
  const y = m * m * m * a.y + 3 * m * m * s * c1[1] + 3 * m * s * s * c2[1] + s * s * s * b.y;
  const tx = 3 * m * m * (c1[0] - a.x) + 6 * m * s * (c2[0] - c1[0]) + 3 * s * s * (b.x - c2[0]);
  const ty = 3 * m * m * (c1[1] - a.y) + 6 * m * s * (c2[1] - c1[1]) + 3 * s * s * (b.y - c2[1]);
  const heading = (Math.atan2(tx, -ty) * 180) / Math.PI;
  // turn into the flight and back to the perch's own heading as it lands
  const turn = Math.min(1, u * 5, (1 - u) * 5);
  return { x, y, a: a.a + (heading - a.a) * turn, k: a.k + (b.k - a.k) * s, flying: u > 0.02 && u < 0.98 };
}

function draw(p, wing = 0, lift = 0) {
  if (!stops.length) return;
  const { x, y, a, k: base } = pose(p);
  const k = base * (1 + 0.1 * lift);
  el.style.transform = `translate3d(${x - 52}px,${y - 40}px,0) rotate(${a}deg) scale(${k})`;
  wings[0].style.transform = `rotateY(${wing}deg)`;
  wings[1].style.transform = `rotateY(${-wing}deg)`;
  const off = 4 + 30 * lift;
  shadow.style.transform = `translate3d(${x - 60 + off * 0.8}px,${y - 48 + off}px,0) rotate(${a}deg) scale(${k * Math.cos((wing * Math.PI) / 180)},${k})`;
  shadow.style.opacity = lift ? String(0.34 * (1 - 0.5 * lift)) : "";
  if (away !== p > 0.02) {
    away = p > 0.02;
    document.documentElement.toggleAttribute("data-companion-away", away);
  }
}

function frame() {
  const gap = target - shown;
  shown = Math.abs(gap) < 0.002 ? target : shown + gap * 0.3;
  const flying = pose(shown).flying;
  beat++;
  // stop-motion wingbeats: up on one held frame, down on the next
  const wing = flying ? (beat % 2 ? 66 : 8) : 0;
  draw(shown, wing, flying ? Math.sin(Math.PI * (shown % 1)) : 0);
  if (shown !== target || flying) return true;
  running = false;
  rest();
  return false;
}

function run() {
  if (!running && motion) {
    running = true;
    tick(frame);
  }
}

// while perched it basks: now and then the wings close slowly and open again (a few held frames)
function rest() {
  clearTimeout(breathTimer);
  if (!motion || running) return;
  breathTimer = setTimeout(() => {
    const steps = [20, 42, 58, 58, 42, 20, 0];
    let n = 0;
    tick(() => {
      if (running) return false;
      draw(shown, steps[n++] ?? 0);
      if (n < steps.length) return true;
      rest();
      return false;
    });
  }, 4000 + Math.random() * 5000);
}

function onScroll() {
  target = motion ? progressAt(scrollY) : 0;
  run();
}

onMotion((isStill) => {
  motion = !isStill;
  clearTimeout(breathTimer);
  if (!motion) {
    shown = target = 0;
    draw(0);
    return;
  }
  onScroll();
  rest();
});
let measureTimer;
const remeasure = () => {
  clearTimeout(measureTimer);
  measureTimer = setTimeout(measure, 150);
};
addEventListener("scroll", onScroll, { passive: true });
addEventListener("resize", remeasure);
addEventListener("scrapbook:settled", remeasure);
new ResizeObserver(remeasure).observe(document.body);
document.fonts.ready.then(remeasure);
measure();
