import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import addonCatalog from "./scripts/addon-catalog.mjs";
import { addonIdFromPath } from "./src/addon-directory.js";

function addonPages(server) {
  server.middlewares.use((request, _response, next) => {
    const url = new URL(request.url, "http://localhost");
    if (addonIdFromPath(url.pathname))
      request.url = `/addons/index.html${url.search}`;
    next();
  });
}

export default defineConfig({
  plugins: [
    addonCatalog(),
    {
      name: "hibi-addon-pages",
      configureServer: addonPages,
      configurePreviewServer: addonPages,
    },
    {
      name: "hibi-embedded-focus",
      enforce: "pre",
      transform(code, id) {
        if (!id.endsWith("/vendor/hibi/src/renderer/src/Editor.tsx")) return;
        // Keep the landing page at the top; retain autofocus in the standalone demo.
        return code.replace(
          "autofocus: 'end',",
          "autofocus: window.parent === window ? 'end' : false,",
        );
      },
    },
  ],
  esbuild: { jsx: "automatic" },
  resolve: {
    alias: [
      {
        find: /^\.\.\/\.\.\/\.\.\/node_modules\/geist\//,
        replacement: fileURLToPath(
          new URL("./node_modules/geist/", import.meta.url),
        ),
      },
    ],
  },
  build: {
    rollupOptions: {
      input: {
        main: "index.html",
        demo: "demo/index.html",
        addons: "addons/index.html",
      },
    },
  },
});
