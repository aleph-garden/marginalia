import type { Quad } from '@rdfjs/types'
import { Writer } from 'n3'
import { ns } from './terms.ts'

const prefixes = Object.fromEntries(
  Object.entries(ns).map(([k, v]) => [k === 'mg' ? 'marginalia' : k, v])
)

/**
 * Turtle by default, because a golden file is read by people. Tests compare
 * graphs for isomorphism rather than bytes, so the layout is free to change.
 */
export function write(
  quads: Quad[],
  format: 'application/trig' | 'application/n-quads' = 'application/trig'
): string {
  const writer = new Writer({
    format,
    prefixes: format === 'application/trig' ? prefixes : undefined
  })
  for (const q of quads) writer.addQuad(q)
  let out = ''
  writer.end((error: Error | null, result: string) => {
    if (error) throw error
    out = result
  })
  return out
}
