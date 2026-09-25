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
  Puzzle,
  Sigma,
  Slash,
  Subscript,
  Tags,
  Volume2,
  X,
} from "lucide-react";
import addons from "virtual:hibi-addons";
import { Button } from "../vendor/hibi/src/ui/Controls";
import "../vendor/hibi/src/ui/controls.css";

const gardenCatalog =
  "https://raw.githubusercontent.com/hibigarden/addons-repository/main/catalog.json";

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
  const [garden, setGarden] = useState([]);
  const [gardenError, setGardenError] = useState(false);
  const search = useRef(null);
  const [selected, setSelected] = useState(null);
  const [collapsed, setCollapsed] = useState(false);
  const dialog = useRef(null);
  const Icon = icons[selected?.id] ?? Puzzle;
  useEffect(() => {
    let active = true;
    fetch(gardenCatalog)
      .then((response) => {
        if (!response.ok) throw new Error("catalog unavailable");
        return response.json();
      })
      .then((entries) => {
        if (!Array.isArray(entries)) throw new Error("invalid catalog");
        if (active)
          setGarden(
            entries.filter(
              (entry) =>
                entry &&
                /^[a-z][a-z0-9-]*$/.test(entry.id) &&
                entry.path === `addons/${entry.id}` &&
                [entry.name, entry.description, entry.version].every(
                  (value) => typeof value === "string" && value.trim(),
                ) &&
                ["extension", "theme"].includes(entry.kind) &&
                Number.isInteger(entry.apiVersion) &&
                Array.isArray(entry.authors) &&
                entry.authors.every(
                  (author) =>
                    author && typeof author.displayName === "string",
                ) &&
                !addons.some((addon) => addon.id === entry.id),
            ),
          );
      })
      .catch(() => {
        if (active) setGardenError(true);
      });
    return () => {
      active = false;
    };
  }, []);
  const matching = [
    ...addons,
    ...garden.map((addon) => ({ ...addon, garden: true })),
  ]
    .filter((addon) =>
      [
        addon.id,
        addon.name,
        addon.description,
        addon.kind,
        addon.version,
        addon.garden ? "garden" : "built in",
        ...addon.authors.map((author) => author.displayName),
      ]
        .join(" ")
        .toLowerCase()
        .includes(query.trim().toLowerCase()),
    )
    .sort((a, b) => a.name.localeCompare(b.name));

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
            disabled={!query}
            onClick={() => {
              setQuery("");
              search.current.focus();
            }}
          >
            reset all
          </Button>
        </div>
      </div>
      {gardenError && (
        <p className="addon-empty">garden addons are unavailable right now.</p>
      )}
      <ul className="addon-grid" aria-label="addons">
        {matching.map((addon) => {
          const Glyph = icons[addon.id] ?? Puzzle;
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
                  <span>v{addon.version}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      {!matching.length && (
        <p className="addon-empty">no addons match your search.</p>
      )}
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
            <div className="addon-availability">
              <span>v{selected.version}</span>
              <span>
                {selected.garden
                  ? "find in hibi → settings → addons"
                  : selected.defaultEnabled
                    ? "enabled by default"
                    : "enable in settings → addons"}
              </span>
            </div>
            {selected.garden ? (
              <p className="addon-readme">
                <a
                  href={`https://github.com/hibigarden/addons-repository/tree/main/${selected.path}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  view source and readme ↗
                </a>
              </p>
            ) : (
              <div
                className="addon-readme"
                dangerouslySetInnerHTML={{ __html: selected.html }}
              />
            )}
          </div>
        )}
      </dialog>
    </>
  );
}

createRoot(document.getElementById("addon-grid")).render(<AddonGrid />);
