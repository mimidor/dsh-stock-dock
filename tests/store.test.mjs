/**
 * Store tests: atomic writes, corrupt-file recovery, write serialization and
 * the normalization that keeps an old or hand-edited file from taking the strip
 * down.
 */

import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { createStore, normalizeState, storePath } from '../lib/store.js'

const silent = { error: () => undefined, warn: () => undefined }
const tempPath = () => join(mkdtempSync(join(tmpdir(), 'dsh-stock-ticker-store-')), 'store.json')

test('a fresh store seeds the default group from the configured symbols', async () => {
  const file = tempPath()
  const store = createStore({ seedSymbols: ['sh600519', 'hk00700'], filePath: file, logger: silent })
  const state = await store.snapshot()
  assert.deepEqual(state.groups[0].symbols, ['sh600519', 'hk00700'])
  assert.ok(state.groups.some((group) => group.id === 'market'), 'the market group is seeded once')
  assert.equal(state.activeGroup, 'default')
  await store.update((current) => {
    current.groups[0].symbols = ['sh600519']
    return current
  })
  const onDisk = JSON.parse(readFileSync(file, 'utf8'))
  assert.deepEqual(onDisk.groups[0].symbols, ['sh600519'])
})

test('a corrupt store file is kept aside instead of being silently replaced', async () => {
  const file = tempPath()
  writeFileSync(file, '{ this is not json', 'utf8')
  const store = createStore({ seedSymbols: ['sh600519'], filePath: file, logger: silent })
  const state = await store.snapshot()
  assert.deepEqual(state.groups[0].symbols, ['sh600519'])
  const leftovers = readdirSync(join(file, '..')).filter((name) => name.includes('.broken-'))
  assert.equal(leftovers.length, 1, 'the unreadable file is kept, not deleted')
  await store.update((current) => {
    current.prefs.colorMode = 'intl'
    return current
  })
  assert.equal(JSON.parse(readFileSync(file, 'utf8')).prefs.colorMode, 'intl')
})

test('a failed disk write is reported instead of pretending to save', async () => {
  const store = createStore({
    seedSymbols: ['sh600519'],
    filePath: '/dev/null/dsh-stock-ticker/store.json',
    logger: silent,
  })
  await assert.rejects(
    store.update((current) => {
      current.prefs.showLogos = false
      return current
    }),
  )
})

test('concurrent updates serialize into one valid file', async () => {
  const file = tempPath()
  const store = createStore({ seedSymbols: ['sh600519'], filePath: file, logger: silent })
  await Promise.all(
    Array.from({ length: 12 }, (_, index) =>
      store.update((current) => {
        current.prefs.defaultPeriod = index % 2 === 0 ? 'day' : 'week'
        current.alerts.push({ id: `a${index}`, symbol: 'sh600519', op: 'above', price: 100 + index })
        return current
      }),
    ),
  )
  await store.flush()
  const onDisk = JSON.parse(readFileSync(file, 'utf8'))
  assert.equal(onDisk.alerts.length, 12)
  assert.equal(typeof onDisk.prefs.defaultPeriod, 'string')
})

test('the fired queue is drained once', () => {
  const store = createStore({ seedSymbols: ['sh600519'], filePath: tempPath(), logger: silent })
  store.pushFired([{ id: 'a1', symbol: 'sh600519' }])
  assert.equal(store.drainFired().length, 1)
  assert.equal(store.drainFired().length, 0)
})

test('normalization repairs groups, holdings and alerts', () => {
  const state = normalizeState({
    groups: [
      { id: 'default', name: '主表', symbols: ['sh600519', '@@@', 'sh600519'] },
      { id: 'g1', name: '科技', symbols: ['sz000001'] },
    ],
    activeGroup: 'nope',
    holdings: {
      sh600519: { shares: 0, cost: 10 },
      hk00700: { shares: 100, cost: 300 },
    },
    alerts: [{ symbol: 'sh600519', op: 'above', price: 1500 }, { symbol: '', op: 'above', price: 1 }],
    prefs: { defaultPeriod: 'quarter', showMA: 'nope' },
  })
  assert.deepEqual(state.groups[0].symbols, ['sh600519'])
  assert.equal(state.groups.length, 3, 'default, the custom group and the seeded market group')
  assert.ok(state.groups.some((group) => group.id === 'market'))
  assert.equal(state.activeGroup, 'default')
  assert.deepEqual(Object.keys(state.holdings), ['hk00700'])
  assert.equal(state.alerts.length, 1)
  assert.equal(state.prefs.defaultPeriod, 'trend', 'an unknown period falls back to the default')
  assert.equal(state.prefs.showMA, true)
})

test('normalization caps the alert list', () => {
  const alerts = Array.from({ length: 260 }, (_, index) => ({
    id: `a${index}`,
    symbol: 'sh600519',
    op: 'above',
    price: 100 + index,
  }))
  const state = normalizeState({ alerts })
  assert.equal(state.alerts.length, 200)
})

test('the store path honours DSH_STOCK_DOCK_STORE', () => {
  const previous = process.env.DSH_STOCK_DOCK_STORE
  process.env.DSH_STOCK_DOCK_STORE = '/tmp/custom-store.json'
  try {
    assert.equal(storePath(), '/tmp/custom-store.json')
  } finally {
    if (previous === undefined) delete process.env.DSH_STOCK_DOCK_STORE
    else process.env.DSH_STOCK_DOCK_STORE = previous
  }
})
