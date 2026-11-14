/**
 * Bounded caches.
 *
 * Every map here lives as long as the desktop app, so each one needs a ceiling
 * and a TTL. Insertion order is the eviction order — a plain LRU is not worth
 * the bookkeeping when the working set is a watchlist of at most 30 symbols.
 */

export const KLINES_MAX_ENTRIES = 400
export const TRENDS_MAX_ENTRIES = 120
export const QUOTES_MAX_ENTRIES = 8

export function setBounded(map, key, value, max) {
  map.set(key, value)
  if (map.size <= max) return
  for (const stale of [...map.keys()].slice(0, map.size - max)) map.delete(stale)
}

/** K-line pages also mirror into the disk cache; callers never write both. */
export function rememberKline(cache, key, rows, now = Date.now()) {
  const entry = { at: now, rows }
  setBounded(cache.klines, key, entry, KLINES_MAX_ENTRIES)
  cache.disk?.remember?.('klines', key, entry)
}

/** Intraday pages use the same map/TTL shape, so keep the pairing in one place. */
export function rememberTrend(cache, key, value, now = Date.now()) {
  const entry = { at: now, value }
  setBounded(cache.trends, key, entry, TRENDS_MAX_ENTRIES)
  cache.disk?.remember?.('trends', key, entry)
}

/** A cached row that is still inside `ttl`, or `undefined`. */
export function readFresh(map, key, ttl, now = Date.now()) {
  const entry = map.get(key)
  return entry && now - entry.at <= ttl ? entry : undefined
}
