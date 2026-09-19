---
"@context":
  schema: https://schema.org/
  wf: http://www.w3.org/2005/01/wf/flow#
  minutes: https://aleph.garden/ns/minutes#
"@type": schema:Event
schema:startDate: 2026-09-18T15:00:00Z
---
# Format work item, weekly

The work item that started this format asked for a replacement for a shared
scratchpad in meetings. These are notes anyone would write in one, and the graph
beside them was read out without anyone annotating a thing.

## Attending

Notes were taken by [Toph](<> "scribe"), who also chaired.

attendee :: [[people/toph]]
attendee :: [[people/cristian]]
attendee :: [[people/jesse]]
apologies :: [[people/ruben]]

## Decisions

@type :: minutes:Decisions

The parser stays borrowed rather than written, since the cases a hand-written
scanner loses are exactly the ones a document hits by accident. Nobody objected.

- borrow the parser
- one added production, and only one

The second is the harder promise, and it holds so far: statement lines are the
only syntax that is not CommonMark.

## Open

@type :: wf:Tracker

Whether wiki links belong in the core or in a profile stayed open, because the
answer turns on whether a producer can be assumed to have an index.

- wiki links, core or profile

  owner :: [[people/toph]]
  due :: 2026-10-02

> A resolver has to exist somewhere. The question is whether the format may
> assume it.

## Next

A working thing to try, rather than a document to agree with. See
[the issue](https://github.com/w3c-cg/solid/issues/69 "discussedIn") for where
this goes back to.
