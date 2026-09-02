import { describe, expect, it } from 'vitest'
import { collapseSegments, isAbsolutePath, mediaUrlToPath, resolveRelative } from '../path'

describe('cross-platform media paths', () => {
  it.each([
    ['C:/docs/assets/image.svg', true],
    ['C:\\docs\\assets\\image.svg', true],
    ['/Users/alex/docs/assets/image.svg', false],
    ['/home/alex/docs/assets/image.svg', false]
  ])('recognizes Windows absolute paths without misclassifying POSIX paths: %s', (value, absolute) => {
    expect(isAbsolutePath(value)).toBe(absolute)
  })

  it('resolves Windows and POSIX relative paths consistently', () => {
    expect(resolveRelative('C:/docs', '../assets/my%20image.svg')).toBe('C:/assets/my%20image.svg')
    expect(resolveRelative('/Users/alex/docs', '../assets/my%20image.svg')).toBe('/Users/alex/assets/my%20image.svg')
    expect(collapseSegments('/home/alex/docs/../../assets/image.svg')).toBe('/home/assets/image.svg')
  })

  it('decodes media URLs with spaces and drive letters', () => {
    expect(mediaUrlToPath('media://c/Users/alex/My%20Images/photo.svg')).toBe('c:/Users/alex/My Images/photo.svg')
    expect(mediaUrlToPath('media:///home/alex/My%20Images/photo.svg')).toBe('/home/alex/My Images/photo.svg')
  })
})
