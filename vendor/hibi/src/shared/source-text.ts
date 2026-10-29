/** Detach retained text from sliced/concatenated parents without changing UTF-16 units. */
export function ownSourceText(text: string): string {
  return structuredClone(text)
}
