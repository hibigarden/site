import type { Language } from '@codemirror/language'
import type { FormatSpec } from './format-specs'
import { formatMarks } from './format-toolbar.ts'

export async function formatLanguage(
  format: FormatSpec,
  resolve: (name: string) => Language | null,
) {
  if (format.reader === 'html')
    return (await import('@codemirror/lang-html')).html().language
  if (['mdx', 'mdsvex', 'markdoc', 'markdown'].includes(format.reader))
    return (await import('@codemirror/lang-markdown')).markdown({
      codeLanguages: resolve,
    }).language
  const { StreamLanguage } = await import('@codemirror/language')
  if (format.reader === 'latex')
    return StreamLanguage.define(
      (await import('@codemirror/legacy-modes/mode/stex')).stex,
    )
  if (format.reader === 'textile')
    return StreamLanguage.define(
      (await import('@codemirror/legacy-modes/mode/textile')).textile,
    )
  const headings: Record<string, RegExp> = {
    rst: /^(?:[=~`^#*+-]{3,})\s*$/,
    asciidoc: /^={1,6}\s.+/,
    org: /^\*{1,6}\s.+/,
    mediawiki: /^={1,6}[^=].*/,
    creole: /^={1,6}[^=].*/,
    djot: /^#{1,6}\s.+/,
  }
  const directives: Record<string, RegExp> = {
    rst: /^\.\.\s.*/,
    asciidoc: /^\/\/.*/,
    org: /^#\+.*/,
  }
  const regexEscape = (value: string) =>
    value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const tags: Record<string, string> = {
    bold: 'strong',
    italic: 'emphasis',
    strike: 'strikethrough',
    subscript: 'atom',
    subtext: 'meta',
    'inline-code': 'monospace',
  }
  const marks = Object.entries(formatMarks(format.reader)).map(
    ([action, [open, close]]) => ({
      pattern: new RegExp(
        `^${regexEscape(open)}\\S(?:.*?\\S)?${regexEscape(close)}`,
      ),
      tag: tags[action] ?? 'keyword',
    }),
  )
  return StreamLanguage.define({
    name: format.reader,
    token(stream) {
      if (stream.sol() && stream.match(headings[format.reader] ?? /$^/))
        return 'heading'
      if (stream.sol() && stream.match(directives[format.reader] ?? /$^/))
        return 'meta'
      if (stream.sol() && stream.match(/^\s*(?:[-+*#]|\d+[.)])\s/))
        return 'list'
      if (stream.match(/^\[\[[^\]]+\]\]|^https?:\/\/[^\s]+/)) return 'link'
      for (const mark of marks) if (stream.match(mark.pattern)) return mark.tag
      if (stream.match(/^\[[^\]]+\]|^:[\w-]+:/)) return 'keyword'
      stream.next()
      return null
    },
  })
}
