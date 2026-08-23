import type { PairedMatch, PairedTriggerRule } from './types'
import { isEscaped } from '../../inline/escape'

function findMatch(text: string, cursor: number, rule: PairedTriggerRule): PairedMatch | null {
  const { marker } = rule
  if (!text.slice(0, cursor).endsWith(marker) || isEscaped(text, cursor - marker.length)) return null
  const closingStart = cursor - marker.length
  for (let opener = closingStart - marker.length; opener >= 0; opener -= 1) {
    if (!text.startsWith(marker, opener) || isEscaped(text, opener)) continue
    if (opener > 0 && text[opener - 1] === marker[0]) continue
    if (closingStart > 0 && text[closingStart - 1] === marker[0]) continue
    const content = text.slice(opener + marker.length, closingStart)
    if (rule.accepts(content)) return { from: opener, to: cursor, content, rule }
  }
  return null
}

export function findPairedMatch(text: string, cursor: number, rules: readonly PairedTriggerRule[]): PairedMatch | null {
  return rules
    .filter((rule) => text.slice(0, cursor).endsWith(rule.marker))
    .sort((left, right) => right.priority - left.priority)
    .map((rule) => findMatch(text, cursor, rule))
    .find((match): match is PairedMatch => match !== null) ?? null
}

export function findMatchAroundCursor(text: string, cursor: number, rules: readonly PairedTriggerRule[]): PairedMatch | null {
  return rules
    .map((rule) => {
      const { marker } = rule
      for (let opener = cursor - marker.length; opener >= 0; opener -= 1) {
        if (!text.startsWith(marker, opener) || isEscaped(text, opener)) continue
        if (opener > 0 && text[opener - 1] === marker[0]) continue
        let closingStart = text.indexOf(marker, cursor)
        while (closingStart >= 0) {
          if (!isEscaped(text, closingStart) && (closingStart === 0 || text[closingStart - 1] !== marker[0])) {
            const content = text.slice(opener + marker.length, closingStart)
            if (rule.accepts(content)) return { from: opener, to: closingStart + marker.length, content, rule }
          }
          closingStart = text.indexOf(marker, closingStart + 1)
        }
      }
      return null
    })
    .sort((left, right) => (right?.rule.priority ?? -1) - (left?.rule.priority ?? -1))
    .find((match): match is PairedMatch => match !== null) ?? null
}

export function findMatchEndingBeforeCursor(text: string, cursor: number, rules: readonly PairedTriggerRule[]): PairedMatch | null {
  const candidates: Array<PairedMatch & { end: number }> = []
  for (const rule of rules) {
    let closingStart = text.lastIndexOf(rule.marker, cursor - rule.marker.length)
    while (closingStart >= 0) {
      const end = closingStart + rule.marker.length
      const match = findPairedMatch(text.slice(0, end), end, [rule])
      if (match) candidates.push({ ...match, end })
      closingStart = text.lastIndexOf(rule.marker, closingStart - 1)
    }
  }
  return candidates.sort((left, right) => right.end - left.end)[0] ?? null
}
