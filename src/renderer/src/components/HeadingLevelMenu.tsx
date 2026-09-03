import { useEffect, useState } from 'react'
import type { Editor } from '@tiptap/core'
import { useI18n } from '../i18n'

type Props = {
  editor: Editor
  pos: number
  level: number
  position: { top: number; left: number }
  menuRef: React.RefObject<HTMLDivElement | null>
  onClose: () => void
}

export function HeadingLevelMenu({ editor, pos, level, position, menuRef, onClose }: Props): React.JSX.Element {
  const { t } = useI18n()
  const [activeIndex, setActiveIndex] = useState(level - 1)
  const options = [
    { value: 1, label: `${t('heading')} 1`, preview: '# ' },
    { value: 2, label: `${t('heading')} 2`, preview: '## ' },
    { value: 3, label: `${t('heading')} 3`, preview: '### ' },
    { value: 4, label: `${t('heading')} 4`, preview: '#### ' },
    { value: 5, label: `${t('heading')} 5`, preview: '##### ' },
    { value: 6, label: `${t('heading')} 6`, preview: '###### ' },
    { value: 0, label: t('plaintext'), preview: '' }
  ]
  const activeCount = options.length

  useEffect(() => {
    menuRef.current?.querySelectorAll<HTMLButtonElement>('[role="option"]')[activeIndex]?.focus()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const choose = (value: number): void => {
    const chain = editor.chain().focus()
    if (value === 0) {
      chain.setTextSelection(pos + 1).setParagraph()
    } else {
      chain.setNodeSelection(pos).toggleNode(editor.schema.nodes.heading, editor.schema.nodes.paragraph, { level: value })
    }
    chain.run()
    onClose()
  }

  const focusOption = (index: number): void => {
    setActiveIndex(index)
    menuRef.current?.querySelectorAll<HTMLButtonElement>('[role="option"]')[index]?.focus()
  }

  const onKeyDown = (event: React.KeyboardEvent<HTMLElement>): void => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowRight') {
      event.preventDefault()
      focusOption((activeIndex + 1) % activeCount)
    } else if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') {
      event.preventDefault()
      focusOption((activeIndex - 1 + activeCount) % activeCount)
    } else if (event.key === 'Enter' || event.key === 'Tab') {
      event.preventDefault()
      choose(options[activeIndex].value)
    } else if (event.key === 'Escape') {
      event.preventDefault()
      onClose()
    }
  }

  return (
    <div className="heading-level-menu" ref={menuRef} role="listbox" onKeyDown={onKeyDown} aria-label={t('headingLevel')} style={position}>
      {options.map((option, index) => (
        <button
          key={option.value}
          type="button"
          role="option"
          tabIndex={index === activeIndex ? 0 : -1}
          aria-selected={index === activeIndex}
          data-heading-index={index}
          onFocus={() => setActiveIndex(index)}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => choose(option.value)}
        >
          <span className="heading-level-preview">{option.preview}</span>
          <span>{option.label}</span>
          {option.value === level ? <span className="heading-level-check">{t('current')}</span> : null}
        </button>
      ))}
    </div>
  )
}
