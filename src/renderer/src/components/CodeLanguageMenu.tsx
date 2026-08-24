import { useState } from 'react'
import type { Editor } from '@tiptap/core'
import { useI18n } from '../i18n'

const CODE_LANGUAGES = [
  ['mermaid', 'Mermaid 图表'], ['javascript', 'JavaScript'], ['typescript', 'TypeScript'], ['python', 'Python'],
  ['java', 'Java'], ['c', 'C'], ['cpp', 'C++'], ['csharp', 'C#'], ['go', 'Go'], ['rust', 'Rust'],
  ['json', 'JSON'], ['markdown', 'Markdown'], ['html', 'HTML'], ['css', 'CSS'], ['sql', 'SQL'],
  ['bash', 'Shell'], ['shell', 'Shell'], ['plaintext', '纯文本'], ['text', '纯文本']
] as const

type Props = {
  editor: Editor
  query: string
  position: { top: number; left: number }
  menuRef: React.RefObject<HTMLDivElement | null>
  onClose: () => void
}

export function CodeLanguageMenu({ editor, query, position, menuRef, onClose }: Props): React.JSX.Element {
  const { t } = useI18n()
  const [activeIndex, setActiveIndex] = useState(0)
  const languages = CODE_LANGUAGES.filter(([language]) => language.startsWith(query))
  const choose = (language: string): void => {
    const { $from } = editor.state.selection
    editor.chain().focus().deleteRange({ from: $from.start(), to: $from.end() }).setCodeBlock({ language }).run()
    onClose()
  }
  const focusOption = (index: number): void => {
    setActiveIndex(index)
    menuRef.current?.querySelectorAll<HTMLButtonElement>('[role="option"]')[index]?.focus()
  }
  const onKeyDown = (event: React.KeyboardEvent<HTMLElement>): void => {
    const current = Number((event.currentTarget as HTMLElement).getAttribute('data-language-index') ?? activeIndex)
    if (event.key === 'ArrowDown' || event.key === 'ArrowRight') {
      event.preventDefault()
      if (languages.length) focusOption((current + 1) % languages.length)
    } else if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') {
      event.preventDefault()
      if (languages.length) focusOption((current - 1 + languages.length) % languages.length)
    } else if (event.key === 'Enter' || event.key === 'Tab') {
      event.preventDefault()
      if (languages[current]) choose(languages[current][0])
    } else if (event.key === 'Escape') {
      event.preventDefault()
      onClose()
    }
  }
  return <div className="code-language-menu" ref={menuRef} role="listbox" onKeyDown={onKeyDown} aria-label={t('chooseCodeLanguage')} style={position}>
    <div className="code-language-title">{t('chooseCodeLanguage')}</div>
    {languages.map(([language, label], index) => <button key={language} type="button" role="option" tabIndex={index === activeIndex ? 0 : -1} aria-selected={index === activeIndex} data-language-index={index} onFocus={() => setActiveIndex(index)} onMouseDown={(event) => event.preventDefault()} onClick={() => choose(language)}>
      <code>{language}</code><span>{language === 'mermaid' ? t('mermaid') : language === 'plaintext' ? t('plaintext') : label}</span>
    </button>)}
  </div>
}
