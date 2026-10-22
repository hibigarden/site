import assert from "node:assert/strict";
import { readFile, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { addonPageResponse } from "../server/addon-pages.js";
import { bundledAddons } from "../src/addon-directory.js";

const template = await readFile(new URL("../addons/index.html", import.meta.url), "utf8");
const catalog = [{
  id: "vim", name: "Vim", description: "Modal editing.", version: "1.0.0",
  defaultEnabled: false, authors: [{ displayName: "may" }],
}];
const addons = bundledAddons(catalog);
const community = {
  id: "night-garden", name: "Night Garden", description: "A dark theme.",
  kind: "theme", version: "1.0.0", apiVersion: 2, license: "MIT",
  authors: [{ displayName: "Rin" }], path: "addons/night-garden",
};
const respond = (entries) => async () => new Response(JSON.stringify(entries));
const offline = async () => { throw new Error("offline"); };

test("built-in SEO is available without a directory request and normalizes trailing slashes", async () => {
  for (const pathname of ["/addons/vim", "/addons/vim/"]) {
    const result = await addonPageResponse(pathname, { template, addons, fetch: offline });
    assert.equal(result.status, 200);
    const html = await result.text();
    assert.match(html, /<title>Vim \| hibi addons<\/title>/);
    assert.match(html, /rel="canonical" href="https:\/\/www.hibi.garden\/addons\/vim"/);
    assert.match(html, /href="hibi:\/\/addons\/open\?id=vim"/);
    assert.match(result.headers.get("Cache-Control"), /s-maxage=300/);
  }
});

test("new community themes get raw HTML and sitemap entries without a build", async () => {
  const options = { template, addons, fetch: respond([community]) };
  const page = await addonPageResponse("/addons/night-garden", options);
  assert.equal(page.status, 200);
  const html = await page.text();
  assert.match(html, /<title>Night Garden \| hibi themes<\/title>/);
  assert.match(html, /<h1[^>]*>Night Garden<\/h1>/);
  assert.match(html, /"@type":"CreativeWork"/);
  const sitemap = await addonPageResponse("/sitemap.xml", options);
  assert.equal(sitemap.status, 200);
  assert.match(sitemap.headers.get("Content-Type"), /application\/xml/);
  const xml = await sitemap.text();
  for (const path of ["/", "/addons/", "/addons/vim", "/addons/night-garden"])
    assert.ok(xml.includes(`<loc>https://www.hibi.garden${path}</loc>`), path);
  assert.doesNotMatch(xml, /demo/);
});

test("unknown entries return noindex 404 while directory outages return retryable 503", async () => {
  const missing = await addonPageResponse("/addons/missing", { template, addons, fetch: respond([]) });
  assert.equal(missing.status, 404);
  assert.equal(missing.headers.get("X-Robots-Tag"), "noindex");
  assert.match(await missing.text(), /<h1>addon not found<\/h1>/);
  for (const pathname of ["/addons/night-garden", "/sitemap.xml"]) {
    const failed = await addonPageResponse(pathname, { template, addons, fetch: offline });
    assert.equal(failed.status, 503);
    assert.equal(failed.headers.get("Cache-Control"), "no-store");
    assert.equal(failed.headers.get("Retry-After"), "60");
    const body = await failed.text();
    assert.match(body, /temporarily unavailable/);
    assert.doesNotMatch(body, /addon not found|urlset/);
  }
});

test("detail routing does not swallow static catalog files or revocations", async () => {
  for (const path of ["/addons/", "/addons/index.html", "/addons/revocations.json", "/addons/catalog.json", "/addons/../vim", "/addons/bad/path"])
    assert.equal(await addonPageResponse(path, { template, addons, fetch: offline }), null, path);
});

test("the production function reads its packaged assets, preserves HEAD, and rejects writes", async () => {
  const root = await mkdtemp(join(tmpdir(), "hibi-addon-seo-"));
  const previous = process.cwd();
  try {
    await mkdir(join(root, "dist/addons"), { recursive: true });
    await writeFile(join(root, "dist/addons/index.html"), template);
    await writeFile(join(root, "dist/addons/catalog.json"), JSON.stringify(catalog));
    process.chdir(root);
    const { default: handler } = await import("../api/addon-seo.js");
    const call = async (method, query) => {
      const headers = new Map();
      let body;
      const response = {
        statusCode: 200, setHeader: (key, value) => headers.set(key.toLowerCase(), value),
        end: (value) => { body = value; },
      };
      await handler({ method, query }, response);
      return { status: response.statusCode, headers, body };
    };
    const get = await call("GET", { id: "vim" });
    assert.equal(get.status, 200);
    assert.match(get.body, /<h1[^>]*>Vim<\/h1>/);
    assert.equal((await call("HEAD", { id: "vim" })).body, "");
    const post = await call("POST", { id: "vim" });
    assert.equal(post.status, 405);
    assert.equal(post.headers.get("allow"), "GET, HEAD");
    assert.equal((await call("GET", { id: ["vim", "night-garden"] })).status, 404);
  } finally {
    process.chdir(previous);
    await rm(root, { recursive: true, force: true });
  }
});
