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

const compiler = createTypstCompiler();
const renderer = createTypstRenderer();
const ready = Promise.all([
  compiler.init({ getModule: () => compilerWasm, beforeBuild: [loadFonts(fonts)] }),
  renderer.init({ getModule: () => rendererWasm }),
]);

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
