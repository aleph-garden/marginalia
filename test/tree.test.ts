import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { structure, tree } from '../src/index.ts'

const EXAMPLES = join(import.meta.dir, '..', 'examples')
const drawn = (markdown: string) => tree(structure(markdown, { name: 'doc' }).quads)

// The drawing is derived from a graph the other tests already check, so these
// hold it to being a faithful view rather than to an exact layout.
describe('tree', () => {
  test('containment is the shape', () => {
    const out = drawn('# A\n\n## B\n\n### C\n')
    const indent = (name: string) =>
      out
        .split('\n')
        .find((line) => line.includes(`─ ${name}  (`))
        ?.search(/\S/)
    expect(indent('a')).toBeLessThan(indent('b')!)
    expect(indent('b')).toBeLessThan(indent('c')!)
  })

  test('statements hang under the section they were written in', () => {
    const out = drawn('# A\n\nx :: 1\n\n## B\n\ny :: 2\n')
    const lines = out.split('\n')
    const a = lines.findIndex((l) => l.includes('a  ('))
    const b = lines.findIndex((l) => l.includes('b  ('))
    expect(lines.findIndex((l) => l.includes('x "1"'))).toBeGreaterThan(a)
    expect(lines.findIndex((l) => l.includes('x "1"'))).toBeLessThan(b)
    expect(lines.findIndex((l) => l.includes('y "2"'))).toBeGreaterThan(b)
  })

  test('a long slice is clipped rather than wrapped', () => {
    const out = drawn(`# A\n\n${'word '.repeat(80)}\n`)
    expect(out.split('\n').every((l) => l.length < 200)).toBe(true)
    expect(out).toContain('…')
  })

  test('structural predicates are drawn, not listed', () => {
    const out = drawn('# A\n\nx :: 1\n')
    expect(out).not.toContain('po:contains')
    expect(out).not.toContain('oa:hasSelector')
    expect(out).toContain('x "1"')
  })

  test('every example ships a current drawing', () => {
    for (const name of ['apollo', 'meeting', 'two-vocabularies', 'frontmatter']) {
      const dir = join(EXAMPLES, name)
      const quads = structure(readFileSync(join(dir, 'README.md'), 'utf8'), { name }).quads
      expect(readFileSync(join(dir, 'tree.txt'), 'utf8')).toBe(`${tree(quads)}\n`)
    }
  })
})
