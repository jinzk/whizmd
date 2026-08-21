import { EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { Editor } from '@tiptap/core'
import type { AnyExtension, JSONContent } from '@tiptap/core'
import { NodeSelection } from '@tiptap/pm/state'
import { fireEvent, render, screen } from '@testing-library/react'
import { act } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import { InlineMath } from '../math'
import { InlineSyntax } from '../inlineSyntax'
import { InlineDecoration } from '../syntax/inlineDecoration'
import { LinkNode } from '../link'
import { Image } from '../image'
import { InlineHtml } from '../inlineHtml'
import { DefinitionListItem } from '../syntax/definitionList'
import { MarkdownAlert } from '../syntax/alert'
import { FootnoteReference, FootnoteDefinition } from '../syntax/footnote'
import { ReferenceDefinition } from '../syntax/referenceDefinition'

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

    await event(() => fireEvent.click(screen.getByRole('button', { name: '编辑公式 x' })))
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

    await event(() => fireEvent.click(screen.getByRole('link', { name: 'site' })))
    const linkText = screen.getByRole('textbox', { name: '链接文字' }) as HTMLInputElement
    expect(linkText).toHaveValue('site')

    await event(() => fireEvent.click(screen.getByAltText('old')))
    expect(screen.getByRole('textbox', { name: '图片说明' })).toHaveValue('old')

    await event(() => fireEvent.click(screen.getByRole('button', { name: '编辑 HTML 标签' })))
    const html = screen.getByRole('textbox', { name: '编辑 HTML 标签' })
    expect(html).toHaveValue('<mark>old</mark>')
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

    await event(() => fireEvent.click(screen.getByRole('link', { name: 'docs' })))
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

    await event(() => fireEvent.click(screen.getAllByRole('button', { name: '删除' })[0]))
    expect(screen.getByText('该定义仍被引用，删除后引用将变为未定义。')).toBeInTheDocument()
    await event(() => fireEvent.click(screen.getByRole('button', { name: '仍然删除' })))
    expect(json(editor).content?.some((node: JSONContent) => node.type === 'referenceDefinition')).toBe(false)
  })
})
