import { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { FileText } from "lucide-react";
import { Titlebar } from "../vendor/hibi/src/renderer/src/Titlebar";
import { MarkdownEditor } from "../vendor/hibi/src/renderer/src/Editor";
import { EditorToolbar } from "../vendor/hibi/src/renderer/src/EditorToolbar";
import { onEditorKeyEvent } from "../vendor/hibi/src/renderer/src/editor-events";
import { toolbar } from "../vendor/hibi/src/renderer/src/toolbar";
import { StatusBar } from "../vendor/hibi/src/renderer/src/StatusBar";
import { defaultCursor } from "../vendor/hibi/src/renderer/src/EditorCursor";
import {
  defaultHotkeys,
  shortcutFromEvent,
} from "../vendor/hibi/src/shared/hotkeys";
import { Sidebar } from "../vendor/hibi/src/ui/Sidebar";
import { useSidebarResize } from "../vendor/hibi/src/ui/useSidebarResize";
import {
  DialogProvider,
  useDialogs,
} from "../vendor/hibi/src/ui/DialogProvider";
import { ToastProvider, useToasts } from "../vendor/hibi/src/ui/Sonner";
import { createColorschemeStore } from "../vendor/hibi/src/ui/colorschemes";
import githubMarkdown from "../vendor/hibi/src/addons/github-markdown";
import textExtras from "../vendor/hibi/src/addons/text-extras";
import { setPreferences as setKeybeatsPreferences } from "../vendor/hibi/src/addons/keybeats/preferences";
import "../vendor/hibi/src/addons/github-markdown/alerts.css";
import "../vendor/hibi/src/addons/text-extras/styles.css";
import "../vendor/hibi/src/renderer/src/styles.css";
import "./demo.css";

// The browser never resolves desktop paths or fetches remote document images.
window.hibi = {
  readDocumentMedia: async () => null,
  onWorkspaceChanged: () => () => {},
};

const colors = createColorschemeStore("hibi-demo-colorscheme");
colors.start();
const site = window.frameElement?.ownerDocument.documentElement;
if (site) {
  const followSiteTheme = () => {
    const mode = site.dataset.theme;
    if (mode === "light" || mode === "dark") colors.set({ mode });
  };
  followSiteTheme();
  const observer = new MutationObserver(followSiteTheme);
  observer.observe(site, { attributes: true, attributeFilter: ["data-theme"] });
  if (import.meta.hot) import.meta.hot.dispose(() => observer.disconnect());
}
const platform = /Mac|iPhone|iPad/.test(navigator.platform)
  ? "darwin"
  : "linux";
const hotkeys = defaultHotkeys(platform);
const empty = [];
const flavors = [...githubMarkdown.flavors, ...textExtras.flavors];
const examples = [
  {
    name: "welcome.md",
    markdown:
      "**hibi** is a free, beautiful,  fast, and extensible markdown editor.\n\n> -# hibi is currently in alpha, contributions are greatly appreciated.\n\n---\n\n-# scroll down to learn more or type to get a feel.\n",
  },
];
const initialDocuments = examples.map((example, index) => ({
  ...example,
  id: String(index),
  savedMarkdown: example.markdown,
  dirty: false,
  ephemeral: false,
  revision: index,
}));

function Demo() {
  const [documents, setDocuments] = useState(initialDocuments);
  const [selected, setSelected] = useState("0");
  const current = documents.find((entry) => entry.id === selected);
  const [mode, setMode] = useState("normal");
  const [sidebar, setSidebar] = useState(() => innerWidth >= 650);
  const [find, setFind] = useState(false);
  const [typing, setTyping] = useState(false);
  const typingTimer = useRef(null);
  const counter = useRef(examples.length);
  const resize = useSidebarResize(196);
  const dialogs = useDialogs();
  const toasts = useToasts();

  useEffect(() => {
    let disposed = false;
    let stop;
    const notify = (message) => toasts.show({ message, variant: "error" });
    const scope = toolbar.scope("keybeats", () =>
      notify("could not update keyboard sounds."),
    );
    import("../vendor/hibi/src/addons/keybeats/engine")
      .then(({ startKeybeats }) => {
        if (disposed) return;
        setKeybeatsPreferences({
          profile: "holypanda",
          volume: 0.15,
          muted: false,
        });
        stop = startKeybeats({
          editor: { onKeyEvent: onEditorKeyEvent },
          toolbar: scope.api,
          notify,
        });
      })
      .catch(() => {
        if (!disposed) notify("could not start keyboard sounds.");
      });
    return () => {
      disposed = true;
      stop?.();
      scope.dispose();
    };
  }, [toasts]);

  const showTitlebar = () => {
    clearTimeout(typingTimer.current);
    setTyping(false);
  };
  useEffect(() => () => clearTimeout(typingTimer.current), []);

  function update(changes) {
    setDocuments((entries) =>
      entries.map((entry) =>
        entry.id === selected ? { ...entry, ...changes } : entry,
      ),
    );
  }

  function addDocument(name, markdown) {
    const revision = counter.current++;
    const entry = {
      id: String(revision),
      name,
      markdown,
      savedMarkdown: markdown,
      dirty: false,
      ephemeral: false,
      revision,
    };
    setDocuments((entries) => [...entries, entry]);
    setSelected(entry.id);
  }

  function save() {
    const url = URL.createObjectURL(
      new Blob([current.markdown], { type: "text/markdown;charset=utf-8" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = current.name.replace(/[\\/]/g, "-");
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    update({ dirty: false, savedMarkdown: current.markdown });
  }

  function command(id) {
    if (id === "new") addDocument("untitled.md", "");
    if (id === "save" || id === "saveAs") save();
  }

  useEffect(() => {
    const warn = (event) => {
      if (documents.some((entry) => entry.dirty)) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [documents]);

  const commands = [
    ...["normal", "side-by-side", "markdown"].map((view) => ({
      id: view,
      label: view,
      category: "view",
      shortcut: hotkeys[view],
      run: () => setMode(view),
    })),
    ...["new", "save"].map((id) => ({
      id,
      label: id,
      category: "file",
      shortcut: hotkeys[id],
      run: () => command(id),
    })),
    {
      id: "find",
      label: "find in note",
      category: "edit",
      shortcut: hotkeys.find,
      run: () => setFind(true),
    },
  ];

  return (
    <div
      className="app"
      data-platform="linux"
      data-screen="editor"
      data-sidebar={sidebar}
      data-typing={typing}
      style={{ "--sidebar-width": `${resize.width}px` }}
      onInputCapture={(event) => {
        if (!event.target.closest(".editor-panes")) return;
        clearTimeout(typingTimer.current);
        setTyping(true);
        typingTimer.current = setTimeout(() => setTyping(false), 1200);
      }}
      onPointerMove={(event) => {
        if (event.clientY <= 36) showTitlebar();
      }}
      onFocusCapture={(event) => {
        if (event.target.closest(".titlebar, .editor-toolbar")) showTitlebar();
      }}
      onKeyDownCapture={(event) => {
        if (event.key === "Escape") {
          setFind(false);
        }
        if (dialogs.isOpen()) return;
        const shortcut = shortcutFromEvent(event);
        if (
          [hotkeys.palette, hotkeys.settings, hotkeys.open].includes(shortcut)
        ) {
          event.preventDefault();
          event.stopPropagation();
          return;
        }
        const action = commands.find(
          (entry) => entry.shortcut && entry.shortcut === shortcut,
        );
        if (action) {
          event.preventDefault();
          showTitlebar();
          action.run();
        }
      }}
    >
      <Titlebar
        document={current}
        settingsOpen={false}
        onSettings={() => {}}
        onPalette={() => {}}
        mode={mode}
        onMode={setMode}
        onCommand={command}
        disabled={false}
        busy={false}
        hotkeys={hotkeys}
        platform={platform}
        sidebarOpen={sidebar}
        onSidebar={() => setSidebar(!sidebar)}
        onRename={async (name) => {
          if (name.trim()) update({ name: name.trim() });
        }}
      />
      <Sidebar
        className="workspace-sidebar"
        label="demo files"
        open={sidebar}
        selected={selected}
        resize={resize}
        items={documents.map((entry) => ({
          id: entry.id,
          label: entry.name,
          icon: FileText,
          dirty: entry.dirty,
        }))}
        onSelect={(id) => {
          setSelected(id);
          if (innerWidth < 650) setSidebar(false);
        }}
      />
      <div className="editor-surface">
        <EditorToolbar mode={mode} typing={typing} />
        <div className="editor-page">
          <MarkdownEditor
            key={current.id}
            document={current}
            format={undefined}
            formatName="markdown"
            value={current.markdown}
            onChange={(markdown) =>
              update({ markdown, dirty: markdown !== current.savedMarkdown })
            }
            mode={mode}
            disabled={false}
            findOpen={find}
            onCloseFind={() => setFind(false)}
            markdownExtensions={empty}
            sourceExtensions={empty}
            richExtensions={empty}
            cursorSettings={defaultCursor}
            showLineNumbers={false}
            documentRevision={current.revision}
            flavors={flavors}
            unsupportedFlavor={false}
            onAttach={async () => {
              await dialogs.alert({
                title: "desktop feature",
                description:
                  "image attachments are available in the desktop app.",
              });
              return null;
            }}
            onLink={(href) => {
              if (/^https?:\/\//i.test(href))
                window.open(href, "_blank", "noopener,noreferrer");
            }}
          />
          <StatusBar
            items={[{ id: "format", label: "markdown", tooltip: "markdown" }]}
          />
        </div>
      </div>
    </div>
  );
}

createRoot(document.getElementById("root")).render(
  <ToastProvider>
    <DialogProvider>
      <Demo />
    </DialogProvider>
  </ToastProvider>,
);
