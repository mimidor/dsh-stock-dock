/**
 * Trading-session arithmetic for the three venues.
 *
 * Sessions are written in each market's own wall clock: a US session is
 * 09:30–16:00 in New York, which is 21:30–04:00 in Shanghai only while the US
 * is on daylight time. Keeping them per-market is what makes the US window
 * survive the November switch instead of firing an hour early.
 *
 * A calendar of exchange holidays would be another file to keep fresh, so the
 * plugin detects them from the data instead: if the clock says "trading" but
 * every quote in that market still carries yesterday's timestamp, the market is
 * shut and the poll cadence drops to the closed one.
 */

const MARKET_SESSIONS = {
  cn: [
    [9 * 60 + 30, 11 * 60 + 30],
    [13 * 60, 15 * 60],
  ],
  hk: [
    [9 * 60 + 30, 12 * 60],
    [13 * 60, 16 * 60],
  ],
  us: [[9 * 60 + 30, 16 * 60]],
}

const MARKET_ZONE = { cn: 'Asia/Shanghai', hk: 'Asia/Hong_Kong', us: 'America/New_York' }

const MARKET_LABEL = { cn: 'A股', hk: '港股', us: '美股' }

const CLOCK_FORMATTERS = Object.fromEntries(
  Object.entries(MARKET_ZONE).map(([market, timeZone]) => [
    market,
    new Intl.DateTimeFormat('en-CA', {
      timeZone,
      hour12: false,
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
    }),
  ]),
)

const DATE_FORMATTERS = Object.fromEntries(
  Object.entries(MARKET_ZONE).map(([market, timeZone]) => [
    market,
    new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }),
  ]),
)

/** Wall-clock parts in the market's own zone, with the weekday that matters there. */
export function marketClock(market, now = new Date()) {
  const formatter = CLOCK_FORMATTERS[market] ?? CLOCK_FORMATTERS.cn
  const parts = Object.fromEntries(formatter.formatToParts(now).map((part) => [part.type, part.value]))
  const hour = Number.parseInt(parts.hour ?? '0', 10) % 24
  const minute = Number.parseInt(parts.minute ?? '0', 10)
  const weekday = parts.weekday ?? 'Mon'
  return { minutes: hour * 60 + minute, weekday, weekend: weekday === 'Sat' || weekday === 'Sun' }
}

/**
 * `trading` inside a session, `break` in the gap between two sessions of the
 * same trading day (A-share and Hong Kong lunch), `closed` before the open and
 * after the close. A market past its last session must not keep the 30 s
 * `break` cadence overnight.
 */
export function marketState(market, clock) {
  if (clock.weekend) return 'closed'
  const sessions = MARKET_SESSIONS[market] ?? []
  for (const [start, end] of sessions) {
    if (clock.minutes >= start && clock.minutes < end) return 'trading'
  }
  if (sessions.length > 1) {
    const first = Math.min(...sessions.map(([start]) => start))
    const last = Math.max(...sessions.map(([, end]) => end))
    if (last < 24 * 60 && clock.minutes > first && clock.minutes < last) return 'break'
  }
  return 'closed'
}

export function todayIn(market, now = new Date()) {
  const formatter = DATE_FORMATTERS[market] ?? DATE_FORMATTERS.cn
  return formatter.format(now)
}

/**
 * Quote timestamps arrive in three shapes and every provider except Eastmoney
 * carries one: `20261112161452` (Tencent A-share), `2026/11/12 16:08:06`
 * (Tencent/Sina Hong Kong), `2026-11-11 16:00:01` (US). Only the calendar date
 * matters here; the time is already reflected in the price.
 */
export function parseQuoteDate(value) {
  if (typeof value !== 'string') return undefined
  const text = value.trim()
  const compact = /^(\d{4})(\d{2})(\d{2})\d{0,6}$/.exec(text)
  if (compact) return `${compact[1]}-${compact[2]}-${compact[3]}`
  const dashed = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/.exec(text)
  if (dashed) {
    const month = String(dashed[2]).padStart(2, '0')
    const day = String(dashed[3]).padStart(2, '0')
    return `${dashed[1]}-${month}-${day}`
  }
  return undefined
}

/**
 * Per-market freshness: `stale` when at least one quote carried a date and none
 * of them is today in that market, `fresh` when one is, `unknown` when no quote
 * carried a parseable timestamp (Eastmoney never does).
 */
export function freshnessByMarket(quotes, now = new Date()) {
  const seen = {}
  for (const quote of Array.isArray(quotes) ? quotes : []) {
    if (!quote || quote.error || typeof quote.symbol !== 'string') continue
    const market = quote.market ?? 'cn'
    const date = parseQuoteDate(quote.time)
    if (!date) continue
    seen[market] = seen[market] ?? { any: false, fresh: false }
    seen[market].any = true
    if (date === todayIn(market, now)) seen[market].fresh = true
  }
  const out = {}
  for (const [market, value] of Object.entries(seen)) out[market] = value.fresh ? 'fresh' : 'stale'
  return out
}

/**
 * The US extended sessions, in New York wall-clock minutes: pre-market runs
 * 04:00–09:30 and after-hours 16:00–20:00. Outside those windows Sina's
 * pre/post columns still hold the morning's numbers, so the enrichment must be
 * skipped rather than shown stale.
 */
export function extendedWindow(market, now = new Date()) {
  if (market !== 'us') return undefined
  const clock = marketClock('us', now)
  if (clock.weekend) return undefined
  if (clock.minutes >= 4 * 60 && clock.minutes < 9 * 60 + 30) return 'pre'
  if (clock.minutes >= 16 * 60 && clock.minutes < 20 * 60) return 'post'
  return undefined
}

export function sessionFor(symbols, refreshSeconds, quotes = [], now = new Date()) {
  const markets = {}
  let weekend = true
  for (const symbol of symbols) {
    const market = marketOfMarket(symbol)
    const clock = marketClock(market, now)
    if (!clock.weekend) weekend = false
    if (markets[market] === undefined) markets[market] = marketState(market, clock)
  }
  if (symbols.length === 0) weekend = marketClock('cn', now).weekend

  const freshness = freshnessByMarket(quotes, now)
  let holiday = false
  for (const [market, mode] of Object.entries(markets)) {
    // Only a market that the clock calls open can be proven shut by stale data.
    if (mode === 'trading' && freshness[market] === 'stale') {
      markets[market] = 'closed'
      holiday = true
    }
  }

  const states = Object.values(markets)
  const mode = states.includes('trading') ? 'trading' : states.includes('break') ? 'break' : 'closed'
  const base = Math.round(refreshSeconds) * 1000
  const intervalMs =
    mode === 'trading' ? base : mode === 'break' ? Math.max(30_000, base) : Math.max(60_000, base)
  const label =
    mode === 'trading'
      ? `${Object.keys(markets)
          .filter((market) => markets[market] === 'trading')
          .map((market) => MARKET_LABEL[market] ?? market)
          .join('/')}盘中`
      : mode === 'break'
        ? '休市'
        : holiday
          ? '节假日休市'
          : weekend
            ? '周末休市'
            : '已收盘'
  return { mode, label, intervalMs, markets, serverTime: marketClock('cn', now).minutes, weekend, holiday }
}

/** Local copy so this module does not depend on the symbol module's naming. */
function marketOfMarket(symbol) {
  if (/^hk/i.test(symbol)) return 'hk'
  if (/^us/i.test(symbol)) return 'us'
  return 'cn'
}
