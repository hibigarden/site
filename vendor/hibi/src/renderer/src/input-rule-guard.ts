import type { AnyExtension } from '@tiptap/core'
import {
  Bold,
  starInputRegex as boldStar,
  underscoreInputRegex as boldUnderscore,
} from '@tiptap/extension-bold'
import {
  Italic,
  starInputRegex as italicStar,
  underscoreInputRegex as italicUnderscore,
} from '@tiptap/extension-italic'

/** Avoid native emphasis regex scans when the closing delimiter is absent. */
export function guardNativeInputRules(extension: AnyExtension) {
  if (
    extension.config.addInputRules !== Bold.config.addInputRules &&
    extension.config.addInputRules !== Italic.config.addInputRules
  )
    return extension
  return extension.extend({
    addInputRules() {
      const rules = this.parent?.() ?? []
      for (const rule of rules) {
        const find = rule.find
        const suffix =
          find === boldStar
            ? '**'
            : find === boldUnderscore
              ? '__'
              : find === italicStar
                ? '*'
                : find === italicUnderscore
                  ? '_'
                  : null
        if (!suffix || !(find instanceof RegExp)) continue
        // Keep the RegExp finder contract, including every capture and index.
        const guarded = new RegExp(find.source, find.flags)
        guarded.exec = (text) =>
          text.endsWith(suffix) ? find.exec(text) : null
        rule.find = guarded
      }
      return rules
    },
  })
}
