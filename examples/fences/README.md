# Fences

The carriers a document has are deliberately narrow: a statement attaches to the
section it sits in, and there is no way to set a subject inside a sentence. When
that is not enough, the answer is not a richer syntax. It is RDF, which already
has one.

A fenced code block whose language is an RDF syntax is parsed and kept, and its
triples land in a named graph whose name is the block's own IRI. Provenance
therefore costs nothing: the graph name already carries the block's source, its
selectors and its language.

## A block of its own

Relative references resolve against the document, so a fragment written here
lands beside the sections of this same file.

```turtle
@prefix schema: <https://schema.org/> .

<#armstrong> a schema:Person ; schema:name "Neil Armstrong" .
<#aldrin>    a schema:Person ; schema:name "Buzz Aldrin" .
```

## A base of its own

The info string after the language takes `base=` to resolve against something
else, and `graph=` to collect several blocks into one graph.

```turtle base=https://example.org/people/
<armstrong> <https://schema.org/nationality> "US" .
```

## What this buys and what it costs

A block states real IRIs directly, so it skips the deferral that every other
carrier goes through. That is why it lives in its own graph: a mapping reaches
it through `GRAPH` and does so on purpose, and nothing in it can be mistaken for
a statement the structure made.

reach :: through a GRAPH clause
