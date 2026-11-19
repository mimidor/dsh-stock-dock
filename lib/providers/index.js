/**
 * Source orchestration: primary source, per-symbol recovery, cache and TTLs.
 *
 * Quote cadence is deliberately short (3 s) because the strip polls a page that
 * is usually already open; history is longer because a K-line page for a closed
 * day cannot change, and a failed history read is retried after a minute rather
 * than on every poll.
 */

import { QUOTES_MAX_ENTRIES, readFresh, rememberKline, rememberTrend, setBounded } from '../cache.js'
import { getGbkText } from '../http.js'
import { extendedWindow, marketClock, marketState, todayIn } from '../session.js'
import { marketOf } from '../symbols.js'
import * as eastmoney from './eastmoney.js'
import * as nasdaq from './nasdaq.js'
import * as sina from './sina.js'
import * as tencent from './tencent.js'

export const QUOTE_TTL_MS = 3000
export const KLINE_TTL_MS = 5 * 60 * 1000
export const MINUTE_KLINE_TTL_MS = 15 * 1000
export const TREND_TTL_LIVE_MS = 20 * 1000
export const TREND_TTL_CLOSED_MS = 5 * 60 * 1000
export const KLINE_RETRY_MS = 60 * 1000
export const SOURCE_COOLDOWN_MS = 30 * 1000
/** The pre/post-market snapshot is a separate, slower-moving request. */
export const EXTENDED_TTL_MS = 60 * 1000

const MINUTE_PERIODS = new Set(['m1', 'm5', 'm15', 'm30', 'm60'])
const CLOSED_TTL_MS = 30 * 60 * 1000
/** One background revalidation per cache key, even if many polls arrive. */
const revalidating = new WeakMap()

function refreshInBackground(cache, key, task, label, symbol) {
  let active = revalidating.get(cache)
  if (!active) {
    active = new Set()
    revalidating.set(cache, active)
  }
  if (active.has(key)) return
  active.add(key)
  void task()
    .catch((error) => {
      console.error(`[stock-ticker] ${label} revalidate failed`, symbol, messageOf(error))
    })
    .finally(() => active.delete(key))
}

/** The chart's data is immutable while its market is shut, so stop re-asking. */
function marketPhase(symbol) {
  const market = marketOf(symbol)
  return marketState(market, marketClock(market))
}

function klineTtl(symbol, verbose) {
  if (marketPhase(symbol) !== 'trading') return CLOSED_TTL_MS
  return verbose ? MINUTE_KLINE_TTL_MS : KLINE_TTL_MS
}

function trendTtl(symbol) {
  if (marketPhase(symbol) !== 'trading') return CLOSED_TTL_MS
  return marketOf(symbol) === 'cn' ? TREND_TTL_LIVE_MS : TREND_TTL_CLOSED_MS
}

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
  setBounded(cache.quotes, key, { at: Date.now(), bundle }, QUOTES_MAX_ENTRIES)
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

function minuteDate(value) {
  const text = String(value ?? '')
  if (/^\d{12}$/.test(text)) return text
  if (/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(?::\d{2})?$/.test(text)) {
    return text.replace(/\D/g, '').slice(0, 12)
  }
  return ''
}

function mergeKlineRows(base, incoming) {
  const byDate = new Map()
  for (const row of [...base, ...incoming]) {
    const date = minuteDate(row?.date)
    if (date) byDate.set(date, date === row.date ? row : { ...row, date })
  }
  return [...byDate.values()].sort((left, right) => String(left.date).localeCompare(String(right.date)))
}

/** A yearly bar never needs more than the full history the sources can serve. */
const YEAR_MONTH_CAP = 1300

function larger(left, right) {
  if (typeof right !== 'number' || !Number.isFinite(right)) return left
  return typeof left === 'number' && Number.isFinite(left) ? Math.max(left, right) : right
}

function smaller(left, right) {
  if (typeof right !== 'number' || !Number.isFinite(right)) return left
  return typeof left === 'number' && Number.isFinite(left) ? Math.min(left, right) : right
}

/**
 * Roll monthly bars up into calendar-year bars. The date becomes the bare year
 * so the category axis and the tooltip read `2026` instead of a month-end day.
 * Open is the first month's open, close the last month's close, high/low the
 * extremes and volume the sum; a missing volume stays missing instead of
 * silently becoming zero.
 */
export function aggregateYearRows(rows) {
  const groups = new Map()
  const ordered = [...rows].sort((left, right) => String(left?.date ?? '').localeCompare(String(right?.date ?? '')))
  for (const row of ordered) {
    const digits = String(row?.date ?? '').replace(/\D/g, '')
    if (digits.length < 4) continue
    const year = digits.slice(0, 4)
    const volume = typeof row.volume === 'number' && Number.isFinite(row.volume) ? row.volume : null
    const current = groups.get(year)
    if (!current) {
      groups.set(year, {
        date: year,
        open: typeof row.open === 'number' ? row.open : null,
        close: typeof row.close === 'number' ? row.close : null,
        high: typeof row.high === 'number' ? row.high : null,
        low: typeof row.low === 'number' ? row.low : null,
        volume,
      })
      continue
    }
    if (typeof row.close === 'number' && Number.isFinite(row.close)) current.close = row.close
    current.high = larger(current.high, row.high)
    current.low = smaller(current.low, row.low)
    if (volume !== null) current.volume = (current.volume ?? 0) + volume
  }
  return [...groups.values()]
}

/** Eastmoney answers `YYYY-12-31`; every other period uses a full date too. */
function normalizeYearRows(rows) {
  const byYear = new Map()
  for (const row of rows) {
    const digits = String(row?.date ?? '').replace(/\D/g, '')
    if (digits.length < 4) continue
    byYear.set(digits.slice(0, 4), { ...row, date: digits.slice(0, 4) })
  }
  return [...byYear.values()].sort((left, right) => left.date.localeCompare(right.date))
}

/** Scale a yearly series by a positive factor, keeping a missing price missing. */
function scaleYearRows(rows, factor) {
  if (!Number.isFinite(factor) || factor <= 0 || factor === 1) return rows
  const scale = (value) => (typeof value === 'number' && Number.isFinite(value) ? value * factor : value)
  return rows.map((row) => ({
    ...row,
    open: scale(row.open),
    close: scale(row.close),
    high: scale(row.high),
    low: scale(row.low),
  }))
}

/**
 * Annual bars. Tencent's `/fqkline/get` does not serve a yearly period (one
 * echo bar), but its `/newfqkline/get` does; Eastmoney's `klt=106` is asked
 * first for a single clean answer, and the monthly pages are rolled up when it
 * is unavailable.
 *
 * 前复权 is built from the 后复权 series normalised to the latest price: the
 * providers' additive 前复权 turns old bars negative once cumulative dividends
 * exceed the old price (茅台 before 2016), which is unusable on a 20-year chart.
 */
async function yearKlineFor(cache, symbol, adjust, limit, refresh) {
  await cache.disk?.ready?.()
  const key = `${symbol}:year:${adjust}:${limit}`
  const ttl = klineTtl(symbol, false)
  const cached = cache.klines.get(key)
  if (!refresh && cached?.rows?.length && Date.now() - cached.at <= ttl) {
    return { rows: cached.rows, source: 'cache' }
  }
  if (!refresh && cached?.rows?.length && marketPhase(symbol) !== 'trading') {
    refreshInBackground(cache, key, () => yearKlineFor(cache, symbol, adjust, limit, true), 'year kline', symbol)
    return { rows: cached.rows, source: 'cache', stale: true }
  }

  // Ask for 后复权 when the caller wants 前复权; the series is rescaled below.
  const sourceAdjust = adjust === 'qfq' ? 'hfq' : adjust
  let rows = []
  let source = ''
  try {
    rows = normalizeYearRows(await eastmoney.fetchKline(symbol, 'year', sourceAdjust, limit))
    if (rows.length > 0) source = 'eastmoney'
  } catch (error) {
    console.error('[stock-ticker] eastmoney year kline failed', symbol, messageOf(error))
  }
  if (rows.length < limit) {
    try {
      const months = Math.min(YEAR_MONTH_CAP, Math.max(12, limit * 12 + 24))
      const monthly = await klineFor(cache, symbol, 'month', sourceAdjust, months)
      const aggregated = aggregateYearRows(monthly.rows)
      if (aggregated.length > rows.length) {
        rows = aggregated
        source = monthly.source === 'cache' ? 'cache' : 'tencent'
      }
    } catch (error) {
      console.error('[stock-ticker] monthly year fallback failed', symbol, messageOf(error))
    }
  }
  if (adjust === 'qfq' && rows.length > 0) {
    try {
      const latest = await klineFor(cache, symbol, 'month', 'none', 1)
      const latestClose = latest.rows.at(-1)?.close
      const adjustedClose = rows.at(-1)?.close
      if (Number.isFinite(latestClose) && Number.isFinite(adjustedClose) && adjustedClose > 0) {
        rows = scaleYearRows(rows, latestClose / adjustedClose)
      }
    } catch (error) {
      console.error('[stock-ticker] year qfq rescale failed', symbol, messageOf(error))
    }
  }
  if (rows.length === 0 && cached?.rows?.length) {
    return { rows: cached.rows, source: 'cache', stale: true }
  }
  rows = rows.slice(-limit)
  if (rows.length > 0 && source !== 'cache') rememberKline(cache, key, rows)
  return { rows, source: source || 'cache' }
}

export async function klineFor(cache, symbol, period, adjust, limit, refresh = false) {
  if (period === 'year') return yearKlineFor(cache, symbol, adjust, limit, refresh)
  await cache.disk?.ready?.()
  const verbose = MINUTE_PERIODS.has(period)
  const market = marketOf(symbol)
  const minuteCap = market === 'cn' ? (period === 'm60' ? 4111 : 5001) : 640
  const effectiveLimit = verbose ? Math.min(limit, minuteCap) : limit
  const prefix = `${symbol}:${period}:${adjust}:`
  const key = `${prefix}${effectiveLimit}`
  const historyKey = `${prefix}history`
  const useHistory = verbose && effectiveLimit > 96
  let history = verbose ? cache.klines.get(historyKey) : undefined
  if (verbose) {
    const pages = [...cache.klines.entries()].filter(([page, entry]) =>
      page.startsWith(prefix) && /^\d+$/.test(page.slice(prefix.length)) &&
      (history || Number(page.slice(prefix.length)) > 96) && entry.rows.length > 0,
    )
    if (pages.length > 0 || (history && history.rows.length > minuteCap)) {
      if (history) pages.push([historyKey, history])
      pages.sort((a, b) => a[1].at - b[1].at)
      const rows = mergeKlineRows([], pages.flatMap(([, entry]) => entry.rows)).slice(-minuteCap)
      for (const [page] of pages) cache.klines.delete(page)
      rememberKline(cache, historyKey, rows, pages.at(-1)[1].at, true)
      history = cache.klines.get(historyKey)
    }
  }
  const completeHistory = history?.rows.length >= effectiveLimit
  const ttl = klineTtl(symbol, verbose)
  const cached = completeHistory
    ? { ...history, rows: history.rows.slice(-effectiveLimit) }
    : useHistory ? undefined : cache.klines.get(key)
  // For a complete history page, refresh just the recent bars and merge them in.
  const fetchLimit = completeHistory ? Math.min(minuteCap, 640) : effectiveLimit
  const retry = cached && cached.rows.length > 0 ? ttl : KLINE_RETRY_MS
  if (!refresh && cached && Date.now() - cached.at <= retry) return { rows: cached.rows, source: 'cache' }

  // Stale-while-revalidate: paint the persisted page now, fetch the tail in the
  // background. The next poll picks up the fresh answer.
  if (!refresh && cached && cached.rows.length > 0 && marketPhase(symbol) !== 'trading') {
    refreshInBackground(cache, key, () => klineFor(cache, symbol, period, adjust, limit, true), 'kline', symbol)
    return { rows: cached.rows, source: 'cache', stale: true }
  }

  let rows = []
  let source = 'tencent'
  if (verbose) {
    let triedSina = false
    // Sina is the only source that serves more than Tencent's 640-bar minute
    // page for A-shares. Keep Tencent for the default 96-bar page and for
    // Hong Kong/US, and only reach for Sina when the request is actually long.
    if (market === 'cn' && fetchLimit > 640) {
      triedSina = true
      try {
        rows = await sina.fetchMinuteKline(symbol, period, fetchLimit)
        if (rows.length > 0) source = 'sina'
      } catch (error) {
        console.error('[stock-ticker] sina minute kline failed', symbol, messageOf(error))
      }
    }
    if (rows.length === 0) {
      try {
        rows = await tencent.fetchMinuteKline(symbol, period, fetchLimit)
      } catch (error) {
        console.error('[stock-ticker] tencent kline failed', symbol, messageOf(error))
      }
    }
    if (market === 'cn' && !triedSina && rows.length < fetchLimit) {
      try {
        const longer = await sina.fetchMinuteKline(symbol, period, fetchLimit)
        if (longer.length > rows.length) {
          rows = longer
          source = 'sina'
        }
      } catch (error) {
        console.error('[stock-ticker] sina minute kline failed', symbol, messageOf(error))
      }
    }
  } else {
    try {
      rows = await tencent.fetchKline(symbol, period, adjust, limit)
    } catch (error) {
      console.error('[stock-ticker] tencent kline failed', symbol, messageOf(error))
    }
  }

  if (!verbose && rows.length > 0 && rows.length < limit) {
    try {
      const full = await eastmoney.fetchKline(symbol, period, adjust, limit)
      if (full.length > rows.length) {
        rows = full
        source = 'eastmoney'
      }
    } catch (error) {
      console.error('[stock-ticker] eastmoney long kline failed', symbol, messageOf(error))
    }
  }
  if (rows.length === 0) {
    try {
      rows = await eastmoney.fetchKline(symbol, period, adjust, fetchLimit)
      if (rows.length > 0) source = 'eastmoney'
    } catch (error) {
      console.error('[stock-ticker] eastmoney kline failed', symbol, messageOf(error))
    }
  }

  if (verbose) {
    rows = rows.map((row) => ({ ...row, date: minuteDate(row.date) }))
      .filter((row) => row.date !== '')
    history = cache.klines.get(historyKey)
  }
  if (rows.length === 0 && history?.rows.length > 0) {
    return { rows: history.rows.slice(-effectiveLimit), source: 'cache', stale: true }
  }
  if (rows.length === 0 && cached && cached.rows.length > 0) {
    return { rows: cached.rows, source: 'cache', stale: true }
  }
  if (verbose && (useHistory || history) && rows.length > 0) {
    const short = cache.klines.get(`${prefix}96`)
    const merged = mergeKlineRows(history?.rows ?? short?.rows ?? [], rows)
    const capped = merged.slice(-minuteCap)
    for (const oldKey of cache.klines.keys()) {
      if (oldKey.startsWith(prefix) && /^\d+$/.test(oldKey.slice(prefix.length))) cache.klines.delete(oldKey)
    }
    rememberKline(cache, historyKey, capped, Date.now(), true)
    return { rows: capped.slice(-effectiveLimit), source }
  }
  if (verbose) rows = rows.slice(-effectiveLimit)
  rememberKline(cache, key, rows)
  return { rows, source }
}

/**
 * Intraday points for one to five days. A-share multi-day comes from Tencent's
 * five-day endpoint; everything else falls back to Eastmoney's `trends2`, which
 * is the only provider that serves Hong Kong and US intraday in one call.
 */
function sanitizeTrendValue(value) {
  if (!value || !Array.isArray(value.points)) return value
  return {
    ...value,
    points: value.points.map((point) => {
      if (typeof point.avg !== 'number' || !Number.isFinite(point.avg) || point.avg <= 0) return point
      if (typeof point.price !== 'number' || point.price <= 0) return { ...point, avg: null }
      return point.avg < point.price / 10 || point.avg > point.price * 10 ? { ...point, avg: null } : point
    }),
  }
}

export async function trendFor(cache, symbol, days = 1, refresh = false) {
  await cache.disk?.ready?.()
  const wanted = Math.max(1, Math.min(days, 5))
  const key = `${symbol}:${wanted}`
  const market = marketOf(symbol)
  const ttl = trendTtl(symbol)
  const cached = cache.trends.get(key)
  if (!refresh && cached && Date.now() - cached.at <= ttl) return sanitizeTrendValue(cached.value)
  // While the market is open, a stale page must not be painted as if it were
  // today's. Different symbols would otherwise show different days depending
  // on which cache entry happened to survive the previous session.
  if (!refresh && cached && cached.value && marketPhase(symbol) !== 'trading') {
    refreshInBackground(cache, key, () => trendFor(cache, symbol, wanted, true), 'trend', symbol)
    return { ...sanitizeTrendValue(cached.value), stale: true }
  }

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
    if (market === 'us') {
      try {
        result = await nasdaq.fetchTrend(symbol)
      } catch (error) {
        lastError = error
      }
    }
    if (!result) {
      try {
        result = await tencent.fetchTrend(symbol)
      } catch (error) {
        lastError = error
      }
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
    if (cached?.value) return { ...sanitizeTrendValue(cached.value), stale: true }
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
    ...(typeof point.avg === 'number' &&
    point.avg > 0 &&
    (typeof point.price !== 'number' || (point.avg >= point.price / 10 && point.avg <= point.price * 10))
      ? { avg: point.avg }
      : {}),
  }))
  const value = {
    symbol,
    market,
    day: result.days?.[result.days.length - 1] ?? '',
    days: result.days ?? [],
    prevClose: result.prevClose ?? null,
    points: sampleTrend(lean),
  }
  const clean = sanitizeTrendValue(value)
  rememberTrend(cache, key, clean)
  return clean
}

/**
 * One historical intraday day. Tencent only serves the latest five days; for
 * older dates we reconstruct from any minute history already on disk. This is
 * deliberately on-demand so opening a daily bar never triggers a fetch until
 * the user asks for its intraday view.
 */
function dayPointsFromMinuteRows(rows, date) {
  const dayRows = rows
    .filter((row) => String(row.date).slice(0, 8) === date)
    .sort((left, right) => String(left.date).localeCompare(String(right.date)))
  if (dayRows.length < 2) return null
  let tradedVolume = 0
  let tradedAmount = 0
  const points = dayRows.map((row) => {
    const close = typeof row.close === 'number' ? row.close : row.open
    const volume = typeof row.volume === 'number' ? row.volume : 0
    tradedVolume += volume
    tradedAmount += close * volume
    return {
      time: String(row.date).slice(8, 12),
      day: date,
      price: close,
      volume,
      avg: tradedVolume > 0 ? Math.round((tradedAmount / tradedVolume) * 1000) / 1000 : close,
    }
  })
  const previous = rows
    .filter((row) => String(row.date).slice(0, 8) < date)
    .sort((left, right) => String(left.date).localeCompare(String(right.date)))
    .at(-1)
  return { points, prevClose: previous?.close ?? null, days: [date] }
}

export async function trendForDate(cache, symbol, rawDate, refresh = false) {
  await cache.disk?.ready?.()
  const date = String(rawDate ?? '').replace(/\D/g, '').slice(0, 8)
  if (!/^\d{8}$/.test(date)) throw new Error('日期格式不正确')
  const key = `${symbol}:d:${date}`
  const market = marketOf(symbol)
  // Today's intraday is partial until the close; caching it would freeze the
  // page at whatever time the user first opened it.
  const complete = date !== todayIn(market).replace(/\D/g, '') || marketPhase(symbol) === 'closed'
  const cached = cache.trends.get(key)
  if (complete && !refresh && cached?.value) return cached.value
  let value = null
  // Tencent's day/query returns the latest five sessions, regardless of its
  // day/date parameter; only use it when the requested day is in that window.
  if (market !== 'us') {
    try {
      const multi = await tencent.fetchTrendDays(symbol, 5)
      const points = (multi.points ?? []).filter((point) => String(point.day) === date)
      if (points.length > 1) {
        const previous = (multi.points ?? [])
          .filter((point) => String(point.day) < date)
          .at(-1)
        value = {
          symbol,
          market,
          day: date,
          days: [date],
          prevClose: previous?.price ?? null,
          points,
          source: 'tencent',
        }
      }
    } catch {
      /* fall through to disk minute history */
    }
  }
  if (!value) {
    const periods = ['m5', 'm15', 'm30', 'm60']
    let best = null
    for (const period of periods) {
      const prefix = `${symbol}:${period}:none:`
      for (const [page, entry] of cache.klines) {
        if (!page.startsWith(prefix) || !Array.isArray(entry?.rows)) continue
        const built = dayPointsFromMinuteRows(entry.rows, date)
        if (built && (!best || built.points.length > best.points.length)) best = built
      }
      if (best) break
    }
    if (best) value = { symbol, market, day: date, days: [date], ...best, source: 'cache' }
  }
  if (!value) throw new Error('该日分时数据不可用')
  value = { ...value, points: sampleTrend(value.points) }
  if (complete) rememberTrend(cache, key, value)
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
  await cache.disk?.ready?.()
  const wanted = Math.max(1, Math.min(4, baselineDays))
  const key = `${symbol}:b${wanted}`
  const ttl = trendTtl(symbol)
  const cached = cache.trends.get(key)
  if (!refresh && cached && Date.now() - cached.at <= ttl) return cached.value
  if (!refresh && cached && cached.value) {
    refreshInBackground(cache, key, () => trendWithBaseline(cache, symbol, wanted, true), 'baseline', symbol)
    return { ...cached.value, stale: true }
  }

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

  rememberTrend(cache, key, value)
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
