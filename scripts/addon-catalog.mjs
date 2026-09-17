import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { parse } from "@babel/parser";
import { marked } from "marked";
import sanitizeHtml from "sanitize-html";

const repository = "https://github.com/schmayterling/hibi";
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
          if (attributes.href) href = new URL(attributes.href, base).href;
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

export function readCatalog(directory) {
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

export default function addonCatalog() {
  const id = "\0hibi-addon-catalog";
  let directory;
  return {
    name: "hibi-addon-catalog",
    configResolved(config) {
      directory = path.join(config.root, "addons");
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
          !/\.(md|ts)$/i.test(file)
        )
          return;
        const module = server.moduleGraph.getModuleById(id);
        if (module) server.moduleGraph.invalidateModule(module);
        server.ws.send({ type: "full-reload" });
      });
    },
  };
}
