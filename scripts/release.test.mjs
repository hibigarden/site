import assert from "node:assert/strict";
import test from "node:test";
import { releaseResponse } from "../server/release.js";
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
const nightlyTag = "nightly-2026-10-26-3ac3ecc-84-1";
const nightlyRelease = {
  tag_name: nightlyTag,
  prerelease: true,
  published_at: "2026-10-27T08:00:34Z",
  assets: [
    asset("feed.json", 1754, undefined, nightlyTag),
    asset("hibi-0.2.2-nightly.20261026.g3ac3ecc.84.1-win-x64.exe", 140499546, "b".repeat(64), nightlyTag),
    asset("hibi-0.2.2-nightly.20261026.g3ac3ecc.84.1-mac-arm64.dmg", 160964020, "c".repeat(64), nightlyTag),
    asset("hibi-0.2.2-nightly.20261026.g3ac3ecc.84.1-linux-x64.AppImage", 1, undefined, "v0.2.1"),
  ],
};
const list = [
  nightlyRelease,
  { tag_name: "v0.2.1", published_at: "2026-10-25T18:44:12Z" },
  { tag_name: "v0.2.0", published_at: "2026-10-25T07:18:53Z" },
];
const nightly = { tag: "nightly-2026-10-26-3ac3ecc-84-1", version: "0.2.2-nightly.20261026.g3ac3ecc.84.1" };

test("reads installers, digests and the nightly's installers from GitHub", () => {
  const release = fromGitHub(github, { list, nightly });
  assert.equal(release.tag, "v0.2.1");
  assert.equal(release.sums, `${RELEASES}/download/v0.2.1/SHA256SUMS.txt`);
  const { files: nightlyFiles, ...nightlyFacts } = release.nightly;
  assert.deepEqual(nightlyFacts, { ...nightly, date: "2026-10-26", url: `${RELEASES}/tag/${nightly.tag}` });
  assert.deepEqual(
    nightlyFiles.map((file) => `${file.os}-${file.arch}.${file.type} ${file.sha256[0]}`),
    ["mac-arm64.dmg c", "windows-x64.exe b"],
    "the nightly's own installers, in the same order; files hosted under another tag are not",
  );
  assert.deepEqual(fromGitHub(github, { nightly }).nightly.files, [], "no installers when the list doesn't reach the nightly");
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

test("renders every build and the nightly's without javascript, and an honest fallback without data", () => {
  const html = renderDownloadPage(fromGitHub(github, { list, nightly }));
  assert.match(html, /download for macOS · apple silicon · \.dmg/);
  assert.match(html, /v0\.2\.1 · 153 MB · <span class="download-sha">sha256 <code title="c0528039[0-9a-f]+">c0528039…a58732/);
  assert.match(html, /<th role="rowheader" scope="rowgroup" rowspan="3">macOS<\/th>/);
  assert.match(html, /<code>c0528039067fbfe6638cec413940710508ec0cb21e6e4615f47ba5f180a58732<\/code>/);
  assert.match(html, /chmod \+x hibi-0\.2\.1-linux-x64\.AppImage/);
  assert.match(html, /0\.2\.2-nightly\.20261026\.g3ac3ecc\.84\.1<\/a>, from <time datetime="2026-10-26">26\.x\.2026/);
  assert.match(html, /<h2 class="section-title" id="download-nightly">the newest nightly<\/h2>/);
  assert.match(html, /<code>c{64}<\/code>/, "the nightly's builds have their own table");
  assert.match(html, new RegExp(`<a href="${RELEASES}">earlier versions`));
  assert.match(html, /<details class="download-question">\s*<summary>is hibi stable\?<\/summary>/);
  assert.doesNotMatch(renderDownloadPage(fromGitHub(github, { nightly })), /download-nightly/, "no nightly table without its installers");
  assert.doesNotMatch(html, /<\/script><script/);
  const plain = renderFallback();
  assert.match(plain, /releases\/latest/);
  assert.doesNotMatch(plain, /MB|<code/, "no numbers without data");
  assert.match(plain, /is hibi stable\?/);
});

function fakeGitHub({ latest = "v0.2.1", feed = { tag: "nightly-2026-10-27-0000000-85-1", version: "0.2.2-nightly.20261027.g0000000.85.1" }, api = github, fail = false } = {}) {
  const calls = [];
  const fetch = async (url) => {
    calls.push(url);
    if (fail) throw new Error("offline");
    if (url === `${RELEASES}/latest`) return new Response(null, { status: 302, headers: { location: `${RELEASES}/tag/${latest}` } });
    if (url.endsWith("/nightly/feed.json")) return Response.json(feed);
    if (url.endsWith("/releases/latest")) return Response.json(api);
    if (url.includes("/releases?")) return Response.json([api, { ...nightlyRelease, tag_name: feed.tag }]);
    return new Response(null, { status: 404 });
  };
  return { fetch, calls };
}

test("/api/release reuses the snapshot until a newer release or nightly is out", async () => {
  const snapshot = fromGitHub(github, { list, nightly });
  const same = fakeGitHub({ feed: nightly });
  const unchanged = await releaseResponse(snapshot, { fetch: same.fetch });
  assert.equal(unchanged.body, snapshot);
  assert.ok(!same.calls.some((url) => url.startsWith("https://api.github.com/")), "no api request for an unchanged release");
  assert.match(unchanged.cache, /s-maxage=300/);

  const nightlyOut = fakeGitHub();
  const fresh = await releaseResponse(snapshot, { fetch: nightlyOut.fetch });
  assert.equal(fresh.body.tag, "v0.2.1");
  assert.equal(fresh.body.nightly.tag, "nightly-2026-10-27-0000000-85-1");
  assert.equal(fresh.body.nightly.files.length, 0, "files under another tag are not the new nightly's");
  assert.equal(nightlyOut.calls.filter((url) => url.startsWith("https://api.github.com/")).length, 1, "one api request for a new nightly");

  const newer = fakeGitHub({ latest: "v0.2.2", api: { tag_name: "v0.2.2", assets: [asset("hibi-0.2.2-win-x64.exe", 1, undefined, "v0.2.2")] } });
  assert.equal((await releaseResponse(snapshot, { fetch: newer.fetch })).body.tag, "v0.2.2");

  const offline = await releaseResponse(snapshot, { fetch: fakeGitHub({ fail: true }).fetch });
  assert.equal(offline.body, snapshot);
  assert.match(offline.cache, /s-maxage=60/);
  await assert.rejects(releaseResponse(null, { fetch: fakeGitHub({ fail: true }).fetch }));
});
