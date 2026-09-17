import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { readCatalog, readManifest, renderReadme } from "./addon-catalog.mjs";

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
    /href="https:\/\/github.com\/schmayterling\/hibi\/blob\/main\/docs\/guides\/vim.md"/,
  );
  assert.match(html, /README.md#usage/);
  assert.match(
    html,
    /raw.githubusercontent.com\/schmayterling\/hibi\/main\/src\/addons\/sample\/image.png/,
  );
  assert.match(html, /rel="noopener noreferrer"/);
});
