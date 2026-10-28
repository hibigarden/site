// The built-in addons the demo runs. Stands in for the catalog hibi generates while it builds
// (virtual:hibi-addon-catalog/renderer, see vite.config.js); every one starts enabled.
import frontmatter from "../vendor/hibi/src/addons/frontmatter/hibi-addon.json";
import keybeats from "../vendor/hibi/src/addons/keybeats/hibi-addon.json";
import markdown from "../vendor/hibi/src/addons/markdown/hibi-addon.json";
import markdownFlavors from "../vendor/hibi/src/addons/markdown/flavor-info";
import math from "../vendor/hibi/src/addons/math/hibi-addon.json";
import mathFlavors from "../vendor/hibi/src/addons/math/flavor-info";
import mermaid from "../vendor/hibi/src/addons/mermaid/hibi-addon.json";
import slashCommands from "../vendor/hibi/src/addons/slash-commands/hibi-addon.json";
import textExtras from "../vendor/hibi/src/addons/text-extras/hibi-addon.json";
import textExtrasFlavors from "../vendor/hibi/src/addons/text-extras/flavor-info";
import tags from "../vendor/hibi/src/addons/tags/hibi-addon.json";
import typst from "../vendor/hibi/src/addons/typst/hibi-addon.json";
import typstFlavors from "../vendor/hibi/src/addons/typst/flavor-info";
import { parseAddonManifest } from "../vendor/hibi/src/shared/addon-manifest";

function bundled(details, load, flavors) {
  const { authors: _authors, licenses: _licenses, ...manifest } = parseAddonManifest(details, {
    trust: "compiled",
  }).manifest;
  return { manifest, source: "built-in", load, ...(flavors ? { flavors } : {}) };
}

export default [
  bundled(frontmatter, () => import("../vendor/hibi/src/addons/frontmatter/index.ts")),
  bundled(keybeats, () => import("../vendor/hibi/src/addons/keybeats/index.ts")),
  bundled(markdown, () => import("../vendor/hibi/src/addons/markdown/index.tsx"), markdownFlavors),
  bundled(math, () => import("../vendor/hibi/src/addons/math/index.ts"), mathFlavors),
  bundled(mermaid, () => import("../vendor/hibi/src/addons/mermaid/index.tsx")),
  bundled(slashCommands, () => import("../vendor/hibi/src/addons/slash-commands/index.ts")),
  bundled(tags, () => import("../vendor/hibi/src/addons/tags/index.tsx")),
  bundled(textExtras, () => import("../vendor/hibi/src/addons/text-extras/index.ts"), textExtrasFlavors),
  bundled(typst, () => import("../vendor/hibi/src/addons/typst/index.tsx"), typstFlavors),
];
