export type SyntaxTrigger = {
  name: string
  endings: readonly string[]
  level: 'inline' | 'block'
  priority: number
}

// This registry documents matching order; individual extensions still own their InputRules.
export const syntaxTriggers: readonly SyntaxTrigger[] = [
  { name: 'inlineMath', endings: ['$'], level: 'inline', priority: 100 },
  { name: 'linkNode', endings: [']'], level: 'inline', priority: 90 },
  { name: 'image', endings: [')', ']'], level: 'inline', priority: 90 },
  { name: 'footnoteReference', endings: [']'], level: 'inline', priority: 90 },
  { name: 'inlineHtml', endings: ['>'], level: 'inline', priority: 80 },
  { name: 'inlineDecoration', endings: ['=', '^', '~'], level: 'inline', priority: 70 },
  { name: 'markdownAlert', endings: [']'], level: 'block', priority: 60 },
  { name: 'definitionListItem', endings: [' '], level: 'block', priority: 50 },
  { name: 'referenceDefinition', endings: [' '], level: 'block', priority: 50 }
]

export function triggersForEnding(ending: string): SyntaxTrigger[] {
  return syntaxTriggers.filter((trigger) => trigger.endings.includes(ending)).sort((a, b) => b.priority - a.priority)
}
