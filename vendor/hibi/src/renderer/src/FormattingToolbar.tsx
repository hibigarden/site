import type { ChainedCommands, Editor } from '@tiptap/core'
import {
  ArrowDownToLine,
  ArrowLeftToLine,
  ArrowRightToLine,
  ArrowUpToLine,
  Bold,
  Code,
  CodeXml,
  Columns2,
  Heading1,
  Heading2,
  Heading3,
  Heading4,
  Heading5,
  Heading6,
  Image,
  Italic,
  Link,
  List,
  ListChecks,
  ListIndentDecrease,
  ListIndentIncrease,
  ListOrdered,
  Minus,
  Pilcrow,
  Quote,
  Redo2,
  Rows2,
  Strikethrough,
  Table,
  Trash2,
  Undo2,
  Unlink,
  WrapText,
} from 'lucide-react'
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'
import type { DocumentFormat } from '../../addons/api'
import { attachmentMarkdown, type MediaAttachment } from '../../shared/media'
import { Button, SettingRow } from '../../ui/Controls'
import { useDialogs } from '../../ui/DialogProvider'
import { useToasts } from '../../ui/Sonner'
import type { ViewMode } from './Editor'
import type { InsertValues, SourceFormatting } from './source-formatting'
import { toolbar } from './toolbar'

type Action = {
  id: string
  label: string
  icon: typeof Bold
  rich: (chain: ChainedCommands, editor: Editor) => ChainedCommands
  active?: string
  attrs?: Record<string, unknown>
  table?: boolean
}
const actions: Action[] = [
  { id: 'undo', label: 'undo', icon: Undo2, rich: (c) => c.undo() },
  { id: 'redo', label: 'redo', icon: Redo2, rich: (c) => c.redo() },
  {
    id: 'bold',
    label: 'bold',
    icon: Bold,
    rich: (c) => c.toggleBold(),
    active: 'bold',
  },
  {
    id: 'italic',
    label: 'italic',
    icon: Italic,
    rich: (c) => c.toggleItalic(),
    active: 'italic',
  },
  {
    id: 'strike',
    label: 'strikethrough',
    icon: Strikethrough,
    rich: (c) => c.toggleStrike(),
    active: 'strike',
  },
  {
    id: 'inline-code',
    label: 'inline code',
    icon: Code,
    rich: (c) => c.toggleCode(),
    active: 'code',
  },
  {
    id: 'paragraph',
    label: 'paragraph',
    icon: Pilcrow,
    rich: (c) => c.setParagraph(),
    active: 'paragraph',
  },
  ...([1, 2, 3, 4, 5, 6] as const).map((level) => ({
    id: `heading-${level}`,
    label: `heading ${level}`,
    icon:
      [Heading1, Heading2, Heading3, Heading4, Heading5, Heading6][level - 1] ??
      Heading1,
    rich: (c: ChainedCommands) => c.toggleHeading({ level }),
    active: 'heading',
    attrs: { level },
  })),
  {
    id: 'bullet-list',
    label: 'bullet list',
    icon: List,
    rich: (c) => c.toggleBulletList(),
    active: 'bulletList',
  },
  {
    id: 'numbered-list',
    label: 'numbered list',
    icon: ListOrdered,
    rich: (c) => c.toggleOrderedList(),
    active: 'orderedList',
  },
  {
    id: 'checklist',
    label: 'checklist',
    icon: ListChecks,
    rich: (c) => c.toggleTaskList(),
    active: 'taskList',
  },
  {
    id: 'indent',
    label: 'indent',
    icon: ListIndentIncrease,
    rich: (c, editor) =>
      c.sinkListItem(editor.isActive('taskList') ? 'taskItem' : 'listItem'),
  },
  {
    id: 'outdent',
    label: 'outdent',
    icon: ListIndentDecrease,
    rich: (c, editor) =>
      c.liftListItem(editor.isActive('taskList') ? 'taskItem' : 'listItem'),
  },
  {
    id: 'quote',
    label: 'quote',
    icon: Quote,
    rich: (c) => c.toggleBlockquote(),
    active: 'blockquote',
  },
  {
    id: 'code-block',
    label: 'code block',
    icon: CodeXml,
    rich: (c) => c.toggleCodeBlock(),
    active: 'codeBlock',
  },
  {
    id: 'divider',
    label: 'divider',
    icon: Minus,
    rich: (c) => c.setHorizontalRule(),
  },
  {
    id: 'hard-break',
    label: 'line break',
    icon: WrapText,
    rich: (c) => c.setHardBreak(),
  },
  {
    id: 'link',
    label: 'link',
    icon: Link,
    rich: (c) => c.setLink({ href: 'https://example.com' }),
    active: 'link',
  },
  {
    id: 'unlink',
    label: 'remove link',
    icon: Unlink,
    rich: (c) => c.unsetLink(),
  },
  {
    id: 'image',
    label: 'image',
    icon: Image,
    rich: (c) => c.setImage({ src: 'image.png' }),
  },
  {
    id: 'table',
    label: 'table',
    icon: Table,
    rich: (c) => c.insertTable({ rows: 3, cols: 2, withHeaderRow: true }),
  },
  {
    id: 'row-before',
    label: 'row above',
    icon: ArrowUpToLine,
    rich: (c) => c.addRowBefore(),
    table: true,
  },
  {
    id: 'row-after',
    label: 'row below',
    icon: ArrowDownToLine,
    rich: (c) => c.addRowAfter(),
    table: true,
  },
  {
    id: 'row-delete',
    label: 'delete row',
    icon: Rows2,
    rich: (c) => c.deleteRow(),
    table: true,
  },
  {
    id: 'column-before',
    label: 'column before',
    icon: ArrowLeftToLine,
    rich: (c) => c.addColumnBefore(),
    table: true,
  },
  {
    id: 'column-after',
    label: 'column after',
    icon: ArrowRightToLine,
    rich: (c) => c.addColumnAfter(),
    table: true,
  },
  {
    id: 'column-delete',
    label: 'delete column',
    icon: Columns2,
    rich: (c) => c.deleteColumn(),
    table: true,
  },
  {
    id: 'table-delete',
    label: 'delete table',
    icon: Trash2,
    rich: (c) => c.deleteTable(),
    table: true,
  },
]

function InsertForm({
  initial,
  close,
}: {
  initial: InsertValues
  close: (value: InsertValues | null) => void
}) {
  const [value, setValue] = useState(initial)
  const input = useRef<HTMLInputElement>(null)
  useEffect(() => {
    input.current?.focus()
  }, [])
  return (
    <form
      className="dialog-form"
      onSubmit={(event) => {
        event.preventDefault()
        close({ ...value, url: value.url.trim() })
      }}
    >
      <div className="settings-group">
        <SettingRow
          id="insert-url"
          label="link destination"
          description="web address, file path, or heading anchor."
        >
          <input
            id="insert-url"
            ref={input}
            required
            value={value.url}
            onChange={(event) =>
              setValue({ ...value, url: event.target.value })
            }
          />
        </SettingRow>
      </div>
      <div className="dialog-actions">
        <Button onClick={() => close(null)}>cancel</Button>
        <Button
          type="submit"
          className="dialog-primary"
          disabled={!value.url.trim()}
        >
          insert
        </Button>
      </div>
    </form>
  )
}

export function useFormattingToolbar(
  editor: Editor | null,
  mode: ViewMode,
  focusedPane: 'rich' | 'source',
  disabled: boolean,
  onAttach: (files: File[] | null) => Promise<MediaAttachment[] | null>,
  markdownMode = true,
  format?: DocumentFormat,
) {
  const dialogs = useDialogs()
  const toasts = useToasts()
  const source = useRef<SourceFormatting | null>(null)
  const latest = useRef({
    editor,
    mode,
    focusedPane,
    disabled,
    dialogs,
    onAttach,
    markdownMode,
    format,
  })
  latest.current = {
    editor,
    mode,
    focusedPane,
    disabled,
    dialogs,
    onAttach,
    markdownMode,
    format,
  }
  const attachFiles = useCallback(
    async (
      files: File[] | null,
      pane?: 'rich' | 'source',
      coords?: { x: number; y: number },
    ) => {
      const { editor, mode, focusedPane, disabled, onAttach } = latest.current
      if (disabled) return
      const useSource =
        (pane ??
          (mode === 'markdown'
            ? 'source'
            : mode === 'normal'
              ? 'rich'
              : focusedPane)) === 'source'
      if (!useSource && !editor?.isEditable) return
      const sourceSelection = useSource ? source.current?.capture(coords) : null
      const document = editor?.state.doc
      const selection = editor?.state.selection
      const position =
        !useSource && coords
          ? editor?.view.posAtCoords({ left: coords.x, top: coords.y })?.pos
          : null
      try {
        const attachments = await onAttach(files)
        if (!attachments) return
        await new Promise(requestAnimationFrame)
        let inserted = false
        if (useSource)
          inserted =
            sourceSelection?.insertMarkdown(
              latest.current.format?.insertMedia?.(attachments) ??
                attachmentMarkdown(attachments),
            ) ?? false
        else if (
          editor &&
          !editor.isDestroyed &&
          editor.isEditable &&
          editor.state.doc === document &&
          selection
        ) {
          inserted = editor
            .chain()
            .focus()
            .command(({ tr }) => {
              if (position == null) tr.setSelection(selection)
              return true
            })
            .insertContentAt(
              position ?? { from: selection.from, to: selection.to },
              attachments.map(({ url, alt }) => ({
                type: 'image',
                attrs: { src: url, alt },
              })),
            )
            .run()
        }
        if (!inserted)
          throw new Error(
            'the note changed before insertion. copied files remain in assets; drop them again to insert.',
          )
      } catch (error) {
        toasts.show({
          message:
            error instanceof Error ? error.message : 'could not attach media.',
          variant: 'error',
        })
      }
    },
    [toasts],
  )
  const refresh = useRef(() => {})
  const attachSource = useCallback((value: SourceFormatting | null) => {
    const initial = !source.current
    source.current = value
    refresh.current()
    if (initial && latest.current.mode === 'markdown') value?.focus()
  }, [])
  useLayoutEffect(() => {
    const scope = toolbar.scope('format', (error) =>
      console.error('formatting failed:', error),
    )
    const inSource = () =>
      latest.current.mode === 'markdown' ||
      (latest.current.mode === 'side-by-side' &&
        latest.current.focusedPane === 'source')
    async function run(action: Action) {
      const { editor, dialogs, disabled } = latest.current
      if (disabled) return
      const useSource = inSource()
      if (action.id === 'image') {
        await attachFiles(null)
      } else if (action.id === 'link') {
        const sourceSelection = useSource ? source.current?.capture() : null
        const document = editor?.state.doc
        const selection = editor?.state.selection
        const result = await dialogs.open<InsertValues>({
          title: 'insert link',
          content: ({ close }) => (
            <InsertForm
              initial={{
                url:
                  !useSource && action.id === 'link'
                    ? (editor?.getAttributes('link').href ?? '')
                    : '',
                alt:
                  sourceSelection?.text ??
                  (editor && selection
                    ? editor.state.doc.textBetween(selection.from, selection.to)
                    : ''),
              }}
              close={close}
            />
          ),
        }).result
        if (!result) return
        if (useSource) {
          sourceSelection?.run(action.id, result)
          return
        }
        if (
          !editor ||
          editor.isDestroyed ||
          !editor.isEditable ||
          editor.state.doc !== document ||
          !selection
        )
          return
        const chain = editor
          .chain()
          .focus()
          .command(({ tr }) => {
            tr.setSelection(selection)
            return true
          })
        if (selection.empty && !editor.isActive('link'))
          chain
            .insertContent({
              type: 'text',
              text: result.url,
              marks: [{ type: 'link', attrs: { href: result.url } }],
            })
            .run()
        else chain.extendMarkRange('link').setLink({ href: result.url }).run()
      } else if (useSource) source.current?.run(action.id)
      else if (editor?.isEditable) {
        action.rich(editor.chain().focus(), editor).run()
      }
    }
    const handles = actions.map((action) =>
      scope.api.register({
        id: action.id,
        label: action.label,
        icon: action.icon,
        onClick: () => run(action),
      }),
    )
    refresh.current = () => {
      const { editor, disabled } = latest.current
      const useSource = inSource()
      const canFormat = (action: Action, editor: Editor) => {
        try {
          return action.rich(editor.can().chain(), editor).run()
        } catch {
          return false /* This flavor does not provide the requested node or mark. */
        }
      }
      actions.forEach((action, index) => {
        const state = useSource
          ? source.current?.state(action.id)
          : editor && !editor.isDestroyed
            ? {
                pressed:
                  !!action.active &&
                  editor.isActive(action.active, action.attrs),
                disabled: !editor.isEditable || !canFormat(action, editor),
              }
            : null
        handles[index]?.update({
          ...(action.active ? { pressed: state?.pressed ?? false } : {}),
          disabled: disabled || !state || state.disabled,
          hidden:
            (!latest.current.markdownMode &&
              ![
                'undo',
                'redo',
                'indent',
                'outdent',
                ...(latest.current.format?.insertMedia ? ['image'] : []),
              ].includes(action.id)) ||
            (!!action.table && (useSource || !editor?.isActive('table'))),
        })
      })
    }
    refresh.current()
    return () => {
      refresh.current = () => {}
      scope.dispose()
    }
  }, [attachFiles])
  useLayoutEffect(() => {
    const update = () => refresh.current()
    editor?.on('transaction', update)
    update()
    return () => {
      editor?.off('transaction', update)
    }
  }, [editor])
  // biome-ignore lint/correctness/useExhaustiveDependencies: the refresh function reads the current editor context from a ref.
  useLayoutEffect(() => {
    refresh.current()
  }, [mode, focusedPane, disabled, markdownMode, format])
  const previousMode = useRef(mode)
  useLayoutEffect(() => {
    if (previousMode.current === mode) return
    previousMode.current = mode
    if (
      mode === 'markdown' ||
      (mode === 'side-by-side' && focusedPane === 'source')
    )
      source.current?.focus()
    // Tiptap's focus command defers to a frame and can override a newer click into source.
    else if (editor && !editor.isDestroyed) editor.view.focus()
  }, [mode, focusedPane, editor])
  return { attachSource, attachFiles }
}
