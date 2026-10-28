import assert from "node:assert/strict";
import test from "node:test";
import { releaseResponse } from "../server/release.js";
import { RELEASES, formatSize, fromGitHub, pick, renderDownload } from "../src/release.js";

const asset = (name, size, hash = "a".repeat(64), tag = "v0.2.1") => ({
  name,
  size,
  digest: `sha256:${hash}`,
  browser_download_url: `${RELEASES}/download/${tag}/${name}`,
});
const github = {
  tag_name: "v0.2.1",
  html_url: `${RELEASES}/tag/v0.2.1`,
  assets: [
    asset("hibi-0.2.1-mac-arm64.dmg", 160586429, "c0528039067fbfe6638cec413940710508ec0cb21e6e4615f47ba5f180a58732"),
    asset("hibi-0.2.1-mac-x64.dmg", 170379816),
    asset("hibi-0.2.1-mac-arm64.zip", 158667505),
    asset("hibi-0.2.1-win-x64.exe", 139478098),
    asset("hibi-0.2.1-linux-x64.AppImage", 185664677),
    asset("hibi-0.2.1-linux-arm64.deb", 141180824),
    asset("latest-mac.yml", 551),
    asset("SHA256SUMS.txt", 1041),
    { ...asset("hibi-0.2.1-linux-x64.deb", 1), browser_download_url: "https://example.com/hibi-0.2.1-linux-x64.deb" },
  ],
};

test("reads installers, sizes and digests from GitHub's release json", () => {
  const release = fromGitHub(github, "nightly-2026-10-26-3ac3ecc-84-1");
  assert.equal(release.tag, "v0.2.1");
  assert.equal(release.sums, `${RELEASES}/download/v0.2.1/SHA256SUMS.txt`);
  assert.equal(release.nightly, `${RELEASES}/tag/nightly-2026-10-26-3ac3ecc-84-1`);
  assert.equal(release.files.length, 6, "update feeds, sums and foreign urls are not installers");
  assert.deepEqual(release.files[0], {
    os: "mac",
    arch: "arm64",
    type: "dmg",
    url: `${RELEASES}/download/v0.2.1/hibi-0.2.1-mac-arm64.dmg`,
    size: 160586429,
    sha256: "c0528039067fbfe6638cec413940710508ec0cb21e6e4615f47ba5f180a58732",
  });
  assert.equal(fromGitHub(github).nightly, RELEASES);
  assert.throws(() => fromGitHub({ tag_name: "v1", assets: [] }), /no installers/);
});

test("formats sizes like GitHub and falls back to a platform's other builds", () => {
  assert.equal(formatSize(160586429), "153 MB");
  assert.equal(formatSize(139478098), "133 MB");
  const release = fromGitHub(github);
  assert.equal(pick(release, { os: "linux", arch: "arm64", type: "AppImage" }).type, "deb");
  assert.equal(pick(release, { os: "windows", arch: "arm64", type: "exe" }).arch, "x64");
});

test("renders the default download, and a plain link without release data", () => {
  const html = renderDownload(fromGitHub(github));
  assert.match(html, /download hibi for macOS/);
  assert.match(html, /v0\.2\.1<\/span> · <span data-size>153 MB/);
  assert.match(html, /c0528039…a58732/);
  assert.match(html, /hibi-0\.2\.1-mac-arm64\.dmg/);
  assert.doesNotMatch(html, /<\/script><script/);
  const plain = renderDownload(null);
  assert.match(plain, /releases\/latest/);
  assert.doesNotMatch(plain, /MB|sha256/);
});

function fakeGitHub({ latest = "v0.2.1", nightly = "nightly-2026-10-27-0000000-85-1", api = github, fail = false } = {}) {
  const calls = [];
  const fetch = async (url) => {
    calls.push(url);
    if (fail) throw new Error("offline");
    if (url === `${RELEASES}/latest`) return new Response(null, { status: 302, headers: { location: `${RELEASES}/tag/${latest}` } });
    if (url.endsWith("/nightly/feed.json")) return Response.json({ tag: nightly });
    if (url.startsWith("https://api.github.com/")) return Response.json(api);
    return new Response(null, { status: 404 });
  };
  return { fetch, calls };
}

test("/api/release reuses the snapshot until a newer release is out", async () => {
  const snapshot = fromGitHub(github, "nightly-old");
  const same = fakeGitHub();
  const fresh = await releaseResponse(snapshot, { fetch: same.fetch });
  assert.equal(fresh.body.tag, "v0.2.1");
  assert.equal(fresh.body.nightly, `${RELEASES}/tag/nightly-2026-10-27-0000000-85-1`);
  assert.ok(!same.calls.some((url) => url.startsWith("https://api.github.com/")), "no api request for an unchanged release");
  assert.match(fresh.cache, /s-maxage=300/);

  const newer = fakeGitHub({ latest: "v0.2.2", api: { tag_name: "v0.2.2", assets: [asset("hibi-0.2.2-win-x64.exe", 1, undefined, "v0.2.2")] } });
  assert.equal((await releaseResponse(snapshot, { fetch: newer.fetch })).body.tag, "v0.2.2");

  const offline = await releaseResponse(snapshot, { fetch: fakeGitHub({ fail: true }).fetch });
  assert.equal(offline.body, snapshot);
  assert.match(offline.cache, /s-maxage=60/);
  await assert.rejects(releaseResponse(null, { fetch: fakeGitHub({ fail: true }).fetch }));
});
