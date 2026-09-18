import type { Root } from 'mdast'
import remarkFrontmatter from 'remark-frontmatter'
import remarkGfm from 'remark-gfm'
import remarkParse from 'remark-parse'
import { unified } from 'unified'

const processor = unified().use(remarkParse).use(remarkFrontmatter, ['yaml']).use(remarkGfm)

/**
 * CommonMark, plus YAML frontmatter and GFM. This module owns no grammar of
 * its own: what a heading, a blockquote or a code block is stays the parser's
 * answer, and the format only says what a *sequence* of them means.
 */
export function parse(markdown: string): Root {
  return processor.parse(markdown) as Root
}
