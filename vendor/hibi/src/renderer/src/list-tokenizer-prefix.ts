import {
  type AnyExtension,
  getExtensionField,
  type MarkdownTokenizer,
} from '@tiptap/core'
import {
  ORDERED_LIST_MARKER_PATTERN,
  OrderedList,
  TaskList,
} from '@tiptap/extension-list'

const ordered = getExtensionField<MarkdownTokenizer>(
  OrderedList,
  'markdownTokenizer',
)
const task = getExtensionField<MarkdownTokenizer>(TaskList, 'markdownTokenizer')
// The ordered tokenizer matches its first split line. Task parsing also skips
// leading blank lines. Neither can put a marker or checkbox across a newline.
const orderedPrefix = new RegExp(
  `^[^\\S\\n]*(?:${ORDERED_LIST_MARKER_PATTERN})[.)][^\\S\\n]`,
)
const taskPrefix = /^\s*[-+*][^\S\n]+\[[ xX]\][^\S\n]/

/** Reject ordinary text before native list tokenizers split the remaining source. */
export function guardNativeListTokenizer(extension: AnyExtension) {
  const tokenizer = getExtensionField<MarkdownTokenizer | undefined>(
    extension,
    'markdownTokenizer',
  )
  const prefix =
    tokenizer === ordered
      ? orderedPrefix
      : tokenizer === task
        ? taskPrefix
        : null
  if (!prefix || !tokenizer) return extension
  const tokenize = tokenizer.tokenize
  return extension.extend({
    markdownTokenizer: {
      ...tokenizer,
      tokenize(...args: Parameters<MarkdownTokenizer['tokenize']>) {
        if (!prefix.test(args[0])) return undefined
        return tokenize(...args)
      },
    },
  })
}
