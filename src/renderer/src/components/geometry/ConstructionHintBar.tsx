type Props = { text: string | null }

export function ConstructionHintBar({ text }: Props): React.JSX.Element | null {
  if (!text) return null
  return (
    <div className="geometry-construction-hint" role="status">
      {text}
    </div>
  )
}
