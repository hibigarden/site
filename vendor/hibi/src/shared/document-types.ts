export const markdownExtensions = ['md', 'markdown', 'txt']
export const documentExtension = (name: string) =>
  name.split('.').at(-1)?.toLowerCase() ?? ''
export const isMarkdownDocument = (name: string) =>
  markdownExtensions.includes(documentExtension(name))
export function validDocumentExtensions(value: unknown): value is string[] {
  return (
    Array.isArray(value) &&
    value.length <= 20 &&
    value.every(
      (extension) =>
        typeof extension === 'string' &&
        /^[a-z0-9]{1,12}$/.test(extension) &&
        !markdownExtensions.includes(extension),
    )
  )
}
