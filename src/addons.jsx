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
  X,
} from "lucide-react";
import bundled from "virtual:hibi-addons";
import {
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

const builtins = bundled.map((addon) => ({ ...addon, origin: "built-in" }));
const builtinIds = builtins.map((addon) => addon.id);
const kinds = [
  ["all", "all"],
  ["extension", "extensions"],
  ["theme", "themes"],
];
const glyph = (addon) =>
  icons[addon.id] ?? (addon.kind === "theme" ? Palette : Puzzle);

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

function AddonGrid() {
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState("all");
  const search = useRef(null);
  const [selected, setSelected] = useState(null);
  const [collapsed, setCollapsed] = useState(false);
  const dialog = useRef(null);
  const [directory, retry] = useDirectory();
  const Icon = selected ? glyph(selected) : Puzzle;
  const matching = [...builtins, ...directory.entries].filter((addon) =>
    matchesAddon(addon, query, kind),
  );

  return (
    <>
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
              <button
                className="addon-card"
                type="button"
                aria-label={`view ${addon.name} details`}
                onClick={() => {
                  setSelected(addon);
                  setCollapsed(false);
                  dialog.current.showModal();
                  dialog.current.scrollTop = 0;
                  dialog.current
                    .querySelector(".modal-close")
                    ?.focus({ preventScroll: true });
                }}
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
              </button>
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
      <dialog
        ref={dialog}
        className="addon-modal"
        data-collapsed={collapsed}
        onScroll={(event) => setCollapsed(event.currentTarget.scrollTop > 72)}
        aria-labelledby="addon-title"
        aria-describedby="addon-description"
        onKeyDown={(event) => {
          if (event.key !== "Tab") return;
          const controls =
            event.currentTarget.querySelectorAll("button, a[href]");
          const first = controls[0];
          const last = controls[controls.length - 1];
          if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last.focus();
          } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first.focus();
          }
        }}
        onClick={(event) => {
          if (event.target !== event.currentTarget) return;
          const bounds = event.currentTarget.getBoundingClientRect();
          if (
            event.clientX < bounds.left ||
            event.clientX > bounds.right ||
            event.clientY < bounds.top ||
            event.clientY > bounds.bottom
          )
            event.currentTarget.close();
        }}
      >
        {selected && (
          <div className="addon-modal-content">
            <div className="addon-modal-header">
              <span className="addon-modal-icon">
                <Icon size={25} strokeWidth={1.5} aria-hidden="true" />
              </span>
              <span className="addon-modal-compact-title" aria-hidden="true">
                {selected.name}
              </span>
              <button
                className="modal-close"
                type="button"
                aria-label="close addon details"
                onClick={() => dialog.current.close()}
                autoFocus
              >
                <X size={19} aria-hidden="true" />
              </button>
            </div>
            <h2 id="addon-title">{selected.name}</h2>
            <p id="addon-description">{selected.description}</p>
            <Authors authors={selected.authors} />
            {selected.origin === "built-in" ? (
              <>
                <div className="addon-availability">
                  <span>built in · v{selected.version}</span>
                  <span>
                    {selected.defaultEnabled
                      ? "enabled by default"
                      : "enable in settings → addons"}
                  </span>
                </div>
                <div className="addon-actions">
                  <a className="addon-action" href={openLink(selected.id)}>
                    open in hibi
                  </a>
                </div>
                <p className="addon-install-note">
                  opening addons from this page needs a version of hibi that
                  supports addon links.
                </p>
                <div
                  className="addon-readme"
                  dangerouslySetInnerHTML={{ __html: selected.html }}
                />
              </>
            ) : (
              <>
                <div className="addon-availability">
                  <span>
                    community {selected.kind} · v{selected.version}
                  </span>
                  <span>{selected.license}</span>
                </div>
                <div className="addon-actions">
                  <a className="addon-action" href={installLink(selected.id)}>
                    install in hibi
                  </a>
                  {selected.readmeUrl && (
                    <a
                      href={selected.readmeUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      readme
                    </a>
                  )}
                  <a
                    href={selected.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {selected.source === "download" ? "download" : "source"}
                  </a>
                  {selected.homepage && (
                    <a
                      href={selected.homepage}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      website
                    </a>
                  )}
                </div>
                <p className="addon-install-note">
                  installing from this page needs a version of hibi that
                  supports addon links. hibi checks the package and asks before
                  installing it. community addons are made by their authors, not
                  by hibi.
                </p>
              </>
            )}
          </div>
        )}
      </dialog>
    </>
  );
}

createRoot(document.getElementById("addon-grid")).render(<AddonGrid />);
