# website notes for ai agents

## where to make changes

`index.html` contains the home page, and `addons/index.html` contains the addon page. the website styles live in `src/style.css`, while `src/theme.js` handles theme changes.

`src/demo.jsx` adapts the copied editor for the browser, and `src/demo.css` styles those changes. keep edits out of `vendor/hibi/src/`; see the [source notes](../../vendor/hibi/README.md). `src/scale-demo.js` scales the fixed 900 × 520 editor frame and reveals it when the editor and fonts are ready.

`src/addons.jsx` renders the addon search, cards, and readme dialogs. `scripts/addon-catalog.mjs` reads addon metadata and sanitizes readmes at build time. all paths in these notes are relative to the repository root.

`vite.config.js` resolves the copied font paths and disables autofocus in the embedded editor. the source snapshot can be checked with `node scripts/verify-source.mjs /path/to/hibi/src`; compare against the version it came from.

## addon sync

`addons/authors.ts` and the addon subfolders come from the main hibi repository. make content changes upstream. preserve `addons/index.html` during sync: it belongs to this website.

each addon needs a `manifest.ts` and a `readme.md` or `README.md`. the catalog reads static metadata without running addon code. keep html sanitization and relative-link handling in the build step. the sync workflow is managed upstream.

## design and behavior

use hibi's existing components, geist body font, neutral surfaces, and compact controls. headings use eb garamond. keep copy factual and avoid repeating the same claim across sections.

the hero fills the viewport on desktop and fits its content with padding on smaller screens. preserve the editor's aspect ratio when scaling it. each garden background has 25% opacity and 80% brightness.

keep theme changes and other motion subtle. respect reduced-motion settings, preserve keyboard focus, and keep controls labeled. changing themes must not remount the editor or discard writing.

the demo keeps documents in memory and saves through browser downloads. it does not provide desktop filesystem access. fonts and sound samples are served locally; the site has no analytics.

## checks

install with `npm ci` and start the site with `npm run dev`. run `npm test` and `npm run build` before publishing. `npm run preview` serves the built site; `dist/` is the deployable output.

for interface changes, also check both themes, a narrow screen, keyboard navigation, and reduced motion. preserve third-party license text.

write documentation and user-facing prose in complete sentences and natural paragraphs. ponytail shorthand does not apply to anything user-facing, including ui copy. keep public readmes to a short introduction and useful links, and keep maintenance details here.
