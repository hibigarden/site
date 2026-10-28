import { StreamLanguage } from '@codemirror/language'

/** Lightweight source highlighting; the Typst compiler supplies syntax diagnostics. */
export const typstLanguage = StreamLanguage.define({
  name: 'typst',
  startState: () => ({ comment: 0, string: false, raw: 0, math: false }),
  token(stream, state) {
    if (state.comment) {
      while (!stream.eol()) {
        if (stream.match('/*')) state.comment++
        else if (stream.match('*/')) {
          if (!--state.comment) break
        } else stream.next()
      }
      return 'comment'
    }
    if (state.raw) {
      if (stream.match('`'.repeat(state.raw))) state.raw = 0
      else stream.next()
      return 'monospace'
    }
    if (stream.eatSpace()) return null
    if (stream.match('//')) {
      stream.skipToEnd()
      return 'comment'
    }
    if (stream.match('/*')) {
      state.comment = 1
      return 'comment'
    }
    const raw = stream.match(/^`+/)
    if (raw && typeof raw !== 'boolean') {
      state.raw = raw[0].length
      return 'monospace'
    }
    if (state.string || stream.eat('"')) {
      state.string = true
      while (!stream.eol()) {
        const char = stream.next()
        if (char === '\\') stream.next()
        else if (char === '"') {
          state.string = false
          break
        }
      }
      return 'string'
    }
    if (stream.sol() && stream.match(/^=+\s.*/)) return 'heading'
    if (stream.eat('$')) {
      state.math = !state.math
      return 'operator'
    }
    if (
      stream.match(
        /^#?(?:let|set|show|if|else|for|in|while|break|continue|return|import|include|as|context|none|auto|true|false|and|or|not)\b/,
      )
    )
      return 'keyword'
    if (stream.match(/^#[\p{L}_][\p{L}\p{N}_-]*/u))
      return 'function(variableName)'
    if (stream.match(/^\d+(?:\.\d+)?(?:pt|mm|cm|in|em|deg|rad|%|fr)?\b/))
      return 'number'
    if (state.math && stream.match(/^[a-z][a-z0-9_-]*/i)) return 'variableName'
    if (stream.match(/^<[^>\n]+>/) || stream.match(/^@[\w:-]+/))
      return 'labelName'
    if (stream.match(/^[+\-*/=_<>!&|:#()[\]{},;.]/)) return 'operator'
    stream.next()
    return null
  },
  languageData: {
    commentTokens: { line: '//', block: { open: '/*', close: '*/' } },
    closeBrackets: { brackets: ['(', '[', '{', '"'] },
  },
})
