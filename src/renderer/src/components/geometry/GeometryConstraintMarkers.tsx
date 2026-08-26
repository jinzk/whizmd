import { getConstraintMarkers, type GeometryDocument } from '../../geometry'

type Props = { document: GeometryDocument; onRemove: (index: number) => void }

export function GeometryConstraintMarkers({ document, onRemove }: Props): React.JSX.Element {
  return (
    <>
      {getConstraintMarkers(document).map((marker) => {
        const remove = (event: React.MouseEvent) => {
          event.stopPropagation()
          onRemove(marker.index)
        }
        if (marker.kind === 'tick') {
          return <line key={`${marker.kind}-${marker.index}-${marker.x1}-${marker.y1}`} className="geometry-constraint-marker" x1={marker.x1} y1={marker.y1} x2={marker.x2} y2={marker.y2} onClick={remove} />
        }
        if (marker.kind === 'ring') {
          return <circle key={`${marker.kind}-${marker.index}-${marker.cx}`} className="geometry-constraint-marker" cx={marker.cx} cy={marker.cy} r="8" onClick={remove} />
        }
        return <path key={`${marker.kind}-${marker.index}`} className="geometry-constraint-marker" d={marker.path} onClick={remove} />
      })}
    </>
  )
}
