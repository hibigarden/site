// Social images (1200×630 png) for addon pages, drawn while the site builds.
// The same card always gives the same bytes on any machine: the fonts and
// pictures are files in this repository or pinned packages, resvg runs as
// WebAssembly, and nothing reads the clock, system fonts or Math.random.
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { initWasm, Resvg } from "@resvg/resvg-wasm";
import { create } from "fontkit";
import { ogCard, ogHash, ogKey, ogKind } from "../server/addon-pages.js";

const BUTTERFLIES = ["brimstone", "cabbage-white", "hairstreak", "luna", "morpho", "peacock", "rosy-maple", "small-blue", "swallowtail"];
const INK = "#1f1b16", SOFT = "#4a4033", FAINT = "#6b5c47";

const file = (path) => readFileSync(new URL(path, import.meta.url));
// og/*.png are the site's own cut-outs (public/scrapbook: icon-day, tape-butter,
// bf-*) at the size they are drawn, already rotated, the stickers' shadows baked in.
function picture(name) {
  const bytes = file(`./og/${name}.png`);
  return { href: `data:image/png;base64,${bytes.toString("base64")}`, width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

let assets;
const load = () =>
  (assets ??= initWasm(file(createRequire(import.meta.url).resolve("@resvg/resvg-wasm/index_bg.wasm"))).then(() => {
    const serif = file("./og/EBGaramond-Medium.ttf");
    const mono = file("../node_modules/geist/dist/fonts/geist-mono/GeistMono-Regular.ttf");
    return {
      fonts: [serif, mono],
      serif: create(serif),
      mono: create(mono),
      icon: picture("icon"),
      tape: picture("tape"),
      butterflies: BUTTERFLIES.map((name) => picture(`bf-${name}`)),
    };
  }));

const escape = (value) => value.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const width = (font, size, text) => (font.layout(text).advanceWidth * size) / font.unitsPerEm;

/** FNV-1a: an addon keeps its butterfly and torn edge from build to build. */
function seed(text) {
  let hash = 0x811c9dc5;
  for (const byte of new TextEncoder().encode(text)) hash = Math.imul(hash ^ byte, 0x01000193) >>> 0;
  return hash;
}

/** mulberry32 */
function numbers(state) {
  return () => {
    let t = (state = (state + 0x6d2b79f5) >>> 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Greedy word wrap into at most `max` lines no wider than `limit`. A word wider
 * than a line breaks between characters; leftover text ends the last line with
 * an ellipsis.
 */
function wrap(font, size, text, limit, max) {
  const fits = (line) => width(font, size, line) <= limit;
  const lines = [];
  let line = "";
  for (const word of text.split(" ").filter(Boolean)) {
    if (fits(line ? `${line} ${word}` : word)) {
      line = line ? `${line} ${word}` : word;
      continue;
    }
    if (line) lines.push(line);
    line = "";
    for (const character of word) {
      if (line && !fits(line + character)) {
        lines.push(line);
        line = "";
      }
      line += character;
    }
  }
  if (line) lines.push(line);
  if (lines.length <= max) return lines;
  let last = lines[max - 1];
  while (!fits(`${last}…`)) last = last.includes(" ") ? last.slice(0, last.lastIndexOf(" ")) : Array.from(last).slice(0, -1).join("");
  return [...lines.slice(0, max - 1), `${last.replace(/[\s,.;:-]+$/u, "")}…`];
}

/** `wrap` at the narrowest width that keeps its line count, like the site's text-wrap: balance. */
function balance(font, size, text, limit, max) {
  const count = wrap(font, size, text, limit, Infinity).length;
  if (count < 2 || count > max) return wrap(font, size, text, limit, max);
  let low = limit / 2, high = limit;
  for (let step = 0; step < 7; step++) {
    const middle = (low + high) / 2;
    if (wrap(font, size, text, middle, Infinity).length === count) high = middle;
    else low = middle;
  }
  return wrap(font, size, text, high, max);
}

/** Null when the font lacks a letter or digit; other missing symbols (emoji) drop out. */
function drawable(font, text) {
  let result = "";
  for (const character of text.replace(/\s+/g, " ")) {
    if (font.hasGlyphForCodePoint(character.codePointAt(0))) result += character;
    else if (/[\p{L}\p{N}]/u.test(character)) return null;
  }
  return result.replace(/ +/g, " ").trim();
}

/** The card's fitted lines and their places, or null when its fonts cannot draw it. */
export async function layout(addon) {
  const { serif, mono } = await load();
  const card = ogCard(addon);
  const name = drawable(serif, card.name);
  const description = drawable(serif, card.description);
  const authors = drawable(mono, card.authors.join(", "));
  if (!name || description === null || !authors) return null;
  const box = { x: 80, y: 146, width: 1040, height: 430 };
  const left = box.x + 64, right = box.x + box.width - 64, rule = box.y + box.height - 86;
  // The butterfly covers the card's top-right corner, so the name stops short of it.
  const size = [88, 76, 64].find((size) => width(serif, size, name) <= 836) ?? 64;
  const title = { size, step: Math.round(size * 1.08), baseline: box.y + 46 + Math.round(size * 0.74), lines: balance(serif, size, name, 836, 2) };
  const kind = title.baseline + title.step * (title.lines.length - 1) + 48;
  const first = kind + 58;
  return {
    box,
    left,
    right,
    rule,
    title,
    kind: { text: ogKind(card), baseline: kind },
    description: { size: 40, step: 48, baseline: first, lines: balance(serif, 40, description, right - left, Math.min(3, Math.floor((rule - 24 - first) / 48) + 1)) },
    footer: { baseline: rule + 46, site: "hibi.garden", authors: wrap(mono, 26, authors, right - left - width(mono, 26, "hibi.garden") - 48, 1)[0] },
    seed: seed(card.id),
  };
}

/** Pictures come rotated, at their drawn size: placing them never resamples. */
const place = (picture, x, y) =>
  `<image x="${x - picture.width / 2}" y="${y - picture.height / 2}" width="${picture.width}" height="${picture.height}" href="${picture.href}"/>`;
const text = (x, y, size, family, fill, value, extra = "") =>
  `<text x="${x}" y="${y}" font-family="${family}" font-size="${size}" fill="${fill}"${extra}>${escape(value)}</text>`;

/** A torn edge like the site's paper cards, left to right, at most `depth` below y. */
function deckle(random, x0, x1, y, depth) {
  const points = [];
  for (let x = x0; x < x1; x += 18) points.push(`${x},${(y + random() * depth).toFixed(1)}`);
  return [...points, `${x1},${(y + random() * depth).toFixed(1)}`];
}

/** The card as SVG, or null when its fonts cannot draw it. */
export async function ogSvg(addon) {
  const { icon, tape, butterflies } = await load();
  const card = await layout(addon);
  if (!card) return null;
  const { box, left, right, rule, title, kind, description, footer } = card;
  const random = numbers(card.seed);
  const edge = [
    ...deckle(random, box.x, box.x + box.width, box.y, 7),
    ...deckle(random, box.x, box.x + box.width, box.y + box.height - 7, 7).reverse(),
  ].join(" ");
  const butterfly = butterflies[card.seed % butterflies.length];
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
<defs>
<linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#86bff8"/><stop offset="0.35" stop-color="#8ac6fd"/><stop offset="1" stop-color="#a6d5fc"/></linearGradient>
<radialGradient id="drop"><stop offset="0" stop-color="rgb(64,44,20)" stop-opacity="0.28"/><stop offset="1" stop-color="rgb(64,44,20)" stop-opacity="0"/></radialGradient>
</defs>
<rect width="1200" height="630" fill="#ebe1cc"/>
<rect x="16" y="16" width="1168" height="640" rx="16" fill="url(#sky)" stroke="rgb(64,44,20)" stroke-opacity="0.1"/>
${place(icon, 90, 74)}
${text(138, 93.4, 56, "EB Garamond", INK, "hibi", ' letter-spacing="-0.84"')}
<ellipse cx="600" cy="${box.y + box.height}" rx="${box.width / 2 + 8}" ry="26" fill="url(#drop)"/>
<polygon points="${edge}" fill="rgb(64,44,20)" fill-opacity="0.14" transform="translate(0 2)"/>
<polygon points="${edge}" fill="#fffdf8"/>
${place(tape, 600, box.y - 2)}
${title.lines.map((line, index) => text(left, title.baseline + index * title.step, title.size, "EB Garamond", INK, line, ' letter-spacing="-1"')).join("\n")}
${text(left + 2, kind.baseline, 26, "Geist Mono", FAINT, kind.text)}
${description.lines.map((line, index) => text(left, description.baseline + index * description.step, description.size, "EB Garamond", SOFT, line)).join("\n")}
<line x1="${left}" y1="${rule}" x2="${right}" y2="${rule}" stroke="rgb(32,54,118)" stroke-opacity="0.32" stroke-width="1.5" stroke-dasharray="6 6"/>
${text(left + 2, footer.baseline, 26, "Geist Mono", FAINT, footer.authors)}
${text(right, footer.baseline, 26, "Geist Mono", FAINT, footer.site, ' text-anchor="end"')}
${place(butterfly, 1075, 140)}
</svg>`;
}

async function render(svg) {
  const { fonts } = await load();
  const resvg = new Resvg(svg, { font: { fontBuffers: fonts, defaultFontFamily: "EB Garamond" } });
  const image = resvg.render();
  const png = image.asPng();
  // WebAssembly memory only grows: hand each 3 MB pixmap back before the next card.
  image.free();
  resvg.free();
  return png;
}

export async function renderOgImage(addon) {
  const svg = await ogSvg(addon);
  return svg && render(svg);
}

/**
 * Every addon's image and the manifest pages find them by. An addon that
 * cannot be drawn keeps the site image instead of failing the build.
 * ponytail: every build draws every card, one at a time (~55 ms each, ~3 s for
 * 52). Past a few hundred addons, keep pngs by svg hash in node_modules/.cache
 * or draw on worker threads.
 */
export async function ogImages(addons) {
  const files = [];
  const manifest = {};
  for (const addon of addons) {
    let source;
    try {
      source = await renderOgImage(addon);
    } catch (error) {
      console.warn(`no social image for ${addon.id}: ${error.message}`);
    }
    if (!source) continue;
    files.push({ fileName: `addons/${addon.id}/og.png`, source });
    manifest[addon.id] = { card: ogKey(addon), png: ogHash(source) };
  }
  return { files, manifest };
}
