/**
 * Render-level tests.
 *
 * The client bundle is loaded through the same `__ModuleLoader__` contract the
 * browser uses and then actually rendered with a miniature React shim. This is
 * the only check that catches the failure mode that matters most for a slot
 * plugin: a component throwing while rendering makes the host drop the whole
 * slot, with the user seeing nothing and the console showing one line.
 */

import assert from 'node:assert/strict'
import test, { afterEach } from 'node:test'
import {
  change,
  click,
  createHarness,
  findAll,
  textOf,
} from './helpers/render-harness.mjs'

afterEach(() => {
  delete globalThis.window
  delete globalThis.document
  delete globalThis.fetch
})

/* ------------------------------------------------------------- fixtures */

function candles(count = 40) {
  return Array.from({ length: count }, (_, index) => {
    const close = 1380 + index * 3
    return {
      date: `2026-10-${String((index % 28) + 1).padStart(2, '0')}`,
      open: close - 4,
      close,
      high: close + 6,
      low: close - 7,
      volume: 20000 + index * 100,
    }
  })
}

function points(days = 1) {
  const out = []
  for (let day = 0; day < days; day += 1) {
    for (let minute = 0; minute < 240; minute += 1) {
      const price = 1400 + Math.sin(minute / 20) * 8 + day
      out.push({
        time: `${String(9 + Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`,
        day: `2026111${day}`,
        price,
        avg: price - 1,
        volume: 1000 + minute,
      })
    }
  }
  return out
}

function quote(overrides = {}) {
  return {
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
    extras: {
      turnover: 0.26,
      pe: 21.46,
      amplitude: 1.63,
      totalCap: 17629.53,
      pb: 6.5,
      limitUp: 1542.53,
      limitDown: 1262.07,
      volumeRatio: 0.91,
    },
    depth: {
      bids: [
        { price: 1410.27, volume: 17 },
        { price: 1410.22, volume: 1 },
        { price: 1410.21, volume: 4 },
        { price: 1410.19, volume: 4 },
        { price: 1410.0, volume: 1 },
      ],
      asks: [
        { price: 1410.43, volume: 2 },
        { price: 1410.45, volume: 1 },
        { price: 1410.46, volume: 1 },
        { price: 1410.5, volume: 5 },
        { price: 1410.55, volume: 1 },
      ],
      ratio: 52.3,
    },
    kline: candles(),
    alerts: [{ id: 'a1', op: 'above', price: 1500, firedAt: null }],
    holding: { shares: 100, cost: 1300 },
    ...overrides,
  }
}

function quotesPayload(overrides = {}) {
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
      showMiniChart: true,
      miniChartType: 'day',
      showOrderBook: true,
      showStats: true,
      showExtended: false,
      source: 'auto',
      defaultPeriod: 'trend',
      defaultTrendDays: 1,
      adjust: 'qfq',
      alertToast: true,
      sourceDot: true,
      symbols: ['sh600519', 'hk00700'],
    },
    groups: [{ id: 'default', name: '自选', count: 2 }],
    activeGroup: 'default',
    symbols: ['sh600519', 'hk00700'],
    quotes: [
      quote(),
      quote({
        symbol: 'hk00700',
        market: 'hk',
        name: '腾讯控股',
        code: '00700',
        price: 398.8,
        prevClose: 409.6,
        change: -10.8,
        changePct: -2.64,
        extras: undefined,
        depth: undefined,
        alerts: [],
        holding: null,
        source: 'sina',
      }),
    ],
    fired: [],
    ...overrides,
  }
}

function settingsPayload() {
  return {
    ok: true,
    settings: quotesPayload().settings,
    prefs: {
      showMA: true,
      showVolume: true,
      showMiniChart: true,
      showOrderBook: true,
      showStats: true,
      showExtended: false,
      source: 'auto',
      defaultPeriod: 'trend',
      defaultTrendDays: 1,
      adjust: 'qfq',
      alertToast: true,
      sourceDot: true,
    },
    groups: [{ id: 'default', name: '自选', symbols: ['sh600519', 'hk00700'] }],
    activeGroup: 'default',
  }
}

function makeFetch(calls, overrides = {}) {
  let quotesCalls = 0
  return async (url, init = {}) => {
    const path = String(url).replace('/dsh-stock-ticker', '')
    const method = (init.method ?? 'GET').toUpperCase()
    const body = init.body ? JSON.parse(init.body) : undefined
    calls.push({ path, method, body })
    const respond = (payload) =>
      new Response(JSON.stringify(payload), { status: 200, headers: { 'content-type': 'application/json' } })

    if (method === 'POST' && path.startsWith('/prefs')) return respond({ ok: true, prefs: {} })
    if (method === 'POST' && path.startsWith('/alerts')) return respond({ ok: true, alerts: [] })
    if (method === 'POST' && path.startsWith('/groups')) return respond({ ok: true, groups: [], activeGroup: 'default' })
    if (method === 'POST' && path.startsWith('/config')) return respond({ ok: true, symbols: ['sh600519'], persisted: 'store' })
    if (path.startsWith('/sparklines')) {
      const type = /[?&]type=([a-z]+)/.exec(path)?.[1] ?? 'day'
      if (type === 'intraday') {
        const line = (offset) => points(1)
          .filter((_, index) => index % 4 === 0)
          .map((point) => ({ time: point.time, price: point.price + offset }))
        return respond({
          ok: true,
          updatedAt: Date.now(),
          days: 40,
          type,
          etag: '"spark-line"',
          charts: {
            sh600519: { kind: 'line', prevClose: 1402.3, points: line(0) },
            hk00700: { kind: 'line', prevClose: 409.6, points: line(-10) },
          },
          rows: {},
        })
      }
      const rows = { sh600519: candles(40), hk00700: candles(40) }
      return respond({
        ok: true,
        updatedAt: Date.now(),
        days: 40,
        type,
        etag: '"spark-1"',
        charts: Object.fromEntries(Object.entries(rows).map(([symbol, list]) => [symbol, { kind: 'candles', rows: list }])),
        rows,
      })
    }
    if (path.startsWith('/trades')) {
      if (method === 'POST') return respond({ ok: true, count: 1, trades: [], positions: [], holdings: {} })
      return respond({
        ok: true,
        symbol: 'sh600519',
        count: 1,
        trades: [{ id: 't1', symbol: 'sh600519', side: 'buy', price: 1000, shares: 100, fee: 5, date: '2026-11-01' }],
        position: { shares: 100, cost: 1000.05, realized: 0 },
      })
    }
    if (path.startsWith('/quotes')) {
      if (overrides.quotesStatus && overrides.quotesStatus !== 200) {
        return new Response(JSON.stringify({ ok: false, error: 'unauthorized' }), { status: overrides.quotesStatus })
      }
      if (Array.isArray(overrides.quotesSequence)) {
        const index = Math.min(quotesCalls, overrides.quotesSequence.length - 1)
        quotesCalls += 1
        return respond(overrides.quotesSequence[index])
      }
      const payload = overrides.quotes ?? quotesPayload()
      const group = /[?&]group=([^&]+)/.exec(path)?.[1]
      return respond(group ? { ...payload, activeGroup: decodeURIComponent(group) } : payload)
    }
    if (path.startsWith('/settings')) return respond(settingsPayload())
    if (path.startsWith('/kline')) return respond({ ok: true, symbol: 'sh600519', period: 'day', adjust: 'qfq', rows: candles(40), source: 'tencent' })
    if (path.startsWith('/trend')) {
      const days = /days=(\d+)/.exec(path)?.[1]
      const baseline = Array.isArray(overrides.trendBaseline) ? overrides.trendBaseline : []
      return respond({
        ok: true,
        symbol: 'sh600519',
        market: 'cn',
        days: [`2026111${days}`],
        prevClose: 1402.3,
        points: points(Number(days ?? 1)),
        baseline,
        baselineDays: baseline.length > 0 ? 1 : 0,
      })
    }
    if (path.startsWith('/search')) {
      return respond({
        ok: true,
        items: [{ symbol: 'sh600036', code: '600036', name: '招商银行', market: 'cn', type: '沪A', source: 'eastmoney' }],
      })
    }
    return respond({ ok: false, error: `unexpected ${path}` })
  }
}

function boot(options = {}) {
  const calls = []
  const harness = createHarness({
    fetchImpl: makeFetch(calls, options),
    metrics: options.metrics,
    contentsWrappers: options.contentsWrappers,
  })
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
      register: (slotOptions, component) => ({ options: slotOptions, component }),
    },
    inject: () => ({ dispose() {} }),
  }
  const plugin = definition.factory((name) => {
    if (name === 'react') return harness.React
    throw new Error(`unexpected require(${name})`)
  })
  plugin.apply(ctx)
  const dock = registrations.find((registration) => registration.slot === 'conversation.composer.dock').factory()
  return { harness, calls, plugin, dictionaries, registrations, component: dock.component, t: (key) => dictionaries.zh?.[key] ?? key }
}

const hasClass = (element, className) => String(element.props?.className ?? '').split(/\s+/).includes(className)

/* ----------------------------------------------------------------- tests */

test('the strip renders quotes without throwing', async () => {
  const { harness, component, t, calls } = boot()
  harness.mount(component, { t })
  const rendered = await harness.settle()
  const text = textOf(rendered)

  assert.match(text, /贵州茅台/)
  assert.match(text, /腾讯控股/)
  assert.match(text, /1410\.27/)
  assert.match(text, /\+0\.57%/)
  assert.match(text, /-2\.64%/)
  assert.match(text, /盘中/)
  assert.ok(calls.some((call) => call.path.startsWith('/quotes')))
  assert.equal(findAll(rendered, (element) => hasClass(element, 'dshst-card')).length, 2)
})

test('a card click opens the detail panel with every period and the order book', async () => {
  const { harness, component, t, calls } = boot()
  harness.mount(component, { t })
  let tree = await harness.settle()

  const card = findAll(tree, (element) => hasClass(element, 'dshst-card') && textOf(element).includes('贵州茅台'))[0]
  assert.ok(card, 'the quote card is clickable')
  click(card)
  tree = await harness.settle()
  const text = textOf(tree)

  assert.match(text, /五档盘口/)
  assert.match(text, /分时/)
  assert.match(text, /15分/)
  assert.match(text, /30分/)
  assert.match(text, /60分/)
  assert.match(text, /持仓/)
  assert.ok(calls.some((call) => call.path.startsWith('/trend?symbol=sh600519')), 'the intraday line is fetched')
})

test('period tabs, adjust selection and the MA toggle reach the host', async () => {
  const { harness, component, t, calls } = boot()
  harness.mount(component, { t })
  let tree = await harness.settle()
  click(findAll(tree, (element) => hasClass(element, 'dshst-card') && textOf(element).includes('贵州茅台'))[0])
  tree = await harness.settle()

  const dayTab = findAll(tree, (element) => element.tag === 'button' && hasClass(element, 'dshst-tab') && textOf(element) === '日K')[0]
  assert.ok(dayTab, 'the daily tab exists')
  click(dayTab)
  tree = await harness.settle()
  assert.ok(calls.some((call) => call.path.includes('period=day')), 'the daily K-line is fetched')

  const maToggle = findAll(tree, (element) => element.tag === 'button' && textOf(element) === '均线')[0]
  assert.ok(maToggle, 'the MA toggle exists on a K-line tab')
  click(maToggle)
  tree = await harness.settle()
  const prefsCall = calls.filter((call) => call.method === 'POST' && call.path === '/prefs').at(-1)
  assert.equal(prefsCall.body.patch.showMA, false)

  const select = findAll(tree, (element) => element.tag === 'select' && element.props['aria-label'] === '复权')[0]
  assert.ok(select, 'the adjust selector exists')
  change(select, 'hfq')
  tree = await harness.settle()
  assert.ok(calls.some((call) => call.path.includes('adjust=hfq')), 'the backward-adjusted K-line is fetched')
})

test('the intraday day selector asks for three and five days', async () => {
  const { harness, component, t, calls } = boot()
  harness.mount(component, { t })
  let tree = await harness.settle()
  click(findAll(tree, (element) => hasClass(element, 'dshst-card') && textOf(element).includes('贵州茅台'))[0])
  tree = await harness.settle()

  const threeDays = findAll(tree, (element) => element.tag === 'button' && textOf(element) === '3日')[0]
  assert.ok(threeDays, 'the 3-day button exists on the intraday tab')
  click(threeDays)
  tree = await harness.settle()
  assert.ok(calls.some((call) => call.path.includes('days=3')), 'three days of intraday are fetched')
})

test('a price alert can be added from the detail panel', async () => {
  const { harness, component, t, calls } = boot()
  harness.mount(component, { t })
  let tree = await harness.settle()
  click(findAll(tree, (element) => hasClass(element, 'dshst-card') && textOf(element).includes('贵州茅台'))[0])
  tree = await harness.settle()

  const alertButton = findAll(tree, (element) => element.tag === 'button' && textOf(element).startsWith('预警'))[0]
  assert.ok(alertButton, 'the alert toggle exists')
  click(alertButton)
  tree = await harness.settle()

  const priceInput = findAll(tree, (element) => element.tag === 'input' && element.props['aria-label'] === '价格')[0]
  assert.ok(priceInput, 'the alert price input exists')
  change(priceInput, '1600')
  tree = await harness.settle()

  const addButton = findAll(tree, (element) => element.tag === 'button' && textOf(element) === '添加预警')[0]
  assert.ok(addButton, 'the add-alert button exists')
  click(addButton)
  tree = await harness.settle()

  const alertCall = calls.filter((call) => call.method === 'POST' && call.path === '/alerts').at(-1)
  assert.deepEqual(alertCall.body, { action: 'save', symbol: 'sh600519', op: 'above', price: 1600 })
})

test('a fired alert shows a toast that can be acknowledged', async () => {
  const fired = { id: 'a9', symbol: 'sh600519', name: '贵州茅台', op: 'above', price: 1400, current: 1410.27, at: 1 }
  const { harness, component, t, calls } = boot({ quotes: quotesPayload({ fired: [fired] }) })
  harness.mount(component, { t })
  const tree = await harness.settle()
  const text = textOf(tree)
  assert.match(text, /触发预警/)

  const ackButton = findAll(tree, (element) => element.tag === 'button' && textOf(element) === '知道了')[0]
  assert.ok(ackButton, 'the acknowledgement button exists')
  click(ackButton)
  await harness.settle()
  assert.ok(calls.some((call) => call.method === 'POST' && call.path === '/alerts' && call.body.action === 'ack'))
})

test('symbols can be found by search and saved', async () => {
  const { harness, component, t, calls } = boot()
  harness.mount(component, { t })
  let tree = await harness.settle()

  const settingsButton = findAll(tree, (element) => element.props?.title === '配置标的')[0]
  assert.ok(settingsButton, 'the settings button exists')
  click(settingsButton)
  tree = await harness.settle()

  const searchInput = findAll(tree, (element) => element.tag === 'input' && element.props['aria-label'] === '搜索')[0]
  assert.ok(searchInput, 'the search box exists in the form')
  change(searchInput, '招商')
  tree = await harness.flushTimers(400)
  assert.ok(calls.some((call) => call.path.startsWith('/search?q=')), 'search is requested after the debounce')

  const result = findAll(tree, (element) => element.tag === 'button' && hasClass(element, 'dshst-result'))[0]
  assert.ok(result, 'search results render')
  click(result)
  tree = await harness.settle()

  const textarea = findAll(tree, (element) => element.tag === 'textarea')[0]
  assert.match(textarea.props.value, /sh600036/)

  const saveButton = findAll(tree, (element) => element.tag === 'button' && textOf(element) === '保存')[0]
  assert.ok(saveButton, 'the save button exists')
  click(saveButton)
  tree = await harness.settle()
  const configCall = calls.filter((call) => call.method === 'POST' && call.path === '/config').at(-1)
  assert.ok(configCall.body.symbols.includes('sh600036'))
})

test('the settings card renders and writes preferences', async () => {
  const { harness, registrations, t } = boot()
  const settingsRegistration = registrations.find((registration) => registration.slot === 'settings.section')
  assert.ok(settingsRegistration, 'the settings section is registered')
  const component = settingsRegistration.factory().component
  harness.mount(component, { t })
  const tree = await harness.settle()
  const text = textOf(tree)
  assert.match(text, /刷新间隔/)
  assert.match(text, /显示均线/)
  assert.match(text, /分组/)
  assert.match(text, /行情条/, 'the section renders its own heading')
})

test('mini charts are fetched separately from the quote poll', async () => {
  const { harness, component, t, calls } = boot()
  harness.mount(component, { t })
  await harness.settle()
  assert.ok(calls.some((call) => call.path.startsWith('/sparklines')), 'sparklines are requested once')
  const quoteCall = calls.find((call) => call.path.startsWith('/quotes'))
  assert.ok(!/sparklines=1/.test(quoteCall.path), 'the poll does not ask for K-lines')
})

test('the stylesheet is appended once for both surfaces', async () => {
  const { harness, component, registrations, t } = boot()
  harness.mount(component, { t })
  await harness.settle()
  const settings = registrations.find((registration) => registration.slot === 'settings.section')
  harness.mount(settings.factory().component, { t })
  await harness.settle()
  assert.equal(harness.styles.length, 1, 'the style tag is injected once, not per mounting component')
  assert.equal(harness.styles[0].attributes['data-plugin-css'], 'stock-ticker')
})

test('a 401 from a restarted host reads as a host problem, not an HTTP code', async () => {
  const { harness, component, t } = boot({ quotesStatus: 401 })
  harness.mount(component, { t })
  const tree = await harness.settle()
  const text = textOf(tree)
  assert.match(text, /行情服务未加载/)
  assert.doesNotMatch(text, /401/)
})

test('a card can be removed from the strip', async () => {
  const { harness, component, t, calls } = boot()
  harness.mount(component, { t })
  let tree = await harness.settle()
  const remove = findAll(tree, (element) => hasClass(element, 'dshst-cardRemove'))[0]
  assert.ok(remove, 'the remove button exists on a card')
  click(remove)
  tree = await harness.settle()
  const configCall = calls.filter((call) => call.method === 'POST' && call.path === '/config').at(-1)
  assert.ok(configCall, 'removing a card saves the symbol list')
  assert.deepEqual(configCall.body.symbols, ['hk00700'])
})

test('cards can be dragged into a new order', async () => {
  const { harness, component, t, calls } = boot()
  harness.mount(component, { t })
  let tree = await harness.settle()
  const cards = findAll(tree, (element) => hasClass(element, 'dshst-card'))
  assert.equal(cards.length, 2)
  const transfer = {
    data: {},
    setData(key, value) {
      this.data[key] = value
    },
    getData(key) {
      return this.data[key]
    },
    effectAllowed: '',
    dropEffect: '',
  }
  cards[0].props.onDragStart({ dataTransfer: transfer })
  const target = findAll(tree, (element) => hasClass(element, 'dshst-card'))[1]
  target.props.onDrop({ dataTransfer: transfer, preventDefault() {}, stopPropagation() {} })
  tree = await harness.settle()
  const configCall = calls.filter((call) => call.method === 'POST' && call.path === '/config').at(-1)
  assert.deepEqual(configCall.body.symbols, ['hk00700', 'sh600519'])
})

test('the trade ledger opens from the detail panel', async () => {
  const { harness, component, t, calls } = boot()
  harness.mount(component, { t })
  let tree = await harness.settle()
  click(findAll(tree, (element) => hasClass(element, 'dshst-card') && textOf(element).includes('贵州茅台'))[0])
  tree = await harness.settle()
  const tradesToggle = findAll(tree, (element) => element.tag === 'button' && textOf(element).startsWith('流水'))[0]
  assert.ok(tradesToggle, 'the trade toggle exists')
  click(tradesToggle)
  tree = await harness.settle()
  assert.ok(calls.some((call) => call.path.startsWith('/trades?symbol=')), 'the ledger is fetched')
  assert.match(textOf(tree), /买入/)
})

test('the header gear opens the settings panel inside the strip', async () => {
  const { harness, component, t } = boot()
  harness.mount(component, { t })
  let tree = await harness.settle()
  const gear = findAll(tree, (element) => element.tag === 'button' && element.props.title === '行情条')[0]
  assert.ok(gear, 'the settings button exists in the strip header')
  click(gear)
  tree = await harness.settle()
  const text = textOf(tree)
  assert.match(text, /数据源/)
  assert.match(text, /显示迷你图/)
  assert.match(text, /显示美股盘前/)
})

test('the settings panel switches the data source and the visibility toggles', async () => {
  const { harness, component, t, calls } = boot()
  harness.mount(component, { t })
  let tree = await harness.settle()
  click(findAll(tree, (element) => element.tag === 'button' && element.props.title === '行情条')[0])
  tree = await harness.settle()

  const select = findAll(tree, (element) => element.tag === 'select' && element.props['aria-label'] === '数据源')[0]
  assert.ok(select, 'the data source select exists')
  change(select, 'sina')
  tree = await harness.settle()
  const sourceCall = calls.filter((call) => call.method === 'POST' && call.path === '/prefs').at(-1)
  assert.deepEqual(sourceCall.body.patch, { source: 'sina' })

  const miniType = findAll(tree, (element) => element.tag === 'select' && element.props['aria-label'] === '迷你图类型')[0]
  assert.ok(miniType, 'the mini chart type select exists')
  change(miniType, 'intraday')
  tree = await harness.settle()
  const miniCall = calls.filter((call) => call.method === 'POST' && call.path === '/prefs').at(-1)
  assert.deepEqual(miniCall.body.patch, { miniChartType: 'intraday' })

  const orderBookToggle = findAll(tree, (element) => element.tag === 'input' && element.props['aria-label'] === '显示五档盘口')[0]
  assert.ok(orderBookToggle, 'the order book toggle exists')
  orderBookToggle.props.onChange({ target: { checked: false } })
  tree = await harness.settle()
  const toggleCall = calls.filter((call) => call.method === 'POST' && call.path === '/prefs').at(-1)
  assert.deepEqual(toggleCall.body.patch, { showOrderBook: false })
})

test('US pre/post market prices render when the preference is on', async () => {
  const payload = quotesPayload({ settings: { ...quotesPayload().settings, showExtended: true } })
  payload.quotes[1] = {
    ...payload.quotes[1],
    market: 'us',
    symbol: 'usAAPL',
    name: '苹果',
    extended: { price: 356.71, changePct: 0.38, change: 1.35, time: 'Nov 12 08:43AM EST', session: 'pre' },
  }
  const { harness, component, t } = boot({ quotes: payload })
  harness.mount(component, { t })
  const tree = await harness.settle()
  const chip = findAll(tree, (element) => hasClass(element, 'dshst-ext'))[0]
  assert.ok(chip, 'the extended-hours chip is on the card')
  assert.match(textOf(chip), /前/)
  assert.match(textOf(chip), /\+0\.38%/)
  assert.match(chip.props.title, /盘前/, 'the full session label stays in the tooltip')
})

const wheel = (target, overrides = {}) => ({
  deltaY: 0,
  deltaX: 0,
  deltaMode: 0,
  target,
  preventDefault() {
    this.defaultPrevented = true
  },
  ...overrides,
})
const stripElement = (harness) =>
  harness.findElement((element) => String(element.props?.className ?? '').includes('dshst-strip'))

test('a vertical wheel over the strip scrolls it horizontally', async () => {
  const { harness, component, t } = boot()
  harness.mount(component, { t })
  await harness.settle()
  const strip = stripElement(harness)
  assert.ok(strip, 'the strip element is mounted')
  const event = wheel(strip, { deltaY: 120 })
  harness.dispatchWindow('wheel', event)
  assert.equal(strip.scrollLeft, 120)
  assert.equal(event.defaultPrevented, true)
})

test('a strip that fits leaves the wheel to the page', async () => {
  const { harness, component, t } = boot({ metrics: { scrollWidth: 600, clientWidth: 600 } })
  harness.mount(component, { t })
  await harness.settle()
  const strip = stripElement(harness)
  const event = wheel(strip, { deltaY: 120 })
  harness.dispatchWindow('wheel', event)
  assert.equal(strip.scrollLeft, 0)
  assert.notEqual(event.defaultPrevented, true)
})

test('a wheel outside the strip is ignored', async () => {
  const { harness, component, t } = boot()
  harness.mount(component, { t })
  await harness.settle()
  const strip = stripElement(harness)
  const outside = { tag: 'div', props: {}, children: null, contains: () => false }
  const event = wheel(outside, { deltaY: 120 })
  harness.dispatchWindow('wheel', event)
  assert.equal(strip.scrollLeft, 0)
  assert.notEqual(event.defaultPrevented, true)
})

test('a horizontal trackpad swipe scrolls the strip', async () => {
  const { harness, component, t } = boot()
  harness.mount(component, { t })
  await harness.settle()
  const strip = stripElement(harness)
  const event = wheel(strip, { deltaX: 120, deltaY: 4 })
  harness.dispatchWindow('wheel', event)
  assert.equal(strip.scrollLeft, 120)
  assert.equal(event.defaultPrevented, true)
})

test('the wheel keeps working after the settings panel remounts the strip', async () => {
  const { harness, component, t } = boot()
  harness.mount(component, { t })
  let tree = await harness.settle()
  const gear = findAll(tree, (element) => element.tag === 'button' && element.props.title === '行情条')[0]
  click(gear)
  tree = await harness.settle()
  assert.equal(
    findAll(tree, (element) => String(element.props?.className ?? '').includes('dshst-strip')).length,
    0,
    'the strip is unmounted while the panel is open',
  )
  click(findAll(tree, (element) => element.tag === 'button' && element.props.title === '行情条')[0])
  tree = await harness.settle()
  const strip = stripElement(harness)
  const event = wheel(strip, { deltaY: 90 })
  harness.dispatchWindow('wheel', event)
  assert.equal(strip.scrollLeft, 90)
})

test('the strip claims its own dock row through the shared display:contents outlet', async () => {
  const { harness, component, t } = boot()
  harness.mount(component, { t })
  await harness.settle()
  const root = harness.findElement((element) => element.props?.['data-variant'] === 'dock')
  assert.ok(root, 'the component root is mounted')
  const dock = root.__dock
  const outlet = root.__outlet
  assert.equal(outlet.__computed.display, 'contents', 'DSH inserts a display:contents outlet')
  assert.equal(dock.style.flexWrap, 'wrap', 'the dock row is allowed to wrap')
  assert.equal(root.style.order, '99')
  assert.equal(root.style.flex, '0 0 100%')
  // The outlet is shared by every list entry (DSH's stats pills register
  // first); the row must be claimed for our root, never for a sibling.
  assert.equal(root.__pill.style.order, '', 'a co-located native pill keeps its order')
  assert.equal(root.__pill.style.flex, '', 'a co-located native pill keeps its flex')
})

test('the row claim skips nested display:contents outlet layers', async () => {
  const { harness, component, t } = boot({ contentsWrappers: 2 })
  harness.mount(component, { t })
  await harness.settle()
  const root = harness.findElement((element) => element.props?.['data-variant'] === 'dock')
  assert.ok(root, 'the component root is mounted')
  assert.equal(root.__wrappers.length, 2, 'the fixture nests two addressable wrappers')
  assert.equal(root.__dock.style.flexWrap, 'wrap')
  assert.equal(root.style.order, '99', 'the root, not an outer wrapper, becomes the item')
  assert.equal(root.style.flex, '0 0 100%')
  assert.equal(root.__wrappers[0].style.order, '', 'the wrapper stays layout-neutral')
  assert.equal(root.__pill.style.order, '', 'the sibling pill stays put')
})

test('the refresh button reports an in-flight poll', async () => {
  const { harness, component, t } = boot()
  harness.mount(component, { t })
  let tree = await harness.settle()
  const refreshButton = (rendered) => findAll(rendered, (element) =>
    element.tag === 'button' && String(element.props?.className ?? '').split(/\s+/).includes('dshst-refresh'))[0]
  const button = refreshButton(tree)
  assert.ok(button, 'the refresh button is rendered')
  assert.equal(button.props['data-busy'], 'true', 'the indicator starts with the fetch')
  await harness.flushTimers(1000)
  tree = harness.getTree()
  assert.equal(refreshButton(tree).props['data-busy'], 'false', 'the indicator clears after the hold')
})

test('a changed quote remounts the price block so its flash replays', async () => {
  const first = quotesPayload()
  const second = quotesPayload({
    quotes: [quote({ price: 1420.5, change: 18.2, changePct: 1.3 }), first.quotes[1]],
  })
  const { harness, component, t } = boot({ quotesSequence: [first, second] })
  harness.mount(component, { t })
  let tree = await harness.settle()
  const quoteKeys = (rendered) => findAll(rendered, (element) =>
    String(element.props?.className ?? '').split(/\s+/).includes('dshst-quote')).map((element) => element.props.key)
  const before = quoteKeys(tree)
  assert.equal(before.length, 2, 'both cards expose a keyed price block')
  // The poll (not the manual button) is the value-change path.
  await harness.flushIntervals(20_000)
  tree = harness.getTree()
  const after = quoteKeys(tree)
  assert.notEqual(after[0], before[0], 'the changed price gets a fresh key and replays the flash')
  assert.equal(after[1], before[1], 'an unchanged price keeps its key, so it does not blink')
})

test('a manual refresh pulses every price block even when values do not change', async () => {
  const { harness, component, t } = boot()
  harness.mount(component, { t })
  let tree = await harness.settle()
  const quoteKeys = (rendered) => findAll(rendered, (element) =>
    String(element.props?.className ?? '').split(/\s+/).includes('dshst-quote')).map((element) => element.props.key)
  const before = quoteKeys(tree)
  const button = findAll(tree, (element) =>
    element.tag === 'button' && String(element.props?.className ?? '').split(/\s+/).includes('dshst-refresh'))[0]
  click(button)
  tree = await harness.settle()
  const after = quoteKeys(tree)
  assert.equal(after.length, before.length)
  assert.ok(after.every((key, index) => key !== before[index]), 'every card acknowledges the manual refresh')
})

test('the one-day intraday chart overlays the previous session volume baseline', async () => {
  const baseline = points(1).map((point, index) => ({ time: point.time, volume: (1000 + index) / 2 }))
  const { harness, component, t, calls } = boot({ trendBaseline: baseline })
  harness.mount(component, { t })
  let tree = await harness.settle()
  click(findAll(tree, (element) => hasClass(element, 'dshst-card') && textOf(element).includes('贵州茅台'))[0])
  tree = await harness.settle()

  assert.ok(calls.some((call) => call.path.includes('days=1') && call.path.includes('baseline=1')), 'the chart asks for the comparison')
  const text = textOf(tree)
  assert.match(text, /同期量比/)
  assert.match(text, /昨日同期量/)
  assert.match(text, /放量 ↑/, 'a ratio above one is labelled as expanding volume')
  const dashed = findAll(tree, (element) =>
    element.tag === 'path' && element.props.style?.strokeDasharray === '2 3')
  assert.ok(dashed.length > 0, 'the dashed previous-session baseline is drawn')
})

test('the custom scroll track appears only while the strip overflows', async () => {
  const wide = boot()
  wide.harness.mount(wide.component, { t: wide.t })
  let tree = await wide.harness.settle()
  assert.ok(
    findAll(tree, (element) => hasClass(element, 'dshst-scrollTrack')).length > 0,
    'an overflowing strip shows the scroll affordance',
  )

  const fits = boot({ metrics: { scrollWidth: 600, clientWidth: 600 } })
  fits.harness.mount(fits.component, { t: fits.t })
  tree = await fits.harness.settle()
  assert.equal(
    findAll(tree, (element) => hasClass(element, 'dshst-scrollTrack')).length,
    0,
    'a strip that fits stays free of a dead scrollbar',
  )
})

test('the strip node itself handles a wheel event, not only the window', async () => {
  const { harness, component, t } = boot()
  harness.mount(component, { t })
  await harness.settle()
  const strip = stripElement(harness)
  const event = wheel(strip, { deltaX: 90 })
  strip.dispatch('wheel', event)
  assert.equal(strip.scrollLeft, 90)
  assert.equal(event.defaultPrevented, true)
  // The same event must not be scrolled again by the window capture listener.
  harness.dispatchWindow('wheel', event)
  assert.equal(strip.scrollLeft, 90)
})

test('the mini chart follows the configured type', async () => {
  const payload = quotesPayload()
  payload.settings = { ...payload.settings, miniChartType: 'intraday' }
  const { harness, component, t, calls } = boot({ quotes: payload })
  harness.mount(component, { t })
  const tree = await harness.settle()
  assert.ok(calls.some((call) => call.path.includes('/sparklines') && call.path.includes('type=intraday')))
  assert.equal(
    findAll(tree, (element) => hasClass(element, 'dshst-miniLine')).length,
    2,
    'both cards draw the intraday line',
  )
})

test('the header switches the card mini chart type', async () => {
  const { harness, component, t, calls } = boot()
  harness.mount(component, { t })
  let tree = await harness.settle()
  const picker = () => findAll(
    tree,
    (element) => element.tag === 'button' && hasClass(element, 'dshst-pill') && textOf(element) === '分时线',
  )[0]
  assert.ok(picker(), 'the header exposes the intraday pill')
  assert.equal(picker().props['data-active'], 'false', 'daily is the default')
  click(picker())
  tree = await harness.settle()
  const prefCall = calls.filter((call) => call.method === 'POST' && call.path === '/prefs').at(-1)
  assert.deepEqual(prefCall.body.patch, { miniChartType: 'intraday' })
  assert.ok(calls.some((call) => call.path.includes('/sparklines') && call.path.includes('type=intraday')))
  assert.equal(picker().props['data-active'], 'true')
})

test('hovering an intraday point reports its volume versus yesterday', async () => {
  const baseline = points(1).map((point, index) => ({ time: point.time, volume: (1000 + index) / 2 }))
  const { harness, component, t } = boot({ trendBaseline: baseline })
  harness.mount(component, { t })
  let tree = await harness.settle()
  click(findAll(tree, (element) => hasClass(element, 'dshst-card') && textOf(element).includes('贵州茅台'))[0])
  tree = await harness.settle()
  const detail = findAll(tree, (element) => hasClass(element, 'dshst-detail'))[0]
  const chart = findAll(detail, (element) => element.tag === 'svg' && hasClass(element, 'dshst-chart'))[0]
  assert.ok(chart, 'the intraday chart is mounted')
  chart.props.onMouseMove({ clientX: 300, currentTarget: chart })
  tree = await harness.settle()
  const readout = findAll(tree, (element) => hasClass(element, 'dshst-readout'))[0]
  assert.ok(readout, 'the hover readout is visible')
  const text = textOf(readout)
  assert.match(text, /放量/)
  assert.match(text, /昨/)
})

test('switching a group highlights it and loads that group immediately', async () => {
  const payload = quotesPayload()
  payload.activeGroup = 'default'
  payload.groups = [
    { id: 'default', name: '自选', count: 2 },
    { id: 'market', name: '大盘', count: 1 },
  ]
  const { harness, component, t, calls } = boot({ quotes: payload })
  harness.mount(component, { t })
  let tree = await harness.settle()
  const market = () => findAll(
    tree,
    (element) => element.tag === 'button' && hasClass(element, 'dshst-pill') && textOf(element) === '大盘 1',
  )[0]
  assert.ok(market(), 'the second group pill is rendered')
  click(market())
  tree = await harness.settle()
  const activate = calls.find((call) => call.method === 'POST' && call.path === '/groups' && call.body?.action === 'activate')
  assert.equal(activate.body.id, 'market')
  assert.ok(
    calls.some((call) => call.path.includes('/quotes') && call.path.includes('group=market')),
    'the quote request names the selected group',
  )
  assert.equal(market().props['data-active'], 'true')
})
