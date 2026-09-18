import type { Quad } from '@rdfjs/types'
import { Parser } from 'n3'

/**
 * A fenced code block whose language is an RDF syntax is parsed and kept as a
 * named graph, so its triples are in the model rather than in a string.
 *
 * The graph name is the code block's own IRI, which already carries the
 * block's source, its selectors and its language. Provenance therefore needs
 * no extra vocabulary, and because the triples live in their own graph they
 * cannot be mistaken for the structural ones: a mapping reaches them through
 * GRAPH and does so on purpose.
 */
const SYNTAX: Record<string, string> = {
  turtle: 'text/turtle',
  ttl: 'text/turtle',
  trig: 'application/trig',
  'n-triples': 'application/n-triples',
  ntriples: 'application/n-triples',
  nt: 'application/n-triples',
  'n-quads': 'application/n-quads',
  nquads: 'application/n-quads',
  nq: 'application/n-quads',
  n3: 'text/n3'
}

/** Languages this module parses. Others stay ordinary code blocks. */
export const isRdfSyntax = (lang: string | null | undefined): boolean =>
  Boolean(lang && lang.toLowerCase() in SYNTAX)

export interface FenceOptions {
  /** `base=<iri>` and `graph=<iri>` from the fence's info string. */
  meta?: string | null
  /** Where relative references resolve when the fence does not say. */
  defaultBase: string
}

export interface FenceResult {
  quads: Quad[]
  /** The graph the author asked for, if the info string named one. */
  graph?: string
  problems: string[]
}

const HIERARCHICAL = /^[a-z][a-z0-9+.-]*:\/\//i
/** A relative reference that is not a fragment, which an opaque base mangles. */
const BARE_RELATIVE = /<(?![a-z][a-z0-9+.-]*:)(?!#)[^<>"{}|^`\\]*>/i

const args = (meta: string | null | undefined): Record<string, string> =>
  Object.fromEntries(
    (meta ?? '')
      .split(/\s+/)
      .filter(Boolean)
      .map((pair) => pair.split('='))
      .filter((parts): parts is [string, string] => parts.length === 2 && Boolean(parts[1]))
  )

export function parseFence(source: string, lang: string, options: FenceOptions): FenceResult {
  const format = SYNTAX[lang.toLowerCase()]
  if (!format) return { quads: [], problems: [`unknown RDF syntax "${lang}"`] }

  const { base = options.defaultBase, graph } = args(options.meta)
  const problems: string[] = []

  // An opaque base has no path to resolve against, so n3 concatenates and the
  // result is a mangled IRI rather than an error. Say so instead.
  if (!HIERARCHICAL.test(base) && BARE_RELATIVE.test(source))
    problems.push(
      `relative references need a hierarchical base; "${base}" resolves only fragments, so pass base=<iri> on the fence`
    )

  try {
    const quads = new Parser({ format, baseIRI: base }).parse(source) as Quad[]
    return { quads, graph, problems }
  } catch (error) {
    problems.push(error instanceof Error ? error.message : String(error))
    return { quads: [], graph, problems }
  }
}
