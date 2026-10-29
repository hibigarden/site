// The LaTeX preview in the browser. The app compiles a PDF with Tectonic, which cannot run here, so
// latex.js renders the document as HTML, with KaTeX for the math. Loads when a .tex preview first renders.
import { HtmlGenerator, parse } from "latex.js";
import article from "../node_modules/latex.js/dist/css/article.css?inline";
import katex from "../node_modules/latex.js/dist/css/katex.css?inline";

// latex.js styles a whole page; here its rules apply inside the preview only. Fonts stay global.
const css = katex + article;
const fonts = css.match(/@font-face\s*\{[^}]*\}/g) ?? [];
const rules = css
  .replace(/@font-face\s*\{[^}]*\}/g, "")
  .replace(/:root,\s*:host|(?:html|body),\s*\.page|\bbody(?=\s*\{)/g, ":scope");
// The preview keeps no inline styles: KaTeX's HTML layout needs them, so the math shows as MathML, and
// latex.js sizes its page grid with them, so the page flows in the preview's width instead.
const mathml = `:scope { display: block; min-width: 0; max-width: 100%; }
.katex .katex-mathml { position: static; clip: auto; clip-path: none; width: auto; height: auto; overflow: visible; }`;
const style = document.createElement("style");
style.textContent = `${fonts.join("\n")}\n@scope (.latex-page) {\n${rules}\n${mathml}\n}`;
document.head.append(style);

export function renderLatex({ source }) {
  const generator = new HtmlGenerator({ hyphenate: false });
  const page = document.createElement("div");
  page.className = "latex-page";
  page.append(parse(source, { generator }).domFragment());
  // The sanitizer would keep an annotation's TeX source as text inside the formula.
  for (const node of page.querySelectorAll(".katex-html, annotation")) node.remove();
  return { html: page.outerHTML };
}
