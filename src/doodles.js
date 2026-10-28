// Pen doodles over the scrapbook. Markup asks for one with
// <span class="doodle" data-doodle="arrow" aria-hidden="true"></span>. Every stroke is drawn the way a pen
// moves: a filled ribbon whose width follows the pressure (light where the nib lands, swelling, thinning where
// it lifts), some strokes traced twice with a slightly offset second pass, and the edges roughened by an ink
// filter. A mask along each centreline lets css draw the strokes in, in order. Seeded, so a doodle never
// changes between visits.

// name: [viewBox, nib width, passes, ...centrelines (absolute M/C/L only)]
const DOODLES = {
  arrow: [
    "0 0 140 90", 3.4, 1,
    "M8 74C34 85 77 79 100 52C110 41 116 30 121 15",
    "M122 14C115 17 109 21 102 25",
    "M121 15C123 21 125 28 128 34",
  ],
  "arrow-down": [
    "0 0 90 140", 3, 1,
    "M20 6C50 10 70 30 56 50C44 66 22 56 30 42C38 28 60 40 58 66C56 90 46 108 44 128",
    "M44 129C40 122 35 117 29 113",
    "M44 129C48 121 53 116 59 111",
  ],
  circle: [
    "0 0 220 100", 3.4, 2,
    "M170 19C131 3 49 5 20 31C1 50 22 85 97 88C165 92 214 69 206 42C199 21 158 9 110 12C95 13 84 17 75 22",
  ],
  underline: ["0 0 220 24", 3.6, 2, "M4 14C30 8 52 18 80 12C108 6 130 18 158 12C180 8 200 14 216 9"],
  star: ["0 0 64 64", 2.8, 1, "M32 5L39 25L59 25L43 37L50 58L32 45L14 58L21 37L5 25L26 24L31 9"],
  sparkle: ["0 0 44 44", 2.6, 1, "M22 3C23 15 28 20 41 22C28 24 23 29 22 41C21 29 16 24 3 22C16 20 21 15 23 5"],
  heart: ["0 0 64 58", 3, 2, "M32 52C14 40 3 28 7 16C11 5 25 3 31 15C36 4 51 3 56 13C62 26 50 40 31 53"],
  swirl: [
    "0 0 84 84", 2.8, 1,
    "M44 42C46 38 52 40 50 46C47 53 37 51 36 43C35 32 47 26 56 31C67 38 64 55 51 61C35 68 19 57 19 42C19 25 34 14 52 16C66 18 76 28 78 40",
  ],
  butterfly: [
    "0 0 96 76", 2.4, 1,
    "M48 22C47 34 47 46 48 60",
    "M47 30C36 12 14 6 8 16C3 26 18 36 46 38",
    "M46 40C30 42 18 52 22 62C26 70 40 62 47 46",
    "M49 30C60 12 82 6 88 16C93 26 78 36 50 38",
    "M50 40C66 42 78 52 74 62C70 70 56 62 49 46",
    "M47 23C44 15 41 10 37 7",
    "M49 23C52 15 55 10 59 7",
  ],
  check: ["0 0 50 40", 3.4, 1, "M4 22C10 26 14 32 18 36C26 22 36 10 47 4"],
  squiggle: [
    "0 0 160 30", 2.8, 1,
    "M4 18C14 4 24 4 22 16C20 28 34 28 40 14C46 2 58 4 56 16C54 28 68 28 74 14C80 2 92 4 90 16C88 28 102 28 108 14C114 2 126 4 124 16C122 28 136 28 142 14C146 6 152 6 156 10",
  ],
  asterisk: ["0 0 36 36", 2.8, 1, "M18 4C18 14 18 22 19 32", "M6 11C14 15 22 21 30 26", "M30 10C22 15 14 21 6 26"],
  trail: [
    "0 0 220 120", 0, 1,
    "M4 100C40 96 60 70 70 50C80 30 110 20 120 40C128 56 104 66 98 52C92 38 120 22 150 26C180 30 200 20 214 8",
  ],
};

const rng = (seed) => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let x = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
  return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
};
const hash = (text) => [...text].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
const f = (n) => n.toFixed(1);

/** points along a centreline of absolute M, L and C commands (C may chain), about every 1.5 units */
function sample(d) {
  const points = [];
  let [x, y] = [0, 0];
  for (const segment of d.match(/[MLC][^MLC]*/g)) {
    const n = segment.slice(1).match(/-?\d*\.?\d+/g).map(Number);
    if (segment[0] === "M") {
      [x, y] = n;
      points.push([x, y]);
      continue;
    }
    const line = segment[0] === "L";
    for (let i = 0; i < n.length; i += line ? 2 : 6) {
      const [c1x, c1y, c2x, c2y, ex, ey] = line ? [x, y, ...n.slice(i, i + 2), ...n.slice(i, i + 2)] : n.slice(i, i + 6);
      const steps = Math.max(4, Math.ceil((Math.hypot(c1x - x, c1y - y) + Math.hypot(c2x - c1x, c2y - c1y) + Math.hypot(ex - c2x, ey - c2y)) / 1.5));
      for (let s = 1; s <= steps; s++) {
        const t = s / steps;
        const u = 1 - t;
        points.push([
          u * u * u * x + 3 * u * u * t * c1x + 3 * u * t * t * c2x + t * t * t * ex,
          u * u * u * y + 3 * u * u * t * c1y + 3 * u * t * t * c2y + t * t * t * ey,
        ]);
      }
      [x, y] = [ex, ey];
    }
  }
  return points;
}

/** a filled pen stroke along `points`: pressure rises where the nib lands, wanders, and tapers as it lifts */
function ribbon(points, width, r) {
  const a = r() * 6.28;
  const b = r() * 6.28;
  const lift = 0.16 + r() * 0.14;
  const left = [];
  const right = [];
  const last = points.length - 1;
  for (let k = 0; k <= last; k++) {
    const t = k / last;
    const [x, y] = points[k];
    const [px, py] = points[Math.max(0, k - 1)];
    const [nx, ny] = points[Math.min(last, k + 1)];
    const len = Math.hypot(nx - px, ny - py) || 1;
    const pressure = 0.82 + 0.18 * Math.sin(t * 7 + a) * Math.sin(t * 3 + b);
    const ends = Math.min(1, t / 0.1, (1 - t) / lift);
    const w = (width / 2) * pressure * (0.3 + 0.7 * Math.sqrt(Math.max(0, ends)));
    const ox = (-(ny - py) / len) * w;
    const oy = ((nx - px) / len) * w;
    left.push(`${f(x + ox)} ${f(y + oy)}`);
    right.push(`${f(x - ox)} ${f(y - oy)}`);
  }
  return `M${left.join("L")}L${right.reverse().join("L")}Z`;
}

/** the second time over a line: slightly off the first, starting a touch late and lifting a touch early */
function retrace(points, r) {
  const dx = (r() - 0.5) * 2.2;
  const dy = (r() - 0.5) * 2.2;
  const phase = r() * 6.28;
  const from = Math.floor(points.length * r() * 0.08);
  const to = Math.ceil(points.length * (0.9 + r() * 0.08));
  return points.slice(from, to).map(([x, y], k) => {
    const wobble = Math.sin(k / 18 + phase) * 0.9;
    return [x + dx + wobble, y + dy - wobble];
  });
}

const path = (points) => `M${points.map(([x, y]) => `${f(x)} ${f(y)}`).join("L")}`;

let ink;
let uid = 0;
export function drawDoodles(root = document) {
  const hosts = root.querySelectorAll(".doodle[data-doodle]:not(:has(svg))");
  if (!hosts.length) return;
  if (!ink) {
    // one shared filter roughens every stroke's edge like ink taking to paper
    ink = document.createElement("div");
    ink.hidden = true;
    ink.innerHTML =
      '<svg width="0" height="0" aria-hidden="true"><filter id="hibi-ink" x="-5%" y="-5%" width="110%" height="110%"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="4"/><feDisplacementMap in="SourceGraphic" scale="1.3" xChannelSelector="R" yChannelSelector="G"/></filter></svg>';
    document.body.append(ink);
  }
  for (const host of hosts) {
    const name = host.dataset.doodle;
    const [box, width, passes, ...lines] = DOODLES[name] ?? [];
    if (!box) continue;
    const [, , w, h] = box.split(" ");
    const r = rng(hash(name) + uid * 7919);
    const id = `doodle-${uid++}`;
    let masks = "";
    let strokes = "";
    let order = 0;
    for (const line of lines) {
      const points = sample(line);
      const traces = width ? [points, ...(passes > 1 ? [retrace(points, r)] : [])] : [points];
      for (const trace of traces) {
        const mask = `${id}-${order}`;
        const centre = path(trace);
        masks += `<mask id="${mask}" maskUnits="userSpaceOnUse" x="-20" y="-20" width="${+w + 40}" height="${+h + 40}"><path class="reveal" d="${centre}" pathLength="1" style="--i:${order}" fill="none" stroke="#fff" stroke-width="${Math.max(6, width * 3)}" stroke-linecap="round" stroke-linejoin="round"/></mask>`;
        strokes += width
          ? `<path d="${ribbon(trace, width * (trace === points ? 1 : 0.7), r)}" mask="url(#${mask})" fill="currentColor"${trace === points ? "" : ' opacity="0.75"'}/>`
          : `<path d="${centre}" mask="url(#${mask})" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-dasharray="3 7"/>`;
        order++;
      }
    }
    host.innerHTML = `<svg viewBox="${box}" width="${w}" height="${h}" focusable="false"><defs>${masks}</defs><g filter="url(#hibi-ink)">${strokes}</g></svg>`;
  }
}
