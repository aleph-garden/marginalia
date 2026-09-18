import { describe, expect, test } from 'bun:test'
import { ns, structure } from '../src/index.ts'
import { normalisePath } from '../src/reference.ts'

const graph = (markdown: string) => structure(markdown, { name: 'doc' })

const tokens = (markdown: string) =>
  graph(markdown)
    .quads.filter((q) => q.predicate.value.startsWith(ns.token))
    .map((q) => [q.predicate.value.slice(ns.token.length), q.object.value] as const)

const refs = (markdown: string) =>
  graph(markdown)
    .quads.filter((q) => q.predicate.value === `${ns.dct}references`)
    .map((q) => q.object.value)

const codes = (markdown: string) => graph(markdown).diagnostics.map((d) => d.code)

// Both spellings carry an anchor, a target and optionally a name, and differ
// only in where each is written. These check they end up in the same place.
describe('the two spellings', () => {
  test('a wiki link and a CommonMark link name the same note', () => {
    const wiki = tokens('# T\n\nbroader :: [[people/armstrong]]\n')
    const link = tokens('# T\n\nbroader :: [Neil](people/armstrong.md)\n')
    expect(wiki).toEqual(link)
    expect(wiki).toEqual([['broader', 'urn:doc:people/armstrong']])
  })

  test('a link in a statement value is a target, not text', () => {
    expect(tokens('# T\n\nbroader :: [Space missions](space-missions.md)\n')).toEqual([
      ['broader', 'urn:doc:space-missions']
    ])
  })

  test('an absolute IRI stays absolute in either spelling', () => {
    expect(tokens('# T\n\nfocus :: https://x.test/y\n')).toEqual([['focus', 'https://x.test/y']])
    expect(tokens('# T\n\nfocus :: [Y](https://x.test/y)\n')).toEqual([
      ['focus', 'https://x.test/y']
    ])
  })

  test('a value that names nothing is text', () => {
    expect(tokens('# T\n\nstatus :: active\n')).toEqual([['status', 'active']])
  })

  test('columns may be aligned', () => {
    expect(tokens('# T\n\nbroader   :: [[a]]\nfocus     :: [[b]]\n')).toEqual([
      ['broader', 'urn:doc:a'],
      ['focus', 'urn:doc:b']
    ])
  })
})

describe('names', () => {
  test('a title in prose makes the reference a statement', () => {
    expect(tokens('# T\n\nBuilt on [Fresnel](fresnel.md "dependsOn").\n')).toEqual([
      ['dependsOn', 'urn:doc:fresnel']
    ])
  })

  test('no title makes it a plain reference', () => {
    expect(refs('# T\n\nSee [the docs](https://comunica.dev/).\n')).toEqual([
      'https://comunica.dev/'
    ])
  })

  test('the anchor text gets no triple of its own', () => {
    const quads = graph('# T\n\nSee [the docs](https://comunica.dev/).\n').quads
    expect(quads.filter((q) => q.object.value === 'the docs')).toEqual([])
  })
})

describe('paths', () => {
  test('interior dot segments collapse', () => {
    expect(normalisePath('./sub/../other.md')).toEqual({ target: 'other.md' })
    expect(normalisePath('a/b/../c')).toEqual({ target: 'a/c' })
  })

  test('a path above the document is reported and still deterministic', () => {
    const result = normalisePath('../outside/z.md')
    expect(result.target).toBe('../outside/z.md')
    expect(result.problem).toContain('points above the document')
    expect(codes('# T\n\nup :: [Y](../outside/z.md)\n')).toEqual(['reference-unresolved'])
  })

  test('a filesystem path never reaches the graph', () => {
    const result = structure('# T\n\nx :: [Y](other.md)\n', {
      path: '/home/someone/vault/notes/doc.md'
    })
    const token = result.quads.find((q) => q.predicate.value === `${ns.token}x`)
    expect(token?.object.value).toBe('urn:doc:other')
  })
})

describe('IRI encoding', () => {
  test('a slash stays a slash, because both URN and fragment syntax allow it', () => {
    expect(tokens('# T\n\nx :: [[a/b/c]]\n')).toEqual([['x', 'urn:doc:a/b/c']])
  })

  test('a colon in a name stays, so a CURIE-shaped key reads back', () => {
    expect(tokens('# T\n\nschema:jobTitle :: Product Manager\n')).toEqual([
      ['schema:jobTitle', 'Product Manager']
    ])
  })

  test('what an IRI cannot carry is still encoded', () => {
    const quads = structure('# A Heading With Spaces\n', { name: 'doc' }).quads
    const section = quads.find((q) => q.predicate.value === `${ns.rdfs}label`)
    expect(section?.subject.value).toBe('urn:doc:doc#A%20Heading%20With%20Spaces')
  })
})
