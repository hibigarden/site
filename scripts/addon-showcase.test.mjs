import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { communityDates, communityFeed, resetCommunityCache } from "../server/addon-dates.js";
import { addonPageResponse } from "../server/addon-pages.js";
import { DIRECTORY_URL, addonDay, sortAddons } from "../src/addon-directory.js";
import { renderShowcase } from "../src/addon-showcase.js";
import { deployedSnapshot, injectShowcase, readCatalog } from "./addon-catalog.mjs";

const API = "https://api.github.com/repos/hibigarden/addons-repository";
const entry = (id, extra = {}) => ({
  id, name: id, description: `${id} addon.`, version: "1.0.0", apiVersion: 2,
  kind: "theme", license: "MIT", authors: [{ displayName: "rin" }], path: `addons/${id}`, ...extra,
});
const commit = (day, sha = "c") => ({ sha, commit: { committer: { date: `${day}T12:00:00Z` } } });
const json = (value, headers = {}) => new Response(JSON.stringify(value), { headers });

/** A fake GitHub + directory; records every API URL it serves. */
function github(routes, directory = [entry("night"), entry("doom", { path: undefined, repository: { url: "https://github.com/rin/doom", commit: "a".repeat(40) } })]) {
  const calls = [];
  const fetch = async (url, options) => {
    if (url === DIRECTORY_URL) return json(directory);
    calls.push({ url: url.replace(API, ""), auth: options.headers.Authorization });
    const route = routes[url.replace(API, "")];
    return typeof route === "function" ? route() : route ? json(...route) : new Response("", { status: 404 });
  };
  return { fetch, calls };
}

test("site dates read as day.roman month.year and reject anything else", () => {
  assert.equal(addonDay("2026-10-12"), "12.x.2026");
  assert.equal(addonDay("2026-01-01"), "1.i.2026");
  for (const bad of [undefined, null, "", "2026-13-01", "2026-10-00", "12.x.2026", "2026-10-12T00:00:00Z"])
    assert.equal(addonDay(bad), null, String(bad));
});

test("both date sorts put the newest first, break ties by name, and keep undated addons last", () => {
  const addons = [
    { name: "beta", released: "2026-10-01", updated: "2026-10-20" },
    { name: "Alpha", released: "2026-10-01", updated: "2026-10-02" },
    { name: "gamma", released: "2026-10-05", updated: "2026-10-05" },
    { name: "aardvark" },
    { name: "delta", released: "not a day", updated: "2026-10-30" },
  ];
  const names = (order) => sortAddons(addons, order).map((addon) => addon.name);
  assert.deepEqual(names("released"), ["gamma", "Alpha", "beta", "aardvark", "delta"]);
  assert.deepEqual(names("updated"), ["delta", "beta", "gamma", "Alpha", "aardvark"]);
  assert.deepEqual(names("name"), ["aardvark", "Alpha", "beta", "delta", "gamma"]);
  assert.deepEqual(names(), names("name"));
  assert.equal(addons[0].name, "beta", "sorting copies");
});

test("built-in dates come from the synced dates.json and are optional", (t) => {
  const root = mkdtempSync(path.join(tmpdir(), "hibi-dates-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  writeFileSync(path.join(root, "authors.ts"), "export const authors = {}");
  for (const id of ["vim", "math", "tags"]) {
    mkdirSync(path.join(root, id));
    writeFileSync(path.join(root, id, "manifest.ts"), `export default { id: '${id}', name: '${id}', description: 'd', version: '1.0.0', defaultEnabled: true, authors: [] }`);
    writeFileSync(path.join(root, id, "README.md"), id);
  }
  const days = () => Object.fromEntries(readCatalog(root).map(({ id, released, updated }) => [id, [released, updated]]));
  assert.deepEqual(days(), { math: [undefined, undefined], tags: [undefined, undefined], vim: [undefined, undefined] });
  writeFileSync(path.join(root, "dates.json"), JSON.stringify({
    vim: { released: "2026-09-17", updated: "2026-10-26" },
    math: { released: "2026-09-17", updated: "yesterday" },
    gone: { released: "2026-09-17", updated: "2026-09-17" },
  }));
  assert.deepEqual(days(), { math: [undefined, undefined], tags: [undefined, undefined], vim: ["2026-09-17", "2026-10-26"] });
  writeFileSync(path.join(root, "dates.json"), "{ broken");
  assert.equal(readCatalog(root).length, 3);
});

test("community dates use the first and last commit of each tracked path", async () => {
  const { fetch, calls } = github({
    "/commits?per_page=1": [[commit("2026-10-28", "head")]],
    "/commits?path=addons%2Fnight&per_page=100": [[commit("2026-10-27"), commit("2026-10-20")], { link: `<${API}/commits?path=addons%2Fnight&per_page=100&page=2>; rel="next", <${API}/commits?path=addons%2Fnight&per_page=100&page=3>; rel="last"` }],
    "/commits?path=addons%2Fnight&per_page=100&page=3": [[commit("2026-10-02"), commit("2026-09-30")]],
    "/commits?path=signatures%2Fdoom.json&per_page=100": [[commit("2026-10-22")]],
  });
  const entries = [{ id: "night", source: "directory" }, { id: "doom", source: "repository" }];
  const known = await communityDates(entries, { fetch, token: "secret" });
  assert.deepEqual(known, {
    head: "head",
    dates: { night: { released: "2026-09-30", updated: "2026-10-27" }, doom: { released: "2026-10-22", updated: "2026-10-22" } },
  });
  assert.equal(calls.length, 4);
  assert.ok(calls.every((call) => call.auth === "Bearer secret"));
  // An unchanged head costs one request; a new entry needs its own history.
  calls.length = 0;
  assert.equal(await communityDates(entries, { fetch, known }), known);
  assert.equal(calls.length, 1);
  await assert.rejects(communityDates([...entries, { id: "new", source: "directory" }], { fetch, known }), /404/);
});

test("pagination links can never send the token to another host", async () => {
  const { fetch, calls } = github({
    "/commits?per_page=1": [[commit("2026-10-28", "head")]],
    "/commits?path=addons%2Fnight&per_page=100": [[commit("2026-10-27")], { link: '<https://evil.example/commits>; rel="last"' }],
  });
  await assert.rejects(communityDates([{ id: "night", source: "directory" }], { fetch, token: "secret" }), /unexpected GitHub URL/);
  assert.ok(!calls.some((call) => call.url.includes("evil")));
});

test("a rate limit falls back to the snapshot and pauses the API until it resets", async (t) => {
  t.after(resetCommunityCache);
  resetCommunityCache();
  const snapshot = { head: "old", dates: { night: { released: "2026-10-01", updated: "2026-10-02" } }, addons: [] };
  const reset = Math.floor(Date.now() / 1000) + 600;
  const limited = github({
    "/commits?per_page=1": () => new Response("", { status: 403, headers: { "x-ratelimit-remaining": "0", "x-ratelimit-reset": String(reset) } }),
  });
  const feed = await communityFeed(snapshot, [], { fetch: limited.fetch });
  assert.equal(feed.live, false);
  assert.deepEqual(feed.addons.map((addon) => addon.id), ["night", "doom"], "the directory is still fresh");
  assert.deepEqual(feed.dates, snapshot.dates);
  assert.equal(limited.calls.length, 1);
  await communityFeed(snapshot, [], { fetch: limited.fetch });
  assert.equal(limited.calls.length, 1, "no API calls during the pause");
  const offline = async () => { throw new Error("offline"); };
  const later = await communityFeed({ ...snapshot, addons: [entry("cached")] }, [], { fetch: offline, now: reset * 1000 + 1 });
  assert.deepEqual(later.addons.map((addon) => addon.id), ["cached"], "the snapshot's entries when the directory fails");
  assert.equal(later.live, false);
});

test("the community feed is cached at the CDN, briefly when it is only the snapshot", async (t) => {
  t.after(resetCommunityCache);
  resetCommunityCache();
  const snapshot = { head: "head", dates: { night: { released: "2026-10-01", updated: "2026-10-02" }, doom: null }, addons: [] };
  const { fetch } = github({ "/commits?per_page=1": [[commit("2026-10-28", "head")]] });
  const live = await addonPageResponse("/addons/community.json", { addons: [], snapshot, fetch });
  assert.equal(live.headers.get("Cache-Control"), "public, max-age=0, s-maxage=300, stale-while-revalidate=3600");
  const body = await live.json();
  assert.equal(body.live, true);
  assert.deepEqual(body.addons.map(({ id, released }) => [id, released]), [["night", "2026-10-01"], ["doom", undefined]]);
  resetCommunityCache();
  const down = github({ "/commits?per_page=1": () => new Response("", { status: 502 }) });
  const fallback = await addonPageResponse("/addons/community.json", { addons: [], snapshot, fetch: down.fetch });
  assert.equal(fallback.headers.get("Cache-Control"), "public, max-age=0, s-maxage=60, stale-while-revalidate=600");
  assert.equal((await fallback.json()).addons[0].released, "2026-10-01");
});

test("the showcase mixes built-ins and community addons, newest six per order", () => {
  const addons = Array.from({ length: 8 }, (_, index) => ({
    id: `addon-${index}`, name: `addon ${index}`, description: "d", kind: index % 2 ? "theme" : undefined,
    origin: index < 4 ? "built-in" : "community", authors: [{ displayName: "may" }, { displayName: "rin" }],
    released: `2026-10-1${index}`, updated: `2026-10-2${7 - index}`,
  }));
  addons.push({ ...addons[0], id: "undated", name: "undated", released: undefined, updated: undefined });
  addons.push({ ...addons[1], id: "hostile", name: '<img src=x onerror="alert(1)">', released: "2026-10-30" });
  const html = renderShowcase(addons);
  const list = (order) => [...html.split(`data-sort="${order}"`)[1].split("</ol>")[0].matchAll(/href="\/addons\/([^"]+)"/g)].map((match) => match[1]);
  assert.deepEqual(list("released"), ["hostile", "addon-7", "addon-6", "addon-5", "addon-4", "addon-3"]);
  assert.deepEqual(list("updated"), ["addon-0", "hostile", "addon-1", "addon-2", "addon-3", "addon-4"], "same day: by name");
  assert.ok(!html.includes("<img"));
  assert.match(html, /<span class="addon-card-kind">community theme<\/span>/);
  assert.match(html, /<span class="addon-card-kind">extension<\/span>/);
  assert.match(html, /<span>may, rin<\/span><span>released 30\.x\.2026<\/span>/);
  assert.match(html, /<input type="radio" name="showcase-sort" value="released" checked \/>recently released/);
  assert.equal(renderShowcase(addons.filter((addon) => addon.id === "undated")), "");
});

test("the landing page keeps its marker or the build fails", () => {
  assert.throws(() => injectShowcase("<main></main>", [], []), /missing the addon showcase marker/);
  const html = injectShowcase("<div><!-- addon-showcase --></div>", [{ id: "a", name: "</script>", description: "d", authors: [], released: "2026-10-01", updated: "2026-10-01", html: "<p>readme</p>" }], []);
  assert.ok(!html.includes("readme"), "candidates carry only card fields");
  assert.equal(html.match(/<\/script>/g).length, 1, "names cannot close the data script");
});

test("builds start from the deployed snapshot's days and ignore anything malformed", async () => {
  const head = "a".repeat(40);
  const serve = (value, status = 200) => async () => new Response(JSON.stringify(value), { status });
  assert.deepEqual(
    await deployedSnapshot({ fetch: serve({ head, dates: { night: { released: "2026-10-01", updated: "2026-10-02", extra: 1 }, doom: { released: "soon" } }, addons: [{ id: "x" }] }) }),
    { head, dates: { night: { released: "2026-10-01", updated: "2026-10-02" } }, addons: [] },
  );
  const empty = { head: null, dates: {}, addons: [] };
  assert.deepEqual(await deployedSnapshot({ fetch: serve({ head: "main", dates: {} }) }), empty);
  assert.deepEqual(await deployedSnapshot({ fetch: serve({ head, dates: {} }, 404) }), empty);
  assert.deepEqual(await deployedSnapshot({ fetch: async () => { throw new Error("offline"); } }), empty);
});
