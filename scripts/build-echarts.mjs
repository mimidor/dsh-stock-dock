/**
 * Build the lazy ECharts chunk. The client entry stays a hand-written factory;
 * this chunk is self-contained and loaded only when the detail K-line opens.
 */
import { build } from 'esbuild'
import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const result = await build({
  entryPoints: [join(root, 'scripts', 'echarts-entry.js')],
  bundle: true,
  format: 'iife',
  globalName: 'echarts',
  platform: 'browser',
  target: 'es2020',
  minify: true,
  write: false,
})
const code = result.outputFiles[0].text
const chunk = `window.__ModuleLoader__.load({
  id: '@local/dsh-stock-ticker',
  chunk: 'client.echarts.js',
  factory() {
${code}
    return echarts
  },
})
`
writeFileSync(join(root, 'client.echarts.js'), chunk)
console.log(`build:echarts wrote ${chunk.length.toLocaleString()} bytes`)
