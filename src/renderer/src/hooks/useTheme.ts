import { useEffect, useMemo, useState } from 'react'
import { useEditorStore } from '../store/editor'

export type EffectiveTheme = 'light' | 'dark'

function systemPrefersDark(): boolean {
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

/**
 * Applies the effective theme to <html data-theme> and returns it. Reacts to
 * config changes and OS preference changes (when in 'system' mode).
 */
export function useTheme(): EffectiveTheme {
  const config = useEditorStore((s) => s.config)

  const [systemDark, setSystemDark] = useState(systemPrefersDark)

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const listener = (e: MediaQueryListEvent): void => setSystemDark(e.matches)
    mq.addEventListener('change', listener)
    return () => mq.removeEventListener('change', listener)
  }, [])

  const effective = useMemo<EffectiveTheme>(() => {
    if (config?.themeMode === 'dark') {
      return 'dark'
    }
    if (config?.themeMode === 'light') {
      return 'light'
    }
    return systemDark ? 'dark' : 'light'
  }, [config, systemDark])

  useEffect(() => {
    document.documentElement.dataset.theme = effective
  }, [effective])

  return effective
}
