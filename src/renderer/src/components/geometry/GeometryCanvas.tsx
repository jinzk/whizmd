import type { ReactNode, RefObject, SVGProps } from 'react'

type Props = {
  canvasRef: RefObject<SVGSVGElement | null>
  width: number
  height: number
  tool: string
  children: ReactNode
} & Omit<SVGProps<SVGSVGElement>, 'children' | 'ref' | 'className' | 'viewBox' | 'role' | 'aria-label' | 'tabIndex'>

export function GeometryCanvas({ canvasRef, width, height, tool, children, ...svgProps }: Props): React.JSX.Element {
  return (
    <div className="geometry-canvas-wrap">
      <svg ref={canvasRef} className={`geometry-canvas geometry-canvas-${tool}`} viewBox={`0 0 ${width} ${height}`} role="img" aria-label="几何图画布" tabIndex={0} {...svgProps}>
        {children}
      </svg>
    </div>
  )
}
