import type { NamedNode, Quad, Quad_Object } from '@rdfjs/types'
import type { BlockContent, Heading, List, Paragraph, Root, RootContent } from 'mdast'
import { toString as mdToString } from 'mdast-util-to-string'
import { DataFactory } from 'n3'
import { parse as parseYaml } from 'yaml'
import { parse } from './parse.ts'
import { isRdfSyntax, parseFence } from './rdf-fence.ts'
import { naming as defaultNaming, type Naming, ns, term } from './terms.ts'

const { literal, namedNode, quad } = DataFactory

/** A statement line: a name the author chose, and the value it takes. */
const FIELD = /^([A-Za-z][A-Za-z0-9_.:-]*) :: (.+)$/
/** An Obsidian-style link, which CommonMark does not define. */
const WIKI = /^\[\[([^\]|]+)(?:\|[^\]]*)?\]\]$/
const IRI = /^[a-z][a-z0-9+.-]*:/i

export interface Diagnostic {
  code: 'heading-level-skipped' | 'gloss-unused' | 'value-looks-plural' | 'fence-not-parsed'
  message: string
  line?: number
}

export interface StructureOptions {
  /** The document's name. Derived from `path` when absent. */
  name?: string
  path?: string
  /** How IRIs are minted. Defaults to opaque IRIs under `urn:doc:`. */
  naming?: Naming
}

export interface StructureResult {
  document: NamedNode
  quads: Quad[]
  diagnostics: Diagnostic[]
}

const nameFromPath = (path: string) => path.split('/').pop()!.replace(/\.md$/, '')

/**
 * A CommonMark document becomes a structural RDF graph.
 *
 * Nothing here decides what anything means. Every name the author chose lands
 * under `urn:token:`, and a SPARQL CONSTRUCT decides the rest. What this owes
 * that mapping is completeness: a decision taken here must stay reversible
 * there, so where a choice is not reversible this takes the finer side.
 */
export function structure(markdown: string, options: StructureOptions = {}): StructureResult {
  const name = options.name ?? (options.path ? nameFromPath(options.path) : 'document')
  const mint = options.naming ?? defaultNaming()
  const tree = parse(markdown)

  const quads: Quad[] = []
  const diagnostics: Diagnostic[] = []
  const emit = (s: NamedNode, p: NamedNode, o: Quad_Object) => quads.push(quad(s, p, o) as Quad)

  const document = mint.document(name)
  emit(document, term.type, term.Document)

  /** The source slice a node covers, which is what a quote selector records. */
  const slice = (node: { position?: { start: { offset?: number }; end: { offset?: number } } }) =>
    markdown.slice(node.position?.start.offset ?? 0, node.position?.end.offset ?? 0)

  // A gloss binds an anchor text to a name. An empty destination means the
  // anchor text is the value; any other destination means it is the object.
  const gloss = new Map<string, { url: string; pred: string }>()
  const usedGloss = new Set<string>()
  const collectGloss = (node: RootContent | Root) => {
    if (node.type === 'definition' && node.title)
      gloss.set(node.identifier, { url: node.url, pred: node.title })
    for (const child of (node as { children?: RootContent[] }).children ?? []) collectGloss(child)
  }
  collectGloss(tree)

  // Sections nest. CommonMark says nothing about that: its tree has headings
  // as siblings of the blocks that follow them, so the section tree is built
  // here, from the sequence of heading depths.
  let subject: NamedNode = document
  let partIndex = 0
  const stack: { depth: number; node: NamedNode }[] = []

  const openSection = (heading: Heading) => {
    const label = mdToString(heading)
    const section = mint.section(document, label)
    while (stack.length && stack[stack.length - 1]!.depth >= heading.depth) stack.pop()
    const parent = stack[stack.length - 1]
    if (parent && heading.depth > parent.depth + 1)
      diagnostics.push({
        code: 'heading-level-skipped',
        message: `heading "${label}" is depth ${heading.depth} under depth ${parent.depth}; HTML requires at most one step`,
        line: heading.position?.start.line
      })
    stack.push({ depth: heading.depth, node: section })
    subject = section
    partIndex = 0

    emit(document, term.about, section)
    emit(section, term.type, term.Section)
    emit(section, term.type, term.ResourceSelection)
    emit(section, term.hasSource, document)
    emit(section, term.label, literal(label))
    emit(section, term.depth, literal(String(heading.depth), namedNode(`${ns.xsd}integer`)))
    const sel = mint.selector(section, 0)
    emit(section, term.hasSelector, sel)
    emit(sel, term.type, term.FragmentSelector)
    emit(sel, term.value, literal(label))
    if (parent) {
      emit(parent.node, term.contains, section)
      emit(section, term.isContainedBy, parent.node)
    }
  }

  const addPart = (kind: string, node: BlockContent, types: NamedNode[]) => {
    const part = mint.part(subject, kind, ++partIndex)
    emit(subject, term.hasPart, part)
    emit(subject, term.contains, part)
    emit(part, term.isContainedBy, subject)
    emit(part, term.type, term.ResourceSelection)
    for (const ty of types) emit(part, term.type, ty)
    emit(part, term.hasSource, document)
    const sel = mint.selector(part, 0)
    emit(part, term.hasSelector, sel)
    emit(sel, term.type, term.TextQuoteSelector)
    emit(sel, term.exact, literal(slice(node)))
    return part
  }

  const value = (raw: string): Quad_Object => {
    const wiki = raw.match(WIKI)
    if (wiki?.[1]) return mint.reference(wiki[1], document)
    if (IRI.test(raw)) return namedNode(raw)
    return literal(raw)
  }

  /** Statement lines in a block, read from the source so markup survives. */
  const fieldLines = (node: BlockContent): [string, string][] | null => {
    const lines = slice(node)
      .split('\n')
      .map((l) => l.replace(/^\s*[-*+]\s+/, '').trim())
    const matched = lines
      .map((l) => l.match(FIELD))
      .filter((m): m is RegExpMatchArray => Boolean(m))
    return matched.length === lines.filter(Boolean).length && matched.length > 0
      ? matched.map((m) => [m[1]!, m[2]!.trim()])
      : null
  }

  const inline = (node: BlockContent) => {
    const walk = (n: RootContent) => {
      if (n.type === 'link' && n.title) {
        // A typed edge: the title slot carries the name, the destination the object.
        emit(
          subject,
          namedNode(ns.token + encodeURIComponent(n.title)),
          n.url === '' ? literal(mdToString(n)) : mint.reference(n.url, document)
        )
      } else if (n.type === 'link') {
        const target = mint.reference(n.url, document)
        emit(subject, term.references, target)
        emit(target, term.label, literal(mdToString(n)))
      } else if (n.type === 'linkReference') {
        const def = gloss.get(n.identifier)
        if (def) {
          usedGloss.add(n.identifier)
          emit(
            subject,
            namedNode(ns.token + encodeURIComponent(def.pred)),
            def.url === '' ? literal(mdToString(n)) : mint.reference(def.url, document)
          )
        }
      }
      for (const child of (n as { children?: RootContent[] }).children ?? []) walk(child)
    }
    walk(node as RootContent)
  }

  const statements = (node: BlockContent): boolean => {
    const fields = fieldLines(node)
    if (!fields) return false
    for (const [key, raw] of fields) {
      // A statement line holds one value, and repeating the key is the plural.
      // A value that looks like several links is reported rather than folded
      // into one literal, which is where the prior art corrupts silently.
      if (/\]\]\s*,\s*\[\[/.test(raw))
        diagnostics.push({
          code: 'value-looks-plural',
          message: `"${key}" holds several links in one line; repeat the key instead`,
          line: node.position?.start.line
        })
      emit(subject, namedNode(ns.token + encodeURIComponent(key)), value(raw))
    }
    return true
  }

  for (const node of tree.children) {
    switch (node.type) {
      case 'yaml': {
        const data = (parseYaml(node.value) ?? {}) as Record<string, unknown>
        for (const [key, raw] of Object.entries(data))
          for (const one of Array.isArray(raw) ? raw : [raw])
            emit(document, namedNode(ns.token + encodeURIComponent(key)), literal(String(one)))
        break
      }
      case 'heading':
        openSection(node)
        break
      case 'blockquote':
        addPart('q', node, [term.BlockQuotation])
        break
      case 'code': {
        const part = addPart('c', node, [term.SoftwareSourceCode])
        if (node.lang) emit(part, term.programmingLanguage, literal(node.lang))
        if (isRdfSyntax(node.lang)) {
          // The block's own IRI names the graph its triples go into, so where a
          // statement came from is already recorded by the structural graph.
          const fence = parseFence(node.value, node.lang!, {
            meta: node.meta,
            defaultBase: document.value
          })
          const graph = fence.graph ? mint.reference(fence.graph, document) : part
          for (const q of fence.quads)
            quads.push(quad(q.subject, q.predicate, q.object, graph) as Quad)
          // Only when the fence named a graph of its own: the default graph is
          // the block itself, and a block does not contain itself.
          if (graph.value !== part.value) emit(part, term.contains, graph)
          for (const problem of fence.problems)
            diagnostics.push({
              code: 'fence-not-parsed',
              message: `${node.lang} block: ${problem}`,
              line: node.position?.start.line
            })
        }
        break
      }
      case 'list':
        if (!statements(node as List)) addPart('l', node as List, [term.List])
        break
      case 'paragraph':
        if (!statements(node as Paragraph)) {
          addPart('p', node as Paragraph, [term.Paragraph])
          inline(node as Paragraph)
        }
        break
      default:
        break
    }
  }

  for (const [id] of gloss)
    if (!usedGloss.has(id))
      diagnostics.push({ code: 'gloss-unused', message: `gloss "${id}" is defined but never used` })

  return { document, quads, diagnostics }
}
