import { DEFAULT, PLATFORMS, RELEASES, choices, formatSize, pick, shortHash } from "./release.js";

// The download blocks (hero and the closing sky) share one choice: the reader's platform when the browser
// tells us, else the build's default (Apple silicon macOS). Browsers can't always tell Apple silicon from Intel,
// so both stay one click apart. The release itself is the build's snapshot until /api/release has a newer one.
const blocks = [...document.querySelectorAll("[data-download]")];
let release = blocks.length ? JSON.parse(blocks[0].querySelector("[data-release]").textContent) : null;
let choice = { ...DEFAULT, ...detect() };
let touched = false;

function defaults(os, arch) {
  const platform = PLATFORMS.find((p) => p.os === os);
  const archs = platform.archs.map(([value]) => value);
  return { os, arch: archs.includes(arch) ? arch : archs[0], type: platform.types[0] };
}

function detect() {
  const ua = navigator.userAgent;
  const platform = `${navigator.userAgentData?.platform ?? ""} ${navigator.platform ?? ""}`;
  const arm = /aarch64|arm64|armv8/i.test(`${ua} ${platform}`);
  if (/android|iphone|ipod/i.test(ua)) return {}; // no phone app: keep the default
  if (/win/i.test(platform) || /windows/i.test(ua)) return defaults("windows");
  if (/mac/i.test(platform) || /macintosh|mac os x/i.test(ua)) return defaults("mac");
  if (/linux|x11|cros/i.test(`${platform} ${ua}`)) return defaults("linux", arm ? "arm64" : "x64");
  return {};
}

function update() {
  const file = pick(release, choice);
  if (!file) return;
  for (const block of blocks) {
    const focused = block.contains(document.activeElement) ? document.activeElement : null;
    for (const button of block.querySelectorAll("[data-os]")) button.setAttribute("aria-pressed", button.dataset.os === file.os);
    const slot = block.querySelector("[data-choices]");
    slot.innerHTML = choices(release, file);
    // a rebuilt processor or package button keeps the keyboard where it was
    if (focused && !focused.isConnected) slot.querySelector(`[data-arch="${focused.dataset.arch}"], [data-type="${focused.dataset.type}"]`)?.focus();
    const get = block.querySelector("[data-get]");
    get.href = file.url;
    get.querySelector("[data-get-label]").textContent = `download hibi for ${PLATFORMS.find((p) => p.os === file.os).label}`;
    block.querySelector("[data-version]").textContent = release.tag;
    block.querySelector("[data-size]").textContent = formatSize(file.size);
    const hash = block.querySelector("[data-hash]");
    hash.textContent = file.sha256 ? shortHash(file.sha256) : "";
    hash.title = file.sha256 ?? "";
    block.querySelector("[data-sha]").hidden = !file.sha256;
    block.querySelector("[data-copy]").hidden = !file.sha256 || !navigator.clipboard;
    block.querySelector("[data-notes]").href = release.url;
    const sums = block.querySelector("[data-sums]");
    if (sums && release.sums) sums.href = release.sums;
    block.querySelector("[data-nightly]").href = release.nightly;
  }
}

async function copy(block, button) {
  const { sha256 } = pick(release, choice);
  const status = block.querySelector("[data-copied]");
  try {
    await navigator.clipboard.writeText(sha256);
    button.textContent = "copied";
    status.textContent = "sha256 copied";
  } catch {
    button.textContent = "copy failed";
  }
  setTimeout(() => {
    button.textContent = "copy";
    status.textContent = "";
  }, 1600);
}

if (release) {
  for (const block of blocks) {
    block.querySelector("[data-pick]").hidden = false;
    block.addEventListener("click", (event) => {
      const button = event.target.closest("button");
      if (!button) return;
      if (button.matches("[data-copy]")) return copy(block, button);
      touched = true;
      if (button.dataset.os) choice = defaults(button.dataset.os, choice.arch);
      else if (button.dataset.arch) choice = { ...choice, arch: button.dataset.arch };
      else if (button.dataset.type) choice = { ...choice, type: button.dataset.type };
      else return;
      update();
    });
  }
  update();
  // high-entropy client hints can tell an Apple silicon or arm Linux machine apart (Chromium only)
  navigator.userAgentData
    ?.getHighEntropyValues?.(["architecture"])
    .then(({ architecture }) => {
      const arch = { arm: "arm64", x86: "x64" }[architecture];
      if (touched || !arch || choice.os === "windows") return;
      choice = { ...choice, arch };
      update();
    })
    .catch(() => {});
  fetch("/api/release")
    .then((response) => (response.ok ? response.json() : null))
    .then((next) => {
      const files = next?.files?.filter((file) => file.url?.startsWith(`${RELEASES}/download/`));
      if (!files?.length || (next.tag === release.tag && next.nightly === release.nightly)) return;
      release = { ...next, files };
      update();
    })
    .catch(() => {});
}
