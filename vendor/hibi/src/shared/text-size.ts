/** Exact UTF-8 limit check without encoding strings whose length proves the answer. */
export function exceedsUtf8Limit(value: string, maximum: number): boolean {
  // A UTF-16 code unit occupies at most three UTF-8 bytes, including lone surrogates.
  if (value.length <= Math.floor(maximum / 3)) return false
  if (value.length > maximum) return true
  return new TextEncoder().encode(value).length > maximum
}
