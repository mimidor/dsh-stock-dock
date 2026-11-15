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
