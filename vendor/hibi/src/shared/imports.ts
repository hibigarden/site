export const IMPORT_CHANNELS = {
  list: 'imports:list',
  run: 'imports:run',
} as const
export type ImportSource = 'folder' | 'zip'
export type Importer = {
  id: string
  name: string
  instructions: string
  sources: readonly ImportSource[]
}
/** Relative paths and bytes from a user-selected export. Never executable addon code. */
export type ImportFile = { path: string; data: Uint8Array }
export type ImportResult = { folder: string; files: number; warnings: string[] }
export type ImportRequest = {
  id: string
  source: ImportSource
  workspaceId: string
}
