import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { REPOS, SPONSORS, TEAM, fetchPeople, loadPeople, rankPeople, renderPeople } from "../server/people.js";

const person = (login, contributions, type = "User") => ({
  login,
  type,
  contributions,
  avatar_url: `https://avatars.githubusercontent.com/u/${login.length}?v=4`,
});
const lists = {
  "schmayterling/hibi": [person("schmayterling", 1841), person("maykisser", 5), person("LizAinslie", 5), person("dependabot[bot]", 2, "Bot"), person("nerdsflash", 1), person("ralphbibera", 1)],
  "hibigarden/docs": [person("github-actions[bot]", 119, "Bot"), person("schmayterling", 11), person("lizainslie", 1)],
};

function fakeGitHub({ fail = false } = {}) {
  const calls = [];
  const fetch = async (url, { headers = {} } = {}) => {
    calls.push({ url, headers });
    if (fail) throw new Error("offline");
    if (url.startsWith("https://api.github.com/repos/")) {
      const repo = url.slice("https://api.github.com/repos/".length).split("/contributors")[0];
      return Response.json(lists[repo] ?? []);
    }
    if (url.startsWith("https://avatars.githubusercontent.com/"))
      return new Response(new Uint8Array([137, 80, 78, 71]), { headers: { "content-type": "image/png" } });
    return new Response(null, { status: 404 });
  };
  return { fetch, calls };
}

test("merges every repository's list: bots dropped, the same person summed once, sponsors first", () => {
  const people = rankPeople(Object.values(lists));
  assert.deepEqual(
    people.map(({ login, contributions }) => `${login} ${contributions}`),
    ["nerdsflash 1", "schmayterling 1852", "LizAinslie 6", "maykisser 5", "ralphbibera 1"],
  );
  assert.ok(!people.some((p) => p.login.includes("[bot]")));
  assert.equal(SPONSORS[0], people[0].login);
});

test("sends the token only to GitHub's api, and fetches each avatar at twice its size", async () => {
  const github = fakeGitHub();
  const { people, avatars, files } = await fetchPeople({ fetch: github.fetch, token: "secret-token", resize: false });
  assert.equal(github.calls.filter((c) => c.url.startsWith("https://api.github.com/")).length, REPOS.length);
  for (const call of github.calls) {
    const api = call.url.startsWith("https://api.github.com/");
    assert.equal(call.headers.authorization, api ? "Bearer secret-token" : undefined, call.url);
  }
  assert.ok(github.calls.some((c) => c.url.endsWith("?v=4&s=96")), "grid avatars at 2 × 48");
  assert.ok(github.calls.some((c) => c.url.endsWith("?v=4&s=176")), "team photos at 2 × 88");
  assert.equal(people.length, 5);
  assert.equal(avatars.schmayterling.photo, "schmayterling-photo.png");
  assert.ok(files["nerdsflash.png"]);
});

test("offline: the last copy when there is one, the team and sponsor when there isn't", async () => {
  const dir = await mkdtemp(join(tmpdir(), "hibi-people-"));
  try {
    const quiet = () => {};
    const empty = await loadPeople({ dir, fetch: fakeGitHub({ fail: true }).fetch, log: quiet });
    assert.deepEqual(empty.people.map((p) => p.login), [...SPONSORS, ...TEAM.map((t) => t.login)]);
    const html = renderPeople(empty);
    for (const t of TEAM) assert.match(html, new RegExp(`href="https://github.com/${t.login}">${t.login}</a>`));
    assert.match(html, /<span class="sponsor-heart" role="img" aria-label="sponsor">/);
    assert.match(html, /role="img" aria-label="nerdsflash">n</, "a placeholder keeps the login as its name");
    assert.doesNotMatch(html, /<img/, "lettered placeholders, no photos");
    assert.match(html, /class="team-img person-letter" style="width: 88px; height: 88px" aria-hidden="true">s</);

    const fresh = await loadPeople({ dir, fetch: fakeGitHub().fetch, resize: false, log: quiet });
    const offline = await loadPeople({ dir, fetch: fakeGitHub({ fail: true }).fetch, log: quiet });
    assert.deepEqual(offline.people, fresh.people);
    assert.deepEqual(offline.avatars, fresh.avatars);
    assert.deepEqual(Object.keys(offline.files).sort(), Object.keys(fresh.files).sort());
    assert.match(renderPeople(offline), /src="\/people\/nerdsflash\.png" width="48" height="48" alt="nerdsflash"/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
