import type { Quad, Term } from '@rdfjs/types'
import { ns } from './terms.ts'

/**
 * The structural graph, drawn as the tree it already is.
 *
 * Turtle is what a machine checks; this is what a person reads. Containment is
 * the shape, and everything a section or a part states hangs underneath it.
 */

/** Said by the structure itself, so drawn as shape rather than listed as fact. */
const STRUCTURAL = new Set([
  `${ns.rdf}type`,
  `${ns.rdfs}label`,
  `${ns.po}contains`,
  `${ns.po}isContainedBy`,
  `${ns.oa}hasSource`,
  `${ns.oa}hasSelector`,
  `${ns.mg}depth`,
  `${ns.mg}anchor`
])

const PREFIXES: [string, string][] = Object.entries(ns)
  .filter(([prefix]) => prefix !== 'token')
  .map(([prefix, namespace]) => [namespace, `${prefix}:`])

const short = (iri: string): string => {
  for (const [namespace, prefix] of PREFIXES)
    if (iri.startsWith(namespace)) return prefix + iri.slice(namespace.length)
  if (iri.startsWith(ns.token)) return iri.slice(ns.token.length)
  return iri
}

const clip = (text: string, width: number) => {
  const flat = text.replace(/\s+/g, ' ').trim()
  return flat.length > width ? `${flat.slice(0, width - 1)}…` : flat
}

const render = (term: Term): string =>
  term.termType === 'Literal' ? JSON.stringify(clip(term.value, 60)) : `→ ${short(term.value)}`

export interface TreeOptions {
  /** How much of a quoted slice to show. */
  width?: number
}

export function tree(quads: Quad[], options: TreeOptions = {}): string {
  const width = options.width ?? 64
  const bySubject = new Map<string, Quad[]>()
  for (const q of quads) {
    if (q.graph.value !== '') continue
    const list = bySubject.get(q.subject.value)
    if (list) list.push(q)
    else bySubject.set(q.subject.value, [q])
  }
  const of = (iri: string, predicate: string) =>
    (bySubject.get(iri) ?? []).filter((q) => q.predicate.value === predicate)

  const label = (iri: string) => of(iri, `${ns.rdfs}label`)[0]?.object.value
  const types = (iri: string) =>
    of(iri, `${ns.rdf}type`)
      .map((q) => short(q.object.value))
      .join(', ')

  /** The quoted text of a slice, which says what a part is without listing it. */
  const quoted = (iri: string) => {
    const selector = of(iri, `${ns.oa}hasSelector`)[0]?.object.value
    if (!selector) return undefined
    return of(selector, `${ns.oa}exact`)[0]?.object.value
  }

  const contained = (iri: string) => of(iri, `${ns.po}contains`).map((q) => q.object.value)
  const facts = (iri: string) =>
    (bySubject.get(iri) ?? []).filter((q) => !STRUCTURAL.has(q.predicate.value))
  const roots = [...bySubject.keys()].filter(
    (iri) => of(iri, `${ns.po}isContainedBy`).length === 0 && contained(iri).length > 0
  )

  const lines: string[] = []
  const draw = (iri: string, prefix: string, last: boolean, root: boolean) => {
    const name = label(iri) ?? quoted(iri)
    const head = root ? short(iri) : `${short(iri).split(/[#]/).pop()}`
    const kind = types(iri)
    const shown = name && name !== head ? `  ${clip(name, width)}` : ''
    lines.push(
      `${prefix}${root ? '' : last ? '└─ ' : '├─ '}${head}${kind ? `  (${kind})` : ''}${shown}`
    )

    const inner = root ? '' : prefix + (last ? '   ' : '│  ')
    const children = contained(iri)
    const gutter = `${inner}${children.length ? '│' : ' '} `
    for (const fact of facts(iri)) {
      if (fact.predicate.value === `${ns.mg}subject`) {
        // A section that named its subject reads like one that did not: the
        // redirect is drawn, and what was stated about the subject hangs below
        // it where the section's own facts would be.
        const kind = types(fact.object.value)
        lines.push(`${gutter}@subject ${render(fact.object)}${kind ? `  (${kind})` : ''}`)
        for (const stated of facts(fact.object.value))
          lines.push(`${gutter}${short(stated.predicate.value)} ${render(stated.object)}`)
      } else lines.push(`${gutter}${short(fact.predicate.value)} ${render(fact.object)}`)
    }
    children.forEach((child, index) => {
      draw(child, inner, index === children.length - 1, false)
    })
  }

  for (const root of roots) draw(root, '', true, true)
  return lines.join('\n')
}
