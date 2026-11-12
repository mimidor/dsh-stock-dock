/**
 * Company events: announcements and the daily billboard (龙虎榜).
 *
 * These are the two Eastmoney pages that answer without a key and, on this
 * machine, without the TLS refusal that hits `push2his`. They are exposed to the
 * model only (through `stock_events`), not to the strip: an announcement list is
 * not something to poll every fifteen seconds.
 */

import { getJson, getText } from './http.js'

const ANNOUNCEMENT_URL = 'https://np-anotice-pc.eastmoney.com/api/security/ann'
const LHB_URL = 'https://datacenter-web.eastmoney.com/api/data/v1/get'

const MAX_ITEMS = 20

/** Announcements answer JSON with `data.list`; titles carry the useful text. */
export async function fetchAnnouncements(code, limit = 10) {
  const size = Math.max(1, Math.min(limit, MAX_ITEMS))
  const url = `${ANNOUNCEMENT_URL}?sr=-1&page_size=${size}&page_index=1&ann_type=A&client_source=web&stock_list=${encodeURIComponent(code)}`
  const payload = await getJson(url, { headers: { Referer: 'https://data.eastmoney.com/' } })
  const rows = Array.isArray(payload?.data?.list) ? payload.data.list : []
  return rows.map((row) => ({
    id: String(row?.art_code ?? ''),
    title: String(row?.title ?? '').trim(),
    date: String(row?.notice_date ?? row?.eiTime ?? '').slice(0, 10),
    type: Array.isArray(row?.columns) && row.columns[0] ? String(row.columns[0].column_name ?? '') : '',
    url: row?.art_code ? `https://data.eastmoney.com/notices/detail/${code}/${row.art_code}.html` : '',
  }))
}

/**
 * Daily billboard entries for one security, newest first. `reportName` is the
 * current daily-detail report; the API answers `result.data` with uppercase
 * column names.
 */
export async function fetchBillboard(code, limit = 10) {
  const size = Math.max(1, Math.min(limit, MAX_ITEMS))
  const filter = encodeURIComponent(`(SECURITY_CODE="${code}")`)
  const url =
    `${LHB_URL}?reportName=RPT_DAILYBILLBOARD_DETAILSNEW&columns=ALL&pageSize=${size}` +
    `&pageNumber=1&sortColumns=TRADE_DATE&sortTypes=-1&filter=${filter}`
  const text = await getText(url, { headers: { Referer: 'https://data.eastmoney.com/' } })
  const payload = safeJson(text)
  const rows = Array.isArray(payload?.result?.data) ? payload.result.data : []
  return rows.map((row) => ({
    date: String(row?.TRADE_DATE ?? '').slice(0, 10),
    close: numberOrNull(row?.CLOSE_PRICE),
    changePct: numberOrNull(row?.CHANGE_RATE),
    turnoverRate: numberOrNull(row?.TURNOVERRATE),
    dealAmount: numberOrNull(row?.BILLBOARD_DEAL_AMT),
    dealRatio: numberOrNull(row?.DEAL_AMOUNT_RATIO),
    reason: String(row?.EXPLANATION ?? row?.EXPLAIN ?? '').trim(),
  }))
}

/**
 * The datacenter sometimes answers JSONP when called without a callback-friendly
 * Accept header; strip the wrapper instead of failing the whole tool.
 */
function safeJson(text) {
  const trimmed = String(text ?? '').trim()
  if (trimmed === '') return null
  try {
    return JSON.parse(trimmed)
  } catch {
    const start = trimmed.indexOf('{')
    const end = trimmed.lastIndexOf('}')
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(trimmed.slice(start, end + 1))
      } catch {
        return null
      }
    }
    return null
  }
}

function numberOrNull(value) {
  const number = Number.parseFloat(value)
  return Number.isFinite(number) ? number : null
}
