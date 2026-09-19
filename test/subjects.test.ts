import { describe, expect, test } from 'bun:test'
import { ns, structure, tree } from '../src/index.ts'

const graph = (markdown: string) => structure(markdown, { name: 'doc' })

/** Every deferred statement, with the subject it was stated about. */
const stated = (markdown: string) =>
  graph(markdown)
    .quads.filter((q) => q.predicate.value.startsWith(ns.token))
    .map(
      (q) => [q.subject.value, q.predicate.value.slice(ns.token.length), q.object.value] as const
    )

const codes = (markdown: string) => graph(markdown).diagnostics.map((d) => d.code)

const redirects = (markdown: string) =>
  graph(markdown)
    .quads.filter((q) => q.predicate.value === `${ns.mg}subject`)
    .map((q) => [q.subject.value, q.object.value] as const)

describe('@subject', () => {
  test('a statement above the line stays on the section', () => {
    const md = '# T\n\nbefore :: 1\n@subject :: https://example.org/thing\nafter :: 2\n'
    expect(stated(md)).toEqual([
      ['urn:doc:doc#t', 'before', '1'],
      ['https://example.org/thing', 'after', '2']
    ])
  })

  test('a gloss after the line states its fact about the subject', () => {
    const md = '# T\n\n@subject :: https://example.org/thing\n\nFlown by [Armstrong](<> "pilot").\n'
    expect(stated(md)).toEqual([['https://example.org/thing', 'pilot', 'Armstrong']])
  })

  test('containment and a plain reference stay on the section', () => {
    const result = graph(
      '# T\n\n@subject :: https://example.org/thing\n\nSee [the report](report.md).\n'
    )
    const references = result.quads.filter((q) => q.predicate.value === `${ns.dct}references`)
    expect(references.map((q) => [q.subject.value, q.object.value])).toEqual([
      ['urn:doc:doc#t', 'urn:doc:report']
    ])
    const contained = result.quads.filter((q) => q.predicate.value === `${ns.po}isContainedBy`)
    expect(contained.map((q) => [q.subject.value, q.object.value])).toEqual([
      ['urn:doc:doc#t', 'urn:doc:doc'],
      ['urn:doc:doc#t.p1', 'urn:doc:doc#t']
    ])
  })

  test('the redirect is recorded on the section', () => {
    expect(redirects('# T\n\n@subject :: https://example.org/thing\n')).toEqual([
      ['urn:doc:doc#t', 'https://example.org/thing']
    ])
  })

  test('a nested section inherits it and a sibling does not', () => {
    const md =
      '# T\n\n## A\n\n@subject :: https://example.org/a\nk :: 1\n\n### B\n\nk :: 2\n\n## C\n\nk :: 3\n'
    expect(stated(md)).toEqual([
      ['https://example.org/a', 'k', '1'],
      ['https://example.org/a', 'k', '2'],
      ['urn:doc:doc#c', 'k', '3']
    ])
  })

  test('a nested section may set its own', () => {
    const md =
      '# T\n\n## A\n\n@subject :: https://example.org/a\nk :: 1\n\n### B\n\n@subject :: https://example.org/b\nk :: 2\n'
    expect(stated(md)).toEqual([
      ['https://example.org/a', 'k', '1'],
      ['https://example.org/b', 'k', '2']
    ])
  })

  test('a top-level section inherits the document’s redirect and a sibling may set its own', () => {
    const md =
      '---\n"@subject": https://example.org/thing\n---\n# T\n\nk :: 1\n\n# U\n\n@subject :: https://example.org/other\nj :: 2\n'
    expect(stated(md)).toEqual([
      ['https://example.org/thing', 'k', '1'],
      ['https://example.org/other', 'j', '2']
    ])
  })

  test('a value that resolves to a literal is reported and ignored', () => {
    const md = '# T\n\n@subject :: Neil Armstrong\nk :: 1\n'
    expect(codes(md)).toEqual(['subject-not-a-name'])
    expect(stated(md)).toEqual([['urn:doc:doc#t', 'k', '1']])
    expect(redirects(md)).toEqual([])
  })

  test('the value resolves like any statement value', () => {
    const md =
      '---\n"@context":\n  wd: https://www.wikidata.org/entity/\n---\n# T\n\n@subject :: wd:Q1615\nk :: 1\n'
    expect(stated(md)).toEqual([['https://www.wikidata.org/entity/Q1615', 'k', '1']])
  })

  test('a wiki link names the note it points at', () => {
    expect(redirects('# T\n\n@subject :: [[people/toph]]\n')).toEqual([
      ['urn:doc:doc#t', 'urn:doc:people/toph']
    ])
  })

  test('in frontmatter a wiki link resolves the same way', () => {
    const md = '---\n"@subject": "[[people/toph]]"\nstatus: draft\n---\n'
    expect(redirects(md)).toEqual([['urn:doc:doc', 'urn:doc:people/toph']])
    expect(stated(md)).toEqual([['urn:doc:people/toph', 'status', 'draft']])
  })

  test('in frontmatter it redirects the frontmatter and everything below', () => {
    const md =
      '---\n"@subject": https://example.org/thing\nstatus: draft\n---\nowner :: me\n\n# T\n\nk :: 1\n\n## U\n\nj :: 2\n'
    expect(stated(md)).toEqual([
      ['https://example.org/thing', 'status', 'draft'],
      ['https://example.org/thing', 'owner', 'me'],
      ['https://example.org/thing', 'k', '1'],
      ['https://example.org/thing', 'j', '2']
    ])
    expect(redirects(md)).toEqual([['urn:doc:doc', 'https://example.org/thing']])
  })
})

describe('@type', () => {
  test('it types the subject when one is active', () => {
    const md =
      '---\n"@context":\n  wf: https://example.org/wf#\n---\n# T\n\n@subject :: https://example.org/thing\n@type :: wf:Tracker\n'
    const types = graph(md)
      .quads.filter((q) => q.predicate.value === `${ns.rdf}type`)
      .map((q) => [q.subject.value, q.object.value])
    expect(types).toContainEqual(['https://example.org/thing', 'https://example.org/wf#Tracker'])
  })

  test('it types the section otherwise', () => {
    const md = '---\n"@context":\n  wf: https://example.org/wf#\n---\n# T\n\n@type :: wf:Tracker\n'
    const types = graph(md)
      .quads.filter((q) => q.predicate.value === `${ns.rdf}type`)
      .map((q) => [q.subject.value, q.object.value])
    expect(types).toContainEqual(['urn:doc:doc#t', 'https://example.org/wf#Tracker'])
  })

  test('in frontmatter it follows the frontmatter @subject when one is given', () => {
    const md =
      '---\n"@context":\n  wf: https://example.org/wf#\n"@subject": https://example.org/thing\n"@type": wf:Tracker\n---\n'
    const types = graph(md)
      .quads.filter((q) => q.predicate.value === `${ns.rdf}type`)
      .map((q) => [q.subject.value, q.object.value])
    expect(types).toContainEqual(['https://example.org/thing', 'https://example.org/wf#Tracker'])
    expect(types).not.toContainEqual(['urn:doc:doc', 'https://example.org/wf#Tracker'])
  })

  test('in frontmatter it types the document without a @subject', () => {
    const md = '---\n"@context":\n  wf: https://example.org/wf#\n"@type": wf:Tracker\n---\n'
    const types = graph(md)
      .quads.filter((q) => q.predicate.value === `${ns.rdf}type`)
      .map((q) => [q.subject.value, q.object.value])
    expect(types).toContainEqual(['urn:doc:doc', 'https://example.org/wf#Tracker'])
  })
})

describe('other reserved keys', () => {
  test('an undefined @-key is reported and contributes nothing', () => {
    const md = '# T\n\n@foo :: bar\nk :: 1\n'
    expect(codes(md)).toEqual(['key-reserved'])
    expect(stated(md)).toEqual([['urn:doc:doc#t', 'k', '1']])
  })

  test('a key without the sigil is a name like any other', () => {
    expect(stated('# T\n\nsubject :: https://example.org/thing\n')).toEqual([
      ['urn:doc:doc#t', 'subject', 'https://example.org/thing']
    ])
  })
})

describe('the drawing', () => {
  test('it shows the redirect and the subject’s statements under the section', () => {
    const out = tree(
      graph('# T\n\n@subject :: https://example.org/thing\nborn :: 1930-08-05\n').quads
    )
    expect(out).toContain('@subject → https://example.org/thing')
    const lines = out.split('\n')
    expect(lines.findIndex((l) => l.includes('born "1930-08-05"'))).toBeGreaterThan(
      lines.findIndex((l) => l.includes('@subject'))
    )
  })
})
