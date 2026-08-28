import { useRef, useState } from 'react'

export function useGeometrySelectionState(): {
  selectedId: string | null
  setSelectedId: React.Dispatch<React.SetStateAction<string | null>>
  selectedIds: string[]
  setSelectedIds: React.Dispatch<React.SetStateAction<string[]>>
  selectedObjectsRef: React.MutableRefObject<string[]>
  constructionSelectionCount: number
  setConstructionSelectionCount: React.Dispatch<React.SetStateAction<number>>
} {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const selectedObjectsRef = useRef<string[]>([])
  const [constructionSelectionCount, setConstructionSelectionCount] = useState(0)

  return {
    selectedId,
    setSelectedId,
    selectedIds,
    setSelectedIds,
    selectedObjectsRef,
    constructionSelectionCount,
    setConstructionSelectionCount
  }
}
