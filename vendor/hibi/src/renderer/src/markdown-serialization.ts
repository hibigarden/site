import {
  type AnyExtension,
  callOrReturn,
  decodeHtmlEntities,
  flattenExtensions,
  getExtensionField,
  type JSONContent,
  type MarkdownRendererHelpers,
  type RenderContext,
} from '@tiptap/core'
import { ORDERED_LIST_MARKER_PATTERN } from '@tiptap/extension-list'
import type { MarkdownManager } from '@tiptap/markdown'
import type { Node } from '@tiptap/pm/model'
import type { Marked } from 'marked'
import type { MarkdownFlavor, MarkdownParagraphRule } from '../../addons/api'
import {
  configureMarkdownEntities,
  maskParagraphText,
} from './markdown-entities.ts'

const orderedPrefix = new RegExp(
  `^( {0,3}(?:${ORDERED_LIST_MARKER_PATTERN}))([.)])(?=[^\\S\\n])`,
)

/** Capture the active parser and flavor rules once per Markdown configuration. */
export function paragraphEscaper(
  parser: Marked,
  flavors: readonly MarkdownFlavor[],
) {
  const rules: { flavor: string; rule: MarkdownParagraphRule }[] = [
    {
      flavor: 'core.entities',
      rule: {
        characters: '!',
        escape(source, { literals }) {
          for (const [sentinel, character] of literals)
            if (character === '!')
              source = source.replaceAll(`${sentinel}[`, '\\![')
          return source
        },
      },
    },
    ...flavors.flatMap((flavor) =>
      (flavor.paragraphRules ?? []).map((rule) => ({
        flavor: flavor.id,
        rule,
      })),
    ),
  ]
  const characters = [
    ...new Set(rules.flatMap(({ rule }) => [...(rule.characters ?? '')])),
  ]
  const verbatim = new Set([
    'code',
    ...flattenExtensions(
      flavors.flatMap((flavor) => flavor.richExtensions ?? []),
    )
      .filter((extension) => callOrReturn(getExtensionField(extension, 'code')))
      .map((extension) => extension.name),
  ])
  const needsMasking = (child: JSONContent) =>
    child.type === 'text' &&
    !child.marks?.some((mark) =>
      verbatim.has(typeof mark === 'string' ? mark : mark.type),
    ) &&
    characters.some((character) => child.text?.includes(character))
  return (
    node: JSONContent,
    helpers: MarkdownRendererHelpers,
    ctx: RenderContext,
  ): string => {
    let content = node.content ?? []
    const literals = new Map<string, string>()
    let prefix = ''
    if (characters.length && content.some(needsMasking)) {
      prefix = '\uE000'
      const hasPrefix = (value: unknown): boolean =>
        typeof value === 'string'
          ? value.includes(prefix)
          : !!value &&
            typeof value === 'object' &&
            Object.values(value).some(hasPrefix)
      while (content.some(hasPrefix)) prefix += '\uE000'
      const sentinels = new Map(
        characters.map((character, index) => {
          const digits = Array.from(index.toString(36), (digit) =>
            String.fromCharCode(0xe002 + Number.parseInt(digit, 36)),
          ).join('')
          const sentinel = `${prefix}${digits}\uE001`
          literals.set(sentinel, character)
          return [character, sentinel]
        }),
      )
      content = content.map((child) =>
        needsMasking(child) && child.text
          ? maskParagraphText(
              child,
              [...child.text]
                .map((character) => sentinels.get(character) ?? character)
                .join(''),
            )
          : child,
      )
    }
    const restore = (value: string) => {
      for (const [sentinel, character] of literals)
        value = value.replaceAll(sentinel, character)
      return value
    }
    let source = helpers.renderChildren(content)
    for (const { flavor, rule } of rules) {
      try {
        const next = rule.escape(source, {
          parentType: ctx.parentType ?? null,
          literals,
        })
        if (typeof next !== 'string') throw new Error('Expected Markdown text.')
        if (prefix) {
          const restored = restore(next)
          if (restored.includes(prefix))
            throw new Error('Unresolved paragraph sentinel.')
          const before = decodeHtmlEntities(restore(source))
          const after = decodeHtmlEntities(restored)
          for (const character of literals.values())
            if (after.split(character).length < before.split(character).length)
              throw new Error('Dropped a protected paragraph character.')
        }
        source = next
      } catch (cause) {
        throw new Error(
          `Markdown paragraph rule failed for flavor "${flavor}".`,
          {
            cause,
          },
        )
      }
    }
    source = restore(source)
    if (ctx.parentType === 'table') return source
    return escapeBlockPrefixes(source, parser)
  }
}

/** Keep native table layout while routing every cell paragraph through its renderer. */
export function renderTableParagraphs(extension: AnyExtension): AnyExtension {
  if (extension.name === 'table')
    return extension.extend({
      renderMarkdown(node, helpers, ctx) {
        return (
          this.parent?.(
            node,
            {
              ...helpers,
              renderChildren: (children, separator) =>
                helpers.renderChildren(
                  !Array.isArray(children) && children.type === 'paragraph'
                    ? [children]
                    : children,
                  separator,
                ),
            },
            ctx,
          ) ?? ''
        )
      },
    })
  if (!getExtensionField(extension, 'addExtensions')) return extension
  return extension.extend({
    addExtensions() {
      return this.parent?.().map(renderTableParagraphs) ?? []
    },
  })
}

/** Finish inline escaping with the syntax that only has meaning at block starts. */
function escapeBlockPrefixes(source: string, parser: Marked) {
  // Indented code cannot interrupt a paragraph; only its first line needs this.
  if (/^(?: {4}| {0,3}\t)/.test(source))
    source = (source[0] === ' ' ? '&#32;' : '&#9;') + source.slice(1)
  const lines = source.split('\n')
  for (const [index, value] of lines.entries()) {
    let line = value
    // Tiptap already escapes *, _, backticks, ~, brackets, and HTML characters.
    if (
      /^ {0,3}(?:#{1,6}(?=\s|$)|[-+](?=[ \t]|$)|-(?:[ \t]*-){2,}[ \t]*$)/.test(
        line,
      )
    )
      line = line.replace(/^( *)/, '$1\\')
    else
      line = line
        .replace(orderedPrefix, '$1\\$2')
        .replace(/^( {0,3}\d+)([.)])$/, '$1\\$2')
    const previous = lines[index - 1]
    if (previous?.trim()) {
      if (/^ {0,3}(?:=+|-+)[ \t]*$/.test(line))
        line = line.replace(/^( *)/, '$1\\')
      else if (
        parser.defaults.gfm &&
        /^ {0,3}[|:\t -]*-[|:\t -]*$/.test(line) &&
        parser
          .lexer(`${previous}\n${line}`)
          .some((token) => token.type === 'table')
      )
        line = line.replace('-', '\\-')
    }
    lines[index] = line
  }
  return lines.join('\n')
}

/** Block caching is opt-in: arbitrary addon serializers may depend on the whole document. */
export function markdownSerializer(
  manager: MarkdownManager,
  blockLocal: boolean,
) {
  configureMarkdownEntities(manager)
  const json = new WeakMap<Node, JSONContent>()
  const blocks = new WeakMap<
    Node,
    {
      previous: Node | undefined
      index: number
      attributes: Node['attrs']
      source: string
    }
  >()
  const asJSON = (node: Node) => {
    const cached = json.get(node)
    if (cached) return cached
    const value: JSONContent = node.toJSON()
    json.set(node, value)
    return value
  }
  return (doc: Node) => {
    const children: Node[] = []
    doc.forEach((node) => {
      children.push(node)
    })
    if (
      !blockLocal ||
      doc.marks.length ||
      children.some((node) => node.marks.length)
    ) {
      const source = manager.serialize(doc.toJSON())
      return {
        source,
        rendered: children.length,
        blocks: null,
      }
    }
    const parent: JSONContent = {
      type: doc.type.name,
      ...(Object.keys(doc.attrs).length ? { attrs: doc.attrs } : {}),
      content: children.map(asJSON),
    }
    let rendered = 0
    const parts = children.map((node, index) => {
      const previous = children[index - 1]
      let cached = blocks.get(node)
      if (
        !cached ||
        cached.previous !== previous ||
        cached.index !== index ||
        cached.attributes !== doc.attrs
      ) {
        const source = manager.renderNodeToMarkdown(
          asJSON(node),
          parent,
          index,
          0,
        )
        cached = {
          previous,
          index,
          attributes: doc.attrs,
          source,
        }
        blocks.set(node, cached)
        rendered++
      }
      return cached
    })
    const joined = parts.map((block) => block.source).join('\n\n')
    // Match the manager's empty-document normalization, including blank paragraphs.
    const source = /^[ \t\r\n]*$/.test(joined) ? '' : joined
    return { source, rendered, blocks: parts }
  }
}
