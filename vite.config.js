import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [
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
