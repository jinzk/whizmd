import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { Dialog } from '../Dialog'

describe('Dialog', () => {
  it('cycles focus with Tab and closes with Escape', () => {
    const onClose = vi.fn()
    render(<Dialog title="Test" onBackdropClick={onClose}><button type="button">First</button><button type="button">Last</button></Dialog>)
    const first = screen.getByRole('button', { name: 'First' })
    const last = screen.getByRole('button', { name: 'Last' })
    last.focus()
    fireEvent.keyDown(document, { key: 'Tab' })
    expect(document.activeElement).toBe(first)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('cycles backwards with Shift+Tab', () => {
    render(<Dialog title="Test"><button type="button">First</button><button type="button">Last</button></Dialog>)
    const first = screen.getByRole('button', { name: 'First' })
    const last = screen.getByRole('button', { name: 'Last' })
    first.focus()
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true })
    expect(document.activeElement).toBe(last)
  })
})
