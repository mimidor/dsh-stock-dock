import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { DISK_CACHE_VERSION, createDiskCache } from '../lib/disk-cache.js'
import { klineFor } from '../lib/providers/index.js'

async function tempDir() {
  return mkdtemp(join(tmpdir(), 'stock-cache-'))
}

test('disk cache round-trips klines and trends', async () => {
  const dir = await tempDir()
  try {
    const path = join(dir, 'cache.json')
    const maps = { klines: new Map(), trends: new Map() }
    const cache = createDiskCache({ path, maps })
    await cache.ready()
    cache.remember('klines', 'sh600519:m5:qfq:96', { at: 1000, rows: [{ date: '202611131500', close: 1400 }] })
    cache.remember('trends', 'sh600519:1', { at: 2000, value: { symbol: 'sh600519', points: [{ time: '1500', price: 1400 }] } })
    await cache.flush()

    const loaded = { klines: new Map(), trends: new Map() }
    const second = createDiskCache({ path, maps: loaded })
    await second.ready()
    assert.deepEqual(loaded.klines.get('sh600519:m5:qfq:96')?.rows, [{ date: '202611131500', close: 1400 }])
    assert.deepEqual(loaded.trends.get('sh600519:1')?.value.points, [{ time: '1500', price: 1400 }])
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('disk cache survives a corrupt file and keeps a readable version', async () => {
  const dir = await tempDir()
  try {
    const path = join(dir, 'cache.json')
    await writeFile(path, '{not json', 'utf8')
    const maps = { klines: new Map(), trends: new Map() }
    const cache = createDiskCache({ path, maps })
    await cache.ready()
    assert.equal(maps.klines.size, 0)
    cache.remember('klines', 'a:m5:qfq:1', { at: 1, rows: [] })
    await cache.flush()
    const parsed = JSON.parse(await readFile(path, 'utf8'))
    assert.equal(parsed.version, DISK_CACHE_VERSION)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('disk cache drops the oldest entries to stay under its byte cap', async () => {
  const dir = await tempDir()
  try {
    const path = join(dir, 'cache.json')
    const maps = { klines: new Map(), trends: new Map() }
    const cache = createDiskCache({ path, maps, maxBytes: 400 })
    await cache.ready()
    cache.remember('klines', 'old:m5:qfq:1', { at: 1, rows: [{ date: '1', close: 1 }] })
    cache.remember('klines', 'new:m5:qfq:1', { at: 2, rows: [{ date: '2', close: 2 }] })
    await cache.flush()
    const loaded = { klines: new Map(), trends: new Map() }
    const second = createDiskCache({ path, maps: loaded, maxBytes: 120 })
    await second.ready()
    assert.equal(loaded.klines.has('old:m5:qfq:1'), false, 'the oldest entry is dropped')
    assert.equal(loaded.klines.has('new:m5:qfq:1'), true, 'the newest entry survives')
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('disk cache clears its maps and file', async () => {
  const dir = await tempDir()
  try {
    const path = join(dir, 'cache.json')
    const maps = { klines: new Map(), trends: new Map() }
    const cache = createDiskCache({ path, maps })
    cache.remember('klines', 'a:m5:qfq:1', { at: 1, rows: [{ date: '1' }] })
    await cache.flush()
    await cache.clear()
    assert.equal(maps.klines.size, 0)
    const second = createDiskCache({ path, maps: { klines: new Map(), trends: new Map() } })
    await second.ready()
    assert.equal(second.path, path)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('minute history consolidates legacy pages and refreshes the tail after restart', async () => {
  const dir = await tempDir()
  const original = globalThis.fetch
  try {
    const path = join(dir, 'cache.json')
    const prefix = 'hk00700:m5:none:'
    const rows = Array.from({ length: 650 }, (_, index) => ({ date: String(202611130000 + index), close: 10 }))
    const open = () => {
      const maps = { klines: new Map(), trends: new Map() }
      return { ...maps, disk: createDiskCache({ path, maps }) }
    }
    const first = open()
    first.disk.remember('klines', prefix + '1000', { at: Date.now(), rows })
    first.disk.remember('klines', prefix + '96', { at: Date.now(), rows: rows.slice(-96) })
    await first.disk.flush()
    const second = open()
    globalThis.fetch = async (url) => {
      assert.equal(new URL(url).searchParams.get('param'), 'hk00700,m5,,96')
      return new Response(JSON.stringify({
        data: { hk00700: { m5: [['2026-11-13 06:49', '10', '12', '12', '10', '50']] } },
      }))
    }
    const refreshed = await klineFor(second, 'hk00700', 'm5', 'none', 5001, true)
    assert.equal(refreshed.rows.length, 640)
    assert.equal(refreshed.rows.at(-1).close, 12)
    assert.deepEqual([...second.klines.keys()], [prefix + 'history'])
    await second.disk.flush()
    const restarted = open()
    await restarted.disk.ready()
    assert.deepEqual([...restarted.klines.keys()], [prefix + 'history'])
    assert.equal(restarted.klines.get(prefix + 'history').pinned, true)
    const short = await klineFor(restarted, 'hk00700', 'm5', 'none', 96)
    assert.equal(short.rows.length, 96)
    assert.equal(short.source, 'cache')
  } finally {
    globalThis.fetch = original
    await rm(dir, { recursive: true, force: true })
  }
})
