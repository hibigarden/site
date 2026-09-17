# math

optional extension by may. enable **math** in settings → addons or the command palette. `$x^2$` renders inline; `$$` delimiters render a block. fenced and inline code remain literal. automatic flavor detection recognizes these expressions; use the flavor pill to override a file's syntax.

click a rendered expression to edit latex in a shared dialog. the toolbar and palette provide inline and block insertion in both rich and source editors. source remains ordinary markdown and latex. invalid expressions show their source rather than interrupting editing.

settings → syntax has separate inline and block math switches. turning either off keeps the latex delimiters visible as literal markdown in the editor and export.

katex and its fonts run locally. exports embed rendered equations, mathml, styles, fonts, and license notices; no cdn or runtime model is required. katex uses `trust: false`, bounded macro expansion, and no shared user macros. this is latex math supported by katex, not an executable tex document engine.

uses mit-licensed [tiptap mathematics](https://tiptap.dev/docs/editor/extensions/nodes/mathematics) and [katex](https://katex.org/docs/security), listed in hibi's open source licenses.
