---
"@context":
  schema: https://schema.org/
  ex: https://example.org/
"@id": https://example.org/docs/frontmatter
"@type": schema:TechArticle
schema:name: Naming things in frontmatter
schema:inLanguage: en
ex:reviewed: false
status: draft
---
# Naming things in frontmatter

This directory has no mapping rules, and that is what it shows. Every name in
the frontmatter above is already qualified, so it needs nothing decided later:
the document is its own graph. Compare `tree.ttl` with the block above and the
correspondence is one to one.

## What each key does

`@context` declares prefixes, in the YAML-LD shape. `@id` gives the document its
own IRI, so the sections below are fragments of it rather than of a placeholder.
`@type` says what the document is, and nothing more: which rules read a document
of that type is a question for whoever holds the rules.

Everything else is a statement about the document. A qualified name is used as
written, and a bare one is deferred, which is why `status` above is the only key
that arrives as `urn:token:status`.

## The same rule in the body

schema:dateModified :: 2026-09-18
ex:section :: naming
audience :: whoever is weighing this format

The first two name their vocabulary and the third does not, so the third is the
only one a mapping would still have something to say about.

## What this document is about

schema:about :: https://www.w3.org/TR/json-ld11/

A note about a specification is not that specification, so what a document is
called and what it is about stay two separate things. The first needs `@id`; the
second is an ordinary statement, because RDF has had a word for it for twenty
years.
