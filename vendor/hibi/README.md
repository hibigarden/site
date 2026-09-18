# hibi editor source

this folder contains the hibi components used by the website's editor demo, copied from the main app on 2026-09-17. it includes the titlebar, sidebar, editor, formatting toolbar, status bar, and the code they depend on.

the copied files are kept unchanged. browser-specific behavior lives in [`src/demo.jsx`](../../src/demo.jsx) and [`src/demo.css`](../../src/demo.css). [`vite.config.js`](../../vite.config.js) resolves font paths and prevents the embedded editor from taking focus when the page loads.

keybeats uses the original sound engine with holy panda samples. its [keybeats license](src/addons/keybeats/LICENSE.keybeats.md) and [kbsim license](src/addons/keybeats/LICENSE.kbsim.md) are included.

## compare with the source app

from the website repository, run:

```sh
node scripts/verify-source.mjs /path/to/hibi/src
```

this compares every copied file with the corresponding file in your hibi checkout. use the version the snapshot came from; later app changes will appear as differences.
