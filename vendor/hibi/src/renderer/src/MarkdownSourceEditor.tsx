import {
  commonmarkLanguage,
  markdown,
  markdownLanguage,
} from '@codemirror/lang-markdown'
import type { MarkdownParser } from '@lezer/markdown'
import type { ComponentProps } from 'react'
import { createPlainTextRunExtension } from '../../shared/markdown-plain-text-runs'
import { SourceEditor } from './SourceEditor'

const sourceMarkdown: typeof markdown = (options = {}) => {
  if (
    options.extensions ||
    (options.base &&
      options.base !== commonmarkLanguage &&
      options.base !== markdownLanguage)
  )
    return markdown(options)
  const runs = createPlainTextRunExtension(),
    support = markdown({ ...options, extensions: runs.extension })
  // markdown() adds mixed code/HTML parsing before returning the final parser.
  runs.allow(support.language.parser as MarkdownParser)
  return support
}

/** Markdown's source support includes list keymaps and HTML completion. */
export function MarkdownSourceEditor(
  props: Omit<ComponentProps<typeof SourceEditor>, 'markdownLanguage'>,
) {
  return <SourceEditor {...props} markdownLanguage={sourceMarkdown} />
}
