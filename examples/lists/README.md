# Lists

A list whose lines are not all statement lines becomes a `doco:List`, and every
entry becomes an item: an addressable slice carrying its position, the text of
its first paragraph as its label, and whatever that entry states about itself.

## Steps

- Read the file
- Parse it with CommonMark
  - Sections are derived from the heading depths
    - A jump of more than one level is reported and still nests
- Read the graph out of the tree

An item holds the blocks below its first paragraph the way a section holds the
blocks below its heading, so the nested list above is contained by the item it
sits under rather than by this section.

## Packing

- [x] Passport
- [ ] Tickets
- [ ] An [adapter](<> "spare") for the other plug

A checkbox is GFM, so the state of the box is structure and
`marginalia:checked` carries it. What a tick means is left to a mapping. The
gloss in the third entry states its fact about the item, because inside an item
the item is the subject.

## Work

- Borrow the parser

  owner :: [[people/toph]]
  due :: 2026-10-02

- Write the mapping

A statement line in an item's continuation is about the item, so a list of work
items reads without a heading for each one.

## Order

1. Structure
2. Meaning

Ordered or bullet, tight or loose, and the marker character are not carried.
`schema:position` carries the order, which is the part of a list's shape a
consumer has asked for.
