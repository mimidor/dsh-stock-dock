/**
 * Nasdaq's public quote chart endpoint.
 *
 * It is the only source reachable from this machine that serves a real
 * one-day intraday series for the Nasdaq Composite (`COMP`) and Nasdaq-100
 * (`NDX`). Tencent returns a single US index point; Eastmoney's trends host is
 * refused here. The endpoint is unofficial and may rate-limit, so callers
 * should keep it behind the trend cache.
 */

import { getJson } from '../http.js'
import { US_NASDAQ_CODES } from '../symbols.js'

const NASDAQ_CHART = 'https://api.nasdaq.com/api/quote/'

function parseTime(value) {
  const match = /^(\d{1,2}):(\d{2})\s*(AM|PM)/i.exec(String(value ?? ''))
  if (!match) return null
  let hour = Number.parseInt(match[1], 10) % 12
  if (/PM/i.test(match[3])) hour += 12
  return `${String(hour).padStart(2, '0')}${match[2]}`
}

function dateOf(value) {
  const parsed = Date.parse(String(value ?? ''))
  if (!Number.isFinite(parsed)) return ''
  const date = new Date(parsed)
  return `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`
}

export async function fetchTrend(symbol) {
  const code = US_NASDAQ_CODES[String(symbol).slice(2).toUpperCase()]
  if (!code) return null
  const payload = await getJson(`${NASDAQ_CHART}${encodeURIComponent(code)}/chart?assetclass=index`, {
    headers: {
      Accept: 'application/json, text/plain, */*',
      Origin: 'https://www.nasdaq.com',
      Referer: 'https://www.nasdaq.com/',
    },
  })
  const data = payload?.data
  const rows = Array.isArray(data?.chart) ? data.chart : []
  if (rows.length < 2) return null
  const day = dateOf(data.timeAsOf)
  const ordered = [...rows].sort((left, right) => Number(left?.x ?? 0) - Number(right?.x ?? 0))
  let sum = 0
  const points = []
  for (const row of ordered) {
    const price = Number.parseFloat(row?.y)
    const time = parseTime(row?.z?.dateTime)
    if (!Number.isFinite(price) || !time) continue
    sum += price
    points.push({
      time,
      day,
      price,
      avg: Math.round((sum / points.length) * 1000) / 1000,
    })
  }
  if (points.length < 2) return null
  return {
    points,
    prevClose: Number.parseFloat(String(data.previousClose ?? '').replace(/,/g, '')) || null,
    days: day ? [day] : [],
  }
}
