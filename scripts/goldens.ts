#!/usr/bin/env bun
import { existsSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { applyMapping, structure, tree, write } from '../src/index.ts'

/**
 * Rewrite every example's golden files from its README.
 *
 * A structural graph is written as Turtle where it has no named graphs and as
 * TriG where it does, because GitHub highlights the one and not the other and
 * an example is read more often than it is parsed.
 */
const EXAMPLES = join(import.meta.dir, '..', 'examples')
const MAPPINGS = join(import.meta.dir, '..', 'mappings')
const shipped = readdirSync(MAPPINGS).filter((file) => file.endsWith('.rq'))

for (const name of readdirSync(EXAMPLES, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)) {
  const dir = join(EXAMPLES, name)
  const { quads, diagnostics } = structure(readFileSync(join(dir, 'README.md'), 'utf8'), { name })

  const named = quads.some((q) => q.graph.value !== '')
  const graphFile = named ? 'tree.trig' : 'tree.ttl'
  for (const stale of ['tree.ttl', 'tree.trig'])
    if (stale !== graphFile && existsSync(join(dir, stale))) rmSync(join(dir, stale))
  writeFileSync(join(dir, graphFile), write(quads))

  // What a person reads. The Turtle beside it is what the tests check.
  writeFileSync(join(dir, 'tree.txt'), `${tree(quads)}\n`)

  const local = readdirSync(dir).filter((file) => file.endsWith('.rq'))
  for (const rule of local) {
    const meaning = applyMapping(quads, [readFileSync(join(dir, rule), 'utf8')])
    writeFileSync(join(dir, rule.replace(/\.rq$/, '.ttl')), write(meaning))
  }

  // Every shipped rule is run against every example as well. A local rule of
  // the same name owns the golden, and a rule the example declares no type for
  // reads nothing and leaves no file behind.
  let goldens = local.length
  for (const rule of shipped.filter((file) => !local.includes(file))) {
    const golden = join(dir, rule.replace(/\.rq$/, '.ttl'))
    const meaning = applyMapping(quads, [readFileSync(join(MAPPINGS, rule), 'utf8')])
    if (meaning.length) {
      writeFileSync(golden, write(meaning))
      goldens++
    } else if (existsSync(golden)) rmSync(golden)
  }

  const counts = `${quads.length} triples, ${goldens} mapping${goldens === 1 ? '' : 's'}`
  const noise = diagnostics.length ? `, ${diagnostics.length} diagnostics` : ''
  console.log(`${name.padEnd(18)} ${graphFile.padEnd(10)} ${counts}${noise}`)
  for (const d of diagnostics) console.log(`${' '.repeat(18)} ${d.code}: ${d.message}`)
}
