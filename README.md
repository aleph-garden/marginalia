# marginalia

Deferred semantics for CommonMark. A markdown document becomes a structural RDF
graph, and SPARQL CONSTRUCT rules decide what any of it means.

Status: 0.1.0, an experiment. The format is not settled and the API will move.

## The two layers

**Structure.** A document is parsed by CommonMark and turned into RDF that
describes the document: sections and how they nest, paragraphs, quotations and
code blocks as addressable slices, links, and every name the author wrote down.
Nothing here assigns meaning. An author-chosen name such as `broader` lands as
`urn:token:broader`, and a document that says nothing about vocabulary produces
a graph that says nothing about vocabulary.

**Meaning.** A SPARQL CONSTRUCT lifts those placeholders onto real terms. That
layer is not this project's invention: the rules are `.rq` files, so the only
thing left to settle is where they live and in what order they run.

The split is what lets one set of notes serve several target vocabularies. The
same file becomes SKOS today and schema.org tomorrow by swapping one query,
with no edit to the corpus.

## What an author writes

Three carriers, and only the first is syntax this format adds.

A **statement line** states a fact about the section it sits in:

```markdown
broader :: [[space-missions|Space missions]]
focus :: https://www.wikidata.org/entity/Q43653
```

A **gloss** marks a span of running prose. It is a CommonMark link whose title
slot carries the name, either inline or collected at the foot of the file:

```markdown
Commanded by [Neil Armstrong], it launched in [1969] and was run by [NASA].

[Neil Armstrong]: <> "commander"
[1969]: <> "year"
[NASA]: https://nasa.gov "organizer"
```

An empty destination means the anchor text is the value; any other destination
means the anchor text is a label and the target is the object. A bracket with no
definition stays prose, so an unfinished annotation costs nothing.

**Structure** carries the rest. Headings, quotations and code blocks arrive as
slices with Web Annotation selectors without anyone annotating them.

## Vocabulary

The structural graph is built from terms that already exist:

| Concern | Terms |
|---|---|
| addressing a slice | `oa:ResourceSelection`, `oa:hasSource`, `oa:hasSelector`, `oa:FragmentSelector`, `oa:TextQuoteSelector` |
| document components | `doco:Section`, `doco:Paragraph`, `doco:BlockQuotation`, `schema:SoftwareSourceCode` |
| containment | `po:contains`, `po:isContainedBy` |
| the document | `schema:DigitalDocument`, `schema:about`, `dct:references` |

One term is minted here, `marginalia:depth`, because CommonMark's heading depth
has no equivalent anywhere. Blank nodes are never used: every slice gets a
derived IRI, so graphs diff cleanly and independently produced files merge
without collisions.

## Sections

CommonMark has no sections. Its tree has headings as siblings of the blocks that
follow them, so the nesting a reader takes for granted is derived. The rule:
a heading of depth *n* opens a section contained by the nearest open section of
lesser depth. The same derivation is written down as the HTML document outline
and implemented by `pandoc --section-divs` and `remark-sectionize`.

A section is identified by its heading text, never by its position, so inserting
a paragraph above a heading leaves every reference to it intact. A jump of more
than one level is reported as a diagnostic and still nests, which is how HTML
treats it.

## Use

```bash
bun install

# the document as a structural graph
bun src/cli.ts structure examples/apollo/README.md --name apollo

# that graph after a mapping has given it meaning
bun src/cli.ts map examples/apollo/README.md examples/apollo/mapping.rq --name apollo
```

```ts
import { applyMapping, structure, write } from '@aleph-garden/marginalia'

const { quads, diagnostics } = structure(markdown, { name: 'apollo' })
const meaning = applyMapping(quads, [rule])
console.log(write(meaning))
```

## Examples

Each directory under `examples/` holds a document that explains itself, the two
graphs it produces, and the rules that produce the second:

```
examples/apollo/
  README.md      the document, which is also the explanation
  tree.trig      the structural graph, a dataset because a fence makes a graph
  mapping.rq     the rules
  meaning.ttl    the graph after the rules
```

Tests compare graphs for isomorphism rather than bytes, so a golden file may be
reformatted, reordered or commented for a reader without breaking.

## Prior art

The two-layer split, with placeholder predicates resolved later by CONSTRUCT,
comes from Cristian Vasquez's [dot-triples](https://github.com/cristianvasquez/dot-triples).
This project owes it the idea; what it does differently is borrow the parser
instead of scanning lines, use published vocabulary instead of a private scheme,
and make IRI minting a parameter.

The wider field, for anyone weighing the options:

| Project | Position |
|---|---|
| [dot-triples](https://github.com/cristianvasquez/dot-triples) | deferred semantics, Obsidian-shaped, hand-written scanner |
| [markdown-ld](https://github.com/ozekik/markdown-ld) | structure carries meaning, with inline Turtle per line |
| [markdown-rdfa](https://github.com/tetherless-world/markdown-rdfa) | RDFa Lite inline, dormant since 2019 |
| [MD-LD](https://github.com/davay42/mdld-parse) | sigil syntax, arbitrary triples in prose, no open licence |
| [Vault-LD](https://github.com/The-Knowledge-Graph-Guys/vault-ld) | YAML-LD frontmatter through a shared context, prose stays prose |
| [MIF](https://github.com/modeled-information-format/MIF) | JSON-LD and Markdown maintained side by side |
| [YARRRML](https://rml.io/yarrrml/spec/) | declarative mappings for other sources, no markdown input |
| [YAML-LD](https://json-ld.github.io/yaml-ld/spec/) | the standards-track relative |

Discussion of a common markdown-to-RDF syntax is
[w3c-cg/solid#69](https://github.com/w3c-cg/solid/issues/69).

## RDF in a fence

A fenced code block whose language is an RDF syntax is parsed, and its triples
land in a named graph whose name is the block's own IRI:

````markdown
```turtle
<#armstrong> a schema:Person ; schema:name "Neil Armstrong" .
```
````

Turtle, TriG, N-Triples, N-Quads and N3 are read. Relative references resolve
against the document, so `<#armstrong>` lands beside that document's sections.
The info string takes `base=` to resolve against something else and `graph=` to
collect several blocks into one graph.

Because the graph name is the block, provenance needs no extra vocabulary: the
block already carries its source, its selectors and its language. And because
the triples sit in their own graph, a mapping reaches them through `GRAPH` and
does so on purpose, so a block cannot be mistaken for something the structure
said. A block that does not parse is reported and contributes nothing.

## Deliberately absent

An arbitrary subject in running prose. Stating a subject, a predicate and an
object inside a sentence needs three markers per statement, which is how every
earlier attempt ended up with sigils in the text, and the one hard requirement
here is that prose reads as prose. A statement attaches to the section it sits
in. For anything that needs its own subject, open a heading or write a fence:
that case is RDF, and RDF has a syntax already.

## Licence

MIT.
