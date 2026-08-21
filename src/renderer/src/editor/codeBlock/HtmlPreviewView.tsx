import { useEffect, useRef, useState } from 'react'
import { NodeViewWrapper, NodeViewContent } from '@tiptap/react'
import type { NodeViewProps } from '@tiptap/react'

export function HtmlPreviewView({ node, editor, getPos, updateAttributes, deleteNode }: NodeViewProps): React.JSX.Element {
  const [editing, setEditing] = useState(node.attrs.htmlEditing === true)
  const sourceRef = useRef<HTMLDivElement>(null)
  const htmlSource = node.textContent
  const previewSource = htmlSource.trim() ? htmlSource : '<!doctype html><html><body></body></html>'

  useEffect(() => {
    const onFocusIn = (): void => {
      if (sourceRef.current && !sourceRef.current.contains(document.activeElement)) setEditing(false)
    }
    document.addEventListener('focusin', onFocusIn)
    return () => document.removeEventListener('focusin', onFocusIn)
  }, [])

  useEffect(() => {
    if (!node.attrs.htmlEditing) return
    const position = getPos()
    if (position === undefined) return
    editor.commands.focus()
    editor.commands.setTextSelection(position + node.nodeSize - 1)
    updateAttributes({ htmlEditing: false })
  }, [editor, getPos, node.attrs.htmlEditing, node.nodeSize, updateAttributes])

  return <NodeViewWrapper className="html-block" data-html-editing={editing ? 'true' : 'false'}>
    <div className="html-preview">
      <iframe title="HTML 预览" sandbox="" srcDoc={previewSource} />
      {!editing ? <button type="button" className="html-preview-edit" aria-label="编辑 HTML 源码" title="编辑 HTML 源码" onMouseDown={(event) => event.preventDefault()} onClick={() => setEditing(true)}>编辑源码</button> : null}
    </div>
    <div className="html-source" ref={sourceRef} aria-hidden={!editing} onFocus={() => setEditing(true)} onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget as globalThis.Node | null)) setEditing(false) }}>
      <div className="block-source-header html-source-header"><span>HTML</span><button type="button" className="block-module-delete" aria-label="删除 HTML 模块" title="删除 HTML 模块" onMouseDown={(event) => event.preventDefault()} onClick={deleteNode}>删除</button></div>
      <pre className="html-source-code"><code className="language-html"><NodeViewContent /></code></pre>
    </div>
  </NodeViewWrapper>
}
