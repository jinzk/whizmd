import { describe, expect, it } from 'vitest'
import { addRecentPath, cleanRecentPaths } from '../recentFilesUtils'

describe('recent file utilities', () => {
  it('deduplicates and limits recent paths', () => {
    const paths = Array.from({ length: 12 }, (_, index) => `C:/file-${index}.md`)
    expect(addRecentPath(paths, 'C:/file-4.md', 10)[0]).toBe('C:/file-4.md')
    expect(addRecentPath(paths, 'C:/new.md', 10)).toHaveLength(10)
  })

  it('cleans paths using the supplied existence check', () => {
    expect(cleanRecentPaths(['a', 'b', 'a'], (path) => path === 'a')).toEqual(['a'])
  })
})
