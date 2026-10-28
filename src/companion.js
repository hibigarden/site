// The companion: one small blue that lives in the park scene in the hero. When the reader starts to scroll it
// pops out of the scene toward them (its torn paper border fading in as it becomes a scrapbook piece) and
// follows the cursor down the page, hovering beside it with a little lag and perching on an empty spot when
// the cursor rests. On touch screens it follows the scroll from perch to perch. Along the way it meets the
// others: a courtship spiral, a chase, two landing on one sprig, a pinned one woken up, and a lift-off at
// the close. Everything is drawn on the 12 fps clock, never rests on text, never steals the pointer, and with
// reduced motion (or the garden stilled) it simply stays in the scene.
import "./butterflies.css";
import { SPECIES } from "./butterflies.js";
import { onMotion, still, tick } from "./clock.js";

const SP = Object.fromEntries(SPECIES.map((s) => [s.id, s]));
const fine = matchMedia("(hover: hover) and (pointer: fine)");
const DEG = Math.PI / 180;
const ease = (u) => (u < 0 ? 0 : u > 1 ? 1 : u * u * (3 - 2 * u));
const lerp = (a, b, u) => a + (b - a) * u;

const layer = document.createElement("div");
layer.className = "companion-layer";
layer.setAttribute("aria-hidden", "true");
document.body.append(layer);

/** a split-wing butterfly in the layer; `plain` adds a second, borderless set of wings to cross-fade from */
function actor(id, plain = false) {
  const sp = SP[id];
  const stage = (src, cls) => `<div class="bf-stage ${cls}" style="--src:url(${src})"><i></i><i></i></div>`;
  layer.insertAdjacentHTML(
    "beforeend",
    `<i class="bf-shadow" style="width:${sp.w + 16}px;height:${sp.h + 16}px;background-image:url(${sp.src.replace(".webp", "-shadow.webp")})"></i>` +
      `<div class="bf" style="width:${sp.w}px;height:${sp.h}px">${stage(sp.src, "torn")}${plain ? stage(sp.src.replace(".webp", "-plain.webp"), "plain") : ""}</div>`,
  );
  const el = layer.lastChild;
  const a = { id, el, shadow: el.previousSibling, wings: [...el.querySelectorAll(".bf-stage i")], w: sp.w, h: sp.h };
  Object.assign(a, { x: -999, y: -999, rot: 0, k: 1, wing: 0, lift: 0, op: 1, torn: 1 });
  return a;
}
function draw(a) {
  const { w, h, k } = a;
  a.el.style.transform = `translate3d(${(a.x - w / 2).toFixed(1)}px,${(a.y - h / 2).toFixed(1)}px,0) rotate(${a.rot.toFixed(1)}deg) scale(${k.toFixed(3)})`;
  for (let i = 0; i < a.wings.length; i++) a.wings[i].style.transform = `rotateY(${i % 2 ? -a.wing : a.wing}deg)`;
  if (a.wings.length > 2) a.el.lastChild.style.opacity = String(1 - a.torn);
  const off = (4 + 30 * a.lift) * k;
  const dark = document.documentElement.dataset.theme === "dark";
  a.shadow.style.transform = `translate3d(${(a.x - w / 2 - 8 + off * 0.8).toFixed(1)}px,${(a.y - h / 2 - 8 + off).toFixed(1)}px,0) rotate(${a.rot.toFixed(1)}deg) scale(${(k * Math.cos(a.wing * DEG)).toFixed(3)},${k.toFixed(3)})`;
  a.shadow.style.opacity = String(a.op * (dark ? 0.7 : 0.34) * (1 - 0.5 * a.lift));
  a.el.style.opacity = String(a.op);
}
function drop(a) {
  a.el.remove();
  a.shadow.remove();
}

// ---------------------------------------------------------------- what the page looks like (cached)

let text = []; // text line and control boxes in page coordinates
let perches = []; // free landing points in page coordinates
let gutter = 0; // width of the side margin beside the 1120px column
function measure() {
  text = [];
  const range = document.createRange();
  for (const root of document.querySelectorAll("main, header, footer")) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      if (!walker.currentNode.data.trim()) continue;
      range.selectNodeContents(walker.currentNode);
      for (const r of range.getClientRects()) text.push([r.left + scrollX, r.top + scrollY, r.right + scrollX, r.bottom + scrollY]);
    }
    for (const el of root.querySelectorAll("a, button, input, iframe, summary"))
      for (const r of el.getClientRects()) text.push([r.left + scrollX, r.top + scrollY, r.right + scrollX, r.bottom + scrollY]);
  }
  perches = [...document.querySelectorAll("[data-perch]")]
    .filter((el) => el.getClientRects().length && !el.closest(".hero"))
    .map((el) => {
      const r = el.getBoundingClientRect();
      const [fx, fy] = `${el.dataset.perch},`.split(",").map((v) => (v.trim() && isFinite(v) ? +v : 0.5));
      return { el, x: r.left + scrollX + fx * r.width, y: r.top + scrollY + fy * r.height };
    })
    .filter((p) => clear(p.x, p.y, 40, 32));
  const column = Math.min(1120, document.documentElement.clientWidth - 64);
  gutter = Math.max(0, (document.documentElement.clientWidth - column) / 2);
}
/** no text or control within a box of half-size (hw, hh) around (x, y) */
function clear(x, y, hw = 46, hh = 38) {
  for (const [l, t, r, b] of text) if (l < x + hw && r > x - hw && t < y + hh && b > y - hh) return false;
  return true;
}
const viewTop = () => scrollY;
const viewBottom = () => scrollY + innerHeight;

// ---------------------------------------------------------------- the companion itself

const me = actor("small-blue", true);
let state = "scene"; // scene | popout | follow | perch | home | busy
let pointer = null; // last pointer, viewport coordinates
let lastMove = 0;
let lastScroll = 0;
let spot = null; // the perch it is heading for or sitting on
let t = 0; // frames into the current move
let from = null;
let running = false;

function sceneSpot() {
  const el = document.querySelector("[data-companion-start]");
  if (el?.getClientRects().length) {
    const r = el.getBoundingClientRect();
    return { x: r.left + scrollX + r.width / 2, y: r.top + scrollY + r.height / 2, k: Math.max(0.3, r.width / me.w) };
  }
  const hero = document.querySelector(".hero")?.getBoundingClientRect();
  return hero ? { x: hero.right + scrollX - 120, y: hero.bottom + scrollY - 160, k: 0.4 } : null;
}

/** where it wants to be: beside the cursor (fine pointers) or on a free perch in view (touch) */
function goal() {
  if (fine.matches && pointer) {
    const px = pointer.x + scrollX;
    const py = pointer.y + scrollY;
    for (const [dx, dy] of [[56, -42], [-56, -42], [60, 34], [-60, 34], [0, -70], [0, 72], [96, 0], [-96, 0]])
      if (clear(px + dx, py + dy)) return { x: px + dx, y: py + dy };
    // nowhere free beside it: wait in the nearer page margin, level with the cursor
    const left = px < innerWidth / 2;
    return { x: scrollX + (left ? Math.max(30, gutter / 2) : innerWidth - Math.max(30, gutter / 2)), y: py };
  }
  return nearestPerch() ?? { x: scrollX + innerWidth - Math.max(36, gutter / 2), y: viewTop() + innerHeight * 0.3 };
}
function nearestPerch(nearX = me.x, nearY = me.y) {
  let best = null;
  let score = Infinity;
  for (const p of perches) {
    if (p.y < viewTop() + 60 || p.y > viewBottom() - 60) continue;
    const d = Math.hypot(p.x - nearX, p.y - nearY);
    if (d < score) [score, best] = [d, p];
  }
  return best;
}
/** a free spot near the resting cursor, not under it */
function restSpot() {
  const px = pointer.x + scrollX;
  const py = pointer.y + scrollY;
  const near = perches.filter((p) => Math.hypot(p.x - px, p.y - py) < 220);
  if (near.length) return near.sort((a, b) => Math.hypot(a.x - px, a.y - py) - Math.hypot(b.x - px, b.y - py))[0];
  return goal();
}

function frame() {
  const now = performance.now();
  t++;
  if (state === "popout") {
    // out of the scene toward the reader: it grows past full size, settles, and its paper border fades in
    const u = Math.min(1, t / 12);
    const target = goal();
    me.x = lerp(from.x, target.x, ease(u));
    me.y = lerp(from.y, target.y, ease(u)) - Math.sin(u * Math.PI) * 60;
    me.k = lerp(from.k, 1, ease(u)) + Math.sin(u * Math.PI) * 0.25;
    me.torn = ease((t - 5) / 6);
    me.wing = t % 2 ? 64 : 8;
    me.lift = Math.sin(u * Math.PI);
    me.rot = lerp(0, -12, u);
    if (u >= 1) setState("follow");
  } else if (state === "home") {
    // back into the scene at the top of the page
    const u = Math.min(1, t / 12);
    const s = sceneSpot() ?? from;
    me.x = lerp(from.x, s.x, ease(u));
    me.y = lerp(from.y, s.y, ease(u)) - Math.sin(u * Math.PI) * 40;
    me.k = lerp(from.k, s.k, ease(u));
    me.torn = 1 - ease(u * 1.4);
    me.wing = u < 1 ? (t % 2 ? 60 : 10) : 0;
    if (u >= 1) {
      setState("scene");
      return false;
    }
  } else if (state === "follow" || state === "perch") {
    const target = state === "perch" && spot ? spot : goal();
    const dx = target.x - me.x;
    const dy = target.y - me.y;
    const dist = Math.hypot(dx, dy);
    me.x += dx * 0.32;
    me.y += dy * 0.32;
    me.k = 1;
    if (dist > 3) {
      // heading turns toward the way it moves, in short eased steps
      const heading = Math.atan2(dx, -dy) / DEG;
      me.rot += ((((heading - me.rot) % 360) + 540) % 360 - 180) * 0.35;
      me.wing = t % 2 ? 66 : 6;
      me.lift = Math.min(1, dist / 120);
    } else {
      me.lift = 0;
      // at rest: the wings bask, slowly closing and opening (a few held frames), otherwise still
      const phase = t % 60;
      me.wing = phase < 7 ? [18, 40, 56, 56, 40, 18, 0][phase] : 0;
      me.rot += ((((-8 - me.rot) % 360) + 540) % 360 - 180) * 0.2;
    }
    if (fine.matches && state === "follow" && now - lastMove > 1200 && now - lastScroll > 400 && pointer) {
      spot = restSpot();
      setState("perch");
    }
    if (!fine.matches && state === "follow" && now - lastScroll > 260) {
      spot = nearestPerch();
      if (spot) setState("perch");
    }
    draw(me);
    // nothing left to animate: rest until the pointer or the page moves again
    if (dist <= 3 && state === "perch" && t > 70) return false;
    return true;
  }
  draw(me);
  return state !== "scene";
}

function setState(next) {
  state = next;
  t = 0;
  from = { x: me.x, y: me.y, k: me.k };
  if (next === "scene") {
    me.op = 0;
    draw(me);
    const start = document.querySelector("[data-companion-start]");
    if (start) start.hidden = false;
    return;
  }
  if (next === "popout") {
    const s = sceneSpot();
    if (!s) return;
    Object.assign(me, s, { op: 1, torn: 0, wing: 0 });
    from = { ...s };
    // hidden tells garden.js to stop flying the scene's copy; it keeps its box (style.css) for the way home
    const start = document.querySelector("[data-companion-start]");
    if (start) start.hidden = true;
  }
  if (next !== "busy") run();
}
function run() {
  if (running || still()) return;
  running = true;
  tick(() => {
    const more = frame() !== false;
    if (!more) running = false;
    return more;
  });
}

function onScroll() {
  lastScroll = performance.now();
  if (still() || state === "busy") return;
  if (state === "scene" && scrollY > 24) setState("popout");
  else if (scrollY < 4 && state !== "scene" && state !== "popout") setState("home");
  else {
    if (state === "perch" && !fine.matches) setState("follow");
    run();
  }
}
function onPointer(event) {
  if (event.pointerType === "touch") return;
  const moved = pointer ? Math.hypot(event.clientX - pointer.x, event.clientY - pointer.y) : 99;
  pointer = { x: event.clientX, y: event.clientY };
  lastMove = performance.now();
  if (state === "perch" && moved > 30) setState("follow");
  else if (state === "follow") run();
}

// ---------------------------------------------------------------- the meetings, played by scroll position

const SCENES = {
  /** two small butterflies spiral up together in the side margin (the courtship flight) */
  spiral(section) {
    if (gutter < 120) return null;
    const r = section.getBoundingClientRect();
    const mx = scrollX + innerWidth - gutter / 2;
    const my = r.top + scrollY + r.height * 0.55;
    const other = actor("brimstone");
    const ox = scrollX + innerWidth + 80;
    const oy = my + 60;
    Object.assign(other, { x: ox, y: oy, k: 0.72 });
    return (f) => {
      const u = Math.min(1, f / 10);
      const spin = Math.max(0, f - 10);
      const cy = my - spin * 9;
      const th = spin * 0.55;
      const rad = lerp(34, 22, Math.min(1, spin / 30));
      const meet = (a, sign, x0, y0) => {
        if (f <= 10) {
          a.x = lerp(x0, mx + sign * rad, ease(u));
          a.y = lerp(y0, my, ease(u));
        } else {
          a.x = mx + sign * rad * Math.cos(th);
          a.y = cy + sign * rad * Math.sin(th) * 0.6;
        }
        a.wing = f % 2 ? 66 : 6;
        a.rot = Math.sin(th + (sign > 0 ? 0 : Math.PI)) * 40;
        a.lift = 0.8;
      };
      meet(other, 1, ox, oy);
      meet(me, -1, this.from.x, this.from.y);
      if (f > 40) {
        other.y -= (f - 40) * 26;
        other.x += (f - 40) * 6;
      }
      draw(other);
      draw(me);
      if (f < 52) return true;
      drop(other);
      return false;
    };
  },
  /** a peacock crosses the section in the band above the headline, chased by the companion */
  chase(section) {
    if (innerWidth < 700) return null;
    const r = section.getBoundingClientRect();
    const y0 = r.top + scrollY + 56;
    const x0 = scrollX - 80;
    const x1 = scrollX + innerWidth + 80;
    const lead = actor("peacock");
    lead.k = 0.7;
    return (f) => {
      const path = (a, lag, start) => {
        const u = Math.max(0, Math.min(1, (f - lag) / 30));
        a.x = lerp(start, x1, ease(u));
        a.y = y0 + Math.sin(u * 9 + lag) * 18;
        a.rot = 90 + Math.cos(u * 9 + lag) * 25;
        a.wing = f % 2 ? 68 : 4;
        a.lift = 0.7;
      };
      path(lead, 0, x0);
      path(me, 5, this.from.x);
      draw(lead);
      draw(me);
      if (f < 36) return true;
      drop(lead);
      return false;
    };
  },
  /** the companion and a cabbage white land side by side on one sprig */
  pair(section) {
    const sprig = section.querySelector("[data-pair]");
    if (!sprig?.getClientRects().length) return null;
    const r = sprig.getBoundingClientRect();
    const sx = r.left + scrollX + r.width / 2;
    const sy = r.top + scrollY + r.height * 0.1;
    const other = actor("cabbage-white");
    const ox = scrollX + innerWidth + 60;
    const oy = sy - 140;
    Object.assign(other, { x: ox, y: oy, k: 0.68 });
    return (f) => {
      const u = ease(Math.min(1, f / 14));
      const land = (a, x0, y0, x1, y1, k) => {
        a.x = lerp(x0, x1, u);
        a.y = lerp(y0, y1, u) - Math.sin(u * Math.PI) * 40;
        a.k = lerp(a.k, k, 0.3);
        a.wing = u < 1 ? (f % 2 ? 64 : 8) : f < 22 ? (f % 3 ? 40 : 0) : 0;
        if (u >= 1) a.rot = -6;
        a.lift = u < 1 ? 0.6 : 0;
      };
      land(other, ox, oy, sx + 26, sy + 18, 0.66);
      land(me, this.from.x, this.from.y, sx - 26, sy - 6, 0.78);
      draw(other);
      draw(me);
      // the visitor stays on the sprig afterwards; it is just paper now
      return f < 26;
    };
  },
  /** the companion lands beside a pinned specimen; the specimen wakes, lets go of its pin, and they fly off */
  wake(section) {
    const pinned = section.querySelector(".wake-me img");
    if (!pinned?.getClientRects().length) return null;
    const r = pinned.getBoundingClientRect();
    const px = r.left + scrollX + r.width / 2;
    const py = r.top + scrollY + r.height / 2;
    let other = null;
    return (f) => {
      if (f <= 12) {
        const u = ease(f / 12);
        me.x = lerp(this.from.x, px - 60, u);
        me.y = lerp(this.from.y, py - 30, u) - Math.sin(u * Math.PI) * 50;
        me.wing = f % 2 ? 64 : 8;
      } else if (f <= 20) {
        me.wing = f % 2 ? 40 : 0;
        if (f === 16) {
          other = actor("cabbage-white");
          Object.assign(other, { x: px, y: py, k: r.width / SP["cabbage-white"].w, rot: 12 });
          pinned.style.visibility = "hidden";
        }
        if (other) other.wing = f % 2 ? 30 : 0;
      } else {
        const u = (f - 20) / 22;
        for (const [a, dx] of [[me, -60], [other, 0]]) {
          if (!a) continue;
          a.x = lerp(px + dx, scrollX + innerWidth - gutter / 2 + dx * 0.3, ease(u));
          a.y = lerp(py, py - 420, u) + Math.sin(u * 8 + dx) * 14;
          a.wing = f % 2 ? 66 : 6;
          a.rot = 20 + Math.sin(u * 8 + dx) * 20;
          a.lift = 0.8;
        }
        if (other) other.op = u > 0.8 ? (1 - u) * 5 : 1;
      }
      if (other) draw(other);
      draw(me);
      if (f < 42) return true;
      if (other) drop(other);
      return false;
    };
  },
  /** at the close, a little group lifts off the card together and leaves through the margins */
  liftoff(section) {
    const card = section.querySelector(".end-card")?.getBoundingClientRect();
    if (!card) return null;
    const middle = card.left + scrollX + card.width / 2;
    const crew = ["morpho", "brimstone", "cabbage-white"].map((id, i) => {
      const a = actor(id);
      const corner = [[0.06, 0.18], [0.94, 0.16], [0.9, 0.86]][i];
      Object.assign(a, { x: card.left + scrollX + corner[0] * card.width, y: card.top + scrollY + corner[1] * card.height, k: 0.62, rot: [-14, 16, -10][i] });
      return a;
    });
    return (f) => {
      crew.forEach((a, i) => {
        const go = f - 6 - i * 2;
        if (go < 0) {
          a.wing = f % 4 < 2 ? 0 : 28;
        } else {
          const u = go / 24;
          const side = a.x < middle ? -1 : 1;
          a.x += side * (6 + go * 0.6);
          a.y -= 10 + go * 2.4;
          a.rot = side * (20 + go);
          a.wing = f % 2 ? 66 : 6;
          a.lift = Math.min(1, u * 2);
          a.op = u > 0.75 ? Math.max(0, (1 - u) * 4) : 1;
        }
        draw(a);
      });
      if (f >= 6) {
        me.y -= 14;
        me.x += Math.sin(f) * 6;
        me.wing = f % 2 ? 66 : 6;
      }
      draw(me);
      if (f < 32) return true;
      crew.forEach(drop);
      return false;
    };
  },
};

let playing = null;
function play(name, section) {
  if (playing || still() || state === "scene" || state === "popout" || state === "home") return false;
  const ctx = { from: { x: me.x, y: me.y } };
  const scene = SCENES[name]?.call(ctx, section);
  if (!scene) return true; // nothing to play at this width; count it as done
  playing = name;
  state = "busy";
  let f = 0;
  tick(() => {
    if (scene.call(ctx, ++f)) return true;
    playing = null;
    setState("follow");
    return false;
  });
  return true;
}

const scenes = new IntersectionObserver(
  (entries) => {
    for (const entry of entries) {
      if (entry.intersectionRatio < 0.35) continue;
      if (play(entry.target.dataset.scene, entry.target)) scenes.unobserve(entry.target);
    }
  },
  { threshold: [0.35, 0.6, 0.9] },
);

// ---------------------------------------------------------------- wiring

let measureTimer;
const remeasure = () => {
  clearTimeout(measureTimer);
  measureTimer = setTimeout(measure, 150);
};
onMotion((isStill) => {
  if (isStill) {
    setState("scene");
    return;
  }
  measure();
  for (const el of document.querySelectorAll("[data-scene]")) scenes.observe(el);
  onScroll();
});
addEventListener("scroll", onScroll, { passive: true });
addEventListener("pointermove", onPointer, { passive: true });
addEventListener("resize", remeasure);
addEventListener("scrapbook:settled", remeasure);
new ResizeObserver(remeasure).observe(document.body);
document.fonts.ready.then(remeasure);
me.op = 0;
draw(me);
