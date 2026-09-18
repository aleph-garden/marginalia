# Sections

CommonMark has no sections. Its tree has headings as siblings of the blocks that
follow them, so the nesting every reader takes for granted is derived, not
parsed. This example shows the derivation and what a mapping can do with it.

owner :: [[toph|Toph]]

## Rules

A heading of depth *n* opens a section contained by the nearest open section of
lesser depth. The same rule is written down in HTML as the document outline, and
implemented by `pandoc --section-divs` and `remark-sectionize`.

rule :: nearest-lesser-depth

#### Skipping a level

The heading above this paragraph is depth 4 under depth 2. HTML calls such a jump non-conforming while still defining
the result. This format follows: the section below is reported as a diagnostic
and nests under the nearest lesser depth anyway.

note :: a producer reports it, a consumer keeps working

## Depth is not the tree

Because a document may skip a level, `depth = 1` is not the same question as
"has no section above it". A mapping that wants top-level sections should ask
the containment, which `mapping.rq` does.

caveat :: ask containment, not depth
