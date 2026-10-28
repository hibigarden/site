const stage = document.querySelector(".demo");
const frame = stage.querySelector("iframe");
const shell = stage.querySelector(".demo-shell");
const loader = stage.querySelector(".demo-loader");
const snapshotSource = stage.querySelector(".demo-snapshot source");
const root = document.documentElement;
const desktop = matchMedia(
  "(min-width: 1025px) and (hover: hover) and (pointer: fine)",
);
let resizeObserver;

function updateSnapshotTheme() {
  snapshotSource.media = root.dataset.theme === "dark" ? "all" : "not all";
}

updateSnapshotTheme();
const themeObserver = new MutationObserver(updateSnapshotTheme);
themeObserver.observe(root, { attributes: true, attributeFilter: ["data-theme"] });

function updateAccessibility() {
  const ready = stage.dataset.ready === "true";
  const interactive = desktop.matches && ready;
  stage.setAttribute("aria-busy", String(desktop.matches && !ready));
  frame.inert = !interactive;
  if (interactive) frame.removeAttribute("aria-hidden");
  else frame.setAttribute("aria-hidden", "true");
  if (desktop.matches && !ready) loader.removeAttribute("aria-hidden");
  else loader.setAttribute("aria-hidden", "true");
}

function scaleDemo() {
  const scale = Math.min(
    stage.clientWidth / Number(frame.width),
    stage.clientHeight / Number(frame.height),
    1,
  );
  shell.style.transform = `translate(-50%, -50%) scale(${scale})`;
}

// The editor starts loading once the landing page has loaded and gone idle, so it never competes
// with the hero for the network or the main thread, and the page's load event never waits for it.
let editorRequested = false;
function loadEditor() {
  if (editorRequested) return;
  editorRequested = true;
  const idle = window.requestIdleCallback ?? ((callback) => setTimeout(callback, 200));
  const start = () => idle(() => (frame.src = frame.dataset.src), { timeout: 2000 });
  if (document.readyState === "complete") start();
  else addEventListener("load", start, { once: true });
}

function updateMode() {
  stage.dataset.live = String(desktop.matches);
  if (desktop.matches) {
    resizeObserver ??= new ResizeObserver(scaleDemo);
    resizeObserver.observe(stage);
    scaleDemo();
    loadEditor();
  } else {
    // Keep an already-loaded editor mounted so resizing does not discard writing.
    resizeObserver?.disconnect();
  }
  updateAccessibility();
}

let contentObserver;
let watchedDocument;
function watchEditor() {
  const demoDocument = frame.contentDocument;
  const demoRoot = demoDocument?.getElementById("root");
  if (!demoRoot || demoDocument === watchedDocument) return;
  watchedDocument = demoDocument;
  contentObserver?.disconnect();
  stage.dataset.ready = "false";
  updateAccessibility();

  const reveal = () => {
    if (!demoRoot.querySelector('.tiptap[contenteditable="true"]')) return;
    contentObserver.disconnect();
    demoDocument.fonts.ready.then(() =>
      requestAnimationFrame(() => {
        if (frame.contentDocument !== demoDocument) return;
        stage.dataset.ready = "true";
        updateAccessibility();
      }),
    );
  };
  contentObserver = new MutationObserver(reveal);
  contentObserver.observe(demoRoot, { childList: true, subtree: true });
  reveal();
}

frame.addEventListener("load", watchEditor);
desktop.addEventListener("change", updateMode);
updateMode();
if (frame.hasAttribute("src") && frame.contentDocument?.readyState === "complete") {
  watchEditor();
}
