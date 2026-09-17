# vim

editor CSS is registered through `context.styles` and removed when this addon stops.

the pending/last-command status pill uses `verbatim: true`, preserving meaningful uppercase keystrokes even when the interface is set to lowercase.

version 0.2.0 · may (`1262793452236570667`). disabled by default.

adds the CodeMirror vim engine to source panes through `context.editor.registerSource`. the engine is imported on demand and includes mode-aware cursors, visual selections, motions, operators, registers, macros, search, and ex commands. the normal wysiwyg view keeps its existing input behavior.

native file commands use `context.editor.runCommand` and `context.workspace.openFile`, preserving dialogs, unsaved edits, and external-change checks. `:w`, `:e`, `:enew`, `:q`, `:wq`, and `:x` integrate with hibi. force-quit flags still check unsaved edits. shell execution, vimscript, external vim plugins, and `:w filename` are outside this embedded engine.

the optional settings page controls the initial insert mode and status visibility. `context.statusBar.register` supplies an off indicator in normal view and a mode pill in source views at the editor page's bottom-left, beside the full-height sidebar; command prompts remain in the source pane. view-scoped command contexts, status handles, and preference listeners are cleaned up when the editor or plugin stops. see [the editing guide](../../../docs/guides/vim.md) and [upstream engine](https://github.com/replit/codemirror-vim).

a second source-view pill shows pending normal/visual command keys, then keeps the last completed sequence: `2` → `22` → `22k`. motions execute on their final key; a standalone enter leaves that displayed sequence intact. escape cancels a pending sequence and restores the last one. search and `:` prompts show their current input and retain it on enter. insert-mode document text is not collected. **show vim status** controls all Vim status pills; listeners and command state are local to the active source editor and are removed on teardown.
