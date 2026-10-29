import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { Resvg } from "@resvg/resvg-wasm";
import { addonPageResponse, ogImage, ogKey, readAddonPages } from "../server/addon-pages.js";
import { renderAddonPage } from "../src/addon-seo.js";
import { layout, ogImages, ogSvg, renderOgImage } from "./og-images.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));
const theme = {
  id: "night-garden",
  name: "night garden",
  description: "a dark theme with moonlit lavender and soft blue ink.",
  version: "0.3.0",
  kind: "theme",
  authors: [{ displayName: "rin", github: "rin" }],
  license: "MIT",
  origin: "community",
};
// As long as the addon directory allows: 100-character names, 500-character descriptions, 20 authors.
const longest = {
  ...theme,
  id: "a".repeat(48),
  kind: "extension",
  name: "An Extraordinarily Long Addon Name That Keeps Going Well Past Any Width A Title Could Reasonably Use",
  description: `${"Wraps over several lines, then stops with an ellipsis instead of running out of the card. ".repeat(6)}`.slice(0, 500),
  authors: Array.from({ length: 20 }, (_, index) => ({ displayName: `Contributor Number ${index + 1} With A Display Name That Is Very Long`.padEnd(100, "x") })),
};
const unbroken = { ...longest, id: "unbroken", name: "W".repeat(100), description: "M".repeat(500), authors: [{ displayName: "W".repeat(100) }] };
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
const meta = (html, key) => html.match(new RegExp(`<meta (?:name|property)="${key}" content="([^"]*)" />`))?.[1];

test("the same card renders the same bytes, in this process and in a fresh one", async () => {
  const first = Buffer.from(await renderOgImage(theme));
  assert.deepEqual(Buffer.from(await renderOgImage(structuredClone(theme))), first);
  assert.equal(first.subarray(1, 4).toString(), "PNG");
  assert.deepEqual([first.readUInt32BE(16), first.readUInt32BE(20)], [1200, 630]);
  const fresh = execFileSync(process.execPath, ["--input-type=module", "-e", `
    import { createHash } from "node:crypto";
    import { renderOgImage } from ${JSON.stringify(new URL("./og-images.mjs", import.meta.url).href)};
    const png = await renderOgImage(${JSON.stringify(theme)});
    process.stdout.write(createHash("sha256").update(png).digest("hex"));
  `], { encoding: "utf8" });
  assert.equal(fresh, sha(first));
  assert.notEqual(sha(await renderOgImage({ ...theme, description: "a light theme." })), sha(first));
});

test("long names, descriptions and author lists wrap or truncate inside the card", async () => {
  const fonts = [readFileSync(new URL("./og/EBGaramond-Medium.ttf", import.meta.url)), readFileSync(new URL("../node_modules/geist/dist/fonts/geist-mono/GeistMono-Regular.ttf", import.meta.url))];
  for (const addon of [longest, unbroken]) {
    const card = await layout(addon);
    assert.ok(card.title.lines.length <= 2 && card.description.lines.length <= 3, addon.id);
    assert.ok([card.title.lines.at(-1), card.description.lines.at(-1), card.footer.authors].every((line) => line.endsWith("…")), addon.id);
    // Measure what resvg actually draws, one text element at a time.
    const svg = await ogSvg(addon);
    const texts = svg.match(/<text[^>]*>[^<]*<\/text>/g).slice(1); // after the "hibi" wordmark
    assert.equal(texts.length, card.title.lines.length + card.description.lines.length + 3);
    const boxes = texts.map((element) => {
      const resvg = new Resvg(`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630">${element}</svg>`, { font: { fontBuffers: fonts } });
      const { x, y, width, height } = resvg.getBBox();
      resvg.free();
      return { x, y, right: x + width, bottom: y + height };
    });
    const { box } = card;
    for (const [index, drawn] of boxes.entries()) {
      assert.ok(drawn.x >= box.x + 32 && drawn.right <= box.x + box.width - 32, `${addon.id} text ${index} leaves the card sideways`);
      assert.ok(drawn.y >= box.y + 16 && drawn.bottom <= box.y + box.height - 16, `${addon.id} text ${index} leaves the card`);
    }
    const title = boxes.slice(0, card.title.lines.length);
    const description = boxes.slice(card.title.lines.length + 1, -2);
    const [authors, site] = boxes.slice(-2);
    assert.ok(title.every((line) => line.right <= card.left + 836), `${addon.id} name runs under the butterfly`);
    assert.ok(description.every((line) => line.bottom < card.rule), `${addon.id} description crosses the rule`);
    assert.ok(authors.right < site.x - 16, `${addon.id} authors run into hibi.garden`);
  }
});

test("letters the fonts cannot draw keep the site image; emoji just drop out", async () => {
  assert.equal(await renderOgImage({ ...theme, name: "日々ノート" }), null);
  assert.equal(await renderOgImage({ ...theme, description: "a theme for 日記." }), null);
  assert.deepEqual((await layout({ ...theme, name: "oneko 🐱", description: "🐾 a cat ✨" })).title.lines, ["oneko"]);
  const { files, manifest } = await ogImages([theme, { ...theme, id: "nikki", name: "日記" }]);
  assert.deepEqual(files.map((entry) => entry.fileName), ["addons/night-garden/og.png"]);
  assert.deepEqual(Object.keys(manifest), ["night-garden"]);
  assert.equal(manifest[theme.id].png, sha(files[0].source).slice(0, 12));
});

test("pages use their own image only when this build drew the same card", () => {
  const template = readFileSync(new URL("../addons/index.html", import.meta.url), "utf8");
  const images = { [theme.id]: { card: ogKey(theme), png: "0123456789ab" } };
  const own = renderAddonPage(template, theme, false, ogImage(theme, images));
  const url = "https://www.hibi.garden/addons/night-garden/og.png?v=0123456789ab";
  assert.equal(meta(own, "og:image"), url);
  assert.equal(meta(own, "twitter:image"), url);
  assert.equal(meta(own, "og:image:width"), "1200");
  assert.match(meta(own, "og:image:alt"), /^night garden, community theme by rin, /);
  // Added after the deploy, or changed in the directory since: the site image.
  for (const addon of [{ ...theme, id: "new-theme" }, { ...theme, name: "night garden 2" }]) {
    const page = renderAddonPage(template, addon, false, ogImage(addon, images));
    assert.equal(meta(page, "og:image"), "https://www.hibi.garden/opengraph.png?v=3");
    assert.equal(meta(page, "twitter:image"), "https://www.hibi.garden/opengraph.png?v=3");
  }
});

const built = existsSync(new URL("../dist/addons/og.json", import.meta.url));
test("every addon page in the build points at an image file that exists", { skip: !built && "run npm run build first" }, async () => {
  const assets = await readAddonPages(root);
  const addons = [...assets.addons, ...assets.snapshot.addons];
  assert.ok(addons.length > 40);
  for (const addon of addons) {
    const page = await (await addonPageResponse(`/addons/${addon.id}`, { ...assets, addons })).text();
    const url = new URL(meta(page, "og:image"));
    assert.equal(meta(page, "twitter:image"), url.href, addon.id);
    assert.equal(url.origin, "https://www.hibi.garden");
    const file = new URL(`../dist${url.pathname}`, import.meta.url);
    assert.ok(existsSync(file), `${addon.id}: ${url.pathname} is not in the build`);
    // Only a card its fonts cannot draw may fall back to the site image.
    if (url.pathname === "/opengraph.png" && (await layout(addon)) === null) continue;
    assert.equal(url.pathname, `/addons/${addon.id}/og.png`);
    const png = readFileSync(file);
    assert.deepEqual([png.readUInt32BE(16), png.readUInt32BE(20)], [1200, 630], addon.id);
    assert.equal(url.searchParams.get("v"), sha(png).slice(0, 12), `${addon.id}: stale version`);
    assert.ok(png.length < 150_000, `${addon.id}: ${png.length} bytes`);
  }
});
