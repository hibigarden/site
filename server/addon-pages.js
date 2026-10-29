import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { addonIdFromPath, bundledAddons, fetchDirectory } from "../src/addon-directory.js";
import { renderAddonPage } from "../src/addon-seo.js";
import { communityFeed, datedAddons } from "./addon-dates.js";

const origin = "https://www.hibi.garden";

/** What an addon's social image shows: a change to any of it needs a new image. */
export const ogCard = (addon) => ({
  id: addon.id,
  name: addon.name,
  description: addon.description,
  kind: addon.kind === "theme" ? "theme" : "extension",
  origin: addon.origin === "built-in" ? "built in" : "community",
  authors: addon.authors.map((author) => author.displayName),
});
export const ogKind = (card) => `${card.origin} ${card.kind}`;
export const ogHash = (data) => createHash("sha256").update(data).digest("hex").slice(0, 12);
export const ogKey = (addon) => ogHash(JSON.stringify(ogCard(addon)));

/**
 * The addon's own social image when this build drew it from the same card.
 * Addons added or changed since the deploy keep the site image.
 */
export function ogImage(addon, images = {}) {
  const image = images[addon.id];
  if (image?.card !== ogKey(addon)) return null;
  const card = ogCard(addon);
  return {
    url: `${origin}/addons/${encodeURIComponent(addon.id)}/og.png?v=${image.png}`,
    alt: `${card.name}, ${ogKind(card)} by ${card.authors.join(", ")}, on a torn paper card under hibi's sky.`,
  };
}
const escapeXml = (value) => value.replace(/[&<>"']/g, (character) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[character],
);

export async function readAddonPages(root) {
  const [template, catalog, snapshot, images] = await Promise.all([
    readFile(join(root, "dist/addons/index.html"), "utf8"),
    readFile(join(root, "dist/addons/catalog.json"), "utf8"),
    // Addon pages never depend on the community snapshot or their images.
    readFile(join(root, "dist/addons/community-snapshot.json"), "utf8").catch(() => null),
    readFile(join(root, "dist/addons/og.json"), "utf8").catch(() => null),
  ]);
  return {
    template,
    addons: bundledAddons(JSON.parse(catalog)),
    snapshot: snapshot ? JSON.parse(snapshot) : { head: null, dates: {}, addons: [] },
    images: images ? JSON.parse(images) : {},
  };
}

/** Shared by production functions and Vite so raw HTML works without JavaScript. */
export async function addonPageResponse(pathname, { template, addons, snapshot, images, fetch = globalThis.fetch }) {
  if (pathname === "/addons/community.json") {
    const feed = await communityFeed(snapshot, addons.map((entry) => entry.id), { fetch });
    return new Response(JSON.stringify({ live: feed.live, addons: datedAddons(feed) }), {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        // A snapshot answer is retried sooner than a live one.
        "Cache-Control": feed.live
          ? "public, max-age=0, s-maxage=300, stale-while-revalidate=3600"
          : "public, max-age=0, s-maxage=60, stale-while-revalidate=600",
      },
    });
  }
  const sitemap = pathname === "/sitemap.xml";
  const id = addonIdFromPath(pathname);
  if (!sitemap && !id) return null;
  let addon = addons.find((entry) => entry.id === id);
  if (sitemap || !addon) {
    try {
      const directory = await fetchDirectory(addons.map((entry) => entry.id), { fetch });
      addons = [...addons, ...directory.entries];
      addon = addons.find((entry) => entry.id === id);
    } catch {
      const body = sitemap
        ? "The addon directory is temporarily unavailable."
        : renderAddonPage(template, null, true);
      return new Response(body, {
        status: 503,
        headers: {
          "Content-Type": sitemap ? "text/plain; charset=utf-8" : "text/html; charset=utf-8",
          "Cache-Control": "no-store",
          "Retry-After": "60",
          "X-Robots-Tag": "noindex",
        },
      });
    }
  }
  if (sitemap) {
    const paths = ["/", "/download/", "/sync/", "/publish/", "/addons/", ...addons.map((entry) => `/addons/${entry.id}`)];
    return new Response(
      `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${paths.map((path) => `<url><loc>${escapeXml(origin + path)}</loc></url>`).join("")}</urlset>`,
      { headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=0, s-maxage=300, stale-while-revalidate=3600" } },
    );
  }
  return new Response(renderAddonPage(template, addon ?? null, false, addon && ogImage(addon, images)), {
    status: addon ? 200 : 404,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": addon
        ? "public, max-age=0, s-maxage=300, stale-while-revalidate=3600"
        : "public, max-age=0, s-maxage=60",
      ...(addon ? {} : { "X-Robots-Tag": "noindex" }),
    },
  });
}
