import { Marked, type MarkedExtension } from 'marked'

export function subscriptToken(source: string) {
  const match = /^~(?!~)([^\s~](?:[^~\n]*?[^\s~])?)~(?!~)/.exec(source)
  return match && { type: 'subscript', raw: match[0], text: match[1]! }
}
export function subtextToken(source: string) {
  const match = /^-# ([^\n]*)(?:\n|$)/.exec(source)
  return match && { type: 'subtext', raw: match[0], text: match[1]! }
}
export const textExtrasMarkdown: MarkedExtension = {
  extensions: [
    {
      name: 'subscript',
      level: 'inline',
      start: (source) => source.indexOf('~'),
      tokenizer(source) {
        const token = subscriptToken(source)
        if (token)
          return { ...token, tokens: this.lexer.inlineTokens(token.text) }
      },
      renderer(token) {
        return `<sub>${this.parser.parseInline(token.tokens ?? [])}</sub>`
      },
    },
    {
      name: 'subtext',
      level: 'block',
      start: (source) => source.search(/^-# /m),
      tokenizer(source) {
        const token = subtextToken(source)
        if (token)
          return { ...token, tokens: this.lexer.inlineTokens(token.text) }
      },
      renderer(token) {
        return `<p class="markdown-subtext">${this.parser.parseInline(token.tokens ?? [])}</p>\n`
      },
    },
  ],
}
const detector = new Marked(textExtrasMarkdown)
export function detectTextExtras(source: string) {
  let found = false
  detector.walkTokens(detector.lexer(source), (token) => {
    if (token.type === 'subscript' || token.type === 'subtext') found = true
  })
  return found
}
