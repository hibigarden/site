import "./demo-host.js";
import {
  Suspense,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { createRoot } from "react-dom/client";
import { FileText } from "lucide-react";
import { ActiveDocumentEditor } from "../vendor/hibi/src/renderer/src/ActiveDocumentEditor";
// The formatted view hibi ships today. To show the CodeMirror one instead, import MarkdownEditor from
// FormattedEditor, run scripts/vendor-hibi.mjs and set localStorage hibi:formatted-engine to codemirror.
import { MarkdownEditor } from "../vendor/hibi/src/renderer/src/Editor";
import { EditorToolbar } from "../vendor/hibi/src/renderer/src/EditorToolbar";
import { StatusBar } from "../vendor/hibi/src/renderer/src/StatusBar";
import { Titlebar } from "../vendor/hibi/src/renderer/src/Titlebar";
import { useAddons, useEditorAddons } from "../vendor/hibi/src/renderer/src/addons";
import { colorschemes } from "../vendor/hibi/src/renderer/src/colorschemes";
import { documentFormats, editorDocument } from "../vendor/hibi/src/renderer/src/document-formats";
import { documentRuntime } from "../vendor/hibi/src/renderer/src/document-runtime";
import { hasDocumentFootnotes, subscribeDocumentShell } from "../vendor/hibi/src/renderer/src/document-shell";
import { editorPreferences, useEditorPreference } from "../vendor/hibi/src/renderer/src/editor-preferences";
import { flavors, loadFlavor, selectedFlavors } from "../vendor/hibi/src/renderer/src/flavors";
import { LoadingScreen } from "../vendor/hibi/src/renderer/src/LoadingScreen";
import { transformMarkdown } from "../vendor/hibi/src/renderer/src/markdown-projection";
import { defaultHotkeys, shortcutFromEvent } from "../vendor/hibi/src/shared/hotkeys";
import { wikiTarget } from "../vendor/hibi/src/shared/note-links";
import { DialogProvider, useDialogs } from "../vendor/hibi/src/ui/DialogProvider";
import { MenuHost } from "../vendor/hibi/src/ui/MenuHost";
import { Sidebar } from "../vendor/hibi/src/ui/Sidebar";
import { ToastProvider } from "../vendor/hibi/src/ui/Sonner";
import { useSidebarResize } from "../vendor/hibi/src/ui/useSidebarResize";
import notes from "./demo-notes.js";
import "../vendor/hibi/src/renderer/src/styles.css";
import "./demo.css";

// Inside the landing page the editor follows the site's theme switch; on its own, the saved site theme.
const site = window.frameElement?.ownerDocument.documentElement;
if (window.parent !== window) document.documentElement.dataset.embedded = "";
const followSiteTheme = () => {
  let mode = site?.dataset.theme;
  if (!site) {
    try {
      mode = localStorage.getItem("hibi-site-theme");
    } catch {
      // Follow the system without storage.
    }
  }
  colorschemes.set({ mode: mode === "light" || mode === "dark" ? mode : "system" });
};
followSiteTheme();
if (site) {
  const observer = new site.ownerDocument.defaultView.MutationObserver(followSiteTheme);
  observer.observe(site, { attributes: true, attributeFilter: ["data-theme"] });
  if (import.meta.hot) import.meta.hot.dispose(() => observer.disconnect());
}
const platform = /Mac|iPhone|iPad/.test(navigator.platform) ? "darwin" : "linux";
const hotkeys = defaultHotkeys(platform);
const views = ["normal", "side-by-side", "markdown"];
const unavailable = () => Promise.reject(new Error("This is available in the desktop app."));
const noteState = (name, markdown, index) => ({
  tabId: `note-${index}`,
  tabs: [],
  tabsEnabled: false,
  id: `demo:${name}`,
  ephemeral: false,
  markdown,
  savedMarkdown: markdown,
  name,
  dirty: false,
  revision: 1,
  contentVersion: 0,
  canAutosave: false,
});
const initialNotes = notes.map(({ name, markdown }, index) => noteState(name, markdown, index));
// Notes as they open; the runtime holds each one's edits from its first opening.
const opening = new Map(initialNotes.map((note) => [note.tabId, note]));
const noteFor = (tabId) => documentRuntime.get(tabId) ?? opening.get(tabId);
// Every note stays open as a tab of the window: the runtime closes the tabs a document doesn't list.
const activate = (tabId, ids) =>
  documentRuntime.activate({
    ...noteFor(tabId),
    tabs: ids.map((id) => ({ id, name: noteFor(id).name, dirty: noteFor(id).dirty })),
  });
activate(initialNotes[0].tabId, [...opening.keys()]);

function Demo() {
  const [noteIds, setNoteIds] = useState(() => initialNotes.map((note) => note.tabId));
  const [selected, setSelected] = useState(initialNotes[0].tabId);
  const [current, setCurrent] = useState(() => documentRuntime.get(selected));
  const shell = useRef(current);
  const [mode, setMode] = useState("normal");
  const [sidebar, setSidebar] = useState(() => innerWidth >= 650);
  const [find, setFind] = useState(false);
  // In the landing page the editor waits for a visitor before it takes focus.
  const [focusEditor, setFocusEditor] = useState(window.parent === window);
  const [reset, setReset] = useState(0);
  const resize = useSidebarResize(196);
  const dialogs = useDialogs();

  // Edits reach the editor document without rerendering this shell, as in the app.
  useLayoutEffect(() => {
    const active = activate(selected, noteIds);
    shell.current = active;
    setCurrent(active);
    editorDocument.publish(active);
    return subscribeDocumentShell(documentRuntime, shell, setCurrent, (next, changes) =>
      editorDocument.publish(next, changes),
    );
  }, [selected, noteIds]);

  // As in the app, notes with footnotes open in source or side by side.
  const footnotes = hasDocumentFootnotes(documentRuntime, documentRuntime.get(current.tabId) ?? current);
  const noteViews = footnotes ? views.filter((view) => view !== "normal") : views;
  const view = noteViews.includes(mode) ? mode : "side-by-side";
  const host = useAddons(
    {
      openDependencySettings: () => {},
      openAddonSettings: () => {},
      workspace: {
        index: unavailable,
        snapshot: unavailable,
        get: async () => null,
        open: async () => null,
        openFile: async () => {},
      },
      invoke: unavailable,
      error: (error) => console.error(error),
      isBusy: () => false,
      updateMarkdown(transform, options) {
        const markdown = transformMarkdown(
          documentRuntime.get(selected)?.markdown ?? "",
          host.markdownExtensions,
          transform,
          options,
        );
        if (markdown === null) return;
        documentRuntime.replace(markdown, "visual", undefined, selected);
        setReset((value) => value + 1);
      },
      runCommand: async () => false,
      runAction: (id) => run(id),
      getEditorDocument: () => documentRuntime.get(selected),
      openSidebar: () => {},
      closeSidebar: () => {},
      openTab: () => {},
      focusDocument: async () => true,
    },
    current.name,
    view,
  );
  useSyncExternalStore(documentFormats.subscribe, documentFormats.snapshot);
  const available = useSyncExternalStore(flavors.subscribe, flavors.snapshot);
  const [choice] = useState(() => loadFlavor());
  const chosen = useMemo(() => selectedFlavors(choice, available), [choice, available]);
  const { knownFlavors, manifests, enabledAddons } = useEditorAddons(host, available);
  const [cursor] = useEditorPreference(editorPreferences.cursor);
  const [lineNumbers] = useEditorPreference(editorPreferences.lineNumbers);
  const [spellCheck] = useEditorPreference(editorPreferences.spellCheck);
  const [markers] = useEditorPreference(editorPreferences.markers);
  const [flavorLabel, setFlavorLabel] = useState("markdown");

  function addNote() {
    const index = opening.size;
    const count = index - initialNotes.length;
    const note = noteState(count ? `untitled ${count + 1}.md` : "untitled.md", "", index);
    opening.set(note.tabId, note);
    setNoteIds((ids) => [...ids, note.tabId]);
    setSelected(note.tabId);
  }

  // Saving downloads the note, which then counts as saved.
  function save() {
    const note = documentRuntime.get(selected);
    const token = documentRuntime.beginSave(selected);
    const url = URL.createObjectURL(new Blob([note.markdown], { type: "text/markdown;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = note.name.replace(/[\\/]/g, "-");
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    documentRuntime.acknowledgeSave({ ...note, saveReceipt: true, savedVersion: note.contentVersion }, token);
  }

  useEffect(() => {
    const warn = (event) => {
      if (!noteIds.some((id) => noteFor(id).dirty)) return;
      event.preventDefault();
      event.returnValue = "";
    };
    addEventListener("beforeunload", warn);
    return () => removeEventListener("beforeunload", warn);
  }, [noteIds]);

  function run(id) {
    if (views.includes(id)) setMode(id);
    else if (id === "new") addNote();
    else if (id === "save" || id === "saveAs") save();
    else if (id === "find") setFind(true);
  }

  return (
    <div
      className="app"
      data-platform="linux"
      data-screen="editor"
      data-sidebar={sidebar}
      data-sidebar-overlay={resize.overlay}
      style={{ "--sidebar-width": `${resize.width}px` }}
      onKeyDownCapture={(event) => {
        if (event.key === "Escape") setFind(false);
        if (dialogs.isOpen()) return;
        const shortcut = shortcutFromEvent(event);
        if ([hotkeys.palette, hotkeys.settings, hotkeys.open].includes(shortcut)) {
          event.preventDefault();
          event.stopPropagation();
          return;
        }
        const action = [...views, "new", "save", "find"].find((id) => hotkeys[id] === shortcut);
        if (!action) return;
        event.preventDefault();
        run(action);
      }}
    >
      <Titlebar
        document={current}
        settingsOpen={false}
        mode={view}
        availableViews={noteViews}
        onMode={setMode}
        hotkeys={hotkeys}
        platform={platform}
        sidebarOpen={sidebar}
        onSidebar={() => setSidebar(!sidebar)}
        onSettings={() => {}}
        onBack={() => {}}
        sidebarOverlay={resize.overlay}
        sidebarView="workspace"
        sidebarViews={[]}
        onSidebarView={() => {}}
        rightSidebarOpen={false}
        rightSidebarView="none"
        onRightSidebar={() => {}}
        onRightSidebarView={() => {}}
        onSelectTab={() => {}}
        onCloseTab={() => {}}
        onCloseTabs={() => {}}
        onMoveTab={() => {}}
        addonTabs={[]}
        activeAddonTab={null}
        onSelectAddonTab={() => {}}
        onCloseAddonTab={() => {}}
        splitTabs={null}
        busy={false}
      />
      <Sidebar
        className="document-sidebar workspace-sidebar"
        label="Garden notes"
        open={sidebar}
        overlay={resize.overlay}
        onDismiss={() => setSidebar(false)}
        resize={resize}
        selected={selected}
        items={noteIds.map((id) => ({ id, label: noteFor(id).name, icon: FileText }))}
        status={new Map(noteIds.map((id) => [id, { dirty: noteFor(id).dirty }]))}
        onSelect={(id) => {
          setFocusEditor(true);
          setSelected(id);
          if (resize.overlay) setSidebar(false);
        }}
      />
      <div className="editor-surface" inert={resize.overlay && sidebar}>
        <EditorToolbar mode={view} />
        <div className="editor-page" role="region" aria-label={current.name}>
          {!host.ready ? (
            <LoadingScreen />
          ) : (
            <Suspense fallback={<LoadingScreen />}>
              <ActiveDocumentEditor
                key={`${current.tabId}-${reset}`}
                Component={MarkdownEditor}
                autoFocus={focusEditor}
                markdown
                knownFlavors={knownFlavors}
                chosenFlavors={chosen}
                flavorChoice={choice}
                manifests={manifests}
                enabledAddons={enabledAddons}
                onFlavorStatus={(status) => setFlavorLabel(status.label)}
                onOutline={() => {}}
                outlineActive={false}
                onActiveOutline={() => {}}
                outlineTarget={null}
                document={current}
                format={documentFormats.get(current.name)}
                formatName="Markdown"
                onAttach={async () => {
                  await dialogs.alert({
                    title: "Desktop feature",
                    description: "Image attachments are available in the desktop app.",
                  });
                  return null;
                }}
                onLink={(href) => {
                  if (/^https?:\/\//i.test(href)) window.open(href, "_blank", "noopener,noreferrer");
                  if (!href.startsWith("obsidian-wiki:")) return;
                  // Wiki links open the note they name, as in a workspace.
                  const names = new Map(noteIds.map((id) => [noteFor(id).name, id]));
                  const name = wikiTarget(current.name, decodeURIComponent(href.slice(14)), new Set(names.keys()));
                  if (!names.has(name)) return;
                  setFocusEditor(true);
                  setSelected(names.get(name));
                }}
                flavors={chosen}
                footnoteDocument={footnotes}
                sourceExtensions={host.sourceExtensions}
                formattedExtensions={host.formattedExtensions}
                richExtensions={host.richExtensions}
                documentRevision={current.revision}
                showLineNumbers={lineNumbers}
                spellCheck={spellCheck}
                showMarkdownMarkers={markers}
                cursorSettings={cursor}
                markdownExtensions={host.markdownExtensions}
                onChange={(value, group) => documentRuntime.replace(value, "visual", group, current.tabId)}
                mode={view}
                disabled={false}
                findOpen={find}
                onCloseFind={() => setFind(false)}
              />
            </Suspense>
          )}
          <StatusBar
            items={[
              { id: "flavor", label: flavorLabel, tooltip: "Detected Markdown flavor" },
              ...host.statusItems.filter(
                (item) =>
                  item.label &&
                  (item.when !== "source" || view !== "normal") &&
                  (item.when !== "normal" || view === "normal"),
              ),
            ]}
          />
        </div>
      </div>
      <MenuHost />
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
