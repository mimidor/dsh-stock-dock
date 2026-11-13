/**
 * Static previews and screenshots.
 *
 * The dock, the detail panel and the settings card are rendered with the same
 * miniature React the tests use, serialized to standalone HTML and (when Chrome
 * is available) captured to PNG. This is what keeps `README.md` honest: the
 * screenshots come from the real components and the real stylesheet, with canned
 * data, not from a mock-up.
 *
 * Usage: node scripts/preview.mjs [--no-shot]
 */

import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { click, createHarness, findAll, textOf } from '../tests/helpers/render-harness.mjs'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const outDir = join(root, 'docs', 'preview')
const shotDir = join(root, 'docs', 'screenshots')
const noShot = process.argv.includes('--no-shot')
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'

const CSS = (() => {
  const source = readFileSync(join(root, 'client.js'), 'utf8')
  const match = /const CSS = `([\s\S]*?)`/.exec(source)
  if (!match) throw new Error('client.js does not expose its stylesheet')
  return match[1]
})()

/** DSH theme variables the stylesheet depends on, approximated for standalone pages. */
const THEME = {
  light: `
    --dsw-alias-bg-base: #ffffff;
    --dsw-alias-bg-layer-1: #ffffff;
    --dsw-alias-bg-layer-2: #f2f3f5;
    --dsw-alias-label-primary: #1f2329;
    --dsw-alias-label-secondary: #646a73;
    --dsw-alias-border-l1: #e5e6eb;
    --dsw-alias-border-l2: #d0d3d9;
    --dsw-alias-brand-primary: #6f5bd6;
    --dsw-alias-interactive-bg-hover: #f2f3f5;
    --dsw-alias-state-error-primary: #e5484d;
    --dsw-alias-state-success-primary: #2f9e63;
    --dsw-alias-state-warn-primary: #d9822b;
  `,
  dark: `
    --dsw-alias-bg-base: #17181b;
    --dsw-alias-bg-layer-1: #1f2024;
    --dsw-alias-bg-layer-2: #26272c;
    --dsw-alias-label-primary: #eceff3;
    --dsw-alias-label-secondary: #9aa1ad;
    --dsw-alias-border-l1: #303237;
    --dsw-alias-border-l2: #3d4046;
    --dsw-alias-brand-primary: #a99bff;
    --dsw-alias-interactive-bg-hover: #2a2c31;
    --dsw-alias-state-error-primary: #ff6b6b;
    --dsw-alias-state-success-primary: #4fbf7f;
    --dsw-alias-state-warn-primary: #e0a15a;
  `,
}

const ESCAPE = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }
const escape = (value) => String(value).replace(/[&<>"]/g, (character) => ESCAPE[character])
const kebab = (key) => key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)
const VOID_TAGS = new Set(['input', 'line', 'path', 'circle', 'rect', 'polyline', 'br', 'hr', 'img', 'stop'])
const SKIP_PROPS = new Set([
  'children',
  'key',
  'ref',
  'onClick',
  'onChange',
  'onKeyDown',
  'onMouseMove',
  'onMouseLeave',
  'onWheel',
  'onPointerDown',
  'onPointerMove',
  'onPointerUp',
  'onPointerLeave',
  'onDragStart',
  'onDragOver',
  'onDrop',
  'onBlur',
  'onFocus',
  'spellCheck',
  'draggable',
])

/** SVG attributes React spells camelCase that must keep it. */
const SVG_CAMEL = new Set(['viewBox', 'preserveAspectRatio', 'gradientUnits', 'gradientTransform', 'patternUnits'])

function serialize(node) {
  if (node === null || node === undefined || node === false || node === true) return ''
  if (Array.isArray(node)) return node.map(serialize).join('')
  if (typeof node === 'string' || typeof node === 'number') return escape(node)
  const { tag, props = {}, children } = node
  const attributes = []
  for (const [key, value] of Object.entries(props)) {
    if (SKIP_PROPS.has(key) || value === undefined || value === null || typeof value === 'function') continue
    if (key === 'className') {
      attributes.push(`class="${escape(value)}"`)
      continue
    }
    if (key === 'style' && typeof value === 'object') {
      const css = Object.entries(value)
        .map(([name, entry]) => `${kebab(name)}:${entry}`)
        .join(';')
      attributes.push(`style="${escape(css)}"`)
      continue
    }
    if (key === 'defaultValue') {
      attributes.push(`value="${escape(String(value))}"`)
      continue
    }
    if (key === 'tabIndex') {
      attributes.push(`tabindex="${escape(value)}"`)
      continue
    }
    attributes.push(`${SVG_CAMEL.has(key) ? key : kebab(key)}="${escape(String(value))}"`)
  }
  const open = `<${tag}${attributes.length > 0 ? ` ${attributes.join(' ')}` : ''}`
  // Self-closing syntax matters inside <svg>: an unclosed <line> swallows the
  // following shapes and nothing renders.
  if (VOID_TAGS.has(tag) && (children === undefined || children === null)) return `${open} />`
  return `${open}>${serialize(children)}</${tag}>`
}

function page(body, { dark = false, width = 880, extraCss = '' } = {}) {
  return `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8">
<title>dsh-stock-dock preview</title>
<style>
  :root { ${THEME.light} }
  body[data-ds-dark-theme] { ${THEME.dark} }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body {
    background: var(--dsw-alias-bg-base);
    color: var(--dsw-alias-label-primary);
    font: 13px/1.45 -apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", sans-serif;
    padding: 18px;
  }
  .preview { width: ${width}px; margin: 0 auto; padding: 14px 16px; border: 1px solid var(--dsw-alias-border-l1); border-radius: 14px; background: var(--dsw-alias-bg-base); }
${CSS}
/* A screenshot is the steady state; flashes and entrance animations are transient. */
.dshst-quote::before { animation: none !important; opacity: 0 !important; }
.dshst-chart, .dshst-miniLine, .dshst-readout, .dshst-detail, .dshst-toast, .dshst-form, .dshst-settings {
  animation: none !important;
}
${extraCss}
</style></head>
<body${dark ? ' data-ds-dark-theme' : ''}><main class="preview">${body}</main></body></html>`
}

/* ------------------------------------------------------------------ data */

function candles(count) {
  return Array.from({ length: count }, (_, index) => {
    const close = 1380 + index * 3 + Math.sin(index / 3) * 12
    const open = close - (index % 2 === 0 ? 5 : -4)
    return {
      date: `2026-10-${String((index % 28) + 1).padStart(2, '0')}`,
      open,
      close,
      high: Math.max(open, close) + 6,
      low: Math.min(open, close) - 6,
      volume: 20000 + index * 120,
    }
  })
}

function points(days = 1) {
  const out = []
  for (let day = 0; day < days; day += 1) {
    for (let minute = 0; minute < 240; minute += 1) {
      const price = 1400 + Math.sin(minute / 18) * 9 + day
      out.push({
        time: `${String(9 + Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`,
        day: `2026111${day}`,
        price,
        avg: price - 1.2,
        volume: 900 + minute * 3,
      })
    }
  }
  return out
}

const quote = (overrides = {}) => ({
  symbol: 'sh600519',
  market: 'cn',
  source: 'tencent',
  name: '贵州茅台',
  code: '600519',
  price: 1410.27,
  prevClose: 1402.3,
  open: 1395.13,
  high: 1411,
  low: 1388.11,
  change: 7.97,
  changePct: 0.57,
  volume: 32373,
  amount: 4536814518,
  time: '20261112161452',
  extras: { turnover: 0.26, pe: 21.46, amplitude: 1.63, totalCap: 17629.53, pb: 6.5, limitUp: 1542.53, limitDown: 1262.07, volumeRatio: 0.91 },
  depth: {
    bids: [1410.27, 1410.22, 1410.21, 1410.19, 1410.0].map((price, index) => ({ price, volume: [17, 1, 4, 4, 1][index] })),
    asks: [1410.43, 1410.45, 1410.46, 1410.5, 1410.55].map((price, index) => ({ price, volume: [2, 1, 1, 5, 1][index] })),
    ratio: 52.3,
  },
  alerts: [{ id: 'a1', op: 'above', price: 1500, firedAt: null }],
  holding: { shares: 100, cost: 1300 },
  trade: { shares: 100, cost: 1300, realized: 1200, fees: 20 },
  ...overrides,
})

function quotesPayload() {
  return {
    ok: true,
    updatedAt: Date.now(),
    source: 'tencent',
    sources: { tencent: 'ok', sina: 'unknown', eastmoney: 'unknown', eastmoneyHistory: 'down' },
    session: { mode: 'trading', label: 'A股盘中', intervalMs: 15000, markets: { cn: 'trading' }, weekend: false, holiday: false },
    settings: {
      refreshSeconds: 15,
      klineDays: 40,
      colorMode: 'cn',
      showMA: true,
      showVolume: true,
      defaultPeriod: 'trend',
      defaultTrendDays: 1,
      adjust: 'qfq',
      alertToast: true,
      sourceDot: true,
      showMiniChart: true,
      showOrderBook: true,
      showStats: true,
      showExtended: true,
      source: 'auto',
      symbols: ['sh000001', 'sh600519', 'sz300750', 'hk00700', 'usAAPL'],
    },
    groups: [
      { id: 'default', name: '自选', count: 5 },
      { id: 'market', name: '大盘', count: 6 },
    ],
    activeGroup: 'default',
    symbols: ['sh000001', 'sh600519', 'sz300750', 'hk00700', 'usAAPL'],
    quotes: [
      quote({ symbol: 'sh000001', name: '上证指数', code: '000001', price: 3655.83, prevClose: 3680.64, change: -24.81, changePct: -0.67, extras: { totalCap: null }, depth: undefined, alerts: [], holding: null, trade: null }),
      quote(),
      quote({ symbol: 'sz300750', name: '宁德时代', code: '300750', price: 402.18, prevClose: 396.5, change: 5.68, changePct: 1.43, holding: null, trade: null, alerts: [] }),
      quote({ symbol: 'hk00700', market: 'hk', name: '腾讯控股', code: '00700', price: 398.8, prevClose: 409.6, change: -10.8, changePct: -2.64, extras: { turnover: 0.28, pe: 13.59, amplitude: 2.44, totalCap: 36261.47, pb: 1.33, limitUp: null, limitDown: null }, depth: undefined, alerts: [], holding: null, trade: null }),
      quote({
      symbol: 'usAAPL',
      market: 'us',
      name: '苹果',
      code: 'AAPL.OQ',
      price: 355.63,
      prevClose: 348.51,
      change: 7.12,
      changePct: 2.04,
      extras: undefined,
      depth: undefined,
      alerts: [],
      holding: null,
      trade: null,
      extended: { price: 356.71, change: 1.35, changePct: 0.38, time: 'Nov 12 08:43AM EST', session: 'pre' },
    }),
    ],
    fired: [],
  }
}

const settingsPayload = () => ({
  ok: true,
  settings: quotesPayload().settings,
  prefs: {
    showMA: true,
    showVolume: true,
    showMiniChart: true,
    showOrderBook: true,
    showStats: true,
    showExtended: true,
    source: 'auto',
    defaultPeriod: 'trend',
    defaultTrendDays: 1,
    adjust: 'qfq',
    alertToast: true,
    sourceDot: true,
  },
  groups: [
    { id: 'default', name: '自选', symbols: ['sh000519'] },
    { id: 'market', name: '大盘', preset: true, symbols: ['sh000001', 'sz399001', 'sz399006', 'sh000688', 'hkHSI', 'usIXIC'] },
  ],
  activeGroup: 'default',
})

function makeFetch() {
  return async (rawUrl) => {
    const path = String(rawUrl).replace('/dsh-stock-ticker', '')
    const respond = (payload) => new Response(JSON.stringify(payload), { status: 200, headers: { 'content-type': 'application/json' } })
    if (path.startsWith('/sparklines')) {
      const rows = {}
      for (const symbol of ['sh000001', 'sh600519', 'sz300750', 'hk00700', 'usAAPL']) rows[symbol] = candles(40)
      return respond({ ok: true, days: 40, etag: '"preview"', rows })
    }
    if (path.startsWith('/quotes')) return respond(quotesPayload())
    if (path.startsWith('/settings')) return respond(settingsPayload())
    if (path.startsWith('/kline')) return respond({ ok: true, rows: candles(40), source: 'tencent' })
    if (path.startsWith('/trend')) {
      const trendPoints = points(1)
      const baseline = trendPoints.map((point, index) => ({ time: point.time, volume: (point.volume ?? 0) * Math.max(0.1, 0.75 + 0.5 * Math.sin(index / 11)) }))
      return respond({ ok: true, prevClose: 1402.3, days: ['20261112'], points: trendPoints, baseline, baselineDays: 1 })
    }
    if (path.startsWith('/trades')) {
      return respond({
        ok: true,
        symbol: 'sh600519',
        count: 2,
        trades: [
          { id: 't1', symbol: 'sh600519', side: 'buy', price: 1000, shares: 100, fee: 5, date: '2026-11-01' },
          { id: 't2', symbol: 'sh600519', side: 'sell', price: 1500, shares: 50, fee: 3, date: '2026-11-10' },
        ],
        position: { shares: 50, cost: 1000.05, realized: 24994.5 },
      })
    }
    return respond({ ok: true, groups: [] })
  }
}

function boot() {
  const harness = createHarness({ fetchImpl: makeFetch() })
  const definition = harness.boot()
  const dictionaries = {}
  const locale = {
    register: (namespace, localeId, dict) => {
      dictionaries[localeId] = dict
      return () => {}
    },
    bind: () => (key) => dictionaries.zh?.[key] ?? key,
  }
  const registrations = []
  const ctx = {
    get: (name) => (name === 'locale' ? locale : undefined),
    effect: (fn) => {
      const dispose = fn()
      return () => dispose?.()
    },
    slots: {
      inject: (slot, factory) => registrations.push({ slot, factory }),
      register: (options, component) => ({ options, component }),
    },
    inject: () => ({ dispose() {} }),
  }
  const plugin = definition.factory((name) => {
    if (name === 'react') return harness.React
    throw new Error(`unexpected require(${name})`)
  })
  plugin.apply(ctx)
  return { harness, registrations, t: (key) => dictionaries.zh?.[key] ?? key }
}

/* ---------------------------------------------------------------- capture */

function writePage(name, body, options) {
  const file = join(outDir, `${name}.html`)
  writeFileSync(file, page(body, options), 'utf8')
  return file
}

function screenshot(name, height, directory = shotDir) {
  if (noShot) return
  if (!existsSync(CHROME)) {
    console.log(`preview: Chrome not found, skipping ${name}.png`)
    return
  }
  mkdirSync(directory, { recursive: true })
  const htmlPath = join(outDir, `${name}.html`)
  const pngPath = join(directory, `${name}.png`)
  execFileSync(
    CHROME,
    [
      '--headless=new',
      '--disable-gpu',
      '--hide-scrollbars',
      '--force-device-scale-factor=2',
      '--virtual-time-budget=1200',
      `--window-size=1080,${height}`,
      `--screenshot=${pngPath}`,
      `file://${htmlPath}`,
    ],
    { stdio: 'ignore' },
  )
  console.log(`preview: wrote ${pngPath}`)
}

mkdirSync(outDir, { recursive: true })

// 1. The strip under the composer.
{
  const { harness, registrations, t } = boot()
  const dock = registrations.find((registration) => registration.slot === 'conversation.composer.dock').factory()
  harness.mount(dock.component, { t })
  await harness.settle()
  const tree = harness.getTree()
  writePage('dock', serialize(tree), { width: 1040 })
  screenshot('dock', 170)

  // A fixture that reproduces DSH's composer dock row: the native stats pill,
  // the strip and the context meter are siblings in one flex row. The strip is
  // expected to claim a second, full-width line below them.
  const rowCss = `
  .mock_DockRow__dock { display: flex; justify-content: center; align-items: center; gap: 12px; width: 100%; padding: 4px 8px; border: 1px dashed #c9ccd2; border-radius: 10px; }
  .mockStats { color: #8a9099; font-size: 11px; white-space: nowrap; }
  .mockMeter { width: 46px; height: 46px; border-radius: 50%; border: 3px solid #e2e4e8; display: grid; place-items: center; color: #8a9099; font-size: 11px; }
  `
  const rowHtml = `<div class="mock_DockRow__dock">
    <span class="mockStats">14 轮 273 步 · 190 tok/s &nbsp;|&nbsp; 86.3M tok · 缓存命中 98%</span>
    ${serialize(tree)}
    <span class="mockMeter">54%</span>
  </div>`
  writePage('dock-row', rowHtml, { width: 1040, extraCss: rowCss })
  // A development fixture only: it reproduces the DSH dock row to prove the
  // strip claims its own full-width line, so it stays out of README screenshots.
  screenshot('dock-row', 230, outDir)

  // 2. The same dock with the detail panel and the trade ledger open.
  const card = findAll(tree, (element) => String(element.props?.className ?? '').includes('dshst-card') && textOf(element).includes('贵州茅台'))[0]
  click(card)
  await harness.settle()
  const detailTree = harness.getTree()
  writePage('detail', serialize(detailTree), { width: 1040 })
  screenshot('detail', 780)
}

// 3. The plugin settings card, dark theme.
{
  const { harness, registrations, t } = boot()
  const settings = registrations.find((registration) => registration.slot === 'settings.section')
  harness.mount(settings.factory().component, { t })
  await harness.settle()
  const tree = harness.getTree()
  writePage('settings', serialize(tree), { width: 760, dark: true })
  screenshot('settings', 640)
}

console.log(`preview: wrote HTML into ${outDir}`)
