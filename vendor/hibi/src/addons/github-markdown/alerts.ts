import { Lexer, type MarkedExtension, Tokenizer } from 'marked'

export const alertTypes = [
  'note',
  'tip',
  'important',
  'warning',
  'caution',
] as const
export type AlertType = (typeof alertTypes)[number]
export function alertType(value: unknown): AlertType | undefined {
  const type = typeof value === 'string' ? value.toLowerCase() : ''
  return alertTypes.find((candidate) => candidate === type)
}
export function alertMarker(text: string) {
  return /^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\][ \t]*(?:\n|$)/i.exec(text)
}
export function alertStart(source: string) {
  return source.includes('[!')
    ? source.search(
        /^ {0,3}>[ \t]*\[!(?:NOTE|TIP|IMPORTANT|WARNING|CAUTION)\][ \t]*(?:\n|$)/im,
      )
    : -1
}

export function alertToken(source: string) {
  if (!/^ {0,3}>[ \t]*\[!/i.test(source)) return
  // Use Markdown's own quote boundaries, including lazy continuation and nested blocks.
  const tokenizer = new Tokenizer()
  new Lexer({ gfm: true, tokenizer })
  const quote = tokenizer.blockquote(source)
  const marker = quote && alertMarker(quote.text)
  if (!quote || !marker) return
  return {
    type: 'githubAlert',
    raw: quote.raw,
    alertType: marker[1]!.toLowerCase(),
    text: quote.text.slice(marker[0].length),
  }
}

export const alertMarkdown: MarkedExtension = {
  extensions: [
    {
      name: 'githubAlert',
      level: 'block',
      tokenizer(source) {
        const token = alertToken(source)
        if (token)
          return { ...token, tokens: this.lexer.blockTokens(token.text) }
      },
      renderer(token) {
        const type = alertType(token.alertType) ?? 'note'
        return `<blockquote class="github-alert" data-alert="${type}"><p class="github-alert-title">${type}</p><div class="github-alert-body">${this.parser.parse(token.tokens ?? [])}</div></blockquote>\n`
      },
    },
  ],
}
