import { describe, expect, test } from 'bun:test'
import { ns, structure, tree } from '../src/index.ts'

const graph = (markdown: string) => structure(markdown, { name: 'doc' })

/** Every triple with one predicate, as subject and object. */
const pairs = (markdown: string, predicate: string) =>
  graph(markdown)
    .quads.filter((q) => q.predicate.value === predicate)
    .map((q) => [q.subject.value, q.object.value] as const)

/** Every deferred statement, with the subject it was stated about. */
const stated = (markdown: string) =>
  graph(markdown)
    .quads.filter((q) => q.predicate.value.startsWith(ns.token))
    .map(
      (q) => [q.subject.value, q.predicate.value.slice(ns.token.length), q.object.value] as const
    )

const typesOf = (markdown: string, iri: string) =>
  graph(markdown)
    .quads.filter((q) => q.subject.value === iri && q.predicate.value === `${ns.rdf}type`)
    .map((q) => q.object.value)

/** The datatype of the first literal a predicate carries. */
const datatype = (markdown: string, predicate: string) => {
  const object = graph(markdown).quads.find((q) => q.predicate.value === predicate)?.object
  return object?.termType === 'Literal' ? object.datatype.value : undefined
}

/** The text a selection's quote selector records. */
const exact = (markdown: string, iri: string) => {
  const { quads } = graph(markdown)
  const selector = quads.find(
    (q) => q.subject.value === iri && q.predicate.value === `${ns.oa}hasSelector`
  )?.object.value
  return quads.find((q) => q.subject.value === selector && q.predicate.value === `${ns.oa}exact`)
    ?.object.value
}

describe('a list', () => {
  test('becomes a doco:List with one item per entry', () => {
    const md = '# T\n\n- One\n- Two\n'
    expect(typesOf(md, 'urn:doc:doc#t.l1')).toEqual([`${ns.oa}ResourceSelection`, `${ns.doco}List`])
    expect(typesOf(md, 'urn:doc:doc#t.l1.i1')).toEqual([
      `${ns.oa}ResourceSelection`,
      `${ns.schema}ListItem`
    ])
    expect(pairs(md, `${ns.po}isContainedBy`)).toEqual([
      ['urn:doc:doc#t', 'urn:doc:doc'],
      ['urn:doc:doc#t.l1', 'urn:doc:doc#t'],
      ['urn:doc:doc#t.l1.i1', 'urn:doc:doc#t.l1'],
      ['urn:doc:doc#t.l1.i2', 'urn:doc:doc#t.l1']
    ])
  })

  test('of statement lines is still statements and gets no doco:List', () => {
    const md = '# T\n\n- a :: 1\n- b :: 2\n'
    expect(stated(md)).toEqual([
      ['urn:doc:doc#t', 'a', '1'],
      ['urn:doc:doc#t', 'b', '2']
    ])
    expect(pairs(md, `${ns.po}contains`)).toEqual([['urn:doc:doc', 'urn:doc:doc#t']])
  })

  test('labels an item with the plain text of its first paragraph', () => {
    expect(pairs('# T\n\n- Cook eggs\n- Boil **water**\n', `${ns.rdfs}label`)).toEqual([
      ['urn:doc:doc#t', 'T'],
      ['urn:doc:doc#t.l1.i1', 'Cook eggs'],
      ['urn:doc:doc#t.l1.i2', 'Boil water']
    ])
  })

  test('numbers its items from 1, and a nested list starts again', () => {
    const md = '# T\n\n- One\n- Two\n  - Deep\n  - Deeper\n'
    expect(pairs(md, `${ns.schema}position`)).toEqual([
      ['urn:doc:doc#t.l1.i1', '1'],
      ['urn:doc:doc#t.l1.i2', '2'],
      ['urn:doc:doc#t.l1.i2.l1.i1', '1'],
      ['urn:doc:doc#t.l1.i2.l1.i2', '2']
    ])
  })

  test('has its position typed xsd:integer', () => {
    expect(datatype('# T\n\n- One\n', `${ns.schema}position`)).toBe(`${ns.xsd}integer`)
  })
})

describe('a nested list', () => {
  test('is contained by its item and not by the section', () => {
    const md = '# T\n\n- One\n- Two\n  - Deep\n'
    expect(pairs(md, `${ns.po}contains`)).toEqual([
      ['urn:doc:doc', 'urn:doc:doc#t'],
      ['urn:doc:doc#t', 'urn:doc:doc#t.l1'],
      ['urn:doc:doc#t.l1', 'urn:doc:doc#t.l1.i1'],
      ['urn:doc:doc#t.l1', 'urn:doc:doc#t.l1.i2'],
      ['urn:doc:doc#t.l1.i2', 'urn:doc:doc#t.l1.i2.l1'],
      ['urn:doc:doc#t.l1.i2.l1', 'urn:doc:doc#t.l1.i2.l1.i1']
    ])
  })

  test('is inside the slice of the item that holds it', () => {
    const md = '# T\n\n- One\n- Two\n  - Deep\n'
    expect(exact(md, 'urn:doc:doc#t.l1.i2')).toBe('- Two\n  - Deep')
  })
})

describe('a task item', () => {
  test('carries the state of its box', () => {
    const md = '# T\n\n- [x] Passport\n- [ ] Tickets\n'
    expect(pairs(md, `${ns.mg}checked`)).toEqual([
      ['urn:doc:doc#t.l1.i1', 'true'],
      ['urn:doc:doc#t.l1.i2', 'false']
    ])
    expect(datatype(md, `${ns.mg}checked`)).toBe(`${ns.xsd}boolean`)
  })

  test('is the only kind of item that carries one', () => {
    expect(pairs('# T\n\n- Passport\n- Tickets\n', `${ns.mg}checked`)).toEqual([])
  })
})

describe('inside an item', () => {
  test('a gloss in its text states a fact about the item', () => {
    expect(stated('# T\n\n- Flown by [Armstrong](<> "pilot")\n')).toEqual([
      ['urn:doc:doc#t.l1.i1', 'pilot', 'Armstrong']
    ])
  })

  test('a statement line in its continuation states a fact about the item', () => {
    const md = '# T\n\n- Borrow the parser\n\n  owner :: toph\n\n- Write it\n'
    expect(stated(md)).toEqual([['urn:doc:doc#t.l1.i1', 'owner', 'toph']])
  })

  test('a plain reference is one the item makes', () => {
    expect(pairs('# T\n\n- See [the report](report.md)\n', `${ns.dct}references`)).toEqual([
      ['urn:doc:doc#t.l1.i1', 'urn:doc:report']
    ])
  })

  test('a second paragraph is a part of the item', () => {
    const md = '# T\n\n- Borrow the parser\n\n  It stays borrowed.\n'
    expect(pairs(md, `${ns.po}contains`)).toEqual([
      ['urn:doc:doc', 'urn:doc:doc#t'],
      ['urn:doc:doc#t', 'urn:doc:doc#t.l1'],
      ['urn:doc:doc#t.l1', 'urn:doc:doc#t.l1.i1'],
      ['urn:doc:doc#t.l1.i1', 'urn:doc:doc#t.l1.i1.p1']
    ])
    expect(exact(md, 'urn:doc:doc#t.l1.i1.p1')).toBe('It stays borrowed.')
  })

  test('the first paragraph gets no part of its own', () => {
    const md = '# T\n\n- Borrow the parser\n'
    expect(pairs(md, `${ns.po}contains`)).toEqual([
      ['urn:doc:doc', 'urn:doc:doc#t'],
      ['urn:doc:doc#t', 'urn:doc:doc#t.l1'],
      ['urn:doc:doc#t.l1', 'urn:doc:doc#t.l1.i1']
    ])
  })

  test('@subject redirects the item alone', () => {
    const md =
      '# T\n\n- An item\n\n  @subject :: https://example.org/thing\n  k :: 1\n\nk :: 2\n\n## U\n\nk :: 3\n'
    expect(stated(md)).toEqual([
      ['https://example.org/thing', 'k', '1'],
      ['urn:doc:doc#t', 'k', '2'],
      ['urn:doc:doc#u', 'k', '3']
    ])
    expect(pairs(md, `${ns.mg}subject`)).toEqual([
      ['urn:doc:doc#t.l1.i1', 'https://example.org/thing']
    ])
  })

  test('a part of the section after it is numbered from where the section left off', () => {
    const md = '# T\n\nFirst.\n\n- An item\n\nSecond.\n'
    expect(pairs(md, `${ns.po}contains`)).toEqual([
      ['urn:doc:doc', 'urn:doc:doc#t'],
      ['urn:doc:doc#t', 'urn:doc:doc#t.p1'],
      ['urn:doc:doc#t', 'urn:doc:doc#t.l2'],
      ['urn:doc:doc#t.l2', 'urn:doc:doc#t.l2.i1'],
      ['urn:doc:doc#t', 'urn:doc:doc#t.p3']
    ])
  })
})

describe('the drawing', () => {
  test('shows an item by its label, with its position and box under it', () => {
    const drawn = tree(graph('# T\n\n- [x] Cook eggs\n- Boil water\n').quads)
    expect(drawn).toContain('t.l1.i1  (oa:ResourceSelection, schema:ListItem)  Cook eggs')
    expect(drawn).toContain('schema:position "1"')
    expect(drawn).toContain('mg:checked "true"')
    // Items are drawn in the order they are numbered.
    expect(drawn.indexOf('Cook eggs')).toBeLessThan(drawn.indexOf('Boil water'))
  })
})
