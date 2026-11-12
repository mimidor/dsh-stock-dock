/**
 * Trade-ledger arithmetic. The rules a broker statement implies are the ones the
 * detail panel promises, so they get their own tests rather than riding on the
 * render suite.
 */

import assert from 'node:assert/strict'
import test from 'node:test'
import { computePositions, holdingsFromPositions, normalizeTrade, summarizeTrades } from '../lib/trades.js'

test('a buy rolls its fee into the average cost', () => {
  const { positions } = computePositions([
    { id: 't1', symbol: 'sh600519', side: 'buy', price: 1000, shares: 100, fee: 5, date: '2026-11-01', createdAt: 1 },
  ])
  const position = positions.get('sh600519')
  assert.equal(position.shares, 100)
  assert.equal(position.cost, 1000.05)
  assert.equal(position.realized, 0)
})

test('a second buy re-averages and a sell realises against it', () => {
  const { positions } = computePositions([
    { id: 't1', symbol: 'sh600519', side: 'buy', price: 1000, shares: 100, fee: 5, date: '2026-11-01', createdAt: 1 },
    { id: 't2', symbol: 'sh600519', side: 'buy', price: 1200, shares: 100, fee: 5, date: '2026-11-02', createdAt: 2 },
    { id: 't3', symbol: 'sh600519', side: 'sell', price: 1500, shares: 50, fee: 3, date: '2026-11-03', createdAt: 3 },
  ])
  const position = positions.get('sh600519')
  assert.equal(position.shares, 150)
  assert.equal(position.cost, 1100.05)
  assert.equal(position.realized, 19994.5)
  assert.equal(position.fees, 13)
})

test('selling everything resets the average cost', () => {
  const { positions } = computePositions([
    { id: 't1', symbol: 'sh600519', side: 'buy', price: 100, shares: 10, fee: 0, date: '2026-11-01' },
    { id: 't2', symbol: 'sh600519', side: 'sell', price: 110, shares: 10, fee: 0, date: '2026-11-02' },
  ])
  const position = positions.get('sh600519')
  assert.equal(position.shares, 0)
  assert.equal(position.cost, 0)
  assert.equal(position.realized, 100)
})

test('selling more than held is flagged, not silently shorted', () => {
  const { positions, warnings } = computePositions([
    { id: 't1', symbol: 'sh600519', side: 'buy', price: 100, shares: 10, fee: 0, date: '2026-11-01' },
    { id: 't2', symbol: 'sh600519', side: 'sell', price: 110, shares: 30, fee: 0, date: '2026-11-02' },
  ])
  assert.equal(warnings.length, 1)
  assert.match(warnings[0].message, /超过持仓/)
  assert.equal(positions.get('sh600519').shares, 0)
})

test('trades are applied in date order regardless of insertion order', () => {
  const { positions } = computePositions([
    { id: 't2', symbol: 'sh600519', side: 'sell', price: 150, shares: 10, fee: 0, date: '2026-11-02' },
    { id: 't1', symbol: 'sh600519', side: 'buy', price: 100, shares: 10, fee: 0, date: '2026-11-01' },
  ])
  assert.equal(positions.get('sh600519').realized, 500)
})

test('positions rebuild into the holdings map', () => {
  const { positions } = computePositions([
    { id: 't1', symbol: 'sh600519', side: 'buy', price: 1000, shares: 100, fee: 5, date: '2026-11-01' },
    { id: 't2', symbol: 'hk00700', side: 'buy', price: 300, shares: 100, fee: 0, date: '2026-11-01' },
    { id: 't3', symbol: 'hk00700', side: 'sell', price: 400, shares: 100, fee: 0, date: '2026-11-02' },
  ])
  assert.deepEqual(holdingsFromPositions(positions), { sh600519: { shares: 100, cost: 1000.05 } })
})

test('trade normalization rejects nonsense and defaults the date', () => {
  const now = Date.parse('2026-11-12T02:00:00Z')
  assert.equal(normalizeTrade({ symbol: 'sh600519', side: 'hold', price: 1, shares: 1 }, now), undefined)
  assert.equal(normalizeTrade({ symbol: 'sh600519', side: 'buy', price: 0, shares: 1 }, now), undefined)
  assert.equal(normalizeTrade({ symbol: 'sh600519', side: 'buy', price: 1, shares: -2 }, now), undefined)
  const trade = normalizeTrade({ symbol: 'sh600519', side: 'buy', price: 1.23456, shares: 10, fee: 0.5 }, now)
  assert.equal(trade.price, 1.235)
  assert.match(trade.date, /^\d{4}-\d{2}-\d{2}$/)
  assert.equal(trade.fee, 0.5)
})

test('summaries carry the position and its warnings', () => {
  const trades = [
    { id: 't1', symbol: 'sh600519', side: 'buy', price: 100, shares: 10, fee: 0, date: '2026-11-01' },
    { id: 't2', symbol: 'hk00700', side: 'buy', price: 300, shares: 10, fee: 0, date: '2026-11-01' },
  ]
  const summary = summarizeTrades(trades, 'sh600519')
  assert.equal(summary.count, 1)
  assert.equal(summary.position.symbol, 'sh600519')
  assert.deepEqual(summary.warnings, [])
})
