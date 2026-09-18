# Vocabularies

The claim this format makes is that one set of notes can serve several target
vocabularies, because the author writes plain names and a mapping decides what
they mean. This directory is that claim, run twice.

Below is a note of the kind anyone keeps. Nothing in it names a vocabulary.
Beside it are two rule files, `skos.rq` and `schema-org.rq`, and two graphs.
Neither required a word of the note to change.

broader :: [[semantic-web]]
related :: [[solid]]
alias :: Aleph
started :: 2023-04-01

> A personal semantic web platform: your data as RDF in a store you own,
> rendered through Fresnel-style lenses.

## Why the names stay plain

`broader` is a word, not a term. It carries whatever the author meant by it,
which on one reading is a concept scheme and on another is a topic. Writing
`skos:broader` here would settle that reading in every file, and a later change
of mind would be a corpus-wide edit rather than a new rule file.

That is the whole trade. Where the author does have a vocabulary in mind, the
frontmatter example shows the other half: a qualified name is used as written
and there is nothing left to decide.

## What the two mappings differ on

The SKOS reading makes this a concept in a scheme, so `broader` becomes
`skos:broader` and the prose becomes a scope note.

The schema.org reading makes it a creative work, so the same `broader` becomes
`schema:isPartOf`, the alias becomes an alternate name, and the date becomes a
start date. The two graphs share no predicate.
