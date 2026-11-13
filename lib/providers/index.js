/**
 * Source orchestration: primary source, per-symbol recovery, cache and TTLs.
 *
 * Quote cadence is deliberately short (3 s) because the strip polls a page that
 * is usually already open; history is longer because a K-line page for a closed
 * day cannot change, and a failed history read is retried after a minute rather
 * than on every poll.
 */

import { readFresh, rememberKline, setBounded } from '../cache.js'
import { getGbkText } from '../http.js'
import { extendedWindow } from '../session.js'
import { marketOf } from '../symbols.js'
import * as eastmoney from './eastmoney.js'
import * as sina from './sina.js'
import * as tencent from './tencent.js'

export const QUOTE_TTL_MS = 3000
export const KLINE_TTL_MS = 5 * 60 * 1000
export const MINUTE_KLINE_TTL_MS = 60 * 1000
export const TREND_TTL_LIVE_MS = 20 * 1000
export const TREND_TTL_CLOSED_MS = 5 * 60 * 1000
export const KLINE_RETRY_MS = 60 * 1000
export const SOURCE_COOLDOWN_MS = 30 * 1000
/** The pre/post-market snapshot is a separate, slower-moving request. */
export const EXTENDED_TTL_MS = 60 * 1000

const MINUTE_PERIODS = new Set(['m1', 'm5', 'm15', 'm30', 'm60'])

const FETCHERS = {
  tencent: tencent.fetchQuotes,
  sina: sina.fetchQuotes,
  eastmoney: eastmoney.fetchQuotes,
}

const ORDER = ['tencent', 'sina', 'eastmoney']

/**
 * The upstream cache keeps a fresh page from hammering the free endpoints:
 * several tabs, the client's own retries, and a page refresh all reuse one
 * recent download.
 */
export async function buildQuotes(cache, symbols, forcedSource) {
  const key = `${forcedSource ?? 'auto'}:${symbols.join(',')}`
  const cached = readFresh(cache.quotes, key, QUOTE_TTL_MS)
  if (cached) return cached.bundle
  const bundle = await fetchQuoteBundle(cache, symbols, forcedSource)
  cache.quotes.set(key, { at: Date.now(), bundle })
  if (cache.quotes.size > 8) {
    for (const stale of [...cache.quotes.keys()].slice(0, cache.quotes.size - 8)) cache.quotes.delete(stale)
  }
  return bundle
}

async function fetchQuoteBundle(cache, symbols, forcedSource) {
  const order = forcedSource ? [forcedSource, ...ORDER.filter((name) => name !== forcedSource)] : ORDER
  const failures = []
  const fetchFrom = (source, list) => FETCHERS[source](list)

  for (const source of order) {
    if (!forcedSource && !sourceUsable(cache, source)) continue
    let quotes
    try {
      quotes = await fetchFrom(source, symbols)
      markSource(cache, source, true)
    } catch (error) {
      markSource(cache, source, false)
      failures.push(`${source}: ${messageOf(error)}`)
      continue
    }

    // A source that answers for some symbols but not others is the normal case
    // for mixed A-share/HK/US lists: ask the other sources only for the holes
    // instead of returning a strip of dashes.
    const missing = quotes.filter((quote) => quote.error).map((quote) => quote.symbol)
    if (missing.length === 0) return { source, quotes, at: Date.now() }

    const recovered = await recoverMissing(cache, missing, source, forcedSource)
    if (recovered.size > 0) {
      return {
        source,
        quotes: quotes.map((quote) => recovered.get(quote.symbol) ?? quote),
        at: Date.now(),
      }
    }
    return { source, quotes, at: Date.now() }
  }
  throw new Error(failures.join('; ') || 'no quote source available')
}

async function recoverMissing(cache, missing, primary, forcedSource) {
  const found = new Map()
  for (const alternate of ORDER) {
    if (alternate === primary) continue
    if (!forcedSource && !sourceUsable(cache, alternate)) continue
    const remaining = missing.filter((symbol) => !found.has(symbol))
    if (remaining.length === 0) break
    try {
      const quotes = await FETCHERS[alternate](remaining)
      markSource(cache, alternate, true)
      for (const quote of quotes) {
        if (!quote.error) found.set(quote.symbol, quote)
      }
    } catch (error) {
      markSource(cache, alternate, false)
      console.error('[stock-ticker] fallback source failed', alternate, messageOf(error))
    }
  }
  return found
}

export function sourceUsable(cache, source) {
  const health = cache.health[source]
  return !health || health.cooldownUntil <= Date.now()
}

export function markSource(cache, source, ok) {
  const health = (cache.health[source] = cache.health[source] ?? { failures: 0, cooldownUntil: 0, lastOk: 0 })
  if (ok) {
    health.failures = 0
    health.cooldownUntil = 0
    health.lastOk = Date.now()
    return
  }
  health.failures += 1
  health.cooldownUntil = Date.now() + SOURCE_COOLDOWN_MS
  health.lastOk = health.lastOk || 0
}

export function sourceHealth(cache) {
  const now = Date.now()
  const state = (health) => {
    if (!health) return 'unknown'
    if (health.cooldownUntil > now) return 'down'
    return health.lastOk > 0 ? 'ok' : 'unknown'
  }
  return {
    tencent: state(cache.health.tencent),
    sina: state(cache.health.sina),
    eastmoney: state(cache.health.eastmoney),
    eastmoneyHistory: eastmoney.historyHealth(),
  }
}

/**
 * Day bars for the mini charts, keyed by symbol.
 *
 * They are deliberately not part of `/quotes`: thirty cards of forty bars is
 * about 107 KB of the 129 KB payload, re-sent every fifteen seconds for data
 * that changes once a day. The strip fetches them once through `/sparklines`
 * (which revalidates with an ETag) and keeps them client-side.
 */
export async function buildSparklines(cache, symbols, klineDays, type = 'day') {
  const charts = {}
  const rows = {}
  await Promise.all(
    symbols.map(async (symbol) => {
      // US intraday is not reliable from the free sources; skip the doomed
      // request and serve its daily candles as the fallback immediately.
      if (type === 'intraday' && marketOf(symbol) !== 'us') {
        try {
          const trend = await trendFor(cache, symbol, 1)
          if (trend.points.length >= 2) {
            charts[symbol] = {
              kind: 'line',
              prevClose: trend.prevClose ?? null,
              points: sampleTrend(trend.points, 80).map((point) => ({
                time: point.time,
                ...(point.day ? { day: point.day } : {}),
                price: point.price,
              })),
            }
            return
          }
        } catch {
          // A missing intraday source (US) falls through to daily candles.
        }
      }
      const period = type === 'intraday' ? 'day' : type
      const result = await klineFor(cache, symbol, period, 'qfq', klineDays).catch(() => ({ rows: [] }))
      charts[symbol] = {
        kind: 'candles',
        rows: result.rows,
        ...(type === 'intraday' ? { fallback: 'day' } : {}),
      }
      rows[symbol] = result.rows
    }),
  )
  return { charts, rows }
}

/**
 * Attach US pre/post-market prices. Only the US rows that Sina still reports an
 * extended session for get one; the request is batched and cached for a minute.
 */
export async function attachExtended(cache, quotes, now = new Date()) {
  const window = extendedWindow('us', now)
  if (!window) return quotes
  const usSymbols = quotes
    .filter((quote) => !quote.error && quote.market === 'us')
    .map((quote) => quote.symbol)
  if (usSymbols.length === 0) return quotes
  const key = `${usSymbols.join(',')}:${window}`
  const cached = readFresh(cache.extended, key, EXTENDED_TTL_MS)
  let extended
  if (cached) {
    extended = cached.value
  } else {
    extended = await sina
      .fetchExtended(usSymbols)
      .then((rows) => Object.fromEntries(Object.entries(rows).filter(([, value]) => value.session === window)))
      .catch((error) => {
        console.error('[stock-ticker] extended hours failed', messageOf(error))
        return {}
      })
    if (!cache.extended) cache.extended = new Map()
    setBounded(cache.extended, key, { at: Date.now(), value: extended }, 20)
  }
  return quotes.map((quote) => (extended[quote.symbol] ? { ...quote, extended: extended[quote.symbol] } : quote))
}

/** Legacy `/quotes?sparklines=1` path, kept for one release. */
export async function attachSparklines(cache, quotes, klineDays) {
  const rows = await buildSparklines(
    cache,
    quotes.filter((quote) => !quote.error).map((quote) => quote.symbol),
    klineDays,
  )
  return quotes.map((quote) => (quote.error ? quote : { ...quote, kline: rows[quote.symbol] ?? [] }))
}

export async function klineFor(cache, symbol, period, adjust, limit, refresh = false) {
  const verbose = MINUTE_PERIODS.has(period)
  const key = `${symbol}:${period}:${adjust}:${limit}`
  const ttl = verbose ? MINUTE_KLINE_TTL_MS : KLINE_TTL_MS
  const cached = cache.klines.get(key)
  const retry = cached && cached.rows.length > 0 ? ttl : KLINE_RETRY_MS
  if (!refresh && cached && Date.now() - cached.at <= retry) return { rows: cached.rows, source: 'cache' }

  let rows = []
  let source = 'tencent'
  try {
    rows = verbose
      ? await tencent.fetchMinuteKline(symbol, period, limit)
      : await tencent.fetchKline(symbol, period, adjust, limit)
  } catch (error) {
    console.error('[stock-ticker] tencent kline failed', symbol, messageOf(error))
  }

  if (rows.length === 0) {
    try {
      rows = await eastmoney.fetchKline(symbol, period, adjust, limit)
      if (rows.length > 0) source = 'eastmoney'
    } catch (error) {
      console.error('[stock-ticker] eastmoney kline failed', symbol, messageOf(error))
    }
  }

  rememberKline(cache, key, rows)
  return { rows, source }
}

/**
 * Intraday points for one to five days. A-share multi-day comes from Tencent's
 * five-day endpoint; everything else falls back to Eastmoney's `trends2`, which
 * is the only provider that serves Hong Kong and US intraday in one call.
 */
export async function trendFor(cache, symbol, days = 1, refresh = false) {
  const wanted = Math.max(1, Math.min(days, 5))
  const key = `${symbol}:${wanted}`
  const market = marketOf(symbol)
  const ttl = market === 'cn' ? TREND_TTL_LIVE_MS : TREND_TTL_CLOSED_MS
  const cached = cache.trends.get(key)
  if (!refresh && cached && Date.now() - cached.at <= ttl) return cached.value

  let result
  let lastError
  // Tencent answers a single day for A-shares and Hong Kong, five days for
  // A-shares only, and one lone point for the US — so the multi-day ask goes to
  // Eastmoney for every market and Tencent only gets the single-day question.
  if (wanted > 1 && (market === 'cn' || market === 'hk')) {
    try {
      result = await tencent.fetchTrendDays(symbol, wanted)
    } catch (error) {
      lastError = error
    }
  } else if (wanted === 1) {
    try {
      result = await tencent.fetchTrend(symbol)
    } catch (error) {
      lastError = error
    }
  }
  if (!result) {
    try {
      result = await eastmoney.fetchTrend(symbol, wanted)
    } catch (error) {
      lastError = lastError ?? error
    }
  }
  if (!result) {
    if (wanted > 1 && market === 'us' && lastError) throw new Error('美股暂无分时数据')
    throw lastError ?? new Error('分时数据不可用')
  }

  if (typeof result.prevClose !== 'number') {
    const quote = (await buildQuotes(cache, [symbol]).catch(() => null))?.quotes?.find(
      (row) => row.symbol === symbol && !row.error,
    )
    result.prevClose = typeof quote?.prevClose === 'number' ? quote.prevClose : null
  }

  // `amount` only exists to compute the running average, which is done; sending
  // 1300 of them nearly doubles a five-day line. Points are also thinned to what
  // a 640 px chart can actually show.
  const lean = result.points.map((point) => ({
    time: point.time,
    ...(point.day ? { day: point.day } : {}),
    price: point.price,
    ...(typeof point.volume === 'number' ? { volume: point.volume } : {}),
    ...(typeof point.avg === 'number' ? { avg: point.avg } : {}),
  }))
  const value = {
    symbol,
    market,
    day: result.days?.[result.days.length - 1] ?? '',
    days: result.days ?? [],
    prevClose: result.prevClose ?? null,
    points: sampleTrend(lean),
  }
  cache.trends.set(key, { at: Date.now(), value })
  if (cache.trends.size > 120) {
    for (const stale of [...cache.trends.keys()].slice(0, cache.trends.size - 120)) cache.trends.delete(stale)
  }
  return value
}

/**
 * Same-time volume baseline for the most recent intraday day.
 *
 * `points` are chronological and carry a `day` label. The last day is "today";
 * the N days before it are averaged for each minute-of-day, which is what
 * answers "is this minute's volume larger than usual at this time?". The
 * average is unit-agnostic as long as every day comes from the same source and
 * market (Tencent serves CN lots and HK shares consistently).
 *
 * @param points - intraday points from one multi-day answer.
 * @param baselineDays - how many prior days to average (capped by what exists).
 * @returns the latest day's points, its key, and the per-time baseline.
 */
export function buildVolumeBaseline(points, baselineDays = 4) {
  const groups = new Map()
  const order = []
  for (const point of points) {
    const key = typeof point.day === 'string' ? point.day : ''
    if (!groups.has(key)) {
      groups.set(key, [])
      order.push(key)
    }
    groups.get(key).push(point)
  }
  const day = order[order.length - 1] ?? ''
  const today = groups.get(day) ?? []
  const priorKeys = order.slice(-(Math.max(1, baselineDays) + 1), -1)
  const prior = priorKeys.map((key) => {
    const byTime = new Map()
    for (const point of groups.get(key) ?? []) {
      if (typeof point.volume === 'number') byTime.set(point.time, point.volume)
    }
    return byTime
  })
  const baseline = today.map((point) => {
    const values = prior.map((byTime) => byTime.get(point.time)).filter((value) => typeof value === 'number')
    return {
      time: point.time,
      volume: values.length > 0 ? Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 100) / 100 : null,
    }
  })
  return { day, points: today, baseline, priorDays: prior.length }
}

/**
 * Today's intraday line plus the same-time volume baseline of the previous
 * days. Tencent's five-day endpoint already carries both, so no archive is
 * needed for a five-session comparison; a longer window would need one.
 */
export async function trendWithBaseline(cache, symbol, baselineDays = 4, refresh = false) {
  const wanted = Math.max(1, Math.min(4, baselineDays))
  const key = `${symbol}:b${wanted}`
  const ttl = marketOf(symbol) === 'cn' ? TREND_TTL_LIVE_MS : TREND_TTL_CLOSED_MS
  const cached = cache.trends.get(key)
  if (!refresh && cached && Date.now() - cached.at <= ttl) return cached.value

  let value
  try {
    if (marketOf(symbol) === 'us') throw new Error('美股暂无分时数据')
    const multi = await tencent.fetchTrendDays(symbol, wanted + 1)
    const built = buildVolumeBaseline(multi.points, wanted)
    const quote = (await buildQuotes(cache, [symbol]).catch(() => null))?.quotes?.find(
      (row) => row.symbol === symbol && !row.error,
    )
    value = {
      symbol,
      market: marketOf(symbol),
      day: built.day,
      days: built.day ? [built.day] : [],
      prevClose: typeof quote?.prevClose === 'number' ? quote.prevClose : null,
      points: built.points,
      baseline: built.baseline,
      baselineDays: built.priorDays,
    }
  } catch (error) {
    // A missing five-day answer must not lose the chart: fall back to the
    // single-day line without a baseline.
    const fallback = await trendFor(cache, symbol, 1, refresh).catch(() => null)
    if (!fallback) throw error
    value = { ...fallback, baseline: [], baselineDays: 0 }
  }

  cache.trends.set(key, { at: Date.now(), value })
  if (cache.trends.size > 120) {
    for (const stale of [...cache.trends.keys()].slice(0, cache.trends.size - 120)) cache.trends.delete(stale)
  }
  return value
}

/**
 * Thin an intraday line down to what the chart can draw. Keeping the first and
 * last point matters: they anchor the opening and the latest price.
 */
export function sampleTrend(points, max = 900) {
  if (!Array.isArray(points)) return []
  if (points.length <= max) return points
  const step = Math.ceil(points.length / max)
  const out = []
  for (let index = 0; index < points.length; index += step) out.push(points[index])
  const last = points[points.length - 1]
  if (out[out.length - 1] !== last) out.push(last)
  return out
}

/** Search every provider that can answer and merge the hits, deduped by symbol. */
export async function searchSymbols(query, limit = 8) {
  const [eastmoneyHits, tencentHits] = await Promise.all([
    eastmoney.search(query, limit).catch(() => []),
    tencentSearch(query, limit).catch(() => []),
  ])
  const seen = new Set()
  const merged = []
  for (const hit of [...eastmoneyHits, ...tencentHits]) {
    if (seen.has(hit.symbol)) continue
    seen.add(hit.symbol)
    merged.push(hit)
  }
  return merged.slice(0, limit)
}

/**
 * Tencent's search box is the fallback for the cases its suggest endpoint knows
 * better than Eastmoney (Hong Kong and US tickers, and Chinese pinyin).
 */
async function tencentSearch(query, limit) {
  const text = await getGbkText(
    `https://smartbox.gtimg.cn/s3/?v=2&q=${encodeURIComponent(query)}&t=all`,
    { headers: { Referer: 'https://gu.qq.com/' } },
  )
  const match = /v_hint="([^"]*)"/.exec(text)
  if (!match || match[1] === '' || /none_match/.test(match[1])) return []
  return match[1]
    .replace(/\\u([0-9a-f]{4})/gi, (_, hex) => String.fromCharCode(Number.parseInt(hex, 16)))
    .split('^')
    .map((row) => row.split('~'))
    .filter((parts) => parts.length >= 5 && /^(sh|sz|bj|hk|us)$/i.test(parts[0]))
    .map(([market, code, name, , type]) => ({
      symbol: market.toLowerCase() === 'us' ? `us${code.toUpperCase()}` : `${market.toLowerCase()}${String(code).toLowerCase()}`,
      code,
      name,
      market: market.toLowerCase() === 'us' ? 'us' : market.toLowerCase() === 'hk' ? 'hk' : 'cn',
      type,
      source: 'tencent',
    }))
    .slice(0, limit)
}

function messageOf(error) {
  return error instanceof Error ? error.message : String(error)
}
