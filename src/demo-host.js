// What the desktop app's main process provides, stood in for in the browser. This module loads before
// the editor's: some of them read window.hibi and localStorage as they load.
import catalog from "./demo-addons.js";

// The toolbar layout and its autohide setting come from hibi's defaults. Earlier demos saved their own
// under the same key, so a visitor's saved layout is dropped once each time the demo changes.
const version = "2026-10-29";
export let freshVisit = false;
try {
  if (localStorage.getItem("hibi-demo:version") !== version) {
    localStorage.removeItem("hibi:toolbar");
    localStorage.setItem("hibi-demo:version", version);
    freshVisit = true;
  }
} catch {
  // Without storage every visit starts from the defaults.
}
// The demo carries one keyboard's sounds.
try {
  const keys = JSON.parse(localStorage.getItem("keybeats:preferences") ?? "{}");
  localStorage.setItem(
    "keybeats:preferences",
    JSON.stringify({ volume: 0.15, muted: false, ...keys, profile: "holypanda" }),
  );
} catch {
  // keyBeats falls back to its own defaults.
}

const states = catalog.map(({ manifest }) => ({ id: manifest.id, enabled: true, activation: 1 }));
const storage = new Map();
const unsubscribe = () => () => {};
const host = {
  bootstrap: { addons: async () => ({ states, packages: [], notices: [] }) },
  getAddonStates: async () => states,
  getInstalledAddons: async () => [],
  setAddonEnabled: async () => states,
  setAppearance: async () => {},
  admitSourceOperation: () => {},
  appendSourceOperation: async () => {},
  flushDocumentChanges: async () => {},
  readDocumentMedia: async () => null,
  // Images in the notes are files of this site; any other media is a desktop feature.
  resolveDocumentMedia: async (source) =>
    /^\/[\w/-]+\.webp$/.test(source) ? { paths: [], media: { kind: "image", url: source } } : null,
  cancelDocumentMedia: async () => {},
  // Table sizes live with a workspace; the demo has none, so they last until the page closes.
  readTableLayout: async () => null,
  writeTableLayout: async () => {},
  registerAddonHotkey: async () => {},
  unregisterAddonHotkey: async () => {},
  readAddonStorage: async ({ owner, scope, key }) =>
    storage.get(JSON.stringify([owner, scope, key])) ?? { status: "missing", revision: 0 },
  writeAddonStorage: async ({ owner, scope, key, value, baseRevision }) => {
    const saved = { status: "saved", revision: baseRevision + 1, value };
    storage.set(JSON.stringify([owner, scope, key]), { status: "ready", revision: saved.revision, value });
    return saved;
  },
};
// Listeners never fire; anything else is a desktop feature.
window.hibi = new Proxy(host, {
  get(target, name) {
    if (name in target || typeof name !== "string") return target[name];
    if (/^on[A-Z]/.test(name)) return unsubscribe;
    if (import.meta.env.DEV) console.debug(`demo: window.hibi.${name} is a desktop feature`);
    return () => Promise.reject(new Error("This is available in the desktop app."));
  },
});
