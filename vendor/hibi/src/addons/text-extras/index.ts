import { defineAddon, type MarkdownFlavor } from '../api'
import manifest from './manifest'
import { Subscript, Subtext } from './nodes'
import css from './styles.css?inline'
import { detectTextExtras, textExtrasMarkdown } from './syntax'

const flavor: MarkdownFlavor = {
  id: 'text-extras',
  name: 'text extras',
  kind: 'syntax',
  description: '~subscript~ and -# small text.',
  detect: detectTextExtras,
  richExtensions: [Subscript, Subtext],
  export: { extensions: [textExtrasMarkdown], css },
}
export default defineAddon({
  manifest,
  flavors: [flavor],
  start(context) {
    context.editor.registerFlavor(flavor)
    context.styles.register('text-extras', css)
    for (const id of ['subscript', 'subtext'] as const)
      context.editor.registerSyntax({
        id,
        label: id === 'subscript' ? 'subscript' : 'small text',
        group: 'text extras',
        description: id === 'subscript' ? 'H~2~O' : '-# small text',
        level: id === 'subscript' ? 'inline' : 'block',
        extensions: [id],
        matches: (token) => token.type === id,
      })
  },
})
