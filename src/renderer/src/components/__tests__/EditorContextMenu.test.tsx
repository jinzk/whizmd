import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { EditorContextMenu } from '../EditorContextMenu'

describe('EditorContextMenu', () => {
  it('renders all insertion actions and reports the selected action', () => {
    const onAction = vi.fn()
    render(<EditorContextMenu position={{ left: 10, top: 20 }} onAction={onAction} onClose={vi.fn()} labels={{ image: '插入图片', link: '插入超链接', imageLink: '插入图片链接', table: '插入表格', codeBlock: '插入代码块' }} />)
    expect(screen.getAllByRole('menuitem')).toHaveLength(5)
    fireEvent.click(screen.getByRole('menuitem', { name: '插入代码块' }))
    expect(onAction).toHaveBeenCalledWith('codeBlock')
  })
})
