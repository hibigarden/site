import { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  ArrowUpRight,
  BookOpen,
  Braces,
  FileCode,
  FileText,
  Gauge,
  GitBranch,
  Keyboard,
  Network,
  Palette,
  Puzzle,
  Sigma,
  Slash,
  Subscript,
  Tags,
  Volume2,
} from "lucide-react";
import bundled from "virtual:hibi-addons";
import {
  addonIdFromPath,
  addonPageLink,
  fetchDirectory,
  installLink,
  matchesAddon,
  openLink,
} from "./addon-directory.js";
import { Button } from "../vendor/hibi/src/ui/Controls";
import "../vendor/hibi/src/ui/controls.css";

const icons = {
  "github-markdown": FileText,
  "slash-commands": Slash,
  frontmatter: Braces,
  documentation: BookOpen,
  git: GitBranch,
  vim: Keyboard,
  math: Sigma,
  typst: FileCode,
  graph: Network,
  tags: Tags,
  keybeats: Volume2,
  "typing-speed": Gauge,
  "text-extras": Subscript,
};

const repository = "https://github.com/schmayterling/hibi";
const builtins = bundled.map((addon) => ({
  ...addon,
  origin: "built-in",
  repositoryUrl: repository,
  sourceUrl: `${repository}/tree/main/src/addons/${addon.id}`,
}));
const builtinIds = builtins.map((addon) => addon.id);
const kinds = [
  ["all", "all"],
  ["extension", "extensions"],
  ["theme", "themes"],
];
const glyph = (addon) =>
  icons[addon.id] ?? (addon.kind === "theme" ? Palette : Puzzle);
const requestedId = addonIdFromPath(window.location.pathname);
const detailPage = !/^\/addons(?:\/|\/index\.html)?$/.test(
  window.location.pathname,
);

function useDirectory() {
  const [state, setState] = useState({ status: "loading", entries: [] });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setState((previous) => ({ ...previous, status: "loading" }));
    fetchDirectory(builtinIds, { signal: controller.signal }).then(
      ({ entries }) => setState({ status: "ready", entries }),
      () => {
        if (!controller.signal.aborted)
          setState((previous) => ({ ...previous, status: "error" }));
      },
    );
    return () => controller.abort();
  }, [attempt]);
  return [state, () => setAttempt((count) => count + 1)];
}

function Authors({ authors }) {
  return (
    <ul className="addon-authors" aria-label="authors">
      {authors.map((author, index) => {
        const href = author.github
          ? `https://github.com/${encodeURIComponent(author.github)}`
          : author.discordId
            ? `https://discord.com/users/${encodeURIComponent(author.discordId)}`
            : null;
        return (
          <li key={index}>
            {href ? (
              <a href={href} target="_blank" rel="noopener noreferrer">
                {author.displayName}
              </a>
            ) : (
              <span>{author.displayName}</span>
            )}
            {author.role && <small>{author.role}</small>}
          </li>
        );
      })}
    </ul>
  );
}

function AddonDetails({ addon }) {
  const Icon = glyph(addon);
  const builtin = addon.origin === "built-in";
  return (
    <article className="addon-detail" aria-labelledby="addon-title">
      <a className="addon-guide-link" href="/addons/">
        ← all addons
      </a>
      <header className="page-intro">
        <Icon size={28} strokeWidth={1.5} aria-hidden="true" />
        <h1 id="addon-title">{addon.name}</h1>
        <p>{addon.description}</p>
        <Authors authors={addon.authors} />
        {addon.repositoryUrl && (
          <a
            className="addon-repository"
            href={addon.repositoryUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`github repository: ${new URL(addon.repositoryUrl).pathname.slice(1)}`}
          >
            <GitBranch size={17} aria-hidden="true" />
            <span>{new URL(addon.repositoryUrl).pathname.slice(1)}</span>
            <ArrowUpRight size={14} aria-hidden="true" />
          </a>
        )}
      </header>
      <div className="addon-availability">
        <span>
          {builtin ? "built in" : `community ${addon.kind}`} · v{addon.version}
        </span>
        <span>
          {builtin
            ? addon.defaultEnabled
              ? "enabled by default"
              : "enable in settings → addons"
            : addon.license}
        </span>
      </div>
      <div className="addon-actions">
        <a
          className="addon-action"
          href={builtin ? openLink(addon.id) : installLink(addon.id)}
        >
          {builtin ? "open in hibi" : "install in hibi"}
        </a>
        {addon.readmeUrl && (
          <a href={addon.readmeUrl} target="_blank" rel="noopener noreferrer">
            readme
          </a>
        )}
        <a href={addon.sourceUrl} target="_blank" rel="noopener noreferrer">
          {addon.source === "download" ? "download" : "source"}
        </a>
        {addon.homepage &&
          addon.homepage.replace(/\/$/, "") !== addon.repositoryUrl && (
            <a href={addon.homepage} target="_blank" rel="noopener noreferrer">
              website
            </a>
          )}
      </div>
      <p className="addon-install-note">
        {builtin
          ? "opening addons from this page needs a version of hibi that supports addon links."
          : "installing from this page needs a version of hibi that supports addon links. hibi checks the package and asks before installing it. community addons are made by their authors, not by hibi."}
      </p>
      {builtin && (
        <div
          className="addon-readme"
          dangerouslySetInnerHTML={{ __html: addon.html }}
        />
      )}
    </article>
  );
}

function AddonGrid() {
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState("all");
  const search = useRef(null);
  const [directory, retry] = useDirectory();
  const addons = [...builtins, ...directory.entries];
  const selected = addons.find((addon) => addon.id === requestedId);
  const matching = addons.filter((addon) => matchesAddon(addon, query, kind));

  useEffect(() => {
    if (!detailPage) return;
    document.title = selected
      ? `${selected.name} | hibi addons`
      : directory.status === "loading"
        ? "loading addon | hibi"
        : "addon unavailable | hibi";
    if (selected)
      document.querySelector('meta[name="description"]').content =
        selected.description;
  }, [selected, directory.status]);

  if (detailPage) {
    if (selected) return <AddonDetails addon={selected} />;
    const loading = directory.status === "loading";
    const failed = directory.status === "error";
    return (
      <section className="addon-detail" aria-busy={loading}>
        <a className="addon-guide-link" href="/addons/">
          ← all addons
        </a>
        <div className="page-intro">
          <h1>
            {loading
              ? "loading addon…"
              : failed
                ? "couldn't load this addon"
                : "addon not found"}
          </h1>
          <p role="status">
            {loading
              ? "checking hibi garden for this addon."
              : failed
                ? "hibi garden couldn't load. try again to see this addon."
                : "this address does not match a listed addon. browse all addons to find one."}
          </p>
        </div>
        {failed && <Button onClick={retry}>try again</Button>}
      </section>
    );
  }

  return (
    <>
      <div className="page-intro">
        <h1>make hibi yours.</h1>
        <a
          className="addon-guide-link"
          href="https://docs.hibi.garden/#page=development%2Faddons%2FREADME.md"
        >
          learn how to build an addon
        </a>
      </div>
      <div className="addon-search">
        <p className="addon-result-count" role="status">
          {matching.length} {matching.length === 1 ? "addon" : "addons"}
        </p>
        <div className="settings-filter-bar">
          <input
            ref={search}
            className="ui-field ui-input"
            type="search"
            aria-label="filter addons"
            placeholder="filter addons…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <Button
            disabled={!query && kind === "all"}
            onClick={() => {
              setQuery("");
              setKind("all");
              search.current.focus();
            }}
          >
            reset all
          </Button>
        </div>
        <div className="addon-kinds" role="group" aria-label="addon type">
          {kinds.map(([value, label]) => (
            <Button
              key={value}
              data-variant="ghost"
              aria-pressed={kind === value}
              onClick={() => setKind(value)}
            >
              {label}
            </Button>
          ))}
        </div>
      </div>
      <ul className="addon-grid" aria-label="addons">
        {matching.map((addon) => {
          const Glyph = glyph(addon);
          return (
            <li key={addon.id}>
              <a
                className="addon-card"
                href={addonPageLink(addon.id)}
                aria-label={`view ${addon.name} details`}
              >
                <span className="addon-card-heading">
                  <Glyph size={21} strokeWidth={1.5} aria-hidden="true" />
                  <span>{addon.name}</span>
                  <ArrowUpRight
                    className="addon-card-arrow"
                    size={16}
                    aria-hidden="true"
                  />
                </span>
                <span className="addon-description">{addon.description}</span>
                <span className="addon-card-footer">
                  <span>
                    {addon.authors
                      .map((author) => author.displayName)
                      .join(", ")}
                  </span>
                  <span>
                    {addon.origin === "built-in" ? "built in" : "community"} · v
                    {addon.version}
                  </span>
                </span>
              </a>
            </li>
          );
        })}
      </ul>
      {!matching.length && directory.status !== "loading" && (
        <p className="addon-empty">no addons match your search.</p>
      )}
      <div className="addon-directory-status" aria-live="polite">
        {directory.status === "loading" && <p>loading community addons…</p>}
        {directory.status === "error" && (
          <>
            <p>
              community addons couldn't load. built-in addons are still listed.
            </p>
            <Button onClick={retry}>try again</Button>
          </>
        )}
        {directory.status === "ready" && !directory.entries.length && (
          <p>no community addons yet.</p>
        )}
      </div>
    </>
  );
}

createRoot(document.getElementById("addon-grid")).render(<AddonGrid />);
