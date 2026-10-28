// The notes in the demo's sidebar by their path in the workspace, welcome first: the demo opens on it.
// thesis/growth.typ sits beside them for the desktop captures; the demo has no typst compiler.
const files = import.meta.glob("./demo-notes/**/*.md", { query: "?raw", import: "default", eager: true });
const notes = Object.entries(files).map(([file, markdown]) => ({ path: file.slice("./demo-notes/".length), markdown }));

export default notes.sort((a, b) => (b.path === "welcome.md") - (a.path === "welcome.md"));
