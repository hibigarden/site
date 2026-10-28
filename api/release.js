import { readSnapshot, releaseResponse } from "../server/release.js";

let snapshot;
export default async function handler(request, response) {
  if (!["GET", "HEAD"].includes(request.method)) {
    response.setHeader("Allow", "GET, HEAD");
    response.statusCode = 405;
    response.end();
    return;
  }
  try {
    snapshot ??= readSnapshot(process.cwd()).catch(() => null);
    const result = await releaseResponse(await snapshot, { token: process.env.GITHUB_TOKEN });
    response.statusCode = result.status;
    response.setHeader("Content-Type", "application/json; charset=utf-8");
    response.setHeader("Cache-Control", result.cache);
    response.end(request.method === "HEAD" ? "" : JSON.stringify(result.body));
  } catch (error) {
    console.error("Could not read the latest release:", error);
    response.statusCode = 502;
    response.setHeader("Cache-Control", "no-store");
    response.end();
  }
}
