# hibi landing page

static landing page with the actual hibi react editor in an isolated, lazy-loaded frame. no analytics or external font requests.

```sh
npm install
npm run dev
npm run build
```

production output: `dist/`. deploy to any static host.

the editor uses the original hibi titlebar, sidebar, formatting toolbar, tiptap/codemirror editors, and styles. command palette, settings, file opening, and window-control padding are disabled in the preview. see `vendor/hibi/README.md` for provenance and browser boundaries. icons use lucide-react, matching hibi.

demo documents live in memory. save downloads markdown. no document content is sent to a server. media and desktop addon execution stay in the desktop app. keybeats uses hibi's original engine and holy panda samples at 15% volume, with a mute button in the formatting toolbar. audio starts on editor keystrokes. sample licenses ship alongside the vendored plugin.

documentation links point to https://docs.hibi.garden. add download links when a public release exists.

the landing preview uses a fixed 900 × 520 iframe and scales to fit without reflowing its contents. the only starter file is the supplied `welcome.md`; its `test.com` links are retained verbatim.

`/addons/` lists the bundled addons with keyboard-accessible detail dialogs. faq, cloud, and changelog navigation point to informational sections on the homepage; cloud services are not implemented. changelog shows the source app's current alpha version until release notes are supplied.

site motion reuses hibi's 120–240 ms tokens and easing: theme crossfades, menu and dialog transitions, faq fades, and hover feedback. reduced-motion skips these animations. browsers without view transitions switch themes immediately; the editor remains mounted throughout.
