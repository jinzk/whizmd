import { beforeEach, describe, expect, it } from 'vitest'
import { useDocumentStore } from '../documents'

const initialDocument = { id: 'untitled-1', path: null, content: '', dirty: false }

describe('document session store', () => {
  beforeEach(() => {
    useDocumentStore.setState({ documents: [initialDocument], activeDocumentId: initialDocument.id })
  })

  it('keeps content and dirty state isolated per document', () => {
    const store = useDocumentStore.getState()
    store.addDocument({ id: 'file-1', path: 'README.md', content: 'readme', dirty: false })
    store.updateDocument('file-1', { content: 'changed', dirty: true })

    expect(useDocumentStore.getState().documents).toEqual([
      initialDocument,
      { id: 'file-1', path: 'README.md', content: 'changed', dirty: true }
    ])
  })

  it('can atomically replace the open documents and active document', () => {
    const documents = [
      { id: 'file-1', path: 'one.md', content: 'one', dirty: true },
      { id: 'file-2', path: 'two.md', content: 'two', dirty: false }
    ]

    useDocumentStore.getState().replaceDocuments(documents, 'file-2')

    expect(useDocumentStore.getState().documents).toEqual(documents)
    expect(useDocumentStore.getState().activeDocumentId).toBe('file-2')
  })
})
