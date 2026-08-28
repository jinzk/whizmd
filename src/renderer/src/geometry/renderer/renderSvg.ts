import { getGeometryObjects, type GeometryDocument, type GeometryObject, type GeometrySegment } from '../core/model'
import { getArcAngles, resolveArcPoint, resolveEllipseGeometry } from '../core/calculations'

type Bounds = { minX: number; minY: number; maxX: number; maxY: number }

function getRenderableGeometryObjects(document: GeometryDocument): GeometryObject[] {
  return [...getGeometryObjects(document, 'point'), ...getGeometryObjects(document, 'segment'), ...getGeometryObjects(document, 'circle'), ...getGeometryObjects(document, 'ellipse'), ...getGeometryObjects(document, 'arc'), ...getGeometryObjects(document, 'text')]
}

function growBounds(bounds: Bounds | null, x1: number, y1: number, x2: number, y2: number): Bounds {
  if (!bounds) return { minX: x1, minY: y1, maxX: x2, maxY: y2 }
  return {
    minX: Math.min(bounds.minX, x1),
    minY: Math.min(bounds.minY, y1),
    maxX: Math.max(bounds.maxX, x2),
    maxY: Math.max(bounds.maxY, y2)
  }
}

/** Rough on-screen extent of a text run at the SVG default 16px font size. */
function textExtent(text: string): { width: number; height: number } {
  return { width: text.length * 10 + 4, height: 16 }
}

function contentBounds(document: GeometryDocument): Bounds | null {
  const points = new Map(getGeometryObjects(document, 'point').map((point) => [point.id, point]))
  let bounds: Bounds | null = null
  for (const object of getRenderableGeometryObjects(document)) {
    if (object.type === 'point') {
      bounds = growBounds(bounds, object.x - 4, object.y - 4, object.x + 4, object.y + 4)
      if (object.label) {
        const extent = textExtent(object.label)
        bounds = growBounds(bounds, object.x + 6, object.y - 8 - extent.height, object.x + 8 + extent.width, object.y - 4)
      }
      continue
    }
    if (object.type === 'text') {
      const extent = textExtent(object.text)
      bounds = growBounds(bounds, object.x - 2, object.y - extent.height, object.x + extent.width, object.y + 3)
      continue
    }
    if (object.type === 'circle') {
      const center = points.get(object.center)
      if (center) bounds = growBounds(bounds, center.x - object.radius - 1, center.y - object.radius - 1, center.x + object.radius + 1, center.y + object.radius + 1)
      continue
    }
    if (object.type === 'ellipse') {
      const geometry = resolveEllipseGeometry(document, object)
      if (geometry) {
        const cos = Math.cos(geometry.rotation)
        const sin = Math.sin(geometry.rotation)
        const extentX = Math.sqrt(geometry.radiusX ** 2 * cos ** 2 + geometry.radiusY ** 2 * sin ** 2) + 1
        const extentY = Math.sqrt(geometry.radiusX ** 2 * sin ** 2 + geometry.radiusY ** 2 * cos ** 2) + 1
        bounds = growBounds(bounds, geometry.center.x - extentX, geometry.center.y - extentY, geometry.center.x + extentX, geometry.center.y + extentY)
      }
      continue
    }
    if (object.type === 'arc') {
      const center = points.get(object.center)
      if (!center) continue
      const { startAngle, endAngle } = getArcAngles(document, object)
      const samples = 24
      for (let index = 0; index <= samples; index += 1) {
        const angle = startAngle + ((endAngle - startAngle) * index) / samples
        const point = resolveArcPoint(center, object.radius, angle)
        bounds = growBounds(bounds, point.x - 1.5, point.y - 1.5, point.x + 1.5, point.y + 1.5)
      }
      continue
    }
    const segment = object as GeometrySegment
    const start = points.get(segment.start)
    const end = points.get(segment.end)
    if (start && end) bounds = growBounds(bounds, start.x - 1, start.y - 1, end.x + 1, end.y + 1)
  }
  return bounds
}

export function renderGeometrySvg(document: GeometryDocument): string {
  const points = new Map(getGeometryObjects(document, 'point').map((point) => [point.id, point]))
  const body = getRenderableGeometryObjects(document).map((object) => {
    if (object.type === 'point') return `<circle cx="${object.x}" cy="${object.y}" r="${object.size ?? 5}" fill="${object.color ?? '#0969da'}" />${object.label ? `<text x="${object.x + 8}" y="${object.y - 8}" fill="#24292f">${escapeXml(object.label)}</text>` : ''}`
    if (object.type === 'text') return `<text x="${object.x}" y="${object.y}" fill="${object.color ?? '#24292f'}" font-size="${object.fontSize ?? 14}"${object.rotation ? ` transform="rotate(${object.rotation} ${object.x} ${object.y})"` : ''}>${escapeXml(object.text)}</text>`
    if (object.type === 'circle') {
      const center = points.get(object.center)
      if (!center) return ''
      const dash = object.lineStyle === 'dashed' ? ' stroke-dasharray="8 6"' : object.lineStyle === 'dotted' ? ' stroke-dasharray="2 5"' : ''
      return `<circle cx="${center.x}" cy="${center.y}" r="${object.radius}" fill="none" stroke="${object.color ?? '#24292f'}" stroke-width="${object.lineWidth ?? 2}"${dash} />`
    }
    if (object.type === 'ellipse') {
      const geometry = resolveEllipseGeometry(document, object)
      if (!geometry) return ''
      const degrees = (geometry.rotation * 180) / Math.PI
      const dash = object.lineStyle === 'dashed' ? ' stroke-dasharray="8 6"' : object.lineStyle === 'dotted' ? ' stroke-dasharray="2 5"' : ''
      return `<ellipse cx="${geometry.center.x}" cy="${geometry.center.y}" rx="${geometry.radiusX}" ry="${geometry.radiusY}" transform="rotate(${degrees} ${geometry.center.x} ${geometry.center.y})" fill="none" stroke="${object.color ?? '#24292f'}" stroke-width="${object.lineWidth ?? 2}"${dash} />`
    }
    if (object.type === 'arc') {
      const center = points.get(object.center)
      if (!center) return ''
      const { startAngle, endAngle } = getArcAngles(document, object)
      const start = resolveArcPoint(center, object.radius, startAngle)
      const end = resolveArcPoint(center, object.radius, endAngle)
      const twoPi = Math.PI * 2
      const span = ((endAngle - startAngle) % twoPi + twoPi) % twoPi
      const largeArc = span > Math.PI ? 1 : 0
      const dash = object.lineStyle === 'dashed' ? ' stroke-dasharray="8 6"' : object.lineStyle === 'dotted' ? ' stroke-dasharray="2 5"' : ''
      return `<path d="M ${start.x} ${start.y} A ${object.radius} ${object.radius} 0 ${largeArc} 1 ${end.x} ${end.y}" fill="none" stroke="${object.color ?? '#24292f'}" stroke-width="${object.lineWidth ?? 2}"${dash} />`
    }
    const segment = object as GeometrySegment
    const start = points.get(segment.start)
    const end = points.get(segment.end)
    const dash = segment.lineStyle === 'dashed' ? ' stroke-dasharray="8 6"' : segment.lineStyle === 'dotted' ? ' stroke-dasharray="2 5"' : ''
    return start && end ? `<line x1="${start.x}" y1="${start.y}" x2="${end.x}" y2="${end.y}" stroke="${segment.color ?? '#24292f'}" stroke-width="${segment.lineWidth ?? 2}"${dash} />` : ''
  }).join('')
  const metadata = escapeXml(JSON.stringify(document))

  // 视图框贴合实际内容：按内容尺寸留出比例化边白，避免固定画布产生大片空白；
  // 内容为空时退回完整画布。坐标保持原值，仅裁剪视图窗口。
  const bounds = contentBounds(document)
  let viewBoxX = 0
  let viewBoxY = 0
  let width = document.width
  let height = document.height
  if (bounds) {
    const contentWidth = bounds.maxX - bounds.minX
    const contentHeight = bounds.maxY - bounds.minY
    const padding = Math.round(Math.min(48, Math.max(12, Math.max(contentWidth, contentHeight) * 0.06)))
    viewBoxX = Math.round((bounds.minX - padding) * 100) / 100
    viewBoxY = Math.round((bounds.minY - padding) * 100) / 100
    width = Math.ceil(contentWidth + padding * 2)
    height = Math.ceil(contentHeight + padding * 2)
  }
  // 显式像素尺寸：缺少 width/height 的 SVG 在 <img> 中没有固有尺寸，
  // 浏览器会退化为默认小尺寸渲染。
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="${viewBoxX} ${viewBoxY} ${width} ${height}"><metadata id="whizmd-geometry">${metadata}</metadata>${body}</svg>`
}

function escapeXml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
