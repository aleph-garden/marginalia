import type { NamedNode } from '@rdfjs/types'
import { DataFactory } from 'n3'
import { ns } from './terms.ts'

const { namedNode } = DataFactory

/** A full IRI carries an authority; a CURIE does not. */
const HAS_AUTHORITY = /^[a-z][a-z0-9+.-]*:\/\//i
const CURIE = /^([A-Za-z][A-Za-z0-9_.-]*):(.+)$/

export type Context = Map<string, string>

/**
 * Prefix declarations from the document's frontmatter, in the YAML-LD shape:
 *
 * ```yaml
 * "@context":
 *   schema: https://schema.org/
 * ```
 *
 * Only string values are read. A term definition object carries JSON-LD
 * machinery this format does not implement, and silently ignoring it would
 * make a document mean something other than it says.
 */
export function readContext(raw: unknown): { context: Context; problems: string[] } {
  const context: Context = new Map()
  const problems: string[] = []
  if (raw === undefined) return { context, problems }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    problems.push('@context must be a mapping of prefix to namespace')
    return { context, problems }
  }
  for (const [prefix, namespace] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof namespace === 'string') context.set(prefix, namespace)
    else problems.push(`@context entry "${prefix}" is not a namespace string`)
  }
  return { context, problems }
}

/**
 * A name the author wrote, as a predicate.
 *
 * An absolute IRI or a CURIE whose prefix the document declares says what it
 * means, so it is used as written. A bare name says nothing about vocabulary,
 * so it is deferred for a mapping to decide. Deferring a name that already
 * names a term would only add a rule saying it means what it says.
 */
export function resolveName(name: string, context: Context): { node: NamedNode; problem?: string } {
  const curie = name.match(CURIE)
  if (!curie) return { node: namedNode(ns.token + name) }
  const namespace = context.get(curie[1]!)
  if (namespace) return { node: namedNode(namespace + curie[2]) }
  if (HAS_AUTHORITY.test(name)) return { node: namedNode(name) }
  // A colon with no declaration behind it is almost always a CURIE whose
  // prefix the author forgot. JSON-LD would mint `schema:name` as an IRI with
  // the scheme `schema`; saying so and deferring is the smaller surprise.
  return {
    node: namedNode(ns.token + name),
    problem: `"${name}" looks like a CURIE, but "${curie[1]}" is not declared in @context`
  }
}

/**
 * The same test for a value, without the complaint: a value may be any text,
 * so a colon in one is not evidence of anything.
 */
export function resolveValue(raw: string, context: Context): NamedNode | null {
  if (HAS_AUTHORITY.test(raw)) return namedNode(raw)
  const curie = raw.match(CURIE)
  const namespace = curie ? context.get(curie[1]!) : undefined
  return curie && namespace ? namedNode(namespace + curie[2]) : null
}
