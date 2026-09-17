import { AllSelection, TextSelection } from '@tiptap/pm/state'
import { EditorContent, useEditor } from '@tiptap/react'
import {
  findNext,
  findPrev,
  getMatchHighlights,
  SearchQuery,
  setSearchState,
} from 'prosemirror-search'
import {
  lazy,
  Suspense,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import type {
  DocumentFormat,
  MarkdownExtension,
  MarkdownFlavor,
  RichExtension,
  SourceExtension,
} from '../../addons/api'
import type { DocumentState } from '../../shared/desktop'
import { isMarkdownDocument } from '../../shared/document-types'
import { isMediaFile } from '../../shared/media'
import { documentImage } from './DocumentImage'
import { type CursorSettings, EditorCursor } from './EditorCursor'
import { emitEditorKeyEvent } from './editor-events'
import { FindBar, type FindMove, type FindStatus } from './FindBar'
import { useFormattingToolbar } from './FormattingToolbar'
import { LoadingScreen } from './LoadingScreen'
import { linkScroll } from './linked-scroll'
import { MirrorCursor } from './MirrorCursor'
import {
  editorExtensions,
  needsSourceEditing,
  projectMarkdown,
} from './markdown'

const SourceEditor = lazy(() =>
  import('./SourceEditor').then((module) => ({ default: module.SourceEditor })),
)

export type ViewMode = 'normal' | 'side-by-side' | 'markdown'

export function MarkdownEditor({
  document: documentState,
  format,
  formatName,
  value,
  onChange,
  mode,
  disabled,
  findOpen,
  onCloseFind,
  markdownExtensions,
  sourceExtensions,
  richExtensions,
  cursorSettings,
  showLineNumbers,
  documentRevision,
  flavors,
  unsupportedFlavor,
  onAttach,
  onLink,
}: {
  document: DocumentState
  format: DocumentFormat | undefined
  formatName: string
  value: string
  onChange: (value: string) => void
  mode: ViewMode
  disabled: boolean
  findOpen: boolean
  onCloseFind: () => void
  markdownExtensions: readonly MarkdownExtension[]
  sourceExtensions: readonly SourceExtension[]
  richExtensions: readonly RichExtension[]
  cursorSettings: CursorSettings
  showLineNumbers: boolean
  documentRevision: number
  flavors: readonly MarkdownFlavor[]
  unsupportedFlavor: boolean
  onAttach: (
    files: File[] | null,
  ) => Promise<import('../../shared/media').MediaAttachment[] | null>
  onLink: (href: string) => void
}) {
  const markdownDocument = isMarkdownDocument(documentState.name)
  const projection = useMemo(
    () =>
      markdownDocument
        ? projectMarkdown(value, markdownExtensions)
        : { content: '', serialize: () => value, readOnly: true },
    [value, markdownExtensions, markdownDocument],
  )
  const sourceOnly = useMemo(
    () =>
      unsupportedFlavor ||
      Boolean(projection.readOnly) ||
      needsSourceEditing(projection.content),
    [projection, unsupportedFlavor],
  )
  const [richRevision, setRichRevision] = useState(0)
  const [findQuery, setFindQuery] = useState('')
  const [findStatus, setFindStatus] = useState<FindStatus>({
    current: 0,
    total: 0,
  })
  const [findMove, setFindMove] = useState<FindMove>({
    id: 0,
    direction: 'next',
  })
  const handledFindMove = useRef(0)
  const [focusedPane, setFocusedPane] = useState<'rich' | 'source'>('rich')
  const findTarget = !markdownDocument
    ? 'source'
    : mode === 'normal'
      ? 'rich'
      : mode === 'markdown'
        ? 'source'
        : focusedPane
  const [sourceMounted, setSourceMounted] = useState(mode !== 'normal')
  const [sourceReady, setSourceReady] = useState(false)
  const [initialMode] = useState(mode)
  // A new document starts in the selected view. Only a first opening from
  // normal view waits for source layout before beginning the pane transition.
  const paneMode = sourceReady || initialMode !== 'normal' ? mode : 'normal'
  const content = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!markdownDocument && sourceReady && mode !== 'normal') {
      setFocusedPane('source')
      content.current?.querySelector<HTMLElement>('.cm-content')?.focus()
    }
  }, [markdownDocument, sourceReady, mode])
  useEffect(() => {
    if (paneMode !== 'side-by-side' || !sourceReady) return
    const rich = content.current?.querySelector<HTMLElement>('.rich-pane')
    const source = content.current?.querySelector<HTMLElement>('.cm-scroller')
    if (!rich || !source) return
    return linkScroll(
      rich,
      source,
      source.contains(window.document.activeElement) ? source : rich,
    )
  }, [paneMode, sourceReady])
  const previousMode = useRef(paneMode)
  useLayoutEffect(() => {
    if (previousMode.current === paneMode) return
    previousMode.current = paneMode
    const element = content.current
    if (!element) return
    const opacity = Number(getComputedStyle(element).opacity)
    for (const animation of element.getAnimations()) animation.cancel()
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const duration = getComputedStyle(element)
      .getPropertyValue('--motion-feedback')
      .trim()
    element.animate(
      [
        { opacity, offset: 0 },
        { opacity: 0, offset: 0.25 },
        { opacity: 0, offset: 0.625 },
        { opacity: 1, offset: 1 },
      ],
      {
        duration:
          Number.parseFloat(duration) * (duration.endsWith('ms') ? 1 : 1000) ||
          160,
      },
    )
  }, [paneMode])
  useEffect(() => {
    const idle = requestIdleCallback(() => setSourceMounted(true))
    return () => cancelIdleCallback(idle)
  }, [])
  useEffect(() => {
    if (mode !== 'normal') setSourceMounted(true)
  }, [mode])
  const editor = useEditor(
    {
      extensions: [
        ...editorExtensions(flavors),
        documentImage(documentRevision),
      ],
      content: projection.content,
      contentType: 'markdown',
      autofocus: 'end',
      injectCSS: false,
      shouldRerenderOnTransaction: false,
      editorProps: {
        handleKeyDown(view, event) {
          if (
            event.ctrlKey &&
            !event.metaKey &&
            !event.altKey &&
            !event.shiftKey &&
            event.key.toLowerCase() === 'a'
          ) {
            event.preventDefault()
            view.dispatch(
              view.state.tr.setSelection(new AllSelection(view.state.doc)),
            )
            return true
          }
          return false
        },
        attributes: {
          'aria-label': 'document editor',
          role: 'textbox',
          'aria-multiline': 'true',
        },
      },
      onUpdate: ({ editor }) => {
        onChange(projection.serialize(editor.getMarkdown()))
        setRichRevision((revision) => revision + 1)
      },
    },
    [markdownExtensions, flavors],
  )
  const { attachSource: attachSourceFormatting, attachFiles } =
    useFormattingToolbar(
      editor,
      paneMode,
      focusedPane,
      disabled || mode !== paneMode || (findTarget === 'rich' && sourceOnly),
      onAttach,
      markdownDocument,
      format,
    )

  useEffect(() => {
    if (!editor) return
    editor.setEditable(!sourceOnly && !disabled, false)
  }, [editor, sourceOnly, disabled])

  useEffect(() => {
    if (!editor) return
    let detach: (() => void)[] = []
    const cleanup = () => {
      for (const remove of detach) remove()
      detach = []
    }
    const attach = () => {
      cleanup()
      if (!editor.isDestroyed)
        detach = richExtensions.map((extension) => extension.attach(editor))
    }
    editor.on('mount', attach)
    editor.on('unmount', cleanup)
    attach()
    return () => {
      editor.off('mount', attach)
      editor.off('unmount', cleanup)
      cleanup()
    }
  }, [editor, richExtensions])

  useEffect(() => {
    if (!editor || !findOpen || findTarget !== 'rich') return
    const report = () => {
      const matches = getMatchHighlights(editor.state).find()
      const selection = editor.state.selection
      setFindStatus({
        total: matches.length,
        current:
          matches.findIndex(
            (match) =>
              match.from === selection.from && match.to === selection.to,
          ) + 1,
      })
    }
    editor.on('transaction', report)
    report()
    return () => {
      editor.off('transaction', report)
    }
  }, [editor, findOpen, findTarget])

  useEffect(() => {
    if (!editor) return
    const query = new SearchQuery({
      search: findOpen && findTarget === 'rich' ? findQuery : '',
      literal: true,
    })
    editor.view.dispatch(setSearchState(editor.state.tr, query))
    const first = query.valid ? query.findNext(editor.state, 0) : null
    if (first)
      editor.view.dispatch(
        editor.state.tr
          .setSelection(
            TextSelection.create(editor.state.doc, first.from, first.to),
          )
          .scrollIntoView(),
      )
  }, [editor, findQuery, findOpen, findTarget])

  useEffect(() => {
    if (handledFindMove.current === findMove.id) return
    handledFindMove.current = findMove.id
    if (editor && findOpen && findTarget === 'rich' && findMove.id) {
      const command = findMove.direction === 'next' ? findNext : findPrev
      command(editor.state, (transaction) => editor.view.dispatch(transaction))
    }
  }, [editor, findMove, findOpen, findTarget])

  function updateFromSource(markdown: string) {
    if (markdownDocument)
      editor
        ?.chain()
        .setContent(projectMarkdown(markdown, markdownExtensions).content, {
          contentType: 'markdown',
          emitUpdate: false,
        })
        .setMeta('addToHistory', false)
        .run()
    onChange(markdown)
  }

  return (
    <>
      <FindBar
        open={findOpen}
        query={findQuery}
        onQuery={setFindQuery}
        status={findStatus}
        onMove={(direction) =>
          setFindMove((move) => ({ id: move.id + 1, direction }))
        }
        onClose={() => {
          onCloseFind()
          if (findTarget === 'rich') editor?.commands.focus()
          else
            window.document
              .querySelector<HTMLElement>('.source-pane .cm-content')
              ?.focus()
        }}
      />
      <main
        className={`editor-panes mode-${paneMode}`}
        data-source-ready={sourceReady}
        onClickCapture={(event) => {
          const link = (event.target as HTMLElement).closest<HTMLAnchorElement>(
            '.tiptap a[href]',
          )
          if (!link || !event.shiftKey) return
          event.preventDefault()
          event.stopPropagation()
          onLink(link.getAttribute('href')!)
        }}
        onDropCapture={(event) => {
          const files = Array.from(event.dataTransfer.files)
          if (!files.length || !files.every(isMediaFile)) return
          event.preventDefault()
          event.stopPropagation()
          const pane = (event.target as HTMLElement).closest('.source-pane')
            ? 'source'
            : 'rich'
          void attachFiles(files, pane, { x: event.clientX, y: event.clientY })
        }}
        onKeyDownCapture={(event) => emitEditorKeyEvent(event.nativeEvent)}
        onKeyUpCapture={(event) => emitEditorKeyEvent(event.nativeEvent)}
      >
        <div className="editor-content" ref={content}>
          <EditorCursor root={content} settings={cursorSettings} />
          <MirrorCursor
            editor={editor}
            root={content}
            source={value}
            body={projection.content}
            active={
              paneMode === 'side-by-side' &&
              sourceReady &&
              !disabled &&
              !sourceOnly
            }
          />
          <section
            className="rich-pane"
            onFocusCapture={() => setFocusedPane('rich')}
            aria-label="formatted document"
            aria-hidden={paneMode === 'markdown'}
            inert={paneMode === 'markdown'}
          >
            {!markdownDocument &&
              (format ? (
                <format.Preview value={value} document={documentState} />
              ) : (
                <p className="format-unavailable">
                  enable {formatName} for preview. source editing remains
                  available.
                </p>
              ))}
            {markdownDocument &&
              markdownExtensions.map(({ id, Editor }) =>
                Editor ? (
                  <Editor
                    key={id}
                    value={value}
                    disabled={disabled}
                    onChange={(markdown) => {
                      updateFromSource(markdown)
                      setRichRevision((revision) => revision + 1)
                    }}
                  />
                ) : null,
              )}
            <div hidden={!markdownDocument}>
              <EditorContent editor={editor} />
            </div>
          </section>
          <section
            className="source-pane"
            onFocusCapture={() => setFocusedPane('source')}
            aria-label="markdown source"
            aria-hidden={paneMode === 'normal'}
            inert={paneMode === 'normal'}
          >
            {sourceMounted && (
              <Suspense
                fallback={<LoadingScreen label="loading markdown editor" />}
              >
                <SourceEditor
                  markdownMode={markdownDocument}
                  sourceLanguage={format?.language}
                  label={formatName}
                  onLink={onLink}
                  onFormatting={attachSourceFormatting}
                  sourceExtensions={sourceExtensions}
                  showLineNumbers={showLineNumbers}
                  active={mode !== 'normal'}
                  onReady={() => setSourceReady(true)}
                  value={value}
                  externalRevision={richRevision}
                  onChange={updateFromSource}
                  disabled={disabled}
                  findActive={findOpen && findTarget === 'source'}
                  findQuery={findQuery}
                  findMove={findMove}
                  onFindStatus={setFindStatus}
                />
              </Suspense>
            )}
          </section>
        </div>
      </main>
    </>
  )
}
