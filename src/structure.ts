import type { NamedNode, Quad, Quad_Object } from '@rdfjs/types'
import GithubSlugger from 'github-slugger'
import type { BlockContent, Heading, List, Paragraph, Root, RootContent } from 'mdast'
import { toString as mdToString } from 'mdast-util-to-string'
import { DataFactory } from 'n3'
import { parse as parseYaml } from 'yaml'
import { type Context, readContext, resolveName, resolveValue } from './context.ts'
import { parse } from './parse.ts'
import { isRdfSyntax, parseFence } from './rdf-fence.ts'
import { commonMarkLink, type Reference, wikiLink } from './reference.ts'
import { naming as defaultNaming, encodeIri, type Naming, ns, term } from './terms.ts'

const { literal, namedNode, quad } = DataFactory

/** A statement line: a name the author chose, and the value it takes. */
const FIELD = /^([A-Za-z][A-Za-z0-9_.:\-/#%]*)\s+::\s+(.+)$/

export interface Diagnostic {
  code:
    | 'heading-level-skipped'
    | 'gloss-unused'
    | 'value-looks-plural'
    | 'fence-not-parsed'
    | 'reference-unresolved'
    | 'slug-collision'
    | 'wiki-link-off'
    | 'name-stated-twice'
    | 'context-not-read'
    | 'prefix-not-declared'
  message: string
  line?: number
}

export interface StructureOptions {
  /** The document's name. Derived from `path` when absent. */
  name?: string
  path?: string
  /**
   * Obsidian's `[[name]]` links, which CommonMark does not define and which
   * resolve by searching a collection rather than against a base. On by
   * default for a vault; a producer that wants CommonMark alone turns it off.
   */
  wikiLinks?: boolean
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
  const wikiLinksEnabled = options.wikiLinks ?? true
  const tree = parse(markdown)

  // github-slugger is what rehype-slug uses, so the anchor here is the anchor
  // the rendered page will have.
  const slugger = new GithubSlugger()
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
  const slugged = new Map<string, string>()
  // Prefix declarations, which frontmatter supplies before anything else is read.
  let context: Context = new Map()

  const openSection = (heading: Heading) => {
    const label = mdToString(heading)
    const section = mint.section(document, label)
    // Two headings that differ only in punctuation land on one section. That is
    // ambiguous in the document itself, so the author gets told rather than
    // finding the two merged later.
    const seen = slugged.get(section.value)
    if (seen && seen !== label)
      diagnostics.push({
        code: 'slug-collision',
        message: `"${label}" and "${seen}" share the identifier ${section.value.split('#').pop()}`,
        line: heading.position?.start.line
      })
    slugged.set(section.value, label)
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

    emit(section, term.type, term.Section)
    emit(section, term.type, term.ResourceSelection)
    emit(section, term.hasSource, document)
    emit(section, term.label, literal(label))
    emit(section, term.depth, literal(String(heading.depth), namedNode(`${ns.xsd}integer`)))
    // The anchor a renderer gives this heading, so a link written against the
    // rendered page finds the section it names.
    emit(section, term.anchor, literal(slugger.slug(label)))
    const sel = mint.selector(section, 0)
    emit(section, term.hasSelector, sel)
    emit(sel, term.type, term.FragmentSelector)
    emit(sel, term.value, literal(label))
    // The document is the root of the containment tree, so a top-level section
    // is one contained by something that is not a section.
    const container = parent?.node ?? document
    emit(container, term.contains, section)
    emit(section, term.isContainedBy, container)
  }

  const addPart = (kind: string, node: BlockContent, types: NamedNode[]) => {
    const part = mint.part(subject, kind, ++partIndex)
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

  /** One reference, whichever spelling it was written in, as an RDF object. */
  const object = (ref: Reference, line?: number): Quad_Object => {
    if (ref.problem) diagnostics.push({ code: 'reference-unresolved', message: ref.problem, line })
    if (ref.kind === 'none') return literal(ref.anchor)
    if (ref.kind === 'iri') return namedNode(ref.target)
    return mint.reference(ref.target, document)
  }

  /**
   * A statement value. A wiki link, an absolute IRI or a CommonMark link all
   * name something; anything else is the text itself.
   */
  /** A predicate name, with a complaint when its prefix was never declared. */
  const predicate = (name: string, line?: number): NamedNode => {
    const { node, problem } = resolveName(name, context)
    if (problem) diagnostics.push({ code: 'prefix-not-declared', message: problem, line })
    return node
  }

  const literalOrResource = (raw: string): Quad_Object => resolveValue(raw, context) ?? literal(raw)

  const value = (raw: string, key: string, line?: number): Quad_Object => {
    const wiki = wikiLink(raw)
    if (wiki) {
      if (!wikiLinksEnabled) {
        diagnostics.push({
          code: 'wiki-link-off',
          message: `"${raw}" looks like a wiki link, which CommonMark does not define; enable the wikiLinks profile to resolve it`,
          line
        })
        return literal(raw)
      }
      return object(wiki, line)
    }
    const resource = resolveValue(raw, context)
    if (resource) return resource
    const inlineTree = parse(raw)
    const paragraph = inlineTree.children[0]
    if (paragraph?.type === 'paragraph' && paragraph.children.length === 1) {
      const only = paragraph.children[0]
      if (only?.type === 'link') {
        // The statement line already names the relationship, so a title slot on
        // its value would be a second name for the same triple.
        if (only.title)
          diagnostics.push({
            code: 'name-stated-twice',
            message: `"${key}" already names this statement, so the title "${only.title}" on its value is ignored`,
            line
          })
        return object(commonMarkLink(mdToString(only), only.url, null), line)
      }
    }
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

  /**
   * References in running prose. A name makes the reference a statement; no
   * name makes it a plain reference. The anchor text gets no triple of its
   * own: it is already in the quote selector of the part it sits in.
   */
  const inline = (node: BlockContent, line?: number) => {
    const state = (ref: Reference) => {
      // A name in a gloss is a name like any other, so it resolves the same way.
      if (ref.name) emit(subject, predicate(ref.name, line), object(ref, line))
      else if (ref.kind !== 'none') emit(subject, term.references, object(ref, line))
    }
    const walk = (n: RootContent) => {
      if (n.type === 'link') {
        state(commonMarkLink(mdToString(n), n.url, n.title))
      } else if (n.type === 'linkReference') {
        const def = gloss.get(n.identifier)
        if (def) {
          usedGloss.add(n.identifier)
          state(commonMarkLink(mdToString(n), def.url, def.pred))
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
      emit(
        subject,
        predicate(key, node.position?.start.line),
        value(raw, key, node.position?.start.line)
      )
    }
    return true
  }

  for (const node of tree.children) {
    switch (node.type) {
      case 'yaml': {
        const data = (parseYaml(node.value) ?? {}) as Record<string, unknown>
        const read = readContext(data['@context'])
        context = read.context
        for (const problem of read.problems)
          diagnostics.push({
            code: 'context-not-read',
            message: problem,
            line: node.position?.start.line
          })
        // What the document says it is. A type is an IRI, so which rules read
        // a document of that type is a question for whoever holds the rules.
        for (const one of [data['@type'] ?? []].flat())
          emit(document, term.type, predicate(String(one), node.position?.start.line))
        for (const [key, raw] of Object.entries(data)) {
          if (key.startsWith('@')) continue
          for (const one of Array.isArray(raw) ? raw : [raw])
            emit(
              document,
              predicate(key, node.position?.start.line),
              literalOrResource(String(one))
            )
        }
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
          inline(node as Paragraph, node.position?.start.line)
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
