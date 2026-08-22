import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { Toast } from '../Toast'

describe('Toast', () => {
  it('renders and invokes notification actions', () => {
    const onClose = vi.fn()
    const onRetry = vi.fn()
    render(<Toast notices={[{ id: '1', type: 'error', message: 'Failed', action: { label: 'Retry', onClick: onRetry } }]} onClose={onClose} />)
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    fireEvent.click(screen.getByRole('button', { name: 'Close notification' }))
    expect(onRetry).toHaveBeenCalledOnce()
    expect(onClose).toHaveBeenCalledWith('1')
  })
})
