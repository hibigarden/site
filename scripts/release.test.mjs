import assert from "node:assert/strict";
import test from "node:test";
import { releaseResponse, renderNotes } from "../server/release.js";
import { RELEASES, formatSize, fromGitHub, fromPlatformId, pick, platformId, renderDownloadPage, renderFallback, siteDate } from "../src/release.js";

const asset = (name, size, hash = "a".repeat(64), tag = "v0.2.1") => ({
  name,
  size,
  digest: `sha256:${hash}`,
  browser_download_url: `${RELEASES}/download/${tag}/${name}`,
});
const github = {
  tag_name: "v0.2.1",
  name: "hibi 0.2.1 (beta)",
  published_at: "2026-10-25T18:44:12Z",
  body: "this beta was built from sha `ac6b879`.\n\n- linux-x64: checks success\n\n<script>alert(1)</script>[logs](javascript:alert(1))",
  assets: [
    asset("hibi-0.2.1-linux-arm64.deb", 141180824),
    asset("hibi-0.2.1-mac-x64.dmg", 170379816),
    asset("hibi-0.2.1-mac-arm64.zip", 158667505),
    asset("hibi-0.2.1-mac-arm64.dmg", 160586429, "c0528039067fbfe6638cec413940710508ec0cb21e6e4615f47ba5f180a58732"),
    asset("hibi-0.2.1-win-x64.exe", 139478098),
    asset("hibi-0.2.1-linux-x64.AppImage", 185664677),
    asset("latest-mac.yml", 551),
    asset("SHA256SUMS.txt", 1041),
    { ...asset("hibi-0.2.1-linux-x64.deb", 1), browser_download_url: "https://example.com/hibi-0.2.1-linux-x64.deb" },
  ],
};
const list = [
  { tag_name: "nightly-2026-10-26-3ac3ecc-84-1", prerelease: true, published_at: "2026-10-27T08:00:34Z" },
  { tag_name: "v0.2.1", published_at: "2026-10-25T18:44:12Z" },
  { tag_name: "v0.2.0", published_at: "2026-10-25T07:18:53Z" },
];
const nightly = { tag: "nightly-2026-10-26-3ac3ecc-84-1", version: "0.2.2-nightly.20261026.g3ac3ecc.84.1" };

test("reads installers, digests, earlier releases and the nightly from GitHub", () => {
  const release = fromGitHub(github, { list, nightly });
  assert.equal(release.tag, "v0.2.1");
  assert.equal(release.date, "2026-10-25");
  assert.equal(release.sums, `${RELEASES}/download/v0.2.1/SHA256SUMS.txt`);
  assert.deepEqual(release.nightly, { ...nightly, date: "2026-10-26", url: `${RELEASES}/tag/${nightly.tag}` });
  assert.deepEqual(release.earlier, [{ tag: "v0.2.0", date: "2026-10-25", url: `${RELEASES}/tag/v0.2.0` }]);
  assert.equal(release.files.length, 6, "update feeds, sums and foreign urls are not installers");
  assert.deepEqual(
    release.files.map((file) => `${file.os}-${file.arch}.${file.type}`),
    ["mac-arm64.dmg", "mac-arm64.zip", "mac-x64.dmg", "windows-x64.exe", "linux-x64.AppImage", "linux-arm64.deb"],
    "ordered by system, processor, then package",
  );
  assert.equal(release.files[0].sha256, "c0528039067fbfe6638cec413940710508ec0cb21e6e4615f47ba5f180a58732");
  assert.equal(fromGitHub(github).nightly, null);
  assert.throws(() => fromGitHub({ tag_name: "v1", assets: [] }), /no installers/);
});

test("formats sizes and dates like the site, and round-trips platform hashes", () => {
  assert.equal(formatSize(160586429), "153 MB");
  assert.equal(formatSize(139478098), "133 MB");
  assert.equal(siteDate("2026-10-25"), "25.x.2026");
  assert.deepEqual(fromPlatformId("#macos-arm64"), { os: "mac", arch: "arm64" });
  assert.equal(fromPlatformId("#windows-arm64"), null);
  assert.equal(platformId({ os: "linux", arch: "arm64" }), "linux-arm64");
  const release = fromGitHub(github);
  assert.equal(pick(release, { os: "linux", arch: "arm64" }).type, "deb");
  assert.equal(pick(release, { os: "mac", arch: "x64" }).type, "dmg");
});

test("release notes render as sanitized markdown", () => {
  const html = renderNotes(github.body);
  assert.match(html, /<code>ac6b879<\/code>/);
  assert.match(html, /<li>linux-x64: checks success<\/li>/);
  assert.doesNotMatch(html, /<script|href="javascript:/);
  assert.equal(renderNotes(""), "");
});

test("renders every build without javascript, and an honest fallback without data", () => {
  const html = renderDownloadPage(fromGitHub(github, { notes: renderNotes(github.body), list, nightly }));
  assert.match(html, /download for macOS · apple silicon · \.dmg/);
  assert.match(html, /v0\.2\.1 · 153 MB · <span class="download-sha">sha256 <code title="c0528039[0-9a-f]+">c0528039…a58732/);
  assert.match(html, /<th role="rowheader" scope="rowgroup" rowspan="3">macOS<\/th>/);
  assert.match(html, /<code>c0528039067fbfe6638cec413940710508ec0cb21e6e4615f47ba5f180a58732<\/code>/);
  assert.match(html, /chmod \+x hibi-0\.2\.1-linux-x64\.AppImage/);
  assert.match(html, /0\.2\.2-nightly\.20261026\.g3ac3ecc\.84\.1<\/a>, from <time datetime="2026-10-26">26\.x\.2026/);
  assert.match(html, /v0\.2\.0<\/a> · <time/);
  assert.doesNotMatch(html, /<\/script><script/);
  const plain = renderFallback();
  assert.match(plain, /releases\/latest/);
  assert.doesNotMatch(plain, /MB|<code/, "no numbers without data");
});

function fakeGitHub({ latest = "v0.2.1", feed = { tag: "nightly-2026-10-27-0000000-85-1", version: "0.2.2-nightly.20261027.g0000000.85.1" }, api = github, fail = false } = {}) {
  const calls = [];
  const fetch = async (url) => {
    calls.push(url);
    if (fail) throw new Error("offline");
    if (url === `${RELEASES}/latest`) return new Response(null, { status: 302, headers: { location: `${RELEASES}/tag/${latest}` } });
    if (url.endsWith("/nightly/feed.json")) return Response.json(feed);
    if (url.endsWith("/releases/latest")) return Response.json(api);
    if (url.includes("/releases?")) return Response.json([api]);
    return new Response(null, { status: 404 });
  };
  return { fetch, calls };
}

test("/api/release reuses the snapshot until a newer release is out", async () => {
  const snapshot = fromGitHub(github, { list, nightly });
  const same = fakeGitHub();
  const fresh = await releaseResponse(snapshot, { fetch: same.fetch });
  assert.equal(fresh.body.tag, "v0.2.1");
  assert.equal(fresh.body.nightly.tag, "nightly-2026-10-27-0000000-85-1");
  assert.ok(!same.calls.some((url) => url.startsWith("https://api.github.com/")), "no api request for an unchanged release");
  assert.match(fresh.cache, /s-maxage=300/);

  const newer = fakeGitHub({ latest: "v0.2.2", api: { tag_name: "v0.2.2", assets: [asset("hibi-0.2.2-win-x64.exe", 1, undefined, "v0.2.2")] } });
  assert.equal((await releaseResponse(snapshot, { fetch: newer.fetch })).body.tag, "v0.2.2");

  const offline = await releaseResponse(snapshot, { fetch: fakeGitHub({ fail: true }).fetch });
  assert.equal(offline.body, snapshot);
  assert.match(offline.cache, /s-maxage=60/);
  await assert.rejects(releaseResponse(null, { fetch: fakeGitHub({ fail: true }).fetch }));
});
