import type { NamedNode } from '@rdfjs/types'
import { DataFactory } from 'n3'

const { namedNode } = DataFactory

export const ns = {
  rdf: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
  rdfs: 'http://www.w3.org/2000/01/rdf-schema#',
  schema: 'https://schema.org/',
  dct: 'http://purl.org/dc/terms/',
  oa: 'http://www.w3.org/ns/oa#',
  doco: 'http://purl.org/spar/doco/',
  po: 'http://www.essepuntato.it/2008/12/pattern#',
  xsd: 'http://www.w3.org/2001/XMLSchema#',
  /** Names the author chose, whose meaning a mapping decides. */
  token: 'urn:token:',
  /** Provisional. The only namespace this format has to mint itself. */
  mg: 'https://aleph.garden/ns/marginalia#'
} as const

const t = (prefix: keyof typeof ns, local: string) => namedNode(ns[prefix] + local)

export const term = {
  type: t('rdf', 'type'),
  value: t('rdf', 'value'),
  label: t('rdfs', 'label'),

  Document: t('schema', 'DigitalDocument'),
  about: t('schema', 'about'),
  hasPart: t('schema', 'hasPart'),
  SoftwareSourceCode: t('schema', 'SoftwareSourceCode'),
  programmingLanguage: t('schema', 'programmingLanguage'),

  references: t('dct', 'references'),

  ResourceSelection: t('oa', 'ResourceSelection'),
  hasSource: t('oa', 'hasSource'),
  hasSelector: t('oa', 'hasSelector'),
  FragmentSelector: t('oa', 'FragmentSelector'),
  TextQuoteSelector: t('oa', 'TextQuoteSelector'),
  exact: t('oa', 'exact'),

  Section: t('doco', 'Section'),
  Paragraph: t('doco', 'Paragraph'),
  BlockQuotation: t('doco', 'BlockQuotation'),
  List: t('doco', 'List'),

  contains: t('po', 'contains'),
  isContainedBy: t('po', 'isContainedBy'),

  depth: t('mg', 'depth')
} as const

/**
 * How the parts of a document get their IRIs.
 *
 * Identity comes from content, never from position: a section is named by its
 * heading text, so inserting a line above it does not rename it and everything
 * that referred to it keeps referring to it.
 */
export interface Naming {
  /** The document itself, from its name (a file stem, or whatever the caller passes). */
  document(name: string): NamedNode
  /** A section of a document, identified by its heading text. */
  section(document: NamedNode, heading: string): NamedNode
  /** A part of a section: a paragraph, a quotation, a code block. */
  part(section: NamedNode, kind: string, index: number): NamedNode
  /** A selector describing which slice of the source a selection covers. */
  selector(of: NamedNode, index: number): NamedNode
  /** Another document, addressed by name, optionally one of its sections. */
  reference(target: string, from: NamedNode): NamedNode
}

const frag = (iri: string, suffix: string) =>
  namedNode(iri.includes('#') ? `${iri}.${suffix}` : `${iri}#${suffix}`)

/**
 * The default naming: opaque IRIs under a base, so a document that has not
 * been published anywhere still produces a stable graph. Pass a real base to
 * mint IRIs that dereference.
 */
export function naming(base = 'urn:doc:'): Naming {
  const doc = (name: string) => namedNode(base + encodeURIComponent(name))
  return {
    document: doc,
    section: (document, heading) => frag(document.value, encodeURIComponent(heading)),
    part: (section, kind, index) => frag(section.value, `${kind}${index}`),
    selector: (of, index) => frag(of.value, `sel${index}`),
    reference: (target, from) => {
      if (/^[a-z][a-z0-9+.-]*:/i.test(target)) return namedNode(target)
      const [name, heading] = target.split('#')
      const document = name ? doc(name.replace(/\.md$/, '')) : from
      return heading ? frag(document.value, encodeURIComponent(heading)) : document
    }
  }
}
