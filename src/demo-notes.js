// The notes in the demo's sidebar by their path in the workspace, welcome first: the demo opens on it.
// Typst and LaTeX documents sit beside them and compile in the browser, as the app compiles them natively.
const files = import.meta.glob("./demo-notes/**/*.{md,typ,tex}", { query: "?raw", import: "default", eager: true });
const notes = Object.entries(files).map(([file, markdown]) => ({ path: file.slice("./demo-notes/".length), markdown }));

export default notes.sort((a, b) => (b.path === "welcome.md") - (a.path === "welcome.md"));
