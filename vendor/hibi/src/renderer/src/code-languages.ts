import { cpp } from '@codemirror/lang-cpp'
import { css } from '@codemirror/lang-css'
import { go } from '@codemirror/lang-go'
import { html } from '@codemirror/lang-html'
import { java } from '@codemirror/lang-java'
import { javascript } from '@codemirror/lang-javascript'
import { json } from '@codemirror/lang-json'
import { python } from '@codemirror/lang-python'
import { rust } from '@codemirror/lang-rust'
import { sql } from '@codemirror/lang-sql'
import { yaml } from '@codemirror/lang-yaml'
import { StreamLanguage } from '@codemirror/language'
import { csharp } from '@codemirror/legacy-modes/mode/clike'
import { dockerFile } from '@codemirror/legacy-modes/mode/dockerfile'
import { powerShell } from '@codemirror/legacy-modes/mode/powershell'
import { ruby } from '@codemirror/legacy-modes/mode/ruby'
import { shell } from '@codemirror/legacy-modes/mode/shell'
import { swift } from '@codemirror/legacy-modes/mode/swift'
import { toml } from '@codemirror/legacy-modes/mode/toml'
import { highlightTree, tagHighlighter, tags } from '@lezer/highlight'
import type { CodeLanguage } from '../../shared/syntax'

const builtin: CodeLanguage[] = [
  {
    id: 'javascript',
    aliases: ['js', 'mjs', 'cjs'],
    language: javascript().language,
  },
  {
    id: 'typescript',
    aliases: ['ts', 'mts', 'cts'],
    language: javascript({ typescript: true }).language,
  },
  { id: 'jsx', language: javascript({ jsx: true }).language },
  { id: 'tsx', language: javascript({ typescript: true, jsx: true }).language },
  { id: 'html', aliases: ['htm'], language: html().language },
  { id: 'css', language: css().language },
  { id: 'json', language: json().language },
  { id: 'python', aliases: ['py'], language: python().language },
  { id: 'yaml', aliases: ['yml'], language: yaml().language },
  {
    id: 'sql',
    aliases: ['mysql', 'postgresql', 'postgres', 'sqlite'],
    language: sql().language,
  },
  { id: 'java', language: java().language },
  {
    id: 'cpp',
    aliases: ['c', 'cc', 'c++', 'cxx', 'h', 'hpp'],
    language: cpp().language,
  },
  { id: 'rust', aliases: ['rs'], language: rust().language },
  { id: 'go', aliases: ['golang'], language: go().language },
  {
    id: 'shell',
    aliases: ['sh', 'bash', 'zsh'],
    language: StreamLanguage.define(shell),
  },
  {
    id: 'powershell',
    aliases: ['ps1'],
    language: StreamLanguage.define(powerShell),
  },
  {
    id: 'csharp',
    aliases: ['cs', 'c#'],
    language: StreamLanguage.define(csharp),
  },
  { id: 'ruby', aliases: ['rb'], language: StreamLanguage.define(ruby) },
  { id: 'swift', language: StreamLanguage.define(swift) },
  { id: 'toml', language: StreamLanguage.define(toml) },
  {
    id: 'dockerfile',
    aliases: ['docker'],
    language: StreamLanguage.define(dockerFile),
  },
]
const registered = new Map<string, CodeLanguage>()
const listeners = new Set<() => void>()
let version = 0
let languages = new Map<string, CodeLanguage['language']>()
let aliases = new Map<string, string>()
let catalog: readonly {
  id: string
  aliases: readonly string[]
  owner: string
  enabled: boolean
}[] = []
const disabled = new Set<string>()
try {
  const saved: unknown = JSON.parse(
    localStorage.getItem('hibi:code-syntax-disabled') ?? '[]',
  )
  if (Array.isArray(saved))
    for (const id of saved) if (typeof id === 'string') disabled.add(id)
} catch {
  /* Keep all languages enabled when preferences are unavailable. */
}
function publish() {
  languages = new Map()
  aliases = new Map()
  const entries = new Map<string, (typeof catalog)[number]>()
  const definitions = [
    ...builtin.map((entry) => ({ ...entry, owner: 'built-in' })),
    ...[...registered].map(([key, entry]) => ({
      ...entry,
      owner: key.slice(0, key.length - entry.id.length - 1),
    })),
  ]
  for (const entry of definitions) {
    languages.set(entry.id.toLowerCase(), entry.language)
    entries.set(entry.id.toLowerCase(), {
      id: entry.id.toLowerCase(),
      aliases: [],
      owner: entry.owner,
      enabled: !disabled.has(entry.id.toLowerCase()),
    })
    for (const name of [entry.id, ...(entry.aliases ?? [])])
      aliases.set(name.toLowerCase(), entry.id.toLowerCase())
  }
  catalog = [...entries.values()].map((entry) => ({
    ...entry,
    aliases: [...aliases]
      .filter(([alias, id]) => id === entry.id && alias !== entry.id)
      .map(([alias]) => alias),
  }))
  version++
  for (const listener of listeners) listener()
}
publish()
export const codeLanguages = {
  version: () => version,
  snapshot: () => catalog,
  setEnabled(id: string, enabled: boolean) {
    if (!languages.has(id) || enabled === !disabled.has(id)) return
    if (enabled) disabled.delete(id)
    else disabled.add(id)
    try {
      localStorage.setItem(
        'hibi:code-syntax-disabled',
        JSON.stringify([...disabled]),
      )
    } catch {
      /* Session preferences still apply. */
    }
    publish()
  },
  resolve(info: string) {
    const id =
      aliases.get(info.trim().split(/\s+/)[0]?.toLowerCase() ?? '') ?? ''
    return disabled.has(id) ? null : (languages.get(id) ?? null)
  },
  subscribe(listener: () => void) {
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  },
  register(owner: string, entry: CodeLanguage) {
    const key = `${owner}.${entry.id}`
    if (
      registered.has(key) ||
      [entry.id, ...(entry.aliases ?? [])].some(
        (name) =>
          typeof name !== 'string' || !/^[a-z][a-z0-9_+#.-]*$/i.test(name),
      ) ||
      typeof entry.language?.parser?.parse !== 'function' ||
      typeof entry.language?.parser?.startParse !== 'function'
    )
      throw new Error('invalid or duplicate code language.')
    const contribution = { ...entry }
    registered.set(key, contribution)
    publish()
    return () => {
      if (registered.get(key) !== contribution) return
      registered.delete(key)
      publish()
    }
  },
}

export const codeHighlighter = tagHighlighter([
  {
    tag: [tags.keyword, tags.modifier, tags.null, tags.processingInstruction],
    class: 'hibi-token-keyword',
  },
  { tag: [tags.string, tags.regexp, tags.escape], class: 'hibi-token-string' },
  { tag: [tags.number, tags.bool, tags.atom], class: 'hibi-token-number' },
  { tag: tags.comment, class: 'hibi-token-comment' },
  {
    tag: [tags.typeName, tags.className, tags.namespace, tags.tagName],
    class: 'hibi-token-type',
  },
  {
    tag: [tags.function(tags.variableName), tags.function(tags.propertyName)],
    class: 'hibi-token-function',
  },
  {
    tag: [tags.variableName, tags.propertyName, tags.attributeName],
    class: 'hibi-token-variable',
  },
  { tag: [tags.operator, tags.punctuation], class: 'hibi-token-operator' },
])
export type CodeSpan = { from: number; to: number; classes: string }
export function highlightCode(text: string, info: string): CodeSpan[] {
  const language = codeLanguages.resolve(info)
  // Large blocks remain complete plain text; avoid synchronously parsing megabytes in rich view/export.
  if (!language || text.length > 100000) return []
  const spans: CodeSpan[] = []
  try {
    highlightTree(
      language.parser.parse(text),
      codeHighlighter,
      (from, to, classes) => spans.push({ from, to, classes }),
    )
  } catch (error) {
    console.error(`code highlighting failed: ${info}`, error)
  }
  return spans
}
export function escapeCode(text: string) {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}
export function codeHtml(text: string, info: string) {
  let offset = 0,
    result = ''
  for (const span of highlightCode(text, info)) {
    result +=
      escapeCode(text.slice(offset, span.from)) +
      `<span class="${span.classes}">${escapeCode(text.slice(span.from, span.to))}</span>`
    offset = span.to
  }
  return result + escapeCode(text.slice(offset))
}
