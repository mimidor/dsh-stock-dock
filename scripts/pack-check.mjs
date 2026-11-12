/**
 * Packaging check: what `npm pack` would publish.
 *
 * The bundle is installed by linking the directory into a profile, so a missing
 * file is not caught by a build step — it shows up as a plugin that loads but
 * cannot find `lib/routes.js`. This keeps the published file list honest.
 */

import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

const REQUIRED = [
  'package.json',
  'index.js',
  'client.js',
  'cordis.patch.yml',
  'icon.svg',
  'README.md',
  'README.en.md',
  'LICENSE',
  'locale/zh.json',
  'locale/en.json',
  'lib/config.js',
  'lib/routes.js',
  'lib/store.js',
  'lib/tool.js',
  'lib/trades.js',
  'lib/events.js',
  'lib/providers/index.js',
  'lib/providers/tencent.js',
  'lib/providers/sina.js',
  'lib/providers/eastmoney.js',
]

const FORBIDDEN_PREFIXES = ['tests/', 'docs/', 'node_modules/', '.github/']

const raw = execFileSync('npm', ['pack', '--dry-run', '--json'], { encoding: 'utf8' })
const [pack] = JSON.parse(raw)
const files = new Set(pack.files.map((file) => file.path))

const missing = REQUIRED.filter((file) => !files.has(file))
const leaked = [...files].filter((file) => FORBIDDEN_PREFIXES.some((prefix) => file.startsWith(prefix)))
const packageJson = JSON.parse(readFileSync('package.json', 'utf8'))
const tooBig = pack.size > 400 * 1024

console.log(`pack: ${files.size} files, ${(pack.unpackedSize / 1024).toFixed(1)} KiB unpacked`)
for (const file of files) console.log(`  ${file}`)

let failed = false
if (missing.length > 0) {
  failed = true
  console.error(`missing from the package: ${missing.join(', ')}`)
}
if (leaked.length > 0) {
  failed = true
  console.error(`dev-only files leaked into the package: ${leaked.join(', ')}`)
}
if (tooBig) {
  failed = true
  console.error(`package is larger than 400 KiB: ${(pack.size / 1024).toFixed(1)} KiB`)
}
if (packageJson.private !== true) {
  failed = true
  console.error('this bundle is installed by path; package.json must stay private')
}

if (failed) process.exit(1)
console.log('pack: ok')
