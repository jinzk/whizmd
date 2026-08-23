export function encodeUrlValue(value: string): string {
  const trimmed = value.trim()
  const unquoted = trimmed.length >= 2 &&
    ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'")))
    ? trimmed.slice(1, -1)
    : trimmed
  const protectedEscapes: string[] = []
  const protectedValue = unquoted.replace(/%[0-9a-f]{2}/gi, (escape) => {
    const index = protectedEscapes.push(escape) - 1
    return `__WHIZMD_PERCENT_${index}__`
  })
  const encoded = encodeURI(protectedValue)
  return encoded.replace(/__WHIZMD_PERCENT_(\d+)__/g, (_, index: string) => protectedEscapes[Number(index)])
}

export function decodeUrlPath(value: string): string {
  try {
    return decodeURI(value)
  } catch {
    return value
  }
}
