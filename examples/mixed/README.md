---
"@context":
  schema: https://schema.org/
  wf: http://www.w3.org/2005/01/wf/flow#
"@type": schema:Event
schema:startDate: 2026-09-25T10:00:00Z
---
# Planning, weekly

Two shipped readings of one note. The frontmatter types the document
`schema:Event`, so `mappings/meeting.rq` reads minutes out of it. The action
items below type their own section `wf:Tracker`, so `mappings/todo.rq` reads a
task list out of that section and nothing else. Both rules see the same
structural graph, and `map examples/mixed/README.md mappings/*.rq` runs them together.

## Attending

attendee :: [[people/toph]]
attendee :: [[people/cristian]]

Notes were taken by [Toph](<> "scribe").

## Decisions

- ship one rule per kind of document
- key a rule on the type, never on a heading

## Action items

@type :: wf:Tracker

- Write the task reading
  - [x] Read the Flow ontology
  - [ ] Check what nesting means
- Send the minutes round

The type on a section keeps the two apart. The task list is `po:contains`
away from the section that carries `wf:Tracker`, and the minutes stop at a
section that declares a type of its own, so no decision comes out of the action
items and no task comes out of the decisions.

## Open

open :: whether a rule may follow an `@subject` redirect
owner :: [[people/cristian]]
due :: 2026-10-09

> A rule that follows the redirect reads the thing the section names. A rule
> that stays put reads the section.
