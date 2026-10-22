import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { addonPageTitle, renderAddonPage } from "../src/addon-seo.js";

const template = readFileSync(
  new URL("../addons/index.html", import.meta.url),
  "utf8",
);
const builtin = {
  id: "vim",
  name: "Vim",
  description: "Modal editing for the source view.",
  version: "1.2.0",
  defaultEnabled: false,
  authors: [{ displayName: "may", github: "schmayterling", role: "author" }],
  html: "<p>readme</p>",
  origin: "built-in",
  repositoryUrl: "https://github.com/schmayterling/hibi",
  sourceUrl: "https://github.com/schmayterling/hibi/tree/main/src/addons/vim",
};
const theme = {
  id: "night-garden",
  name: "Night Garden",
  description: "A dark theme.",
  version: "0.3.0",
  kind: "theme",
  authors: [{ displayName: "rin", discordId: "123456789" }],
  license: "MIT",
  origin: "community",
  source: "repository",
  sourceUrl: "https://github.com/rin/night/tree/" + "a".repeat(40),
  readmeUrl: "https://github.com/rin/night/blob/" + "a".repeat(40) + "/README.md",
  repositoryUrl: "https://github.com/rin/night",
  homepage: null,
};
const decode = (value) =>
  value.replace(/&(amp|lt|gt|quot|#39);/g, (_, name) =>
    ({ amp: "&", lt: "<", gt: ">", quot: '"', "#39": "'" })[name],
  );
const meta = (html, key) => {
  const found = [
    ...html.matchAll(
      new RegExp(`<meta (?:name|property)="${key}" content="([^"]*)" />`, "g"),
    ),
  ];
  assert.equal(found.length, 1, key);
  return decode(found[0][1]);
};
const jsonLd = (html) =>
  [...html.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/gs)].map(
    (match) => JSON.parse(match[1]),
  );

test("titles name the addon and its kind", () => {
  assert.equal(addonPageTitle(builtin), "Vim | hibi addons");
  assert.equal(addonPageTitle({ ...builtin, kind: "extension" }), "Vim | hibi addons");
  assert.equal(addonPageTitle(theme), "Night Garden | hibi themes");
});

test("built-in extension pages carry metadata and visible details without scripts", () => {
  const html = renderAddonPage(template, builtin);
  const url = "https://www.hibi.garden/addons/vim";
  assert.match(html, /<title>Vim \| hibi addons<\/title>/);
  assert.equal((html.match(/<title>/g) ?? []).length, 1);
  assert.equal(meta(html, "description"), builtin.description);
  assert.equal(meta(html, "og:title"), "Vim | hibi addons");
  assert.equal(meta(html, "og:description"), builtin.description);
  assert.equal(meta(html, "og:url"), url);
  assert.equal(meta(html, "twitter:title"), "Vim | hibi addons");
  assert.equal(meta(html, "twitter:description"), builtin.description);
  assert.match(html, /<link rel="canonical" href="https:\/\/www\.hibi\.garden\/addons\/vim" \/>/);
  assert.match(html, /property="og:image" content="https:\/\/www\.hibi\.garden\/opengraph\.png\?v=2"/);
  assert.doesNotMatch(html, /noindex|addons \| hibi</);
  assert.deepEqual(jsonLd(html), [
    {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      name: "Vim",
      description: builtin.description,
      softwareVersion: "1.2.0",
      url,
      author: [{ "@type": "Person", name: "may", url: "https://github.com/schmayterling" }],
      isBasedOn: {
        "@type": "SoftwareSourceCode",
        codeRepository: "https://github.com/schmayterling/hibi",
      },
    },
  ]);
  assert.doesNotMatch(html, /aggregateRating|offers|operatingSystem/);
  // Visible in the raw HTML, inside the mount point, before any script runs.
  const grid = html.slice(html.indexOf('<div id="addon-grid">'), html.indexOf("<noscript"));
  assert.match(grid, /<h1 id="addon-title">Vim<\/h1>/);
  assert.match(grid, /built in extension · v1\.2\.0/);
  assert.match(grid, /href="hibi:\/\/addons\/open\?id=vim">open in hibi</);
  assert.match(grid, /href="\/addons\/">← all addons</);
  assert.match(grid, /class="addon-repository"[^>]*href="https:\/\/github\.com\/schmayterling\/hibi"/);
  assert.match(grid, /href="https:\/\/github\.com\/schmayterling"[^>]*>may<\/a><small>author<\/small>/);
  assert.doesNotMatch(grid, /readme<\/p>|<script/);
});

test("community theme pages use CreativeWork and the install link", () => {
  const html = renderAddonPage(template, theme);
  assert.match(html, /<title>Night Garden \| hibi themes<\/title>/);
  assert.equal(meta(html, "og:url"), "https://www.hibi.garden/addons/night-garden");
  const [data] = jsonLd(html);
  assert.equal(data["@type"], "CreativeWork");
  assert.equal(data.version, "0.3.0");
  assert.equal(data.softwareVersion, undefined);
  assert.deepEqual(data.author, [{ "@type": "Person", name: "rin" }]);
  assert.equal(data.isBasedOn.codeRepository, "https://github.com/rin/night");
  assert.match(html, /community theme · v0\.3\.0<\/span><span>MIT/);
  assert.match(html, /href="hibi:\/\/addons\/install\?id=night-garden">install in hibi</);
  assert.match(html, /href="https:\/\/discord\.com\/users\/123456789"/);
  assert.match(html, />readme<\/a>.*>source<\/a>/);

  const bare = renderAddonPage(template, {
    ...theme,
    kind: "extension",
    source: "download",
    sourceUrl: "https://example.com/addon.zip",
    readmeUrl: null,
    repositoryUrl: null,
  });
  assert.equal(jsonLd(bare)[0].isBasedOn, undefined);
  assert.doesNotMatch(bare, /addon-repository|>readme</);
  assert.match(bare, /href="https:\/\/example\.com\/addon\.zip"[^>]*>download</);
});

test("hostile catalog strings cannot break attributes, scripts, or markup", () => {
  const evil = `"'><script>alert(1)</script><!--$&$1</title></head>`;
  const addon = {
    ...theme,
    name: `Theme ${evil}`,
    description: `</script><img src=x onerror=alert(1)> ${evil}`,
    version: `1 ${evil}`,
    license: `MIT ${evil}`,
    authors: [{ displayName: `<b>${evil}`, role: `role ${evil}` }],
    sourceUrl: `https://example.com/"onmouseover="alert(1)`,
    readmeUrl: "javascript:alert(1)",
  };
  const html = renderAddonPage(template, addon);
  const templateScripts = template.match(/<script/g).length;
  assert.equal(html.match(/<script/g).length, templateScripts + 1);
  assert.equal((html.match(/<\/head>/g) ?? []).length, 1);
  assert.equal((html.match(/<title>/g) ?? []).length, 1);
  assert.doesNotMatch(html, /<img src=x|<b>|<!--|alert\(1\)<\/script>|javascript:|"onmouseover/);
  assert.equal(meta(html, "description"), addon.description);
  assert.equal(meta(html, "og:title"), `${addon.name} | hibi themes`);
  assert.equal(meta(html, "twitter:description"), addon.description);
  const [data] = jsonLd(html);
  assert.equal(data.name, addon.name);
  assert.equal(data.version, addon.version);
  assert.equal(data.author[0].name, addon.authors[0].displayName);
  assert.match(html, /<h1 id="addon-title">Theme &quot;&#39;&gt;&lt;script&gt;/);
  assert.match(html, /\$&amp;\$1/);
});

test("missing addons render an honest noindex page without structured data", () => {
  const html = renderAddonPage(template, null);
  assert.match(html, /<title>addon not found \| hibi<\/title>/);
  assert.match(html, /<meta name="robots" content="noindex" \/>\s*<\/head>/);
  assert.equal(meta(html, "og:title"), "addon not found | hibi");
  assert.match(html, /<h1>addon not found<\/h1>/);
  assert.match(html, /This addon|does not match a listed addon/);
  assert.match(html, /href="\/addons\/">← all addons</);
  assert.doesNotMatch(html, /ld\+json|SoftwareApplication|rel="canonical"|og:url|twitter:title/);
});

test("template drift fails instead of shipping unrendered pages", () => {
  assert.throws(
    () => renderAddonPage(template.replace('<div id="addon-grid"></div>', ""), builtin),
    /addon page template is missing/,
  );
});
