import type { Quad } from '@rdfjs/types'
import oxigraph from 'oxigraph'
import { write } from './serialize.ts'

/**
 * The meaning layer. Nothing here is this format's invention: the rules are
 * plain SPARQL CONSTRUCT, so the only thing the format has to settle is where
 * they live and in which order they run.
 *
 * Rules see the structural graph and each other's output is kept apart, so a
 * rule cannot depend on another having run first.
 */
export function applyMapping(quads: Quad[], rules: string[]): Quad[] {
  const store = new oxigraph.Store()
  store.load(write(quads, 'application/n-quads'), { format: 'application/n-quads' })
  const out: Quad[] = []
  for (const rule of rules) {
    const result = store.query(rule)
    if (!Array.isArray(result))
      throw new Error('a mapping rule must be a CONSTRUCT or DESCRIBE query')
    out.push(...(result as Quad[]))
  }
  return out
}
