import { describe, expect, it } from 'vitest'
import { decodeUrlPath, encodeUrlValue } from '../url'

describe('URL field values', () => {
  it('encodes illegal URL characters without double-encoding existing escapes', () => {
    expect(encodeUrlValue('https://example.com/目录/my image.png?x=hello world')).toBe('https://example.com/%E7%9B%AE%E5%BD%95/my%20image.png?x=hello%20world')
    expect(encodeUrlValue('https://example.com/my%20image.png')).toBe('https://example.com/my%20image.png')
  })

  it('removes editor-entered quotes and decodes local URL paths for resolution', () => {
    expect(encodeUrlValue('"folder/my image.png"')).toBe('folder/my%20image.png')
    expect(decodeUrlPath('folder/my%20image.png')).toBe('folder/my image.png')
  })
})
