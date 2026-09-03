import '@testing-library/jest-dom/vitest'

Object.defineProperty(window.navigator, 'language', {
  configurable: true,
  value: 'zh-CN'
})

const zeroRect: DOMRect = {
  x: 0, y: 0, top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0,
  toJSON: () => ({})
}

if (typeof Element.prototype.getBoundingClientRect !== 'function') {
  Element.prototype.getBoundingClientRect = () => zeroRect
}

const nodeProto = Node.prototype as unknown as { getClientRects?: () => unknown }
if (!nodeProto.getClientRects) {
  Object.defineProperty(Node.prototype, 'getClientRects', {
    configurable: true,
    value: () => [zeroRect]
  })
}

if (typeof Element.prototype.scrollIntoView !== 'function') {
  Element.prototype.scrollIntoView = (): void => {}
}

const rangeProto = Range.prototype as unknown as { getClientRects?: () => unknown }
if (!rangeProto.getClientRects) {
  Object.defineProperty(Range.prototype, 'getClientRects', {
    configurable: true,
    value: () => [zeroRect]
  })
}
