# hibi editor source

the demo runs editor code copied from [hibi](https://github.com/schmayterling/hibi) commit [`9dec4f08`](https://github.com/schmayterling/hibi/commit/9dec4f080d7618b1ee793850cc84b233f78b9038) (main on 2026-10-29). `src/` holds the files `src/demo*.js(x)` import and everything they import in turn, unchanged.

to copy a newer commit, run `node scripts/vendor-hibi.mjs <hibi checkout> [ref]`, then check the copy with `node scripts/verify-source.mjs <hibi checkout>/src/` while that checkout is at the same commit.

the demo shows the formatted view hibi ships today. to show the CodeMirror formatted view instead, import `MarkdownEditor` from `FormattedEditor` in `src/demo.jsx`, run the copy script again, and set `hibi:formatted-engine` to `codemirror` in local storage before the editor loads.

the typing sounds retain their original [keybeats](src/addons/keybeats/LICENSE.keybeats.md) and [kbsim](src/addons/keybeats/LICENSE.kbsim.md) licenses.
