import { NodeViewWrapper, NodeViewContent } from '@tiptap/react'
import type { NodeViewProps } from '@tiptap/react'

export function GenericCodeBlockView({ node, deleteNode }: NodeViewProps): React.JSX.Element {
  const language = String(node.attrs.language ?? '').trim() || 'plaintext'
  const copyCode = (): void => { void navigator.clipboard?.writeText(node.textContent) }

  return <NodeViewWrapper className="code-block-lowlight">
    <div className="block-source-header code-block-header">
      <span className="code-block-language">{language}</span>
      <button type="button" className="code-block-copy" aria-label="复制代码" title="复制代码" onMouseDown={(event) => event.preventDefault()} onClick={copyCode}>复制</button>
      <button type="button" className="block-module-delete" aria-label="删除代码块" title="删除代码块" onMouseDown={(event) => event.preventDefault()} onClick={deleteNode}>删除</button>
    </div>
    <pre><code><NodeViewContent /></code></pre>
  </NodeViewWrapper>
}
