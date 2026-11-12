/**
 * Company-event parsing over captured payloads, plus the intraday thinning that
 * keeps a five-day line inside the transport budget.
 */

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { fetchAnnouncements, fetchBillboard } from '../lib/events.js'
import { sampleTrend } from '../lib/providers/index.js'

const read = (name) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8')

async function withFetchPayload(payload, fn) {
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

test('announcements map to date, title and type', async () => {
  const items = await withFetchPayload(read('eastmoney-announcements.json'), () => fetchAnnouncements('600519', 3))
  assert.ok(items.length > 0)
  const first = items[0]
  assert.match(first.date, /^\d{4}-\d{2}-\d{2}$/)
  assert.ok(first.title.length > 0)
  assert.ok(first.id.length > 0)
  assert.match(first.url, /eastmoney\.com\/notices\/detail\/600519\//)
})

test('billboard rows expose the numbers the model needs', async () => {
  const items = await withFetchPayload(read('eastmoney-billboard.json'), () => fetchBillboard('600519', 3))
  assert.ok(items.length > 0)
  const first = items[0]
  assert.match(first.date, /^\d{4}-\d{2}-\d{2}$/)
  assert.equal(typeof first.close, 'number')
  assert.equal(typeof first.changePct, 'number')
  assert.equal(typeof first.dealAmount, 'number')
  assert.ok(first.reason.length > 0)
})

test('a JSONP-wrapped datacenter answer is still parsed', async () => {
  const body = `callback(${read('eastmoney-billboard.json')})`
  const items = await withFetchPayload(body, () => fetchBillboard('600519', 2))
  assert.ok(items.length > 0)
})

test('an empty datacenter answer yields no rows instead of throwing', async () => {
  const items = await withFetchPayload('{}', () => fetchBillboard('600519', 2))
  assert.deepEqual(items, [])
})

test('intraday thinning keeps the ends and respects the cap', () => {
  const points = Array.from({ length: 1335 }, (_, index) => ({ time: `t${index}`, price: 100 + index, day: '20261112' }))
  const sampled = sampleTrend(points, 900)
  assert.ok(sampled.length <= 900)
  assert.equal(sampled[0], points[0])
  assert.equal(sampled[sampled.length - 1], points[points.length - 1])
  assert.deepEqual(sampleTrend(points.slice(0, 10), 900), points.slice(0, 10), 'short lines are untouched')
  assert.deepEqual(sampleTrend(undefined), [])
})
