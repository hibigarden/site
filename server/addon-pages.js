import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { addonIdFromPath, bundledAddons, fetchDirectory } from "../src/addon-directory.js";
import { renderAddonPage } from "../src/addon-seo.js";
import { communityFeed, datedAddons } from "./addon-dates.js";

const origin = "https://www.hibi.garden";
const escapeXml = (value) => value.replace(/[&<>"']/g, (character) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[character],
);

export async function readAddonPages(root) {
  const [template, catalog, snapshot] = await Promise.all([
    readFile(join(root, "dist/addons/index.html"), "utf8"),
    readFile(join(root, "dist/addons/catalog.json"), "utf8"),
    // Addon pages never depend on the community snapshot.
    readFile(join(root, "dist/addons/community-snapshot.json"), "utf8").catch(() => null),
  ]);
  return {
    template,
    addons: bundledAddons(JSON.parse(catalog)),
    snapshot: snapshot ? JSON.parse(snapshot) : { head: null, dates: {}, addons: [] },
  };
}

/** Shared by production functions and Vite so raw HTML works without JavaScript. */
export async function addonPageResponse(pathname, { template, addons, snapshot, fetch = globalThis.fetch }) {
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
  return new Response(renderAddonPage(template, addon ?? null), {
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
