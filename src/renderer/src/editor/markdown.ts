import { Markdown } from '@tiptap/markdown'

/**
 * Central place to build the Markdown extension options. Individual feature
 * stores (code block, mathematics, images, mermaid) wire their custom
 * `parseMarkdown` / `renderMarkdown` specs directly into their own extension
 * definitions, so this stays minimal.
 */
export function buildMarkdownExtension() {
  return Markdown.configure({
    indentation: { style: 'space', size: 2 },
    markedOptions: {
      breaks: false,
      gfm: true
    }
  })
}
