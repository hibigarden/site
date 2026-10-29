/** Runtime dependencies shared with explicitly installed renderer extensions. */
import * as tiptap from '@tiptap/core'
import { Marked } from 'marked'
import * as React from 'react'
import * as documents from '../shared/document-projection'
import type { Addon } from './api'
import * as codeMirror from './sdk-source'
import * as ui from './ui'

export const sdk = {
  documents,
  React,
  ui,
  tiptap,
  codeMirror: { ...codeMirror },
  markdown: { Marked },
}
/** Export this factory as the default export of a package's compiled ES module. */
export type SideloadFactory = (host: typeof sdk) => Omit<Addon, 'manifest'>
