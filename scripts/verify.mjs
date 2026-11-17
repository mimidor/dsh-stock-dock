/**
 * Self-check for the stock ticker bundle.
 *
 * It mounts the Host half on a fake ctx (including the tool registry), drives
 * its routes with fake requests, stubs the upstream quote endpoints where the
 * failover paths matter, and loads the Client half the way the browser module
 * loader does. `--offline` skips every check that needs the public endpoints.
 *
 * Usage: node scripts/verify.mjs [--offline]
 */

import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const offline = process.argv.includes('--offline')

// The store would otherwise write into the real DSH home during a check run.
const storeDir = mkdtempSync(join(tmpdir(), 'dsh-stock-ticker-verify-'))
process.env.DSH_STOCK_DOCK_STORE = join(storeDir, 'store.json')

const { apply, __test } = await import('../index.js')

const results = []
function check(label, ok, detail, options = {}) {
  results.push({ label, ok: Boolean(ok), detail, skipped: options.skipped === true })
}
function skip(label, reason) {
  results.push({ label, ok: true, detail: reason, skipped: true })
}

/* ---------------------------------------------------------------- harness */

const registeredTools = []
function mountHost(config = { symbols: ['sh000001', 'sh600519', 'hk00700', 'usAAPL'], refreshSeconds: 15 }) {
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
    get: (name) => (name === 'tools' ? ctx.tools : undefined),
    tools: {
      register: (definition) => {
        registeredTools.push(definition)
        return () => {}
      },
    },
  }
  apply(ctx, config)
  return routes
}

const routes = mountHost()
const handler = routes[0]?.handler
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

check('Host registers the primary and alias routes', routes.length === 2 && typeof handler === 'function', routes.map((route) => route.path))
check('routes are prefix-mounted', routes.every((route) => route.kind === 'prefix'), routes.map((route) => route.kind))

const health = await request('/health')
check('health answers ok', health.status === 200 && health.json.ok === true, health.status)
check('health reports the store path', String(health.json.store).endsWith('store.json'), health.json.store)
check('health reports source health', typeof health.json.sources?.tencent === 'string', health.json.sources)
check('health reports the extended-hours cache', typeof health.json.caches?.extended === 'number', health.json.caches)

const quotes = offline ? { status: 0, json: null } : await request('/quotes')
if (offline) {
  skip('quotes (network)', 'offline')
} else {
  check('quotes answers ok', quotes.status === 200 && quotes.json.ok === true, quotes.status)
  check('quotes name a source', ['tencent', 'sina', 'eastmoney'].includes(quotes.json.source), quotes.json.source)
  check('quotes report source health', typeof quotes.json.sources === 'object', quotes.json.sources)
  check('session mode is one of three', ['trading', 'break', 'closed'].includes(quotes.json.session?.mode), quotes.json.session?.mode)
  check('session suggests an interval', typeof quotes.json.session?.intervalMs === 'number', quotes.json.session?.intervalMs)
  check('session flags holidays explicitly', typeof quotes.json.session?.holiday === 'boolean', quotes.json.session?.holiday)

  const aShare = quotes.json.quotes?.find((quote) => quote.symbol === 'sh600519')
  const us = quotes.json.quotes?.find((quote) => quote.market === 'us')
  check('every symbol answered', quotes.json.quotes?.length === 4, quotes.json.quotes?.length)
  check('A-share quote has extras', typeof aShare?.extras?.limitUp === 'number', aShare?.extras)
  check('A-share extras keep up/down order', aShare?.extras?.limitUp > aShare?.extras?.limitDown, [aShare?.extras?.limitUp, aShare?.extras?.limitDown])
  check('A-share quote has five levels', Array.isArray(aShare?.depth?.bids) && aShare.depth.bids.length === 5, aShare?.depth?.bids?.length)
  check('the quote poll no longer carries K-lines', aShare?.kline === undefined, aShare?.kline?.length)
  const legacy = await request('/quotes?symbols=sh600519&sparklines=1')
  check('the legacy sparklines flag still works', Array.isArray(legacy.json?.quotes?.[0]?.kline) && legacy.json.quotes[0].kline.length > 10, legacy.json?.quotes?.[0]?.kline?.length)
  check('US quote carries no A-share extras', us?.extras === undefined, us?.extras)
  check('every quote names its own source', quotes.json.quotes?.every((quote) => typeof quote.source === 'string'), quotes.json.quotes?.map((quote) => quote.source))
  check('quotes carry groups and an active group', Array.isArray(quotes.json.groups) && typeof quotes.json.activeGroup === 'string', [quotes.json.groups, quotes.json.activeGroup])
  check('quotes carry an empty alert list by default', Array.isArray(quotes.json.fired), quotes.json.fired)
}

/* -------------------------------------------------- Host logic, no network */

check('A-share lunch break is a break', __test.marketState('cn', { minutes: 12 * 60, weekday: 'Wed', weekend: false }) === 'break')
check('after the A-share close is closed', __test.marketState('cn', { minutes: 20 * 60, weekday: 'Wed', weekend: false }) === 'closed')
check('weekend is closed', __test.marketState('cn', { minutes: 10 * 60, weekday: 'Sat', weekend: true }) === 'closed')
check('US session uses the New York clock', __test.marketState('us', { minutes: 10 * 60, weekday: 'Wed', weekend: false }) === 'trading' &&
  __test.marketState('us', { minutes: 20 * 60, weekday: 'Wed', weekend: false }) === 'closed')

for (const [raw, expected] of [
  ['600519.SH', 'sh600519'],
  ['00700.HK', 'hk00700'],
  ['AAPL.US', 'usAAPL'],
  ['brk-b', 'usBRK-B'],
  ['430047', 'bj430047'],
  ['110038', 'sh110038'],
  ['000001', 'sz000001'],
  ['hk700', 'hk00700'],
  ['sh600519.foo', undefined],
  ['@@@', undefined],
]) {
  check(`symbol ${raw} normalizes`, __test.normalizeSymbol(raw) === expected, __test.normalizeSymbol(raw))
}

const parsed = __test.parseSymbols(['600519.SH', '600519', '@@@', '00700.HK'])
check('parseSymbols reports what it dropped', parsed.symbols.length === 2 && parsed.rejected[0] === '@@@' && parsed.dropped === 2, parsed)

const cappedCache = { klines: new Map() }
for (let index = 0; index < __test.KLINES_MAX_ENTRIES + 40; index += 1) __test.rememberKline(cappedCache, `k${index}`, [])
check('K-line cache is bounded', cappedCache.klines.size === __test.KLINES_MAX_ENTRIES, cachedSize())

function cachedSize() {
  return cappedCache.klines.size
}
check('K-line cache cap leaves room for 30 symbols x 8 periods', __test.KLINES_MAX_ENTRIES >= 240, __test.KLINES_MAX_ENTRIES)

/* --------------------------------------------------------- session details */

for (const [raw, expected] of [
  ['20261112161452', '2026-11-12'],
  ['2026/11/12 16:08:06', '2026-11-12'],
  ['2026-11-11 16:00:01', '2026-11-11'],
  ['', undefined],
  ['nonsense', undefined],
]) {
  check(`quote date ${raw || '(empty)'} parses`, __test.parseQuoteDate(raw) === expected, __test.parseQuoteDate(raw))
}

const staleQuotes = [{ symbol: 'sh600519', market: 'cn', time: '20200101150000', price: 1 }]
const staleSession = __test.sessionFor(['sh600519'], 15, staleQuotes, new Date('2026-11-12T02:00:00Z'))
check('a clock that says trading but a stale quote is a holiday', staleSession.mode === 'closed' && staleSession.holiday === true, staleSession)
check('a holiday poll uses the closed cadence', staleSession.intervalMs >= 60_000, staleSession.intervalMs)

const freshQuotes = [{ symbol: 'sh600519', market: 'cn', time: '20261112100000', price: 1 }]
const freshSession = __test.sessionFor(['sh600519'], 15, freshQuotes, new Date('2026-11-12T02:00:00Z'))
check('a fresh quote keeps the market trading', freshSession.mode === 'trading' && freshSession.holiday === false, freshSession)

/* --------------------------------------------------------------- parsers */

const tencentFields = Array.from({ length: 60 }, () => '0')
Object.assign(tencentFields, {
  0: '1',
  1: '贵州茅台',
  2: '600519',
  3: '1410.27',
  4: '1402.30',
  5: '1395.13',
  6: '32373',
  30: '20261112161452',
  31: '7.97',
  32: '0.57',
  33: '1411.00',
  34: '1388.11',
  37: '453681',
  38: '0.26',
  39: '21.46',
  43: '1.63',
  44: '17629.53',
  45: '17629.53',
  46: '6.50',
  47: '1542.53',
  48: '1262.07',
  49: '0.91',
  9: '1410.27',
  10: '17',
  11: '1410.22',
  12: '1',
  19: '1410.43',
  20: '2',
})
const tencentQuote = __test.parseTencentQuote('sh600519', tencentFields)
check('tencent parser reads price and change', tencentQuote.price === 1410.27 && tencentQuote.changePct === 0.57, tencentQuote)
check('tencent parser scales turnover to yuan', tencentQuote.amount === 4_536_810_000, tencentQuote.amount)
check('tencent parser keeps A-share limit prices', tencentQuote.extras.limitUp === 1542.53 && tencentQuote.extras.limitDown === 1262.07, tencentQuote.extras)
check('tencent parser builds the five levels', tencentQuote.depth?.bids?.[0]?.price === 1410.27 && tencentQuote.depth.bids.length === 5, tencentQuote.depth?.bids)
check('tencent parser names the source', tencentQuote.source === 'tencent', tencentQuote.source)

const sinaCn = __test.parseSinaQuote(
  'sz000002',
  'VANKE,9.10,9.00,9.20,9.30,8.90,9.10,0.20,2.20,1000,9200.00,,,2026-11-12,15:00:00'.split(','),
)
check('sina parser handles an A-share row', sinaCn.price === 9.2 && sinaCn.prevClose === 9, sinaCn)
const sinaHk = __test.parseSinaQuote(
  'hk00941',
  'CHINA MOBILE,80.10,80.00,80.50,80.90,79.80,80.00,0.50,0.63,1000,80000.00,,,2026/11/12,16:08:06'.split(','),
)
check('sina parser handles a Hong Kong row', sinaHk.market === 'hk' && sinaHk.price === 80, sinaHk)
const sinaUs = __test.parseSinaQuote(
  'usAAPL',
  'Apple,355.63,2.04,2026-11-11 16:00:01,7.12,349.55,355.91,349.33,0,0,34453477'.split(','),
)
check('sina parser handles a US row', sinaUs.market === 'us' && sinaUs.price === 355.63, sinaUs)

const emQuote = __test.parseEastmoneyRow('sh600519', {
  f2: 1410.27,
  f3: 0.57,
  f4: 7.97,
  f5: 32373,
  f6: 4536814518,
  f8: 0.26,
  f9: 20.51,
  f10: 0.91,
  f12: '600519',
  f13: 1,
  f14: '贵州茅台',
  f15: 1411,
  f16: 1388.11,
  f17: 1395.13,
  f18: 1402.3,
  f20: 1762952579442,
  f21: 1762952579442,
})
check('eastmoney parser maps the batch row', emQuote.price === 1410.27 && emQuote.extras.totalCap > 1e9, emQuote)
check('eastmoney parser names the source', emQuote.source === 'eastmoney', emQuote.source)

/* ------------------------------------------------------------------ alerts */

const alertState = [
  { id: 'a1', symbol: 'sh600519', op: 'above', price: 1500, firedAt: null },
  { id: 'a2', symbol: 'sh600519', op: 'below', price: 1000, firedAt: null },
]
const alertQuotes = [{ symbol: 'sh600519', price: 1410.27, name: '贵州茅台' }]
const hits = __test.evaluateAlerts(alertState, alertQuotes, 1000)
check('an alert fires when the price crosses it', hits.length === 0 && alertState[0].firedAt === null, hits)
const highQuotes = [{ symbol: 'sh600519', price: 1600, name: '贵州茅台' }]
const fired = __test.evaluateAlerts(alertState, highQuotes, 2000)
check('a crossed alert fires once', fired.length === 1 && fired[0].id === 'a1' && alertState[0].firedAt === 2000, fired)
check('a fired alert stays quiet', __test.evaluateAlerts(alertState, highQuotes, 3000).length === 0, alertState)
check('acknowledging re-arms but waits for a flip', (() => {
  __test.rearmAlert(alertState, 'a1', 4000)
  const stillHigh = __test.evaluateAlerts(alertState, highQuotes, 5000)
  const afterDrop = __test.evaluateAlerts(alertState, alertQuotes, 6000)
  const retrigger = __test.evaluateAlerts(alertState, highQuotes, 7000)
  return stillHigh.length === 0 && afterDrop.length === 0 && retrigger.length === 1
})())
check('invalid alerts are rejected', __test.normalizeAlert({ symbol: 'sh600519', op: 'sideways', price: 1 }) === undefined)

/* ------------------------------------------------------------------- store */

const seeded = __test.normalizeState({}, ['sh600519', 'hk00700'])
check('an empty store seeds the default group from config', seeded.groups[0].symbols.length === 2, seeded.groups)
check('a fresh store also gets the market group', seeded.groups.some((group) => group.id === 'market' && group.symbols.includes('hkHSI')), seeded.groups.map((group) => group.id))
check('an empty store keeps defaults for prefs', '__prefs' in [] || seeded.prefs.showMA === true, seeded.prefs)
const migrated = __test.normalizeState({
  groups: [{ id: 'default', name: '主表', symbols: ['sh600519', '@@@', 'sh600519'] }],
  holdings: { sh600519: { shares: 0, cost: 10 }, hk00700: { shares: 100, cost: 300 } },
  alerts: [{ symbol: 'sh600519', op: 'above', price: 1500 }, { symbol: '', op: 'above', price: 1 }],
  activeGroup: 'missing',
})
check('store migration drops bad symbols and holdings', migrated.groups[0].symbols.length === 1 && Object.keys(migrated.holdings).length === 1, migrated)
check('store migration drops invalid alerts', migrated.alerts.length === 1, migrated.alerts)
check('store migration repairs the active group', migrated.activeGroup === 'default', migrated.activeGroup)
check('active symbols follow the active group', __test.activeSymbols(migrated)[0] === 'sh600519', __test.activeSymbols(migrated))

/* --------------------------------------------------------- failover paths */

/*
 * The failover paths only run when a source answers badly, so they are driven
 * with a stubbed fetch: Tencent answering a trimmed row set is what a
 * rate-limited endpoint looks like, and Sina standing in for the hole is the
 * behaviour under test.
 */
const tencentRow = (() => {
  const fields = Array.from({ length: 60 }, () => '0')
  fields[0] = '1'
  fields[1] = 'PingAn'
  fields[2] = '601318'
  fields[3] = '50.20'
  fields[4] = '49.80'
  fields[5] = '49.90'
  fields[6] = '1000'
  fields[30] = '20261112150000'
  fields[31] = '0.40'
  fields[32] = '0.80'
  fields[33] = '50.50'
  fields[34] = '49.50'
  return `v_sh601318="${fields.join('~')}";`
})()

const sinaHkRow = 'var hq_str_rt_hk00941="CHINA MOBILE,80.10,80.00,80.50,80.90,79.80,80.00,0.50,0.63,1000,80000.00,,,2026/11/12,16:08:06";'
const sinaSzRow = 'var hq_str_sz000002="VANKE,9.10,9.00,9.20,9.30,8.90,9.10,0.20,2.20,1000,9200.00,,,2026-11-12,15:00:00";'

const realFetch = globalThis.fetch
try {
  globalThis.fetch = async (rawUrl) => {
    const url = String(rawUrl)
    if (url.includes('qt.gtimg.cn')) {
      const asked = decodeURIComponent(url.split('q=')[1] ?? '')
      if (asked.includes('sz000002')) return new Response('v_pv_none_match="1";', { status: 200 })
      return new Response(tencentRow, { status: 200 })
    }
    if (url.includes('proxy.finance.qq.com') || url.includes('web.ifzq.gtimg.cn')) {
      return new Response(JSON.stringify({ code: 0, data: {} }), { status: 200 })
    }
    if (url.includes('hq.sinajs.cn')) {
      const asked = decodeURIComponent(url.split('list=')[1] ?? '')
      const body = [/sz000002/.test(asked) ? sinaSzRow : '', /hk00941/.test(asked) ? sinaHkRow : ''].filter(Boolean).join('\n')
      return new Response(body, { status: 200 })
    }
    throw new Error(`unexpected fetch ${url}`)
  }

  // Partial answer: Tencent covers the A-share, Sina is asked only for the hole.
  const merged = await request('/quotes?symbols=sh601318,hk00941')
  const tencentRowQuote = merged.json?.quotes?.find((quote) => quote.symbol === 'sh601318')
  const sinaRowQuote = merged.json?.quotes?.find((quote) => quote.symbol === 'hk00941')
  check('answered symbols keep their first source', tencentRowQuote?.source === 'tencent' && tencentRowQuote?.name === 'PingAn', tencentRowQuote)
  check('missing symbols fall back to the second source', sinaRowQuote?.source === 'sina' && typeof sinaRowQuote?.price === 'number', sinaRowQuote)

  // Whole-source failure: Tencent parses nothing, so Sina must carry the list.
  // Runs second because it deliberately trips the 30s source cooldown.
  const failedOver = await request('/quotes?symbols=sz000002')
  check('a source that parses nothing is reported down', failedOver.json?.sources?.tencent === 'down', failedOver.json?.sources)
  check('the whole list fails over to the second source', failedOver.json?.source === 'sina' && failedOver.json?.quotes?.[0]?.price === 9.2, [failedOver.json?.source, failedOver.json?.quotes?.[0]])
} finally {
  globalThis.fetch = realFetch
}

/* ------------------------------------------------------ network data paths */

if (offline) {
  skip('symbol spellings over HTTP (network)', 'offline')
} else {
  const normalized = await request('/quotes?symbols=600519.SH,00700.HK,aapl')
  check(
    'symbol spellings normalize',
    JSON.stringify(normalized.json?.symbols) === JSON.stringify(['sh600519', 'hk00700', 'usAAPL']),
    normalized.json?.symbols,
  )
  const unknown = await request('/quotes?symbols=sh999999')
  check('unknown symbol is reported per row', unknown.json?.quotes?.[0]?.error === 'no-data' && unknown.json.ok === true, unknown.json?.quotes?.[0])
}

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
    ['m15', 'none', 10],
    ['m30', 'none', 10],
    ['m60', 'none', 10],
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
  const averageOnPriceScale = (payload) => {
    const last = payload?.points?.[payload.points.length - 1]
    return Boolean(last) && typeof last.avg === 'number' && Math.abs(last.avg - last.price) / last.price < 0.05
  }
  check('A-share average is on the price scale', averageOnPriceScale(trend.json), [trend.json.points?.at(-1)?.avg, trend.json.points?.at(-1)?.price])

  const multiDay = await request('/trend?symbol=sh600519&days=5')
  check('multi-day intraday answers', multiDay.json?.ok === true && multiDay.json.points.length > 400, multiDay.json?.points?.length)
  check('multi-day intraday labels its days', Array.isArray(multiDay.json.days) && multiDay.json.days.length === 5, multiDay.json?.days)
  check(
    'multi-day average restarts per day',
    (() => {
      const days = multiDay.json.days
      const lastOfFirstDay = multiDay.json.points.filter((point) => point.day === days[0]).at(-1)
      const firstOfLastDay = multiDay.json.points.find((point) => point.day === days[days.length - 1])
      return Boolean(lastOfFirstDay?.avg) && Boolean(firstOfLastDay?.avg) &&
        Math.abs(firstOfLastDay.avg - firstOfLastDay.price) / firstOfLastDay.price < 0.06
    })(),
    multiDay.json?.days,
  )

  check('multi-day intraday is thinned for the chart', multiDay.json.points.length <= 900, multiDay.json?.points?.length)
  check('intraday points drop the unused turnover column', multiDay.json.points.every((point) => point.amount === undefined), multiDay.json?.points?.[0])
  const hkTrend = await request('/trend?symbol=hk00700')
  check('intraday answers for Hong Kong', hkTrend.json?.ok === true && hkTrend.json.points.length > 100, hkTrend.json?.points?.length)
  const hkMulti = await request('/trend?symbol=hk00700&days=5')
  check('Hong Kong multi-day intraday answers', hkMulti.json?.ok === true && hkMulti.json.days.length === 5, [hkMulti.json?.ok, hkMulti.json?.days?.length, hkMulti.json?.error])
  check('Hong Kong average is on the price scale', averageOnPriceScale(hkTrend.json), [hkTrend.json.points?.at(-1)?.avg, hkTrend.json.points?.at(-1)?.price])
  const usTrend = await request('/trend?symbol=usAAPL')
  check('intraday refuses US symbols gracefully', usTrend.status === 200 && usTrend.json.ok === false && typeof usTrend.json.error === 'string', [usTrend.status, usTrend.json?.error])

  const search = await request(`/search?q=${encodeURIComponent('茅台')}`)
  check('search finds a stock by name', search.json?.ok === true && search.json.items.some((item) => item.symbol === 'sh600519'), search.json?.items?.slice(0, 2))
  check('search results carry a market and type', search.json.items.every((item) => item.market && item.type !== undefined), search.json?.items?.[0])
  const searchCode = await request('/search?q=00700')
  check('search finds Hong Kong by code', searchCode.json?.items?.some((item) => item.symbol === 'hk00700'), searchCode.json?.items?.slice(0, 2))
}

/* ------------------------------------------------------------------ writes */

check('invalid symbol is rejected', (await request('/kline?symbol=@@@@')).status === 400)
check('unknown route is rejected', (await request('/bogus')).status === 404)
check('malformed period falls back to day', (await request('/kline?symbol=sh600519&period=quarter&limit=10')).json?.period === 'day')
check('minute periods ignore the adjust parameter', (await request('/kline?symbol=sh600519&period=m30&adjust=hfq&limit=10')).json?.adjust === 'none')

const sparklines = await request('/sparklines')
check('sparklines answer for the watchlist', sparklines.status === 200 && sparklines.json.ok === true, sparklines.status)
check('sparklines carry rows per symbol', typeof sparklines.json.rows === 'object' && Object.keys(sparklines.json.rows).length > 0, Object.keys(sparklines.json.rows ?? {}))
check('sparklines carry an ETag', typeof sparklines.json.etag === 'string' && sparklines.json.etag.startsWith('"'), sparklines.json.etag)
const revalidated = await request('/sparklines', { headers: { 'if-none-match': sparklines.json.etag } })
check('sparklines answer 304 on a matching ETag', revalidated.status === 304, revalidated.status)

const settings = await request('/settings')
check('settings carry the symbol list', Array.isArray(settings.json?.settings?.symbols), settings.json?.settings)
check('settings carry the groups', Array.isArray(settings.json?.groups), settings.json?.groups)
check(
  'settings carry the display preferences',
  settings.json?.settings?.source === 'auto' &&
    settings.json.settings.showMiniChart === true &&
    settings.json.settings.showOrderBook === true &&
    settings.json.settings.showExtended === false,
  settings.json?.settings,
)

const emptyConfig = await request('/config', { method: 'POST', body: { symbols: [] } })
check('empty symbol list is rejected', emptyConfig.status === 400 && emptyConfig.json.error === 'symbols-empty', emptyConfig.json)
const foreignConfig = await request('/config', { method: 'POST', body: { symbols: ['sh600519'] }, headers: { origin: 'https://evil.example' } })
check('foreign origin cannot write config', foreignConfig.status === 403, foreignConfig.status)
const localConfig = await request('/config', { method: 'POST', body: { symbols: ['sh600519', 'sz000001'] } })
check('loopback origin may write config', localConfig.status === 200 && localConfig.json.ok === true, [localConfig.status, localConfig.json])
check('config write reports where it persisted', localConfig.json.persisted === 'store', localConfig.json.persisted)
check('config write rejects the unknown entries', localConfig.json.rejected !== undefined, localConfig.json.rejected)

const afterConfig = await request('/settings')
check(
  'config write reaches the watchlist',
  JSON.stringify(afterConfig.json.settings.symbols) === JSON.stringify(['sh600519', 'sz000001']),
  afterConfig.json.settings.symbols,
)

const prefsWrite = await request('/prefs', { method: 'POST', body: { patch: { defaultPeriod: 'week', showMA: false, refreshSeconds: 20, source: 'sina' } } })
check('prefs write is accepted', prefsWrite.json?.ok === true, prefsWrite.json)
const prefsRead = await request('/settings')
check(
  'prefs override the profile config at runtime',
  prefsRead.json.settings.refreshSeconds === 20 && prefsRead.json.settings.defaultPeriod === 'week' && prefsRead.json.settings.showMA === false,
  prefsRead.json.settings,
)
check('the data source preference is persisted', prefsRead.json.settings.source === 'sina', prefsRead.json.settings.source)
if (offline) {
  skip('the data source preference forces the source (network)', 'offline')
} else {
  const forcedByPrefs = await request('/quotes?symbols=sh600519')
  check('the data source preference forces the source', forcedByPrefs.json?.source === 'sina', [forcedByPrefs.json?.source, forcedByPrefs.json?.quotes?.[0]?.source])
  await request('/prefs', { method: 'POST', body: { patch: { source: 'auto' } } })
}

const alertWrite = await request('/alerts', {
  method: 'POST',
  body: { action: 'save', symbol: 'sh600519', op: 'above', price: 100 },
})
check('an alert can be saved', alertWrite.json?.ok === true && alertWrite.json.alerts.length === 1, alertWrite.json)
check('an alert rejects a bad symbol', (await request('/alerts', { method: 'POST', body: { action: 'save', symbol: '@@@', op: 'above', price: 1 } })).status === 400)
check('an alert rejects a foreign origin', (await request('/alerts', { method: 'POST', body: { action: 'save', symbol: 'sh600519', op: 'above', price: 1 }, headers: { origin: 'https://evil.example' } })).status === 403)

const holdingWrite = await request('/holdings', { method: 'POST', body: { symbol: 'sh600519', shares: 100, cost: 1300 } })
check('a position can be saved', holdingWrite.json?.ok === true && holdingWrite.json.holdings.sh600519.shares === 100, holdingWrite.json)
check('a position rejects zero shares', (await request('/holdings', { method: 'POST', body: { symbol: 'sh600519', shares: 0, cost: 10 } })).status === 400)

const tradeWrite = await request('/trades', {
  method: 'POST',
  body: { action: 'save', symbol: 'sh600519', side: 'buy', price: 1000, shares: 100, fee: 5, date: '2026-11-01' },
})
check('a trade can be recorded', tradeWrite.json?.ok === true && tradeWrite.json.count === 1, tradeWrite.json)
const tradeSell = await request('/trades', {
  method: 'POST',
  body: { action: 'save', symbol: 'sh600519', side: 'sell', price: 1500, shares: 50, fee: 3, date: '2026-11-10' },
})
check('a sell rolls the average cost into realised P/L', tradeSell.json?.positions?.[0]?.realized === 24994.5, tradeSell.json?.positions)
check('the ledger rejects a bad trade', (await request('/trades', { method: 'POST', body: { action: 'save', symbol: 'sh600519', side: 'buy', price: 0, shares: 1 } })).status === 400)
const rebuild = await request('/trades', { method: 'POST', body: { action: 'apply' } })
check('holdings can be rebuilt from the ledger', rebuild.json?.holdings?.sh600519?.shares === 50, rebuild.json?.holdings)
const tradeList = await request('/trades?symbol=sh600519')
check('the ledger lists its trades', tradeList.json?.count === 2 && tradeList.json.trades.length === 2, tradeList.json?.count)

const groupWrite = await request('/groups', { method: 'POST', body: { action: 'save', name: '科技', symbols: ['sh600519', 'sz000001'] } })
check('a group can be created', groupWrite.json?.ok === true && groupWrite.json.groups.length === 3, groupWrite.json?.groups)
const marketGroup = await request('/groups', { method: 'POST', body: { action: 'addMarket' } })
check('the market group action is idempotent', marketGroup.json?.groups?.filter((group) => group.id === 'market').length === 1, marketGroup.json?.groups?.map((group) => group.id))
const activeGroup = await request('/groups', { method: 'POST', body: { action: 'activate', id: groupWrite.json.groups[1].id } })
check('a group can be activated', activeGroup.json?.activeGroup === groupWrite.json.groups[1].id, activeGroup.json)
check('the default group cannot be removed', (await request('/groups', { method: 'POST', body: { action: 'remove', id: 'default' } })).status === 400)

// The alert above is already satisfied, so the next poll must surface it once.
const firedQuotes = await request('/quotes?symbols=sh600519')
check('a satisfied alert surfaces as a hit', firedQuotes.json.fired.length === 1 && firedQuotes.json.fired[0].symbol === 'sh600519', firedQuotes.json.fired)
check('the quote carries the armed alert', Array.isArray(firedQuotes.json.quotes?.[0]?.alerts) && firedQuotes.json.quotes[0].alerts.length === 1, firedQuotes.json.quotes?.[0]?.alerts)
check('the quote carries the rebuilt position', firedQuotes.json.quotes?.[0]?.holding?.shares === 50, firedQuotes.json.quotes?.[0]?.holding)
check('the quote carries the realised P/L', firedQuotes.json.quotes?.[0]?.trade?.realized === 24994.5, firedQuotes.json.quotes?.[0]?.trade)
const acked = await request('/alerts', { method: 'POST', body: { action: 'ack', id: firedQuotes.json.fired[0].id } })
check('acknowledging clears the fired flag', acked.json.alerts[0].firedAt === null && acked.json.alerts[0].muteUntilFlip === true, acked.json.alerts[0])
const afterAck = await request('/quotes?symbols=sh600519')
check('an acknowledged alert does not re-fire on the same price', afterAck.json.fired.length === 0, afterAck.json.fired)
check('an alert can be removed', (await request('/alerts', { method: 'POST', body: { action: 'remove', id: acked.json.alerts[0].id } })).json.alerts.length === 0)
check('a position can be removed', (await request('/holdings', { method: 'POST', body: { action: 'remove', symbol: 'sh600519' } })).json.holdings.sh600519 === undefined)

/* -------------------------------------------------------------------- tool */

check('the stock_quote tool is registered', registeredTools.some((definition) => definition.name === 'stock_quote'), registeredTools.map((definition) => definition.name))
const tool = registeredTools.find((definition) => definition.name === 'stock_quote')
check('the tool declares parameters', tool?.parameters?.properties?.symbols?.type === 'array', tool?.parameters)
const eventsTool = registeredTools.find((definition) => definition.name === 'stock_events')
check('the stock_events tool is registered', Boolean(eventsTool), registeredTools.map((definition) => definition.name))
check('the events tool declares its actions', JSON.stringify(eventsTool?.parameters?.properties?.action?.enum) === JSON.stringify(['announcements', 'billboard']), eventsTool?.parameters?.properties?.action)
check('the events tool rejects a non-A-share symbol', (await eventsTool.execute({ symbol: 'hk00700' })).error?.includes('A 股'), null)
if (offline) {
  skip('announcements and billboard (network)', 'offline')
} else {
  const events = await eventsTool.execute({ symbol: '600519', action: 'announcements', limit: 3 })
  check('announcements answer for an A-share', events.items?.length > 0 && typeof events.items[0].title === 'string', events.items?.[0] ?? events.error)
  const billboard = await eventsTool.execute({ symbol: '600519', action: 'billboard', limit: 2 })
  check('the billboard answers for an A-share', Array.isArray(billboard.items), billboard.error ?? 'ok')
}
check('the tool declares an output schema', tool?.output?.schema?.properties?.quotes?.type === 'array', tool?.output?.schema)
check('the tool is concurrency safe', tool?.isConcurrencySafe() === true)
check('the tool presents a call card', tool?.presentCall({ symbols: ['600519'] })?.title?.includes('600519'), tool?.presentCall({ symbols: ['600519'] }))

const stubTool = __test.buildToolDefinition({
  defaultSymbols: () => ['sh600519'],
  getQuotes: async (symbols) => ({
    source: 'stub',
    at: 1_700_000_000_000,
    quotes: symbols.map((symbol) => ({
      symbol,
      code: symbol.slice(2),
      name: 'Stub',
      market: 'cn',
      price: 10.5,
      changePct: 1.23,
      high: 11,
      low: 10,
      extras: { totalCap: 100 },
    })),
  }),
})
const toolResult = await stubTool.execute({ symbols: ['600519'] })
check('the tool resolves a typed symbol', toolResult.quotes[0].symbol === 'sh600519' && toolResult.quotes[0].price === 10.5, toolResult)
check('the tool drops unknown spellings', (await stubTool.execute({ symbols: ['@@@'] })).quotes[0].error === 'unrecognized', null)
check('the tool falls back to the watchlist', (await stubTool.execute({})).quotes[0].symbol === 'sh600519', null)
check('the tool renders text for the model', String(stubTool.output.render({}, toolResult)[0].text).includes('sh600519'), null)

/* ----------------------------------------------------------- Client half */

const clientSource = readFileSync(join(root, 'client.js'), 'utf8')
const packageJson = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
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

check('client module id equals package name', captured?.id === packageJson.name, [captured?.id, packageJson.name])
check('client build string matches the package version', clientSource.includes(`v${packageJson.version}`), packageJson.version)
const plugin = captured.factory(factoryRequire)
check('client half injects the slot service', Array.isArray(plugin.inject) && plugin.inject.includes('slots'), plugin.inject)
check('client delegates symbol validation to the Host', !clientSource.includes('normalizeSymbolText'))
check('save request has a timeout', clientSource.includes('AbortSignal.timeout(15000)'))
check('money units come from the dictionary', clientSource.includes("t('unitYi')"))
check('client does not require anything but react', !/require\('(?!react)/.test(clientSource))

const registrations = []
const dictionaries = []
const locale = {
  register: (namespace, localeId, dict) => {
    dictionaries.push({ namespace, localeId, keys: Object.keys(dict) })
    return () => {}
  },
  bind: (namespace) => (key) => `${namespace}:${key}`,
}
let sidebarService
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
  inject: (deps, callback) => {
    if (deps.includes('betterSidebar') && sidebarService) {
      callback({
        betterSidebar: sidebarService,
        effect: (fn) => {
          const dispose = fn()
          return () => dispose?.()
        },
      })
      return { dispose() {} }
    }
    return { dispose() {} }
  },
}
plugin.apply(clientCtx)
const slots = registrations.map((registration) => registration.slot)
check('client registers the dock and one settings section', slots.length === 2, slots)
check('client targets the composer dock', slots.includes('conversation.composer.dock'), slots)
check('client registers a top-level settings section', slots.includes('settings.section'), slots)

const dockRegistration = registrations.find((registration) => registration.slot === 'conversation.composer.dock')
const dockEntry = dockRegistration.factory()
check('dock entry id and order', dockEntry?.options?.id === 'stock-ticker' && dockEntry?.options?.order === 5, [dockEntry?.options?.id, dockEntry?.options?.order])
check('dock label is a thunk', typeof dockEntry?.options?.label === 'function')
check('both dictionaries registered', ['zh', 'en'].every((id) => dictionaries.some((entry) => entry.localeId === id)), dictionaries.map((entry) => entry.localeId))
const zhKeys = dictionaries.find((entry) => entry.localeId === 'zh')?.keys ?? []
const enKeys = dictionaries.find((entry) => entry.localeId === 'en')?.keys ?? []
check('dictionaries have the same keys', zhKeys.length > 0 && JSON.stringify([...zhKeys].sort()) === JSON.stringify([...enKeys].sort()), [zhKeys.length, enKeys.length])

// The sidebar tab must only appear when the optional service exists.
registrations.length = 0
let tabOptions
sidebarService = {
  registerTab: (options) => {
    tabOptions = options
    return () => {}
  },
}
plugin.apply(clientCtx)
check('sidebar tab registers when better-sidebar exists', tabOptions?.id === 'dsh-stock-ticker:quotes' && tabOptions.single === true, tabOptions?.id)
check('sidebar tab id is namespaced', String(tabOptions?.id ?? '').startsWith('dsh-stock-ticker:'), tabOptions?.id)

check('apply survives a missing locale service', (() => {
  try {
    plugin.apply({ get: () => undefined, effect: (fn) => fn(), slots: clientCtx.slots, inject: () => ({ dispose() {} }) })
    return true
  } catch {
    return false
  }
})())

const css = clientSource.match(/const CSS = `([\s\S]*?)`/)?.[1] ?? ''
check(
  'the client claims a full-width dock row at runtime',
  clientSource.includes('claimOwnRow') &&
    clientSource.includes('display === \'contents\'') &&
    clientSource.includes('firstElementChild'),
  null,
)
check('stylesheet covers the new surfaces', ['.dshst-toast', '.dshst-results', '.dshst-settings', '.dshst-pill'].every((selector) => css.includes(selector)), css.length)

/* ----------------------------------------------------------------- report */

const failed = results.filter((result) => !result.ok)
const skipped = results.filter((result) => result.skipped)
for (const result of results) {
  if (!result.ok) console.log(`FAIL  ${result.label}  →  ${JSON.stringify(result.detail)}`)
}
console.log(`\n${results.length - failed.length}/${results.length} checks passed${skipped.length ? ` (${skipped.length} skipped)` : ''}`)
rmSync(storeDir, { recursive: true, force: true })
process.exit(failed.length === 0 ? 0 : 1)
