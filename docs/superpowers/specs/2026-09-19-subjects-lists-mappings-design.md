# Section subjects, list items, and shipped mappings

Three additions, in dependency order. Each is usable on its own; the third
needs the first two to show what it is for.

The goal behind all three: a mapping for an ordinary kind of note (a meeting,
a task list, a glossary) should be a handful of triple patterns, and the
patterns should be reusable across documents. Today the meeting mapping is
thirty lines because two `decision ::` lines land on one section and the rule
has to mint identifiers with `BIND(IRI(CONCAT(…)))`. The natural way to write
two decisions is a list, and the structural graph does not carry list items.

## A. Reserved keys in statement lines

A statement key may start with `@`. Two are defined; any other `@`-key is
reported as `key-reserved` and the line contributes nothing.

### `@subject`

```markdown
## Neil Armstrong

@subject :: https://www.wikidata.org/entity/Q1615
born :: 1930-08-05
Commanded [Apollo 11](<> "commanded").
```

From that line to the end of the section, statement lines and glosses state
facts about the named subject instead of the section. Nested sections inherit
it, as RDFa's `about` is inherited by descendants, and may set their own. The
section itself keeps its identity and its containment: it is still a slice of
the document, the paragraph is still its part, and a plain link is still
`dct:references` from the section. Only what the author stated moves.

The structural graph records the redirect on the section:

```turtle
<doc#neil-armstrong> marginalia:subject <https://www.wikidata.org/entity/Q1615> .
<https://www.wikidata.org/entity/Q1615> urn:token:born "1930-08-05" ;
    urn:token:commanded <doc#apollo-11> .
```

The value resolves like any statement value: an absolute IRI, a CURIE whose
prefix `@context` declares, a wiki link, or a relative reference. A value that
resolves to a literal is reported as `subject-not-a-name` and ignored.

Frontmatter gets the same key by the existing rule that frontmatter is the
three carriers applied to a YAML mapping: `@subject` there redirects the
frontmatter statements, including `@type`, and everything below, since the
document is the root of the containment tree and sections inherit from it as
they inherit from each other. A note that is about one thing states that once.
`@id` keeps its job of naming the document.

Scope starts at the line, so a statement above `@subject` in the same section
stays on the section. That is what a reader of the source sees, and it keeps
the parser single-pass. The README recommends writing it first.

### `@type`

```markdown
## Action items

@type :: wf:Tracker
```

Emits `rdf:type` with the value resolved as a name, exactly as frontmatter
`@type` does. It is a statement, so it follows `@subject` when one is active
and types the section otherwise.

### Tree

`tree` draws the redirect on the section as `│ @subject → <iri>` and draws the
subject's statements under that line, so a section reads the same whether its
facts sit on it or on something it names.

### Acceptance

- `examples/subjects/README.md`: a note about two people, one section each,
  each with `@subject`, plus a nested section that inherits it and a sibling
  that does not. Goldens show the facts on the Wikidata IRIs and the slices on
  the sections. `tree.txt` shows the redirect.
- Tests: a statement before `@subject` stays on the section; a gloss after it
  moves; a nested section inherits; a literal value is reported; `@foo` is
  reported; frontmatter `@subject` redirects the frontmatter keys.
- Every existing golden is unchanged, since no key today starts with `@`.

## B. List items as slices

A list that is not a statement list (the existing rule: every line matches
`key :: value`) becomes a `doco:List` containing one item per entry.

```turtle
<doc#action-items.l1> a doco:List, oa:ResourceSelection ; po:contains <doc#action-items.l1.i1>, … .
<doc#action-items.l1.i1> a schema:ListItem, oa:ResourceSelection ;
    po:isContainedBy <doc#action-items.l1> ;
    schema:position 1 ;
    rdfs:label "Cook eggs" ;
    marginalia:checked true ;
    oa:hasSource <doc> ; oa:hasSelector … .
```

- **Item IRI**: `mint.part(list, 'i', n)`, so `…l1.i2`, `…l1.i2.l1.i1` for a
  nested one. Same naming rule as every other part.
- **Type**: `schema:ListItem`. DoCO defines `List` and no item class. Its
  restriction on what a list contains names PO's pattern classes, `po:Block`,
  `po:Field` or a plain `po:Container`, which type an item by its shape (text
  only, or blocks inside) and carry no position; a mapping would have to
  match two classes and still lack the order. One class that brings
  `position` with it is worth more, and schema.org is already in the
  structural vocabulary. The DoCO restriction is neither satisfied nor
  contradicted, and the README's vocabulary section says so in a sentence.
- **`schema:position`**: 1-based, `xsd:integer`. Lists are ordered by nature
  and nothing else in the graph says the order.
- **`rdfs:label`**: the plain text of the item's first paragraph, the way a
  section's label is its heading text. This is what a mapping reads; a todo
  rule needs no selector.
- **`marginalia:checked`**: `xsd:boolean`, present only for a GFM task item
  (`- [ ]` / `- [x]`). The box is structure; what a tick means is the mapping's.
- **Slice**: the item's selector covers its whole source, nested list included,
  as a section's does.
- **Nesting**: the blocks of an item after its first paragraph are parts of the
  item, through the same dispatch that handles the blocks of a section: a
  nested list becomes `doco:List` contained by the item, a second paragraph a
  `doco:Paragraph`, a quotation a `doco:BlockQuotation`. The first paragraph
  gets no part of its own; its text is the label and its glosses are read.
- **Subject**: inside an item, the item is the statement subject. A gloss in
  the item's text and a statement line in its continuation state facts about
  the item. `@subject` works there too, scoped to the item.
- Not carried: ordered versus bullet, tight versus loose, the marker
  character. Nothing a consumer has asked for reads them.

The block dispatch in `structure.ts` is a `switch` over root children. It
becomes a function over a block and a subject, called for root children with
the current section and for item children with the item.

### Acceptance

- `examples/lists/README.md`: a bullet list, a nested list two deep, a task
  list with one ticked box, an item with a continuation statement line, an
  item with a gloss, an ordered list. Goldens show items, positions, labels,
  checks, containment and item-level facts.
- Tests: a statement list is still statements and gets no `doco:List`;
  `position` counts from 1 per list; `checked` absent on a plain item;
  the nested list is contained by its item and not by the section.
- The `meeting` example rewrites its `decision ::` lines as a list, and its
  mapping loses the `BIND(IRI(CONCAT(…)))`: an item is already a subject.

## C. Shipped mappings

`mappings/` at the repository root holds one `.rq` per kind of document, each
reading a type the document declares:

| File | Reads | Produces |
|---|---|---|
| `skos.rq` | `skos:ConceptScheme` on the document | one `skos:Concept` per top-level section, `broader`, `related`, `altLabel`, scope note from a quotation |
| `meeting.rq` | `schema:Event` on the document or a section | `schema:attendee`, `minutes:scribe`, `minutes:apologies`, one `minutes:Decision` per item of a list under an untyped section; open items are a `wf:Tracker` section read by `todo.rq` |
| `todo.rq` | `wf:Tracker` on the document or a section | `wf:Task` per item, `wf:Open` or `wf:Closed` from the box, `wf:goalDescription` from the label, `wf:dependent` from nesting, `wf:tracker` back, `due ::` as `wf:dateDue`, `owner ::` as `schema:agent` |

`wf:` is `http://www.w3.org/2005/01/wf/flow#`, the Flow ontology. Its
`Task` is the disjoint union of `Open` and `Closed`, which is what a checkbox
carries.

`minutes:` is `https://aleph.garden/ns/minutes#`, this project's namespace for
the two minute-taking terms no published vocabulary has, in the spirit of the
minted `marginalia:` terms. A rule shipped here emits no `example.org` term.

A rule matches on the type and finds content by containment from whatever
carries the type. That is why the type keyed on a section works: the tracker
is the section, its list is `po:contains` away. A type declared under
`@subject` sits on the named thing, and a rule that wants that thing's content
hops `^marginalia:subject` first; the shipped rules do not, and the README
says so.

The CLI already takes several rules, so `map doc.md mappings/*.rq` reads a
document with everything it declares. `applyMapping` keeps each rule's output
apart from the others' input, so order does not matter.

### Goldens

`scripts/goldens.ts` runs every rule in `mappings/` against every example and
writes `<name>.ttl` beside the example when the output is non-empty, removing
a stale one when it is empty. An example's own `.rq` files keep working as
they do: a local reading, golden of the same name. So an example that shows
"the same note read two ways" keeps its two untyped local rules, and an
example that declares a type gets the shipped reading for free.

### Acceptance

- `examples/mixed/README.md`: meeting minutes typed `schema:Event` in
  frontmatter, with an `## Action items` section typed `wf:Tracker` holding a
  task list with nesting and one ticked box. Goldens: `meeting.ttl` and
  `todo.ttl`, both from `mappings/`, with the tasks and the minutes in one
  graph and nothing from either rule leaking into the other's output.
- `examples/meeting` declares its type and drops its local `mapping.rq` in
  favour of the shipped one. `examples/two-vocabularies` keeps its local
  rules and declares no type.
- `examples/todo/README.md`: the breakfast list from w3c-cg/solid#69, read by
  `mappings/todo.rq` into the graph shown there.
- Tests: `examples.test.ts` covers the new goldens through the existing
  isomorphism check; a test asserts `mappings/todo.rq` on a document without
  `wf:Tracker` produces nothing.

## README

- The three carriers section gains the two reserved keys.
- The vocabulary table gains `schema:ListItem`, `schema:position`,
  `marginalia:subject`, `marginalia:checked`.
- "What a document is" gains a paragraph: the rules shipped in `mappings/`
  bind to a type, a section may declare one, and `map doc.md mappings/*.rq`
  is how a document is read with all of them.
- "Deliberately absent" is still true and gets a sentence: `@subject` names
  the subject once per section, so prose still carries no subject marker.
- Diagnostics table gains `key-reserved` and `subject-not-a-name`.
