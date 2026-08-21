import { useEffect, useRef, useState } from 'react'
import { NodeViewWrapper, NodeViewContent } from '@tiptap/react'
import type { NodeViewProps } from '@tiptap/react'
import type { Node } from '@tiptap/pm/model'
import { useTheme } from '../../hooks/useTheme'

let idCounter = 0

function nextId(): number {
  idCounter += 1
  return idCounter
}

type CodeBlockViewType = 'html' | 'mermaid' | 'generic'

function getCodeBlockViewType(node: Node): CodeBlockViewType {
  if (node.attrs.htmlPreview === true) {
    return 'html'
  }

  if (String(node.attrs.language ?? '').toLowerCase() === 'mermaid') {
    return 'mermaid'
  }

  return 'generic'
}

// Mermaid is loaded on first use and initialized only when its configuration changes.
let mermaidInstance: typeof import('mermaid')['default'] | null = null
let mermaidConfigKey = ''

async function loadMermaid(): Promise<typeof import('mermaid')['default']> {
  if (!mermaidInstance) {
    const mod = await import('mermaid')
    mermaidInstance = mod.default
  }
  return mermaidInstance
}

function getMermaidConfig() {
  const rootStyle = getComputedStyle(document.documentElement)
  const cssVar = (name: string, fallback: string): string => {
    const value = rootStyle.getPropertyValue(name).trim()
    return value || fallback
  }
  const isDark = document.documentElement.dataset.theme === 'dark'

  const hasCustomColors = cssVar('--md-mermaid-primary', '') !== ''

  if (hasCustomColors) {
    return {
      theme: 'base' as const,
      themeVariables: {
        primaryColor: cssVar('--md-mermaid-primary', '#dff1ff'),
        primaryTextColor: cssVar('--md-mermaid-primary-text', '#1f2328'),
        primaryBorderColor: cssVar('--md-mermaid-primary-border', '#79c0ff'),
        secondaryColor: cssVar('--md-mermaid-secondary', '#f0f8e8'),
        secondaryTextColor: cssVar('--md-mermaid-secondary-text', '#1f2328'),
        secondaryBorderColor: cssVar('--md-mermaid-secondary-border', '#7ee787'),
        tertiaryColor: cssVar('--md-mermaid-tertiary', '#f6f8fa'),
        lineColor: cssVar('--md-mermaid-line', '#6e7781'),
        textColor: cssVar('--md-mermaid-text', '#24292f'),
        mainBkg: cssVar('--md-mermaid-background', '#ffffff'),
        nodeBkg: cssVar('--md-mermaid-background', '#ffffff'),
        nodeBorder: cssVar('--md-mermaid-node-border', '#d0d7de'),
        clusterBkg: cssVar('--md-mermaid-background', '#ffffff'),
        clusterBorder: cssVar('--md-mermaid-node-border', '#d0d7de'),
        edgeLabelBackground: cssVar('--md-mermaid-background', '#ffffff'),
        fontFamily: cssVar('--md-mermaid-font', 'inherit')
      }
    }
  }

  return {
    theme: (isDark ? 'dark' : 'default') as 'dark' | 'default'
  }
}

/** Default lowlight rendering used for languages without a specialized preview. */
function GenericCodeBlockView({ node, deleteNode }: NodeViewProps): React.JSX.Element {
  const language = String(node.attrs.language ?? '').trim() || 'plaintext'
  const copyCode = (): void => {
    void navigator.clipboard?.writeText(node.textContent)
  }

  return (
    <NodeViewWrapper className="code-block-lowlight">
      <div className="block-source-header code-block-header">
          <span className="code-block-language">{language}</span>
        <button
          type="button"
          className="code-block-copy"
          aria-label="复制代码"
          title="复制代码"
          onMouseDown={(event) => event.preventDefault()}
          onClick={copyCode}
        >
          复制
        </button>
          <button
          type="button"
          className="block-module-delete"
          aria-label="删除代码块"
          title="删除代码块"
          onMouseDown={(event) => event.preventDefault()}
          onClick={deleteNode}
        >
          删除
        </button>
      </div>
      <pre>
        <code>
          <NodeViewContent />
        </code>
      </pre>
    </NodeViewWrapper>
  )
}

function HtmlPreviewView({ node, editor, getPos, updateAttributes, deleteNode }: NodeViewProps): React.JSX.Element {
  const [editing, setEditing] = useState(node.attrs.htmlEditing === true)
  const htmlSource = node.textContent
  const previewSource = htmlSource.trim()
    ? htmlSource
    : '<!doctype html><html><body></body></html>'
  const sourceRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onFocusIn = (): void => {
      if (sourceRef.current && !sourceRef.current.contains(document.activeElement)) {
        setEditing(false)
      }
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

  return (
    <NodeViewWrapper className="html-block" data-html-editing={editing ? 'true' : 'false'}>
      <div className="html-preview">
          <iframe title="HTML 预览" sandbox="" srcDoc={previewSource} />
        <button
          type="button"
          className="html-preview-edit"
          aria-label="编辑 HTML 源码"
          title="编辑 HTML 源码"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => setEditing(true)}
        >
          编辑源码
        </button>
      </div>
      <div
        className="html-source"
        ref={sourceRef}
        aria-hidden={!editing}
        onFocus={() => setEditing(true)}
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as globalThis.Node | null)) {
            setEditing(false)
          }
        }}
      >
           <div className="block-source-header html-source-header">
             <span>HTML</span>
            <button
            type="button"
            className="block-module-delete"
            aria-label="删除 HTML 模块"
            title="删除 HTML 模块"
            onMouseDown={(event) => event.preventDefault()}
            onClick={deleteNode}
          >
            删除
          </button>
        </div>
        <pre className="html-source-code">
          <code className="language-html">
            <NodeViewContent />
          </code>
        </pre>
      </div>
    </NodeViewWrapper>
  )
}

/**
 * Node view for `codeBlock` nodes whose language is `mermaid`. It renders the
 * diagram preview on top and keeps the editable source (ProseMirror content)
 * below, re-rendering the preview with a 200ms debounce.
 */
function MermaidBlockView({ node, selected, editor, getPos, deleteNode }: NodeViewProps): React.JSX.Element {
  const [svg, setSvg] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [rendering, setRendering] = useState(false)
  const [editing, setEditing] = useState(selected)
  const renderId = useRef<number>(nextId())
  const mermaidSource = node.textContent
  const theme = useTheme()

  useEffect(() => {
    const updateEditing = (): void => {
      const position = getPos()
      if (position === undefined) {
        return
      }
      const selection = editor.state.selection
      const inside = selection.from > position && selection.from < position + node.nodeSize
      setEditing(inside || selected)
    }

    updateEditing()
    editor.on('selectionUpdate', updateEditing)
    return () => {
      editor.off('selectionUpdate', updateEditing)
    }
  }, [editor, getPos, node.nodeSize, selected])

  const enterEditMode = (): void => {
    const position = getPos()
    if (position === undefined) {
      return
    }
    editor.commands.focus()
    editor.commands.setTextSelection(position + 1)
  }

  useEffect(() => {
    let cancelled = false

    const timer = setTimeout(async () => {
      if (!mermaidSource.trim()) {
        if (!cancelled) {
          setSvg(null)
          setError(null)
          setRendering(false)
        }
        return
      }

      setRendering(true)
      try {
        const mermaid = await loadMermaid()
        const cfg = getMermaidConfig()
        const key = JSON.stringify(cfg)
        if (key !== mermaidConfigKey) {
          mermaid.initialize({
            startOnLoad: false,
            securityLevel: 'strict',
            ...cfg
          })
          mermaidConfigKey = key
        }
        const { svg: rendered } = await mermaid.render(`mermaid-${renderId.current}`, mermaidSource)
        if (!cancelled) {
          setSvg(rendered)
          setError(null)
          setRendering(false)
        }
      } catch (err) {
        if (!cancelled) {
          setSvg(null)
          setError(err instanceof Error ? err.message : String(err))
          setRendering(false)
        }
      }
    }, 200)

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [mermaidSource, theme])

  return (
    <NodeViewWrapper
      className="mermaid-block"
      data-mermaid-rendered={svg ? '1' : '0'}
      data-mermaid-editing={editing ? 'true' : 'false'}
    >
      <div className="mermaid-preview" onMouseDown={enterEditMode}>
        {svg ? (
          <div className="mermaid-svg" dangerouslySetInnerHTML={{ __html: svg }} />
        ) : error ? (
          <div className="mermaid-error" title={error}>
            图表渲染失败，请检查语法
          </div>
        ) : rendering ? (
          <div className="mermaid-loading">渲染中…</div>
        ) : (
          <div className="mermaid-empty">Mermaid 图表</div>
        )}
      </div>
      <div className="mermaid-source" aria-hidden={!editing}>
        <div className="block-source-header mermaid-source-header">
          <span>Mermaid</span>
          <button
            type="button"
            className="block-module-delete"
            aria-label="删除 Mermaid 模块"
            title="删除 Mermaid 模块"
            onMouseDown={(event) => event.preventDefault()}
            onClick={deleteNode}
          >
            删除
          </button>
        </div>
        <pre>
          <code>
            <NodeViewContent />
          </code>
        </pre>
      </div>
    </NodeViewWrapper>
  )
}

export function CodeBlockNodeView(props: NodeViewProps): React.JSX.Element {
  switch (getCodeBlockViewType(props.node)) {
    case 'html':
      return <HtmlPreviewView {...props} />
    case 'mermaid':
      return <MermaidBlockView {...props} />
    default:
      return <GenericCodeBlockView {...props} />
  }
}
