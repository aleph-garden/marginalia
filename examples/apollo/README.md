---
aliases: ["Apollo programme"]
---
# Apollo 11

The first crewed landing on the Moon. This file is both the example and its own
explanation: everything below is ordinary CommonMark, and the graph beside it in
`tree.ttl` is what the format reads out of it.

broader :: [[space-missions|Space missions]]
focus :: https://www.wikidata.org/entity/Q43653

Three carriers are at work here. A **statement line** like the two above states
a fact about the section it sits in. A **gloss** marks a span of running prose:
commanded by [Neil Armstrong], launched in [1969], run by [NASA]. And the
**structure** carries the rest, so this paragraph, the quotation and the code
block below all arrive as addressable slices without anyone annotating them.

## Landing

A gloss can also be written inline, which is the same rule with the annotation
in the sentence instead of at the foot of the file: the module
[Eagle](<> "moduleName") touched down at the
[Sea of Tranquility](tranquility.md "site").

> That's one small step for a man, one giant leap for mankind.

```python
print("contact light")
```

[Neil Armstrong]: <> "commander"
[1969]: <> "year"
[NASA]: https://nasa.gov "organizer"
