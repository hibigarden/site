import { Strike } from '@tiptap/extension-strike'
import { TableKit } from '@tiptap/extension-table'
import { TaskItem } from '@tiptap/extension-task-item'
import { TaskList } from '@tiptap/extension-task-list'
import { Marked } from 'marked'
import { defineAddon, type MarkdownFlavor } from '../api'
import { GithubAlert } from './Alert'
import { alertMarkdown, alertMarker } from './alerts'
import css from './alerts.css?inline'
import manifest from './manifest'

const parser = new Marked({ gfm: true })
const flavor: MarkdownFlavor = {
  id: 'github',
  name: 'github markdown',
  kind: 'dialect',
  description:
    'alerts, tables, task lists, strikethrough, and automatic links.',
  detect(source) {
    let found = false
    parser.walkTokens(parser.lexer(source), (token) => {
      if (
        token.type === 'table' ||
        token.type === 'del' ||
        (token.type === 'blockquote' && alertMarker(token.text)) ||
        (token.type === 'list_item' && token.task) ||
        (token.type === 'link' && !token.raw.startsWith('['))
      )
        found = true
    })
    return found
  },
  markedOptions: { gfm: true },
  richExtensions: [
    GithubAlert,
    Strike,
    TableKit.configure({ table: { resizable: false } }),
    TaskList,
    TaskItem.configure({ nested: true }),
  ],
  export: { extensions: [alertMarkdown], css },
}
export default defineAddon({
  manifest,
  flavors: [flavor],
  start(context) {
    context.styles.register('alerts', css)
    context.editor.registerFlavor(flavor)
  },
})
