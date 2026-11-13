/**
 * Parser regression tests over payloads captured from the real endpoints.
 *
 * These are the cheapest possible insurance against the one class of bug that
 * silently corrupts the strip: a field index drifting by one when an upstream
 * answer gains or loses a column.
 */

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import * as eastmoney from '../lib/providers/eastmoney.js'
import * as tencent from '../lib/providers/tencent.js'
import * as sina from '../lib/providers/sina.js'
import { secidCandidates, symbolFromSecid } from '../lib/symbols.js'

const read = (name) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8')

function rowsOf(text) {
  const rows = new Map()
  for (const match of text.matchAll(/v_([a-z0-9._-]+)="([^"]*)"/gi)) rows.set(match[1].toLowerCase(), match[2].split('~'))
  return rows
}

function sinaRowsOf(text) {
  const rows = new Map()
  for (const match of text.matchAll(/hq_str_([a-z0-9_]+)="([^"]*)"/gi)) rows.set(match[1].toLowerCase(), match[2].split(','))
  return rows
}

async function withFetchText(payload, fn) {
  const real = globalThis.fetch
  globalThis.fetch = async () =>
    new Response(typeof payload === 'string' ? payload : JSON.stringify(payload), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })
  try {
    return await fn()
  } finally {
    globalThis.fetch = real
  }
}

test('tencent quote fixture parses an A-share row', () => {
  const rows = rowsOf(read('tencent-quotes.txt'))
  const quote = tencent.parseQuote('sh600519', rows.get('sh600519'))
  assert.equal(quote.symbol, 'sh600519')
  assert.equal(quote.market, 'cn')
  assert.equal(quote.source, 'tencent')
  assert.equal(quote.name, '贵州茅台')
  assert.equal(quote.price, 1410.27)
  assert.equal(quote.prevClose, 1402.3)
  assert.equal(quote.changePct, 0.57)
  assert.equal(quote.time, '20261112161452')
  assert.equal(quote.amount, 4_536_810_000)
  assert.equal(quote.extras.limitUp, 1542.53)
  assert.equal(quote.extras.limitDown, 1262.07)
  assert.equal(quote.extras.turnover, 0.26)
  assert.equal(quote.depth.bids.length, 5)
  assert.equal(quote.depth.asks.length, 5)
  assert.equal(quote.depth.bids[0].price, 1410.27)
  assert.equal(typeof quote.depth.ratio, 'number')
})

test('tencent quote fixture parses a Hong Kong row', () => {
  const rows = rowsOf(read('tencent-quotes.txt'))
  const quote = tencent.parseQuote('hk00700', rows.get('hk00700'))
  assert.equal(quote.market, 'hk')
  assert.equal(quote.name, '腾讯控股')
  assert.equal(quote.price, 398.8)
  assert.equal(quote.changePct, -2.64)
  assert.equal(quote.depth, undefined, 'Hong Kong depth is all zeroes and must be dropped')
})

test('tencent quote fixture parses a US row and keeps its venue suffix', () => {
  const rows = rowsOf(read('tencent-quotes.txt'))
  const quote = tencent.parseQuote('usAAPL', rows.get('usaapl'))
  assert.equal(quote.market, 'us')
  assert.equal(quote.name, '苹果')
  assert.equal(quote.code, 'AAPL.OQ')
  assert.equal(quote.price, 355.63)
  assert.equal(quote.extras, undefined, 'US rows must not borrow the A-share field positions')
})

test('sina fixture exposes the US pre-market snapshot', () => {
  const rows = sinaRowsOf(read('sina-quotes.txt'))
  const extended = sina.parseExtended(rows.get('gb_aapl'))
  assert.equal(extended.session, 'pre')
  assert.equal(extended.price, 356.71)
  assert.equal(extended.changePct, 0.38)
  assert.match(extended.time, /AM EST/)
})

test('sina fixture parses the three market layouts', () => {
  const rows = sinaRowsOf(read('sina-quotes.txt'))
  const cn = sina.parseQuote('sh600519', rows.get('sh600519'))
  const hk = sina.parseQuote('hk00700', rows.get('rt_hk00700'))
  const us = sina.parseQuote('usAAPL', rows.get('gb_aapl'))
  assert.equal(cn.market, 'cn')
  assert.equal(cn.source, 'sina')
  assert.equal(typeof cn.price, 'number')
  assert.equal(hk.market, 'hk')
  assert.equal(typeof hk.price, 'number')
  assert.equal(us.market, 'us')
  assert.equal(typeof us.price, 'number')
  assert.ok(us.name.length > 0)
})

test('tencent K-line fixture parses its rows', async () => {
  const rows = await withFetchText(read('tencent-kline.json'), () => tencent.fetchPeriodKline('sh600519', 'day', 'qfq', 40))
  assert.ok(rows.length >= 30)
  for (const row of rows) {
    assert.equal(typeof row.date, 'string')
    assert.equal(typeof row.close, 'number')
    assert.equal(typeof row.high, 'number')
    assert.equal(typeof row.low, 'number')
    assert.ok(row.high >= row.low)
  }
})

test('tencent minute K-line fixture parses its rows', async () => {
  const rows = await withFetchText(read('tencent-mkline.json'), () => tencent.fetchMinuteKline('sh600519', 'm15', 24))
  assert.ok(rows.length > 5)
  assert.ok(rows.every((row) => typeof row.close === 'number'))
})

test('tencent intraday fixture carries previous close and a running average', async () => {
  const trend = await withFetchText(read('tencent-minute.json'), () => tencent.fetchTrend('sh600519'))
  assert.ok(trend.points.length > 200)
  assert.ok(trend.prevClose > 0)
  const last = trend.points.at(-1)
  assert.equal(typeof last.avg, 'number')
  assert.ok(Math.abs(last.avg - last.price) / last.price < 0.05)
})

test('tencent five-day fixture restarts the average on each day', async () => {
  const trend = await withFetchText(read('tencent-days.json'), () => tencent.fetchTrendDays('sh600519', 5))
  assert.equal(trend.days.length, 5)
  assert.ok(trend.points.length > 900)
  const firstDay = trend.days[0]
  const firstPoint = trend.points.find((point) => point.day === firstDay)
  assert.ok(Math.abs(firstPoint.avg - firstPoint.price) / firstPoint.price < 0.05)
  // Days are chronological so the chart does not draw right-to-left.
  assert.deepEqual([...trend.days].sort(), trend.days)
})

test('eastmoney batch fixture maps the three markets', () => {
  const payload = JSON.parse(read('eastmoney-ulist.json'))
  const rows = payload.data.diff
  const cn = eastmoney.parseRow('sh600519', rows.find((row) => row.f13 === 1))
  const hk = eastmoney.parseRow('hk00700', rows.find((row) => row.f13 === 116))
  const us = eastmoney.parseRow('usAAPL', rows.find((row) => row.f13 === 105))
  assert.equal(cn.price, 1410.27)
  assert.equal(cn.source, 'eastmoney')
  assert.ok(cn.extras.totalCap > 1e9)
  assert.equal(hk.price, 398.8)
  assert.equal(us.price, 355.63)
})

test('eastmoney suggest fixture drops unquotable venues', async () => {
  const payload = JSON.parse(read('eastmoney-suggest.json'))
  const items = await withFetchText(payload, () => eastmoney.search('茅台', 8))
  const symbols = items.map((item) => item.symbol)
  assert.deepEqual(symbols, ['sh600519', 'hk00700'], 'the sector entry (90.BK1036) must be filtered out')
  assert.equal(items[0].name, '贵州茅台')
})

test('symbols map to Eastmoney secids and back', () => {
  assert.deepEqual(secidCandidates('sh600519'), ['1.600519'])
  assert.deepEqual(secidCandidates('sz000001'), ['0.000001'])
  assert.deepEqual(secidCandidates('bj430047'), ['0.430047'])
  assert.deepEqual(secidCandidates('hk00700'), ['116.00700'])
  assert.deepEqual(secidCandidates('usAAPL'), ['105.AAPL', '106.AAPL', '107.AAPL'])
  assert.equal(symbolFromSecid(1, '600519'), 'sh600519')
  assert.equal(symbolFromSecid(0, '000001'), 'sz000001')
  assert.equal(symbolFromSecid(0, '430047'), 'bj430047')
  assert.equal(symbolFromSecid(116, '00700'), 'hk00700')
  assert.equal(symbolFromSecid(105, 'AAPL'), 'usAAPL')
  assert.equal(symbolFromSecid(90, 'BK1036'), undefined)
})

test('US index klines probe past a one-row venue suffix', async () => {
  const real = globalThis.fetch
  const calls = []
  const bars = (count) => Array.from({ length: count }, (_, index) => [
    `2026-09-${String((index % 28) + 1).padStart(2, '0')}`, '100', '101', '102', '99', '1000',
  ])
  globalThis.fetch = async (url) => {
    const candidate = decodeURIComponent(String(url).split('param=')[1] ?? '').split(',')[0]
    calls.push(candidate)
    const rows = bars(candidate === 'usTESTIX' ? 40 : 1)
    return new Response(JSON.stringify({ code: 0, data: { [candidate]: { day: rows } } }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })
  }
  try {
    const rows = await tencent.fetchKline('usTESTIX', 'day', 'qfq', 40)
    assert.equal(rows.length, 40, 'the bare symbol carries the history')
    assert.deepEqual(calls, ['usTESTIX.OQ', 'usTESTIX.N', 'usTESTIX'])
    calls.length = 0
    await tencent.fetchKline('usTESTIX', 'day', 'qfq', 40)
    assert.deepEqual(calls, ['usTESTIX'], 'the winning spelling is cached')
  } finally {
    globalThis.fetch = real
  }
})
