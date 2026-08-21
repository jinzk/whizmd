import { create } from 'zustand'

export interface OpenDocument {
  id: string
  path: string | null
  content: string
  dirty: boolean
}

interface DocumentState {
  documents: OpenDocument[]
  activeDocumentId: string
  addDocument: (document: OpenDocument) => void
  updateDocument: (id: string, patch: Partial<OpenDocument>) => void
  removeDocument: (id: string) => void
  setActiveDocument: (id: string) => void
  replaceDocuments: (documents: OpenDocument[], activeDocumentId?: string) => void
}

export const useDocumentStore = create<DocumentState>((set) => ({
  documents: [{ id: 'untitled-1', path: null, content: '', dirty: false }],
  activeDocumentId: 'untitled-1',
  addDocument: (document) => set((state) => ({ documents: [...state.documents, document] })),
  updateDocument: (id, patch) => set((state) => ({
    documents: state.documents.map((document) =>
      document.id === id ? { ...document, ...patch } : document
    )
  })),
  removeDocument: (id) => set((state) => ({
    documents: state.documents.filter((document) => document.id !== id)
  })),
  setActiveDocument: (activeDocumentId) => set({ activeDocumentId }),
  replaceDocuments: (documents, activeDocumentId) => set({
    documents,
    ...(activeDocumentId ? { activeDocumentId } : {})
  })
}))
