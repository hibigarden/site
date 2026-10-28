// The typst addon's compile query, off the editor's thread: typst.ts, the compiler family the app
// bundles, with typst's default fonts served from this site. Loads only when Typst first renders.
import { createTypstCompiler, createTypstRenderer, loadFonts } from "@myriaddreamin/typst.ts";
import compilerWasm from "@myriaddreamin/typst-ts-web-compiler/pkg/typst_ts_web_compiler_bg.wasm?url";
import rendererWasm from "@myriaddreamin/typst-ts-renderer/pkg/typst_ts_renderer_bg.wasm?url";

const fonts = [
  "LibertinusSerif-Regular.otf",
  "LibertinusSerif-Italic.otf",
  "LibertinusSerif-Bold.otf",
  "LibertinusSerif-BoldItalic.otf",
  "NewCMMath-Regular.otf",
  "DejaVuSansMono.ttf",
].map((name) => `/typst/fonts/${name}`);

// The compiler is most of the download, so the demo shows its progress. A compressed response reports
// its compressed length, which says nothing about the bytes read, so the total stays unknown then.
async function download(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`The Typst compiler did not download (${response.status}).`);
  const total = response.headers.get("content-encoding") ? 0 : Number(response.headers.get("content-length")) || 0;
  const reader = response.body.getReader();
  const chunks = [];
  let loaded = 0;
  let reported = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    loaded += value.length;
    if (performance.now() - reported > 100) {
      reported = performance.now();
      postMessage({ progress: { loaded, total } });
    }
  }
  postMessage({ phase: "compile" });
  return new Blob(chunks).arrayBuffer();
}

const compiler = createTypstCompiler();
const renderer = createTypstRenderer();
const ready = Promise.all([
  compiler.init({ getModule: () => download(compilerWasm), beforeBuild: [loadFonts(fonts)] }),
  renderer.init({ getModule: () => rendererWasm }),
]);
ready.catch((error) => postMessage({ failed: String(error?.message ?? error) }));

// One compile at a time, in order, as the app's compiler process takes them.
let queue = Promise.resolve();
onmessage = ({ data: { id, source, block } }) => {
  queue = queue.then(async () => {
    try {
      await ready;
      // Blocks in Markdown notes fit their content, as in the app.
      compiler.addSource("/main.typ", block ? `#set page(width: auto, height: auto, margin: 8pt)\n${source}` : source);
      const { result, diagnostics = [] } = await compiler.compile({ mainFilePath: "/main.typ", diagnostics: "full" });
      const notes = diagnostics.map(({ message, severity }) => ({
        message,
        severity: /error/i.test(severity) ? "error" : "warning",
      }));
      if (!result) return postMessage({ id, result: { diagnostics: notes } });
      // A standalone image, like the app's plain svg: no script for the interactive viewer.
      const svg = await renderer.renderSvg({
        artifactContent: result,
        format: "vector",
        data_selection: { body: true, defs: true, css: true, js: false },
      });
      postMessage({ id, result: { svg, pages: svg.match(/class="typst-page"/g)?.length ?? 1, diagnostics: notes } });
    } catch (error) {
      postMessage({ id, error: String(error?.message ?? error) });
    }
  });
};
