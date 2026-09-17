# tags

optional extension by may (`1262793452236570667`), version 1.0.0. enable in settings → addons.

The tag browser uses the shared sidebar, with a pinnable view shortcut and the standard resize handle. Tag clicks select the tag in that view; opening a note keeps the browser visible. Tag counts update from the active draft in memory. Workspace reads are debounced and subscriptions stop while the view is hidden.

Unchanged notes reuse their parsed tags; typing reindexes only the changed note.

write `#tag` in markdown prose. unicode letters, numbers, underscores, hyphens, and nested names such as `#work/project` are supported; purely numeric tags are ignored. matching is case-insensitive. headings, escaped hashes, code, html, urls/link labels, and frontmatter are not indexed as tags.

tags are highlighted in normal and source panes. shift-click one, click the tags status pill, or run **browse tags** to open the tag browser. filter tags, select one, then open a matching workspace note. refresh rereads the workspace; saved file changes also refresh an open browser. unsaved edits in the active saved note are included. opening another note keeps the app's unsaved-change checks.

tags remain ordinary markdown when disabled or exported. the plugin stores no index on disk, sends nothing to a server, and uses the shared workspace snapshot limits. drafts without a workspace path are shown in the status pill but are not included in workspace results.
