#!/usr/bin/env bun
import { readFileSync } from 'node:fs'
import { applyMapping } from './map.ts'
import { write } from './serialize.ts'
import { structure } from './structure.ts'
import { naming } from './terms.ts'
import { tree } from './tree.ts'

const usage = `marginalia: deferred semantics for CommonMark

  marginalia structure <file.md> [--base <iri>] [--name <name>]
      the document as a structural RDF graph

  marginalia map <file.md> <rule.rq...> [--base <iri>] [--name <name>]
      that graph after the mapping rules have given it meaning

  marginalia tree <file.md> [--base <iri>] [--name <name>]
      the same graph drawn as the tree it already is

Diagnostics go to stderr, the graph to stdout.`

const argv = process.argv.slice(2)
const flag = (name: string) => {
  const i = argv.indexOf(`--${name}`)
  return i === -1 ? undefined : argv.splice(i, 2)[1]
}
const base = flag('base')
const name = flag('name')
const [command, path, ...rules] = argv.filter((a) => !a.startsWith('--'))

if (!command || !path || !['structure', 'map', 'tree'].includes(command)) {
  console.error(usage)
  process.exit(1)
}

const result = structure(readFileSync(path, 'utf8'), { path, name, naming: naming(base) })
for (const d of result.diagnostics)
  console.error(`${path}:${d.line ?? '-'}: ${d.code}: ${d.message}`)

if (command === 'tree') {
  process.stdout.write(`${tree(result.quads)}\n`)
} else if (command === 'structure') {
  process.stdout.write(write(result.quads))
} else {
  if (rules.length === 0) {
    console.error('marginalia map needs at least one .rq rule file')
    process.exit(1)
  }
  const meaning = applyMapping(
    result.quads,
    rules.map((r) => readFileSync(r, 'utf8'))
  )
  process.stdout.write(write(meaning))
}
