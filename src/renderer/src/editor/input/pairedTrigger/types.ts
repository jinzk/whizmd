import type { Node as ProseMirrorNode } from '@tiptap/pm/model'
import type { EditorState } from '@tiptap/pm/state'

export type PairedTriggerRule = {
  marker: string
  priority: number
  accepts: (content: string) => boolean
  createNode: (content: string, state?: EditorState) => ProseMirrorNode | null
}

export type PairedMatch = {
  from: number
  to: number
  content: string
  rule: PairedTriggerRule
}
