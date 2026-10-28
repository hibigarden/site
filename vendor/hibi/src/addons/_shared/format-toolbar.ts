import type {
  DocumentEdit,
  DocumentFormatting,
  DocumentSelection,
} from '../api'

type Rules = {
  marks: Record<string, readonly [string, string]>
  heading: (level: number, text: string) => string
  strip: RegExp
  levels?: number
  lines: Record<string, string>
  blocks: Record<string, (text: string) => string>
  link: (url: string, label: string) => string
  image: (url: string, alt: string) => string
  divider: string
  break: string
  table: string
}
const html = (value: string) =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
const tex = (value: string) =>
  value.replace(/[\\{}%&#_$^~]/g, (char) =>
    char === '\\'
      ? '\\textbackslash{}'
      : char === '^'
        ? '\\textasciicircum{}'
        : char === '~'
          ? '\\textasciitilde{}'
          : `\\${char}`,
  )
const heading =
  (mark: string, close = false) =>
  (level: number, text: string) =>
    `${mark.repeat(level)} ${text}${close ? ` ${mark.repeat(level)}` : ''}`
const fence = (text: string) => {
  const ticks = '`'.repeat(
    Math.max(
      3,
      ...Array.from(text.matchAll(/`+/g), (match) => match[0].length + 1),
    ),
  )
  return `${ticks}\n${text}\n${ticks}`
}
const table = '| Column 1 | Column 2 |\n| --- | --- |\n|  |  |'
const markdownLink = (url: string, label: string) =>
  `[${label.replace(/[\\[\]]/g, '\\$&')}](${url.replace(/[\\()]/g, '\\$&').replaceAll(' ', '%20')})`
const rules: Record<string, Rules> = {
  bbcode: {
    marks: {
      bold: ['[b]', '[/b]'],
      italic: ['[i]', '[/i]'],
      strike: ['[s]', '[/s]'],
    },
    heading: (_level, text) => text,
    levels: 0,
    strip: /$^/,
    lines: {},
    blocks: {
      quote: (text) => `[quote]${text}[/quote]`,
      'code-block': (text) => `[code]${text}[/code]`,
      'bullet-list': (text) =>
        `[list]\n${text
          .split('\n')
          .map((line) => `[*]${line}`)
          .join('\n')}\n[/list]`,
      'numbered-list': (text) =>
        `[list=1]\n${text
          .split('\n')
          .map((line) => `[*]${line}`)
          .join('\n')}\n[/list]`,
    },
    link: (url, label) =>
      `[url=${url.replace(/[[\]\r\n]/g, encodeURIComponent)}]${label}[/url]`,
    image: (url) =>
      `[img]${url.replace(/[[\]\r\n]/g, encodeURIComponent)}[/img]`,
    divider: '',
    break: '\n',
    table: '',
  },
  typst: {
    marks: {
      bold: ['*', '*'],
      italic: ['_', '_'],
      strike: ['#strike[', ']'],
      subscript: ['#sub[', ']'],
      subtext: ['#text(size: 0.8em)[', ']'],
      'inline-code': ['`', '`'],
    },
    heading: heading('='),
    strip: /^(?:={1,6}\s|[-+]\s)/,
    lines: { 'bullet-list': '- ', 'numbered-list': '+ ' },
    blocks: {
      quote: (text) => `#quote(block: true)[\n${text}\n]`,
      'code-block': fence,
    },
    link: (url, label) => `#link(${JSON.stringify(url)})[${label}]`,
    image: (url) => `#image(${JSON.stringify(decodePath(url))})`,
    divider: '#line(length: 100%)',
    break: '\\\n',
    table: '#table(columns: 2, [Column 1], [Column 2], [], [])',
  },
  latex: {
    marks: {
      bold: ['\\textbf{', '}'],
      italic: ['\\emph{', '}'],
      strike: ['\\sout{', '}'],
      subscript: ['\\textsubscript{', '}'],
      subtext: ['{\\small ', '}'],
      'inline-code': ['\\texttt{', '}'],
    },
    heading: (level, text) =>
      `\\${['section', 'subsection', 'subsubsection', 'paragraph', 'subparagraph'][level - 1]}{${text}}`,
    levels: 5,
    strip:
      /^\\(?:section|subsection|subsubsection|paragraph|subparagraph)\{(.*)\}$/,
    lines: {},
    blocks: {
      quote: (text) => `\\begin{quote}\n${text}\n\\end{quote}`,
      'code-block': (text) => `\\begin{verbatim}\n${text}\n\\end{verbatim}`,
      'bullet-list': (text) =>
        `\\begin{itemize}\n${text
          .split('\n')
          .map((line) => `\\item ${line}`)
          .join('\n')}\n\\end{itemize}`,
      'numbered-list': (text) =>
        `\\begin{enumerate}\n${text
          .split('\n')
          .map((line) => `\\item ${line}`)
          .join('\n')}\n\\end{enumerate}`,
    },
    link: (url, label) => `\\href{${tex(url)}}{${label}}`,
    image: (url) =>
      `\\includegraphics{${tex(decodePath(url).replaceAll('\\', '/'))}}`,
    divider: '\\noindent\\rule{\\linewidth}{0.4pt}',
    break: '\\\\\n',
    table:
      '\\begin{tabular}{ll}\nColumn 1 & Column 2 \\\\\n\\hline\n & \\\\\n\\end{tabular}',
  },
  html: {
    marks: {
      bold: ['<strong>', '</strong>'],
      italic: ['<em>', '</em>'],
      strike: ['<s>', '</s>'],
      subscript: ['<sub>', '</sub>'],
      subtext: ['<small>', '</small>'],
      'inline-code': ['<code>', '</code>'],
    },
    heading: (level, text) => `<h${level}>${text}</h${level}>`,
    strip: /^<(?:h[1-6]|p)>(.*)<\/(?:h[1-6]|p)>$/,
    lines: {},
    blocks: {
      quote: (text) => `<blockquote>\n${text}\n</blockquote>`,
      'code-block': (text) => `<pre><code>${html(text)}</code></pre>`,
      'bullet-list': (text) =>
        `<ul>\n${text
          .split('\n')
          .map((line) => `  <li>${line}</li>`)
          .join('\n')}\n</ul>`,
      'numbered-list': (text) =>
        `<ol>\n${text
          .split('\n')
          .map((line) => `  <li>${line}</li>`)
          .join('\n')}\n</ol>`,
    },
    link: (url, label) => `<a href="${html(url)}">${label}</a>`,
    image: (url, alt) => `<img src="${html(url)}" alt="${html(alt)}">`,
    divider: '<hr>',
    break: '<br>\n',
    table:
      '<table>\n  <tr><th>Column 1</th><th>Column 2</th></tr>\n  <tr><td></td><td></td></tr>\n</table>',
  },
  rst: {
    marks: {
      bold: ['**', '**'],
      italic: ['*', '*'],
      'inline-code': ['``', '``'],
    },
    heading: (level, text) =>
      `${text}\n${['=', '-', '~', '^', '"', '#'][level - 1]?.repeat(Math.max(1, text.length))}`,
    strip: /^(?:[-*+]\s|(?:\d+|#)\.\s)/,
    lines: { 'bullet-list': '- ', 'numbered-list': '#. ' },
    blocks: {
      quote: (text) =>
        text
          .split('\n')
          .map((line) => `    ${line}`)
          .join('\n'),
      'code-block': (text) =>
        `::\n\n${text
          .split('\n')
          .map((line) => `    ${line}`)
          .join('\n')}`,
    },
    link: (url, label) => `\`${label.replaceAll('`', '\\`')} <${url}>\`_`,
    image: (url, alt) =>
      `.. image:: ${url}\n   :alt: ${alt.replaceAll('\n', ' ')}`,
    divider: '----',
    break: '\n\n',
    table:
      '.. list-table::\n   :header-rows: 1\n\n   * - Column 1\n     - Column 2\n   * -\n     -',
  },
  asciidoc: {
    marks: {
      bold: ['*', '*'],
      italic: ['_', '_'],
      subscript: ['~', '~'],
      'inline-code': ['`', '`'],
    },
    heading: heading('='),
    strip: /^(?:={1,6}\s|\*\s(?:\[[ xX]\]\s)?|\.\s)/,
    lines: { 'bullet-list': '* ', 'numbered-list': '. ', checklist: '* [ ] ' },
    blocks: {
      quote: (text) => `____\n${text}\n____`,
      'code-block': (text) => `[source]\n----\n${text}\n----`,
    },
    link: (url, label) => `${url}[${label.replaceAll(']', '\\]')}]`,
    image: (url, alt) => `image::${url}[${alt.replaceAll(']', '\\]')}]`,
    divider: "'''",
    break: ' +\n',
    table: '|===\n|Column 1 |Column 2\n\n| |\n|===',
  },
  org: {
    marks: {
      bold: ['*', '*'],
      italic: ['/', '/'],
      strike: ['+', '+'],
      subscript: ['_{', '}'],
      'inline-code': ['~', '~'],
    },
    heading: heading('*'),
    strip: /^(?:\*{1,6}\s|[-+]\s(?:\[[ xX]\]\s)?|\d+[.)]\s)/,
    lines: { 'bullet-list': '- ', 'numbered-list': '1. ', checklist: '- [ ] ' },
    blocks: {
      quote: (text) => `#+begin_quote\n${text}\n#+end_quote`,
      'code-block': (text) => `#+begin_src\n${text}\n#+end_src`,
    },
    link: (url, label) => `[[${url}][${label}]]`,
    image: (url) => `[[${decodePath(url)}]]`,
    divider: '-----',
    break: '\\\\\n',
    table:
      '| Column 1 | Column 2 |\n|----------+----------|\n|          |          |',
  },
  mediawiki: {
    marks: {
      bold: ["'''", "'''"],
      italic: ["''", "''"],
      strike: ['<s>', '</s>'],
      subscript: ['<sub>', '</sub>'],
      subtext: ['<small>', '</small>'],
      'inline-code': ['<code>', '</code>'],
    },
    heading: heading('=', true),
    strip: /^(?:={1,6}\s?(.*?)\s?={1,6}|[*#]\s?(.*))$/,
    lines: { 'bullet-list': '* ', 'numbered-list': '# ' },
    blocks: {
      quote: (text) => `<blockquote>\n${text}\n</blockquote>`,
      'code-block': (text) => `<pre>${html(text)}</pre>`,
    },
    link: (url, label) =>
      /^[a-z][\w+.-]*:/i.test(url)
        ? `[${url} ${label}]`
        : `[[${url}|${label}]]`,
    image: (url, alt) => `[[File:${decodePath(url)}|thumb|${alt}]]`,
    divider: '----',
    break: '<br>\n',
    table: '{| class="wikitable"\n! Column 1 !! Column 2\n|-\n|  ||\n|}',
  },
  creole: {
    marks: {
      bold: ['**', '**'],
      italic: ['//', '//'],
      'inline-code': ['{{{', '}}}'],
    },
    heading: heading('=', true),
    strip: /^(?:={1,6}\s?(.*?)\s?={1,6}|[*#]\s?(.*))$/,
    lines: { 'bullet-list': '* ', 'numbered-list': '# ' },
    blocks: { 'code-block': (text) => `{{{\n${text}\n}}}` },
    link: (url, label) => `[[${url}|${label}]]`,
    image: (url, alt) => `{{${url}|${alt}}}`,
    divider: '----',
    break: '\\\\\n',
    table: '|= Column 1 |= Column 2 |\n|  |  |',
  },
  textile: {
    marks: {
      bold: ['*', '*'],
      italic: ['_', '_'],
      strike: ['-', '-'],
      subscript: ['~', '~'],
      'inline-code': ['@', '@'],
    },
    heading: (level, text) => `h${level}. ${text}`,
    strip: /^(?:h[1-6]\.\s|p\.\s|[*#]\s|bq\.\s)/,
    lines: { 'bullet-list': '* ', 'numbered-list': '# ', quote: 'bq. ' },
    blocks: { 'code-block': (text) => `bc.. ${text}\n\np. ` },
    link: (url, label) => `"${label.replaceAll('"', '&quot;')}":${url}`,
    image: (url, alt) => `!${url}(${alt.replaceAll(')', '')})!`,
    divider: '<hr>',
    break: '<br>\n',
    table: '|_. Column 1 |_. Column 2 |\n|  |  |',
  },
  djot: {
    marks: {
      bold: ['*', '*'],
      italic: ['_', '_'],
      strike: ['{-', '-}'],
      subscript: ['~', '~'],
      'inline-code': ['`', '`'],
    },
    heading: heading('#'),
    strip: /^(?:#{1,6}\s|[-*+]\s(?:\[[ xX]\]\s)?|\d+[.)]\s|>\s)/,
    lines: {
      'bullet-list': '- ',
      'numbered-list': '1. ',
      checklist: '- [ ] ',
      quote: '> ',
    },
    blocks: { 'code-block': fence },
    link: markdownLink,
    image: (url, alt) => `!${markdownLink(url, alt)}`,
    divider: '***',
    break: '\\\n',
    table,
  },
}

function decodePath(path: string) {
  try {
    return decodeURIComponent(path)
  } catch {
    return path
  }
}
const lineRange = ({ source, from, to }: DocumentSelection) => {
  const start = from === 0 ? 0 : source.lastIndexOf('\n', from - 1) + 1
  const newline = source.indexOf(
    '\n',
    to > from && source[to - 1] === '\n' ? to - 1 : to,
  )
  return { from: start, to: newline < 0 ? source.length : newline }
}

export const formatMarks = (name: string) => rules[name]?.marks ?? {}

/** Format-specific syntax, using the host's common selection, undo, toolbar, and keymap. */
export function formatToolbar(name: string): 'markdown' | DocumentFormatting {
  const rule = rules[name]
  if (!rule) return 'markdown'
  const strip = (line: string) => {
    const match = rule.strip.exec(line)
    return !match
      ? line
      : match.length > 1
        ? (match.slice(1).find((value) => value !== undefined) ?? '')
        : line.slice(match[0].length)
  }
  const marked = (id: string, selection: DocumentSelection) => {
    const pair = rule.marks[id]
    return (
      !!pair &&
      selection.source.slice(
        Math.max(0, selection.from - pair[0].length),
        selection.from,
      ) === pair[0] &&
      selection.source.slice(selection.to, selection.to + pair[1].length) ===
        pair[1]
    )
  }
  return {
    actions: [
      ...Object.keys(rule.marks),
      ...Object.keys(rule.lines),
      ...Object.keys(rule.blocks),
      'paragraph',
      ...Array.from(
        { length: rule.levels ?? 6 },
        (_, index) => `heading-${index + 1}`,
      ),
      'link',
      'image',
      'divider',
      'hard-break',
      'table',
    ],
    isActive: marked,
    apply(id, selection) {
      const { source, values } = selection
      let { from, to } = selection
      let insert = source.slice(from, to),
        start = 0,
        end = insert.length
      const pair = rule.marks[id]
      if (pair) {
        if (marked(id, selection)) {
          from -= pair[0].length
          to += pair[1].length
        } else if (
          insert.startsWith(pair[0]) &&
          insert.endsWith(pair[1]) &&
          insert.length >= pair[0].length + pair[1].length
        ) {
          insert = insert.slice(pair[0].length, -pair[1].length)
          end = insert.length
        } else {
          insert = pair[0] + insert + pair[1]
          start = pair[0].length
          end = insert.length - pair[1].length
        }
      } else if (
        id.startsWith('heading-') ||
        id === 'paragraph' ||
        rule.lines[id]
      ) {
        ;({ from, to } = lineRange(selection))
        const lines = source.slice(from, to).split('\n')
        const prefix = rule.lines[id]
        const remove =
          !!prefix && lines.every((line) => line.startsWith(prefix))
        insert = lines
          .map((line) => {
            const body = strip(line)
            return id === 'paragraph' || remove
              ? name === 'html'
                ? `<p>${body}</p>`
                : name === 'textile'
                  ? `p. ${body}`
                  : body
              : id.startsWith('heading-')
                ? rule.heading(Number(id.slice(-1)), body)
                : prefix + body
          })
          .join('\n')
        if (
          name === 'rst' &&
          /^([=~^"#-])\1*$/.test(source.slice(to + 1).split('\n')[0] ?? '')
        )
          to += 1 + (source.slice(to + 1).split('\n')[0]?.length ?? 0)
        start = selection.from === selection.to ? insert.length : 0
        end = insert.length
      } else if (id === 'link' || id === 'image') {
        if (!values) return null
        insert =
          id === 'link'
            ? rule.link(values.url, insert || values.alt || values.url)
            : rule.image(values.url, values.alt)
        start = end = insert.length
      } else {
        if (['quote', 'bullet-list', 'numbered-list'].includes(id)) {
          ;({ from, to } = lineRange(selection))
          insert = source.slice(from, to)
        }
        const block =
          rule.blocks[id]?.(insert) ??
          (id === 'divider' ? rule.divider : id === 'table' ? rule.table : null)
        if (id === 'hard-break') insert = rule.break
        else if (block !== null)
          insert = `${from && !source.slice(0, from).endsWith('\n\n') ? '\n\n' : ''}${block}\n\n`
        else return null
        start = end = insert.length
      }
      let edit: DocumentEdit = {
        from,
        to,
        insert,
        selection: { from: start, to: end },
      }
      if (name === 'latex') {
        const dependency = {
          link: ['hyperref', ''],
          image: ['graphicx', ''],
          strike: ['ulem', '[normalem]'],
        }[id as 'link' | 'image' | 'strike']
        const plain = source.replace(/(?<!\\)%[^\n]*/g, (value) =>
          ' '.repeat(value.length),
        )
        const declaration =
          /\\documentclass\s*(?:\[[^\]]*\]\s*)?\{[^}]+\}/.exec(plain)
        if (
          dependency &&
          declaration &&
          !Array.from(
            plain.matchAll(/\\usepackage\s*(?:\[[^\]]*\]\s*)?\{([^}]+)\}/g),
          ).some((match) =>
            match[1]
              ?.split(',')
              .map((name) => name.trim())
              .includes(dependency[0]!),
          )
        ) {
          const position = declaration.index + declaration[0].length
          const preamble = `\n\\usepackage${dependency[1]}{${dependency[0]}}\n`
          const updated = source.slice(0, from) + insert + source.slice(to)
          if (position <= from)
            edit = {
              from: 0,
              to: source.length,
              insert:
                updated.slice(0, position) + preamble + updated.slice(position),
              selection: {
                from: from + start + preamble.length,
                to: from + end + preamble.length,
              },
            }
        }
      }
      return edit
    },
  }
}
