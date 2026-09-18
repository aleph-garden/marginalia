import { describe, expect, test } from 'bun:test'
import { ns, structure } from '../src/index.ts'

const graph = (markdown: string) => structure(markdown, { name: 'doc' })

const tokens = (markdown: string) =>
  graph(markdown)
    .quads.filter((q) => q.predicate.value.startsWith(ns.token))
    .map((q) => [q.predicate.value.slice(ns.token.length), q.object.value] as const)

const sections = (markdown: string) =>
  graph(markdown)
    .quads.filter((q) => q.predicate.value === `${ns.rdfs}label`)
    .map((q) => q.object.value)

const codes = (markdown: string) => graph(markdown).diagnostics.map((d) => d.code)

// The parser answers what a heading, a fence or a quote is. These cases are
// where a hand-written line scanner and CommonMark come apart, so they are what
// borrowing the parser buys.
describe('CommonMark', () => {
  test('a statement line inside a fenced code block is code', () => {
    expect(tokens('# T\n\n```\nfield :: value\n```\n')).toEqual([])
  })

  test('a statement line inside an indented code block is code', () => {
    expect(tokens('# T\n\n    field :: value\n')).toEqual([])
  })

  test('a setext heading opens a section', () => {
    expect(sections('Title\n=====\n\nfield :: value\n')).toEqual(['Title'])
  })

  test('a statement line inside a blockquote belongs to the quote', () => {
    expect(tokens('# T\n\n> field :: value\n')).toEqual([])
  })

  test('a heading inside a blockquote opens no section', () => {
    expect(sections('# T\n\n> ## Inner\n')).toEqual(['T'])
  })

  test('a statement line in a list item is a statement', () => {
    expect(tokens('# T\n\n- broader :: [[other]]\n- related :: [[thing]]\n')).toEqual([
      ['broader', 'urn:doc:other'],
      ['related', 'urn:doc:thing']
    ])
  })
})

describe('sections', () => {
  test('a skipped level nests under the nearest lesser depth and is reported', () => {
    const result = graph('# A\n\n#### B\n\nk :: v\n')
    const contained = result.quads.filter((q) => q.predicate.value === `${ns.po}isContainedBy`)
    expect(contained.map((q) => [q.subject.value, q.object.value])).toEqual([
      ['urn:doc:doc#B', 'urn:doc:doc#A']
    ])
    expect(result.diagnostics.map((d) => d.code)).toEqual(['heading-level-skipped'])
  })

  test('repeated heading text is one section', () => {
    const result = graph('# A\n\n## Notes\n\nk :: 1\n\n## Notes\n\nk :: 2\n')
    const values = result.quads
      .filter((q) => q.predicate.value === `${ns.token}k`)
      .map((q) => [q.subject.value, q.object.value])
    expect(values).toEqual([
      ['urn:doc:doc#Notes', '1'],
      ['urn:doc:doc#Notes', '2']
    ])
  })

  test('content before the first heading belongs to the document', () => {
    const result = graph('owner :: me\n\n# A\n')
    const owner = result.quads.find((q) => q.predicate.value === `${ns.token}owner`)
    expect(owner?.subject.value).toBe('urn:doc:doc')
  })

  test('identity survives an edit above it', () => {
    const before = graph('# A\n\n## B\n').quads.map((q) => q.subject.value)
    const after = graph('# A\n\nAn inserted paragraph.\n\n## B\n').quads.map((q) => q.subject.value)
    expect(after).toContain('urn:doc:doc#B')
    expect(before).toContain('urn:doc:doc#B')
  })
})

describe('statement values', () => {
  test('several links in one line are reported instead of folded together', () => {
    expect(codes('# T\n\nrelated :: [[a|A]], [[b|B]]\n')).toEqual(['value-looks-plural'])
  })

  test('repeating the key is the plural', () => {
    expect(tokens('# T\n\nrelated :: [[a]]\nrelated :: [[b]]\n')).toEqual([
      ['related', 'urn:doc:a'],
      ['related', 'urn:doc:b']
    ])
  })
})

describe('glosses', () => {
  test('an empty destination makes the anchor text the value', () => {
    expect(tokens('# T\n\nFlown by [Armstrong].\n\n[Armstrong]: <> "commander"\n')).toEqual([
      ['commander', 'Armstrong']
    ])
  })

  test('a destination makes the anchor text a label and the target the object', () => {
    expect(tokens('# T\n\nRun by [NASA].\n\n[NASA]: https://nasa.gov "organizer"\n')).toEqual([
      ['organizer', 'https://nasa.gov']
    ])
  })

  test('the same rule works inline', () => {
    expect(tokens('# T\n\nFlown by [Armstrong](<> "commander").\n')).toEqual([
      ['commander', 'Armstrong']
    ])
  })

  test('a bracket without a gloss stays prose', () => {
    expect(tokens('# T\n\nFlown by [Armstrong].\n')).toEqual([])
  })

  test('an unused gloss is reported', () => {
    expect(codes('# T\n\nNothing here.\n\n[Armstrong]: <> "commander"\n')).toEqual(['gloss-unused'])
  })
})
