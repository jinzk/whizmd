import { describe, expect, it } from 'vitest'
import { Editor } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import { Markdown } from '@tiptap/markdown'
import { InlineMath } from '../math'
import { LinkNode } from '../link'
import { ReferenceDefinition } from '../syntax/referenceDefinition'
import { buildReferenceRegistry } from '../referenceRegistry'

describe('editor performance baselines', () => {
  it('builds a large reference registry within a practical baseline', () => {
    const content = {
      type: 'doc',
      content: [
        { type: 'paragraph', content: Array.from({ length: 500 }, (_, index) => ({ type: 'linkNode', attrs: { text: `item ${index}`, href: 'https://example.com', reference: 'docs' } })) },
        { type: 'referenceDefinition', attrs: { id: 'docs', destination: 'https://example.com', title: null } }
      ]
    }
    const editor = new Editor({
      extensions: [StarterKit, LinkNode, ReferenceDefinition, InlineMath, Markdown],
      content
    })
    const started = performance.now()
    const first = buildReferenceRegistry(editor)
    const firstDuration = performance.now() - started
    const cachedStarted = performance.now()
    const second = buildReferenceRegistry(editor)
    const cachedDuration = performance.now() - cachedStarted

    expect(first.get('docs')?.usages.length).toBe(500)
    expect(second).toBe(first)
    expect(firstDuration).toBeLessThan(1000)
    expect(cachedDuration).toBeLessThan(firstDuration + 10)
    editor.destroy()
  })
})
