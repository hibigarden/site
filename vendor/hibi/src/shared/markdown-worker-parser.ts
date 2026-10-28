import { GFM, parser } from '@lezer/markdown'

// This module is loaded only for metadata demand, independently of literal find.
export const metadataParsers = {
  commonmark: parser,
  gfm: parser.configure(GFM),
}
export { MarkdownSourceModel } from './markdown-source-model.ts'
