import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import addonCatalog, { readCatalog } from "./scripts/addon-catalog.mjs";
import { addonIdFromPath, bundledAddons } from "./src/addon-directory.js";
import { addonPageResponse, readAddonPages } from "./server/addon-pages.js";

function addonPages(server) {
  server.middlewares.use(async (request, response, next) => {
    const { pathname } = new URL(request.url, "http://localhost");
    if (!addonIdFromPath(pathname) && pathname !== "/sitemap.xml") return next();
    try {
      const root = server.config.root;
      const assets = server.transformIndexHtml
        ? {
            template: await server.transformIndexHtml(
              "/addons/index.html",
              await readFile(join(root, "addons/index.html"), "utf8"),
            ),
            addons: bundledAddons(readCatalog(join(root, "addons"))),
          }
        : await readAddonPages(root);
      const result = await addonPageResponse(pathname, assets);
      response.statusCode = result.status;
      for (const [name, value] of result.headers) response.setHeader(name, value);
      response.end(request.method === "HEAD" ? "" : await result.text());
    } catch (error) {
      next(error);
    }
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
        credits: "credits/index.html",
      },
    },
  },
});
