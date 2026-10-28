import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { RELEASES, fromGitHub, renderDownloadPage, renderFallback } from "../src/release.js";

const API = "https://api.github.com/repos/schmayterling/hibi/releases";
const NIGHTLY_FEED = `${RELEASES}/download/nightly/feed.json`;
const MARKER = "<!--hibi:download-->";

/** the latest release's tag from github.com's redirect, which doesn't count against the api's rate limit */
async function latestTag(fetch, signal) {
  try {
    const response = await fetch(`${RELEASES}/latest`, { method: "HEAD", redirect: "manual", signal });
    return response.headers.get("location")?.match(/\/releases\/tag\/([^/?#]+)$/)?.[1];
  } catch {
    return undefined;
  }
}

async function nightlyFeed(fetch, signal) {
  try {
    const response = await fetch(NIGHTLY_FEED, { signal });
    return response.ok ? await response.json() : null;
  } catch {
    return null;
  }
}

/**
 * the latest release and the newest nightly from GitHub's api (installers, sizes, sha256 digests).
 * one api request (the release list) unless the latest release is older than the last 30 builds.
 */
export async function fetchRelease({ fetch = globalThis.fetch, token = process.env.GITHUB_TOKEN, timeout = 8000 } = {}) {
  const signal = AbortSignal.timeout(timeout);
  const headers = { accept: "application/vnd.github+json", "user-agent": "hibi-site" };
  if (token) headers.authorization = `Bearer ${token}`;
  const api = async (path) => {
    const response = await fetch(`${API}${path}`, { headers, signal });
    if (!response.ok) throw new Error(`GitHub releases api answered ${response.status}`);
    return response.json();
  };
  const [list, tag, nightly] = await Promise.all([api("?per_page=30"), latestTag(fetch, signal), nightlyFeed(fetch, signal)]);
  const releases = Array.isArray(list) ? list : [];
  const latest =
    releases.find((entry) => tag && entry.tag_name === tag) ??
    (tag ? null : releases.find((entry) => !entry.draft && !entry.prerelease)) ??
    (await api("/latest"));
  return fromGitHub(latest, { list: releases, nightly });
}

/**
 * /api/release: the build's snapshot while its release and nightly are still the newest (github.com's redirect
 * and the nightly feed say so without spending the api's 60 requests an hour), the api when a newer one is out
 * (a nightly's installers are only in the api), the snapshot again when GitHub can't be reached. CDN-cached for
 * five minutes either way.
 */
export async function releaseResponse(snapshot, { fetch = globalThis.fetch, token, timeout = 6000 } = {}) {
  const signal = AbortSignal.timeout(timeout);
  try {
    const [tag, feed] = await Promise.all([latestTag(fetch, signal), nightlyFeed(fetch, signal)]);
    const current = snapshot && tag === snapshot.tag && (!feed?.tag || feed.tag === snapshot.nightly?.tag);
    const release = current ? snapshot : await fetchRelease({ fetch, token, timeout });
    return { status: 200, cache: "public, max-age=0, s-maxage=300, stale-while-revalidate=86400", body: release };
  } catch (error) {
    if (!snapshot) throw error;
    return { status: 200, cache: "public, max-age=0, s-maxage=60, stale-while-revalidate=600", body: snapshot };
  }
}

export const readSnapshot = async (root) => JSON.parse(await readFile(join(root, "dist/release.json"), "utf8"));

/**
 * vite: fetch the latest release once per build (or dev server), render /download from it at
 * <!--hibi:download--> and save the snapshot as /release.json for the function's fallback. the last snapshot
 * is kept in node_modules/.cache: dev servers reuse it for an hour (restarts would spend the api's 60 requests
 * an hour), and a build that can't reach GitHub uses it. with neither, /download points to GitHub without numbers.
 */
export function releasePlugin() {
  let release;
  let cache;
  let dev = false;
  async function read() {
    try {
      const [info, text] = await Promise.all([stat(cache), readFile(cache, "utf8")]);
      return { age: Date.now() - info.mtimeMs, release: JSON.parse(text) };
    } catch {
      return null;
    }
  }
  async function snapshot() {
    const saved = await read();
    if (dev && saved && saved.age < 3600e3) return saved.release;
    try {
      const fresh = await fetchRelease();
      await mkdir(dirname(cache), { recursive: true });
      await writeFile(cache, JSON.stringify(fresh));
      return fresh;
    } catch (error) {
      console.warn(`hibi-release: ${error.message}; ${saved ? `using the saved ${saved.release.tag}` : "/download points to GitHub instead"}`);
      return saved?.release ?? null;
    }
  }
  const load = () => (release ??= snapshot());
  // a dev server lives for hours: every few minutes it asks the same cheap question /api/release asks in
  // production (github.com's latest-release redirect and the nightly feed; the api only when something is new) and
  // replaces what it remembers, so pages and /api/release pick up a release published while it runs
  let checked = 0;
  async function current() {
    const known = await load();
    if (!dev || Date.now() - checked < 300e3) return known;
    checked = Date.now();
    try {
      const { body } = await releaseResponse(known);
      if (body && (body.tag !== known?.tag || body.nightly?.tag !== known?.nightly?.tag)) {
        release = Promise.resolve(body);
        await writeFile(cache, JSON.stringify(body)).catch(() => {});
      }
      return body ?? known;
    } catch {
      return known;
    }
  }
  return {
    name: "hibi-release",
    configResolved(config) {
      dev = config.command === "serve";
      cache = join(config.root, "node_modules/.cache/hibi-release.json");
    },
    async transformIndexHtml(html) {
      if (!html.includes(MARKER)) return html;
      const snapshot = await current();
      return html.replace(MARKER, snapshot ? renderDownloadPage(snapshot) : renderFallback());
    },
    async generateBundle() {
      const snapshot = await load();
      if (snapshot) this.emitFile({ type: "asset", fileName: "release.json", source: JSON.stringify(snapshot) });
    },
    configureServer(server) {
      server.middlewares.use("/api/release", async (request, response) => {
        response.setHeader("content-type", "application/json; charset=utf-8");
        response.setHeader("cache-control", "no-store");
        response.end(JSON.stringify(await current()));
      });
    },
  };
}
