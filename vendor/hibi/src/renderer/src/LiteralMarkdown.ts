import { Node } from '@tiptap/core'

/** Disabled formatting remains editable source text and round-trips without added escapes. */
export const literalMarkdown = ['block', 'inline'].map((level) =>
  Node.create({
    name: level === 'block' ? 'hibiLiteralBlock' : 'hibiLiteralInline',
    group: level,
    inline: level === 'inline',
    content: 'text*',
    marks: '',
    code: true,
    defining: true,
    parseHTML: () => [{ tag: `[data-literal-markdown="${level}"]` }],
    renderHTML: () => [
      level === 'block' ? 'div' : 'span',
      { 'data-literal-markdown': level, class: `hibi-literal-${level}` },
      0,
    ],
    markdownTokenName:
      level === 'block' ? 'hibiLiteralBlock' : 'hibiLiteralInline',
    parseMarkdown: (token, helpers) =>
      helpers.createNode(
        level === 'block' ? 'hibiLiteralBlock' : 'hibiLiteralInline',
        undefined,
        token.text ? [helpers.createTextNode(token.text)] : [],
      ),
    renderMarkdown: (node) =>
      (node.content ?? []).map((child) => child.text ?? '').join(''),
  }),
)
