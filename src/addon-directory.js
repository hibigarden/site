// Community addons come from the public addon directory. The directory is
// discovery metadata only: Hibi checks signatures and asks before installing.
export const DIRECTORY_REPOSITORY =
  "https://github.com/hibigarden/addons-repository";
export const DIRECTORY_URL =
  "https://raw.githubusercontent.com/hibigarden/addons-repository/main/catalog.json";
const MAX_BYTES = 1024 * 1024;
const MAX_ENTRIES = 500;
const ID = /^[a-z][a-z0-9-]{0,47}$/;
const COMMIT = /^[0-9a-f]{40}$/;
const SHA256 = /^[0-9a-f]{64}$/;
const FOLDER =
  /^[A-Za-z0-9_][A-Za-z0-9._-]*(?:\/[A-Za-z0-9_][A-Za-z0-9._-]*)*$/;

const text = (value, max) =>
  typeof value === "string" && !!value.trim() && value.length <= max;

function https(value) {
  if (typeof value !== "string" || value.length > 2048) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password
      ? url
      : null;
  } catch {
    return null;
  }
}

function authors(value) {
  if (!Array.isArray(value) || !value.length || value.length > 20) return null;
  const result = value.map((author) =>
    author && text(author.displayName, 100)
      ? {
          displayName: author.displayName,
          ...(typeof author.github === "string" &&
          /^[a-z\d-]{1,39}$/i.test(author.github)
            ? { github: author.github }
            : {}),
          ...(typeof author.discordId === "string" &&
          /^\d{5,24}$/.test(author.discordId)
            ? { discordId: author.discordId }
            : {}),
          ...(text(author.role, 100) ? { role: author.role } : {}),
        }
      : null,
  );
  return result.includes(null) ? null : result;
}

/** GitHub pages for a pinned repository folder, or the repository itself elsewhere. */
function repositoryLinks(url, ref, folder) {
  const match =
    url.hostname === "github.com" &&
    url.pathname.match(/^\/([^/]+)\/([^/]+?)(?:\.git)?\/?$/);
  if (!match) return { source: url.href, readme: null, repository: null };
  const base = `https://github.com/${match[1]}/${match[2]}`;
  const path = folder ? `/${folder}` : "";
  return {
    source: `${base}/tree/${ref}${path}`,
    readme: `${base}/blob/${ref}${path}/README.md`,
    repository: base,
  };
}

function source(entry) {
  const sources = ["path", "repository", "download"].filter(
    (key) => entry[key] !== undefined,
  );
  if (sources.length !== 1) return null;
  if (entry.path !== undefined)
    return entry.path === `addons/${entry.id}`
      ? {
          type: "directory",
          ...repositoryLinks(new URL(DIRECTORY_REPOSITORY), "main", entry.path),
        }
      : null;
  if (entry.repository !== undefined) {
    const { url, commit, path } = entry.repository ?? {};
    const parsed = https(url);
    if (
      !parsed ||
      !COMMIT.test(commit ?? "") ||
      (path !== undefined && !FOLDER.test(path))
    )
      return null;
    return { type: "repository", ...repositoryLinks(parsed, commit, path) };
  }
  const { url, sha256, size } = entry.download ?? {};
  const parsed = https(url);
  if (
    !parsed ||
    !SHA256.test(sha256 ?? "") ||
    !Number.isSafeInteger(size) ||
    size < 1 ||
    size > 25 * 1024 * 1024
  )
    return null;
  return { type: "download", source: parsed.href, readme: null };
}

/**
 * Keeps valid entries whose IDs are not built in, copying only known fields.
 * Returns the entries and the number skipped.
 */
export function parseDirectory(value, builtinIds = []) {
  if (!Array.isArray(value)) throw new Error("The addon directory is invalid.");
  const reserved = new Set(builtinIds);
  const entries = [];
  let skipped = 0;
  for (const entry of value.slice(0, MAX_ENTRIES)) {
    const credited = authors(entry?.authors);
    const location = entry && typeof entry === "object" && source(entry);
    const homepage =
      entry?.homepage === undefined ? null : https(entry.homepage);
    if (
      !location ||
      !credited ||
      !ID.test(entry.id ?? "") ||
      reserved.has(entry.id) ||
      !text(entry.name, 100) ||
      !text(entry.description, 500) ||
      !text(entry.version, 40) ||
      !text(entry.license, 100) ||
      ![1, 2, 3].includes(entry.apiVersion) ||
      !["extension", "theme"].includes(entry.kind) ||
      (entry.homepage !== undefined && !homepage)
    ) {
      skipped++;
      continue;
    }
    reserved.add(entry.id);
    entries.push({
      id: entry.id,
      name: entry.name,
      description: entry.description,
      version: entry.version,
      kind: entry.kind,
      authors: credited,
      license: entry.license,
      origin: "community",
      source: location.type,
      sourceUrl: location.source,
      readmeUrl: location.readme,
      repositoryUrl: location.repository ?? null,
      homepage: homepage?.href ?? null,
    });
  }
  return {
    entries,
    skipped: skipped + Math.max(0, value.length - MAX_ENTRIES),
  };
}

export function matchesAddon(addon, query, kind = "all") {
  if (kind !== "all" && addon.kind !== kind) return false;
  return [
    addon.id,
    addon.name,
    addon.description,
    addon.kind,
    addon.version,
    addon.origin === "built-in" ? "built in" : "community",
    addon.license,
    ...addon.authors.map((author) => author.displayName),
  ]
    .join(" ")
    .toLowerCase()
    .includes(query.trim().toLowerCase());
}

export function bundledAddons(catalog) {
  const repository = "https://github.com/schmayterling/hibi";
  return catalog.map((addon) => ({
    ...addon,
    origin: "built-in",
    repositoryUrl: repository,
    sourceUrl: `${repository}/tree/main/src/addons/${addon.id}`,
  }));
}

export const addonPageLink = (id) => `/addons/${encodeURIComponent(id)}`;
export const addonIdFromPath = (pathname) =>
  pathname.match(/^\/addons\/([a-z][a-z0-9-]{0,47})\/?$/)?.[1] ?? null;

export const installLink = (id) =>
  `hibi://addons/install?id=${encodeURIComponent(id)}`;
export const openLink = (id) =>
  `hibi://addons/open?id=${encodeURIComponent(id)}`;

/** Bounded, credential-free fetch of the public directory. */
export async function fetchDirectory(
  builtinIds,
  { signal, fetch = globalThis.fetch } = {},
) {
  const response = await fetch(DIRECTORY_URL, {
    credentials: "omit",
    cache: "no-cache",
    signal: signal
      ? AbortSignal.any([signal, AbortSignal.timeout(15000)])
      : AbortSignal.timeout(15000),
  });
  if (!response.ok)
    throw new Error(`The addon directory returned ${response.status}.`);
  if (Number(response.headers.get("content-length")) > MAX_BYTES)
    throw new Error("The addon directory is too large.");
  const reader = response.body?.getReader();
  if (!reader) throw new Error("The addon directory is empty.");
  const decoder = new TextDecoder();
  let body = "", bytes = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > MAX_BYTES) {
        await reader.cancel();
        throw new Error("The addon directory is too large.");
      }
      body += decoder.decode(value, { stream: true });
    }
    body += decoder.decode();
  } finally {
    reader.releaseLock();
  }
  return parseDirectory(JSON.parse(body), builtinIds);
}

const MONTHS = ["i", "ii", "iii", "iv", "v", "vi", "vii", "viii", "ix", "x", "xi", "xii"];
/** "2026-10-12" → "12.x.2026", the site's label style; null for anything else. */
export function addonDay(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value ?? "");
  return match && MONTHS[match[2] - 1] && +match[3]
    ? `${+match[3]}.${MONTHS[match[2] - 1]}.${match[1]}`
    : null;
}

/**
 * Newest first by `released` or `updated`. Undated entries follow in their
 * given (catalog) order, so a missing date never hides an addon.
 */
export function sortAddons(addons, order) {
  const date = (addon) => (addonDay(addon[order]) ? addon[order] : "");
  return [...addons].sort((a, b) => {
    const [x, y] = [date(a), date(b)];
    if (!x || !y) return !x - !y;
    return (
      y.localeCompare(x) ||
      a.name.localeCompare(b.name, "en", { sensitivity: "base" })
    );
  });
}
