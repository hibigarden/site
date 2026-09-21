export type DocumentVersion = { id: string; savedAt: number; bytes: number }
export const HISTORY_CHANNELS = {
  list: 'history:list',
  preview: 'history:preview',
  restore: 'history:restore',
  notice: 'document:notice',
} as const
