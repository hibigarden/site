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

// What the Typst and LaTeX engines are doing while they load, for the demo's loading notice:
// { engine, phase: "download" | "compile" | "error", loaded, total, message }, or null once they are ready.
export const engineStatus = {
  current: null,
  listeners: new Set(),
  set(value) {
    engineStatus.current = value;
    for (const listener of engineStatus.listeners) listener();
  },
  subscribe(listener) {
    engineStatus.listeners.add(listener);
    return () => engineStatus.listeners.delete(listener);
  },
  snapshot: () => engineStatus.current,
};
const ready = (engine) => engineStatus.current?.engine === engine && engineStatus.set(null);

let typst;
let compiles = 0;
const pending = new Map();
function typstFailed(message) {
  typst.terminate();
  typst = null;
  engineStatus.set({ engine: "typst", phase: "error", message });
  for (const { reject } of pending.values()) reject(new Error(message));
  pending.clear();
}
function compileTypst({ source, block }) {
  if (!typst) {
    engineStatus.set({ engine: "typst", phase: "download", loaded: 0, total: 0 });
    typst = new Worker(new URL("./demo-typst.worker.js", import.meta.url), { type: "module" });
    typst.onerror = () => typstFailed("The Typst compiler could not start.");
    typst.onmessage = ({ data }) => {
      if (data.progress) return engineStatus.set({ engine: "typst", phase: "download", ...data.progress });
      if (data.phase) return engineStatus.set({ engine: "typst", phase: data.phase });
      if (data.failed) return typstFailed(data.failed);
      ready("typst");
      const { resolve, reject } = pending.get(data.id);
      pending.delete(data.id);
      if (data.error) reject(new Error(data.error));
      else resolve(data.result);
    };
  }
  return new Promise((resolve, reject) => {
    pending.set(++compiles, { resolve, reject });
    typst.postMessage({ id: compiles, source, block });
  });
}

// The graph opens on the whole workspace, as with its default zoom setting at 1.5, rather than close on one note.
try {
  if (localStorage.getItem("graph:default-zoom") === null) localStorage.setItem("graph:default-zoom", "1.5");
} catch {
  // The graph falls back to its own default.
}

let latex;
async function renderLatex(input) {
  if (!latex) {
    engineStatus.set({ engine: "latex", phase: "download" });
    latex = import("./demo-latex.js").catch((error) => {
      latex = null;
      engineStatus.set({ engine: "latex", phase: "error", message: "The LaTeX renderer did not load." });
      throw error;
    });
  }
  const { renderLatex } = await latex;
  ready("latex");
  return renderLatex(input);
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
  // The Typst and LaTeX previews the app compiles natively, compiled here in the browser. Each engine
  // loads the first time its preview renders.
  queryAddon: async (id, method, input) => {
    if (id === "typst" && method === "compile") return compileTypst(input);
    if (id === "math" && method === "render") return renderLatex(input);
    throw new Error("This is available in the desktop app.");
  },
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
