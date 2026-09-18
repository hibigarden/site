import { createRoot } from "react-dom/client";
import {
  Bold,
  CaseSensitive,
  ChevronDown,
  ChevronRight,
  Download,
  FileDown,
  FilePenLine,
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
  PenLine,
  Search,
  Sigma,
  Star,
  Undo2,
} from "lucide-react";

function EditorPreview({ label = "welcome.md", className = "" }) {
  return (
    <div className={`editor-preview ${className}`}>
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
  return <EditorPreview className="workspace-preview" />;
}

function FormatPage({ extension, icon: Icon, className }) {
  return (
    <div className={`format-page ${className}`}>
      <span className="format-extension">{extension}</span>
      <Icon className="format-symbol" />
      <div className="format-lines"><i /><i /><i /></div>
    </div>
  );
}

function FormatsIllustration() {
  return (
    <div className="format-stack">
      <FormatPage extension=".md" icon={Hash} className="format-markdown" />
      <FormatPage extension=".tex" icon={Sigma} className="format-latex" />
      <FormatPage extension=".typ" icon={CaseSensitive} className="format-typst" />
    </div>
  );
}

function ThemesIllustration() {
  return (
    <div className="theme-stack">
      <EditorPreview label="nord" className="theme-nord" />
      <EditorPreview label="catppuccin" className="theme-catppuccin" />
    </div>
  );
}

function AddonsIllustration() {
  return (
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
  );
}

for (const [id, Illustration] of [
  ["workspace-illustration", WorkspaceIllustration],
  ["formats-illustration", FormatsIllustration],
  ["themes-illustration", ThemesIllustration],
  ["addons-illustration", AddonsIllustration],
  ["writer-icon", PenLine],
  ["editor-icon", FilePenLine],
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
