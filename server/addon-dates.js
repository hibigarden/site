// Release and update days for community addons, read from the public addon
// directory's git history. Built-in days arrive with the addon sync instead.
import { fetchDirectory } from "../src/addon-directory.js";

const API = "https://api.github.com/repos/hibigarden/addons-repository";
const DAY = /^\d{4}-\d{2}-\d{2}$/;

// Folder entries live in addons/<id>; every listed entry also has a signature
// that is re-signed for each published version, which dates external sources.
const trackedPath = (entry) =>
  entry.source === "directory" ? `addons/${entry.id}` : `signatures/${entry.id}.json`;
const day = (commit) => {
  const value = commit?.commit?.committer?.date?.slice(0, 10);
  return DAY.test(value ?? "") ? value : null;
};

async function github(url, { fetch, token, signal }) {
  if (!url.startsWith(`${API}/`)) throw new Error("unexpected GitHub URL");
  const response = await fetch(url, {
    headers: {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    signal,
  });
  if (response.ok) return response;
  const error = new Error(`GitHub returned ${response.status}.`);
  const retry = Number(response.headers.get("retry-after"));
  const reset = Number(response.headers.get("x-ratelimit-reset"));
  if (retry > 0) error.retryAt = Date.now() + retry * 1000;
  else if (response.headers.get("x-ratelimit-remaining") === "0" && reset > 0)
    error.retryAt = reset * 1000;
  throw error;
}

/**
 * First and last commit day for each entry's tracked path. Reuses `known`
 * when the repository head has not moved, so a quiet directory costs one
 * request per refresh.
 * ponytail: a moved head costs 1 + entries requests (60/hour without a
 * token). past ~25 entries, set GITHUB_TOKEN or read the compare API.
 */
export async function communityDates(entries, { fetch = globalThis.fetch, token, known, signal } = {}) {
  const options = { fetch, token, signal };
  const [latest] = await (await github(`${API}/commits?per_page=1`, options)).json();
  const head = latest?.sha ?? null;
  if (head && known?.head === head && entries.every((entry) => Object.hasOwn(known.dates, entry.id)))
    return known;
  const dates = Object.fromEntries(
    await Promise.all(
      entries.map(async (entry) => {
        const url = `${API}/commits?path=${encodeURIComponent(trackedPath(entry))}&per_page=100`;
        const response = await github(url, options);
        const commits = await response.json();
        const last = response.headers.get("link")?.match(/<([^>]+)>;\s*rel="last"/)?.[1];
        const oldest = last ? (await (await github(last, options)).json()).at(-1) : commits.at(-1);
        const released = day(oldest), updated = day(commits[0]);
        return [entry.id, released && updated ? { released, updated } : null];
      }),
    ),
  );
  return { head, dates };
}

let known = null;
let last = null;
let pausedUntil = 0;

/**
 * The community entries with their days. Falls back to `snapshot` (written at
 * build time) when the directory or the GitHub API is unavailable, stops
 * calling the API until a rate limit resets, and reuses a live answer for five
 * minutes per instance, whatever the CDN cache key was.
 */
export async function communityFeed(snapshot, builtinIds, { fetch = globalThis.fetch, token = process.env.GITHUB_TOKEN, now = Date.now() } = {}) {
  if (last && now - last.at < 300_000) return last.feed;
  let { addons } = snapshot;
  let dates = known ?? { head: snapshot.head, dates: snapshot.dates };
  let live = false;
  try {
    ({ entries: addons } = await fetchDirectory(builtinIds, { fetch }));
  } catch {
    /* Keep the snapshot's entries. */
  }
  if (now >= pausedUntil)
    try {
      known = dates = await communityDates(addons, { fetch, token, known: dates, signal: AbortSignal.timeout(8000) });
      live = true;
    } catch (error) {
      pausedUntil = Math.min(error.retryAt ?? now + 60_000, now + 3_600_000);
    }
  const feed = { head: dates.head, dates: dates.dates, addons, live };
  if (live) last = { at: now, feed };
  return feed;
}

/** Test hook: forget the module cache and any rate-limit pause. */
export function resetCommunityCache() {
  known = last = null;
  pausedUntil = 0;
}

/** Entries with `released`/`updated` attached when known. */
export const datedAddons = ({ addons, dates }) =>
  addons.map((entry) => ({ ...entry, ...(dates[entry.id] ?? {}) }));
