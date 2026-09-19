---
"@context":
  wf: http://www.w3.org/2005/01/wf/flow#
"@type": wf:Tracker
---
# Breakfast

- Make Breakfast
    - [x] Cook eggs
    - [ ] Toast bread

That list is the one from the discussion of a common markdown-to-RDF syntax,
[w3c-cg/solid#69](https://github.com/w3c-cg/solid/issues/69), where it is
written out by hand as three tasks in the Flow ontology. Here it is three
ordinary list entries, and `mappings/todo.rq` reads the same graph out of them
because the frontmatter says the document is a `wf:Tracker`.

Flow defines `wf:Task` as the disjoint union of `wf:Open` and `wf:Closed`, which
is what a GFM box carries: a ticked entry is closed, and an entry with no box at
all is open. `wf:goalDescription` takes the entry's label, and `wf:dependent`
follows the nesting, so the outer entry waits on the two under it.

An entry is already an identified slice of this file, so a task needs no
identifier of its own and the rule mints none. The hand-written graph in the
issue also carries `task:stateStore`, which says where the tracker's state is
kept; a markdown file says nothing about that, so this reading leaves it out.
