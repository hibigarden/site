import { mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";

// the landing's team and everyone who helped: GitHub's contributor lists for hibi's repositories, merged into one
// list (bots dropped, counts summed), with each avatar fetched once at twice its display size and served from the
// site itself. the build renders the section at <!--hibi:people--> and emits the avatars as /people/*; the dev
// server reuses the last copy for an hour. without a copy or the network, the team and the sponsor still show.
const API = "https://api.github.com/repos";
export const REPOS = [
  "schmayterling/hibi",
  "hibigarden/site",
  "hibigarden/docs",
  "hibigarden/addons-repository",
  "hibigarden/addon-starter",
  "hibigarden/theme-starter",
];
export const SPONSORS = ["nerdsflash"];
export const TEAM = [
  { login: "schmayterling", role: "project lead, core, macOS, windows", site: "https://ryanaque.com" },
  { login: "LizAinslie", role: "linux, nix maintainer", site: "https://lizainslie.dev/" },
  { login: "aeron-cap", role: "windows maintainer", site: "https://aeron.is-a.dev/" },
  { login: "uncomfyhalomacro", role: "linux maintainer", site: "https://uncomfyhalomacro.pl/" },
];
export const SIZES = { photo: 88, avatar: 48 };
const MARKER = "<!--hibi:people-->";
const LOGIN = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/;
const AVATAR_HOST = "https://avatars.githubusercontent.com/";

/** one entry per person across every repository's list: bots dropped, counts summed, sponsors first, then by count */
export function rankPeople(lists) {
  const people = new Map();
  for (const list of lists)
    for (const entry of Array.isArray(list) ? list : []) {
      if (entry?.type === "Bot" || !LOGIN.test(entry?.login ?? "")) continue;
      const key = entry.login.toLowerCase();
      const person = people.get(key) ?? { login: entry.login, contributions: 0, avatar: entry.avatar_url };
      person.contributions += Number.isSafeInteger(entry.contributions) ? entry.contributions : 0;
      people.set(key, person);
    }
  const sponsor = (login) => SPONSORS.findIndex((s) => s.toLowerCase() === login.toLowerCase());
  return [...people.values()].sort((a, b) => {
    const [sa, sb] = [sponsor(a.login), sponsor(b.login)];
    if (sa !== sb) return (sa < 0 ? Infinity : sa) - (sb < 0 ? Infinity : sb);
    return b.contributions - a.contributions || (a.login.toLowerCase() < b.login.toLowerCase() ? -1 : 1);
  });
}

/** what the page shows with no copy and no network: the sponsors, then the team, without photos */
export const fallbackPeople = () => ({
  people: [...SPONSORS, ...TEAM.map((t) => t.login)].map((login) => ({ login, contributions: 0 })),
  avatars: {},
});

const avatarUrl = (url, size) => {
  if (typeof url !== "string" || !url.startsWith(AVATAR_HOST)) return null;
  return `${url}${url.includes("?") ? "&" : "?"}s=${size * 2}`;
};
const extension = (type) => ({ "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "image/gif": "gif" })[type] ?? null;

/**
 * GitHub's contributor lists (the token, when set, goes only to api.github.com) and every avatar (no token), as
 * { people, avatars: { login: { avatar, photo } }, files: { name: bytes } }. any failed request fails the whole
 * refresh, so a half-fetched copy never replaces a good one.
 */
export async function fetchPeople({ fetch = globalThis.fetch, token = process.env.GITHUB_TOKEN, timeout = 15000, resize = true } = {}) {
  const signal = AbortSignal.timeout(timeout);
  const headers = { accept: "application/vnd.github+json", "user-agent": "hibi-site" };
  if (token) headers.authorization = `Bearer ${token}`;
  const lists = await Promise.all(
    REPOS.map(async (repo) => {
      const response = await fetch(`${API}/${repo}/contributors?per_page=100`, { headers, signal });
      if (!response.ok) throw new Error(`GitHub contributors api answered ${response.status} for ${repo}`);
      return response.json();
    }),
  );
  const people = rankPeople(lists);
  // ponytail: sharp is only here as an optional dependency of another package; without it avatars keep GitHub's bytes
  const sharp = resize ? await import("sharp").then((m) => m.default, () => null) : null;
  const team = new Set(TEAM.map((t) => t.login.toLowerCase()));
  const avatars = {};
  const files = {};
  await Promise.all(
    people.flatMap((person) =>
      Object.entries(SIZES)
        .filter(([kind]) => kind === "avatar" || team.has(person.login.toLowerCase()))
        .map(async ([kind, size]) => {
          const url = avatarUrl(person.avatar, size);
          if (!url) return;
          const response = await fetch(url, { headers: { "user-agent": "hibi-site" }, signal });
          let ext = extension(response.headers.get("content-type")?.split(";")[0]);
          if (!response.ok || !ext) throw new Error(`avatar for ${person.login} answered ${response.status}`);
          let bytes = new Uint8Array(await response.arrayBuffer());
          // GitHub resizes jpegs to s, but serves uploaded pngs whole: resize to 2× as webp when sharp loads
          if (sharp) {
            bytes = await sharp(bytes).resize(size * 2, size * 2, { fit: "cover" }).webp({ quality: 82 }).toBuffer();
            ext = "webp";
          }
          const name = `${person.login.toLowerCase()}${kind === "photo" ? "-photo" : ""}.${ext}`;
          files[name] = bytes;
          (avatars[person.login] ??= {})[kind] = name;
        }),
    ),
  );
  return { people: people.map(({ login, contributions }) => ({ login, contributions })), avatars, files };
}

/** the cached copy in dir (people.json and its avatar files), or null */
export async function readCache(dir) {
  try {
    const [info, text] = await Promise.all([stat(join(dir, "people.json")), readFile(join(dir, "people.json"), "utf8")]);
    const { people, avatars } = JSON.parse(text);
    const files = {};
    for (const name of await readdir(join(dir, "avatars"))) files[name] = await readFile(join(dir, "avatars", name));
    return { age: Date.now() - info.mtimeMs, data: { people, avatars, files } };
  } catch {
    return null;
  }
}

async function writeCache(dir, { people, avatars, files }) {
  await rm(join(dir, "avatars"), { recursive: true, force: true });
  await mkdir(join(dir, "avatars"), { recursive: true });
  await Promise.all(Object.entries(files).map(([name, bytes]) => writeFile(join(dir, "avatars", name), bytes)));
  await writeFile(join(dir, "people.json"), JSON.stringify({ people, avatars }));
}

/** fresh data (saved as the new copy), else the last copy, else the team and sponsor; dev reuses a copy for maxAge */
export async function loadPeople({ dir, fetch, token, resize, reuse = 0, log = console.warn } = {}) {
  const saved = await readCache(dir);
  if (saved && saved.age < reuse) return saved.data;
  try {
    const fresh = await fetchPeople({ fetch, token, resize });
    await writeCache(dir, fresh);
    return fresh;
  } catch (error) {
    log(`hibi-people: ${error.message}; ${saved ? "using the saved list" : "showing the team and sponsor only"}`);
    return saved?.data ?? { ...fallbackPeople(), files: {} };
  }
}

const escape = (text) => String(text).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
// label names the picture (the grid's avatars); the team's photos sit beside their login, so they stay unnamed
const picture = (login, file, size, cls, label = "") =>
  file
    ? `<img class="${cls}" src="/people/${escape(file)}" width="${size}" height="${size}" alt="${escape(label)}" loading="lazy" decoding="async" />`
    : `<span class="${cls} person-letter" style="width: ${size}px; height: ${size}px"${label ? ` role="img" aria-label="${escape(label)}"` : ' aria-hidden="true"'}>${escape(login[0].toLowerCase())}</span>`;

/** the section, as static html */
export function renderPeople({ people, avatars = {} }) {
  const team = TEAM.map(
    (t, i) => `<li class="teammate">
            <span class="team-photo"${i === 0 ? ' data-perch="0.84,0.04"' : ""}><span class="tape tape-${["cream", "periwinkle", "blue", "dots"][i % 4]}" aria-hidden="true"></span>${picture(t.login, avatars[t.login]?.photo, SIZES.photo, "team-img")}</span>
            <a class="team-login" href="https://github.com/${escape(t.login)}">${escape(t.login)}</a>
            <p class="team-role">${escape(t.role)}</p>
            <a class="team-site" href="${escape(t.site)}">${escape(new URL(t.site).hostname)}</a>
          </li>`,
  ).join("\n          ");
  const sponsors = new Set(SPONSORS.map((s) => s.toLowerCase()));
  const everyone = people
    .map(({ login }) => {
      const sponsor = sponsors.has(login.toLowerCase());
      return `<li><a class="contributor" href="https://github.com/${escape(login)}" title="${escape(login)}">${picture(login, avatars[login]?.avatar, SIZES.avatar, "contributor-img", login)}${sponsor ? '<span class="sponsor-heart" role="img" aria-label="sponsor">♥</span>' : ""}</a></li>`;
    })
    .join("\n          ");
  return `<section class="s people wrap" aria-labelledby="people-title">
        <header class="s-head">
          <h2 id="people-title">led by a team who loves to make writing great.</h2>
        </header>
        <ul class="team" aria-label="team">
          ${team}
        </ul>
        <h3 class="people-sub" id="people-everyone">and everyone who helped make hibi possible.</h3>
        <ul class="contributors" aria-labelledby="people-everyone">
          ${everyone}
        </ul>
      </section>`;
}

/** vite: load the list once per build (or dev server), render it at the marker, emit or serve the avatars */
export function peoplePlugin() {
  let dir;
  let dev = false;
  let data;
  const load = () => (data ??= loadPeople({ dir, reuse: dev ? 3600e3 : 0 }));
  return {
    name: "hibi-people",
    configResolved(config) {
      dev = config.command === "serve";
      dir = join(config.root, "node_modules/.cache/hibi-people");
    },
    transformIndexHtml: {
      order: "pre",
      async handler(html) {
        if (!html.includes(MARKER)) return html;
        const people = await load();
        return html.replace(MARKER, () => renderPeople(people));
      },
    },
    async generateBundle() {
      const { files } = await load();
      for (const [name, bytes] of Object.entries(files)) this.emitFile({ type: "asset", fileName: `people/${name}`, source: bytes });
    },
    configureServer(server) {
      server.middlewares.use("/people/", async (request, response, next) => {
        const { files } = await load();
        const name = decodeURIComponent(request.url.slice(1).split("?")[0]);
        const bytes = files[name];
        if (!bytes) return next();
        response.setHeader("content-type", `image/${{ jpg: "jpeg" }[name.split(".").pop()] ?? name.split(".").pop()}`);
        response.setHeader("cache-control", "no-cache");
        response.end(bytes);
      });
    },
  };
}
