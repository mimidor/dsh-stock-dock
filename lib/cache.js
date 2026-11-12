/**
 * Bounded caches.
 *
 * Every map here lives as long as the desktop app, so each one needs a ceiling
 * and a TTL. Insertion order is the eviction order — a plain LRU is not worth
 * the bookkeeping when the working set is a watchlist of at most 30 symbols.
 */

/**
 * K-line pages are keyed by symbol/period/adjust/limit and are the easiest map
 * to grow without bound: a client that walks its limits would leave one entry
 * per request in a process that lives as long as the desktop app. 30 symbols x
 * 8 periods x 3 adjusts already exceeds a small cap, so it has to be generous
 * enough to survive a full walk of the detail panel.
 */
export const KLINES_MAX_ENTRIES = 400

export function setBounded(map, key, value, max) {
  map.set(key, value)
  if (map.size <= max) return
  for (const stale of [...map.keys()].slice(0, map.size - max)) map.delete(stale)
}

export function rememberKline(cache, key, rows, now = Date.now()) {
  setBounded(cache.klines, key, { at: now, rows }, KLINES_MAX_ENTRIES)
}

/** A cached row that is still inside `ttl`, or `undefined`. `refresh` bypasses. */
export function readFresh(map, key, ttl, now = Date.now(), refresh = false) {
  if (refresh) return undefined
  const entry = map.get(key)
  if (!entry) return undefined
  return now - entry.at <= ttl ? entry : undefined
}
