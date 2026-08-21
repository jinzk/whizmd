import { useEffect, useRef, useState } from 'react'
import { NodeViewWrapper, NodeViewContent } from '@tiptap/react'
import type { NodeViewProps } from '@tiptap/react'
import type { Node } from '@tiptap/pm/model'
import { useTheme } from '../../hooks/useTheme'
import { GenericCodeBlockView } from './GenericCodeBlockView'
import { HtmlPreviewView } from './HtmlPreviewView'
import { getMermaidConfig, initializeMermaid, loadMermaid, nextMermaidId } from './mermaid'

let mermaidCounter = { value: 0 }

type CodeBlockViewType = 'html' | 'mermaid' | 'generic'
export function getCodeBlockViewType(node: Node): CodeBlockViewType {
  if (node.attrs.htmlPreview === true) return 'html'
  if (String(node.attrs.language ?? '').toLowerCase() === 'mermaid') return 'mermaid'
  return 'generic'
}

function MermaidBlockView({ node, selected, editor, getPos, deleteNode }: NodeViewProps): React.JSX.Element {
  const [svg, setSvg] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [rendering, setRendering] = useState(false)
  const [editing, setEditing] = useState(selected)
  const renderId = useRef<number>(nextMermaidId(mermaidCounter))
  const mermaidSource = node.textContent
  const theme = useTheme()

  useEffect(() => {
    const updateEditing = (): void => {
      const position = getPos()
      if (position === undefined) return
      const selection = editor.state.selection
      setEditing((selection.from > position && selection.from < position + node.nodeSize) || selected)
    }
    updateEditing()
    editor.on('selectionUpdate', updateEditing)
    return () => { editor.off('selectionUpdate', updateEditing) }
  }, [editor, getPos, node.nodeSize, selected])

  useEffect(() => {
    let cancelled = false
    const timer = setTimeout(async () => {
      if (!mermaidSource.trim()) { setSvg(null); setError(null); setRendering(false); return }
      setRendering(true)
      try {
        const mermaid = await loadMermaid()
        initializeMermaid(mermaid, getMermaidConfig())
        const { svg: rendered } = await mermaid.render(`mermaid-${renderId.current}`, mermaidSource)
        if (!cancelled) { setSvg(rendered); setError(null); setRendering(false) }
      } catch (err) {
        if (!cancelled) { setSvg(null); setError(err instanceof Error ? err.message : String(err)); setRendering(false) }
      }
    }, 200)
    return () => { cancelled = true; clearTimeout(timer) }
  }, [mermaidSource, theme])

  const enterEditMode = (): void => {
    const position = getPos()
    if (position !== undefined) { editor.commands.focus(); editor.commands.setTextSelection(position + 1) }
  }

  return <NodeViewWrapper className="mermaid-block" data-mermaid-rendered={svg ? '1' : '0'} data-mermaid-editing={editing ? 'true' : 'false'}>
    <div className="mermaid-preview" onMouseDown={enterEditMode}>
      {svg ? <div className="mermaid-svg" dangerouslySetInnerHTML={{ __html: svg }} /> : error ? <div className="mermaid-error" title={error}>图表渲染失败，请检查语法</div> : rendering ? <div className="mermaid-loading">渲染中…</div> : <div className="mermaid-empty">Mermaid 图表</div>}
    </div>
    <div className="mermaid-source" aria-hidden={!editing}>
      <div className="block-source-header mermaid-source-header"><span>Mermaid</span><button type="button" className="block-module-delete" aria-label="删除 Mermaid 模块" title="删除 Mermaid 模块" onMouseDown={(event) => event.preventDefault()} onClick={deleteNode}>删除</button></div>
      <pre><code><NodeViewContent /></code></pre>
    </div>
  </NodeViewWrapper>
}

export function CodeBlockNodeView(props: NodeViewProps): React.JSX.Element {
  switch (getCodeBlockViewType(props.node)) {
    case 'html': return <HtmlPreviewView {...props} />
    case 'mermaid': return <MermaidBlockView {...props} />
    default: return <GenericCodeBlockView {...props} />
  }
}
