// hibi's downloads: the latest release's installers by platform, read from GitHub's releases api. the build
// renders them into the page and saves a snapshot (server/release.js), /api/release keeps them current, and
// src/download.js picks the reader's platform. shared by all three, so nothing here touches node or the dom.
export const REPOSITORY = "https://github.com/schmayterling/hibi";
export const RELEASES = `${REPOSITORY}/releases`;

const FILE = /^hibi-[\w.-]+-(mac|win|linux)-(arm64|x64)\.(dmg|zip|exe|AppImage|deb|flatpak)$/;
const TAG = /^[\w.-]{1,100}$/;
const SHA256 = /^sha256:([0-9a-f]{64})$/;

/** the choices per platform, in the order they are offered; the first of each is the default */
export const PLATFORMS = [
  { os: "windows", label: "windows", archs: [["x64", "x64"]], types: ["exe"] },
  { os: "linux", label: "linux", archs: [["x64", "x64"], ["arm64", "arm64"]], types: ["AppImage", "deb", "flatpak"] },
  { os: "mac", label: "macOS", archs: [["arm64", "apple silicon"], ["x64", "intel"]], types: ["dmg", "zip"] },
];

const download = (url, tag) =>
  typeof url === "string" && url.startsWith(`${RELEASES}/download/${tag}/`) && !/["'<>\s]/.test(url) ? url : null;

/** GitHub's release json (+ the nightly feed's tag) -> the few facts the page shows */
export function fromGitHub(release, nightlyTag) {
  const tag = release?.tag_name;
  if (!TAG.test(tag ?? "")) throw new Error("release without a usable tag");
  const files = [];
  for (const asset of release.assets ?? []) {
    const match = FILE.exec(asset?.name ?? "");
    const url = download(asset?.browser_download_url, tag);
    if (!match || !url || !Number.isSafeInteger(asset.size)) continue;
    files.push({
      os: match[1] === "win" ? "windows" : match[1],
      arch: match[2],
      type: match[3],
      url,
      size: asset.size,
      sha256: SHA256.exec(asset.digest ?? "")?.[1] ?? null,
    });
  }
  if (!files.length) throw new Error(`release ${tag} has no installers`);
  const sums = release.assets.find((asset) => asset?.name === "SHA256SUMS.txt");
  return {
    tag,
    url: `${RELEASES}/tag/${tag}`,
    sums: download(sums?.browser_download_url, tag),
    nightly: nightlyUrl(nightlyTag),
    files,
  };
}

/** the newest nightly's release page, or the release list when the nightly feed couldn't be read */
export const nightlyUrl = (tag) => (TAG.test(tag ?? "") ? `${RELEASES}/tag/${tag}` : RELEASES);

/** sizes the way GitHub's release page shows them (MiB, three figures, called MB) */
export const formatSize = (bytes) => `${Number((bytes / 1024 ** 2).toPrecision(3))} MB`;
export const shortHash = (hash) => `${hash.slice(0, 8)}…${hash.slice(-6)}`;

/** the file for a choice, falling back to the platform's defaults when that build is missing */
export function pick(release, { os, arch, type }) {
  const files = release.files.filter((file) => file.os === os);
  return (
    files.find((file) => file.arch === arch && file.type === type) ??
    files.find((file) => file.arch === arch) ??
    files.find((file) => file.type === type) ??
    files[0] ??
    null
  );
}

export const DEFAULT = { os: "mac", arch: "arm64", type: "dmg" };

const escape = (text) => String(text).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const options = (name, values, current) =>
  values.map(([value, label]) => `<button type="button" class="download-opt" data-${name}="${value}" aria-pressed="${value === current}">${escape(label)}</button>`).join("");

/** the platform's processor and package choices (rebuilt when the platform changes) */
export function choices(release, { os, arch, type }) {
  const platform = PLATFORMS.find((p) => p.os === os);
  const has = (key, value) => release.files.some((file) => file.os === os && file[key] === value);
  const archs = platform.archs.filter(([value]) => has("arch", value));
  const types = platform.types.filter((value) => has("type", value)).map((value) => [value, value]);
  return [
    archs.length > 1 ? `<span class="download-group" role="group" aria-label="processor">${options("arch", archs, arch)}</span>` : "",
    types.length > 1 ? `<span class="download-group" role="group" aria-label="package">${options("type", types, type)}</span>` : "",
  ].join("");
}

/** the whole block as static html: the default choice works without javascript (the switches need it) */
export function renderDownload(release, choice = DEFAULT) {
  const file = release && pick(release, choice);
  if (!file) {
    // no release data at build time: a plain link to the newest release, no numbers we can't vouch for
    return `<div class="download"><a class="button cta-primary download-get" href="${RELEASES}/latest"><span class="button-icon" data-button-icon="download" aria-hidden="true"></span>download hibi<span class="beta-tag">beta</span></a><p class="download-links"><a href="${RELEASES}">all downloads</a></p></div>`;
  }
  const platform = PLATFORMS.find((p) => p.os === file.os);
  const hash = file.sha256 ?? "";
  return `<div class="download" data-download>
  <a class="button cta-primary download-get" href="${escape(file.url)}" data-get
    ><span class="button-icon" data-button-icon="download" aria-hidden="true"></span><span data-get-label>download hibi for ${platform.label}</span><span class="beta-tag">beta</span></a
  >
  <div class="download-pick" data-pick hidden>
    <span class="download-group" role="group" aria-label="platform">${options("os", PLATFORMS.map((p) => [p.os, p.label]), file.os)}</span>
    <span data-choices>${choices(release, { ...choice, os: file.os, arch: file.arch, type: file.type })}</span>
  </div>
  <p class="download-facts" data-facts><span data-version>${escape(release.tag)}</span> · <span data-size>${formatSize(file.size)}</span><span data-sha${hash ? "" : " hidden"}> · sha256 <code class="download-hash" data-hash title="${hash}">${hash && shortHash(hash)}</code></span><button type="button" class="download-copy" data-copy hidden>copy</button><span class="sr-only" aria-live="polite" data-copied></span></p>
  <p class="download-links">
    <a href="${escape(release.url)}" data-notes>release notes</a>${release.sums ? ` · <a href="${escape(release.sums)}" data-sums>SHA256SUMS.txt</a>` : ""} · <a href="${RELEASES}">all downloads</a> · <a href="${escape(release.nightly)}" data-nightly>nightly builds</a>
  </p>
  <script type="application/json" data-release>${JSON.stringify(release).replace(/</g, "\\u003c")}</script>
</div>`;
}
