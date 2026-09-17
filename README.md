# hibi landing page

static landing page with the actual hibi react editor in an isolated, lazy-loaded frame. no analytics or external font requests.

```sh
npm install
npm run dev
npm test
npm run build
```

production output: `dist/`. deploy to any static host.

the editor uses the original hibi titlebar, sidebar, formatting toolbar, tiptap/codemirror editors, and styles. command palette, settings, file opening, and window-control padding are disabled in the preview. see `vendor/hibi/README.md` for provenance and browser boundaries. icons use lucide-react, matching hibi.

demo documents live in memory. save downloads markdown. no document content is sent to a server. media and desktop addon execution stay in the desktop app. keybeats uses hibi's original engine and holy panda samples at 15% volume, with a mute button in the formatting toolbar. audio starts on editor keystrokes. sample licenses ship alongside the vendored plugin.

documentation links point to https://docs.hibi.garden. download and changelog links point to https://github.com/schmayterling/hibi/releases.

the landing preview uses a fixed 900 × 520 shell and scales to fit without reflowing its contents. its rounded frame shows a hibi wordmark with the app's loading shimmer, then fades into the editor after its editable surface and fonts are ready. reduced-motion keeps the loader static and reveals the editor immediately. the only starter file is the supplied `welcome.md`, including subtext and the alpha notice.

`/addons/` reads its catalog at build time from `addons/authors.ts` and each `addons/<id>/manifest.ts` + `readme.md` pair (`README.md` also works). the checked-in snapshot comes from `../hibi 2/src/addons/`. cards use manifest names, descriptions, versions, and authors. the full-width hibi-style filter searches that metadata and reports matches above the input. dialogs render the full readme and author credits, with a compact sticky title and close button while scrolling. new addon folders appear automatically, with a generic icon until one is assigned.

the upstream sync action should update `authors.ts` and addon subfolders, preserving `addons/index.html`, which owns the page route. a site rebuild publishes synced changes; the dev server reloads when catalog files change. no upstream workflow or credentials are configured here.

the build parses static typescript metadata without executing manifests or requiring their license/runtime imports. readme html is sanitized at build time; relative links resolve to the source repository. the parser and sanitizer stay out of browser bundles. `npm test` checks discovery, author resolution, missing readmes, unsupported expressions, and unsafe markdown.

site motion reuses hibi's 120–240 ms tokens and easing: theme crossfades, menu and dialog transitions, faq fades, and hover feedback. reduced-motion skips these animations. browsers without view transitions switch themes immediately; the editor remains mounted throughout.
