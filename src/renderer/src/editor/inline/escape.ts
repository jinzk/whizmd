export function isEscaped(text: string, index: number): boolean {
  let slashes = 0
  for (let cursor = index - 1; cursor >= 0 && text[cursor] === '\\'; cursor -= 1) slashes += 1
  return slashes % 2 === 1
}
