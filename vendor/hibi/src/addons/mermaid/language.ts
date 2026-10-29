import { StreamLanguage } from '@codemirror/language'
export const mermaidLanguage = StreamLanguage.define({
  name: 'mermaid',
  token(stream) {
    if (stream.eatSpace()) return null
    if (stream.match('%%')) {
      stream.skipToEnd()
      return 'comment'
    }
    if (stream.match(/^"(?:[^"\\]|\\.)*"/)) return 'string'
    if (
      stream.match(
        /^(?:flowchart|graph|sequenceDiagram|classDiagram|stateDiagram(?:-v2)?|erDiagram|journey|gantt|pie|gitGraph|mindmap|timeline|quadrantChart|xychart(?:-beta)?|block(?:-beta)?|architecture-beta|subgraph|end|participant|actor|loop|alt|else|opt|par|and|rect|note|Note|title|section|direction|classDef|class|style|click|LR|RL|TB|TD|BT)\b/,
      )
    )
      return 'keyword'
    if (stream.match(/^(?:--?>|==>|-\.->|--|::|[{}()[\]:;,|])/))
      return 'operator'
    if (stream.match(/^\d+(?:\.\d+)?\b/)) return 'number'
    stream.next()
    return null
  },
  languageData: { commentTokens: { line: '%%' } },
})
