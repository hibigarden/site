// Server-rendered metadata and fallback content for /addons/<id>. Every
// catalog string is escaped; readme HTML and addon code are never included.
import { addonPageLink, installLink, openLink } from "./addon-directory.js";

const SITE = "https://www.hibi.garden";
const NOT_FOUND = "this address does not match a listed addon. browse all addons to find one.";

const escape = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
  );
const link = (href, label, extra = "") =>
  href?.startsWith("https://")
    ? `<a${extra} href="${escape(href)}" target="_blank" rel="noopener noreferrer">${escape(label)}</a>`
    : "";

/** Replaces exactly one template match; a missing match means the template drifted. */
function swap(html, pattern, value) {
  if (!pattern.test(html)) throw new Error(`addon page template is missing ${pattern}`);
  return html.replace(pattern, () => value);
}

export const addonPageTitle = (addon) =>
  `${addon.name} | hibi ${addon.kind === "theme" ? "themes" : "addons"}`;

function structuredData(addon, url) {
  const theme = addon.kind === "theme";
  const data = {
    "@context": "https://schema.org",
    "@type": theme ? "CreativeWork" : "SoftwareApplication",
    name: addon.name,
    description: addon.description,
    [theme ? "version" : "softwareVersion"]: addon.version,
    url,
    author: addon.authors.map((author) => ({
      "@type": "Person",
      name: author.displayName,
      ...(author.github
        ? { url: `https://github.com/${encodeURIComponent(author.github)}` }
        : {}),
    })),
    ...(addon.repositoryUrl
      ? {
          isBasedOn: {
            "@type": "SoftwareSourceCode",
            codeRepository: addon.repositoryUrl,
          },
        }
      : {}),
  };
  // `<` cannot close the script element or open a comment once escaped.
  return `<script type="application/ld+json">${JSON.stringify(data).replace(/</g, "\\u003c")}</script>`;
}

function details(addon) {
  const builtin = addon.origin === "built-in";
  const kind = addon.kind === "theme" ? "theme" : "extension";
  const authors = addon.authors
    .map((author) => {
      const href = author.github
        ? `https://github.com/${encodeURIComponent(author.github)}`
        : author.discordId
          ? `https://discord.com/users/${encodeURIComponent(author.discordId)}`
          : null;
      const name = link(href, author.displayName) || `<span>${escape(author.displayName)}</span>`;
      return `<li>${name}${author.role ? `<small>${escape(author.role)}</small>` : ""}</li>`;
    })
    .join("");
  const repository = addon.repositoryUrl?.startsWith("https://")
    ? new URL(addon.repositoryUrl).pathname.slice(1)
    : null;
  return `<article class="addon-detail" aria-labelledby="addon-title">
<a class="addon-guide-link" href="/addons/">← all addons</a>
<header class="page-intro">
<h1 id="addon-title">${escape(addon.name)}</h1>
<p>${escape(addon.description)}</p>
<ul class="addon-authors" aria-label="authors">${authors}</ul>
${repository ? link(addon.repositoryUrl, repository, ` class="addon-repository" aria-label="github repository: ${escape(repository)}"`) : ""}
</header>
<div class="addon-availability"><span>${builtin ? "built in" : "community"} ${kind} · v${escape(addon.version)}</span><span>${builtin ? (addon.defaultEnabled ? "enabled by default" : "enable in settings → addons") : escape(addon.license)}</span></div>
<div class="addon-actions"><a class="addon-action" href="${escape(builtin ? openLink(addon.id) : installLink(addon.id))}">${builtin ? "open in hibi" : "install in hibi"}</a>${link(addon.readmeUrl, "readme")}${link(addon.sourceUrl, addon.source === "download" ? "download" : "source")}</div>
</article>`;
}

/**
 * Fills the built addons/index.html for one validated catalog entry, or the
 * not-found page (noindex) when `addon` is null. The caller sets the status.
 * `image` ({ url, alt }) replaces the site's social image.
 */
export function renderAddonPage(template, addon, unavailable = false, image = null) {
  const missingTitle = unavailable ? "addon unavailable" : "addon not found";
  const missingDescription = unavailable
    ? "the addon directory is temporarily unavailable. please try again."
    : NOT_FOUND;
  const title = addon ? addonPageTitle(addon) : `${missingTitle} | hibi`;
  const description = escape(addon ? addon.description : missingDescription);
  const url = addon && `${SITE}${addonPageLink(addon.id)}`;
  const head = addon
    ? `  <link rel="canonical" href="${escape(url)}" />
    <meta property="og:url" content="${escape(url)}" />
    <meta name="twitter:title" content="${escape(title)}" />
    <meta name="twitter:description" content="${description}" />
    ${structuredData(addon, url)}
  </head>`
    : `  <meta name="robots" content="noindex" />
  </head>`;
  const body = addon
    ? details(addon)
    : `<section class="addon-detail">
<a class="addon-guide-link" href="/addons/">← all addons</a>
<div class="page-intro"><h1>${missingTitle}</h1><p role="status">${missingDescription}</p></div>
</section>`;
  let html = swap(template, /<title>[^<]*<\/title>/, `<title>${escape(title)}</title>`);
  html = swap(html, /<meta\s+name="description"\s+content="[^"]*"\s*\/?>/, `<meta name="description" content="${description}" />`);
  html = swap(html, /<meta\s+property="og:title"\s+content="[^"]*"\s*\/?>/, `<meta property="og:title" content="${escape(title)}" />`);
  html = swap(html, /<meta\s+property="og:description"\s+content="[^"]*"\s*\/?>/, `<meta property="og:description" content="${description}" />`);
  if (image) {
    html = swap(html, /<meta\s+property="og:image"\s+content="[^"]*"\s*\/?>/, `<meta property="og:image" content="${escape(image.url)}" />`);
    html = swap(html, /<meta\s+property="og:image:alt"\s+content="[^"]*"\s*\/?>/, `<meta property="og:image:alt" content="${escape(image.alt)}" />`);
    html = swap(html, /<meta\s+name="twitter:image"\s+content="[^"]*"\s*\/?>/, `<meta name="twitter:image" content="${escape(image.url)}" />`);
  }
  html = swap(html, /<div id="addon-grid"><\/div>/, `<div id="addon-grid">${body}</div>`);
  return swap(html, /<\/head>/, head);
}
