import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import {
  DIRECTORY_URL,
  fetchDirectory,
  installLink,
  matchesAddon,
  openLink,
  parseDirectory,
} from "../src/addon-directory.js";
import {
  publicDocsUrl,
  readCatalog,
  readManifest,
  renderReadme,
} from "./addon-catalog.mjs";

const manifest = (id) => `
  import type { AddonManifest } from '../api'
  import { authors } from '../authors'
  import license from './missing-license.md?raw'
  export default {
    id: '${id}', name: 'Sample', description: 'A sample addon.', version: '1.0.0',
    defaultEnabled: false, authors: [{ ...authors.may, role: 'author' }],
    licenses: [{ text: license }],
  } satisfies AddonManifest
`;

test("extracts metadata and authors without resolving runtime imports", () => {
  const result = readManifest(manifest("sample"), {
    may: { displayName: "may" },
  });
  assert.equal(result.id, "sample");
  assert.deepEqual(result.authors, [{ displayName: "may", role: "author" }]);
  assert.equal(result.licenses, undefined);
  assert.throws(
    () => readManifest("export default { id: runCode() }", {}),
    /unsupported addon metadata: CallExpression/,
  );
  assert.throws(
    () => readManifest(manifest("sample"), {}),
    /unsupported addon metadata/,
  );
});

test("discovers added folders, reads updates, and rejects incomplete syncs", (t) => {
  const root = mkdtempSync(path.join(tmpdir(), "hibi-catalog-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  writeFileSync(
    path.join(root, "authors.ts"),
    "export const authors = { may: { displayName: 'may' } } as const satisfies Record<string, AddonAuthor>",
  );
  writeFileSync(
    path.join(root, "index.html"),
    "route file stays outside the catalog",
  );
  assert.deepEqual(readCatalog(root), []);
  const folder = path.join(root, "sample");
  mkdirSync(folder);
  writeFileSync(path.join(folder, "manifest.ts"), manifest("sample"));
  assert.throws(() => readCatalog(root), /missing addon readme: sample/);
  writeFileSync(path.join(folder, "readme.md"), "# Sample\n\n**source text**");
  assert.match(readCatalog(root)[0].html, /<strong>source text<\/strong>/);
  writeFileSync(path.join(folder, "readme.md"), "updated readme");
  assert.match(readCatalog(root)[0].html, /updated readme/);
  writeFileSync(
    path.join(root, "authors.ts"),
    "export const authors = { may: { displayName: 'updated author' } }",
  );
  assert.equal(readCatalog(root)[0].authors[0].displayName, "updated author");
  rmSync(folder, { recursive: true });
  assert.deepEqual(readCatalog(root), []);
});

test("sanitizes readmes and resolves source links", () => {
  const html = renderReadme(
    [
      "[license](LICENSE.md)",
      "[guide](../../../docs/guides/vim.md)",
      "[section](#usage)",
      "[unsafe](javascript:alert(1))",
      '<img src="image.png" onerror="alert(1)"><script>alert(1)</script>',
      '<iframe src="https://example.com"></iframe><p style="position:fixed">safe text</p>',
      "<a>no href</a>",
    ].join("\n\n"),
    "sample",
  );
  assert.doesNotMatch(
    html,
    /javascript:|onerror|<script|<iframe|style=|\/undefined/,
  );
  assert.match(
    html,
    /href="https:\/\/github.com\/schmayterling\/hibi\/blob\/main\/src\/addons\/sample\/LICENSE.md"/,
  );
  assert.match(
    html,
    /href="https:\/\/docs.hibi.garden\/#page=guides%2Fvim.md"/,
  );
  assert.match(html, /README.md#usage/);
  assert.match(
    html,
    /raw.githubusercontent.com\/schmayterling\/hibi\/main\/src\/addons\/sample\/image.png/,
  );
  assert.match(html, /rel="noopener noreferrer"/);
});

const entry = (fields) => ({
  id: "hello",
  name: "Hello",
  description: "Adds a greeting.",
  version: "1.0.0",
  apiVersion: 2,
  kind: "extension",
  authors: [{ displayName: "Author", github: "author", token: "x" }],
  license: "MIT",
  path: "addons/hello",
  ...fields,
});
const commit = "446296f572ba80ba6290fba864f104412794bca2";
const sha256 = "a".repeat(64);

test("reads every directory source variant", () => {
  const { entries, skipped } = parseDirectory([
    entry({}),
    entry({
      id: "doom",
      path: undefined,
      kind: "theme",
      repository: { url: "https://github.com/o/r", commit, path: "addon" },
    }),
    entry({
      id: "zipped",
      path: undefined,
      homepage: "https://example.com/zipped",
      download: { url: "https://example.com/z.zip", sha256, size: 10 },
    }),
  ]);
  assert.equal(skipped, 0);
  assert.deepEqual(
    entries.map(({ id, source, sourceUrl, readmeUrl, homepage }) => ({
      id,
      source,
      sourceUrl,
      readmeUrl,
      homepage,
    })),
    [
      {
        id: "hello",
        source: "directory",
        sourceUrl:
          "https://github.com/hibigarden/addons-repository/tree/main/addons/hello",
        readmeUrl:
          "https://github.com/hibigarden/addons-repository/blob/main/addons/hello/README.md",
        homepage: null,
      },
      {
        id: "doom",
        source: "repository",
        sourceUrl: `https://github.com/o/r/tree/${commit}/addon`,
        readmeUrl: `https://github.com/o/r/blob/${commit}/addon/README.md`,
        homepage: null,
      },
      {
        id: "zipped",
        source: "download",
        sourceUrl: "https://example.com/z.zip",
        readmeUrl: null,
        homepage: "https://example.com/zipped",
      },
    ],
  );
  assert.deepEqual(entries[0].authors, [
    { displayName: "Author", github: "author" },
  ]);
});

test("skips malformed entries and URLs", () => {
  const repository = (fields) =>
    entry({
      path: undefined,
      repository: { url: "https://github.com/o/r", commit, ...fields },
    });
  const download = (fields) =>
    entry({
      path: undefined,
      download: {
        url: "https://example.com/z.zip",
        sha256,
        size: 1,
        ...fields,
      },
    });
  const { entries, skipped } = parseDirectory([
    null,
    "hello",
    entry({ path: "addons/other" }),
    entry({ path: undefined }),
    entry({ download: { url: "https://example.com/z.zip", sha256, size: 1 } }),
    entry({ homepage: "javascript:alert(1)" }),
    entry({ id: "Bad id" }),
    entry({ kind: "native" }),
    entry({ license: "" }),
    entry({ authors: [] }),
    repository({ url: "http://github.com/o/r" }),
    repository({ url: "https://user:pass@github.com/o/r" }),
    repository({ url: "not a url" }),
    repository({ commit: "main" }),
    repository({ path: "../escape" }),
    download({ url: "file:///etc/passwd" }),
    download({ sha256: "A".repeat(64) }),
    download({ size: 26 * 1024 * 1024 }),
  ]);
  assert.deepEqual(entries, []);
  assert.equal(skipped, 18);
  assert.throws(() => parseDirectory({}), /directory is invalid/);
});

test("built-in and repeated IDs cannot be replaced by the directory", () => {
  const { entries, skipped } = parseDirectory(
    [
      entry({ id: "typing-speed", path: "addons/typing-speed" }),
      entry({}),
      entry({ name: "Second hello" }),
    ],
    ["typing-speed"],
  );
  assert.deepEqual(
    entries.map(({ id, name }) => [id, name]),
    [["hello", "Hello"]],
  );
  assert.equal(skipped, 2);
});

test("the directory cannot add signing or endorsement claims", () => {
  const [parsed] = parseDirectory([
    entry({ signed: true, trust: "signed", verified: true, endorsed: true }),
  ]).entries;
  assert.deepEqual(Object.keys(parsed).sort(), [
    "authors",
    "description",
    "homepage",
    "id",
    "kind",
    "license",
    "name",
    "origin",
    "readmeUrl",
    "source",
    "sourceUrl",
    "version",
  ]);
  assert.equal(parsed.origin, "community");
});

test("search matches metadata, origin, and kind", () => {
  const [community] = parseDirectory([entry({ kind: "theme" })]).entries;
  const builtin = {
    id: "vim",
    name: "Vim",
    description: "Modal editing.",
    kind: "extension",
    version: "1.0.0",
    authors: [{ displayName: "may" }],
    origin: "built-in",
  };
  assert.equal(matchesAddon(community, "  AUTHOR "), true);
  assert.equal(matchesAddon(community, "community"), true);
  assert.equal(matchesAddon(community, "mit"), true);
  assert.equal(matchesAddon(builtin, "built in"), true);
  assert.equal(matchesAddon(builtin, "community"), false);
  assert.equal(matchesAddon(community, "", "theme"), true);
  assert.equal(matchesAddon(builtin, "", "theme"), false);
  assert.equal(matchesAddon(builtin, "", "all"), true);
});

test("addon links use the hibi protocol with an encoded ID", () => {
  assert.equal(
    installLink("typing-speed"),
    "hibi://addons/install?id=typing-speed",
  );
  assert.equal(openLink("vim"), "hibi://addons/open?id=vim");
  assert.equal(installLink("a&b=c"), "hibi://addons/install?id=a%26b%3Dc");
});

test("fetches the public directory without credentials and with bounds", async () => {
  const calls = [];
  const respond = (body, init) => async (url, options) => {
    calls.push({ url, options });
    return new Response(body, init);
  };
  const result = await fetchDirectory(["vim"], {
    fetch: respond(JSON.stringify([entry({}), entry({ id: "vim" })])),
  });
  assert.deepEqual(
    result.entries.map(({ id }) => id),
    ["hello"],
  );
  assert.equal(calls[0].url, DIRECTORY_URL);
  assert.equal(calls[0].options.credentials, "omit");
  await assert.rejects(
    fetchDirectory([], { fetch: respond("missing", { status: 404 }) }),
    /returned 404/,
  );
  await assert.rejects(
    fetchDirectory([], { fetch: respond(" ".repeat(1024 * 1024 + 1)) }),
    /too large/,
  );
  await assert.rejects(
    fetchDirectory([], { fetch: respond("<html>") }),
    SyntaxError,
  );
});

test("directory byte limits cancel chunked and multibyte downloads", async () => {
  let canceled = false;
  const body = new ReadableStream({
    pull(controller) {
      controller.enqueue(new TextEncoder().encode("é".repeat(300000)));
    },
    cancel() { canceled = true; },
  });
  await assert.rejects(fetchDirectory([], {
    fetch: async () => new Response(body),
  }), /too large/);
  assert.equal(canceled, true);
});

test("readme links to moved guides use the public help site", () => {
  assert.equal(
    publicDocsUrl(
      "https://github.com/schmayterling/hibi/blob/main/docs/development/addons/sideloading.md",
    ),
    "https://docs.hibi.garden/#page=development%2Faddons%2Fsideloading.md",
  );
  const license =
    "https://github.com/schmayterling/hibi/blob/main/docs/licenses/typst-assets.md";
  assert.equal(publicDocsUrl(license), license);
  assert.equal(
    publicDocsUrl("https://example.com/docs/x.md"),
    "https://example.com/docs/x.md",
  );
});
