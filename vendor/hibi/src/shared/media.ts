import type { DocumentState } from './desktop'

export type MediaAttachment = { url: string; alt: string }
export type AttachmentResult = {
  document: DocumentState
  attachments: MediaAttachment[]
}
export type DocumentMedia = { url: string; kind: 'image' | 'video' }
export const MEDIA_CHANNELS = {
  attach: 'media:attach',
  read: 'media:read',
  open: 'media:open-dropped',
} as const

export function isMediaFile(file: Pick<File, 'name' | 'type'>) {
  return (
    /^(image|video)\//.test(file.type) ||
    /\.(png|jpe?g|gif|webp|avif|svg|mp4|m4v|mov|webm|ogv)$/i.test(file.name)
  )
}

export function attachmentMarkdown(
  items: readonly (MediaAttachment & { title?: string })[],
) {
  return items
    .map(({ alt, url, title }) => {
      const label = alt.replace(/[\\[\]]/g, '\\$&')
      const destination = /\s/.test(url)
        ? `<${url.replace(/[\\<>]/g, '\\$&')}>`
        : url.replace(/\\/g, '\\\\').replace(/[()]/g, '\\$&')
      const suffix = title ? ` "${title.replace(/[\\"]/g, '\\$&')}"` : ''
      return `![${label}](${destination}${suffix})`
    })
    .join('\n\n')
}
