import type { MarkdownAppApi } from '../../shared/types'

declare global {
  interface Window {
    markdownApp: MarkdownAppApi
  }
}

export {}
