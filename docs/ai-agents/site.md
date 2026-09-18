# website notes for ai agents

## writing

write documentation and user-facing prose in complete sentences and paragraphs. ponytail shorthand does not apply to anything user-facing. include details only when they help the reader act or avoid a mistake. do not narrate obvious behavior, list features to sound thorough, or repeat what is already clear.

## source boundaries

keep `vendor/hibi/src/` unchanged. make browser adaptations in `src/demo.jsx` and `src/demo.css`. `vite.config.js` adjusts font paths and disables autofocus in the embedded editor.

to check the copied source, run `node scripts/verify-source.mjs /path/to/hibi/src` against the version it came from. preserve third-party license text.

`addons/authors.ts` and the addon subfolders come from the main hibi repository. make content changes upstream. preserve `addons/index.html` during sync: it belongs to this website.

each addon needs a `manifest.ts` and a `readme.md` or `README.md`. read manifests without executing them. keep html sanitization and relative-link handling in the build step. the sync workflow is managed upstream.

## editor constraints

reuse hibi's components. scale the fixed 900 × 520 editor frame without changing its aspect ratio. keep the hero sized to its content on smaller screens.

theme changes must not remount the editor or discard writing. respect reduced-motion settings and preserve keyboard focus.

## checks

install with `npm ci` and start the site with `npm run dev`. run `npm test` and `npm run build` before publishing. `npm run preview` serves the built site; `dist/` is the deployable output.

for interface changes, also check both themes, a narrow screen, keyboard navigation, and reduced motion.
