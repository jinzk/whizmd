let mermaidInstance: typeof import('mermaid')['default'] | null = null
let mermaidConfigKey = ''

export function nextMermaidId(counter: { value: number }): number { counter.value += 1; return counter.value }

export async function loadMermaid(): Promise<typeof import('mermaid')['default']> {
  if (!mermaidInstance) mermaidInstance = (await import('mermaid')).default
  return mermaidInstance
}

export function mermaidConfigChanged(config: object): boolean {
  const key = JSON.stringify(config)
  if (key === mermaidConfigKey) return false
  mermaidConfigKey = key
  return true
}

export function getMermaidConfig() {
  const rootStyle = getComputedStyle(document.documentElement)
  const cssVar = (name: string, fallback: string): string => rootStyle.getPropertyValue(name).trim() || fallback
  const isDark = document.documentElement.dataset.theme === 'dark'
  if (cssVar('--md-mermaid-primary', '') !== '') return { theme: 'base' as const, themeVariables: {
    primaryColor: cssVar('--md-mermaid-primary', '#dff1ff'), primaryTextColor: cssVar('--md-mermaid-primary-text', '#1f2328'), primaryBorderColor: cssVar('--md-mermaid-primary-border', '#79c0ff'), secondaryColor: cssVar('--md-mermaid-secondary', '#f0f8e8'), secondaryTextColor: cssVar('--md-mermaid-secondary-text', '#1f2328'), secondaryBorderColor: cssVar('--md-mermaid-secondary-border', '#7ee787'), tertiaryColor: cssVar('--md-mermaid-tertiary', '#f6f8fa'), lineColor: cssVar('--md-mermaid-line', '#6e7781'), textColor: cssVar('--md-mermaid-text', '#24292f'), mainBkg: cssVar('--md-mermaid-background', '#ffffff'), nodeBkg: cssVar('--md-mermaid-background', '#ffffff'), nodeBorder: cssVar('--md-mermaid-node-border', '#d0d7de'), clusterBkg: cssVar('--md-mermaid-background', '#ffffff'), clusterBorder: cssVar('--md-mermaid-node-border', '#d0d7de'), edgeLabelBackground: cssVar('--md-mermaid-background', '#ffffff'), fontFamily: cssVar('--md-mermaid-font', 'inherit')
  } }
  return { theme: (isDark ? 'dark' : 'default') as 'dark' | 'default' }
}

export function initializeMermaid(mermaid: typeof import('mermaid')['default'], config: ReturnType<typeof getMermaidConfig>): void {
  if (mermaidConfigChanged(config)) mermaid.initialize({ startOnLoad: false, securityLevel: 'strict', ...config })
}
