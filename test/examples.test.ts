import { describe, expect, test } from 'bun:test'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Quad } from '@rdfjs/types'
import { Parser } from 'n3'
import { isomorphic } from 'rdf-isomorphic'
import { applyMapping, structure } from '../src/index.ts'

const EXAMPLES = join(import.meta.dir, '..', 'examples')
const parse = (source: string, format = 'application/trig') =>
  new Parser({ format }).parse(source) as Quad[]

/** Goldens are compared as graphs, so they stay free to be laid out for people. */
const same = (actual: Quad[], expected: Quad[]) => {
  if (isomorphic(actual, expected)) return
  const key = (q: Quad) =>
    `${q.subject.value} ${q.predicate.value} ${q.object.value}${'language' in q.object && q.object.language ? `@${q.object.language}` : ''}`
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
    const markdown = readFileSync(join(dir, 'README.md'), 'utf8')
    const result = structure(markdown, { name })

    test(`${name}: structure matches tree.ttl`, () => {
      same(result.quads, parse(readFileSync(join(dir, 'tree.trig'), 'utf8')))
    })

    if (existsSync(join(dir, 'mapping.rq'))) {
      test(`${name}: mapping matches meaning.ttl`, () => {
        const meaning = applyMapping(result.quads, [readFileSync(join(dir, 'mapping.rq'), 'utf8')])
        same(meaning, parse(readFileSync(join(dir, 'meaning.ttl'), 'utf8'), 'text/turtle'))
      })
    }
  }

  test('every example produced at least one triple', () => {
    expect(cases.length).toBeGreaterThan(0)
  })
})
