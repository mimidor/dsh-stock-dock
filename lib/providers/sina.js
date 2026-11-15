/**
 * Sina's public quote endpoint — the fallback.
 *
 * It answers GBK text with one `var hq_str_<key>="..."` row per symbol and needs
 * a Referer. It covers all three venues, but its field layout differs per
 * market, so each parser is written out instead of guessed.
 */

import { getGbkText, getJson } from '../http.js'
import { marketOf, sinaKeyOf } from '../symbols.js'

const SINA_QUOTE = 'https://hq.sinajs.cn/list='

export async function fetchQuotes(symbols) {
  const keys = symbols.map(sinaKeyOf)
  const text = await getGbkText(`${SINA_QUOTE}${keys.map(encodeURIComponent).join(',')}`, {
    headers: { Referer: 'https://finance.sina.com.cn/' },
  })

  const rows = new Map()
  const pattern = /hq_str_([a-z0-9_]+)="([^"]*)"/gi
  let match
  while ((match = pattern.exec(text)) !== null) rows.set(match[1].toLowerCase(), match[2].split(','))

  const quotes = symbols.map((symbol) => {
    const fields = rows.get(sinaKeyOf(symbol).toLowerCase())
    if (!fields || fields.length < 10 || fields.join('') === '') return { symbol, error: 'no-data' }
    return parseQuote(symbol, fields)
  })
  if (quotes.every((quote) => quote.error) && !/hq_str_[a-z0-9_]+="/i.test(text)) {
    throw new Error('sina answered without any quote row')
  }
  return quotes
}

/**
 * US pre/post-market snapshot.
 *
 * Sina's `gb_` rows carry the extended session in columns 21–24 (price, percent,
 * change, `Nov 12 08:43AM EST`); Tencent's rows stop at the regular session.
 * Only the pre-market (04:00–09:30) and after-hours (16:00–20:00) windows are
 * reported; anything else means the extended session is not running and the
 * field would be stale.
 */
export async function fetchExtended(symbols) {
  const us = symbols.filter((symbol) => /^us/i.test(symbol))
  if (us.length === 0) return {}
  const text = await getGbkText(`${SINA_QUOTE}${us.map((symbol) => sinaKeyOf(symbol)).map(encodeURIComponent).join(',')}`, {
    headers: { Referer: 'https://finance.sina.com.cn/' },
  })
  const rows = new Map()
  const pattern = /hq_str_([a-z0-9_]+)="([^"]*)"/gi
  let match
  while ((match = pattern.exec(text)) !== null) rows.set(match[1].toLowerCase(), match[2].split(','))
  const out = {}
  for (const symbol of us) {
    const fields = rows.get(sinaKeyOf(symbol).toLowerCase())
    const extended = fields ? parseExtended(fields) : undefined
    if (extended) out[symbol] = extended
  }
  return out
}

export function parseExtended(fields) {
  const price = asNumber(fields?.[21])
  const changePct = asNumber(fields?.[22])
  const change = asNumber(fields?.[23])
  const time = typeof fields?.[24] === 'string' ? fields[24] : ''
  if (price === null || price <= 0 || time === '') return undefined
  const session = extendedSession(time)
  if (!session) return undefined
  return { price, change, changePct, time, session }
}

function extendedSession(time) {
  const match = /(\d{1,2}):(\d{2})\s*(AM|PM)/i.exec(time)
  if (!match) return undefined
  let hour = Number.parseInt(match[1], 10) % 12
  if (/PM/i.test(match[3])) hour += 12
  if (hour < 9 || (hour === 9 && Number.parseInt(match[2], 10) < 30)) return 'pre'
  if (hour >= 16) return 'post'
  return undefined
}

export function parseQuote(symbol, fields) {
  const market = marketOf(symbol)
  if (market === 'cn') return parseCn(symbol, fields)
  if (market === 'hk') return parseHk(symbol, fields)
  return parseUs(symbol, fields)
}

function parseCn(symbol, fields) {
  const price = asNumber(fields[3])
  const prevClose = asNumber(fields[2])
  return {
    symbol,
    market: 'cn',
    source: 'sina',
    name: fields[0],
    code: symbol.slice(2),
    price,
    prevClose,
    open: asNumber(fields[1]),
    high: asNumber(fields[4]),
    low: asNumber(fields[5]),
    change: price !== null && prevClose !== null ? round(price - prevClose, 3) : null,
    changePct: price !== null && prevClose ? round(((price - prevClose) / prevClose) * 100, 2) : null,
    volume: asNumber(fields[8]) !== null ? round((asNumber(fields[8]) ?? 0) / 100, 2) : null,
    amount: asNumber(fields[9]),
    time: `${fields[30] ?? ''} ${fields[31] ?? ''}`.trim(),
  }
}

function parseHk(symbol, fields) {
  const price = asNumber(fields[6])
  const change = asNumber(fields[7])
  return {
    symbol,
    market: 'hk',
    source: 'sina',
    name: fields[1] || fields[0],
    code: symbol.slice(2),
    price,
    prevClose: price !== null && change !== null ? round(price - change, 3) : null,
    open: asNumber(fields[2]),
    high: asNumber(fields[4]),
    low: asNumber(fields[5]),
    change,
    changePct: asNumber(fields[8]),
    volume: asNumber(fields[12]),
    amount: asNumber(fields[11]),
    time: `${fields[17] ?? ''} ${fields[18] ?? ''}`.trim(),
  }
}

function parseUs(symbol, fields) {
  const price = asNumber(fields[1])
  const change = asNumber(fields[4])
  return {
    symbol,
    market: 'us',
    source: 'sina',
    name: fields[0],
    code: symbol.slice(2),
    price,
    prevClose: price !== null && change !== null ? round(price - change, 3) : null,
    open: asNumber(fields[5]),
    high: asNumber(fields[6]),
    low: asNumber(fields[7]),
    change,
    changePct: asNumber(fields[2]),
    volume: asNumber(fields[10]),
    time: fields[3],
  }
}

function asNumber(value) {
  const number = Number.parseFloat(value)
  return Number.isFinite(number) ? number : null
}

function round(value, digits) {
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}


/**
 * CN minute history. Sina's `datalen` accepts far more than Tencent's 640-bar
 * mkline cap (5m returns 5001 rows, enough for about five months); HK/US are
 * not covered and fall back to Tencent.
 */
export async function fetchMinuteKline(symbol, period, limit) {
  if (!/^(sh|sz)/i.test(symbol)) return []
  const scale = String(period).replace(/^m/i, '')
  const url =
    'https://money.finance.sina.com.cn/quotes_service/api/json_v2.php/CN_MarketData.getKLineData' +
    `?symbol=${encodeURIComponent(symbol)}&scale=${encodeURIComponent(scale)}&ma=no&datalen=${Math.min(5001, Math.max(10, Math.round(limit)))}`
  const payload = await getJson(url, { headers: { Referer: 'https://finance.sina.com.cn/' } })
  if (!Array.isArray(payload)) return []
  return payload
    .map((row) => ({
      date: String(row?.day ?? '').replace(/\D/g, '').slice(0, 12),
      open: asNumber(row?.open),
      close: asNumber(row?.close),
      high: asNumber(row?.high),
      low: asNumber(row?.low),
      volume: asNumber(row?.volume),
    }))
    .filter((row) => /^\d{12}$/.test(row.date) && row.close !== null)
    .slice(-limit)
}
