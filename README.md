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

Three carriers, and only the first is syntax this format adds. Frontmatter
carries a fourth, which is the same three rules applied to a YAML mapping.

A **statement line** states a fact about the section it sits in:

```markdown
broader :: [[space-missions|Space missions]]
focus :: https://www.wikidata.org/entity/Q43653
```

A statement key may start with `@`, which this format keeps for itself. Two are
defined, and any other `@`-key is reported and contributes nothing:

```markdown
@subject :: https://www.wikidata.org/entity/Q1615
@type    :: schema:Person
```

`@subject` says what the statements and glosses from that line to the end of the
section are about, and the sections nested under it inherit that until one of
them says otherwise. The section keeps its identity and its containment: it is
still a slice of the document, the paragraph is still its part, and a plain link
is still a reference the section makes. Only what the author stated moves. The
key works in frontmatter too, where it covers the whole document: the
frontmatter statements and every section below. `@type` emits `rdf:type`, and
follows `@subject` the way every other statement does.

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
| addressing a slice | `oa:ResourceSelection`, `oa:hasSource`, `oa:hasSelector`, `oa:FragmentSelector`, `oa:TextQuoteSelector`, `oa:exact` |
| document components | `doco:Section`, `doco:Paragraph`, `doco:BlockQuotation`, `doco:List` |
| containment | `po:contains`, `po:isContainedBy` |
| the document | `schema:DigitalDocument`, `schema:SoftwareSourceCode`, `schema:programmingLanguage`, `dct:references` |
| an entry of a list | `schema:ListItem`, `schema:position`, `marginalia:checked` |
| what a section's statements are about | `marginalia:subject` |

Two of those are the ones a consumer has to know to do the usual thing, which
is to find sections, walk containment and read text: Web Annotation and
DoCO with the Pattern Ontology it is built on. The rest is detail to look up
when it comes up.

DoCO defines `List` and leaves its entries to the Pattern Ontology, whose
classes type an entry by its shape and carry no order, so a mapping would have
to match two of them and still ask what came first. An entry here is a
`schema:ListItem` carrying `schema:position`: one class, and the order with it.
DoCO's restriction on what a list contains is neither satisfied nor
contradicted.

Four terms are minted here. `marginalia:depth` carries the heading depth, which
has no equivalent anywhere, and `marginalia:anchor` carries the identifier a
renderer gives a heading, computed with `github-slugger` so it matches what
`rehype-slug` will put in the HTML. ITS 2.0 defines `itsrdf:id` for the same
idea; one term is not worth a dependency on a localisation specification whose
ontology file carries no definitions, so the correspondence is noted here
rather than imported. `marginalia:subject` records the redirect an `@subject`
line makes, so a consumer can see that the statements under a section were made
about something the section names. `schema:about` is the near miss: it says what
a work is about, which stays true of a section whose statements never moved.
`marginalia:checked` carries the state of a GFM task box, which the box says and
no vocabulary of documents has a word for; what a tick means is the mapping's.

`schema.org` is the one vocabulary here that is not a standard: it is run by a
consortium in a W3C Community Group, and CG reports are explicitly not W3C
standards. It stays because no W3C vocabulary has a class for source code, and
minting one would be worse. Dublin Core is not a W3C product either, and is
ISO 15836 and used normatively by DCAT.

Blank nodes are never used: every slice gets a derived IRI, so graphs diff
cleanly and independently produced files merge without collisions.

### What earns a term

A term belongs in the structural graph only when a consumer can do something
with it that it could not derive from the terms already there. Applied, that
test removes more than it admits. `schema:hasPart` went, because `po:contains`
already says it. `itsrdf:space` and `itsrdf:translate` never arrived, because
a consumer knows a code block preserves whitespace from its type. `schema:about`
from a document to its sections went when the document became the root of the
containment tree, which `po:contains` already covers.

The test matters more than any single cut: without it the vocabulary grows by
one plausible addition at a time until nobody can implement the format.

## When a name already says what it means

Deferral earns its place where the author had no vocabulary in mind. `broader`
in a pile of notes is such a name, and the whole point of the split is that one
corpus can serve several target vocabularies. Where the author has already
chosen, deferral is a detour: mapping `urn:token:schema:name` to `schema:name`
adds a rule that says a name means what it says.

So a name that is already qualified is used as written, and only a bare one is
deferred. Prefixes are declared in frontmatter, in the YAML-LD shape:

```yaml
---
"@context":
  schema: https://schema.org/
"@type": schema:CreativeWork
schema:name: Apollo 11
status: draft
---
```

```turtle
<doc> a schema:CreativeWork ;
      schema:name "Apollo 11" ;
      urn:token:status "draft" .
```

The same rule runs everywhere a name appears, so a statement line and a gloss
behave like a frontmatter key:

```markdown
schema:dateCreated :: 1969-07-16      # a term
role               :: commander       # deferred
kind               :: schema:Person   # a declared prefix in a value, too
```

A value is left alone unless its prefix is declared, because a value may be any
text and a colon in one is not evidence of anything. A key is different: a colon
there with nothing declared behind it is almost always a forgotten declaration,
so `prefix-not-declared` says so and the name is deferred. JSON-LD would mint
`schema:name` as an IRI with the scheme `schema`; saying so is the smaller
surprise.

## What a document is

`@type` carries an IRI, and that is the whole of it. Which rules read a document
of a given type is a question for whoever holds the rules, not for the document
and not for this parser.

This repository holds a set of them in `mappings/`, one file per kind of
document, each bound to the type it reads: `skos.rq` to `skos:ConceptScheme`,
`meeting.rq` to `schema:Event`, `todo.rq` to `wf:Tracker` from the Flow
ontology. `meeting.rq` writes `schema:attendee`, `minutes:scribe`,
`minutes:apologies` and one `minutes:Decision` per entry of a list under a
section typed `minutes:Decisions`. `todo.rq` writes a `wf:Task` per entry,
with `wf:Open` or `wf:Closed` from the box, `wf:goalDescription` from
the label, `wf:dependent` from the nesting, `wf:tracker` back at the carrier,
and an entry's own `owner ::` and `due ::` as `schema:agent` and `wf:dateDue`.
A meeting's open items are a section typed `wf:Tracker`, so the task rule reads
them and the minutes stay out. `minutes:` is
`https://aleph.garden/ns/minutes#`, this project's namespace for the
minute-taking terms no published vocabulary has, in the same spirit as the
terms minted under `marginalia:`.

A rule matches the type and reaches content by containment from whatever
carries it, so a section may declare a type and be read on its own: an
`## Action items` section typed `wf:Tracker` holds the list its rule wants one
`po:contains` away. `map doc.md mappings/*.rq` reads a document with everything
it declares, and each rule sees the structural graph alone, so the order they
run in changes nothing. A type declared under `@subject` sits on the thing the
section names, and a rule that wants that thing's content hops
`^marginalia:subject` first; the shipped rules stay on the section.

A key naming a mapping file was the obvious alternative and is worse: a relative
path needs a filesystem to resolve, which puts back the context this parser
deliberately does without. A type is a name in RDF, and a deployment that wants
to bind types to rule sets can say so in RDF, out of band.

## What a document is called

`@id` gives the document its own IRI, and everything cut from it follows:
sections become real fragments of it, and every slice points back at it.

```yaml
---
"@id": https://pod.toph.so/weltbild/apollo
---
# Apollo 11
```

```turtle
<https://pod.toph.so/weltbild/apollo#apollo-11>
    a doco:Section ; oa:hasSource <https://pod.toph.so/weltbild/apollo> .
```

Without it, a name is minted under `urn:doc:` as a placeholder for a document
that has not been told what it is called. A relative `@id` is reported, for the
same reason a relative link target above the document is: resolving it needs a
base this parser is not given.

What a document is called and what it is about are two things, and only the
first needs a mechanism. A note about Neil Armstrong is not Neil Armstrong, and
RDF has had words for that relationship for twenty years:

```yaml
"@id": https://pod.toph.so/weltbild/apollo
schema:about: https://dbpedia.org/resource/Apollo_11
```

That is an ordinary statement under the rule above, so nothing here defines it.

## Sections

CommonMark has no sections. Its tree has headings as siblings of the blocks that
follow them, so the nesting a reader takes for granted is derived. The rule:
a heading of depth *n* opens a section contained by the nearest open section of
lesser depth. The same derivation is written down as the HTML document outline
and implemented by `pandoc --section-divs` and `remark-sectionize`.

A section is identified by the slug of its heading, never by its position, so
inserting a paragraph above a heading leaves every reference to it intact. The
slug is the one `github-slugger` produces, which is the identifier `rehype-slug`
writes into rendered HTML, so `[…](other.md#some-heading)` names the same
section that other document mints for itself. A jump of more than one level is
reported and still nests, which is how HTML treats it.

The slug is flat rather than qualified by the sections above it, and each side
of that costs something. Flat keeps a cross-document reference working without
an index: a writer naming `other.md#skills` has no way to know whether that
section sits under `#bio` or under `#work` over there. The cost is that two
sections with the same heading under different parents become one node. Where
the headings differ only in punctuation, `slug-collision` reports it; where they
are the same word, they merge silently and renaming one is the only fix.

## Use

```bash
bun install

# the document as a structural graph
bun src/cli.ts structure examples/apollo/README.md --name apollo

# that graph after a mapping has given it meaning
bun src/cli.ts map examples/apollo/README.md examples/apollo/mapping.rq --name apollo

# the same graph drawn as the tree it already is
bun src/cli.ts tree examples/apollo/README.md --name apollo
```

```ts
import { applyMapping, structure, tree, write } from '@aleph-garden/marginalia'

const { quads, diagnostics } = structure(markdown, { name: 'apollo' })
const meaning = applyMapping(quads, [rule])
console.log(write(meaning))
console.log(tree(quads))
```

## Examples

Each directory under `examples/` holds a document that explains itself and the
graphs it produces. `bun run goldens` rewrites them all.

```
examples/two-vocabularies/
  README.md        the document, which is also the explanation
  tree.txt         the graph drawn as the tree it already is
  tree.ttl         the same graph, as Turtle
  skos.rq          one reading
  skos.ttl         what that reading produces
  schema-org.rq    another reading of the same document
  schema-org.ttl   what that one produces
```

A structural graph is Turtle until an RDF fence gives it a named graph, and TriG
after that, because GitHub highlights the first and not the second. Every `.rq`
has a golden of the same name, so one document can show several vocabularies. A
golden with no `.rq` beside it comes from the shipped rule of that name, which
every example is read by.

| Example | What it shows |
|---|---|
| `apollo` | the three carriers in one document |
| `frontmatter` | `@context`, `@type`, `@id`, and a document that needs no mapping |
| `two-vocabularies` | one note read as SKOS and as schema.org, with nothing in it changed |
| `meeting` | minutes of the kind the work item asked for, with the open items as a tracker |
| `mixed` | one note read as minutes and as a task list, by two shipped rules |
| `sections` | nesting, a skipped level, and why depth is not the tree |
| `subjects` | `@subject` and `@type` in statement lines, and what a section keeps |
| `lists` | entries as items: position, label, a task box, and what an item states |
| `todo` | the breakfast list from the discussion, read as Flow tasks |
| `fences` | RDF blocks as named graphs |

Tests compare graphs for isomorphism rather than bytes, so a golden may be
reformatted, reordered or commented for a reader without breaking.

The drawing is what a person reads:

```
urn:doc:meeting  (schema:DigitalDocument, schema:Event)
│ schema:startDate "2026-09-18T15:00:00Z"
└─ format-work-item-weekly  (doco:Section)  Format work item, weekly
   ├─ attending  (doco:Section)  Attending
   │  │ scribe "Toph"
   │  │ attendee → urn:doc:people/toph
   │  └─ attending.p1  (doco:Paragraph)  Notes were taken by [Toph](<> "scribe")…
   └─ decisions  (doco:Section)  Decisions
      ├─ decisions.p1  (doco:Paragraph)  The parser stays borrowed rather than…
      └─ decisions.l2  (doco:List)  - borrow the parser - one added production…
         ├─ decisions.l2.i1  (schema:ListItem)  borrow the parser
         │    schema:position "1"
         └─ decisions.l2.i2  (schema:ListItem)  one added production, and only…
              schema:position "2"
```

## Prior art

The two-layer split, with placeholder predicates resolved later by CONSTRUCT,
comes from Cristian Vasquez's [dot-triples](https://github.com/cristianvasquez/dot-triples).
This project owes it the idea; what it does differently is borrow the parser
instead of scanning lines, use published vocabulary instead of a private scheme,
and make IRI minting a parameter.

The wider field, for anyone weighing the options. Two axes separate them:
whether a statement in running prose may have any subject, and whether that
prose still reads as prose once it is annotated. HTML has RDFa because an
attribute is invisible in the rendering; markdown has two invisible slots,
frontmatter and the title of a link, and no third. So a format either confines
itself to those slots and gives up the free subject, or it adds markers to the
text and gives up the prose. This one takes the first side, and puts the free
subject in a fence, where RDF is written as RDF.

| Project | Any subject in prose | Prose stays prose | Meaning decided |
|---|---|---|---|
| [dot-triples](https://github.com/cristianvasquez/dot-triples) | no, the note or heading | yes | later, by CONSTRUCT |
| [markdown-ld](https://github.com/ozekik/markdown-ld) | yes, Turtle per line | no | in the document |
| [markdown-rdfa](https://github.com/tetherless-world/markdown-rdfa) | yes, RDFa Lite inline | no; dormant since 2019 | in the document |
| [MD-LD](https://github.com/davay42/mdld-parse) | yes, sigils | no; no open licence | in the document |
| [Vault-LD](https://github.com/The-Knowledge-Graph-Guys/vault-ld) | no, frontmatter only | yes | in the document, through a shared context |
| [MIF](https://github.com/modeled-information-format/MIF) | in JSON-LD kept beside the markdown | yes | in the document |
| [YARRRML](https://rml.io/yarrrml/spec/) | no markdown input | | later, by mapping |
| [YAML-LD](https://json-ld.github.io/yaml-ld/spec/) | the standards-track relative of the frontmatter | | in the document |
| marginalia | no, the section; any subject in a fence | yes | later, or in the document for a qualified name |

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
that case is RDF, and RDF has a syntax already. `@subject` names the subject
once per section, so the prose itself still carries no subject marker.

## Profiles

Two things a document may contain cannot be resolved from the document alone,
so a producer says whether it can supply what they need.

**Wiki links.** `[[some-note]]` is not CommonMark, and its target is a name
resolved by searching a collection rather than a reference resolved against a
base. `structure(markdown, { wikiLinks: false })` leaves them as text and
reports `wiki-link-off`. They are on by default, because a vault is the common
case; a producer working on loose files turns them off.

**RDF in a fence.** A block states real IRIs directly, skipping the deferral
every other carrier goes through, so it lands in its own graph rather than
among the structural triples. See above.

## Diagnostics

Nothing here stops a run. A producer reports, a consumer keeps working.

| Code | What it means |
|---|---|
| `heading-level-skipped` | a heading jumped more than one level, which HTML calls non-conforming |
| `slug-collision` | two headings that differ only in punctuation share one identifier |
| `value-looks-plural` | a statement line holds several links; repeat the key instead |
| `name-stated-twice` | a statement key already names the triple, so a title on its value was ignored |
| `reference-unresolved` | a path points above the document, which needs a base this parser is not given |
| `wiki-link-off` | a wiki link was found while the profile is off |
| `gloss-unused` | a link definition carries a name that nothing in the prose uses |
| `fence-not-parsed` | an RDF block did not parse, or needs a hierarchical base |
| `prefix-not-declared` | a key looks like a CURIE whose prefix no `@context` declares |
| `context-not-read` | `@context` is not a mapping of prefix to namespace |
| `id-not-absolute` | `@id` is relative, and resolving it needs a base this parser is not given |
| `key-reserved` | a statement key starts with `@`, where only `@subject` and `@type` are defined |
| `subject-not-a-name` | `@subject` resolves to a literal, and a subject has to be a name |


## Open questions

What is deferred, decided against, or not this project's to decide is in
[docs/open-questions.md](docs/open-questions.md): extraction on the server as
well as the client, whether a resource may offer several views, who decides how
a graph is drawn, and the two markdown parsers that will disagree at the edges.
## Licence

MIT.
