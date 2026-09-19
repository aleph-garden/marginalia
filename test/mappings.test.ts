import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { applyMapping, structure } from '../src/index.ts'

const MAPPINGS = join(import.meta.dir, '..', 'mappings')
const read = (markdown: string, rule: string) =>
  applyMapping(structure(markdown, { name: 'doc' }).quads, [
    readFileSync(join(MAPPINGS, rule), 'utf8')
  ])

/** The goldens beside the examples read these rules whole. What holds for a
 *  document no example covers belongs here. */
describe('shipped mappings', () => {
  test('meeting.rq reads decisions from the list under the section typed minutes:Decisions', () => {
    const meaning = read(
      '---\n"@context":\n  schema: https://schema.org/\n  minutes: https://aleph.garden/ns/minutes#\n"@type": schema:Event\n---\n# Weekly\n\n## Agenda\n\n- the format, again\n\n## Decisions\n\n@type :: minutes:Decisions\n\n- borrow the parser\n',
      'meeting.rq'
    )
    const decisions = meaning
      .filter((q) => q.predicate.value === 'https://schema.org/text')
      .map((q) => q.object.value)
    expect(decisions).toEqual(['borrow the parser'])
  })

  test('todo.rq reads a document that declares no tracker as nothing', () => {
    expect(read('# Packing\n\n- [x] Passport\n- [ ] Tickets\n', 'todo.rq')).toEqual([])
  })

  test('todo.rq reads owner and due on an item as agent and due date', () => {
    const meaning = read(
      '---\n"@context":\n  wf: http://www.w3.org/2005/01/wf/flow#\n"@type": wf:Tracker\n---\n# Work\n\n- Borrow the parser\n\n  owner :: [[people/toph]]\n  due :: 2026-10-02\n',
      'todo.rq'
    )
    const triples = meaning.map((q) => `${q.predicate.value} ${q.object.value}`).sort()
    expect(triples).toEqual([
      'http://www.w3.org/1999/02/22-rdf-syntax-ns#type http://www.w3.org/2005/01/wf/flow#Open',
      'http://www.w3.org/1999/02/22-rdf-syntax-ns#type http://www.w3.org/2005/01/wf/flow#Task',
      'http://www.w3.org/2005/01/wf/flow#dateDue 2026-10-02',
      'http://www.w3.org/2005/01/wf/flow#goalDescription Borrow the parser',
      'http://www.w3.org/2005/01/wf/flow#tracker urn:doc:doc',
      'https://schema.org/agent urn:doc:people/toph'
    ])
  })

  test('skos.rq reads a section of a scheme as a concept', () => {
    const meaning = read(
      '---\n"@context":\n  skos: http://www.w3.org/2004/02/skos/core#\n"@type": skos:ConceptScheme\n---\n# Apollo\n\nbroader :: [[space-missions]]\n',
      'skos.rq'
    )
    const triples = meaning.map((q) => `${q.predicate.value} ${q.object.value}`).sort()
    expect(triples).toEqual([
      'http://www.w3.org/1999/02/22-rdf-syntax-ns#type http://www.w3.org/2004/02/skos/core#Concept',
      'http://www.w3.org/2004/02/skos/core#broader urn:doc:space-missions',
      'http://www.w3.org/2004/02/skos/core#inScheme urn:doc:doc',
      'http://www.w3.org/2004/02/skos/core#prefLabel Apollo'
    ])
  })
})
