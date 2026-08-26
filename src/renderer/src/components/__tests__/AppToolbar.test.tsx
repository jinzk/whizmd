import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { AppToolbar } from '../AppToolbar'

describe('AppToolbar', () => {
  it('exposes the geometry drawing entry point', () => {
    const onDrawGeometry = vi.fn()
    render(<AppToolbar mode="wysiwyg" docTitle="test" dirty={false} saveStatus="idle" onNew={vi.fn()} onSave={vi.fn()} onModeChange={vi.fn()} onSettings={vi.fn()} onDrawGeometry={onDrawGeometry} />)
    fireEvent.click(screen.getByRole('button', { name: '画图(测试)' }))
    expect(onDrawGeometry).toHaveBeenCalledOnce()
  })
})
