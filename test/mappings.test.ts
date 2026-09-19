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
  test('todo.rq reads a document that declares no tracker as nothing', () => {
    expect(read('# Packing\n\n- [x] Passport\n- [ ] Tickets\n', 'todo.rq')).toEqual([])
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
