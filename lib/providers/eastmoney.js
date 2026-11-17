/**
 * Eastmoney — the third quote source and the search provider.
 *
 * What works from this machine (and is therefore wired in):
 *   `push2.eastmoney.com/api/qt/ulist.np/get`   batch quotes for A/HK/US
 *   `searchapi.eastmoney.com/api/suggest/get`   name / pinyin / code search
 *
 * What is attempted but frequently refused by the server (empty reply, the same
 * TLS/host behaviour PerryLink documented): the `push2his` K-line and
 * `trends2` intraday endpoints. They are still implemented because they work on
 * other networks, but they are gated behind a health flag so a refused host
 * costs one timeout every five minutes instead of one per request.
 */

import { getJson } from '../http.js'
import { isIndexSymbol, marketOf, secidCandidates, symbolFromSecid } from '../symbols.js'

const EM_BATCH = 'https://push2.eastmoney.com/api/qt/ulist.np/get'
const EM_KLINE = 'https://push2his.eastmoney.com/api/qt/stock/kline/get'
const EM_TREND = 'https://push2his.eastmoney.com/api/qt/stock/trends2/get'
const EM_SUGGEST = 'https://searchapi.eastmoney.com/api/suggest/get'
const EM_TOKEN = 'D43BF722C8E33BDC906FB84D85E326E8'

const QUOTE_FIELDS = 'f2,f3,f4,f5,f6,f8,f9,f10,f12,f13,f14,f15,f16,f17,f18,f20,f21'

const KLT = { day: 101, week: 102, month: 103, year: 106, m5: 5, m15: 15, m30: 30, m60: 60 }
const FQT = { qfq: 1, hfq: 2, none: 0 }

/** A host that refuses the history endpoints is retried after this long. */
const HISTORY_COOLDOWN_MS = 5 * 60 * 1000
let historyDownUntil = 0

function historyUsable() {
  return Date.now() >= historyDownUntil
}

function markHistoryDown() {
  historyDownUntil = Date.now() + HISTORY_COOLDOWN_MS
}

export function historyHealth() {
  return historyUsable() ? 'ok' : 'down'
}

/**
 * Batch quotes. Every US ticker is asked for under all three exchange ids and
 * the answer keeps whichever row came back, which is how a bare `usAAPL` gets
 * resolved without a separate lookup call.
 */
export async function fetchQuotes(symbols) {
  const plan = symbols.map(secidCandidates)
  const secids = [...new Set(plan.flat())]
  if (secids.length === 0) return symbols.map((symbol) => ({ symbol, error: 'no-data' }))

  const url = `${EM_BATCH}?fltt=2&invt=2&np=1&dect=1&fields=${QUOTE_FIELDS}&secids=${encodeURIComponent(secids.join(','))}`
  const payload = await getJson(url, { headers: { Referer: 'https://quote.eastmoney.com/' } })
  const rows = Array.isArray(payload?.data?.diff)
    ? payload.data.diff
    : payload?.data?.diff
      ? Object.values(payload.data.diff)
      : []

  const bySecid = new Map()
  for (const row of rows) {
    bySecid.set(`${row.f13}.${row.f12}`, row)
  }

  return symbols.map((symbol, index) => {
    const candidates = plan[index] ?? []
    const hit = candidates.map((secid) => bySecid.get(secid)).find((row) => row !== undefined)
    if (!hit) return { symbol, error: 'no-data' }
    return parseRow(symbol, hit)
  })
}

export function parseRow(symbol, row) {
  const market = marketOf(symbol)
  const quote = {
    symbol,
    market,
    source: 'eastmoney',
    name: row.f14,
    code: row.f12,
    price: asNumber(row.f2),
    prevClose: asNumber(row.f18),
    open: asNumber(row.f17),
    high: asNumber(row.f15),
    low: asNumber(row.f16),
    change: asNumber(row.f4),
    changePct: asNumber(row.f3),
    volume: asNumber(row.f5),
    amount: asNumber(row.f6),
    extras: {
      turnover: asNumber(row.f8),
      pe: asNumber(row.f9),
      volumeRatio: asNumber(row.f10),
      totalCap: asNumber(row.f20),
      floatCap: asNumber(row.f21),
      limitUp: null,
      limitDown: null,
    },
  }
  if (quote.price === null) return { symbol, error: 'no-data' }
  if (market === 'us') delete quote.extras.turnover
  return quote
}

/**
 * Search by code, name or pinyin. Sectors (`90.*`) and CSI index codes (`2.*`)
 * cannot be quoted by the providers this plugin uses, so they are filtered out
 * instead of being offered as a dead watchlist entry.
 */
export async function search(query, limit = 8) {
  const text = String(query ?? '').trim()
  if (text === '') return []
  const url = `${EM_SUGGEST}?input=${encodeURIComponent(text)}&type=14&token=${EM_TOKEN}&count=${Math.max(1, Math.min(limit, 20))}`
  const payload = await getJson(url, { headers: { Referer: 'https://www.eastmoney.com/' } })
  const rows = Array.isArray(payload?.QuotationCodeTable?.Data) ? payload.QuotationCodeTable.Data : []
  const items = []
  const seen = new Set()
  for (const row of rows) {
    const symbol = symbolFromSecid(row?.MktNum, row?.Code)
    if (!symbol || seen.has(symbol)) continue
    seen.add(symbol)
    items.push({
      symbol,
      code: String(row.Code ?? ''),
      name: String(row.Name ?? ''),
      market: marketOf(symbol),
      type: String(row.SecurityTypeName ?? ''),
      source: 'eastmoney',
    })
    if (items.length >= limit) break
  }
  return items
}

export async function fetchKline(symbol, period, adjust, limit) {
  if (!historyUsable()) throw new Error('eastmoney history unavailable')
  const secids = secidCandidates(symbol)
  const klt = KLT[period] ?? KLT.day
  const fqt = FQT[adjust] ?? FQT.qfq
  const fields1 = 'f1,f2,f3,f4,f5,f6'
  const fields2 = 'f51,f52,f53,f54,f55,f56,f57,f58'

  for (const secid of secids) {
    const url = `${EM_KLINE}?secid=${encodeURIComponent(secid)}&klt=${klt}&fqt=${fqt}&lmt=${limit}&end=20500101&fields1=${fields1}&fields2=${fields2}`
    try {
      const payload = await getJson(url, { headers: { Referer: 'https://quote.eastmoney.com/' }, timeoutMs: 6000 })
      const rows = Array.isArray(payload?.data?.klines) ? payload.data.klines : []
      if (rows.length === 0) continue
      return rows.map(parseKlineRow).filter((row) => row.close !== null)
    } catch {
      markHistoryDown()
      break
    }
  }
  return []
}

function parseKlineRow(line) {
  const parts = String(line).split(',')
  return {
    date: String(parts[0] ?? ''),
    open: asNumber(parts[1]),
    close: asNumber(parts[2]),
    high: asNumber(parts[3]),
    low: asNumber(parts[4]),
    volume: asNumber(parts[5]),
  }
}

/**
 * Intraday points, up to five days. Column 8 is the running average price; when
 * it is missing it is recomputed from turnover over volume so the client always
 * has something to draw.
 */
export async function fetchTrend(symbol, days = 1) {
  if (!historyUsable()) throw new Error('eastmoney history unavailable')
  const secid = secidCandidates(symbol)[0]
  const fields1 = 'f1,f2,f3,f4,f5,f6,f7,f8'
  const fields2 = 'f51,f52,f53,f54,f55,f56,f57,f58'
  const url = `${EM_TREND}?secid=${encodeURIComponent(secid)}&ndays=${Math.max(1, Math.min(days, 5))}&iscr=0&fields1=${fields1}&fields2=${fields2}`
  try {
    const payload = await getJson(url, { headers: { Referer: 'https://quote.eastmoney.com/' }, timeoutMs: 6000 })
    const rows = Array.isArray(payload?.data?.trends) ? payload.data.trends : []
    if (rows.length < 2) throw new Error('分时数据不可用')
    const prevClose = asNumber(payload?.data?.preClose)
    // An index's amount/volume ratio is not an index level, and its 均价 column
    // is not guaranteed to be on that scale either; build it from the quoted
    // values so the chart's y-domain stays meaningful.
    const isIndex = isIndexSymbol(symbol)
    let priceSum = 0
    let priceCount = 0
    let currentDay = ''
    const points = rows.map((line) => {
      const [stamp, open, close, high, low, volume, amount, avg] = String(line).split(',')
      const price = asNumber(close) ?? asNumber(open)
      const amountValue = asNumber(amount)
      const volumeValue = asNumber(volume)
      const day = String(stamp ?? '').slice(0, 10).replace(/-/g, '')
      // A multi-day answer restarts its turnover at each open; the average has
      // to restart with it or the overlay blends the days together.
      if (day !== currentDay) {
        currentDay = day
        priceSum = 0
        priceCount = 0
      }
      if (typeof price === 'number' && Number.isFinite(price)) {
        priceSum += price
        priceCount += 1
      }
      return {
        time: String(stamp ?? '').slice(11, 16),
        day,
        price,
        volume: volumeValue,
        amount: amountValue,
        avg: isIndex
          ? priceCount > 0 ? round(priceSum / priceCount, 3) : null
          : asNumber(avg) ?? (amountValue && volumeValue ? round(amountValue / volumeValue, 3) : null),
        high: asNumber(high),
        low: asNumber(low),
      }
    })
    return { points, prevClose, days: [...new Set(points.map((point) => point.day))] }
  } catch (error) {
    if (!/分时数据不可用/.test(String(error?.message ?? error))) markHistoryDown()
    throw error
  }
}

export function asNumber(value) {
  const number = Number.parseFloat(value)
  return Number.isFinite(number) ? number : null
}

export function round(value, digits) {
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}
