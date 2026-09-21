import type { Extension } from '@codemirror/state'
import type { AnyExtension, Editor } from '@tiptap/core'
import type { MarkedExtension } from 'marked'
import type { ComponentType } from 'react'
import type {
  Colorscheme,
  ColorschemeInput,
  ThemePreferences,
} from '../shared/colorschemes'
import type { DocumentCommand } from '../shared/desktop'
import type { AppCommand } from '../shared/hotkeys'
import type { CodeLanguage } from '../shared/syntax'

export type { CodeLanguage } from '../shared/syntax'

import type {
  ExplorerDecorationProvider,
  WorkspaceSnapshot,
  WorkspaceState,
} from '../shared/workspace'
import type { DialogApi } from '../ui/dialogs'
import type { MenuApi } from '../ui/menus'
import type { ToastApi } from '../ui/toasts'
import type { ToolbarApi } from '../ui/toolbar'
import type { TooltipApi } from '../ui/tooltips'

export type {
  Colorscheme,
  ColorschemeColors,
  ColorschemeInput,
  ColorToken,
  ThemePreferences,
} from '../shared/colorschemes'
export type {
  ExplorerDecoration,
  ExplorerDecorationProvider,
} from '../shared/workspace'
export type {
  DialogApi,
  DialogHandle,
  DialogOptions,
  MessageDialogOptions,
  PromptDialogOptions,
} from '../ui/dialogs'
export type { MenuApi, MenuItem } from '../ui/menus'
export type {
  ToastApi,
  ToastHandle,
  ToastOptions,
  ToastPosition,
  ToastPreferences,
} from '../ui/toasts'
export type {
  ToolbarApi,
  ToolbarHandle,
  ToolbarItem,
  ToolbarPreferences,
} from '../ui/toolbar'
export type { TooltipApi, TooltipOptions } from '../ui/tooltips'

/** Increment when a public contract changes incompatibly. */
export const ADDON_API_VERSION = 1

export type AddonManifest = {
  id: string
  name: string
  description: string
  apiVersion: typeof ADDON_API_VERSION
  /** Existing API v1 addons default to extension. */
  kind?: 'theme' | 'extension'
  defaultEnabled?: boolean
  /** Plugin release version; optional for existing API v1 addons. */
  version?: string
  /** Additional source-file extensions, without dots. Files remain openable when disabled. */
  fileExtensions?: readonly string[]
  authors?: readonly AddonAuthor[]
  /** Shipped third-party notices, shown under hibi's open source licenses. */
  licenses?: readonly {
    id: string
    name: string
    license: string
    text: string
  }[]
}

export type AddonAuthor = {
  discordId?: string
  displayName: string
  github?: string
  role?: string
}

export type SourceExtension = {
  id: string
  /** Created per source editor; may lazy-load an editor integration. */
  create: () => Extension | Promise<Extension>
}

export type RichExtension = {
  id: string
  /** Attach editor behavior without rebuilding its schema or undo history. */
  attach: (editor: Editor) => () => void
}

export type StatusItem = {
  id: string
  label: string
  tooltip?: string
  /** Omit to show in every editor view. Empty labels hide the pill. */
  when?: 'source'
  onClick?: () => void | Promise<void>
}

/** Editor-only input. Never emitted from settings, search, dialogs, or hidden panes. */
export type EditorKeyEvent = Readonly<{
  phase: 'down' | 'up'
  view: 'normal' | 'source'
  key: string
  code: string
  repeat: boolean
  altKey: boolean
  ctrlKey: boolean
  metaKey: boolean
  shiftKey: boolean
}>
/** Typed characters only: excludes paste, deletion, shortcuts, and programmatic edits. */
export type EditorInputEvent = Readonly<{
  characters: number
  view: 'normal' | 'source'
}>
export type StatusHandle = {
  update: (changes: Partial<Omit<StatusItem, 'id'>>) => void
  dispose: () => void
}

export type StyleHandle = {
  update: (css: string) => void
  dispose: () => void
}

type Method = (...args: never[]) => unknown
type MethodKey<T> = {
  [K in keyof T]-?: T[K] extends Method ? K : never
}[keyof T]
type MethodOf<T, K extends keyof T> = Extract<T[K], Method>

/** Patches mutable renderer methods. Every registration returns an undo function. */
export type PatchApi = {
  before: <T extends object, K extends MethodKey<T>>(
    target: T,
    key: K,
    callback: (
      args: Parameters<MethodOf<T, K>>,
      receiver: T,
      // biome-ignore lint/suspicious/noConfusingVoidType: observer hooks may return nothing.
    ) => Parameters<MethodOf<T, K>> | void,
  ) => () => void
  after: <T extends object, K extends MethodKey<T>>(
    target: T,
    key: K,
    callback: (
      args: Parameters<MethodOf<T, K>>,
      result: ReturnType<MethodOf<T, K>>,
      receiver: T,
    ) => ReturnType<MethodOf<T, K>>,
  ) => () => void
  instead: <T extends object, K extends MethodKey<T>>(
    target: T,
    key: K,
    callback: (
      args: Parameters<MethodOf<T, K>>,
      next: (...args: Parameters<MethodOf<T, K>>) => ReturnType<MethodOf<T, K>>,
      receiver: T,
    ) => ReturnType<MethodOf<T, K>>,
  ) => () => void
}

/** Shared renderer actions used by the toolbar, palette, shortcuts, and addons. */
export type AddonApp = {
  runAction: (command: AppCommand) => void
  runCommand: (command: DocumentCommand) => Promise<boolean>
}

export type AddonCommand = {
  /** Local id; the host prefixes it with the addon id. */
  id: string
  label: string
  /** Searchable terms in the command palette, without duplicating the label. */
  keywords?: string
  /** Also show this command below the workspace tree. */
  workspace?: boolean
  /** Optional whole-note action exposed by the slash-commands addon. */
  slash?: AddonSlashCommand
  run: () => void | Promise<void>
}

export type AddonSlashCommand = {
  label: string
  description: string
  keywords?: string
  when?: (source: string) => boolean
  /** Receives the complete note with the slash query removed. Null cancels. */
  transform: (source: string) => string | null
}

export type ExportResult = { path: string; pages: number }
export type AddonState = { id: string; enabled: boolean }

export type MarkdownProjection = {
  content: string
  serialize: (content: string) => string
  readOnly?: boolean
}
/** Composable parser contributions. Declare descriptors on Addon.flavors for discovery. */
export type MarkdownFlavor = {
  id: string
  name: string
  kind: 'dialect' | 'syntax'
  description: string
  /** Content detection is a hint, not proof of the author's intended dialect. */
  detect: (source: string) => boolean
  /** False when disabled syntax has a lossless built-in fallback, such as a code fence. */
  readOnlyWhenDisabled?: boolean
  markedOptions?: { gfm?: boolean; breaks?: boolean }
  richExtensions?: readonly AnyExtension[]
  /** Static exports run the same syntax parsers; their HTML is sanitized by the site. */
  export?: {
    extensions?: readonly MarkedExtension[]
    css?: string
    /** Optional async transformation after markdown rendering, for compiled embeds. */
    transform?: (
      rendered: RenderedMarkdown,
      source: string,
      documentId?: string,
    ) => Promise<RenderedMarkdown>
  }
}
export type RenderedMarkdown = { html: string; css: string }
export type DocumentPreviewProps = {
  value: string
  document: Readonly<import('../shared/desktop').DocumentState>
}
export type DocumentFormat = {
  id: string
  name: string
  extensions: readonly string[]
  language: import('@codemirror/language').Language
  Preview: ComponentType<DocumentPreviewProps>
  insertMedia?: (
    attachments: readonly import('../shared/media').MediaAttachment[],
  ) => string
  render?: (source: string, documentId?: string) => Promise<RenderedMarkdown>
}
export type MarkdownExtension = {
  id: string
  /** Pure source-to-body projection; return null for unrecognized documents. */
  parse: (source: string) => MarkdownProjection | null
  /** Optional properties UI above the rich editor. Receives the complete source. */
  Editor?: ComponentType<MarkdownEditorProps>
}

export type MarkdownEditorProps = {
  value: string
  onChange: (source: string) => void
  disabled: boolean
}

export type AddonContext = {
  colorschemes: {
    register: (scheme: ColorschemeInput) => () => void
    list: () => readonly Colorscheme[]
    getPreferences: () => ThemePreferences
    setPreferences: (preferences: Partial<ThemePreferences>) => void
  }
  dialogs: DialogApi
  toasts: ToastApi
  menus: MenuApi
  toolbar: ToolbarApi
  tooltips: TooltipApi
  app: AddonApp
  styles: { register: (id: string, css: string) => StyleHandle }
  patches: PatchApi
  statusBar: { register: (item: StatusItem) => StatusHandle }
  editor: {
    getDocument: () => Readonly<
      import('../shared/desktop').DocumentState
    > | null
    onDocumentChange: (
      listener: (
        document: Readonly<import('../shared/desktop').DocumentState>,
      ) => void,
    ) => () => void
    registerDocumentFormat: (format: DocumentFormat) => () => void
    /** Async document export, including registered format renderers and flavor transforms. */
    renderDocument: (
      source: string,
      name: string,
      documentId?: string,
    ) => Promise<RenderedMarkdown>
    /** Register or override fenced-code highlighting; restored automatically on addon stop. */
    registerCodeLanguage: (language: CodeLanguage) => () => void
    /** Observe editor keydown/keyup without consuming input. Removed on addon stop. */
    onKeyEvent: (listener: (event: EditorKeyEvent) => void) => () => void
    /** Observe committed typing, including IME composition. Removed on addon stop. */
    onInput: (listener: (event: EditorInputEvent) => void) => () => void
    registerRich: (extension: RichExtension) => () => void
    registerMarkdown: (extension: MarkdownExtension) => () => void
    registerSource: (extension: SourceExtension) => () => void
    registerFlavor: (flavor: MarkdownFlavor) => () => void
    /** Render with the file's flavor choice and active projections for static export. */
    renderMarkdown: (source: string, documentId?: string) => RenderedMarkdown
    /** Uses the app's file dialogs, draft checks, and save handling. */
    runCommand: (command: DocumentCommand) => Promise<boolean>
    /** Apply a synchronous source transform to the active note; throws while busy. */
    updateMarkdown: (
      transform: (source: string) => string | null,
      /** Replace the projected rich-editor body before applying the transform. */
      options?: { body: string },
    ) => void
  }
  commands: {
    register: (command: AddonCommand) => () => void
    /** Enabled commands whose slash action is available for the active note. */
    getSlashCommands: () => readonly (AddonSlashCommand & { id: string })[]
  }
  workspace: {
    /** Explorer-only badges/colors. Removed with this addon's lifecycle. */
    registerDecorations: (provider: ExplorerDecorationProvider) => () => void
    snapshot: () => Promise<WorkspaceSnapshot>
    get: () => Promise<WorkspaceState | null>
    open: () => Promise<WorkspaceState | null>
    openFile: (path: string) => Promise<void>
  }
  /** Calls only the current addon's explicitly exported native methods. */
  native: {
    /** Only explicitly exported native queries; does not lock editor/file actions. */
    query: <T = unknown>(method: string, input?: unknown) => Promise<T>
    invoke: <T = unknown>(method: string, input?: unknown) => Promise<T>
  }
  notify: (message: string) => void
}

export type Addon = {
  manifest: AddonManifest
  start: (context: AddonContext) => void | Promise<void>
  /** Lightweight descriptors remain discoverable while a bundled addon is disabled. */
  flavors?: readonly MarkdownFlavor[]
  stop?: () => void
  /** Optional settings content. The host supplies its heading and metadata. */
  Settings?: ComponentType
}

/** Native modules are trusted application code, never loaded from a workspace. */
export type NativeAddonContext = {
  document: {
    get: () => import('../shared/desktop').DocumentState
    /** Current document or a document in the selected workspace, addressed by opaque id. */
    path: (id?: string) => Promise<string | null>
    create: (name: string, source: string) => Promise<boolean>
  }
  exportFile: (
    bytes: Uint8Array,
    suggestedName: string,
    extension: string,
  ) => Promise<string | null>
  workspace: {
    id: () => string | null
    snapshot: () => Promise<WorkspaceSnapshot>
    /** Trusted native modules only. Never exposed to workspace markdown. */
    directory: () => string | null
    hasUnsavedChanges: () => boolean
    /** Reload the active saved file after native operations; rejects dirty buffers. */
    reload: () => Promise<void>
  }
  exportHtml: (
    html: string,
    suggestedName: string,
    pages: number,
  ) => Promise<ExportResult | null>
}

export type NativeAddon = {
  id: string
  stop?: () => void
  /** Trusted read-only handlers. No user-file changes or dialogs; private compilation caches are allowed. */
  queries?: Record<
    string,
    (input: unknown, context: NativeAddonContext) => Promise<unknown>
  >
  methods: Record<
    string,
    (input: unknown, context: NativeAddonContext) => Promise<unknown>
  >
}

export function defineAddon(addon: Addon): Addon {
  return addon
}

export const ADDON_CHANNELS = {
  states: 'addons:states',
  enable: 'addons:enable',
  invoke: 'addons:invoke',
  query: 'addons:query',
} as const
