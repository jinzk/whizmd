import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { AppToolbar } from '../AppToolbar'

describe('AppToolbar', () => {
  it('does not expose the removed drawing entry point', () => {
    render(<AppToolbar mode="wysiwyg" docTitle="test" dirty={false} saveStatus="idle" onNew={vi.fn()} onSave={vi.fn()} onModeChange={vi.fn()} onSettings={vi.fn()} />)
    expect(screen.queryByRole('button', { name: '画图(实验)' })).not.toBeInTheDocument()
  })
})
