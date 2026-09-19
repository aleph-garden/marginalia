---
"@context":
  schema: https://schema.org/
  wd: https://www.wikidata.org/entity/
---
# Two astronauts

Each section below is a slice of this file, and each says which person its
statements are about. `@subject` is the line that says so, and the section keeps
everything else: this paragraph is a part of the section it sits in, and a plain
link such as [the Apollo note](apollo.md) is a reference the section makes.

## Neil Armstrong

@subject :: wd:Q1615
@type :: schema:Person
born :: 1930-08-05

Scope starts at the line, which is why `@subject` is written first: the two
statements above it in the same block land on the Wikidata entity, and so does
the gloss in this sentence, which says he commanded
[Apollo 11](<> "commanded"). Compare `tree.ttl`, where the slices sit on
`#neil-armstrong` and the facts sit on `wd:Q1615`.

### Gemini 8

role :: command pilot

A nested section inherits the redirect, the way RDFa's `about` is inherited by
the descendants of the element that carries it. The role above is his, and the
heading still opens a section of this document.

## Buzz Aldrin

@subject :: wd:Q2252
@type :: schema:Person
role :: lunar module pilot

A second section names a second subject. A redirect reaches the sections under
the one that set it, so nothing here comes from the section above.

## About this note

status :: draft

This section sets no `@subject`, so `status` is a fact about the section, which
is where every statement lands in a document that uses neither reserved key.
