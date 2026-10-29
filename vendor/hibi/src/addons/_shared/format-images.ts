import type { AddonContext } from '../api'

export async function embedFormatImages(
  context: AddonContext,
  document: Document,
  id?: string,
) {
  let size = document.body.innerHTML.length
  for (const image of document.querySelectorAll<HTMLImageElement>('img[src]')) {
    const source = image.getAttribute('src') ?? ''
    if (/^(?:data:|[a-z][a-z\d+.-]*:|\/\/)/i.test(source)) continue
    const url = id
      ? await context.native
          .query<string | null>('image', { source, documentId: id })
          .catch(() => null)
      : null
    if (url) {
      size += url.length
      if (size > 20 * 1024 * 1024)
        throw new Error('Embedded images exceed the 20 MiB preview limit.')
      image.src = url
    } else image.removeAttribute('src')
  }
}
