// hibi's downloads: the latest release's installers by platform, read from GitHub's releases api. the build
// renders the /download page from it and saves a snapshot (server/release.js), /api/release keeps it current,
// and src/download.js preselects the reader's platform. shared by all three: nothing here touches node or the dom.
export const REPOSITORY = "https://github.com/schmayterling/hibi";
export const RELEASES = `${REPOSITORY}/releases`;

const FILE = /^hibi-[\w.-]+-(mac|win|linux)-(arm64|x64)\.(dmg|zip|exe|AppImage|deb|flatpak)$/;
const TAG = /^[\w.-]{1,100}$/;
const SHA256 = /^sha256:([0-9a-f]{64})$/;

/** the choices per platform, in the order they are offered; the first of each is the recommended one */
export const PLATFORMS = [
  { os: "mac", id: "macos", label: "macOS", archs: [["arm64", "apple silicon"], ["x64", "intel"]], types: ["dmg", "zip"] },
  { os: "windows", id: "windows", label: "windows", archs: [["x64", "x64"]], types: ["exe"] },
  { os: "linux", id: "linux", label: "linux", archs: [["x64", "x64"], ["arm64", "arm64"]], types: ["AppImage", "deb", "flatpak"] },
];
export const DEFAULT = { os: "mac", arch: "arm64" };

const platform = (os) => PLATFORMS.find((p) => p.os === os);
const archLabel = (os, arch) => platform(os).archs.find(([value]) => value === arch)?.[1] ?? arch;
const download = (url, tag) =>
  typeof url === "string" && url.startsWith(`${RELEASES}/download/${tag}/`) && !/["'<>\s]/.test(url) ? url : null;

/** a platform choice as the url hash /download understands (#macos-arm64), and back */
export const platformId = ({ os, arch }) => `${platform(os).id}-${arch}`;
export function fromPlatformId(id) {
  const [name, arch] = String(id).replace(/^#/, "").split("-");
  const p = PLATFORMS.find((entry) => entry.id === name);
  return p?.archs.some(([value]) => value === arch) ? { os: p.os, arch } : null;
}

/** a release's installers hosted under its own tag, ordered by system, processor, then package */
function installers(release, tag) {
  const files = [];
  for (const asset of release?.assets ?? []) {
    const match = FILE.exec(asset?.name ?? "");
    const url = download(asset?.browser_download_url, tag);
    if (!match || !url || !Number.isSafeInteger(asset.size)) continue;
    files.push({
      os: match[1] === "win" ? "windows" : match[1],
      arch: match[2],
      type: match[3],
      name: asset.name,
      url,
      size: asset.size,
      sha256: SHA256.exec(asset.digest ?? "")?.[1] ?? null,
    });
  }
  const order = (file) =>
    PLATFORMS.findIndex((p) => p.os === file.os) * 100 +
    platform(file.os).archs.findIndex(([value]) => value === file.arch) * 10 +
    platform(file.os).types.indexOf(file.type);
  return files.sort((a, b) => order(a) - order(b));
}

/**
 * GitHub's latest release (+ the release list and the nightly feed) -> the facts the page shows, all validated
 * here. the nightly's installers come from its release in the list, when the list reaches it.
 */
export function fromGitHub(release, { list = [], nightly = null } = {}) {
  const tag = release?.tag_name;
  if (!TAG.test(tag ?? "")) throw new Error("release without a usable tag");
  const files = installers(release, tag);
  if (!files.length) throw new Error(`release ${tag} has no installers`);
  const sums = release.assets.find((asset) => asset?.name === "SHA256SUMS.txt");
  return {
    tag,
    sums: download(sums?.browser_download_url, tag),
    nightly: nightlyFromFeed(nightly, list.find((entry) => entry?.tag_name === nightly?.tag)),
    files,
  };
}

/** the nightly channel's newest build, from its feed.json ({ tag, version }) and its release; its date is in the tag */
export function nightlyFromFeed(feed, release) {
  if (!TAG.test(feed?.tag ?? "") || !/^[\w.+-]{1,100}$/.test(feed.version ?? "")) return null;
  return {
    tag: feed.tag,
    version: feed.version,
    date: feed.tag.match(/^nightly-(\d{4}-\d{2}-\d{2})-/)?.[1] ?? null,
    url: `${RELEASES}/tag/${feed.tag}`,
    files: installers(release, feed.tag),
  };
}

/** sizes the way GitHub's release page shows them (MiB, three figures, called MB) */
export const formatSize = (bytes) => `${Number((bytes / 1024 ** 2).toPrecision(3))} MB`;
export const shortHash = (hash) => `${hash.slice(0, 8)}…${hash.slice(-6)}`;
const ROMAN = ["i", "ii", "iii", "iv", "v", "vi", "vii", "viii", "ix", "x", "xi", "xii"];
/** the site's dates: 25.x.2026 */
export const siteDate = (iso) => (iso ? `${Number(iso.slice(8, 10))}.${ROMAN[Number(iso.slice(5, 7)) - 1]}.${iso.slice(0, 4)}` : "");

/** the recommended file for a platform choice (its first package), or the platform's first build */
export function pick(release, { os, arch }) {
  const files = release.files.filter((file) => file.os === os);
  return files.find((file) => file.arch === arch) ?? files[0] ?? release.files[0] ?? null;
}

const escape = (text) => String(text).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const ICON =
  '<svg class="button-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 15V3"/><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/></svg>';
const copy = (hash) => `<button type="button" class="download-copy" data-copy="${hash}" aria-label="copy the full sha256" hidden>copy</button>`;
const time = (iso) => (iso ? `<time datetime="${iso}">${siteDate(iso)}</time>` : "");
export const fileLabel = (file) => `${platform(file.os).label} · ${archLabel(file.os, file.arch)} · .${file.type}`;

/** the recommended download at the top of the page (rebuilt when the platform is preselected) */
export function renderPick(release, file) {
  return `<a class="button cta-primary download-get" href="${escape(file.url)}">${ICON}<span>download for ${escape(fileLabel(file))}</span></a>
      <p class="download-facts">${escape(release.tag)} · ${formatSize(file.size)}${file.sha256 ? ` · <span class="download-sha">sha256 <code title="${file.sha256}">${shortHash(file.sha256)}</code></span>${copy(file.sha256)}` : ""}</p>`;
}

/** a table of builds, one row group per system so its name heads all of its rows */
function buildTable(files) {
  const groups = PLATFORMS.map((p) => {
    const rows = files.filter((file) => file.os === p.os);
    if (!rows.length) return "";
    return `<tbody role="rowgroup">
            ${rows
      .map(
        (file, i) => `<tr role="row" data-platform="${platformId(file)}">
              ${i === 0 ? `<th role="rowheader" scope="rowgroup" rowspan="${rows.length}">${p.label}</th>` : ""}<td role="cell">${escape(archLabel(file.os, file.arch))}</td>
              <td role="cell"><a href="${escape(file.url)}">.${file.type}</a></td>
              <td role="cell" class="download-size">${formatSize(file.size)}</td>
              <td role="cell" class="download-hash">${file.sha256 ? `<code>${file.sha256}</code>${copy(file.sha256)}` : "see SHA256SUMS.txt"}</td>
            </tr>`,
      )
      .join("\n            ")}
          </tbody>`;
  }).join("\n          ");
  return `<div class="download-ledger">
        <table class="download-table" role="table">
          <thead role="rowgroup">
            <tr role="row"><th role="columnheader" scope="col">system</th><th role="columnheader" scope="col">processor</th><th role="columnheader" scope="col">file</th><th role="columnheader" scope="col">size</th><th role="columnheader" scope="col">sha256</th></tr>
          </thead>
          ${groups}
        </table>
      </div>`;
}

const STABLE = `<details class="faq-item">
        <summary>is hibi stable?</summary>
        <p>bugs, slowdowns, and crashes can happen. addons are especially experimental and still being improved. if something breaks, please <a href="${REPOSITORY}/issues">file an issue</a> so i can keep track and work on a fix.</p>
        <p>if you need a stable app, please check back later. this is a hobby project, so i can’t promise immediate fixes or new features. <a href="${REPOSITORY}/pulls">contributions and pull requests</a> are always welcome.</p>
      </details>`;
const questions = (...items) => `<section class="download-section faq" aria-labelledby="download-faq">
      <h2 class="section-title" id="download-faq">questions</h2>
      ${items.join("\n      ")}
    </section>`;

/** every section of /download below the page title, as static html */
export function renderDownloadPage(release) {
  const example = (os, arch, type) =>
    release.files.find((f) => f.os === os && f.arch === arch && f.type === type)?.name ??
    `hibi-${release.tag.replace(/^v/, "")}-${{ mac: "mac", windows: "win", linux: "linux" }[os]}-${arch}.${type}`;
  const nightly = release.nightly;
  return `<div class="download-pick">
      <div data-pick>${renderPick(release, pick(release, DEFAULT))}</div>
      <p class="download-other">not your computer? every build of ${escape(release.tag)} is below.</p>
    </div>
    <section class="download-section" aria-labelledby="download-all">
      <h2 class="section-title" id="download-all">every build of ${escape(release.tag)}</h2>
      ${buildTable(release.files)}
    </section>
    ${nightly?.files?.length ? `<section class="download-section" aria-labelledby="download-nightly">
      <h2 class="section-title" id="download-nightly">the newest nightly</h2>
      <p class="download-other"><a href="${escape(nightly.url)}">${escape(nightly.version)}</a>${nightly.date ? ` · ${time(nightly.date)}` : ""} · bleeding edge and may be broken, so back up your notes first.</p>
      ${buildTable(nightly.files)}
    </section>` : ""}
    <p class="download-releases"><a href="${RELEASES}">earlier versions and what changed in each, on github</a></p>
    ${questions(
      `<details class="faq-item">
        <summary>how do i install hibi?</summary>
        <h3>macOS</h3>
        <p>open the .dmg and move hibi to Applications. the macOS builds are signed and notarized, and hibi updates itself from there.</p>
        <h3>windows</h3>
        <p>run the installer. the windows builds aren’t signed yet, so SmartScreen may warn you the first time.</p>
        <h3>linux</h3>
        <p>the AppImage runs once it is allowed to execute, and updates itself:</p>
        <pre><code>chmod +x ${escape(example("linux", "x64", "AppImage"))}
./${escape(example("linux", "x64", "AppImage"))}</code></pre>
        <p>the .deb and the flatpak install like this, and update by installing a newer one the same way. the flatpak needs <a href="https://flathub.org/setup">flathub</a> set up for its runtime.</p>
        <pre><code>sudo apt install ./${escape(example("linux", "x64", "deb"))}
flatpak install --user ./${escape(example("linux", "x64", "flatpak"))}</code></pre>
        <p>use the arm64 files on 64-bit arm computers. more in the <a href="https://docs.hibi.garden/">user guide</a>.</p>
      </details>`,
      `<details class="faq-item">
        <summary>how do i check a download?</summary>
        <p>compare the file’s sha256 with the one in the table${release.sums ? ` or in <a href="${escape(release.sums)}">SHA256SUMS.txt</a>` : ""}.</p>
        <h3>macOS</h3>
        <pre><code>shasum -a 256 ${escape(example("mac", "arm64", "dmg"))}</code></pre>
        <h3>windows (powershell)</h3>
        <pre><code>Get-FileHash .\\${escape(example("windows", "x64", "exe"))} -Algorithm SHA256</code></pre>
        <h3>linux</h3>
        <pre><code>sha256sum ${escape(example("linux", "x64", "AppImage"))}</code></pre>
      </details>`,
      `<details class="faq-item">
        <summary>what are beta and nightly?</summary>
        <h3>beta</h3>
        <p>numbered releases that passed every check on every platform. this page offers the newest one, ${escape(release.tag)}.</p>
        <h3>nightly</h3>
        <p>a build of the newest code every day. nightlies are bleeding edge and may be broken, so back up your notes first.${nightly ? ` the newest is <a href="${escape(nightly.url)}">${escape(nightly.version)}</a>${nightly.date ? `, from ${time(nightly.date)}` : ""}.` : ` <a href="${RELEASES}">see the releases</a>.`}</p>
        <p>you can switch channels in hibi under about → updates.</p>
      </details>`,
      STABLE,
    )}
    <script type="application/json" data-release>${JSON.stringify(release).replace(/</g, "\\u003c")}</script>`;
}

/** without release data at build time: an honest pointer to GitHub's release page, no numbers */
export const renderFallback = () =>
  `<div class="download-pick"><a class="button cta-primary download-get" href="${RELEASES}/latest">${ICON}<span>download the latest release</span></a>
      <p class="download-other">every build, its size and sha256 are on <a href="${RELEASES}/latest">github</a>.</p></div>
    ${questions(STABLE)}`;
