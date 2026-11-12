/**
 * Self-check for the stock ticker bundle: it mounts the Host half on a fake ctx,
 * drives its routes with fake requests, and loads the Client half the way the
 * browser module loader does (registration only, no rendering).
 *
 * Usage: node scripts/verify.mjs [--offline]
 * `--offline` skips every check that needs the upstream quote/K-line endpoints.
 */

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { apply } from '../index.js'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const offline = process.argv.includes('--offline')

const results = []
function check(label, ok, detail, options = {}) {
  results.push({ label, ok: Boolean(ok), detail, skipped: options.skipped === true })
}
function skip(label, reason) {
  results.push({ label, ok: true, detail: reason, skipped: true })
}

/* ---------------------------------------------------------------- harness */

function mountHost() {
  const routes = []
  const ctx = {
    effect: (fn) => {
      const dispose = fn()
      return () => dispose?.()
    },
    webServer: {
      register: (route) => {
        routes.push(route)
        return () => {}
      },
      getOrigin: () => 'http://127.0.0.1:54157',
    },
    fiber: { entry: { id: 'stock-ticker' } },
    get: () => undefined,
  }
  apply(ctx, { symbols: ['sh000001', 'sh600519', 'hk00700', 'usAAPL'], refreshSeconds: 15 })
  return routes[0]?.handler
}

const handler = mountHost()
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

async function request(path, { method = 'GET', body, headers = {} } = {}) {
  const chunks = body === undefined ? [] : [Buffer.from(JSON.stringify(body))]
  const req = {
    url: `/dsh-stock-ticker${path}`,
    method,
    headers: { host: '127.0.0.1:54157', origin: 'http://127.0.0.1:54157', ...headers },
    socket: { remoteAddress: '127.0.0.1' },
    async *[Symbol.asyncIterator]() {
      for (const chunk of chunks) yield chunk
    },
  }
  const res = {
    statusCode: 0,
    body: '',
    setHeader() {},
    end(chunk) {
      if (chunk !== undefined) this.body += chunk
      this.done = true
    },
  }
  handler(req, res)
  for (let waited = 0; waited < 25_000 && !res.done; waited += 25) await sleep(25)
  let json
  try {
    json = JSON.parse(res.body)
  } catch {
    json = res.body
  }
  return { status: res.statusCode, json }
}

/* ------------------------------------------------------------- Host half */

check('Host registers one route', typeof handler === 'function')

const quotes = await request('/quotes')
if (!quotes.json?.ok && offline) {
  skip('quotes (network)', 'offline')
} else {
  check('quotes answers ok', quotes.status === 200 && quotes.json.ok === true, quotes.status)
  check('quotes name a source', ['tencent', 'sina'].includes(quotes.json.source), quotes.json.source)
  check('quotes report source health', typeof quotes.json.sources === 'object', quotes.json.sources)
  check('session mode is one of three', ['trading', 'break', 'closed'].includes(quotes.json.session?.mode), quotes.json.session?.mode)
  check('session suggests an interval', typeof quotes.json.session?.intervalMs === 'number', quotes.json.session?.intervalMs)

  const aShare = quotes.json.quotes?.find((quote) => quote.symbol === 'sh600519')
  const us = quotes.json.quotes?.find((quote) => quote.market === 'us')
  check('every symbol answered', quotes.json.quotes?.length === 4, quotes.json.quotes?.length)
  check('A-share quote has extras', typeof aShare?.extras?.limitUp === 'number', aShare?.extras)
  check('A-share extras keep up/down order', aShare?.extras?.limitUp > aShare?.extras?.limitDown, [aShare?.extras?.limitUp, aShare?.extras?.limitDown])
  check('A-share quote has five levels', Array.isArray(aShare?.depth?.bids) && aShare.depth.bids.length === 5, aShare?.depth?.bids?.length)
  check('quote carries a daily K-line', Array.isArray(aShare?.kline) && aShare.kline.length > 10, aShare?.kline?.length)
  check('US quote carries no A-share extras', us?.extras === undefined, us?.extras)
}

const normalized = await request('/quotes?symbols=600519.SH,00700.HK,aapl')
check(
  'symbol spellings normalize',
  JSON.stringify(normalized.json?.symbols) === JSON.stringify(['sh600519', 'hk00700', 'usAAPL']),
  normalized.json?.symbols,
)
const unknown = await request('/quotes?symbols=sh999999')
check('unknown symbol is reported per row', unknown.json?.quotes?.[0]?.error === 'no-data' && unknown.json.ok === true, unknown.json?.quotes?.[0])

if (offline) {
  skip('K-line periods (network)', 'offline')
  skip('intraday (network)', 'offline')
} else {
  for (const [period, adjust, minimum] of [
    ['day', 'qfq', 30],
    ['week', 'qfq', 30],
    ['month', 'qfq', 12],
    ['day', 'hfq', 30],
    ['day', 'none', 30],
    ['m5', 'none', 10],
  ]) {
    const kline = await request(`/kline?symbol=sh600519&period=${period}&adjust=${adjust}&limit=40`)
    check(
      `kline ${period}/${adjust}`,
      kline.status === 200 && kline.json.ok === true && kline.json.rows.length >= minimum,
      [kline.status, kline.json.rows?.length, kline.json.error],
    )
  }
  const hk = await request('/kline?symbol=hk00700&period=week&adjust=qfq&limit=20')
  check('kline answers for Hong Kong', hk.json?.ok === true && hk.json.rows.length > 5, hk.json?.rows?.length)
  const refreshed = await request('/kline?symbol=sh600519&period=day&adjust=qfq&limit=20&refresh=1')
  check('kline honors refresh=1', refreshed.json?.ok === true && refreshed.json.rows.length === 20, refreshed.json?.rows?.length)

  const trend = await request('/trend?symbol=sh600519')
  check('intraday line answers', trend.status === 200 && trend.json.points?.length > 200, [trend.status, trend.json.points?.length])
  check('intraday carries previous close', trend.json.prevClose > 0, trend.json.prevClose)
  check('intraday carries a running average', typeof trend.json.points?.[10]?.avg === 'number', trend.json.points?.[10])
  const hkTrend = await request('/trend?symbol=hk00700')
  check('intraday answers for Hong Kong', hkTrend.json?.ok === true && hkTrend.json.points.length > 100, hkTrend.json?.points?.length)
  const usTrend = await request('/trend?symbol=usAAPL')
  check('intraday refuses US symbols', usTrend.status === 502, [usTrend.status, usTrend.json?.error])
}

check('invalid symbol is rejected', (await request('/kline?symbol=@@@@')).status === 400)
check('unknown route is rejected', (await request('/bogus')).status === 404)
check('malformed period falls back to day', (await request('/kline?symbol=sh600519&period=year&limit=10')).json?.period === 'day')
const settings = await request('/settings')
check('settings carry the symbol list', Array.isArray(settings.json?.settings?.symbols), settings.json?.settings)

const emptyConfig = await request('/config', { method: 'POST', body: { symbols: [] } })
check('empty symbol list is rejected', emptyConfig.status === 400 && emptyConfig.json.error === 'symbols-empty', emptyConfig.json)
const foreignConfig = await request('/config', { method: 'POST', body: { symbols: ['sh600519'] }, headers: { origin: 'https://evil.example' } })
check('foreign origin cannot write config', foreignConfig.status === 403, foreignConfig.status)
const localConfig = await request('/config', { method: 'POST', body: { symbols: ['sh600519'] }, headers: { origin: 'http://localhost:54157' } })
check('loopback origin may write config', localConfig.status === 503, [localConfig.status, localConfig.json?.error])

/* ----------------------------------------------------------- Client half */

const clientSource = readFileSync(join(root, 'client.js'), 'utf8')
let captured
const reactStub = {
  createElement: () => ({}),
  Fragment: 'Fragment',
  useState: (initial) => [typeof initial === 'function' ? initial() : initial, () => {}],
  useEffect: () => {},
  useCallback: (fn) => fn,
  useRef: (value) => ({ current: value }),
  useMemo: (fn) => fn(),
}
const factoryRequire = (name) => {
  if (name === 'react') return reactStub
  throw new Error(`unexpected require(${name})`)
}
const loaderWindow = { __ModuleLoader__: { load: (definition) => (captured = definition) } }
new Function('window', 'require', clientSource)(loaderWindow, factoryRequire)

const packageJson = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
check('client module id equals package name', captured?.id === packageJson.name, [captured?.id, packageJson.name])
const plugin = captured.factory(factoryRequire)
check('client half declares only slots', JSON.stringify(plugin.inject) === '["slots"]', plugin.inject)

const registrations = []
const dictionaries = []
const locale = {
  register: (namespace, localeId, dict) => {
    dictionaries.push([namespace, localeId, Object.keys(dict).length])
    return () => {}
  },
  bind: (namespace) => (key) => `${namespace}:${key}`,
}
const clientCtx = {
  get: (name) => (name === 'locale' ? locale : undefined),
  effect: (fn) => {
    const dispose = fn()
    return () => dispose?.()
  },
  slots: {
    inject: (slot, factory) => registrations.push({ slot, factory }),
    register: (options, component) => ({ options, component }),
  },
}
plugin.apply(clientCtx)
const entry = registrations[0]?.factory()
check('client registers one dock entry', registrations.length === 1, registrations.length)
check('client targets the composer dock', registrations[0]?.slot === 'conversation.composer.dock', registrations[0]?.slot)
check('dock entry id and order', entry?.options?.id === 'stock-ticker' && entry?.options?.order === 5, [entry?.options?.id, entry?.options?.order])
check('dock label is a thunk', typeof entry?.options?.label === 'function')
check('both dictionaries registered', ['zh', 'en'].every((id) => dictionaries.some(([, localeId]) => localeId === id)), dictionaries)
check('apply survives a missing locale service', (() => {
  try {
    plugin.apply({ get: () => undefined, effect: (fn) => fn(), slots: clientCtx.slots })
    return true
  } catch {
    return false
  }
})())

/* ----------------------------------------------------------------- report */

const failed = results.filter((result) => !result.ok)
const skipped = results.filter((result) => result.skipped)
for (const result of results) {
  if (!result.ok) console.log(`FAIL  ${result.label}  →  ${JSON.stringify(result.detail)}`)
}
console.log(`\n${results.length - failed.length - 0}/${results.length} checks passed${skipped.length ? ` (${skipped.length} skipped)` : ''}`)
process.exit(failed.length === 0 ? 0 : 1)
