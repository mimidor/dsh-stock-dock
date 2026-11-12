/**
 * Documentation drift check: the Chinese and English READMEs must keep the same
 * section outline and document the same routes.
 *
 * Translated headings cannot be compared word for word, but a missing section or
 * a route that exists in one file and not the other is exactly the drift this
 * catches.
 */

import { readFileSync } from 'node:fs'

const zh = readFileSync('README.md', 'utf8')
const en = readFileSync('README.en.md', 'utf8')

const headings = (text) => [...text.matchAll(/^##\s+(.+)$/gm)].map((match) => match[1].trim())
const routes = (text) =>
  [...text.matchAll(/^(GET|POST)\s+(\/dsh-stock-(?:ticker|dock)\S*)/gm)].map((match) => `${match[1]} ${match[2]}`).sort()

const zhHeadings = headings(zh)
const enHeadings = headings(en)
const zhRoutes = [...new Set(routes(zh))]
const enRoutes = [...new Set(routes(en))]

const problems = []
if (zhHeadings.length !== enHeadings.length) {
  problems.push(`heading count differs: zh=${zhHeadings.length} en=${enHeadings.length}`)
}
for (const required of [/功能|Features/, /安装|Install/, /配置|Configuration/, /自测|Tests/, /已知限制|Known limitations/, /许可|License/]) {
  if (!zhHeadings.some((heading) => required.test(heading))) problems.push(`README.md is missing a section matching ${required}`)
  if (!enHeadings.some((heading) => required.test(heading))) problems.push(`README.en.md is missing a section matching ${required}`)
}
const missingInEn = zhRoutes.filter((route) => !enRoutes.includes(route))
const missingInZh = enRoutes.filter((route) => !zhRoutes.includes(route))
if (missingInEn.length > 0) problems.push(`routes only in README.md: ${missingInEn.join(', ')}`)
if (missingInZh.length > 0) problems.push(`routes only in README.en.md: ${missingInZh.join(', ')}`)
if (!zh.includes('README.en.md')) problems.push('README.md does not link the English file')
if (!en.includes('README.md')) problems.push('README.en.md does not link the Chinese file')

if (problems.length > 0) {
  for (const problem of problems) console.error(`readme: ${problem}`)
  process.exit(1)
}
console.log(`readme: ${zhHeadings.length} sections and ${zhRoutes.length} routes in sync`)
