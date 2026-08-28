import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { addCircle, addPoint, addSegment, createGeometryDocument } from '../../../geometry'
import { GeometrySidePanel } from '../GeometrySidePanel'

function documentWithSegment() {
  let document = addPoint(createGeometryDocument(), 0, 0)
  document = addPoint(document, 100, 0)
  return addSegment(document, 'P1', 'P2')
}

function documentWithCircle() {
  const document = addPoint(createGeometryDocument(), 50, 50)
  return addCircle(document, 'P1', 40)
}

describe('GeometrySidePanel styles', () => {
  it('commits point color and size changes', () => {
    const commit = vi.fn()
    const document = addPoint(createGeometryDocument(), 10, 20)
    render(<GeometrySidePanel document={document} selectedIds={['P1']} commit={commit} onClearSelection={vi.fn()} />)

    fireEvent.change(screen.getByRole('spinbutton', { name: '点大小' }), { target: { value: '8' } })
    fireEvent.change(screen.getByLabelText('颜色'), { target: { value: '#ff0000' } })

    expect(commit).toHaveBeenCalledTimes(2)
    expect(commit.mock.calls[0][0].points[0]).toMatchObject({ size: 8 })
    expect(commit.mock.calls[1][0].points[0]).toMatchObject({ color: '#ff0000' })
  })

  it('commits line color, width, and dash style changes', () => {
    const commit = vi.fn()
    const document = documentWithSegment()
    render(<GeometrySidePanel document={document} selectedIds={['S1']} commit={commit} onClearSelection={vi.fn()} />)

    fireEvent.change(screen.getByLabelText('颜色'), { target: { value: '#00ff00' } })
    fireEvent.change(screen.getByRole('spinbutton', { name: '线宽' }), { target: { value: '4' } })
    fireEvent.change(screen.getByRole('combobox', { name: '线型' }), { target: { value: 'dashed' } })

    expect(commit).toHaveBeenCalledTimes(3)
    expect(commit.mock.calls[0][0].segments[0]).toMatchObject({ color: '#00ff00' })
    expect(commit.mock.calls[1][0].segments[0]).toMatchObject({ lineWidth: 4 })
    expect(commit.mock.calls[2][0].segments[0]).toMatchObject({ lineStyle: 'dashed' })
  })

  it('commits curve color, width, and dash style changes', () => {
    const commit = vi.fn()
    const document = documentWithCircle()
    render(<GeometrySidePanel document={document} selectedIds={['C1']} commit={commit} onClearSelection={vi.fn()} />)

    fireEvent.change(screen.getByLabelText('颜色'), { target: { value: '#ff0000' } })
    fireEvent.change(screen.getByRole('spinbutton', { name: '线宽' }), { target: { value: '5' } })
    fireEvent.change(screen.getByRole('combobox', { name: '线型' }), { target: { value: 'dotted' } })

    expect(commit).toHaveBeenCalledTimes(3)
    expect(commit.mock.calls[0][0].curves[0]).toMatchObject({ color: '#ff0000' })
    expect(commit.mock.calls[1][0].curves[0]).toMatchObject({ lineWidth: 5 })
    expect(commit.mock.calls[2][0].curves[0]).toMatchObject({ lineStyle: 'dotted' })
  })
})
