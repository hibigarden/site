import type { Language } from '@codemirror/language'

/** One parser serves source fences, rich code blocks, and static exports. */
export type CodeLanguage = {
  id: string
  aliases?: readonly string[]
} & (
  | { language: Language; load?: never }
  | { language?: never; load: () => Promise<Language> }
)
