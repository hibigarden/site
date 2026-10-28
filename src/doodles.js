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

// marks the owner drew by hand (recorded with the doodle recorder): the ink outline, and the centre line
// the pen travelled, which reveals the ink in drawing order
const RECORDED = {
  circle: {
    box: "125.19 33.35 433.91 186.88",
    outline: "M388.08 43.93Q388.15 42.21 386.15 40.45Q384.15 38.68 379.86 37.94Q375.57 37.2 363.62 36.33Q351.67 35.45 335.3 35.36Q318.94 35.26 290.08 36.93Q261.22 38.61 235.04 41.35Q208.87 44.1 190.39 48.19Q171.91 52.28 162.06 58.76Q152.22 65.23 146.07 73.39Q139.92 81.54 136.27 91.64Q132.62 101.75 130.29 111.14Q127.96 120.53 127.33 131.75Q126.7 142.96 128.86 151.71Q131.02 160.45 136.4 167.7Q141.77 174.95 150.02 182.35Q158.26 189.75 171.35 195.59Q184.43 201.43 201.92 206.09Q219.41 210.74 246.37 213.82Q273.33 216.91 311.8 217.92Q350.27 218.93 381.28 216.67Q412.28 214.41 435.24 210.51Q458.2 206.6 477.25 202.85Q496.3 199.11 508.37 194.66Q520.43 190.2 528.42 184.41Q536.41 178.62 541.77 171.82Q547.14 165.01 550.09 158.23Q553.03 151.44 554.53 145.35Q556.04 139.27 556.88 130.68Q557.73 122.1 555.32 113.02Q552.92 103.94 547.19 95.56Q541.47 87.19 530.06 79.9Q518.64 72.61 499.91 66.23Q481.18 59.84 454.43 54.69Q427.69 49.54 399.41 46Q371.13 42.46 353.64 42.19Q336.15 41.92 328.23 42.4Q320.31 42.87 316.01 43.99Q311.72 45.11 308.82 46.33Q305.93 47.55 304.54 49.23Q303.16 50.92 302.39 52.53Q301.62 54.15 301.86 54.33Q302.1 54.52 303.41 53.41Q304.71 52.31 306.09 51.27Q307.47 50.24 310.11 49.42Q312.75 48.6 316.75 47.68Q320.75 46.76 328.45 46.56Q336.15 46.35 353.44 46.77Q370.72 47.19 398.8 50.87Q426.88 54.55 453.3 59.98Q479.73 65.41 497.91 71.81Q516.09 78.21 526.71 84.98Q537.33 91.74 542.35 99.13Q547.37 106.51 549.49 114.58Q551.61 122.64 550.9 130.51Q550.2 138.38 548.99 144.05Q547.77 149.72 545.28 156.07Q542.79 162.42 537.93 168.75Q533.06 175.08 525.6 180.41Q518.15 185.74 506.62 190.15Q495.1 194.55 476.22 198.19Q457.33 201.83 434.53 205.68Q411.72 209.53 380.96 211.83Q350.2 214.13 311.96 212.72Q273.71 211.3 247.12 207.92Q220.52 204.53 203.55 199.88Q186.57 195.23 174.17 189.68Q161.77 184.13 154.3 177.2Q146.83 170.26 142 163.89Q137.17 157.51 135.25 150Q133.34 142.49 134.08 132Q134.83 121.51 136.84 112.57Q138.84 103.62 142.3 94.14Q145.75 84.66 151.23 77.37Q156.71 70.08 165.39 64.11Q174.07 58.14 191.95 54.47Q209.83 50.81 235.81 48.63Q261.78 46.46 290.47 45.18Q319.16 43.89 335.19 44.49Q351.22 45.09 362.87 46.14Q374.51 47.18 377.83 47.82Q381.14 48.47 380.53 48.09Q379.91 47.7 379.98 46.68Q380.05 45.65 384.03 45.65Z",
    centre: "M384.03 45.65L384.03 44.96L382.65 43.57L375.04 42.19L351.44 40.27L319.05 39.58L261.5 42.53L209.35 47.45L172.99 55.21L154.46 67.66L142.84 83.1L135.73 102.68L131.4 121.02L130.02 142.73L134.09 158.98L144.3 172.61L160.02 186.94L185.5 198.33L219.97 207.64L273.52 214.11L350.23 216.53L412 211.97L457.77 204.21L495.7 196.83L519.29 187.97L534.73 176.85L544.96 163.71L550.4 150.58L553.12 138.82L554.67 122.37L550.14 105.23L539.4 89.46L517.37 75.41L480.45 62.63L427.29 52.05L370.93 44.83L336.15 44.14L320.53 44.82L312.23 46.86L306.7 48.89L303.93 51.61L301.86 54.33",
  },
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

/** a filled fountain-pen stroke along `points`: width follows the direction against a nib held at ~37°,
 *  a little more ink in tight turns, a pool where the nib lands, a taper as it lifts */
function ribbon(points, width, r) {
  const left = [];
  const right = [];
  const last = points.length - 1;
  const lift = 0.12 + r() * 0.04;
  for (let k = 0; k <= last; k++) {
    const t = k / last;
    const [x, y] = points[k];
    const [px, py] = points[Math.max(0, k - 1)];
    const [nx, ny] = points[Math.min(last, k + 1)];
    const len = Math.hypot(nx - px, ny - py) || 1;
    const [qx, qy] = points[Math.max(0, k - 6)];
    const [sx, sy] = points[Math.min(last, k + 6)];
    const bend = Math.abs(((Math.atan2(sy - y, sx - x) - Math.atan2(y - qy, x - qx) + 3 * Math.PI) % (2 * Math.PI)) - Math.PI);
    let w = width * (0.5 + 0.5 * Math.abs(Math.sin(Math.atan2(ny - py, nx - px) - 0.65)));
    w *= 0.9 + 0.2 * Math.min(1, bend / 0.5);
    w *= 1 + 0.35 * Math.exp(-t / 0.012);
    if (t > 1 - lift) w *= Math.max(0.08, (1 - (t - (1 - lift)) / lift) ** 0.7);
    w *= 1 + 0.06 * (r() - 0.5);
    const ox = (-(ny - py) / len) * (w / 2);
    const oy = ((nx - px) / len) * (w / 2);
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
      '<svg width="0" height="0" aria-hidden="true"><filter id="hibi-ink" x="-5%" y="-10%" width="110%" height="120%"><feTurbulence type="fractalNoise" baseFrequency="0.045 0.09" numOctaves="2" seed="7" result="n"/><feColorMatrix in="n" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 -0.9 1.3"/><feComposite in="SourceGraphic" operator="in"/></filter></svg>';
    document.body.append(ink);
  }
  for (const host of hosts) {
    const name = host.dataset.doodle;
    const hand = RECORDED[name];
    if (hand) {
      const id = `doodle-${uid++}`;
      const [x, y, w, h] = hand.box.split(" ").map(Number);
      host.innerHTML = `<svg viewBox="${hand.box}" width="${w}" height="${h}" focusable="false"><defs><mask id="${id}" maskUnits="userSpaceOnUse" x="${x - 60}" y="${y - 60}" width="${w + 120}" height="${h + 120}"><path class="reveal" d="${hand.centre}" pathLength="1" fill="none" stroke="#fff" stroke-width="26" stroke-linecap="round" stroke-linejoin="round"/></mask></defs><g filter="url(#hibi-ink)"><path d="${hand.outline}" mask="url(#${id})" fill="currentColor" fill-opacity="0.9"/></g></svg>`;
      continue;
    }
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
          ? `<path d="${ribbon(trace, width, r)}" mask="url(#${mask})" fill="currentColor" fill-opacity="0.9"/>`
          : `<path d="${centre}" mask="url(#${mask})" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-dasharray="3 7"/>`;
        order++;
      }
    }
    host.innerHTML = `<svg viewBox="${box}" width="${w}" height="${h}" focusable="false"><defs>${masks}</defs><g filter="url(#hibi-ink)">${strokes}</g></svg>`;
  }
}
