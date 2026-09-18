import { describe, expect, test } from 'bun:test'
import { structure } from '../src/index.ts'

const graph = (markdown: string) => structure(markdown, { name: 'doc' })

/** Quads outside the default graph: what a fence contributed. */
const fenced = (markdown: string) =>
  graph(markdown)
    .quads.filter((q) => q.graph.value !== '')
    .map((q) => [q.graph.value, q.subject.value, q.predicate.value, q.object.value] as const)

const codes = (markdown: string) => graph(markdown).diagnostics.map((d) => d.code)

const TURTLE = '# S\n\n```turtle\n<#a> <https://schema.org/name> "A" .\n```\n'

describe('RDF fences', () => {
  test('a turtle block becomes a graph named after the block', () => {
    expect(fenced(TURTLE)).toEqual([
      ['urn:doc:doc#S.c1', 'urn:doc:doc#a', 'https://schema.org/name', 'A']
    ])
  })

  test('relative references resolve against the document', () => {
    const [first] = fenced(TURTLE)
    expect(first?.[1]).toBe('urn:doc:doc#a')
  })

  test('a base on the info string overrides that', () => {
    const md =
      '# S\n\n```turtle base=https://example.org/\n<a> <https://schema.org/name> "A" .\n```\n'
    expect(fenced(md)[0]?.[1]).toBe('https://example.org/a')
  })

  test('a graph on the info string names the graph instead', () => {
    const md =
      '# S\n\n```turtle graph=https://example.org/facts\n<#a> <https://schema.org/name> "A" .\n```\n'
    expect(fenced(md)[0]?.[0]).toBe('https://example.org/facts')
  })

  test('a block in another language contributes nothing', () => {
    expect(fenced('# S\n\n```python\nprint("hi")\n```\n')).toEqual([])
  })

  test('a block that does not parse is reported and contributes nothing', () => {
    const md = '# S\n\n```turtle\n<broken a Thing\n```\n'
    expect(fenced(md)).toEqual([])
    expect(codes(md)).toEqual(['fence-not-parsed'])
  })

  test('a bare relative reference against an opaque base is reported', () => {
    const md = '# S\n\n```turtle\n<bare> <https://schema.org/name> "A" .\n```\n'
    expect(codes(md)).toEqual(['fence-not-parsed'])
  })

  test('a fragment against an opaque base is not reported', () => {
    expect(codes(TURTLE)).toEqual([])
  })

  test('the structural graph keeps the block as a slice as well', () => {
    const quads = graph(TURTLE).quads.filter((q) => q.graph.value === '')
    const language = quads.find(
      (q) => q.predicate.value === 'https://schema.org/programmingLanguage'
    )
    expect(language?.object.value).toBe('turtle')
    const quote = quads.find((q) => q.predicate.value === 'http://www.w3.org/ns/oa#exact')
    expect(quote?.object.value).toContain('<#a>')
  })

  test('a block does not contain itself', () => {
    const contains = graph(TURTLE).quads.filter(
      (q) => q.predicate.value === 'http://www.essepuntato.it/2008/12/pattern#contains'
    )
    expect(contains.filter((q) => q.subject.value === q.object.value)).toEqual([])
  })
})
