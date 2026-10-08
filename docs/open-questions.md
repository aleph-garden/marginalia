# Open questions

Things decided against, deferred, or not ours to decide. Written down so the
next person to ask does not have to re-derive the answer, and so the ones still
open stay visible.

## Extraction on the server as well as the client

quadpod stores every RDF resource as a named graph in one quad store, which
makes a question that spans resources one query. Bytes that are not RDF live in
a blob store, described by triples the server owns. As of this writing it has no
markdown extraction: the word does not appear in its source.

If it had one, a markdown resource would be a graph like any other, and a query
over a vault would not need a client to have walked it first. That is worth
something on its own, and it has a second effect: the client and the server then
have to agree on what a document means, which is the condition a specification
exists to create.

It also gives the Rust implementation a reason. A second implementation is how a
specification is shown to be implementable, and quadpod is Rust already. Built
second it is a check; built first it would have been a bet.

Nothing here is decided. The note records why the two are connected.

## One view per resource, or several

`view` selects a view with `select(resource, hint?) => View | undefined`, and
fills the graph through the first parser whose content type matches. The parser
side is right for a format that defers meaning: one canonical structural graph,
and the variation lives in mappings that run afterwards. A parser that decided
meaning would need several per content type and would lose.

The view side is the question. A resource has many good renderings, and the
contract already carries the pieces to find them, `when` on each view plus
registry rules plus a hint. What it does not carry is more than one answer: the
return type picks a winner. Offering candidates, with selection as "the first of
these", would be a small change to the type and a larger one to what a host can
show.

## Who decides how a graph is drawn

The drawing in `src/tree.ts` reads this format's structural graph: containment
as the shape, everything a section states underneath it. It is a reading aid,
and `tree.txt` in each example is documentation of that example rather than
output of the format.

That distinction matters more than it looks. A format that emits a drawing has
chosen a rendering on the reader's behalf. Choosing one belongs to whoever is
reading, which in `view` means a view selected for a shape, and in a document
means transcluding the one you want. So the drawing belongs on that side of the
line, and the general part of it, given a graph, a containment predicate and a
set of predicates that are shape rather than fact, would move there whole.

It stays here while this is the only thing that reads it. Splitting a hundred
lines across two repositories before a second reader exists costs more than it
returns.

## Two parsers for one input

`view-markdown` renders Obsidian-flavoured markdown with markdown-it. It
produces no triples: `quad`, `triple`, `subject:` and `predicate:` do not appear
in it. So there is no duplicated extraction today, and the two compose, one
showing a document and the other supplying its graph.

What is duplicated is the parse. Two markdown parsers over the same input will
disagree at the edges, at indented code, setext headings, nested quotes, which
are the cases a hand-written scanner also loses. The disagreement becomes
visible rather than theoretical because this format emits `oa:TextQuoteSelector`
with slices of the source: anything that highlights a section in a renderer is
pointing at offsets the other parser computed differently.

Sharing one parse is the fix. Where that belongs is a question for `view`.

## A scheme for wiki links

A wiki target is a name, and today the naming resolves it in one of two ways:
a target that already carries a scheme passes through as an IRI, and any other
target becomes a document under the naming's base, `doc(name)`, with a heading
as its fragment. The second rule assumes one collection, the one the base
names, and it is the right assumption for a vault.

It stops being enough when the same spelling means different things in
different collections. `[[decision/store-is-the-truth]]` in a spalier project
names a record the spalier harness resolves; `[[Neil Armstrong]]` in an
Obsidian vault names a note the vault resolves; `[[Apollo 11]]` in a wiki
export names a page. The name is the same shape in all three, and the thing
that differs, which resolver owns it, is nowhere in the document.

The proposal is to make that explicit: a collection declares the scheme its
wiki links belong to, as RDF, in the frontmatter of a document or in the
producer's profile, and `[[name]]` then reads as `[name](<scheme>:name)`. The
structural graph keeps emitting one IRI per link, with the declared scheme
instead of the base, and a producer registers a resolver per scheme that turns
such an IRI into whatever dereferences it: a file in a vault, a record in a
project graph, a page on a wiki. Today's behaviour is the case where the
scheme is "a document under the base", and stays the default.

Open: where the declaration lives, a frontmatter key beside `@id` or a profile
option beside `wikiLinks`; whether the structural graph should also keep the
raw name, so a mapping can re-resolve a link under a different scheme; and
whether a resolver belongs to this package or to `view`, which already selects
by resource.
