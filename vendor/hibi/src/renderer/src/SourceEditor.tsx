import {
  defaultKeymap,
  history,
  historyKeymap,
  selectAll,
} from '@codemirror/commands'
import { markdown as markdownLanguage } from '@codemirror/lang-markdown'
import {
  HighlightStyle,
  type Language,
  syntaxHighlighting,
  syntaxTree,
} from '@codemirror/language'
import {
  closeSearchPanel,
  findNext,
  findPrevious,
  getSearchQuery,
  openSearchPanel,
  SearchQuery,
  search,
  setSearchQuery,
} from '@codemirror/search'
import {
  Annotation,
  Compartment,
  EditorState,
  Transaction,
} from '@codemirror/state'
import { EditorView, keymap, lineNumbers, placeholder } from '@codemirror/view'
import { tags } from '@lezer/highlight'
import { marked } from 'marked'
import { useEffect, useRef } from 'react'
import type { SourceExtension } from '../../addons/api'
import { codeHighlighter, codeLanguages } from './code-languages'
import type { FindMove, FindStatus } from './FindBar'
import {
  formattingKeymap,
  type SourceFormatting,
  sourceFormatting,
} from './source-formatting'

const externalChange = Annotation.define<boolean>()
const highlighting = HighlightStyle.define([
  { tag: tags.heading, color: 'var(--syntax-heading)', fontWeight: '600' },
  { tag: tags.strong, color: 'var(--syntax-strong)', fontWeight: '600' },
  { tag: tags.emphasis, color: 'var(--syntax-emphasis)', fontStyle: 'italic' },
  { tag: [tags.link, tags.url], color: 'var(--syntax-link)' },
  { tag: tags.monospace, color: 'var(--syntax-code)' },
  { tag: [tags.meta, tags.processingInstruction], color: 'var(--syntax-meta)' },
  { tag: tags.quote, color: 'var(--syntax-quote)' },
  { tag: tags.strikethrough, textDecoration: 'line-through' },
])

export function SourceEditor({
  markdownMode,
  sourceLanguage,
  label,
  active,
  onReady,
  value,
  onChange,
  disabled,
  externalRevision,
  findActive,
  findQuery,
  findMove,
  onFindStatus,
  showLineNumbers,
  sourceExtensions,
  onFormatting,
  onLink,
}: {
  markdownMode: boolean
  sourceLanguage: Language | undefined
  label: string
  active: boolean
  onReady: () => void
  value: string
  onChange: (value: string) => void
  disabled: boolean
  externalRevision: number
  findActive: boolean
  findQuery: string
  findMove: FindMove
  onFindStatus: (status: FindStatus) => void
  showLineNumbers: boolean
  sourceExtensions: readonly SourceExtension[]
  onFormatting: (formatting: SourceFormatting | null) => void
  onLink: (href: string) => void
}) {
  const parserOptions = useRef({ markdownMode, sourceLanguage, label })
  parserOptions.current = { markdownMode, sourceLanguage, label }
  const configureParser = useRef(() => {})
  // biome-ignore lint/correctness/useExhaustiveDependencies: parser configuration reads these current values through parserOptions.
  useEffect(() => {
    configureParser.current()
  }, [markdownMode, sourceLanguage, label])
  const host = useRef<HTMLDivElement>(null)
  const view = useRef<EditorView | null>(null)
  const change = useRef(onChange)
  const initialValue = useRef(value)
  const appliedRevision = useRef(externalRevision)
  const editable = useRef(new Compartment())
  const numbers = useRef(new Compartment())
  const addons = useRef(new Compartment())
  const find = useRef({ active: findActive, report: onFindStatus })
  const handledFindMove = useRef(findMove.id)
  const ready = useRef(onReady)
  const formatting = useRef<SourceFormatting | null>(null)
  const reportFormatting = useRef(onFormatting)
  const openLink = useRef(onLink)
  openLink.current = onLink
  reportFormatting.current = onFormatting
  ready.current = onReady
  find.current = { active: findActive, report: onFindStatus }
  change.current = onChange

  useEffect(() => {
    if (!host.current) return
    const language = new Compartment()
    const markdown = () => {
      const { markdownMode, sourceLanguage, label } = parserOptions.current
      return [
        markdownMode
          ? markdownLanguage({ codeLanguages: codeLanguages.resolve })
          : (sourceLanguage ?? []),
        markdownMode ? keymap.of(formattingKeymap) : [],
        EditorView.contentAttributes.of({
          'aria-label': markdownMode ? 'markdown editor' : `${label} editor`,
        }),
      ]
    }
    const editor = new EditorView({
      parent: host.current,
      state: EditorState.create({
        doc: initialValue.current,
        extensions: [
          addons.current.of([]),
          search({
            createPanel: () => {
              const dom = window.document.createElement('div')
              dom.hidden = true
              return { dom }
            },
          }),
          editable.current.of(EditorView.editable.of(true)),
          numbers.current.of([]),
          language.of(markdown()),
          history(),
          EditorView.domEventHandlers({
            click(event, view) {
              if (!event.shiftKey || !parserOptions.current.markdownMode)
                return false
              const position = view.posAtCoords({
                x: event.clientX,
                y: event.clientY,
              })
              if (position == null) return false
              let node = syntaxTree(view.state).resolveInner(position, -1)
              while (node.parent && !['Link', 'Autolink'].includes(node.name))
                node = node.parent
              if (!['Link', 'Autolink'].includes(node.name)) return false
              let href = ''
              marked.walkTokens(
                marked.lexer(view.state.sliceDoc(node.from, node.to)),
                (token) => {
                  if (token.type === 'link') href = token.href
                },
              )
              if (!href) return false
              event.preventDefault()
              openLink.current(href)
              return true
            },
          }),
          keymap.of([
            { key: 'Ctrl-a', run: selectAll },
            ...defaultKeymap,
            ...historyKeymap,
          ]),
          syntaxHighlighting(highlighting),
          syntaxHighlighting(codeHighlighter),
          EditorView.lineWrapping,
          placeholder('start typing'),
          EditorView.contentAttributes.of({
            spellcheck: 'false',
          }),
          EditorView.updateListener.of((update) => {
            if (
              update.docChanged ||
              update.selectionSet ||
              update.transactions.some(
                (transaction) => transaction.effects.length,
              )
            )
              reportFormatting.current(formatting.current)
            if (find.current.active) {
              const query = getSearchQuery(update.state)
              let total = 0
              let current = 0
              if (query.valid) {
                const cursor = query.getCursor(update.state)
                for (
                  let match = cursor.next();
                  !match.done;
                  match = cursor.next()
                ) {
                  total += 1
                  if (
                    match.value.from === update.state.selection.main.from &&
                    match.value.to === update.state.selection.main.to
                  )
                    current = total
                }
              }
              find.current.report({ current, total })
            }
            if (
              update.docChanged &&
              !update.transactions.some((transaction) =>
                transaction.annotation(externalChange),
              )
            ) {
              change.current(update.state.doc.toString())
            }
          }),
        ],
      }),
    })
    view.current = editor
    configureParser.current = () =>
      editor.dispatch({ effects: language.reconfigure(markdown()) })
    const unsubscribe = codeLanguages.subscribe(() =>
      editor.dispatch({ effects: language.reconfigure(markdown()) }),
    )
    formatting.current = sourceFormatting(editor)
    reportFormatting.current(formatting.current)
    let disposed = false
    const measure = () => {
      if (!disposed)
        editor.requestMeasure({
          read: () => null,
          write: () => ready.current(),
        })
    }
    void window.document.fonts.load('13px "Geist Mono"').then(measure, measure)
    return () => {
      unsubscribe()
      configureParser.current = () => {}
      disposed = true
      formatting.current = null
      reportFormatting.current(null)
      editor.destroy()
      view.current = null
    }
  }, [])

  useEffect(() => {
    let canceled = false
    const editor = view.current
    void Promise.all(
      sourceExtensions.map((extension) => extension.create()),
    ).then((extensions) => {
      if (!canceled && editor)
        editor.dispatch({ effects: addons.current.reconfigure(extensions) })
    })
    return () => {
      canceled = true
    }
  }, [sourceExtensions])

  useEffect(() => {
    // Only reconcile edits from the other pane; never replay our own stale props.
    if (!active || appliedRevision.current === externalRevision) return
    appliedRevision.current = externalRevision
    const editor = view.current
    if (editor && editor.state.doc.toString() !== value) {
      editor.dispatch({
        changes: { from: 0, to: editor.state.doc.length, insert: value },
        annotations: [
          externalChange.of(true),
          Transaction.addToHistory.of(false),
        ],
      })
    }
  }, [active, value, externalRevision])

  useEffect(() => {
    view.current?.dispatch({
      effects: editable.current.reconfigure([
        EditorView.editable.of(!disabled),
        EditorState.readOnly.of(disabled),
      ]),
    })
  }, [disabled])

  useEffect(() => {
    view.current?.dispatch({
      effects: numbers.current.reconfigure(
        showLineNumbers
          ? lineNumbers({
              domEventHandlers: {
                mousedown(view, line, event) {
                  event.preventDefault()
                  const text = view.state.doc.lineAt(line.from)
                  view.dispatch({
                    selection: { anchor: text.from, head: text.to },
                  })
                  view.focus()
                  return true
                },
              },
            })
          : [],
      ),
    })
  }, [showLineNumbers])

  useEffect(() => {
    const editor = view.current
    if (!editor) return
    if (!findActive) {
      closeSearchPanel(editor)
      return
    }
    openSearchPanel(editor)
    const query = new SearchQuery({ search: findQuery, literal: true })
    editor.dispatch({ effects: setSearchQuery.of(query) })
    const first = query.valid ? query.getCursor(editor.state).next() : null
    if (first && !first.done)
      editor.dispatch({
        selection: { anchor: first.value.from, head: first.value.to },
        scrollIntoView: true,
      })
  }, [findActive, findQuery])

  useEffect(() => {
    if (handledFindMove.current === findMove.id) return
    handledFindMove.current = findMove.id
    if (findActive && view.current && findMove.id)
      (findMove.direction === 'next' ? findNext : findPrevious)(view.current)
  }, [findActive, findMove])

  return <div className="source-editor" ref={host} />
}
