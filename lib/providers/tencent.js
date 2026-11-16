/**
 * Tencent's public endpoints — the primary source.
 *
 * Quote:  `qt.gtimg.cn/q=`                     GBK, one `v_<symbol>="f0~f1~..."` row each.
 * K-line: `proxy.finance.qq.com/.../newfqkline` JSON, qfq/hfq/none.
 * Minute: `.../kline/mkline`                   5/15/30/60-minute bars.
 * Intraday:`.../minute/query`                  one day of minute points.
 * Multi-day:`web.ifzq.gtimg.cn/appstock/app/day/query` five days of minute points.
 *
 * Field positions differ per venue, so the extras beyond price/OHLC/volume are
 * read only for A-shares, where they are verified: 36 volume (lots), 37 turnover
 * (万元), 38 turnover rate, 39 P/E, 43 amplitude, 44/45 market caps (亿),
 * 46 P/B, 47/48 up/down limits, 49 volume ratio.
 */

import { getGbkText, getJson } from '../http.js'
import { isIndexSymbol, klineSymbolCandidates, marketOf } from '../symbols.js'

const TEN_QUOTE = 'https://qt.gtimg.cn/q='
const TEN_KLINE = 'https://proxy.finance.qq.com/ifzqgtimg/appstock/app/newfqkline/get'
const TEN_MKLINE = 'https://proxy.finance.qq.com/ifzqgtimg/appstock/app/kline/mkline'
const TEN_TREND = 'https://proxy.finance.qq.com/ifzqgtimg/appstock/app/minute/query'
const TEN_DAY = 'https://web.ifzq.gtimg.cn/appstock/app/day/query'

export async function fetchQuotes(symbols) {
  const text = await getGbkText(`${TEN_QUOTE}${symbols.map(encodeURIComponent).join(',')}`, {
    headers: { Referer: 'https://gu.qq.com/' },
  })
  const rows = new Map()
  const pattern = /v_([a-z0-9._-]+)="([^"]*)"/gi
  let match
  while ((match = pattern.exec(text)) !== null) rows.set(match[1].toLowerCase(), match[2].split('~'))

  const quotes = symbols.map((symbol) => {
    const fields = rows.get(symbol.toLowerCase())
    if (!fields || fields.length < 35 || !fields[1]) return { symbol, error: 'no-data' }
    return parseQuote(symbol, fields)
  })
  // Judge the answer by what parsed, not by whether the payload contains a
  // `v_…="` sequence: a trimmed field list still matches that regex and would
  // pin the whole strip to `--` while the health probe reports `ok`.
  if (quotes.every((quote) => quote.error)) throw new Error('tencent answered without a parseable quote row')
  return quotes
}

export function parseQuote(symbol, fields) {
  const market = marketOf(symbol)
  const quote = {
    symbol,
    market,
    source: 'tencent',
    name: fields[1],
    code: fields[2],
    price: asNumber(fields[3]),
    prevClose: asNumber(fields[4]),
    open: asNumber(fields[5]),
    volume: asNumber(fields[6]),
    time: fields[30],
    change: asNumber(fields[31]),
    changePct: asNumber(fields[32]),
    high: asNumber(fields[33]),
    low: asNumber(fields[34]),
  }
  // During the 09:15-09:30 call auction, Tencent can leave the last-traded
  // price at 0 while the virtual match price is already in bid1/ask1. Indices
  // publish a normal price during the same window, which is why the board
  // moved and individual stocks looked empty.
  if (market === 'cn' && (quote.price === null || quote.price === 0)) {
    const bid = asNumber(fields[9])
    const ask = asNumber(fields[19])
    const auction = [bid, ask].find((value) => typeof value === 'number' && value > 0)
    if (auction) {
      quote.price = auction
      quote.preopen = true
      if (typeof quote.prevClose === 'number' && quote.prevClose > 0) {
        quote.change = round(auction - quote.prevClose, 3)
        quote.changePct = round(((auction - quote.prevClose) / quote.prevClose) * 100, 2)
      }
      if (quote.high === null || quote.high === 0) quote.high = auction
      if (quote.low === null || quote.low === 0) quote.low = auction
    }
  }
  if (quote.price === null || quote.price === 0) return { symbol, error: 'no-data' }

  if (market === 'cn') {
    quote.amount = scaleWan(asNumber(fields[37]))
    quote.extras = {
      turnover: asNumber(fields[38]),
      pe: asNumber(fields[39]),
      amplitude: asNumber(fields[43]),
      floatCap: asNumber(fields[44]),
      totalCap: asNumber(fields[45]),
      pb: asNumber(fields[46]),
      limitUp: asNumber(fields[47]),
      limitDown: asNumber(fields[48]),
      volumeRatio: asNumber(fields[49]),
    }
  } else {
    // Hong Kong and US rows put turnover in 37 and market cap in 44/45 as well,
    // but the units differ per venue; only the shared fields are trusted here.
    quote.amount = asNumber(fields[37])
    if (market === 'hk') {
      quote.extras = {
        pe: asNumber(fields[39]),
        amplitude: asNumber(fields[43]),
        totalCap: asNumber(fields[45]),
        pb: asNumber(fields[46]),
        limitUp: null,
        limitDown: null,
      }
    }
  }

  const bids = []
  const asks = []
  for (let level = 0; level < 5; level += 1) {
    bids.push({ price: asNumber(fields[9 + level * 2]), volume: asNumber(fields[10 + level * 2]) })
    asks.push({ price: asNumber(fields[19 + level * 2]), volume: asNumber(fields[20 + level * 2]) })
  }
  const hasDepth =
    bids.some((level) => level.volume !== null && level.volume > 0) ||
    asks.some((level) => level.volume !== null && level.volume > 0)
  if (hasDepth) {
    const bidVolume = bids.reduce((sum, level) => sum + (level.volume ?? 0), 0)
    const askVolume = asks.reduce((sum, level) => sum + (level.volume ?? 0), 0)
    const total = bidVolume + askVolume
    quote.depth = { bids, asks, ratio: total > 0 ? ((bidVolume - askVolume) / total) * 100 : null }
  }
  return quote
}

/**
 * Tencent wants the venue suffix on US tickers (`usAAPL.OQ`), which its quote
 * answer already carries; A-share, Hong Kong and index symbols go through as-is.
 * The suffix is cached on the first successful K-line read.
 */
const klineSymbolCache = new Map()

export async function fetchKline(symbol, period, adjust, limit) {
  const candidates = klineSymbolCandidates(symbol)
  const cached = klineSymbolCache.get(symbol)
  // A cached venue suffix is tried first, but not trusted: US *indices* answer
  // exactly one bar for a suffixed symbol (`usIXIC.OQ` → today only) while the
  // bare `usIXIC` answers the whole page. A cache filled from the short answer
  // would keep the chart empty until the app restarted.
  const ordered = cached && candidates.includes(cached)
    ? [cached, ...candidates.filter((candidate) => candidate !== cached)]
    : candidates
  const page = Math.min(Number.isFinite(limit) ? limit : 10, 10)
  let best = { candidate: undefined, rows: [] }
  for (const candidate of ordered) {
    try {
      const rows = await fetchPeriodKline(candidate, period, adjust, limit)
      if (rows.length > best.rows.length) best = { candidate, rows }
      // A full page is enough; a short one means this spelling is a dud.
      if (best.rows.length >= page) break
    } catch (error) {
      console.error('[stock-ticker] kline failed', candidate, messageOf(error))
    }
  }
  if (best.rows.length === 0) return []
  if (/^us/i.test(symbol)) klineSymbolCache.set(symbol, best.candidate)
  if (best.rows.length < limit && best.candidate) {
    best.rows = await extendKline(best.candidate, period, adjust, limit, best.rows)
  }
  return best.rows
}

/** Tencent caps one page at 640 bars; walk backwards for 3/5-year requests. */
async function extendKline(symbol, period, adjust, limit, first) {
  let rows = first
  let guard = 0
  while (rows.length < limit && guard < 8) {
    guard += 1
    const oldest = rows[0]?.date
    if (!oldest) break
    const older = await fetchPeriodKline(symbol, period, adjust, Math.min(640, limit), oldest)
    if (older.length === 0) break
    const merged = new Map()
    for (const row of [...older, ...rows]) merged.set(row.date, row)
    const next = [...merged.values()].sort((left, right) => String(left.date).localeCompare(String(right.date)))
    if (next.length <= rows.length) break
    rows = next.slice(-limit)
  }
  return rows
}

export async function fetchPeriodKline(symbol, period, adjust, limit, end = '') {
  const adjustParam = adjust === 'none' ? '' : adjust
  const url = `${TEN_KLINE}?param=${encodeURIComponent(`${symbol},${period},,${end},${limit},${adjustParam}`)}`
  const payload = await getJson(url, { headers: { Referer: 'https://gu.qq.com/' } })
  const node = payload?.data?.[symbol]
  const rows = node?.[`${adjustParam}${period}`] ?? node?.[period]
  if (!Array.isArray(rows)) return []
  return rows.map(parseKlineRow).filter((row) => row.close !== null)
}

export async function fetchMinuteKline(symbol, period, limit) {
  const url = `${TEN_MKLINE}?param=${encodeURIComponent(`${symbol},${period},,${limit}`)}`
  const payload = await getJson(url, { headers: { Referer: 'https://gu.qq.com/' } })
  const node = payload?.data?.[symbol]
  const rows = node?.[period]
  if (!Array.isArray(rows)) return []
  return rows.map(parseKlineRow).filter((row) => row.close !== null)
}

function parseKlineRow(row) {
  return {
    date: String(row?.[0] ?? ''),
    open: asNumber(row?.[1]),
    close: asNumber(row?.[2]),
    high: asNumber(row?.[3]),
    low: asNumber(row?.[4]),
    volume: asNumber(row?.[5]),
  }
}

/**
 * One day of minute points. The minute rows carry running totals (the last
 * row's volume equals the quote's own volume), so the running average is just
 * that row's ratio — not the sum of the column, which would weight every minute
 * twice.
 */
export async function fetchTrend(symbol) {
  const payload = await getJson(`${TEN_TREND}?code=${encodeURIComponent(symbol)}`, {
    headers: { Referer: 'https://gu.qq.com/' },
  })
  const node = payload?.data?.[symbol]
  const rows = node?.data?.data
  if (!Array.isArray(rows) || rows.length < 2) throw new Error('分时数据不可用')

  const quoteFields = node?.qt?.[symbol]
  const prevClose = Array.isArray(quoteFields) ? asNumber(quoteFields[4]) : null
  const date = node?.data?.date ?? ''
  const points = buildTrendPoints(rows, marketOf(symbol), date || undefined, isIndexSymbol(symbol), symbol)
  if (points.length < 2) throw new Error('分时数据不可用')
  return { points, prevClose, days: date ? [date] : [] }
}

/**
 * Five days of minute points, newest day first in Tencent's answer. Each day's
 * volume and turnover restart at the open, so the running average has to restart
 * with them — carrying the accumulator across the boundary would flatten the
 * whole line towards a week-long average.
 */
export async function fetchTrendDays(symbol, days) {
  // Tencent's day/query serves A-shares and Hong Kong; the US only answers a
  // single lonely point, so it is rejected by the caller's fallback chain.
  if (marketOf(symbol) === 'us') throw new Error('美股暂无分时数据')
  const payload = await getJson(`${TEN_DAY}?code=${encodeURIComponent(symbol)}`, {
    headers: { Referer: 'https://gu.qq.com/' },
  })
  const node = payload?.data?.[symbol]
  const dayNodes = Array.isArray(node?.data) ? node.data : []
  if (dayNodes.length === 0) throw new Error('分时数据不可用')

  const wanted = dayNodes.slice(0, Math.max(1, Math.min(days, dayNodes.length)))
  const ordered = [...wanted].reverse()
  const points = []
  const labels = []
  for (const dayNode of ordered) {
    const date = String(dayNode?.date ?? '')
    const rows = Array.isArray(dayNode?.data) ? dayNode.data : []
    labels.push(date)
    points.push(...buildTrendPoints(rows, marketOf(symbol), date, isIndexSymbol(symbol), symbol))
  }
  if (points.length < 2) throw new Error('分时数据不可用')
  return { points, prevClose: null, days: labels }
}

export function buildTrendPoints(rows, market, day, index = false, symbol = '') {
  // Most A-share rows count lots (100 shares), but STAR Market (688/689)
  // reports shares directly. Dividing those by 100 flattens the running
  // average and blows up the percentage scale. Hong Kong and US already use
  // shares as well.
  const lotSize = market === 'cn' && !/^sh68[89]/i.test(symbol) ? 100 : 1
  let tradedVolume = 0
  let tradedAmount = 0
  let priceSum = 0
  let priceCount = 0
  const points = []
  for (const row of rows) {
    const [time, priceText, volumeText, amountText] = String(row).split(/\s+/)
    const price = asNumber(priceText)
    if (price === null) continue
    const volume = asNumber(volumeText)
    const amount = asNumber(amountText)
    priceSum += price
    priceCount += 1
    // Tencent's minute rows carry the day's cumulative volume, which is only
    // useful for the running average; the chart needs the bar for this minute.
    let minuteVolume = null
    if (volume !== null && volume > 0) {
      if (volume >= tradedVolume) {
        minuteVolume = volume - tradedVolume
        tradedVolume = volume
        tradedAmount = amount ?? tradedAmount
      } else {
        // A source that switches to per-minute increments must not make the
        // average jump backwards.
        minuteVolume = volume
        tradedVolume += volume
        tradedAmount += amount ?? 0
      }
    } else if (volume === 0) {
      minuteVolume = 0
    }
    points.push({
      time,
      day,
      price,
      volume: minuteVolume,
      amount,
      // An index has no per-share turnover: its amount/volume ratio is not the
      // index level, so the average is the cumulative mean of the quoted
      // values. Stocks keep the turnover-weighted average.
      avg: index
        ? round(priceSum / priceCount, 3)
        : tradedVolume > 0 && tradedAmount > 0
          ? round(tradedAmount / (tradedVolume * lotSize), 3)
          : null,
    })
  }
  return points
}

/** Tencent reports turnover in 万元; the Client half shows 元. */
function scaleWan(value) {
  return value === null ? null : round(value * 10_000, 0)
}

export function asNumber(value) {
  const number = Number.parseFloat(value)
  return Number.isFinite(number) ? number : null
}

export function round(value, digits) {
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}

function messageOf(error) {
  return error instanceof Error ? error.message : String(error)
}
