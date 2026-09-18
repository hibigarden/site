# website notes for ai agents

## where to make changes

- `index.html` contains the home page. `addons/index.html` contains the addon page.
- `src/style.css` contains the website styles. `src/theme.js` handles theme changes.
- `src/demo.jsx` adapts the copied editor for the browser. `src/demo.css` styles those changes. keep edits out of `vendor/hibi/src/`; see the [source notes](../../vendor/hibi/README.md).
- `src/scale-demo.js` scales the fixed 900 × 520 editor frame and reveals it when the editor and fonts are ready.
- `src/addons.jsx` renders the addon search, cards, and readme dialogs. `scripts/addon-catalog.mjs` reads addon metadata and sanitizes readmes at build time.

paths above are relative to the repository root.

## addon sync

`addons/authors.ts` and the addon subfolders come from the main hibi repository. make content changes upstream. preserve `addons/index.html` during sync: it belongs to this website.

each addon needs a `manifest.ts` and a `readme.md` or `README.md`. the catalog reads static metadata without running addon code. keep html sanitization and relative-link handling in the build step. the sync workflow is managed upstream.

## design and behavior

use hibi's existing components, geist body font, neutral surfaces, and compact controls. headings use eb garamond. keep copy factual and avoid repeating the same claim across sections.

the hero fills the viewport on desktop and fits its content with padding on smaller screens. preserve the editor's aspect ratio when scaling it. each garden background has 25% opacity and 80% brightness.

keep theme changes and other motion subtle. respect reduced-motion settings, preserve keyboard focus, and keep controls labeled. changing themes must not remount the editor or discard writing.

the demo keeps documents in memory and saves through browser downloads. it does not provide desktop filesystem access. fonts and sound samples are served locally; the site has no analytics.

## checks

use the [commands in the readme](../../README.md#check-and-publish-changes). for interface changes, also check both themes, a narrow screen, keyboard navigation, and reduced motion. keep user documentation outside this folder and preserve third-party license text.
