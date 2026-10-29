import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { parse } from "@babel/parser";
import { marked } from "marked";
import sanitizeHtml from "sanitize-html";
import { communityFeed, datedAddons } from "../server/addon-dates.js";
import { addonDay, bundledAddons } from "../src/addon-directory.js";
import { renderShowcase, showcaseCandidates } from "../src/addon-showcase.js";

const repository = "https://github.com/schmayterling/hibi";
const docsSource = `${repository}/blob/main/docs/`;

// Public help moved to docs.hibi.garden; license sources and agent notes stay in the app repository.
export function publicDocsUrl(href) {
  if (!href.startsWith(docsSource)) return href;
  const url = new URL(href);
  const page = decodeURIComponent(
    url.pathname.slice("/schmayterling/hibi/blob/main/docs/".length),
  );
  if (/^(?:licenses|ai-agents)\//.test(page)) return href;
  return `https://docs.hibi.garden/#page=${encodeURIComponent(page)}`;
}
const fields = [
  "id",
  "name",
  "version",
  "description",
  "kind",
  "defaultEnabled",
  "authors",
];
const statements = (source) =>
  parse(source, { sourceType: "module", plugins: ["typescript"] }).program.body;
const unwrap = (node) =>
  ["TSAsExpression", "TSSatisfiesExpression"].includes(node?.type)
    ? unwrap(node.expression)
    : node;

// Read static metadata only. Never execute manifests or resolve runtime/license imports.
function value(expression, authors = {}) {
  const node = unwrap(expression);
  if (
    ["StringLiteral", "NumericLiteral", "BooleanLiteral"].includes(node?.type)
  )
    return node.value;
  if (node?.type === "ArrayExpression")
    return node.elements.map((entry) => value(entry, authors));
  if (node?.type === "ObjectExpression")
    return Object.fromEntries(
      node.properties.flatMap((property) => {
        if (property.type === "SpreadElement")
          return Object.entries(value(property.argument, authors));
        if (property.type !== "ObjectProperty" || property.computed)
          throw new Error("addon metadata must use static properties");
        return [
          [
            property.key.name ?? property.key.value,
            value(property.value, authors),
          ],
        ];
      }),
    );
  if (
    node?.type === "MemberExpression" &&
    !node.computed &&
    node.object.name === "authors" &&
    Object.hasOwn(authors, node.property.name)
  )
    return authors[node.property.name];
  throw new Error(
    `unsupported addon metadata: ${node?.type ?? "missing value"}`,
  );
}

export function readManifest(source, authors) {
  const object = unwrap(
    statements(source).find((node) => node.type === "ExportDefaultDeclaration")
      ?.declaration,
  );
  if (object?.type !== "ObjectExpression")
    throw new Error("addon manifest must default-export an object");
  return Object.fromEntries(
    fields.flatMap((field) => {
      const property = object.properties.find(
        (entry) =>
          entry.type === "ObjectProperty" &&
          !entry.computed &&
          (entry.key.name ?? entry.key.value) === field,
      );
      return property ? [[field, value(property.value, authors)]] : [];
    }),
  );
}

export function renderReadme(markdown, id) {
  const base = `${repository}/blob/main/src/addons/${id}/README.md`;
  return sanitizeHtml(marked.parse(markdown), {
    allowedTags: [...sanitizeHtml.defaults.allowedTags, "img"],
    allowedAttributes: {
      a: ["href", "title", "target", "rel"],
      img: ["src", "alt", "title", "loading"],
      ol: ["start"],
    },
    allowedSchemes: ["http", "https", "mailto"],
    transformTags: {
      h1: "h3",
      h2: "h4",
      h3: "h5",
      h4: "h6",
      h5: "h6",
      a: (tagName, attributes) => {
        let href;
        try {
          if (attributes.href)
            href = publicDocsUrl(new URL(attributes.href, base).href);
        } catch {
          /* Leave invalid links inert. */
        }
        return {
          tagName,
          attribs: {
            ...attributes,
            href,
            target: "_blank",
            rel: "noopener noreferrer",
          },
        };
      },
      img: (tagName, attributes) => {
        let src;
        try {
          if (attributes.src)
            src = new URL(
              attributes.src,
              `https://raw.githubusercontent.com/schmayterling/hibi/main/src/addons/${id}/README.md`,
            ).href;
        } catch {
          /* Omit invalid image sources. */
        }
        return { tagName, attribs: { ...attributes, src, loading: "lazy" } };
      },
    },
  });
}

/**
 * Release and update days from the synced dates.json. The file is optional:
 * a sync without dates, or an unreadable entry, leaves those addons undated.
 */
export function readDates(directory) {
  try {
    return validDates(JSON.parse(readFileSync(path.join(directory, "dates.json"), "utf8")));
  } catch {
    return {};
  }
}

const validDates = (dates) =>
  Object.fromEntries(
    Object.entries(dates && typeof dates === "object" ? dates : {}).flatMap(([id, entry]) =>
      addonDay(entry?.released) && addonDay(entry?.updated)
        ? [[id, { released: entry.released, updated: entry.updated }]]
        : [],
    ),
  );

export function readCatalog(directory) {
  const dates = readDates(directory);
  const declarations = statements(
    readFileSync(path.join(directory, "authors.ts"), "utf8"),
  );
  const authorNode = declarations
    .filter((node) => node.type === "ExportNamedDeclaration")
    .flatMap((node) => node.declaration?.declarations ?? [])
    .find((node) => node.id.name === "authors");
  const authors = value(authorNode?.init);

  return readdirSync(directory, { withFileTypes: true })
    .filter(
      (entry) =>
        entry.isDirectory() &&
        existsSync(path.join(directory, entry.name, "manifest.ts")),
    )
    .map(({ name }) => {
      const folder = path.join(directory, name);
      const manifest = readManifest(
        readFileSync(path.join(folder, "manifest.ts"), "utf8"),
        authors,
      );
      if (
        !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name) ||
        manifest.id !== name ||
        ![manifest.name, manifest.description, manifest.version].every(
          (text) => typeof text === "string" && text.trim(),
        ) ||
        typeof manifest.defaultEnabled !== "boolean" ||
        !Array.isArray(manifest.authors) ||
        !manifest.authors.every(
          (author) => typeof author.displayName === "string",
        )
      )
        throw new Error(`invalid addon metadata: ${name}`);
      const readme = ["readme.md", "README.md"].find((file) =>
        existsSync(path.join(folder, file)),
      );
      if (!readme) throw new Error(`missing addon readme: ${name}`);
      return {
        ...manifest,
        ...dates[name],
        html: renderReadme(
          readFileSync(path.join(folder, readme), "utf8"),
          name,
        ),
      };
    })
    .sort((a, b) =>
      a.name.localeCompare(b.name, "en", { sensitivity: "base" }),
    );
}

const DEPLOYED_SNAPSHOT = "https://www.hibi.garden/addons/community-snapshot.json";
/**
 * The deployed snapshot's head and days. Builds share rate-limited addresses,
 * so a build that cannot reach GitHub keeps them, and an unchanged directory
 * costs one request.
 */
export async function deployedSnapshot({ fetch = globalThis.fetch } = {}) {
  try {
    const response = await fetch(DEPLOYED_SNAPSHOT, { signal: AbortSignal.timeout(5000) });
    const { head, dates } = response.ok ? await response.json() : {};
    if (typeof head === "string" && /^[0-9a-f]{40}$/.test(head))
      return { head, dates: validDates(dates), addons: [] };
  } catch {
    /* Start without days. */
  }
  return { head: null, dates: {}, addons: [] };
}

let snapshot;
/**
 * Community entries and days as of the build (or, in dev, the last five
 * minutes). The production function falls back to this file.
 */
export async function communitySnapshot(directory, options) {
  if (snapshot && Date.now() - snapshot.at < 300_000) return snapshot.value;
  const builtinIds = readCatalog(directory).map((addon) => addon.id);
  const seed = snapshot?.value ?? (await deployedSnapshot(options));
  const { head, dates, addons } = await communityFeed(seed, builtinIds, options);
  snapshot = { at: Date.now(), value: { head, dates, addons } };
  return snapshot.value;
}

/** Fills the landing page's showcase marker with built-ins and the snapshot. */
export function injectShowcase(html, builtins, community) {
  const marker = "<!-- addon-showcase -->";
  if (!html.includes(marker)) throw new Error("index.html is missing the addon showcase marker");
  const data = JSON.stringify(showcaseCandidates(builtins)).replace(/</g, "\\u003c");
  return html.replace(
    marker,
    () => `<div class="showcase-body">${renderShowcase([...builtins, ...community])}</div><script type="application/json" id="addon-showcase-data">${data}</script>`,
  );
}

export default function addonCatalog() {
  const id = "\0hibi-addon-catalog";
  let directory;
  return {
    name: "hibi-addon-catalog",
    configResolved(config) {
      directory = path.join(config.root, "addons");
    },
    transformIndexHtml: {
      order: "pre",
      async handler(html, { filename }) {
        if (path.relative(path.dirname(directory), filename) !== "index.html") return;
        const community = await communitySnapshot(directory);
        return injectShowcase(html, bundledAddons(readCatalog(directory)), datedAddons(community));
      },
    },
    async generateBundle() {
      const catalog = readCatalog(directory);
      const snapshot = await communitySnapshot(directory);
      this.emitFile({
        type: "asset",
        fileName: "addons/catalog.json",
        source: JSON.stringify(catalog),
      });
      this.emitFile({
        type: "asset",
        fileName: "addons/community-snapshot.json",
        source: JSON.stringify(snapshot),
      });
      // Imported here, so the dev server never loads the renderer.
      const { ogImages } = await import("./og-images.mjs");
      const { files, manifest } = await ogImages([...bundledAddons(catalog), ...snapshot.addons]);
      for (const { fileName, source } of files) this.emitFile({ type: "asset", fileName, source });
      this.emitFile({ type: "asset", fileName: "addons/og.json", source: JSON.stringify(manifest) });
    },
    resolveId(source) {
      if (source === "virtual:hibi-addons") return id;
    },
    load(source) {
      if (source === id)
        return `export default ${JSON.stringify(readCatalog(directory))}`;
    },
    configureServer(server) {
      server.watcher.add(directory);
      server.watcher.on("all", (event, file) => {
        if (
          !file.startsWith(`${directory}${path.sep}`) ||
          !/\.(md|ts|json)$/i.test(file)
        )
          return;
        const module = server.moduleGraph.getModuleById(id);
        if (module) server.moduleGraph.invalidateModule(module);
        server.ws.send({ type: "full-reload" });
      });
    },
  };
}
