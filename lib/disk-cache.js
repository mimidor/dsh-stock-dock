/**
 * Persistent K-line / intraday cache.
 *
 * Quotes must stay live, but a chart page for a closed session does not change
 * and a minute page only gains a tail. Persisting those answers across a DSH
 * restart lets the detail panel paint immediately and gives the provider
 * fallback a last-known-good page. The file lives beside the config store, is
 * capped (LRU by `at`), and is written through a temp file + rename.
 */

import { mkdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { KLINES_MAX_ENTRIES, TRENDS_MAX_ENTRIES } from './cache.js'

export const DISK_CACHE_VERSION = 1
export const DISK_CACHE_MAX_BYTES = 20 * 1024 * 1024
export const DISK_CACHE_LIMITS = { klines: KLINES_MAX_ENTRIES, trends: TRENDS_MAX_ENTRIES }
const WRITE_DELAY_MS = 5000

export function diskCachePath() {
  const override = process.env.DSH_STOCK_DOCK_CACHE
  if (override && override.trim() !== '') return override
  const home = process.env.DSH_HOME || join(homedir(), '.dsh')
  return join(home, 'dsh-stock-dock', 'cache.json')
}

function validEntry(namespace, entry) {
  if (!entry || typeof entry !== 'object' || typeof entry.at !== 'number') return false
  if (namespace === 'klines') return Array.isArray(entry.rows)
  if (namespace === 'trends') return entry.value !== null && typeof entry.value === 'object'
  return false
}

/**
 * @param path - cache file; defaults to `$DSH_HOME/dsh-stock-dock/cache.json`.
 * @param maxBytes - largest serialized file before the oldest entries are dropped.
 * @param maps - the same Maps the request path already reads (`klines`, `trends`).
 */
export function createDiskCache({
  path = diskCachePath(),
  maxBytes = DISK_CACHE_MAX_BYTES,
  maps = {},
  limits = DISK_CACHE_LIMITS,
  logger = console,
} = {}) {
  const namespaces = Object.keys(maps)
  let readyPromise = null
  let timer = null
  let writing = Promise.resolve()
  let dirty = false
  let lastBytes = 0

  const trim = (namespace) => {
    const map = maps[namespace]
    const limit = limits[namespace]
    if (!map || !limit || map.size <= limit) return
    const entries = [...map.entries()]
      .filter(([, entry]) => entry?.pinned !== true)
      .sort((left, right) => left[1].at - right[1].at)
    for (const [key] of entries.slice(0, map.size - limit)) map.delete(key)
  }

  const serialize = () =>
    `${JSON.stringify({
      version: DISK_CACHE_VERSION,
      ...Object.fromEntries(namespaces.map((namespace) => [namespace, Object.fromEntries(maps[namespace])])),
    })}\n`

  const oldest = () => {
    let found
    for (const namespace of namespaces) {
      for (const [key, entry] of maps[namespace]) {
        if (entry?.pinned === true) continue
        if (!found || entry.at < found.entry.at) found = { namespace, key, entry }
      }
    }
    return found
  }

  const load = () => {
    if (readyPromise) return readyPromise
    readyPromise = (async () => {
      await mkdir(dirname(path), { recursive: true }).catch(() => {})
      try {
        const text = await readFile(path, 'utf8')
        const parsed = JSON.parse(text)
        if (!parsed || parsed.version !== DISK_CACHE_VERSION) throw new Error('unsupported cache version')
        for (const namespace of namespaces) {
          const entries = parsed[namespace]
          if (!entries || typeof entries !== 'object') continue
          const map = maps[namespace]
          for (const [key, entry] of Object.entries(entries)) {
            if (!validEntry(namespace, entry)) continue
            const existing = map.get(key)
            if (!existing || existing.at < entry.at) map.set(key, entry)
          }
          trim(namespace)
        }
        lastBytes = Buffer.byteLength(text)
        if (lastBytes > maxBytes) {
          while (lastBytes > maxBytes) {
            const victim = oldest()
            if (!victim) break
            maps[victim.namespace].delete(victim.key)
            lastBytes = Buffer.byteLength(serialize())
          }
          dirty = true
          schedule()
        }
      } catch (error) {
        if (error?.code !== 'ENOENT') {
          logger.warn?.(`[stock-ticker] cache unreadable: ${error?.message ?? error}`)
          await rename(path, `${path}.broken-${Date.now()}`).catch(() => {})
        }
      }
    })()
    return readyPromise
  }

  const schedule = () => {
    if (timer) return
    timer = setTimeout(() => {
      timer = null
      void flush()
    }, WRITE_DELAY_MS)
    timer.unref?.()
  }

  const flush = async () => {
    if (timer) {
      clearTimeout(timer)
      timer = null
    }
    if (!dirty) return writing
    dirty = false
    let text = serialize()
    while (Buffer.byteLength(text) > maxBytes) {
      const victim = oldest()
      if (!victim) break
      maps[victim.namespace].delete(victim.key)
      text = serialize()
    }
    writing = writing
      .then(async () => {
        await mkdir(dirname(path), { recursive: true })
        const temp = `${path}.${process.pid}.tmp`
        await writeFile(temp, text, 'utf8')
        await rename(temp, path)
        lastBytes = Buffer.byteLength(text)
      })
      .catch((error) => {
        logger.warn?.(`[stock-ticker] cache write failed: ${error?.message ?? error}`)
      })
    return writing
  }

  const remember = (namespace, key, entry) => {
    if (!maps[namespace] || !validEntry(namespace, entry)) return
    maps[namespace].set(key, entry)
    trim(namespace)
    dirty = true
    schedule()
  }

  const info = async () => {
    await load()
    let bytes = lastBytes
    try {
      bytes = (await stat(path)).size
    } catch {
      /* no file yet */
    }
    return {
      path,
      bytes,
      entries: Object.fromEntries(namespaces.map((namespace) => [namespace, maps[namespace].size])),
    }
  }

  const clear = async () => {
    if (timer) {
      clearTimeout(timer)
      timer = null
    }
    dirty = false
    for (const namespace of namespaces) maps[namespace].clear()
    await writing.catch(() => {})
    await rm(path, { force: true }).catch(() => {})
    lastBytes = 0
  }

  return {
    path,
    ready: load,
    remember,
    flush,
    info,
    clear,
  }
}
