/**
 * The two spellings a document can point with.
 *
 * `[anchor](target "name")` and `[[target|anchor]]` carry the same three slots
 * and differ only in where each is written, so both are read into one shape.
 * A wiki link has no slot for a name, which is why a statement line exists: a
 * value there takes its name from the key.
 *
 * They differ in one way that matters. A CommonMark target is a URI reference,
 * so it resolves against wherever the document sits. A wiki target is a name
 * and resolves by searching a collection. This module knows neither: it is
 * given markdown and nothing else, so it normalises what it can and reports
 * what needs a context it does not have. Where a document sits, and what a
 * name resolves to, belong to the caller's naming.
 */
export type TargetKind = 'iri' | 'path' | 'wiki' | 'none'

export interface Reference {
  /** What the reader sees. */
  anchor: string
  /** What it points at, normalised. Empty when the anchor is the value. */
  target: string
  kind: TargetKind
  /** The name this reference states, from a title slot or a statement key. */
  name?: string
  problem?: string
}

const IRI = /^[a-z][a-z0-9+.-]*:/i
const WIKI = /^\[\[([^\]|]+)(?:\|([^\]]*))?\]\]$/

/**
 * Collapse `.` and interior `..` segments. A `..` that would climb above the
 * document needs to know where the document sits, which is a context this
 * parser does not get, so it is reported and left in place.
 */
export function normalisePath(target: string): { target: string; problem?: string } {
  const out: string[] = []
  let escaped = 0
  for (const segment of target.split('/')) {
    if (segment === '.' || segment === '') continue
    if (segment === '..') {
      if (out.length && out[out.length - 1] !== '..') out.pop()
      else {
        out.push('..')
        escaped++
      }
      continue
    }
    out.push(segment)
  }
  const normalised = out.join('/')
  return escaped
    ? {
        target: normalised,
        problem: `"${target}" points above the document, which needs a base this parser is not given`
      }
    : { target: normalised }
}

/** A wiki link, or nothing if the text is not one. */
export function wikiLink(raw: string): Reference | null {
  const match = raw.match(WIKI)
  if (!match?.[1]) return null
  return { anchor: match[2] ?? match[1], target: match[1], kind: 'wiki' }
}

/** A CommonMark link or reference definition, read into the same shape. */
export function commonMarkLink(
  anchor: string,
  url: string,
  title: string | null | undefined
): Reference {
  const name = title ?? undefined
  if (url === '') return { anchor, target: '', kind: 'none', name }
  if (IRI.test(url)) return { anchor, target: url, kind: 'iri', name }
  const { target, problem } = normalisePath(url)
  return { anchor, target, kind: 'path', name, problem }
}
