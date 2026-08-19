import { marked } from 'marked'
import katex from 'katex'
import katexCss from 'katex/dist/katex.min.css?raw'
import hljsCss from 'highlight.js/styles/github.min.css?raw'
import { isAbsolutePath, dirnamePath, resolveRelative } from '../utils/path'

const CODE_FENCE_RE = /```([^\n]*)\n([\s\S]*?)```/g
const INLINE_CODE_RE = /`([^`\n]+)`/g
const BLOCK_MATH_RE = /(?:^|\n)\s*(\${2,3})(?:\n([\s\S]*?)\n\s*\1|([^$\n]+)\1)/g
const INLINE_MATH_RE = /(?<!\$)\$(?!\s)(?!\d+\$)([^$\n]+?)(?<!\s)\$(?!\d)/g
const IMAGE_MARKDOWN_RE =
  /!\[([^\]]*)\]\(([^\s)]+)(?:\s+("(?:[^"\\]|\\.)*"))?(?:\s+=\s*(\d+(?:\.\d+)?)(?:x(\d+(?:\.\d+)?)?)?)?\)/g

interface ExtractedImage {
  token: string
  alt: string
  src: string
  title: string
  width: number | null
}

interface BuildOptions {
  /** Title shown in the exported document. */
  title: string
  /** Absolute path of the current document, used to resolve relative images. */
  docPath: string | null
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function renderInlineMath(latex: string): string {
  try {
    return katex.renderToString(latex, { throwOnError: false, displayMode: false })
  } catch {
    return `<code>${escapeHtml(latex)}</code>`
  }
}

function renderBlockMath(latex: string): string {
  try {
    const html = katex.renderToString(latex, { throwOnError: false, displayMode: true })
    return `<div class="math-block">${html}</div>`
  } catch {
    return `<pre><code>${escapeHtml(latex)}</code></pre>`
  }
}

function renderCodeBlock(lang: string, text: string): string {
  const language = (lang || '').trim()
  if (language === 'mermaid') {
    return `<pre class="mermaid">${escapeHtml(text)}</pre>`
  }
  const cls = language ? ` class="language-${escapeHtml(language)}"` : ''
  return `<pre><code${cls}>${escapeHtml(text)}</code></pre>`
}

async function renderMermaidExport(text: string, index: number): Promise<string> {
  try {
    const mermaid = (await import('mermaid')).default
    mermaid.initialize({ startOnLoad: false, securityLevel: 'strict', theme: 'default' })
    const result = await mermaid.render(`export-mermaid-${index}`, text)
    return result.svg
  } catch {
    return renderCodeBlock('mermaid', text)
  }
}

async function fetchAsDataUrl(url: string): Promise<string> {
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`)
  }
  const blob = await res.blob()
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(new Error('Failed to read image'))
    reader.readAsDataURL(blob)
  })
}

async function resolveImageSrc(src: string, docPath: string | null): Promise<string> {
  if (/^https?:/i.test(src) || src.startsWith('data:')) {
    return src
  }
  if (src.startsWith('media://')) {
    try {
      return await fetchAsDataUrl(src)
    } catch {
      return src
    }
  }
  let absolute: string
  if (isAbsolutePath(src)) {
    absolute = src
  } else {
    if (!docPath) {
      return src
    }
    absolute = resolveRelative(dirnamePath(docPath), src)
  }
  const mediaUrl = window.markdownApp.mediaUrl(absolute)
  try {
    return await fetchAsDataUrl(mediaUrl)
  } catch {
    return src
  }
}

function renderImageTag(image: ExtractedImage, resolvedSrc: string): string {
  const attrs = [`src="${escapeHtml(resolvedSrc)}"`]
  if (image.alt) {
    attrs.push(`alt="${escapeHtml(image.alt)}"`)
  }
  if (image.title) {
    attrs.push(`title="${escapeHtml(image.title)}"`)
  }
  if (image.width) {
    attrs.push(`style="width:${image.width}px; height:auto"`)
  }
  return `<img ${attrs.join(' ')} />`
}

function unwrapParagraph(html: string, token: string, replacement: string): string {
  return html.split(`<p>${token}</p>`).join(replacement).split(token).join(replacement)
}

/**
 * Convert markdown content into a self-contained HTML document:
 * - KaTeX CSS and highlight.js CSS are inlined, math is pre-rendered,
 * - local images are embedded as base64 data URIs, remote URLs kept as-is,
 * - mermaid fences are rendered to SVG locally when possible.
 */
export async function buildExportHtml(content: string, options: BuildOptions): Promise<string> {
  const codeBlocks: Array<{ lang: string; text: string }> = []
  const inlineCodes: string[] = []
  const inlineMath: string[] = []
  const images: ExtractedImage[] = []

  let md = content

  md = md.replace(CODE_FENCE_RE, (_m, lang, text) => {
    codeBlocks.push({ lang, text })
    return `@@CODEBLOCK${codeBlocks.length - 1}@@`
  })

  md = md.replace(INLINE_CODE_RE, (_m, text) => {
    inlineCodes.push(text)
    return `@@INLINECODE${inlineCodes.length - 1}@@`
  })

  md = md.replace(INLINE_MATH_RE, (_m, latex) => {
    inlineMath.push(latex)
    return `@@MATHINLINE${inlineMath.length - 1}@@`
  })

  md = md.replace(BLOCK_MATH_RE, (_m, _delimiter, fenced, single) => {
    return `\n${renderBlockMath((fenced ?? single ?? '').trim())}\n`
  })

  md = md.replace(IMAGE_MARKDOWN_RE, (_m, alt, src, title, width) => {
    images.push({
      token: `@@IMG${images.length}@@`,
      alt,
      src,
      title: title ? title.slice(1, -1) : '',
      width: width ? parseFloat(width) : null
    })
    return images[images.length - 1].token
  })

  const renderer = new marked.Renderer()
  renderer.html = (html) => escapeHtml(typeof html === 'string' ? html : html.raw)
  let body = marked.parse(md, { gfm: true, breaks: false, renderer }) as string

  inlineMath.forEach((latex, i) => {
    const token = `@@MATHINLINE${i}@@`
    body = body.split(token).join(renderInlineMath(latex))
  })

  inlineCodes.forEach((text, i) => {
    const token = `@@INLINECODE${i}@@`
    body = body.split(token).join(`<code>${escapeHtml(text)}</code>`)
  })

  for (const [i, block] of codeBlocks.entries()) {
    const token = `@@CODEBLOCK${i}@@`
    const replacement =
      block.lang.trim().toLowerCase() === 'mermaid'
        ? await renderMermaidExport(block.text, i)
        : renderCodeBlock(block.lang, block.text)
    body = unwrapParagraph(body, token, replacement)
  }

  for (const image of images) {
    const resolved = await resolveImageSrc(image.src, options.docPath)
    body = body.split(image.token).join(renderImageTag(image, resolved))
  }

  return `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(options.title)}</title>
    <style>${katexCss}</style>
    <style>${hljsCss}</style>
    <style>
      body {
        max-width: 860px;
        margin: 0 auto;
        padding: 32px 24px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Microsoft YaHei', sans-serif;
        font-size: 16px;
        line-height: 1.7;
        color: #24292f;
        background: #ffffff;
      }
      pre { background: #f6f8fa; padding: 12px 16px; border-radius: 6px; overflow-x: auto; }
      pre code { background: transparent; padding: 0; }
      code {
        background: #f6f8fa;
        padding: 2px 5px;
        border-radius: 4px;
        font-family: 'SFMono-Regular', Consolas, 'Courier New', monospace;
        font-size: 0.9em;
      }
      pre.mermaid { text-align: center; background: transparent; }
      img { max-width: 100%; height: auto; }
      .math-block { overflow-x: auto; margin: 16px 0; }
      table { border-collapse: collapse; }
      th, td { border: 1px solid #d0d7de; padding: 6px 12px; }
      blockquote { border-left: 4px solid #d0d7de; margin-left: 0; padding-left: 16px; color: #57606a; }
    </style>
  </head>
  <body>
    ${body}
  </body>
</html>`
}
