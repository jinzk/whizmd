import { EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { Editor } from '@tiptap/core'
import type { AnyExtension, JSONContent } from '@tiptap/core'
import { NodeSelection } from '@tiptap/pm/state'
import { fireEvent, render, screen } from '@testing-library/react'
import { act } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { InlineMath } from '../math'
import { InlineSyntax } from '../inlineSyntax'
import { InlineDecoration } from '../syntax/inlineDecoration'
import { LinkNode } from '../link'
import { Image } from '../image'
import { InlineHtml } from '../inlineHtml'
import { HtmlBlock } from '../htmlBlock'
import { DefinitionListItem } from '../syntax/definitionList'
import { MarkdownAlert } from '../syntax/alert'
import { FootnoteReference, FootnoteDefinition } from '../syntax/footnote'
import { ReferenceDefinition } from '../syntax/referenceDefinition'
import { ImageLinkNode } from '../imageLink'

const mounted: Array<{ editor: Editor; unmount: () => void }> = []

afterEach(() => {
  for (const { editor, unmount } of mounted.splice(0)) {
    unmount()
    editor.destroy()
  }
  document.body.innerHTML = ''
})

async function mount(content: JSONContent[], extensions: AnyExtension[]): Promise<Editor> {
  const editor = new Editor({ extensions, content: { type: 'doc', content } })
  await act(async () => {
    const result = render(<EditorContent editor={editor} />)
    mounted.push({ editor, unmount: result.unmount })
    await Promise.resolve()
  })
  return editor
}

function json(editor: Editor): any {
  return editor.getJSON()
}

async function event(callback: () => void): Promise<void> {
  await act(async () => {
    callback()
    await Promise.resolve()
  })
}

const baseExtensions = [StarterKit.configure({ codeBlock: false })]

describe('NodeView DOM interactions', () => {
  it('edits, cancels, commits, and deletes inline decoration nodes', async () => {
    const editor = await mount([{ type: 'paragraph', content: [{ type: 'inlineDecoration', attrs: { kind: 'highlight', value: 'old' } }] }], [...baseExtensions, InlineDecoration])

    await event(() => fireEvent.click(screen.getByRole('button', { name: '编辑高亮' })))
    const input = screen.getByRole('textbox', { name: '编辑高亮' }) as HTMLInputElement
    expect(input).toHaveValue('old')
    await event(() => fireEvent.change(input, { target: { value: 'cancelled' } }))
    await event(() => fireEvent.keyDown(input, { key: 'Escape' }))
    expect(json(editor).content?.[0].content?.[0].attrs?.value).toBe('old')

    await event(() => fireEvent.click(screen.getByRole('button', { name: '编辑高亮' })))
    await event(() => fireEvent.change(screen.getByRole('textbox', { name: '编辑高亮' }), { target: { value: 'new' } }))
    await event(() => fireEvent.keyDown(screen.getByRole('textbox', { name: '编辑高亮' }), { key: 'Enter' }))
    expect(json(editor).content?.[0].content?.[0].attrs?.value).toBe('new')

    await event(() => fireEvent.click(screen.getByRole('button', { name: '编辑高亮' })))
    const deleteButton = screen.getByRole('button', { name: '删除高亮' })
    await event(() => fireEvent.click(deleteButton))
    expect(json(editor).content?.[0].content).toBeUndefined()
  })

  it('edits inline syntax and inline math through their real preview buttons', async () => {
    const editor = await mount([{ type: 'paragraph', content: [
      { type: 'inlineSyntax', attrs: { kind: 'bold', value: 'bold' } },
      { type: 'text', text: ' ' },
      { type: 'inlineMath', attrs: { latex: 'x' } }
    ] }], [...baseExtensions, InlineSyntax, InlineMath])

    await event(() => fireEvent.click(screen.getByRole('button', { name: '编辑粗体' })))
    const syntaxInput = screen.getByRole('textbox', { name: '编辑粗体' })
    await event(() => fireEvent.change(syntaxInput, { target: { value: 'strong' } }))
    await event(() => fireEvent.blur(syntaxInput))
    expect(json(editor).content?.[0].content?.[0].attrs?.value).toBe('strong')

    await event(() => fireEvent.click(screen.getByRole('button', { name: '编辑行内公式 x' })))
    const mathInput = screen.getByRole('textbox', { name: '编辑行内公式' })
    await event(() => fireEvent.change(mathInput, { target: { value: 'x^2' } }))
    await event(() => fireEvent.keyDown(mathInput, { key: 'Enter' }))
    expect(json(editor).content?.[0].content?.[2].attrs?.latex).toBe('x^2')
  })

  it('edits link, image, and inline HTML NodeViews', async () => {
    Object.defineProperty(window, 'markdownApp', { value: { mediaUrl: (value: string) => value }, configurable: true })
    await mount([{ type: 'paragraph', content: [
      { type: 'linkNode', attrs: { text: 'site', href: 'https://old.test', reference: null } },
      { type: 'text', text: ' ' },
      { type: 'image', attrs: { src: 'data:image/png;base64,AA==', alt: 'old', width: null, reference: null } },
      { type: 'text', text: ' ' },
      { type: 'inlineHtml', attrs: { html: '<mark>old</mark>' } }
    ] }], [...baseExtensions, LinkNode, Image, InlineHtml])

    await event(() => fireEvent.click(screen.getByRole('button', { name: '编辑链接' })))
    const linkText = screen.getByRole('textbox', { name: '链接文字' }) as HTMLInputElement
    expect(linkText).toHaveValue('site')

    await event(() => fireEvent.click(screen.getByRole('button', { name: '编辑图片' })))
    expect(screen.getByRole('textbox', { name: '图片说明' })).toHaveValue('old')

    await event(() => fireEvent.click(screen.getByRole('button', { name: '编辑 HTML 标签' })))
    const html = screen.getByRole('textbox', { name: '编辑 HTML 标签' })
    expect(html).toHaveValue('<mark>old</mark>')
  })

  it('uses the image editor fields and adds the link address field for image links', async () => {
    const editor = await mount([{ type: 'paragraph', content: [
      { type: 'imageLinkNode', attrs: { src: 'data:image/png;base64,AA==', alt: 'old', title: 'title', href: 'https://old.test', reference: null } }
    ] }], [...baseExtensions, ImageLinkNode])

    await event(() => fireEvent.click(screen.getByRole('button', { name: '编辑图片链接' })))
    const imageLinkEditor = document.querySelector('.image-link-editor')
    expect(document.querySelector('.image-link-node')).toHaveClass('image-link-node')
    expect(imageLinkEditor?.querySelector('.image-link-preview')).toBeInTheDocument()
    expect(imageLinkEditor?.querySelector('.image-link-fields')).toBeInTheDocument()
    expect(imageLinkEditor?.children[0]).toHaveClass('image-link-preview')
    expect(imageLinkEditor?.children[1]).toHaveClass('image-link-fields')
    expect(screen.getByRole('textbox', { name: '图片说明' })).toHaveValue('old')
    expect(screen.getByRole('textbox', { name: '图片 src' })).toHaveValue('data:image/png;base64,AA==')
    expect(screen.getByRole('textbox', { name: '图片标题' })).toHaveValue('title')
    expect(screen.getByRole('textbox', { name: '链接地址' })).toHaveValue('https://old.test')
    await event(() => fireEvent.change(screen.getByRole('textbox', { name: '图片说明' }), { target: { value: 'updated' } }))
    expect(document.querySelector('[data-image-link-editing="true"]')).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: '图片说明' })).toHaveValue('updated')
    const href = screen.getByRole('textbox', { name: '链接地址' })
    await event(() => {
      fireEvent.change(href, { target: { value: 'h' } })
      fireEvent.keyDown(href, { key: 't' })
      fireEvent.change(href, { target: { value: 'ht' } })
      fireEvent.keyDown(href, { key: 't' })
      fireEvent.change(href, { target: { value: 'htt' } })
    })
    expect(document.querySelector('[data-image-link-editing="true"]')).toBeInTheDocument()
    await event(() => fireEvent.keyDown(href, { key: 'x' }))
    expect(document.querySelector('[data-image-link-editing="true"]')).toBeInTheDocument()
    expect(json(editor).content?.[0].content?.[0]).toMatchObject({ type: 'imageLinkNode' })
    await event(() => fireEvent.blur(href, { relatedTarget: document.body }))
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)) })
    expect(json(editor).content?.[0].content?.[0]).toMatchObject({ type: 'imageLinkNode' })
    expect(document.querySelector('.image-link-preview-wrap')).toHaveClass('image-preview')
    expect(document.querySelector('.image-link-preview-wrap .image-edit-button')).toBeInTheDocument()
    expect(document.querySelector('.image-link-arrow')).toBeInTheDocument()
    expect(document.querySelector('.image-link-anchor img')).toBeInTheDocument()
  })

  it('shows image edit buttons when the preview image fails to load', async () => {
    Object.defineProperty(window, 'markdownApp', { value: { mediaUrl: (value: string) => value }, configurable: true })
    await mount([{ type: 'paragraph', content: [
      { type: 'image', attrs: { src: 'data:image/png;base64,AA==', alt: 'image', width: null, title: null, reference: null } },
      { type: 'text', text: ' ' },
      { type: 'imageLinkNode', attrs: { src: 'data:image/png;base64,BB==', alt: 'linked image', title: null, href: 'https://example.com', reference: null } }
    ] }], [...baseExtensions, Image, ImageLinkNode])

    const image = document.querySelector('.image-node img') as HTMLImageElement
    await event(() => fireEvent.error(image))
    await event(() => fireEvent.mouseEnter(document.querySelector('.image-preview') as HTMLElement))
    expect(screen.getByRole('button', { name: '编辑图片' })).toHaveClass('visible')

    await event(() => fireEvent.error(document.querySelector('.image-link-preview-wrap img') as HTMLImageElement))
    await event(() => fireEvent.mouseEnter(document.querySelector('.image-link-preview-wrap') as HTMLElement))
    expect(screen.getByRole('button', { name: '编辑图片链接' })).toHaveClass('visible')
  })

  it('exposes geometry editing for SVG image sources', async () => {
    const listener = vi.fn()
    window.addEventListener('whizmd:edit-geometry', listener)
    await mount([{ type: 'paragraph', content: [{ type: 'image', attrs: { src: 'assets/geometry.svg', alt: 'geometry', width: null, title: null, reference: null } }] }], [...baseExtensions, Image])
    await event(() => fireEvent.click(screen.getByRole('button', { name: '编辑图片' })))
    fireEvent.click(screen.getByRole('button', { name: '编辑几何图' }))
    expect(listener).toHaveBeenCalled()
    window.removeEventListener('whizmd:edit-geometry', listener)
  })

  it('exposes geometry editing from image-link fields without changing the link', async () => {
    const listener = vi.fn()
    window.addEventListener('whizmd:edit-geometry', listener)
    const editor = await mount([{ type: 'paragraph', content: [{ type: 'imageLinkNode', attrs: { src: 'assets/geometry.svg', alt: 'geometry', title: null, href: 'https://example.com', reference: null } }] }], [...baseExtensions, ImageLinkNode])
    await event(() => fireEvent.click(screen.getByRole('button', { name: '编辑图片链接' })))
    fireEvent.click(screen.getByRole('button', { name: '编辑几何图' }))
    expect(listener).toHaveBeenCalled()
    expect(json(editor).content?.[0].content?.[0]).toMatchObject({ type: 'imageLinkNode', attrs: { href: 'https://example.com' } })
    window.removeEventListener('whizmd:edit-geometry', listener)
  })

  it('keeps geometry image-link href stable when geometry editing is requested', async () => {
    const editor = await mount([{ type: 'paragraph', content: [{ type: 'imageLinkNode', attrs: { src: 'assets/geometry.svg', alt: 'geometry', title: null, href: 'https://example.com', reference: null } }] }], [...baseExtensions, ImageLinkNode])
    await event(() => fireEvent.click(screen.getByRole('button', { name: '编辑图片链接' })))
    fireEvent.click(screen.getByRole('button', { name: '编辑几何图' }))
    expect(json(editor).content?.[0].content?.[0]).toMatchObject({ type: 'imageLinkNode', attrs: { src: 'assets/geometry.svg', href: 'https://example.com' } })
  })

  it('returns an image to preview mode after the image fields lose focus', async () => {
    await mount([{ type: 'paragraph', content: [
      { type: 'image', attrs: { src: 'data:image/png;base64,AA==', alt: 'image', width: null, title: null, reference: null } }
    ] }], [...baseExtensions, Image])
    await event(() => fireEvent.click(screen.getByRole('button', { name: '编辑图片' })))
    const source = screen.getByRole('textbox', { name: '图片 src' })
    await event(() => fireEvent.blur(source, { relatedTarget: document.body }))
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)) })
    expect(document.querySelector('[data-image-editing="false"]')).toBeInTheDocument()
    expect(screen.queryByRole('textbox', { name: '图片 src' })).not.toBeInTheDocument()
  })

  it('returns image and image link nodes to preview when the editor selection leaves them', async () => {
    const editor = await mount([{ type: 'paragraph', content: [
      { type: 'image', attrs: { src: 'data:image/png;base64,AA==', alt: 'image', width: null, title: null, reference: null } },
      { type: 'text', text: 'after ' },
      { type: 'imageLinkNode', attrs: { src: 'data:image/png;base64,BB==', alt: 'linked', title: null, href: 'https://example.com', reference: null } }
    ] }], [...baseExtensions, Image, ImageLinkNode])

    await event(() => fireEvent.click(screen.getByRole('button', { name: '编辑图片' })))
    await event(() => fireEvent.click(screen.getByRole('button', { name: '编辑图片链接' })))
    expect(document.querySelector('[data-image-editing="true"]')).toBeInTheDocument()
    expect(document.querySelector('[data-image-link-editing="true"]')).toBeInTheDocument()

    await event(() => editor.commands.setTextSelection(2))
    expect(document.querySelector('[data-image-editing="true"]')).not.toBeInTheDocument()
    expect(document.querySelector('[data-image-link-editing="true"]')).not.toBeInTheDocument()
  })

  it('edits block NodeView fields and supports deletion', async () => {
    const editor = await mount([
      { type: 'definitionListItem', attrs: { term: 'old term' }, content: [{ type: 'paragraph', content: [{ type: 'text', text: 'definition' }] }] },
      { type: 'referenceDefinition', attrs: { id: 'ref', destination: 'https://old.test', title: null } },
      { type: 'markdownAlert', attrs: { kind: 'NOTE' }, content: [{ type: 'paragraph', content: [{ type: 'text', text: 'body' }] }] }
    ], [...baseExtensions, DefinitionListItem, ReferenceDefinition, MarkdownAlert])

    await event(() => fireEvent.click(screen.getByRole('button', { name: 'old term' })))
    const term = screen.getByRole('textbox', { name: '编辑术语' })
    await event(() => fireEvent.change(term, { target: { value: 'new term' } }))
    await event(() => fireEvent.keyDown(term, { key: 'Enter' }))
    expect(json(editor).content?.[0].attrs?.term).toBe('new term')

    const destination = screen.getByDisplayValue('https://old.test')
    await event(() => fireEvent.change(destination, { target: { value: 'https://new.test' } }))
    expect(json(editor).content?.[1].attrs?.destination).toBe('https://new.test')

    await event(() => fireEvent.change(screen.getByRole('combobox', { name: '提示块类型' }), { target: { value: 'WARNING' } }))
    expect(json(editor).content?.[2].attrs?.kind).toBe('WARNING')
  })

  it('hides the HTML source edit button while an HTML block is being edited', async () => {
    await mount([{ type: 'htmlBlock', attrs: { html: '<section>content</section>', htmlEditing: true } }], [...baseExtensions, HtmlBlock])

    const block = document.querySelector('[data-html-block]')
    expect(block).toHaveAttribute('data-html-editing', 'true')
    expect(screen.queryByRole('button', { name: '编辑 HTML 源码' })).not.toBeInTheDocument()
  })

  it('focuses the source editor and places the caret at the end for a new HTML block', async () => {
    const editor = await mount([{ type: 'htmlBlock', attrs: { html: '<', htmlEditing: true } }], [...baseExtensions, HtmlBlock])
    const source = screen.getByRole('textbox', { name: 'HTML 源码' }) as HTMLTextAreaElement
    await act(async () => {
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
    })

    expect(source).toHaveFocus()
    expect(source.selectionStart).toBe(source.value.length)
    expect(source.selectionEnd).toBe(source.value.length)
    expect(editor.getJSON().content?.[0]).toMatchObject({ type: 'htmlBlock', attrs: { html: '<' } })
  })

  it('updates the stored HTML source without leaving edit mode', async () => {
    const editor = await mount([{ type: 'htmlBlock', attrs: { html: '<div>old</div>', htmlEditing: true } }], [...baseExtensions, HtmlBlock])
    const source = screen.getByRole('textbox', { name: 'HTML 源码' })

    await event(() => fireEvent.change(source, { target: { value: '<div>new</div>' } }))

    expect(json(editor).content?.[0]).toMatchObject({ type: 'htmlBlock', attrs: { html: '<div>new</div>', htmlEditing: true } })
    expect(document.querySelector('[data-html-block]')).toHaveAttribute('data-html-editing', 'true')
  })

  it('preserves the caret when inserting into the middle of HTML source', async () => {
    const editor = await mount([{ type: 'htmlBlock', attrs: { html: '<div>abcd</div>', htmlEditing: true } }], [...baseExtensions, HtmlBlock])
    const source = screen.getByRole('textbox', { name: 'HTML 源码' }) as HTMLTextAreaElement
    source.focus()
    source.setSelectionRange(7, 7)
    fireEvent.select(source)

    await event(() => fireEvent.change(source, { target: { value: '<div>abXcd</div>' } }))
    await act(async () => {
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
    })

    expect(source.value).toBe('<div>abXcd</div>')
    expect(source.selectionStart).toBe(8)
    expect(source.selectionEnd).toBe(8)
    expect(editor.getJSON().content?.[0]?.attrs?.html).toBe('<div>abXcd</div>')
  })

  it('returns to preview mode only after focus leaves the source container', async () => {
    await mount([{ type: 'htmlBlock', attrs: { html: '<div>content</div>', htmlEditing: true } }], [...baseExtensions, HtmlBlock])
    const source = screen.getByRole('textbox', { name: 'HTML 源码' })
    const deleteButton = screen.getByRole('button', { name: '删除 HTML 模块' })
    const block = document.querySelector('[data-html-block]')

    await event(() => fireEvent.blur(source, { relatedTarget: deleteButton }))
    expect(block).toHaveAttribute('data-html-editing', 'true')

    await event(() => fireEvent.blur(source, { relatedTarget: document.body }))
    expect(block).toHaveAttribute('data-html-editing', 'false')
    expect(screen.getByRole('button', { name: '编辑 HTML 源码' })).toBeInTheDocument()
  })

  it('activates footnote references and renders the definition NodeView controls', async () => {
    const editor = await mount([
      { type: 'paragraph', content: [{ type: 'footnoteReference', attrs: { id: 'note' } }] },
      { type: 'footnoteDefinition', attrs: { id: 'note' }, content: [{ type: 'paragraph', content: [{ type: 'text', text: 'body' }] }] }
    ], [...baseExtensions, FootnoteReference, FootnoteDefinition])

    await event(() => fireEvent.click(screen.getByRole('button', { name: '脚注 note' })))
    expect(editor.state.selection instanceof NodeSelection && editor.state.selection.node.type.name).toBe('footnoteDefinition')
    expect(screen.getByRole('button', { name: '返回引用' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '删除' })).toBeInTheDocument()
  })

  it('creates a missing reference definition and focuses its destination field', async () => {
    const editor = await mount([{ type: 'paragraph', content: [
      { type: 'linkNode', attrs: { text: 'docs', href: 'docs', reference: 'docs' } }
    ] }], [...baseExtensions, LinkNode, ReferenceDefinition])

    await event(() => fireEvent.click(screen.getByRole('button', { name: '编辑链接' })))
    await event(() => fireEvent.click(screen.getByRole('button', { name: '创建定义' })))

    expect(json(editor).content?.[1]).toMatchObject({
      type: 'referenceDefinition',
      attrs: { id: 'docs', destination: '' }
    })
    expect(screen.getByRole('textbox', { name: '引用地址' })).toHaveFocus()
  })

  it('renames a reference definition and synchronizes link usages', async () => {
    const editor = await mount([
      { type: 'paragraph', content: [{ type: 'linkNode', attrs: { text: 'docs', href: 'url', reference: 'docs' } }] },
      { type: 'referenceDefinition', attrs: { id: 'docs', destination: 'url', title: null } }
    ], [...baseExtensions, LinkNode, ReferenceDefinition])

    const idInput = screen.getByDisplayValue('docs')
    await event(() => fireEvent.change(idInput, { target: { value: 'website' } }))
    await event(() => fireEvent.blur(idInput))
    expect(json(editor).content?.[0].content?.[0].attrs?.reference).toBe('website')
    expect(json(editor).content?.[1].attrs?.id).toBe('website')
  })

  it('asks for confirmation before deleting a referenced definition', async () => {
    const editor = await mount([
      { type: 'paragraph', content: [{ type: 'linkNode', attrs: { text: 'docs', href: 'url', reference: 'docs' } }] },
      { type: 'referenceDefinition', attrs: { id: 'docs', destination: 'url', title: null } }
    ], [...baseExtensions, LinkNode, ReferenceDefinition])

    await event(() => fireEvent.click(screen.getByRole('button', { name: '删除引用定义' })))
    expect(screen.getByText('该定义仍被引用，删除后引用将变为未定义。')).toBeInTheDocument()
    await event(() => fireEvent.click(screen.getByRole('button', { name: '仍然删除' })))
    expect(json(editor).content?.some((node: JSONContent) => node.type === 'referenceDefinition')).toBe(false)
  })
})
