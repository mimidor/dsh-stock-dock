/**
 * Unit tests for the pure logic: alert firing rules, preference merging,
 * holiday detection and the tool definition the model sees.
 */

import assert from 'node:assert/strict'
import test from 'node:test'
import {
  evaluateAlerts,
  normalizeAlert,
  rearmAlert,
} from '../lib/alerts.js'
import { normalizeMaPeriods, normalizePrefs, normalizeSettings, publicSettings } from '../lib/config.js'
import { extendedWindow, freshnessByMarket, marketState, parseQuoteDate, sessionFor } from '../lib/session.js'
import { isIndexSymbol, normalizeSymbol, parseSymbols } from '../lib/symbols.js'
import { buildToolDefinition } from '../lib/tool.js'

test('an alert fires in the declared direction only', () => {
  const alerts = [
    { id: 'up', symbol: 'sh600519', op: 'above', price: 1500, firedAt: null },
    { id: 'down', symbol: 'sh600519', op: 'below', price: 1200, firedAt: null },
  ]
  const fired = evaluateAlerts(alerts, [{ symbol: 'sh600519', price: 1410.27, name: '贵州茅台' }], 1)
  assert.deepEqual(fired, [])
  const hits = evaluateAlerts(alerts, [{ symbol: 'sh600519', price: 1600, name: '贵州茅台' }], 2)
  assert.deepEqual(hits.map((hit) => hit.id), ['up'])
  assert.equal(alerts[0].firedAt, 2)
  assert.equal(alerts[1].firedAt, null)
})

test('a fired alert stays quiet until acknowledged and flipped', () => {
  const alerts = [{ id: 'a', symbol: 'sh600519', op: 'above', price: 1500, firedAt: null }]
  const high = [{ symbol: 'sh600519', price: 1600 }]
  const low = [{ symbol: 'sh600519', price: 1400 }]
  assert.equal(evaluateAlerts(alerts, high, 1).length, 1)
  assert.equal(evaluateAlerts(alerts, high, 2).length, 0, 'no repeat while fired')
  rearmAlert(alerts, 'a', 3)
  assert.equal(evaluateAlerts(alerts, high, 4).length, 0, 'a price parked at the line must not re-fire')
  assert.equal(evaluateAlerts(alerts, low, 5).length, 0, 'crossing back only disarms the mute')
  assert.equal(evaluateAlerts(alerts, high, 6).length, 1, 'the next crossing fires again')
})

test('alert normalization rejects nonsense and trims prices', () => {
  assert.equal(normalizeAlert({ symbol: 'sh600519', op: 'sideways', price: 1 }), undefined)
  assert.equal(normalizeAlert({ symbol: 'sh600519', op: 'above', price: 0 }), undefined)
  assert.equal(normalizeAlert({ symbol: '', op: 'above', price: 1 }), undefined)
  const alert = normalizeAlert({ symbol: 'sh600519', op: 'below', price: 1.23456 })
  assert.equal(alert.price, 1.235)
  assert.equal(alert.firedAt, null)
})

test('display preferences default on and validate the source', () => {
  const prefs = normalizePrefs({})
  assert.equal(prefs.showMiniChart, true)
  assert.equal(prefs.showOrderBook, true)
  assert.equal(prefs.showStats, true)
  assert.equal(prefs.showExtended, false, 'extended hours are opt-in')
  assert.equal(prefs.source, 'auto')
  assert.equal(normalizePrefs({ source: 'bloomberg' }).source, 'auto')
  assert.equal(normalizePrefs({ source: 'sina' }).source, 'sina')
  assert.equal(normalizePrefs({ showMiniChart: false }).showMiniChart, false)
  assert.equal(normalizePrefs({ showExtended: true }).showExtended, true)
})

test('prefs override the config only when actually set', () => {
  const settings = normalizeSettings({ symbols: ['600519'], refreshSeconds: 15, klineDays: 40, colorMode: 'cn' })
  const defaults = publicSettings(settings, {})
  assert.equal(defaults.refreshSeconds, 15)
  assert.equal(defaults.colorMode, 'cn')
  const overridden = publicSettings(settings, { refreshSeconds: 30, colorMode: 'intl', defaultPeriod: 'week' })
  assert.equal(overridden.refreshSeconds, 30)
  assert.equal(overridden.colorMode, 'intl')
  assert.equal(overridden.defaultPeriod, 'week')
  const invalid = normalizePrefs({ refreshSeconds: 10_000, defaultPeriod: 'decade' })
  assert.equal(invalid.refreshSeconds, 300)
  assert.equal(invalid.defaultPeriod, 'trend')
})

test('settings clamp their ranges', () => {
  const settings = normalizeSettings({ refreshSeconds: 1, klineDays: 1000, symbols: [] })
  assert.equal(settings.refreshSeconds, 5)
  assert.equal(settings.klineDays, 120)
  assert.ok(settings.symbols.length > 0, 'an empty list falls back to the defaults')
})

test('holidays are inferred from stale quote timestamps', () => {
  assert.equal(parseQuoteDate('20261112150000'), '2026-11-12')
  assert.equal(parseQuoteDate('2026/11/12 15:00:00'), '2026-11-12')
  const now = new Date('2026-11-12T02:00:00Z') // 10:00 in Shanghai
  assert.equal(marketState('cn', { minutes: 600, weekday: 'Thu', weekend: false }), 'trading')
  const fresh = sessionFor(['sh600519'], 15, [{ symbol: 'sh600519', market: 'cn', time: '20261112100000' }], now)
  assert.equal(fresh.mode, 'trading')
  const stale = sessionFor(['sh600519'], 15, [{ symbol: 'sh600519', market: 'cn', time: '20261111150000' }], now)
  assert.equal(stale.mode, 'closed')
  assert.equal(stale.holiday, true)
  assert.ok(stale.intervalMs >= 60_000)
  assert.deepEqual(freshnessByMarket([{ symbol: 'sh600519', market: 'cn', time: '20261112100000' }], now), { cn: 'fresh' })
})

test('the US extended windows are only reported while they run', () => {
  const at = (iso) => new Date(iso)
  assert.equal(extendedWindow('us', at('2026-11-12T13:30:00Z')), 'pre') // 08:30 EST
  assert.equal(extendedWindow('us', at('2026-11-12T15:00:00Z')), undefined) // 10:00 EST, regular
  assert.equal(extendedWindow('us', at('2026-11-12T21:30:00Z')), 'post') // 16:30 EST
  assert.equal(extendedWindow('us', at('2026-11-12T23:30:00Z')), 'post') // 18:30 EST
  assert.equal(extendedWindow('us', at('2026-11-13T01:30:00Z')), undefined) // 20:30 EST
  assert.equal(extendedWindow('cn', at('2026-11-12T13:30:00Z')), undefined)
})

test('symbol normalization keeps the documented spellings', () => {
  const cases = [
    ['600519.SH', 'sh600519'],
    ['00700.HK', 'hk00700'],
    ['AAPL.US', 'usAAPL'],
    ['brk-b', 'usBRK-B'],
    ['430047', 'bj430047'],
    ['110038', 'sh110038'],
    ['000001', 'sz000001'],
    ['hk700', 'hk00700'],
    ['sh600519.foo', undefined],
  ]
  for (const [raw, expected] of cases) assert.equal(normalizeSymbol(raw), expected, raw)
  const parsed = parseSymbols(['600519', '600519', '@@@', 'AAPL'])
  assert.deepEqual(parsed.symbols, ['sh600519', 'usAAPL'])
  assert.deepEqual(parsed.rejected, ['@@@'])
})

test('the tool definition is registry shaped', async () => {
  const definition = buildToolDefinition({
    defaultSymbols: () => ['sh600519'],
    getQuotes: async (symbols) => ({
      source: 'stub',
      at: 1_700_000_000_000,
      quotes: symbols.map((symbol) => ({ symbol, code: '600519', name: 'Stub', market: 'cn', price: 10 })),
    }),
  })
  assert.equal(definition.name, 'stock_quote')
  assert.equal(definition.parameters.type, 'object')
  assert.equal(definition.output.schema.type, 'object')
  assert.equal(definition.isConcurrencySafe(), true)
  assert.match(definition.presentCall({ symbols: ['600519'] }).title, /600519/)

  const result = await definition.execute({ symbols: ['600519', '@@@'] })
  assert.equal(result.quotes[0].symbol, 'sh600519')
  assert.equal(result.quotes[1].error, 'unrecognized')
  assert.match(definition.output.render({}, result)[0].text, /sh600519/)

  const fromWatchlist = await definition.execute({})
  assert.equal(fromWatchlist.quotes[0].symbol, 'sh600519')
})

test('index symbols are told apart from stocks and ETFs', () => {
  for (const symbol of ['sh000001', 'sh000688', 'sz399001', 'sz399006', 'hkHSI', 'hkHSCEI', 'hkHSTECH']) {
    assert.equal(isIndexSymbol(symbol), true, symbol)
  }
  for (const symbol of ['sh600519', 'sz000001', 'sh510300', 'sz159915', 'hk00700', 'usAAPL', 'usIXIC']) {
    assert.equal(isIndexSymbol(symbol), false, symbol)
  }
})

test('custom MA periods are normalized and bounded', () => {
  assert.deepEqual(normalizeMaPeriods('5, 10, 20, 60'), [5, 10, 20, 60])
  assert.deepEqual(normalizeMaPeriods('20,20,0,999,abc,30'), [20, 30])
  assert.deepEqual(normalizeMaPeriods([]), [5, 10, 20, 60])
  assert.deepEqual(normalizePrefs({ maPeriods: [7, 21, 55] }).maPeriods, [7, 21, 55])
})
