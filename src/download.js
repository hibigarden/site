import { DEFAULT, RELEASES, fromPlatformId, pick, platformId, renderDownloadPage, renderPick } from "./release.js";

// The download buttons on the landing take the reader to /download with their platform in the hash
// (#macos-arm64); /download preselects it (or guesses it here), and picks up a newer release from /api/release.
// Browsers can't always tell Apple silicon from Intel, so a Mac without client hints gets Apple silicon and
// the Intel builds sit one row below.
function detect() {
  const ua = navigator.userAgent;
  const platform = `${navigator.userAgentData?.platform ?? ""} ${navigator.platform ?? ""}`;
  if (/android|iphone|ipod/i.test(ua)) return null; // no phone app
  if (/win/i.test(platform) || /windows/i.test(ua)) return { os: "windows", arch: "x64" };
  if (/mac/i.test(platform) || /macintosh|mac os x/i.test(ua)) return { os: "mac", arch: "arm64" };
  if (/linux|x11|cros/i.test(`${platform} ${ua}`)) return { os: "linux", arch: /aarch64|arm64|armv8/i.test(`${ua} ${platform}`) ? "arm64" : "x64" };
  return null;
}

// high-entropy client hints can tell an Apple silicon or arm Linux machine apart (Chromium only)
async function refine(choice) {
  if (!choice || choice.os === "windows") return choice;
  try {
    const { architecture } = (await navigator.userAgentData?.getHighEntropyValues?.(["architecture"])) ?? {};
    const arch = { arm: "arm64", x86: "x64" }[architecture];
    return arch ? { ...choice, arch } : choice;
  } catch {
    return choice;
  }
}

const links = document.querySelectorAll("[data-download-link]");
const page = document.querySelector("[data-download-page]");
const guess = detect();

for (const link of links) if (guess) link.hash = platformId(guess);
if (links.length && guess)
  refine(guess).then((choice) => {
    for (const link of links) link.hash = platformId(choice);
  });

if (page) {
  const data = page.querySelector("[data-release]");
  let release = data && JSON.parse(data.textContent);
  let choice = fromPlatformId(location.hash) ?? guess ?? DEFAULT;

  const show = () => {
    const file = pick(release, choice);
    page.querySelector("[data-pick]").innerHTML = renderPick(release, file);
    for (const row of page.querySelectorAll("tr[data-platform]")) row.classList.remove("is-yours");
    page.querySelector(`tr[data-platform="${platformId(file)}"]`)?.classList.add("is-yours");
    for (const button of page.querySelectorAll("[data-copy]")) button.hidden = !navigator.clipboard;
  };

  page.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-copy]");
    if (!button) return;
    try {
      await navigator.clipboard.writeText(button.dataset.copy);
      button.textContent = "copied";
    } catch {
      button.textContent = "copy failed";
    }
    setTimeout(() => (button.textContent = "copy"), 1600);
  });
  addEventListener("hashchange", () => {
    const next = fromPlatformId(location.hash);
    if (!next || !release) return;
    choice = next;
    show();
  });

  if (release) {
    show();
    if (!fromPlatformId(location.hash))
      refine(choice).then((refined) => {
        choice = refined;
        show();
      });
    fetch("/api/release")
      .then((response) => (response.ok ? response.json() : null))
      .then((next) => {
        const files = next?.files?.filter((file) => file.url?.startsWith(`${RELEASES}/download/`));
        const changed = next && (next.tag !== release.tag || next.nightly?.tag !== release.nightly?.tag);
        // a newer release redraws the page, unless the reader is already using it
        if (!files?.length || !changed || page.contains(document.activeElement)) return;
        release = { ...next, files };
        page.innerHTML = renderDownloadPage(release);
        show();
      })
      .catch(() => {});
  }
}
