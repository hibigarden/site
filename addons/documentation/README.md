# documentation addon

exports use the active flavor pipeline, including optional math. the site sanitizes generated html; required styles and fonts are embedded. per-file overrides are respected. if content changes while rendering, run export again.

exports include top-bar breadcrumbs, previous/next links below a divider, and an **in this page** heading outline. the outline moves into a compact disclosure on narrower screens. phone navigation opens as a drawer with an outside-click backdrop and escape dismissal; selecting a page closes it. all navigation reuses the shared sidebar and tokens.

the first hibi addon turns a folder of markdown into one deployable HTML document.

enable **documentation** under settings → addons. open a workspace, then choose **export documentation** from the command palette. a native save dialog selects the destination. the exported site provides nested navigation, normal read-only rendering, and local fuzzy/keyword search on `cmd/ctrl+k`.

labelled code fences use hibi's shared syntax highlighter, including languages registered by enabled extensions. highlighted html and themed token styles are embedded; the exported site does not need parser code or a network connection.

`index.ts` registers the export command through the renderer SDK. `native.ts` snapshots the selected workspace, embeds escaped data into the generated site template, and uses the host’s native save operation. `manifest.ts` declares API compatibility and defaults.

the viewer uses the shared sidebar and command palette, DOMPurify, MiniSearch, and locally bundled Geist. local Markdown images are embedded from each note's folder, including absolute paths and local `file:` URLs. supported formats are PNG, JPEG, GIF, WebP, AVIF, and SVG, up to 8 mib each and 20 mib total with Markdown. remote images and other attachments are not copied. exports include in-memory edits to the current workspace document and do not save them back to disk.

exports include nine bundled colorschemes, their full third-party license notices, and appearance preferences supplied by the host's workspace snapshot. readers can override appearance with the top-bar palette button. addon palettes fall back to hibi; addon code and CSS overrides are not exported.

see [exporting](../../../docs/guides/exporting.md) and [addon development](../../../docs/development/addons.md).
