import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { SettingsDialog } from '../SettingsDialog'
import type { AppConfig } from '@shared/types'

const config: AppConfig = {
  themeMode: 'system',
  language: 'zh-CN',
  assetsDir: 'assets',
  imagePathStrategy: 'relative'
}

describe('SettingsDialog', () => {
  it('passes changed preferences to the apply callback', async () => {
    const onChange = vi.fn()
    const onApply = vi.fn().mockResolvedValue(undefined)

    render(<SettingsDialog config={config} onChange={onChange} onApply={onApply} onClose={vi.fn()} />)
    fireEvent.change(screen.getAllByRole('combobox')[0], { target: { value: 'dark' } })
    expect(onChange).toHaveBeenCalledWith({ ...config, themeMode: 'dark' })

    fireEvent.click(screen.getByRole('button', { name: '应用' }))
    expect(onApply).toHaveBeenCalledWith(config)
  })

  it('closes when cancel is pressed', () => {
    const onClose = vi.fn()
    render(<SettingsDialog config={config} onChange={vi.fn()} onApply={vi.fn()} onClose={onClose} />)
    fireEvent.click(screen.getByRole('button', { name: '取消' }))
    expect(onClose).toHaveBeenCalledOnce()
  })
})
