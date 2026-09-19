---
"@context":
  schema: https://schema.org/
  wf: http://www.w3.org/2005/01/wf/flow#
  minutes: https://aleph.garden/ns/minutes#
"@type": schema:Event
schema:startDate: 2026-09-25T10:00:00Z
---
# Planning, weekly

Two shipped readings of one note. The frontmatter types the document
`schema:Event`, so `mappings/meeting.rq` reads minutes out of it, with the
decisions from the section typed `minutes:Decisions`. The action items and the
open items each type their own section `wf:Tracker`, so `mappings/todo.rq`
reads a task list out of those sections and nothing else. Both rules see the
same structural graph, and `map examples/mixed/README.md mappings/*.rq` runs
them together.

## Attending

attendee :: [[people/toph]]
attendee :: [[people/cristian]]

Notes were taken by [Toph](<> "scribe").

## Decisions

@type :: minutes:Decisions

- ship one rule per kind of document
- key a rule on the type, never on a heading

## Action items

@type :: wf:Tracker

- Write the task reading
  - [x] Read the Flow ontology
  - [ ] Check what nesting means
- Send the minutes round

The type on a section keeps the two apart. The task list is `po:contains`
away from the section that carries `wf:Tracker`, and the decisions are the list
`po:contains` away from the section that carries `minutes:Decisions`, so no
decision comes out of the action items and no task comes out of the decisions.

## Open

@type :: wf:Tracker

- whether a rule may follow an `@subject` redirect

  owner :: [[people/cristian]]
  due :: 2026-10-09

> A rule that follows the redirect reads the thing the section names. A rule
> that stays put reads the section.
