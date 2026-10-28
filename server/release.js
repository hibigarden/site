import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { marked } from "marked";
import sanitizeHtml from "sanitize-html";
import { RELEASES, fromGitHub, nightlyFromFeed, renderDownloadPage, renderFallback } from "../src/release.js";

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

/** the release body (markdown written by the release workflow) as safe html: no raw html, links open as links */
export function renderNotes(markdown) {
  if (typeof markdown !== "string" || !markdown.trim()) return "";
  return sanitizeHtml(marked.parse(markdown.slice(0, 20000)), {
    allowedTags: ["p", "ul", "ol", "li", "strong", "em", "code", "pre", "a", "h3", "h4", "blockquote", "br"],
    allowedAttributes: { a: ["href"] },
    allowedSchemes: ["https"],
    transformTags: { h1: "h3", h2: "h3", h3: "h4", h4: "h4", h5: "h4", h6: "h4" },
  });
}

/**
 * the latest release from GitHub's api (sizes, sha256 digests, notes), earlier releases and the newest nightly.
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
  return fromGitHub(latest, { notes: renderNotes(latest.body), list: releases, nightly });
}

/**
 * /api/release: the build's snapshot while it is still the latest release (github.com's redirect says so
 * without spending the api's 60 requests an hour) with a fresh nightly, the api when a newer release is out,
 * the snapshot again when GitHub can't be reached. CDN-cached for five minutes either way.
 */
export async function releaseResponse(snapshot, { fetch = globalThis.fetch, token, timeout = 6000 } = {}) {
  const signal = AbortSignal.timeout(timeout);
  try {
    const tag = await latestTag(fetch, signal);
    let release;
    if (snapshot && tag === snapshot.tag) {
      const nightly = nightlyFromFeed(await nightlyFeed(fetch, signal));
      release = { ...snapshot, nightly: nightly ?? snapshot.nightly };
    } else release = await fetchRelease({ fetch, token, timeout });
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
  return {
    name: "hibi-release",
    configResolved(config) {
      dev = config.command === "serve";
      cache = join(config.root, "node_modules/.cache/hibi-release.json");
    },
    async transformIndexHtml(html) {
      if (!html.includes(MARKER)) return html;
      const snapshot = await load();
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
        response.end(JSON.stringify(await load()));
      });
    },
  };
}
