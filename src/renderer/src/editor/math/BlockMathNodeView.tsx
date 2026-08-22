import { useEffect, useRef, useState } from 'react'
import { NodeViewWrapper } from '@tiptap/react'
import type { NodeViewProps } from '@tiptap/react'
import katex from 'katex'
import { useI18n } from '../../i18n'

export function BlockMathNodeView({
  node,
  updateAttributes,
  deleteNode,
  selected
}: NodeViewProps): React.JSX.Element {
  const latex = String(node.attrs.latex ?? '')
  const { t } = useI18n()
  const [editing, setEditing] = useState(selected || latex.length === 0)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (editing && latex.length === 0) {
      textareaRef.current?.focus()
    }
  }, [editing, latex.length])

  const preview = (() => {
    try {
      return katex.renderToString(latex, { displayMode: true, throwOnError: false })
    } catch {
      return ''
    }
  })()

  return (
    <NodeViewWrapper
      className="block-math-module"
      data-math-editing={editing ? 'true' : 'false'}
      data-selected={selected ? 'true' : 'false'}
    >
      <div
        className="block-math-preview"
        onMouseDown={(event) => {
          event.preventDefault()
          setEditing(true)
          requestAnimationFrame(() => textareaRef.current?.focus())
        }}
      >
        {preview ? (
          <div dangerouslySetInnerHTML={{ __html: preview }} />
        ) : (
           <span className="block-math-placeholder">{t('enterLatex')}</span>
        )}
      </div>
      <div className="block-math-source">
        <div className="block-source-header block-math-source-header">
          <span>LaTeX</span>
          <button
            type="button"
            className="block-module-delete"
             aria-label={t('deleteFormula')}
             title={t('deleteFormula')}
            onMouseDown={(event) => event.preventDefault()}
            onClick={deleteNode}
          >
             {t('delete')}
          </button>
        </div>
        <textarea
          ref={textareaRef}
          value={latex}
          rows={Math.max(2, Math.min(8, latex.split('\n').length + 1))}
           aria-label={t('formulaSource')}
           placeholder={t('enterLatex')}
          onFocus={() => setEditing(true)}
          onChange={(event) => updateAttributes({ latex: event.target.value })}
          onBlur={() => setEditing(false)}
        />
      </div>
    </NodeViewWrapper>
  )
}
