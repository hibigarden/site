import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { RELEASES, fromGitHub, nightlyUrl, renderDownload } from "../src/release.js";

const API = "https://api.github.com/repos/schmayterling/hibi/releases/latest";
const NIGHTLY_FEED = `${RELEASES}/download/nightly/feed.json`;
const MARKER = "<!--hibi:download-->";

async function nightlyTag(fetch, signal) {
  try {
    const response = await fetch(NIGHTLY_FEED, { signal });
    return response.ok ? (await response.json()).tag : undefined;
  } catch {
    return undefined;
  }
}

/** the latest release from GitHub's api (sizes and sha256 digests) plus the newest nightly's tag */
export async function fetchRelease({ fetch = globalThis.fetch, token = process.env.GITHUB_TOKEN, timeout = 8000 } = {}) {
  const signal = AbortSignal.timeout(timeout);
  const headers = { accept: "application/vnd.github+json", "user-agent": "hibi-site" };
  if (token) headers.authorization = `Bearer ${token}`;
  const [response, nightly] = await Promise.all([fetch(API, { headers, signal }), nightlyTag(fetch, signal)]);
  if (!response.ok) throw new Error(`GitHub releases api answered ${response.status}`);
  return fromGitHub(await response.json(), nightly);
}

/**
 * /api/release: the build's snapshot while it is still the latest release (github.com's redirect says so
 * without spending the api's 60 requests an hour), the api when a newer release is out, the snapshot again
 * when GitHub can't be reached. CDN-cached for five minutes either way.
 */
export async function releaseResponse(snapshot, { fetch = globalThis.fetch, token, timeout = 6000 } = {}) {
  const signal = AbortSignal.timeout(timeout);
  try {
    const latest = await fetch(`${RELEASES}/latest`, { method: "HEAD", redirect: "manual", signal });
    const tag = latest.headers.get("location")?.match(/\/releases\/tag\/([^/?#]+)$/)?.[1];
    let release;
    if (snapshot && tag === snapshot.tag) {
      const nightly = await nightlyTag(fetch, signal);
      release = { ...snapshot, nightly: nightly ? nightlyUrl(nightly) : snapshot.nightly };
    } else release = await fetchRelease({ fetch, token, timeout });
    return { status: 200, cache: "public, max-age=0, s-maxage=300, stale-while-revalidate=86400", body: release };
  } catch (error) {
    if (!snapshot) throw error;
    return { status: 200, cache: "public, max-age=0, s-maxage=60, stale-while-revalidate=600", body: snapshot };
  }
}

export const readSnapshot = async (root) => JSON.parse(await readFile(join(root, "dist/release.json"), "utf8"));

/**
 * vite: fetch the latest release once per build (or dev server), render the download blocks into the html at
 * <!--hibi:download--> and save the snapshot as /release.json for the function's fallback. offline builds
 * still work: the block falls back to a plain link to the newest release.
 */
export function releasePlugin() {
  let release;
  const load = () =>
    (release ??= fetchRelease().catch((error) => {
      console.warn(`hibi-release: ${error.message}; rendering the plain download link`);
      return null;
    }));
  return {
    name: "hibi-release",
    async transformIndexHtml(html) {
      if (!html.includes(MARKER)) return html;
      const block = renderDownload(await load());
      return html.replaceAll(MARKER, block);
    },
    async generateBundle() {
      const snapshot = await load();
      if (snapshot) this.emitFile({ type: "asset", fileName: "release.json", source: JSON.stringify(snapshot) });
    },
    configureServer(server) {
      server.middlewares.use("/api/release", async (request, response) => {
        const snapshot = await load();
        response.setHeader("content-type", "application/json; charset=utf-8");
        response.setHeader("cache-control", "no-store");
        response.end(JSON.stringify(snapshot));
      });
    },
  };
}
