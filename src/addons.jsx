import { useRef, useState } from "react";
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
  Sigma,
  Slash,
  Subscript,
  Tags,
  Volume2,
  X,
} from "lucide-react";

// Descriptions and availability follow the bundled addon manifests in hibi.
const addons = [
  {
    id: "github-markdown",
    name: "github markdown",
    icon: FileText,
    enabled: true,
    description:
      "alerts, tables, task lists, strikethrough, and github-style markdown.",
    detail:
      "adds github-style formatting and automatic links to rich text, markdown, and documentation exports. ordinary markdown remains compatible.",
  },
  {
    id: "slash-commands",
    name: "slash commands",
    icon: Slash,
    enabled: true,
    description: "insert markdown blocks by typing / at the start of a line.",
    detail:
      "open the slash menu while writing to find and insert supported blocks without leaving the editor.",
  },
  {
    id: "frontmatter",
    name: "frontmatter",
    icon: Braces,
    enabled: true,
    description:
      "edit yaml properties while preserving metadata and the document body.",
    detail:
      "edit page properties above your document. simple values have inline controls; more complex values open in the yaml editor.",
  },
  {
    id: "documentation",
    name: "documentation",
    icon: BookOpen,
    enabled: true,
    description:
      "publish a markdown workspace as a searchable, self-contained static site.",
    detail:
      "export a folder to one html file with nested navigation, local search, themes, and embedded media. open the file offline or put it on a static host.",
  },
  {
    id: "git",
    name: "git",
    icon: GitBranch,
    enabled: false,
    description:
      "explorer status markers, diffs, staging, commits, branches, pull, and push.",
    detail:
      "open a repository as your workspace to inspect changes and work with git from hibi. modified files and folders receive status markers in the explorer.",
  },
  {
    id: "vim",
    name: "vim",
    icon: Keyboard,
    enabled: false,
    description: "vim editing in markdown and split source panes.",
    detail:
      "use vim motions, operators, visual selections, registers, macros, and search in source panes. normal rich-text editing keeps its existing behavior.",
  },
  {
    id: "math",
    name: "math",
    icon: Sigma,
    enabled: false,
    description: "inline and block latex, rendered locally with katex.",
    detail:
      "write inline or block equations, then click a rendered expression to edit its latex. math and fonts run locally and can be included in documentation exports.",
  },
  {
    id: "typst",
    name: "typst",
    icon: FileCode,
    enabled: false,
    description:
      "typst documents, live previews, pdf export, and rendered markdown blocks.",
    detail:
      "edit .typ files, preview typeset output, and export pdfs. typst also works in fenced markdown blocks.",
  },
  {
    id: "graph",
    name: "graph",
    icon: Network,
    enabled: false,
    description:
      "explore connections between notes in an interactive workspace graph.",
    detail:
      "local markdown links connect notes in a workspace graph. select a node to open its note, filter filenames, and pan or zoom to explore connections.",
  },
  {
    id: "tags",
    name: "tags",
    icon: Tags,
    enabled: false,
    description: "inline #tags and a searchable workspace tag browser.",
    detail:
      "organize notes with inline tags and use the workspace tag browser to find related documents.",
  },
  {
    id: "keybeats",
    name: "keybeats",
    icon: Volume2,
    enabled: false,
    description: "mechanical keyboard sounds while editing your notes.",
    detail:
      "choose from 13 keyboard profiles, set the volume, or mute typing sounds. sounds apply to the editor, and no keystrokes are stored or transmitted.",
  },
  {
    id: "typing-speed",
    name: "typing speed",
    icon: Gauge,
    enabled: false,
    description:
      "estimated words and characters per minute for this typing session.",
    detail: "see estimated typing speed for your current writing session.",
  },
  {
    id: "text-extras",
    name: "text extras",
    icon: Subscript,
    enabled: true,
    description: "subscript and discord-style small text.",
    detail:
      "add subscript with ~text~ or start a line with -# for small text. both work in rich text, source, split view, and documentation exports.",
  },
];

function AddonGrid() {
  const [selected, setSelected] = useState(null);
  const dialog = useRef(null);
  const Icon = selected?.icon;

  return (
    <>
      <ul className="addon-grid" aria-label="built-in addons">
        {addons.map((addon) => {
          const Glyph = addon.icon;
          return (
            <li key={addon.id}>
              <button
                className="addon-card"
                type="button"
                aria-label={`view ${addon.name} details`}
                onClick={() => {
                  setSelected(addon);
                  dialog.current.showModal();
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
                  <span>built in</span>
                  <span>
                    {addon.enabled ? "enabled by default" : "optional"}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      <dialog
        ref={dialog}
        className="addon-modal"
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
            <p className="addon-detail">{selected.detail}</p>
            <div className="addon-availability">
              <span>included with hibi</span>
              <span>
                {selected.enabled
                  ? "enabled by default"
                  : "enable in settings → addons"}
              </span>
            </div>
            <a
              className="button addon-docs"
              href={`https://docs.hibi.garden/#page=${encodeURIComponent(`src/addons/${selected.id}/README.md`)}`}
            >
              read documentation <ArrowUpRight size={16} aria-hidden="true" />
            </a>
          </div>
        )}
      </dialog>
    </>
  );
}

createRoot(document.getElementById("addon-grid")).render(<AddonGrid />);
