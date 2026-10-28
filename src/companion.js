// The companion: one small blue that lives in the park scene in the hero. When the reader starts to scroll it
// pops out of the scene toward them (its torn paper border fading in as it becomes a scrapbook piece) and keeps
// them company down the page. The scroll position only picks where it wants to be, a perch in free space beside
// the section in view; the butterfly flies there on its own, a small simulation with a capped speed and
// acceleration (the same for a slow scroll or a fling), flutter-and-glide, a bob on each downstroke and banking
// into turns, along a path planned around every line of text, control and card. Along the way it meets the
// others: a courtship spiral, a chase, two landing on one sprig, a pinned one woken up, and a lift-off into the
// closing sky, always where the reader can see them. Everything is drawn on the 12 fps clock (held frames over a
// smooth path), never rests on or crosses text, never steals the pointer, and with reduced motion (or the garden
// stilled) it simply stays in the scene. `?flight=<seed>` makes the flight reproducible and hands its clock to
// window.companionFlight, for the deterministic check.
//
// It knows nothing about the page's sections: perches and meeting places come from the measured layout (free space
// away from every line of text, control and painted card), and these attributes, all optional:
//   data-companion-start          its resting spot in the hero scene; it pops out of this box and flies home to it
//   data-scene="spiral|chase|pair|wake|liftoff"
//                                 on any element: that meeting plays once, in free space on screen, while most of the
//                                 element is in view (liftoff waits for nearly all of it)
//   data-pair[="species"]         inside a pair element: what the two land on together; the visitor (a cabbage white
//                                 unless named) stays there. Without it they land side by side on bare paper.
//   data-wake[="species"]         inside a wake element: a pinned specimen image that wakes, lets go of its pin and
//                                 flies off. Without it a visitor flies in and they circle each other.
//   data-perch="fx,fy"            anywhere: a landing point (fractions of the element's box) preferred to bare paper
// species: small-blue, morpho, brimstone, cabbage-white, peacock (SPECIES in butterflies.js).
import "./butterflies.css";
import { SPECIES } from "./butterflies.js";
import { FRAME, onMotion, still, tick } from "./clock.js";

const SP = Object.fromEntries(SPECIES.map((s) => [s.id, s]));
const phone = matchMedia("(max-width: 699px)");
const DEG = Math.PI / 180;
const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);
const lerp = (a, b, u) => a + (b - a) * u;
const ease = (u) => (u < 0 ? 0 : u > 1 ? 1 : u * u * (3 - 2 * u));
const turnTo = (from, to) => ((((to - from) % 360) + 540) % 360) - 180; // shortest signed turn, degrees

// flight, in body widths (the butterfly's drawn width) per second, so a phone's smaller one flies as fast for its size
const CRUISE = 3.6; // travel speed
const VMAX = 5; // the drawn butterfly never moves faster than this, zig-zags and bobs included
const ACCEL = 7; // steering, widths/s²
const SINK = 1.4; // a glide drifts down, widths/s²
const REACH = 0.5; // room kept from text, in widths: half the butterfly with its paper margin
const SUB = 5; // fixed physics steps per held frame
const DT = FRAME / 1000 / SUB;
// wing lift through one beat, one value per held frame (1 = raised): fast, cruising and hovering beats
const BEATS = { fast: [1, 0.08], cruise: [1, 0.55, 0.04], slow: [1, 0.62, 0.12, 0.5] };

// reproducible flight for the check: ?flight=<seed> seeds the randomness and steps only when told to
const debug = new URLSearchParams(location.search).get("flight");
let seed = debug ? Number(debug) >>> 0 : (Math.random() * 2 ** 32) >>> 0;
function random() {
  // mulberry32
  seed = (seed + 0x6d2b79f5) >>> 0;
  let t = Math.imul(seed ^ (seed >>> 15), seed | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const rand = (lo, hi) => lo + random() * (hi - lo);

const layer = document.createElement("div");
layer.className = "companion-layer";
layer.setAttribute("aria-hidden", "true");
document.body.append(layer);

/** a split-wing butterfly in the layer; `plain` adds a second, borderless set of wings to cross-fade from */
function actor(id, k, plain = false) {
  const sp = SP[id];
  const stage = (src, cls) => `<div class="bf-stage ${cls}" style="--src:url(${src})"><i></i><i></i></div>`;
  layer.insertAdjacentHTML(
    "beforeend",
    `<i class="bf-shadow" style="width:${sp.w + 16}px;height:${sp.h + 16}px;background-image:url(${sp.src.replace(".webp", "-shadow.webp")})"></i>` +
      `<div class="bf" style="width:${sp.w}px;height:${sp.h}px">${stage(sp.src, "torn")}${plain ? stage(sp.src.replace(".webp", "-plain.webp"), "plain") : ""}</div>`,
  );
  const el = layer.lastChild;
  const a = { id, el, shadow: el.previousSibling, wings: [...el.querySelectorAll(".bf-stage i")], w: sp.w, h: sp.h };
  // x, y: where it is (page px); px, py: where it is drawn; hd: heading (0 = head up); kb: its size in flight
  Object.assign(a, { x: -999, y: -999, px: -999, py: -999, vx: 0, vy: 0, k, kb: k, hd: 0, rot: 0, turn: 0, bank: 0 });
  Object.assign(a, { wing: 0, lift: 0, op: 1, torn: 1, mode: "fly", mt: 0, goal: null, path: null, pi: 0, version: -1 });
  Object.assign(a, { gait: "cruise", beat: 0, glide: false, gaitT: 0, zig: 0, zigTo: 0, zigT: 0, last: {} });
  return a;
}
function draw(a) {
  const { w, h, k } = a;
  const set = (el, key, value) => {
    if (a.last[key] !== value) el.style[key.split(":")[1]] = a.last[key] = value;
  };
  set(a.el, "el:transform", `translate3d(${(a.px - w / 2).toFixed(1)}px,${(a.py - h / 2).toFixed(1)}px,0) rotate(${a.rot.toFixed(1)}deg) scale(${k.toFixed(3)})`);
  // banking: the wing on the inside of the turn rises, the outer one flattens
  const left = clamp(a.wing + a.bank, 0, 86).toFixed(0);
  const right = clamp(a.wing - a.bank, 0, 86).toFixed(0);
  a.wings.forEach((wing, i) => {
    const value = `rotateY(${i % 2 ? -right : left}deg)`;
    if (a.last[i] !== value) wing.style.transform = a.last[i] = value;
  });
  if (a.wings.length > 2) set(a.el.lastChild, "plain:opacity", String(1 - a.torn));
  const off = (4 + 30 * a.lift) * k;
  const dark = document.documentElement.dataset.theme === "dark";
  set(a.shadow, "shadow:transform", `translate3d(${(a.px - w / 2 - 8 + off * 0.8).toFixed(1)}px,${(a.py - h / 2 - 8 + off).toFixed(1)}px,0) rotate(${a.rot.toFixed(1)}deg) scale(${(k * Math.cos(Math.max(a.wing, 0) * DEG)).toFixed(3)},${k.toFixed(3)})`);
  set(a.shadow, "shadow:opacity", String(+(a.op * (dark ? 0.7 : 0.34) * (1 - 0.5 * a.lift)).toFixed(3)));
  set(a.el, "el:opacity", String(+a.op.toFixed(3)));
}
function drop(a) {
  a.el.remove();
  a.shadow.remove();
}

// ---------------------------------------------------------------- free space (cached; read only on layout changes)

const CONTROLS = "a, button, input, select, textarea, iframe, summary";
// grid of distances (px) from each cell to the nearest text, control or card core; columns run past both screen
// edges so there is always a way round, just out of sight
const map = { c: 16, x0: 0, cols: 0, rows: 0, d: new Float32Array(0), version: 0 };
let W = 0; // viewport width, height, page height (css px)
let VH = 0;
let H = 0;
let scale = 1; // phones fly 0.7× butterflies
let stations = []; // perches in free space down the page, about two per screenful, page px
let sections = []; // [data-scene] sections: { el, name, top, bottom, pair, wake }
let nest = null; // the companion's spot in the hero scene

const page = (r) => [r.left + scrollX, r.top + scrollY, r.right + scrollX, r.bottom + scrollY];
const box = (el) => (el?.getClientRects().length ? el.getBoundingClientRect() : null);

function measure() {
  const root = document.documentElement;
  W = root.clientWidth;
  VH = innerHeight;
  H = root.scrollHeight;
  scale = phone.matches ? 0.7 : 1;
  const rects = [];
  const range = document.createRange();
  for (const el of document.querySelectorAll("main, header, footer")) {
    if (el.parentElement.closest("main, header, footer")) continue;
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      if (!walker.currentNode.data.trim()) continue;
      range.selectNodeContents(walker.currentNode);
      for (const r of range.getClientRects()) rects.push(page(r));
    }
    for (const c of el.querySelectorAll(CONTROLS)) for (const r of c.getClientRects()) rects.push(page(r));
    // cards: painted boxes holding text (not whole bands) keep their middles clear; it may cross a card's edge
    for (const c of el.querySelectorAll("*")) {
      const r = c.getBoundingClientRect();
      if (r.width < 80 || r.height < 60 || (r.width > 0.9 * W && r.height > 0.6 * VH)) continue;
      const style = getComputedStyle(c);
      const painted = style.backgroundImage !== "none" || style.boxShadow !== "none" || !/^(transparent|rgba\(.*,\s*0\))$/.test(style.backgroundColor);
      if (!painted || !c.textContent.trim()) continue;
      const [l, t, rr, b] = page(r);
      const k = Math.min(r.width, r.height) * 0.22;
      rects.push([l + k, t + k, rr - k, b - k]);
    }
  }
  const c = (map.c = phone.matches ? 12 : 16);
  const reachMax = REACH * SP["small-blue"].w * scale;
  map.x0 = -Math.ceil((2.2 * reachMax) / c) * c;
  const cols = (map.cols = Math.ceil((W - 2 * map.x0) / c));
  const rows = (map.rows = Math.ceil(H / c));
  const d = (map.d = new Float32Array(cols * rows).fill(1e6));
  for (const [l, t, r, b] of rects) {
    if (r - l < 1 || b - t < 1) continue;
    const c0 = clamp(Math.floor((l - map.x0) / c), 0, cols - 1);
    const c1 = clamp(Math.floor((r - map.x0) / c), 0, cols - 1);
    for (let y = clamp(Math.floor(t / c), 0, rows - 1); y <= clamp(Math.floor(b / c), 0, rows - 1); y++) d.fill(0, y * cols + c0, y * cols + c1 + 1);
  }
  // two-pass chamfer distance transform
  const D = c * Math.SQRT2;
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const i = y * cols + x;
      let v = d[i];
      if (x > 0) v = Math.min(v, d[i - 1] + c);
      if (y > 0) {
        v = Math.min(v, d[i - cols] + c);
        if (x > 0) v = Math.min(v, d[i - cols - 1] + D);
        if (x < cols - 1) v = Math.min(v, d[i - cols + 1] + D);
      }
      d[i] = v;
    }
  }
  for (let y = rows - 1; y >= 0; y--) {
    for (let x = cols - 1; x >= 0; x--) {
      const i = y * cols + x;
      let v = d[i];
      if (x < cols - 1) v = Math.min(v, d[i + 1] + c);
      if (y < rows - 1) {
        v = Math.min(v, d[i + cols] + c);
        if (x < cols - 1) v = Math.min(v, d[i + cols + 1] + D);
        if (x > 0) v = Math.min(v, d[i + cols - 1] + D);
      }
      d[i] = v;
    }
  }
  map.version++;

  const start = box(document.querySelector("[data-companion-start]"));
  nest = start ? { x: start.left + scrollX + start.width / 2, y: start.top + scrollY + start.height / 2, k: Math.max(0.3, start.width / SP["small-blue"].w) } : null;
  // a section's meeting and its optional partner objects (see the hooks at the top)
  sections = [...document.querySelectorAll("[data-scene]")].flatMap((el) => {
    const r = box(el);
    if (!r) return [];
    const pair = box(el.querySelector("[data-pair]"));
    const pinned = el.querySelector("[data-wake]");
    const wr = box(pinned);
    return [{
      el,
      name: el.dataset.scene,
      top: r.top + scrollY,
      bottom: r.bottom + scrollY,
      pair: pair && { x: pair.left + scrollX + pair.width / 2, y: pair.top + scrollY + pair.height * 0.1, id: SP[el.querySelector("[data-pair]").dataset.pair] ? el.querySelector("[data-pair]").dataset.pair : "cabbage-white" },
      wake: wr && { el: pinned, x: wr.left + scrollX + wr.width / 2, y: wr.top + scrollY + wr.height / 2, id: SP[pinned.dataset.wake] ? pinned.dataset.wake : "cabbage-white", rot: parseFloat(getComputedStyle(pinned.closest("[style]") ?? pinned).rotate) || 0 },
    }];
  });
  for (const s of sections) if (s.wake) s.wake.k = s.wake.el.offsetWidth / SP[s.wake.id].w;

  // stations: down the whole page, every ~0.45 of a screen, the free spot nearest the right margin with the most
  // room around it; a [data-perch] point (a sprig) beats bare paper
  const side = W - reachMax - 12;
  const perches = [...document.querySelectorAll("[data-perch]")].flatMap((el) => {
    const r = box(el);
    if (!r) return [];
    const [fx, fy] = `${el.dataset.perch},`.split(",").map((v) => (v.trim() && isFinite(v) ? +v : 0.5));
    return [{ x: r.left + scrollX + fx * r.width, y: r.top + scrollY + fy * r.height }];
  });
  stations = [];
  const pitch = 0.45 * VH;
  for (let b0 = 0; b0 < H; b0 += pitch) {
    const b1 = Math.min(H, b0 + pitch);
    const anchor = lerp(b0, b1, 0.5);
    let best = null;
    let score = Infinity;
    const consider = (x, y, bonus) => {
      const room = clearance(x, y);
      if (room < reachMax + 8 || x < reachMax + 4 || x > W - reachMax - 4) return;
      const v = Math.abs(x - side) + 0.6 * Math.abs(y - anchor) - 0.8 * Math.min(room, 2.5 * reachMax) - bonus;
      if (v < score) [score, best] = [v, { x, y }];
    };
    for (let y = Math.floor(b0 / c) * c + c / 2; y < b1; y += c) for (let x = map.x0 + c / 2; x < W; x += c) consider(x, y, 0);
    for (const q of perches) if (q.y >= b0 && q.y < b1) consider(q.x, q.y, 160);
    if (best) stations.push(best);
  }
  if (me && !me.station?.kept) me.station = null;
}

/** room around (x, y) in px: the distance to the nearest text, control or card core */
function clearance(x, y) {
  const { c, x0, cols, rows, d } = map;
  if (!cols) return 1e6;
  const gx = clamp((x - x0) / c - 0.5, 0, cols - 1.001);
  const gy = clamp(y / c - 0.5, 0, rows - 1.001);
  const i = Math.floor(gx);
  const j = Math.floor(gy);
  const n = j * cols + i;
  const u = gx - i;
  return lerp(lerp(d[n], d[n + 1], u), lerp(d[n + cols], d[n + cols + 1], u), gy - j) - c / 2;
}
/** unit vector away from the nearest obstacle */
function away(x, y) {
  const c = map.c;
  const gx = clearance(x + c, y) - clearance(x - c, y);
  const gy = clearance(x, y + c) - clearance(x, y - c);
  const len = Math.hypot(gx, gy) || 1;
  return [gx / len, gy / len];
}

// A* over the grid, rows limited to the stretch between the two ends (or [top, bottom]); cells closer to text
// than `need` are walls, cells near it cost more (paths keep to the middle of the margins) and so do cells off
// screen. Returns the path pulled taut into a few corners, ending at (bx, by), or null.
let scratch = { n: 0 };
function plan(ax, ay, bx, by, need, top, bottom) {
  const { c, x0, cols, rows, d } = map;
  if (!cols) return null;
  const pad = Math.max(4 * need, 0.4 * VH);
  const r0 = clamp(Math.floor((top ?? Math.min(ay, by) - pad) / c), 0, rows - 1);
  const r1 = clamp(Math.floor((bottom ?? Math.max(ay, by) + pad) / c), r0, rows - 1);
  const n = (r1 - r0 + 1) * cols;
  if (scratch.n < n) scratch = { n, g: new Float64Array(n), f: new Float64Array(n), from: new Int32Array(n), seen: new Uint8Array(n) };
  const { g, f, from, seen } = scratch;
  g.fill(Infinity, 0, n);
  seen.fill(0, 0, n);
  const cell = (x, y) => (clamp(Math.floor(y / c), r0, r1) - r0) * cols + clamp(Math.floor((x - x0) / c), 0, cols - 1);
  const room = (i) => d[i + r0 * cols] - c / 2;
  const cx = (i) => x0 + ((i % cols) + 0.5) * c;
  const cy = (i) => (Math.floor(i / cols) + r0 + 0.5) * c;
  const s = cell(ax, ay);
  const e = cell(bx, by);
  // taking off from (or landing at) a tight spot it may pass close to text near its ends, never elsewhere
  const loose = Math.min(need, room(s), room(e), clearance(ax, ay), clearance(bx, by)) - 2;
  const near = (x, y) => Math.hypot(x - ax, y - ay) < 3 * need || Math.hypot(x - bx, y - by) < 3 * need;
  const open = (i) => room(i) >= need || (room(i) >= loose && near(cx(i), cy(i)));
  const heap = [s];
  g[s] = 0;
  f[s] = 0;
  from[s] = -1;
  let found = false;
  let budget = 40000;
  while (heap.length && budget--) {
    // pop the lowest f
    const i = heap[0];
    const last = heap.pop();
    if (heap.length) {
      heap[0] = last;
      for (let k = 0; ; ) {
        const l = 2 * k + 1;
        if (l >= heap.length) break;
        const m = l + 1 < heap.length && f[heap[l + 1]] < f[heap[l]] ? l + 1 : l;
        if (f[heap[m]] >= f[heap[k]]) break;
        [heap[k], heap[m]] = [heap[m], heap[k]];
        k = m;
      }
    }
    if (seen[i]) continue;
    seen[i] = 1;
    if (i === e) {
      found = true;
      break;
    }
    const col = i % cols;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const col2 = col + dx;
        const j = i + dy * cols + dx;
        if (col2 < 0 || col2 >= cols || j < 0 || j >= n || seen[j] || !open(j)) continue;
        if (dx && dy && (!open(i + dx) || !open(i + dy * cols))) continue;
        const x = cx(j);
        const cost = (dx && dy ? Math.SQRT2 : 1) * c * (1 + 1.5 * Math.max(0, 1 - (room(j) - need) / need) + (x < 0 || x > W ? 0.8 : 0));
        if (g[i] + cost >= g[j]) continue;
        g[j] = g[i] + cost;
        from[j] = i;
        const hx = Math.abs(x - bx);
        const hy = Math.abs(cy(j) - by);
        f[j] = g[j] + 1.2 * (Math.max(hx, hy) + (Math.SQRT2 - 1) * Math.min(hx, hy));
        heap.push(j);
        for (let k = heap.length - 1; k > 0; ) {
          const p = (k - 1) >> 1;
          if (f[heap[p]] <= f[heap[k]]) break;
          [heap[k], heap[p]] = [heap[p], heap[k]];
          k = p;
        }
      }
    }
  }
  if (!found) return null;
  const cells = [];
  for (let i = from[e]; i !== -1 && i !== s; i = from[i]) cells.push([cx(i), cy(i)]);
  const pts = [[ax, ay], ...cells.reverse(), [bx, by]];
  // pull taut: keep a corner only where the straight line to the next one would pass too close to text
  const clear = (p, q) => {
    const len = Math.hypot(q[0] - p[0], q[1] - p[1]);
    for (let t = 0; t <= len; t += c / 2) {
      const x = p[0] + ((q[0] - p[0]) * t) / len;
      const y = p[1] + ((q[1] - p[1]) * t) / len;
      const r = clearance(x, y);
      if (r < need && !(r >= loose && near(x, y))) return false;
    }
    return true;
  };
  const out = [];
  let a = 0;
  while (a < pts.length - 1) {
    let b = a + 1;
    while (b + 1 < pts.length && clear(pts[a], pts[b + 1])) b++;
    out.push(pts[b]);
    a = b;
  }
  return out;
}

// ---------------------------------------------------------------- flight

const reach = (a) => REACH * a.w * a.k;
const vmax = (a) => VMAX * a.w * a.kb;
let view = 0; // scroll position this frame
/** most of it inside the screen */
const shown = (a, m = 0.3 * a.w * a.k) => a.x > m && a.x < W - m && a.y > view + m && a.y < view + VH - m;
/** none of it inside the screen */
const gone = (a) => {
  const r = 0.55 * a.w * a.k;
  return a.x < -r || a.x > W + r || a.y < view - r || a.y > view + VH + r;
};

function launch(a) {
  a.mode = "takeoff";
  a.mt = 0;
  a.vy -= 1.1 * a.w * a.kb;
  a.path = null;
}

/** one fixed physics step toward the flyer's goal */
function physics(a) {
  const w = a.w * a.kb;
  const goal = a.goal;
  a.mt += DT;
  if (!goal) return;
  const left = Math.hypot(goal.x - a.x, goal.y - a.y);
  if (a.mode === "perch" || a.mode === "flare" || a.mode === "settle") {
    if (left > 0.25 * w) launch(a);
    else {
      a.vx = a.vy = 0;
      if (a.mode !== "perch") {
        a.x += (goal.x - a.x) * Math.min(1, DT * 10);
        a.y += (goal.y - a.y) * Math.min(1, DT * 10);
      }
      if (a.mode === "flare" && a.mt > 0.17) [a.mode, a.mt] = ["settle", 0];
      if (a.mode === "settle" && a.mt > 0.25) {
        [a.mode, a.mt] = ["perch", 0];
        a.perchAt = { bask: rand(1.2, 3), shift: rand(2.5, 6) };
      }
      return;
    }
  }
  if (a.mode === "takeoff" && a.mt > 0.3) [a.mode, a.mt] = ["fly", 0];
  if (goal.perch && a.mode === "fly" && left < 0.18 * w) [a.mode, a.mt] = ["hover", 0];
  if (a.mode === "hover") {
    if (left > 0.6 * w || !goal.perch) a.mode = "fly";
    else if (a.mt > 0.3 && left < 0.08 * w) {
      [a.mode, a.mt] = ["flare", 0];
      return;
    }
  }

  // the path: planned when the goal moves or the page changes
  if (goal.route) {
    if (a.path !== goal.route) [a.path, a.pi] = [goal.route, 0];
  } else if (goal.plan) {
    if (a.version !== map.version || !a.planned || Math.hypot(a.planned.x - goal.x, a.planned.y - goal.y) > map.c) {
      // a meeting's arrivals keep to the rows on screen when they can
      a.path = (goal.onscreen && plan(a.x, a.y, goal.x, goal.y, reach(a), view + 0.3 * a.w * a.k, view + VH - 0.3 * a.w * a.k)) || plan(a.x, a.y, goal.x, goal.y, reach(a));
      a.pi = 0;
      a.version = map.version;
      a.planned = { x: goal.x, y: goal.y };
    }
  } else a.path = null;
  let tx = goal.x;
  let ty = goal.y;
  if (a.path) {
    const look = Math.max(0.6 * w, 0.3 * Math.hypot(a.vx, a.vy));
    while (a.pi < a.path.length - 1 && Math.hypot(a.path[a.pi][0] - a.x, a.path[a.pi][1] - a.y) < look) a.pi++;
    if (a.pi < a.path.length - 1 || goal.route) [tx, ty] = a.path[a.pi];
  }

  // seek and arrive, the heading wandering to either side in little zig-zags (less near text and when landing)
  const brake = goal.perch ? clamp(left / (2.4 * w), 0.12, 1) : clamp(left / (1.2 * w), 0, 1);
  let speed = CRUISE * w * (goal.speed ?? 1) * brake;
  if (a.mode === "hover") speed = Math.min(speed, left * 5);
  let dx = tx - a.x;
  let dy = ty - a.y;
  const dl = Math.hypot(dx, dy) || 1;
  const room = clamp((clearance(a.x, a.y) - reach(a)) / reach(a), 0, 1);
  const zig = a.mode === "fly" && left > 1.5 * w ? a.zig * room : 0;
  [dx, dy] = [(dx * Math.cos(zig) - dy * Math.sin(zig)) / dl, (dx * Math.sin(zig) + dy * Math.cos(zig)) / dl];
  let ax = dx * speed - a.vx;
  let ay = dy * speed - a.vy;
  const lim = ACCEL * w * (a.glide ? 0.4 : 1) * DT;
  const am = Math.hypot(ax, ay);
  if (am > lim) [ax, ay] = [(ax * lim) / am, (ay * lim) / am];
  a.vx += ax;
  a.vy += ay;
  a.vy += SINK * w * DT;

  // never into text: whatever would take it closer than its reach slides along the edge instead
  const near = Math.hypot(goal.x - a.x, goal.y - a.y) < 2 * reach(a) || a.mode === "takeoff";
  const keep = near ? Math.min(reach(a), clearance(goal.x, goal.y) - 2, clearance(a.x, a.y)) : reach(a);
  const here = clearance(a.x, a.y);
  if (clearance(a.x + a.vx * DT, a.y + a.vy * DT) < Math.min(keep, here + 0.01)) {
    const [gx, gy] = away(a.x, a.y);
    const into = a.vx * gx + a.vy * gy;
    if (into < 0) [a.vx, a.vy] = [a.vx - into * gx, a.vy - into * gy];
  }
  const v = Math.hypot(a.vx, a.vy);
  const cap = (VMAX - 0.7) * w;
  if (v > cap) [a.vx, a.vy] = [(a.vx * cap) / v, (a.vy * cap) / v];
  a.x += a.vx * DT;
  a.y += a.vy * DT;

  // the body heads along its velocity and banks into turns
  if (v > 0.3 * w) {
    const want = Math.atan2(a.vx, -a.vy) / DEG;
    const step = clamp(turnTo(a.hd, want), -540 * DT, 540 * DT);
    a.hd += step;
    a.turn += (step / DT - a.turn) * Math.min(1, DT * 8);
  } else a.turn *= 1 - Math.min(1, DT * 8);
  a.bank += (clamp(a.turn * 0.1, -28, 28) - a.bank) * Math.min(1, DT * 10);

  // zig-zags and the flutter-and-glide gait
  if ((a.zigT -= DT) <= 0) {
    a.zigTo = (a.zigTo > 0 ? -1 : 1) * rand(10, 30) * DEG;
    a.zigT = rand(0.25, 0.7);
  }
  a.zig += (a.zigTo - a.zig) * Math.min(1, DT * 6);
  const climbing = a.vy < -0.35 * CRUISE * w;
  const hard = Math.abs(a.turn) > 150;
  const must = a.mode !== "fly" || climbing || hard || v < 0.5 * CRUISE * w;
  a.gaitT -= DT;
  if (a.glide ? a.gaitT <= 0 || must : a.gaitT <= 0) {
    a.glide = !a.glide && !must && random() < (a.vy > 0.2 * CRUISE * w ? 0.85 : 0.55);
    a.gaitT = a.glide ? rand(0.2, 0.5) : rand(0.35, 0.9);
  }
  a.gait = a.mode === "takeoff" || climbing || hard ? "fast" : a.mode === "hover" ? "slow" : "cruise";
}

/** a held frame: run the physics, then pose the wings, the body and the shadow */
function step(a) {
  const w = a.w * a.kb;
  const flapping = a.mode === "fly" || a.mode === "takeoff" || a.mode === "hover";
  // each downstroke (the frame the wings come down) lifts it: on average just what a glide sinks, so flapping
  // holds it up and the steering does the rest
  if (flapping && !a.glide) {
    const beat = BEATS[a.gait];
    a.beat = (a.beat + 1) % beat.length;
    if (beat[a.beat] < beat[(a.beat + beat.length - 1) % beat.length]) a.vy -= (SINK * w * beat.length * FRAME) / 1000;
  }
  for (let i = 0; i < SUB; i++) physics(a);
  const beat = BEATS[a.gait];
  const up = flapping && !a.glide ? beat[a.beat % beat.length] : 0;
  if (a.mode === "perch") {
    // basking: the wings close slowly after landing, then open and close now and then; it shifts and turns
    const at = a.perchAt;
    at.bask -= FRAME / 1000;
    at.shift -= FRAME / 1000;
    if (at.wingTo === undefined) at.wingTo = 72;
    if (at.bask <= 0) [at.wingTo, at.bask] = [at.wingTo > 36 ? rand(0, 14) : 72, rand(1.6, 4.5)];
    if (at.shift <= 0) [at.hdTo, at.shift] = [a.hd + (random() < 0.5 ? -1 : 1) * rand(10, 26), rand(3, 7)];
    a.wing += clamp(at.wingTo - a.wing, -22, 22);
    if (at.hdTo !== undefined) a.hd += clamp(turnTo(a.hd, at.hdTo), -9, 9);
    a.lift = 0;
  } else if (a.mode === "flare") {
    a.wing = 0;
    a.lift = 0.3;
  } else if (a.mode === "settle") {
    a.wing = 18;
    a.lift = Math.max(0, a.lift - 0.12);
  } else {
    a.wing = a.glide ? 8 : up * (a.gait === "fast" ? 78 : 68) + 4;
    a.lift = Math.min(1, a.lift + 0.25) * (a.glide ? 0.9 : 1) - 0.06 * up;
  }
  const kTo = (a.goal?.k ?? a.kb) * (a.mode === "flare" ? 1.05 : 1);
  a.k += (kTo - a.k) * 0.35;
  a.rot = a.hd + a.bank * 0.4;
  // drawn: the body dips as the wings rise; never faster than VMAX, however the physics and the bob add up
  let px = a.x;
  let py = a.y + 0.045 * w * up;
  const most = (vmax(a) * FRAME) / 1000;
  const moved = Math.hypot(px - a.px, py - a.py);
  if (moved > most && a.px > -999) [px, py] = [a.px + ((px - a.px) * most) / moved, a.py + ((py - a.py) * most) / moved];
  a.px = px;
  a.py = py;
}

/** puts a flyer at (x, y) at once: only for spawning, and for the companion while it is out of sight */
function place(a, x, y) {
  Object.assign(a, { x, y, px: x, py: y, path: null });
}

// ---------------------------------------------------------------- the companion itself

const me = actor("small-blue", 1, true);
let state = "scene"; // scene | out | home
let grow = 1; // 0 → 1 while it pops out of the scene
let shrink = 0; // 0 → 1 while it settles back into it
let eased = 0; // scroll position with a little lag
let running = false;
let reentered = null; // where it came back in this frame, if it did

/** the station beside what the reader is reading: the reading line ~45% down the screen, with hysteresis */
function pick() {
  const line = eased + 0.45 * VH;
  const m = Math.min(reach(me) + 24, VH * 0.2);
  const inside = (s) => s.y > eased + m && s.y < eased + VH - m;
  let best = null;
  let score = Infinity;
  for (const s of stations) {
    const v = Math.abs(s.y - line);
    if (inside(s) && v < score) [score, best] = [v, s];
  }
  const cur = me.station;
  if (cur && inside(cur) && (!best || Math.abs(cur.y - line) < score + 0.25 * VH)) return cur;
  if (best) return best;
  for (const s of stations) {
    const v = Math.abs(s.y - line);
    if (v < score) [score, best] = [v, s];
  }
  return best;
}

/** out of sight above or below the screen, on its way to somewhere on it: it comes in at the edge it would cross */
function reenter() {
  const g = me.goal;
  const r = 0.55 * me.w * me.k;
  if (!g || !gone(me) || g.y < view || g.y > view + VH) return;
  // well past the edge (a fling): a little lag behind a fast scroll it simply flies off and back
  const above = me.y < view - r - 0.3 * VH;
  const below = me.y > view + VH + r + 0.3 * VH;
  if (!above && !below) return;
  const y = above ? view - r : view + VH + r;
  const cross = me.x + ((g.x - me.x) * (y - me.y)) / (g.y - me.y || 1);
  let x = null;
  for (let off = 0; off < W && x === null; off += map.c) {
    for (const cand of [cross - off, cross + off]) if (x === null && clearance(cand, y) >= reach(me)) x = cand;
  }
  x ??= cross < W / 2 ? -r : W + r;
  const speed = Math.hypot(me.vx, me.vy);
  const len = Math.hypot(g.x - x, g.y - y) || 1;
  place(me, x, y);
  [me.vx, me.vy] = [((g.x - x) / len) * speed, ((g.y - y) / len) * speed];
  if (me.mode !== "fly" && me.mode !== "takeoff") me.mode = "fly";
  reentered = { x, y };
}

function setState(next) {
  state = next;
  const start = document.querySelector("[data-companion-start]");
  if (next === "scene") {
    me.op = 0;
    me.goal = null;
    draw(me);
    if (start) start.hidden = false;
    return;
  }
  if (next === "out" && grow >= 1 && me.op === 0) {
    // out of the scene toward the reader: it grows past full size, settles, and its paper border fades in
    if (!nest) return setState("scene");
    place(me, nest.x, nest.y);
    Object.assign(me, { k: nest.k, kb: scale, op: 1, torn: 0, wing: 0, vx: 0, vy: -1.6 * me.w * scale, hd: 0, mode: "takeoff", mt: 0 });
    grow = 0;
    // hidden tells garden.js to stop flying the scene's copy; it keeps its box (style.css) for the way home
    if (start) start.hidden = true;
  }
  run();
}

/** the companion's goal when no meeting holds it */
function steer() {
  if (state === "home") {
    if (!nest) return setState("scene");
    me.goal = { x: nest.x, y: nest.y, plan: true };
    if (Math.hypot(nest.x - me.x, nest.y - me.y) < 0.12 * me.w * me.kb && Math.hypot(me.vx, me.vy) < 1.5 * me.w) shrink = Math.max(shrink, 0.01);
    return;
  }
  const s = pick();
  if (!s) return;
  if (s !== me.station) {
    // a new target only once it has held for two frames (a fling passes through many)
    if (me.next !== s) [me.next, me.held] = [s, 0];
    if (++me.held < 2 && me.station) return;
    me.station = s;
  }
  me.goal = { x: me.station.x, y: me.station.y, perch: true, plan: true, k: me.station.k };
}

// ---------------------------------------------------------------- the meetings, in free space on screen

const done = new Set();
let scene = null; // { name, cast, phase: arrive | meet | wrap, box, cause, f, step }
let visitors = []; // partners that stayed (the pair's visitor on its [data-pair])
let tried = 0; // frames until the next try at a meeting that found no room

function spawn(id, k, x, y) {
  const a = actor(id, k * scale);
  place(a, x, y);
  a.hd = a.rot = x < W / 2 ? 90 : -90;
  return a;
}
/** just past the nearer side of the screen, level with y */
const edge = (a, x, y) => ({ x: x < W / 2 ? -0.6 * a.w * a.k : W + 0.6 * a.w * a.k, y });
/** the free spot in [x0, x1] × [y0, y1] (page px) with `room` around it and the lowest score(x, y) */
function spot(x0, y0, x1, y1, room, score) {
  let best = null;
  let low = Infinity;
  const c = map.c * (phone.matches ? 1 : 2);
  for (let y = Math.max(y0, 0); y <= y1; y += c) {
    for (let x = Math.max(x0, 0); x <= Math.min(x1, W); x += c) {
      if (clearance(x, y) < room) continue;
      const v = score(x, y);
      if (v < low) [low, best] = [v, { x, y }];
    }
  }
  return best;
}
/** how far up from (x, y) the free space keeps `room` around a rising butterfly, at most `most` */
function headroom(x, y, room, most) {
  let h = 0;
  while (h < most && clearance(x, y - h - map.c) >= room) h += map.c;
  return h;
}
/** the screen minus a margin, page coordinates */
const screen = (m) => [m, view + m, W - m, view + VH - m];
/** the meeting's points [x0, y0, x1, y1] all on screen, most of each butterfly with them */
const inBox = (b, m = 0.3 * me.w * scale) => b[0] >= m && b[2] <= W - m && b[1] >= view + m && b[3] <= view + VH - m;
const near = (x, y) => Math.hypot(x - me.x, y - me.y);

/** two butterflies circling each other around `at`, rising by `climb` over `frames`; returns true when done */
function circle(a, b, at, rad, climb, u) {
  const th = u * Math.PI * 4.4;
  const r = lerp(rad, rad * 0.7, u);
  const cy = at.y - climb * ease(u);
  a.goal = { x: at.x - r * Math.cos(th), y: cy - 0.55 * r * Math.sin(th), speed: 1.3 };
  b.goal = { x: at.x + r * Math.cos(th), y: cy + 0.55 * r * Math.sin(th), speed: 1.3, k: b.goal?.k };
  return u >= 1;
}
/** a partner comes in from the nearer side of the screen, level with y */
function visitor(id, k, x, y) {
  const a = spawn(id, k, 0, 0);
  const from = edge(a, x, y);
  place(a, from.x, from.y);
  return a;
}
/** a free spot on screen for two to circle each other (rising as far as the space allows, up to `most`) */
function arena(rad, most, prefer = near) {
  const room = rad + reach(me) * 0.9;
  const [x0, y0, x1, y1] = screen(rad + reach(me));
  let climb = 0;
  const at = spot(x0, y0 + 0.5 * rad, x1, y1, room, (x, y) => {
    const h = headroom(x, y, room, Math.min(most, y - y0));
    return h < 0.3 * most ? Infinity : prefer(x, y) - 1.2 * h;
  });
  if (at) climb = headroom(at.x, at.y, room, Math.min(most, at.y - y0));
  return at && { ...at, climb };
}

const SCENES = {
  /** two small butterflies spiral up together (the courtship flight) */
  spiral() {
    const rad = 0.42 * me.w * scale;
    const at = arena(rad, Math.min(0.28 * VH, 2.6 * me.w * scale));
    if (!at) return null;
    const other = visitor("brimstone", 0.72, at.x, at.y + rand(-40, 40));
    return {
      cast: [me, other],
      box: [at.x - rad, at.y - at.climb - 0.55 * rad, at.x + rad, at.y + 0.55 * rad],
      step(f) {
        if (this.phase === "arrive") {
          me.goal = { x: at.x - rad, y: at.y, plan: true, onscreen: true };
          other.goal = { x: at.x + rad, y: at.y, plan: true, onscreen: true };
          const ready = (a) => Math.hypot(a.goal.x - a.x, a.goal.y - a.y) < 0.35 * a.w * a.k;
          if ((ready(me) && ready(other)) || f > 60) [this.phase, this.f0] = ["meet", f];
          return;
        }
        if (circle(me, other, at, rad, at.climb, (f - this.f0) / 36)) return "done";
      },
    };
  },
  /** a peacock comes in past the companion and crosses the screen through free space; it gives chase along its trail */
  chase() {
    const lead = spawn("peacock", 0.7, 0, 0);
    const fromLeft = me.x < W / 2;
    // the whole route well inside the top and bottom of the screen (a flutter strays a little), wide enough for
    // the companion behind it
    const m = me.w * scale;
    const y = clamp(me.y - rand(40, 140), view + m, view + VH - m);
    const r = 0.6 * lead.w * lead.k;
    const a = [fromLeft ? -r : W + r, y];
    const b = [fromLeft ? W + r : -r, clamp(y + rand(-90, 90), view + m, view + VH - m)];
    const route = plan(a[0], a[1], b[0], b[1], reach(me), view + m, view + VH - m);
    let length = 0;
    route?.reduce((p, q) => ((length += Math.hypot(q[0] - p[0], q[1] - p[1])), q), a);
    if (!route || length > 1.8 * W + VH) {
      drop(lead);
      return null;
    }
    place(lead, ...a);
    const trail = [];
    const ys = route.map((p) => p[1]).concat(a[1]);
    return {
      cast: [me, lead],
      box: [W / 2, Math.min(...ys), W / 2, Math.max(...ys)],
      step(f) {
        lead.goal = { x: b[0], y: b[1], route, speed: 1.15 };
        trail.push({ x: lead.x, y: lead.y });
        if (this.phase === "arrive") {
          if (shown(lead)) [this.phase, this.f0, this.from] = ["meet", f, trail.length - 1];
          if (f > 50) return "done";
          return;
        }
        // the companion follows half a second behind, along the very same free path (from where it came on screen)
        const p = trail[Math.max(this.from, trail.length - 6)];
        me.goal = { x: p.x, y: p.y, speed: 1.25 };
        // it breaks off before the far edge; the peacock flies on out of sight
        if (Math.hypot(b[0] - lead.x, b[1] - lead.y) < 2.2 * lead.w * lead.k || !shown(lead) || f - this.f0 > 90) return "done";
      },
    };
  },
  /** the companion and a visitor land side by side on the section's [data-pair] (the visitor stays there, just
   *  paper now), or on bare paper in free space (and the visitor flies on after a moment) */
  pair(section) {
    const w = me.w * scale;
    const fits = (x, y, id, k) => clearance(x, y) >= REACH * SP[id].w * k * 0.9;
    const id = section.pair?.id ?? "cabbage-white";
    let base = section.pair;
    if (base && !(fits(base.x - 0.21 * w, base.y - 0.05 * w, "small-blue", 0.78 * scale) && fits(base.x + 0.21 * w, base.y + 0.15 * w, id, 0.66 * scale))) base = null;
    if (!base) {
      const [x0, y0, x1, y1] = screen(0.5 * w);
      base = spot(x0, y0, x1, y1, 0, (x, y) => (fits(x - 0.21 * w, y - 0.05 * w, "small-blue", 0.78 * scale) && fits(x + 0.21 * w, y + 0.15 * w, id, 0.66 * scale) ? near(x, y) : Infinity));
      if (!base) return null;
    }
    const stay = base === section.pair;
    const mine = { x: base.x - 0.21 * w, y: base.y - 0.05 * w, k: 0.78 * scale };
    const theirs = { x: base.x + 0.21 * w, y: base.y + 0.15 * w, k: 0.66 * scale };
    const b = [mine.x, mine.y, theirs.x, theirs.y];
    if (!inBox(b)) return null;
    const other = visitor(id, 0.66, theirs.x, theirs.y - rand(60, 120));
    return {
      cast: [me, other],
      box: b,
      step(f) {
        if (this.landed === undefined) {
          me.goal = { ...mine, perch: true, plan: true, onscreen: true };
          other.goal = { ...theirs, perch: true, plan: true, onscreen: true };
        }
        if (this.phase === "arrive" && shown(other)) this.phase = "meet";
        if (this.landed === undefined && me.mode === "perch" && other.mode === "perch") {
          this.landed = f;
          me.station = { x: mine.x, y: mine.y, k: mine.k, kept: true };
          if (stay) {
            // the visitor stays on the sprig, wings open: just paper now
            Object.assign(other, { wing: 0, bank: 0, pair: section });
            draw(other);
            visitors.push(other);
            return "stay";
          }
        }
        if (this.landed !== undefined && f - this.landed > 18) return "done";
        if (f > 120) return "done";
      },
    };
  },
  /** the companion lands beside the section's pinned [data-wake] specimen, which wakes, lets go of its pin and
   *  flies off with it; without one, a visitor comes in and they circle each other before it leaves */
  wake(section) {
    const w = me.w * scale;
    const pin = section.wake && shown(section.wake, 0.3 * w) ? section.wake : null;
    const [x0, y0, x1, y1] = screen(reach(me));
    const inside = (x, y) => x > x0 && x < x1 && y > y0 && y < y1;
    const rad = 0.55 * w;
    const swirl = arena(rad, 0.9 * w, pin ? (x, y) => Math.hypot(x - pin.x, y - pin.y + 1.5 * w) : near);
    const beside = pin && spot(pin.x - 2.5 * w, pin.y - 1.5 * w, pin.x + 2.5 * w, pin.y + 1.5 * w, reach(me), (x, y) => (inside(x, y) && Math.hypot(x - pin.x, y - pin.y) > 0.6 * w ? Math.hypot(x - pin.x + 0.8 * w, y - pin.y) : Infinity));
    if (!swirl || (pin && !beside)) return null;
    const pts = pin ? [beside, pin] : [];
    const b = [Math.min(swirl.x - rad, ...pts.map((p) => p.x)), Math.min(swirl.y - swirl.climb - 0.55 * rad, ...pts.map((p) => p.y)), Math.max(swirl.x + rad, ...pts.map((p) => p.x)), Math.max(swirl.y + 0.55 * rad, ...pts.map((p) => p.y))];
    if (!inBox(b)) return null;
    let other = pin ? null : visitor("cabbage-white", 0.7, swirl.x, swirl.y);
    return {
      cast: other ? [me, other] : [me],
      box: b,
      step(f) {
        if (this.phase === "arrive") {
          if (!pin) {
            me.goal = { x: swirl.x - rad, y: swirl.y, plan: true, onscreen: true };
            other.goal = { x: swirl.x + rad, y: swirl.y, plan: true, onscreen: true };
            const ready = (a) => Math.hypot(a.goal.x - a.x, a.goal.y - a.y) < 0.4 * a.w * a.k;
            if ((ready(me) && ready(other)) || f > 60) [this.phase, this.f0] = ["meet", f - 22];
            return;
          }
          me.goal = { ...beside, perch: true, plan: true, onscreen: true };
          if (me.mode === "perch") [this.phase, this.f0] = ["meet", f];
          if (f > 120) return "done";
          return;
        }
        const t = f - this.f0;
        if (pin && t === 10) {
          // it wakes where it was pinned: the paper specimen becomes a flyer in the same place
          other = spawn(pin.id, 1, pin.x, pin.y);
          Object.assign(other, { k: pin.k, kb: pin.k, hd: pin.rot, rot: pin.rot, mode: "perch", perchAt: { bask: 0.2, shift: 9, wingTo: 0 }, born: "pin" });
          other.goal = { x: pin.x, y: pin.y, perch: true, k: pin.k };
          pin.el.style.visibility = "hidden";
          this.cast.push(other);
        }
        // up and round each other, then off
        if (t >= 22) other.goal = { ...other.goal, k: 0.7 * scale };
        if (t >= 22 && circle(me, other, swirl, rad, swirl.climb, (t - 22) / 30)) return "done";
      },
    };
  },
  /** at the close, the companion and a small group rise together through free space and the others fly away
   *  into the distance (smaller and smaller, then gone) */
  liftoff(section) {
    const w = me.w * scale;
    const room = 1.1 * reach(me);
    const side = 0.75 * reach(me) * 0.62;
    const [x0, y0, x1, y1] = screen(1.2 * w);
    const most = Math.min(0.3 * VH, 2.4 * w);
    const top = Math.max(y0, section.top);
    let climb = 0;
    const at = spot(x0, top, x1, Math.min(y1, section.bottom - 0.4 * w), room, (x, y) => {
      if (clearance(x - 0.9 * w, y) < side || clearance(x + 0.9 * w, y) < side) return Infinity;
      return 0.5 * Math.abs(x - me.x) + Math.abs(y - view - 0.8 * VH) - 1.5 * headroom(x, y, room, Math.min(most, y - top));
    });
    if (!at) return null;
    climb = headroom(at.x, at.y, room, Math.min(most, at.y - top));
    const crew = ["morpho", "cabbage-white"].map((id, i) => {
      const a = spawn(id, 0.62, 0, 0);
      place(a, i ? W + 0.6 * a.w * a.k : -0.6 * a.w * a.k, at.y + rand(-30, 30));
      return a;
    });
    return {
      cast: [me, ...crew],
      box: [at.x - 0.9 * w, at.y - climb - 0.6 * w, at.x + 0.9 * w, at.y + 0.3 * w],
      step(f) {
        if (this.phase === "arrive") {
          me.goal = { x: at.x, y: at.y, plan: true, onscreen: true };
          crew.forEach((a, i) => (a.goal = { x: at.x + (i ? 0.9 : -0.9) * w, y: at.y + 10, plan: true, onscreen: true }));
          const ready = this.cast.every((a) => Math.hypot(a.goal.x - a.x, a.goal.y - a.y) < 0.5 * a.w * a.k);
          if (ready || f > 50) [this.phase, this.f0] = ["meet", f];
          return;
        }
        const u = (f - this.f0) / 36;
        const cy = at.y - climb * ease(u);
        me.goal = { x: at.x + 0.25 * w * Math.sin(u * 7), y: cy, speed: 1.2 };
        crew.forEach((a, i) => {
          const th = u * 5 + (i ? 0 : Math.PI); // each starts from the side it came in on
          a.kb = a.k = lerp(0.62 * scale, 0.2 * scale, ease(u));
          a.goal = { x: at.x + 0.8 * w * Math.cos(th) * (1 - 0.5 * u), y: cy - 0.3 * w * u + 0.25 * w * Math.sin(th), speed: 1.2, k: a.kb };
          if (u > 0.8) a.op = Math.max(0, (1 - u) * 5);
        });
        if (u >= 1) {
          crew.forEach((a) => (a.op = 0));
          return "done";
        }
      },
    };
  },
};

/** the reader scrolled away mid-meeting (or it ended): the others fly off together through the nearer side */
function wrap(cause) {
  scene.phase = "wrap";
  scene.cause = cause;
  for (const a of scene.cast) {
    if (a === me || visitors.includes(a) || a.op === 0) continue;
    const out = edge(a, a.x, clamp(a.y, view + reach(a), view + VH - reach(a)));
    a.goal = { ...out, plan: true, onscreen: true, speed: 1.1 };
    if (a.mode !== "fly") launch(a);
  }
}

function meetings() {
  if (scene) {
    const f = ++scene.f;
    if (scene.phase !== "wrap") {
      // everything happens on screen: if the reader scrolls the meeting out of view it wraps up
      if (!inBox(scene.box)) wrap("scroll");
      else {
        const end = scene.step(f);
        if (end === "stay") scene.cast = scene.cast.filter((a) => a === me || !visitors.includes(a));
        if (end) wrap(end);
      }
    }
    if (scene.phase === "wrap") {
      scene.cast = scene.cast.filter((a) => {
        if (a === me || (a.op > 0 && !gone(a))) return true;
        drop(a);
        return false;
      });
      if (scene.cast.length === 1) scene = null;
    }
    return;
  }
  // a meeting starts only while the reader lingers, with the companion on screen
  if (state !== "out" || grow < 1 || !shown(me, 0.5 * me.w * me.k) || Math.abs(view - eased) > 0.02 * VH || --tried > 0) return;
  for (const s of sections) {
    if (done.has(s.el) || !SCENES[s.name]) continue;
    // most of its section on screen (all of the closing sky for the lift-off)
    const seen = Math.min(s.bottom, view + VH) - Math.max(s.top, view);
    const want = s.name === "liftoff" ? 0.9 : 0.35;
    if (seen < Math.min(want * (s.bottom - s.top), (want + 0.15) * VH)) continue;
    const made = SCENES[s.name](s);
    // no room on screen right now: look again in half a second
    if (!made) {
      tried = 6;
      continue;
    }
    done.add(s.el);
    scene = Object.assign(made, { name: s.name, phase: "arrive", f: 0 });
    for (const a of scene.cast) if (a !== me) draw(a);
    return;
  }
}

// ---------------------------------------------------------------- the frame

const samples = debug ? [] : null;
function frame() {
  const more = advance();
  if (samples) samples.push(sample());
  return more;
}
function advance() {
  view = scrollY;
  if (state === "scene") {
    if (view > 24 && !still()) setState("out");
    if (state === "scene") return false;
  }
  eased += (view - eased) * 0.35;
  reentered = null;
  if (state === "out" && view < 4 && !scene) state = "home";
  if (state === "home" && view > 24) [state, shrink] = ["out", 0];
  meetings();
  const held = scene && scene.phase !== "wrap" && scene.cast.includes(me);
  if (!held) steer();
  if (!held && state !== "scene") reenter();
  if (state === "out" && grow >= 1) me.torn = Math.min(1, me.torn + 0.2);

  step(me);
  if (grow < 1) {
    grow = Math.min(1, grow + 1 / 10);
    me.k = lerp(nest.k, me.kb, ease(grow)) + Math.sin(grow * Math.PI) * 0.25 * me.kb;
    me.torn = ease((grow - 0.4) / 0.5);
  }
  if (shrink > 0) {
    // back into the scene: it hovers over its spot, shrinks into the park and its paper border fades away
    shrink = Math.min(1, shrink + 1 / 8);
    me.k = lerp(me.kb, nest.k, ease(shrink));
    me.torn = 1 - ease(shrink * 1.4);
    me.px = me.x = lerp(me.x, nest.x, 0.5);
    me.py = me.y = lerp(me.y, nest.y, 0.5);
    if (shrink >= 1) {
      shrink = 0;
      setState("scene");
      return false;
    }
  }
  draw(me);
  for (const a of scene?.cast ?? []) {
    if (a === me) continue;
    step(a);
    draw(a);
  }
  // nothing left to show: rest until the page scrolls again
  return !(me.mode === "perch" && gone(me) && !scene);
}
function run() {
  if (running || still() || debug) return;
  running = true;
  tick(() => {
    const more = frame() !== false;
    if (!more) running = false;
    return more;
  });
}

function sample() {
  const fly = (a) => ({ gx: a.goal?.x, gy: a.goal?.y, id: a.id, x: +a.px.toFixed(2), y: +a.py.toFixed(2), k: +a.k.toFixed(3), w: a.w * a.k, vmax: vmax(a), mode: a.mode, op: a.op, born: a.born });
  return {
    sy: view,
    state,
    out: state !== "scene" && me.op > 0,
    reentered,
    scene: scene && { name: scene.name, phase: scene.phase, cause: scene.cause },
    cast: [fly(me), ...(scene?.cast ?? []).filter((a) => a !== me).map(fly)],
    visitors: visitors.map(fly),
  };
}

// ---------------------------------------------------------------- wiring

function onScroll() {
  if (still() || debug) return;
  if (state === "scene" && scrollY > 24) setState("out");
  else if (state !== "scene") run();
}

let measureTimer;
const remeasure = () => {
  clearTimeout(measureTimer);
  measureTimer = setTimeout(() => {
    measure();
    for (const a of visitors) {
      const s = sections.find((s) => s.el === a.pair.el)?.pair;
      if (s) place(a, s.x + 0.21 * a.w * scale, s.y + 0.15 * a.w * scale);
      else a.op = 0;
      draw(a);
    }
  }, 150);
};
onMotion((isStill) => {
  if (isStill) {
    for (const a of [...(scene?.cast ?? []), ...visitors]) if (a !== me) drop(a);
    scene = null;
    visitors = [];
    for (const s of sections) if (s.wake) s.wake.el.style.visibility = "";
    [grow, shrink] = [1, 0];
    setState("scene");
    return;
  }
  measure();
  onScroll();
});
addEventListener("scroll", onScroll, { passive: true });
addEventListener("resize", remeasure);
addEventListener("scrapbook:settled", remeasure);
new ResizeObserver(remeasure).observe(document.body);
document.fonts.ready.then(remeasure);
me.op = 0;
draw(me);

if (debug) {
  window.companionFlight = {
    measure,
    /** advance `n` held frames at the current scroll position; returns their samples */
    step(n = 1) {
      const from = samples.length;
      for (let i = 0; i < n; i++) frame();
      return samples.slice(from);
    },
    get stations() {
      return stations;
    },
    clearance,
  };
}
