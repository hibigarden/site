export const UI_CASE_CHANNEL = 'app:ui-case'
export type UiCase = 'sentence' | 'lowercase'

/** UI copy only; never apply to filenames, editor content, or field values. */
export function sentenceCase(value: string) {
  if (/^\s*(?:https?:|[/.~]|\S+\.(?:md|typ|json|png|js|ts)\b)/i.test(value))
    return value
  return value
    .replace(
      /^(\s*)(\p{Ll})/u,
      (_match, space: string, letter: string) =>
        space + letter.toLocaleUpperCase(),
    )
    .replace(/\b(?:wpm|cpm|ui|api|url|pdf|yaml|html|css|json)\b/gi, (word) =>
      word.toUpperCase(),
    )
}
