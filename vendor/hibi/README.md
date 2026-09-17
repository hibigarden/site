# hibi ui snapshot

these components and styles are copied unchanged from `../hibi 2/src/` on 2026-09-17. only the renderer's reachable editor components, shared controls, and their runtime dependencies are included.

`src/demo.jsx` supplies browser state around the real hibi titlebar, sidebar, markdown editor, formatting toolbar, and status bar. the vendor source remains unchanged. vite redirects the original geist font paths and suppresses automatic focus inside the landing-page frame so it does not scroll past the hero. standalone editor autofocus is retained. `src/demo.css` removes window-control padding and hides the disabled command palette, settings, and open buttons.

desktop filesystem and addon execution are not emulated. demo files exist in memory; saving downloads markdown. theme and toolbar preferences use the components' existing local storage. settings and file opening are disabled. the browser runs the original keybeats engine with holy panda press/release samples only. its preferences select holy panda at 15% volume on load; the original toolbar action toggles mute. both upstream licenses are retained in `src/addons/keybeats/`. remaining desktop settings and addons are documented through links on the landing page.
