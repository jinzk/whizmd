import { useEffect } from 'react'

export type EditorInsertAction = 'image' | 'link' | 'imageLink' | 'table' | 'codeBlock'
type Props = { position: { left: number; top: number }; onAction: (action: EditorInsertAction) => void; onClose: () => void; labels: Record<EditorInsertAction, string> }

export function EditorContextMenu({ position, onAction, onClose, labels }: Props): React.JSX.Element {
  useEffect(() => {
    const close = (): void => onClose()
    window.addEventListener('blur', close)
    window.addEventListener('scroll', close, true)
    return () => { window.removeEventListener('blur', close); window.removeEventListener('scroll', close, true) }
  }, [onClose])
  return <div className="editor-context-menu" role="menu" style={position} onMouseDown={(event) => event.stopPropagation()}>
    {(Object.keys(labels) as EditorInsertAction[]).map((action) => <button key={action} type="button" role="menuitem" onClick={() => { onAction(action); onClose() }}>{labels[action]}</button>)}
  </div>
}
