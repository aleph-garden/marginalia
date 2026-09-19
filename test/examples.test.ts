import { describe, expect, test } from 'bun:test'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Quad } from '@rdfjs/types'
import { Parser } from 'n3'
import { isomorphic } from 'rdf-isomorphic'
import { applyMapping, structure } from '../src/index.ts'

const EXAMPLES = join(import.meta.dir, '..', 'examples')
const MAPPINGS = join(import.meta.dir, '..', 'mappings')
const shipped = readdirSync(MAPPINGS).filter((f) => f.endsWith('.rq'))
const parse = (source: string, format = 'application/trig') =>
  new Parser({ format }).parse(source) as Quad[]

/** Goldens are compared as graphs, so they stay free to be laid out for people. */
const same = (actual: Quad[], expected: Quad[]) => {
  if (isomorphic(actual, expected)) return
  const key = (q: Quad) =>
    `${q.graph.value ? `${q.graph.value} ` : ''}${q.subject.value} ${q.predicate.value} ${q.object.value}${'language' in q.object && q.object.language ? `@${q.object.language}` : ''}`
  const a = new Set(actual.map(key))
  const b = new Set(expected.map(key))
  const missing = [...b].filter((k) => !a.has(k)).sort()
  const extra = [...a].filter((k) => !b.has(k)).sort()
  throw new Error(
    `graphs differ\n  missing (${missing.length}):\n${missing.map((m) => `    - ${m}`).join('\n')}\n  extra (${extra.length}):\n${extra.map((e) => `    + ${e}`).join('\n')}`
  )
}

const cases = readdirSync(EXAMPLES, { withFileTypes: true })
  .filter((e) => e.isDirectory())
  .map((e) => e.name)

describe('examples', () => {
  for (const name of cases) {
    const dir = join(EXAMPLES, name)
    const result = structure(readFileSync(join(dir, 'README.md'), 'utf8'), { name })

    test(`${name}: structure matches its golden`, () => {
      const trig = existsSync(join(dir, 'tree.trig'))
      // Turtle until a fence gives the document a named graph, because GitHub
      // highlights Turtle and an example is read more often than parsed.
      expect(trig).toBe(result.quads.some((q) => q.graph.value !== ''))
      same(result.quads, parse(readFileSync(join(dir, trig ? 'tree.trig' : 'tree.ttl'), 'utf8')))
    })

    // Each rule file has a golden of the same name, so one document can show
    // several vocabularies read out of it.
    const local = readdirSync(dir).filter((f) => f.endsWith('.rq'))
    for (const rule of local) {
      test(`${name}: ${rule} matches its golden`, () => {
        const meaning = applyMapping(result.quads, [readFileSync(join(dir, rule), 'utf8')])
        const golden = readFileSync(join(dir, rule.replace(/\.rq$/, '.ttl')), 'utf8')
        same(meaning, parse(golden, 'text/turtle'))
      })
    }

    // Every shipped rule runs against every example, and an example that
    // declares the type one reads has a golden of that rule's name beside it.
    // A local rule of the same name owns the golden, so an example is free to
    // keep a reading of its own.
    for (const rule of shipped.filter((r) => !local.includes(r))) {
      test(`${name}: mappings/${rule} matches its golden`, () => {
        const meaning = applyMapping(result.quads, [readFileSync(join(MAPPINGS, rule), 'utf8')])
        const golden = join(dir, rule.replace(/\.rq$/, '.ttl'))
        expect(existsSync(golden)).toBe(meaning.length > 0)
        if (meaning.length > 0) same(meaning, parse(readFileSync(golden, 'utf8'), 'text/turtle'))
      })
    }
  }

  test('there are examples to check', () => {
    expect(cases.length).toBeGreaterThan(0)
  })
})
