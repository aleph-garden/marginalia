import { describe, expect, test } from 'bun:test'
import { ns, structure } from '../src/index.ts'

const graph = (markdown: string) => structure(markdown, { name: 'doc' })

const statements = (markdown: string) =>
  graph(markdown)
    .quads.filter((q) => q.subject.value === 'urn:doc:doc' || q.subject.value.includes('#'))
    .filter((q) => !q.predicate.value.startsWith(ns.oa) && !q.predicate.value.startsWith(ns.po))
    .map((q) => [q.predicate.value, q.object.value] as const)

const codes = (markdown: string) => graph(markdown).diagnostics.map((d) => d.code)

const CONTEXT = '---\n"@context":\n  schema: https://schema.org/\n---\n'

// A name the author already qualified says what it means. Deferring it would
// only add a rule saying it means what it says.
describe('@context', () => {
  test('a declared prefix makes a frontmatter key a term', () => {
    const md = `${CONTEXT.slice(0, -4)}schema:name: Apollo 11\n---\n`
    expect(statements(md)).toContainEqual(['https://schema.org/name', 'Apollo 11'])
  })

  test('a bare frontmatter key stays deferred', () => {
    const md = `${CONTEXT.slice(0, -4)}status: draft\n---\n`
    expect(statements(md)).toContainEqual(['urn:token:status', 'draft'])
  })

  test('a statement line follows the same rule', () => {
    const md = `${CONTEXT}# T\n\nschema:dateCreated :: 1969-07-16\nrole :: commander\n`
    const out = statements(md)
    expect(out).toContainEqual(['https://schema.org/dateCreated', '1969-07-16'])
    expect(out).toContainEqual(['urn:token:role', 'commander'])
  })

  test('a value with a declared prefix is a resource', () => {
    const md = `${CONTEXT}# T\n\nkind :: schema:Person\n`
    expect(statements(md)).toContainEqual(['urn:token:kind', 'https://schema.org/Person'])
  })

  test('a value with no declared prefix stays text, because a value may be anything', () => {
    const md = '# T\n\nat :: 10:30\n'
    expect(statements(md)).toContainEqual(['urn:token:at', '10:30'])
    expect(codes(md)).toEqual([])
  })

  test('an undeclared prefix on a key is reported rather than minted as an IRI', () => {
    const md = '# T\n\nschema:jobTitle :: Product Manager\n'
    expect(statements(md)).toContainEqual(['urn:token:schema:jobTitle', 'Product Manager'])
    expect(codes(md)).toEqual(['prefix-not-declared'])
  })

  test('a full IRI needs no declaration', () => {
    const md = '# T\n\nhttps://schema.org/name :: Apollo\n'
    expect(statements(md)).toContainEqual(['https://schema.org/name', 'Apollo'])
    expect(codes(md)).toEqual([])
  })

  test('a context that is not a mapping is reported', () => {
    expect(codes('---\n"@context": https://example.org/ctx.jsonld\n---\n')).toEqual([
      'context-not-read'
    ])
  })
})

describe('@type', () => {
  test('the document says what it is, and the type is an IRI', () => {
    const md = `${CONTEXT.slice(0, -4)}"@type": schema:CreativeWork\n---\n`
    expect(statements(md)).toContainEqual([`${ns.rdf}type`, 'https://schema.org/CreativeWork'])
  })

  test('several types are allowed', () => {
    const md = `${CONTEXT.slice(0, -4)}"@type":\n  - schema:CreativeWork\n  - schema:Article\n---\n`
    const out = statements(md)
    expect(out).toContainEqual([`${ns.rdf}type`, 'https://schema.org/CreativeWork'])
    expect(out).toContainEqual([`${ns.rdf}type`, 'https://schema.org/Article'])
  })

  test('keys beginning with @ never become predicates', () => {
    const md = `${CONTEXT.slice(0, -4)}"@type": schema:Article\n---\n`
    expect(statements(md).map(([p]) => p)).not.toContain('urn:token:@type')
    expect(statements(md).map(([p]) => p)).not.toContain('urn:token:@context')
  })
})

describe('one rule everywhere', () => {
  test('a gloss name resolves like a statement key', () => {
    const md = `${CONTEXT}# T\n\nBy [Neil](<> "schema:creator") and [Buzz](<> "pilot").\n`
    const out = statements(md)
    expect(out).toContainEqual(['https://schema.org/creator', 'Neil'])
    expect(out).toContainEqual(['urn:token:pilot', 'Buzz'])
  })
})
