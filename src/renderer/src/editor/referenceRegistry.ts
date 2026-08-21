import type { Editor } from '@tiptap/core'

export type ReferenceUsage = { type: 'link' | 'image'; position: number }
export type ReferenceEntry = {
  id: string
  definitionPosition: number | null
  destination: string
  title: string | null
  usages: ReferenceUsage[]
  duplicateDefinitionPositions: number[]
}

export type ReferenceRegistry = Map<string, ReferenceEntry>

const registryCache = new WeakMap<object, { doc: object; registry: ReferenceRegistry }>()

export function normalizeReferenceId(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLowerCase()
}

function entry(registry: ReferenceRegistry, id: string): ReferenceEntry {
  const existing = registry.get(id)
  if (existing) return existing
  const created: ReferenceEntry = { id, definitionPosition: null, destination: '', title: null, usages: [], duplicateDefinitionPositions: [] }
  registry.set(id, created)
  return created
}

export function buildReferenceRegistry(editor: Editor): ReferenceRegistry {
  const cached = registryCache.get(editor)
  if (cached?.doc === editor.state.doc) return cached.registry
  const registry: ReferenceRegistry = new Map()
  editor.state.doc.descendants((node, position) => {
    if (node.type.name === 'referenceDefinition') {
      const id = normalizeReferenceId(String(node.attrs.id ?? ''))
      if (!id) return
      const item = entry(registry, id)
      if (item.definitionPosition === null) {
        item.definitionPosition = position
        item.destination = String(node.attrs.destination ?? '')
        item.title = node.attrs.title ? String(node.attrs.title) : null
      } else item.duplicateDefinitionPositions.push(position)
    }
    if (node.type.name === 'linkNode' || node.type.name === 'image') {
      const reference = node.attrs.reference
      if (!reference) return
      entry(registry, normalizeReferenceId(String(reference))).usages.push({
        type: node.type.name === 'linkNode' ? 'link' : 'image', position
      })
    }
  })
  registryCache.set(editor, { doc: editor.state.doc, registry })
  return registry
}

export function referenceEntry(editor: Editor, id: string): ReferenceEntry | undefined {
  return buildReferenceRegistry(editor).get(normalizeReferenceId(id))
}
