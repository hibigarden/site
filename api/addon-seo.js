import { addonPageResponse, readAddonPages } from "../server/addon-pages.js";

let assets;
export default async function handler(request, response) {
  if (!["GET", "HEAD"].includes(request.method)) {
    response.setHeader("Allow", "GET, HEAD");
    response.statusCode = 405;
    response.end();
    return;
  }
  const { id, sitemap } = request.query;
  const pathname = sitemap === "1" ? "/sitemap.xml" : typeof id === "string" ? `/addons/${id}` : "";
  try {
    assets ??= readAddonPages(process.cwd());
    const result = await addonPageResponse(pathname, await assets);
    response.statusCode = result?.status ?? 404;
    if (result)
      for (const [name, value] of result.headers) response.setHeader(name, value);
    response.end(request.method === "HEAD" || !result ? "" : await result.text());
  } catch (error) {
    console.error("Could not render addon page:", error);
    response.statusCode = 500;
    response.setHeader("Cache-Control", "no-store");
    response.end("The addon page is temporarily unavailable.");
  }
}
