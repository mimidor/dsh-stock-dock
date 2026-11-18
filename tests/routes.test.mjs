import assert from 'node:assert/strict'
import test from 'node:test'
import { normalizeSettings } from '../lib/config.js'
import { createRouter } from '../lib/routes.js'

test('volume alerts use current-session five-minute bars for each open market', async (t) => {
  // 10:00 in Shanghai/Hong Kong, outside the US session.
  t.mock.timers.enable({ apis: ['Date'], now: new Date('2026-11-13T02:00:00Z') })
  const now = Date.now()
  const bar = (date, volume) => ({ date, volume })
  const row = (previous, latest) => ({ at: now, rows: [bar(previous, 20), bar(latest, 50)] })
  const klines = new Map([
    ['sh600519:m5:none:96', row('202611120955', '202611130955')],
    ['hk00700:m5:none:96', row('202611110955', '202611120955')],
    ['usAAPL:m5:none:96', row('202611121555', '202611131555')],
  ])
  const handler = createRouter({
    ctx: {},
    settings: normalizeSettings({}),
    cache: { klines },
    store: { snapshot: async () => ({ groups: [], activeGroup: 'default' }) },
  })
  const res = { setHeader() {}, end(body) { this.payload = JSON.parse(body) } }
  const original = globalThis.fetch
  globalThis.fetch = async () => assert.fail('the chart cache already contains the bars')
  try {
    await handler({ method: 'GET', url: '/dsh-stock-ticker/volume-alerts?symbols=sh600519,hk00700,usAAPL&pct=100', headers: {} }, res)
    assert.equal(res.statusCode, 200)
    assert.deepEqual(Object.keys(res.payload.alerts), ['sh600519'])
    assert.equal(res.payload.alerts.sh600519.pct, 150)
  } finally {
    globalThis.fetch = original
  }
})

function requestWithBody(router, body, { origin = 'http://127.0.0.1:54157', method = 'POST' } = {}) {
  const req = {
    method,
    url: '/dsh-stock-ticker/trades',
    headers: { host: '127.0.0.1:54157', origin },
    socket: { remoteAddress: '127.0.0.1' },
    async *[Symbol.asyncIterator]() {
      yield Buffer.from(JSON.stringify(body))
    },
  }
  const res = {
    statusCode: 200,
    setHeader() {},
    end(payload) {
      this.payload = payload ? JSON.parse(payload) : undefined
    },
  }
  return router(req, res).then(() => res)
}

test('applying one symbol keeps manual holdings for the other symbols', async () => {
  let state = {
    groups: [{ id: 'default', name: '自选', symbols: ['sh600519', 'hk00700'] }],
    activeGroup: 'default',
    alerts: [],
    holdings: { hk00700: { shares: 100, cost: 12.5 } },
    trades: [{ id: 't1', symbol: 'sh600519', side: 'buy', price: 10, shares: 100, fee: 0, date: '2026-11-01', createdAt: 1 }],
    prefs: {},
  }
  const store = {
    snapshot: async () => state,
    update: async (mutator) => {
      const next = mutator(state)
      if (next) state = next
      return state
    },
  }
  const router = createRouter({
    ctx: { webServer: { getOrigin: () => 'http://127.0.0.1:54157' } },
    settings: normalizeSettings({}),
    cache: { klines: new Map() },
    store,
  })
  const res = await requestWithBody(router, { action: 'apply', symbol: 'sh600519' })
  assert.equal(res.statusCode, 200)
  assert.equal(res.payload.ok, true)
  assert.deepEqual(res.payload.holdings.hk00700, { shares: 100, cost: 12.5 })
  assert.deepEqual(res.payload.holdings.sh600519, { shares: 100, cost: 10 })
})

test('cache clear rejects a foreign origin like the other write routes', async () => {
  const router = createRouter({
    ctx: { webServer: { getOrigin: () => 'http://127.0.0.1:54157' } },
    settings: normalizeSettings({}),
    cache: { klines: new Map() },
    store: { snapshot: async () => ({ groups: [], activeGroup: 'default' }) },
  })
  const req = {
    method: 'POST',
    url: '/dsh-stock-ticker/cache/clear',
    headers: { host: '127.0.0.1:54157', origin: 'http://evil.example' },
    socket: { remoteAddress: '127.0.0.1' },
    async *[Symbol.asyncIterator]() {},
  }
  const res = {
    statusCode: 200,
    setHeader() {},
    end(payload) { this.payload = JSON.parse(payload) },
  }
  await router(req, res)
  assert.equal(res.statusCode, 403)
  assert.equal(res.payload.error, 'forbidden')
})
