import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import addonCatalog, { communitySnapshot, readCatalog } from "./scripts/addon-catalog.mjs";
import { addonIdFromPath, bundledAddons } from "./src/addon-directory.js";
import { addonPageResponse, readAddonPages } from "./server/addon-pages.js";
import { releasePlugin } from "./server/release.js";
import { peoplePlugin } from "./server/people.js";

function addonPages(server) {
  server.middlewares.use(async (request, response, next) => {
    const { pathname } = new URL(request.url, "http://localhost");
    if (!addonIdFromPath(pathname) && !["/sitemap.xml", "/addons/community.json"].includes(pathname)) return next();
    try {
      const root = server.config.root;
      const assets = server.transformIndexHtml
        ? {
            template: await server.transformIndexHtml(
              "/addons/index.html",
              await readFile(join(root, "addons/index.html"), "utf8"),
            ),
            addons: bundledAddons(readCatalog(join(root, "addons"))),
            snapshot: await communitySnapshot(join(root, "addons")),
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
    releasePlugin(),
    peoplePlugin(),
    {
      name: "hibi-addon-pages",
      configureServer: addonPages,
      configurePreviewServer: addonPages,
    },
    {
      // hibi generates its addon catalog while it builds; the demo lists the addons it runs.
      name: "hibi-demo-addon-catalog",
      resolveId(id) {
        if (id === "virtual:hibi-addon-catalog/renderer")
          return fileURLToPath(new URL("./src/demo-addons.js", import.meta.url));
        // Authors and licences show only in settings, which the demo leaves out.
        if (id === "virtual:hibi-addon-catalog/details") return "\0hibi-demo-addon-details";
      },
      load(id) {
        if (id === "\0hibi-demo-addon-details") return "export default {}";
      },
    },
    {
      name: "hibi-demo-katex-fonts",
      enforce: "pre",
      transform(code, id) {
        if (!id.endsWith("/vendor/hibi/src/addons/math/styles.ts")) return;
        // The vendored copy sits deeper than hibi's node_modules path assumes.
        return code.replace(
          "'../../../node_modules/katex/dist/fonts/*.woff2'",
          "'/node_modules/katex/dist/fonts/*.woff2'",
        );
      },
    },
  ],
  esbuild: { jsx: "automatic" },
  // hibi's document worker splits into chunks.
  worker: { format: "es" },
  // latex.js looks for optional document classes with a require that esbuild cannot follow.
  optimizeDeps: { exclude: ["latex.js"] },
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
        download: "download/index.html",
        sync: "sync/index.html",
        publish: "publish/index.html",
      },
    },
  },
});
