import { createRoot } from "react-dom/client";
import {
  Bold,
  CaseSensitive,
  ChevronDown,
  ChevronRight,
  Download,
  FileDown,
  FileText,
  Folder,
  FolderOpen,
  GitBranch,
  Hash,
  Heading1,
  Italic,
  Keyboard,
  List,
  MessageCircle,
  PanelLeft,
  Search,
  Sigma,
  Star,
  TriangleAlert,
  Undo2,
} from "lucide-react";

// hibi's real ui, printed and cut out: a white cut edge, a warm wash, a shadow, sometimes a strip of tape.
function Print({ className, tape, children }) {
  return (
    <div className={`print ${className}`}>
      <span className="print-shadow" />
      {children}
      {tape && <span className={`tape ${tape}`} />}
    </div>
  );
}

function EditorPreview({ label = "welcome.md" }) {
  return (
    <div className="editor-preview">
      <div className="preview-titlebar">
        <PanelLeft />
        <span>{label}</span>
      </div>
      <div className="preview-body">
        <div className="preview-sidebar">
          <span className="preview-workspace-label">workspace</span>
          <div className="preview-file-row">
            <ChevronDown /><FolderOpen /><span>notes</span>
          </div>
          <div className="preview-file-row preview-file-selected">
            <FileText /><span>welcome.md</span>
          </div>
          <div className="preview-file-row preview-file-nested">
            <FileText /><span>ideas.md</span>
          </div>
          <div className="preview-file-row">
            <ChevronRight /><Folder /><span>drafts</span>
          </div>
        </div>
        <div className="preview-editor">
          <div className="preview-toolbar">
            <Undo2 /><Bold /><Italic /><Heading1 /><List />
          </div>
          <div className="preview-document">
            <strong>hibi</strong>
            <span>a free markdown editor.</span>
            <hr />
            <small>a place for your words.</small>
          </div>
        </div>
      </div>
    </div>
  );
}

function WorkspaceIllustration() {
  return (
    <Print className="workspace-print" tape="tape-blue">
      <EditorPreview />
    </Print>
  );
}

function FormatPage({ extension, icon: Icon, className, tape }) {
  return (
    <Print className={`format-page ${className}`} tape={tape}>
      <div className="format-page-inner">
        <span className="format-extension">{extension}</span>
        <Icon className="format-symbol" />
        <div className="format-lines"><i /><i /><i /></div>
      </div>
    </Print>
  );
}

function FormatsIllustration() {
  return (
    <div className="format-stack">
      <FormatPage extension=".md" icon={Hash} className="format-markdown" />
      <FormatPage extension=".tex" icon={Sigma} className="format-latex" />
      <FormatPage extension=".typ" icon={CaseSensitive} className="format-typst" tape="tape-periwinkle" />
    </div>
  );
}

function ThemesIllustration() {
  return (
    <div className="theme-stack">
      <Print className="theme-print theme-nord">
        <EditorPreview label="nord" />
      </Print>
      <Print className="theme-print theme-catppuccin" tape="tape-cream">
        <EditorPreview label="catppuccin" />
      </Print>
    </div>
  );
}

function AddonsIllustration() {
  return (
    <Print className="addon-print" tape="tape-dots">
      <div className="addon-preview">
        <strong>addons</strong>
        <div className="preview-filter"><Search /><span>filter addons…</span></div>
        {[
          ["git", GitBranch],
          ["latex", Sigma],
          ["vim", Keyboard],
          ["export", FileDown],
        ].map(([name, Icon]) => (
          <div className="preview-addon-row" key={name}>
            <Icon />
            <span>{name}</span>
            <span className="preview-switch" />
          </div>
        ))}
      </div>
    </Print>
  );
}

for (const [id, Illustration] of [
  ["workspace-illustration", WorkspaceIllustration],
  ["formats-illustration", FormatsIllustration],
  ["themes-illustration", ThemesIllustration],
  ["addons-illustration", AddonsIllustration],
  ["beta-icon", TriangleAlert],
]) {
  createRoot(document.getElementById(id)).render(<Illustration />);
}

for (const [name, Icon] of [
  ["download", Download],
  ["star", Star],
  ["chat", MessageCircle],
]) {
  for (const element of document.querySelectorAll(`[data-button-icon="${name}"]`)) {
    createRoot(element).render(<Icon size={16} strokeWidth={1.75} />);
  }
}
