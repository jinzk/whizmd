import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { createRef } from 'react'
import { GeometryCanvas } from '../GeometryCanvas'

describe('GeometryCanvas', () => {
  it('provides the standard canvas semantics and forwards interaction props', () => {
    const ref = createRef<SVGSVGElement>()
    const onClick = () => undefined
    render(<GeometryCanvas canvasRef={ref} width={840} height={1188} tool="select" onClick={onClick}><circle data-testid="child" /></GeometryCanvas>)

    const canvas = screen.getByRole('img', { name: '几何图画布' })
    expect(canvas).toHaveClass('geometry-canvas', 'geometry-canvas-select')
    expect(canvas).toHaveAttribute('viewBox', '0 0 840 1188')
    expect(canvas).toHaveAttribute('tabindex', '0')
    expect(screen.getByTestId('child')).toBeInTheDocument()
  })
})
