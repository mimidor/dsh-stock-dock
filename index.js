/**
 * Host half of the stock ticker bundle.
 *
 * It normalizes the configured symbols, fetches quotes, daily/weekly/monthly and
 * minute K-lines plus intraday trends from Tencent's public endpoints, falls back
 * to Sina for quotes when Tencent is unreachable, caches every answer briefly,
 * and answers the Client half over same-origin routes under `/dsh-stock-ticker`.
 * It also lets the Client half save a new symbol list through the profile's
 * config editor.
 */

const ROUTE_PATH = '/dsh-stock-ticker'

const TEN_QUOTE = 'https://qt.gtimg.cn/q='
const TEN_KLINE = 'https://proxy.finance.qq.com/ifzqgtimg/appstock/app/newfqkline/get'
const TEN_MKLINE = 'https://proxy.finance.qq.com/ifzqgtimg/appstock/app/kline/mkline'
const TEN_TREND = 'https://proxy.finance.qq.com/ifzqgtimg/appstock/app/minute/query'
const SINA_QUOTE = 'https://hq.sinajs.cn/list='

const REQUEST_TIMEOUT_MS = 8000
const QUOTE_TTL_MS = 3000
const KLINE_TTL_MS = 5 * 60 * 1000
const MINUTE_KLINE_TTL_MS = 60 * 1000
const TREND_TTL_LIVE_MS = 20 * 1000
const TREND_TTL_CLOSED_MS = 5 * 60 * 1000
const KLINE_RETRY_MS = 60 * 1000
const SOURCE_COOLDOWN_MS = 30 * 1000

const MAX_SYMBOLS = 30
const MAX_BODY_BYTES = 64 * 1024

const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) ' +
  'Chrome/124.0.0.0 Safari/537.36'

const DEFAULT_SYMBOLS = ['sh000001', 'sz399001', 'sh600519', 'sh510300', 'hk00700', 'usAAPL']

/** This bundle cannot serve anything without the browser HTTP carrier. */
export const inject = ['webServer']

export function apply(ctx, config) {
  const settings = normalizeSettings(config)
  const cache = {
    quotes: new Map(),
    klines: new Map(),
    trends: new Map(),
    health: {
      tencent: { failures: 0, cooldownUntil: 0, lastOk: 0 },
      sina: { failures: 0, cooldownUntil: 0, lastOk: 0 },
    },
  }

  ctx.effect(() =>
    ctx.webServer.register({
      kind: 'prefix',
      path: ROUTE_PATH,
      handler: (req, res) => {
        handleRequest(ctx, settings, cache, req, res).catch((error) => {
          console.error('[stock-ticker] request failed', error)
          try {
            sendJson(res, 500, { ok: false, error: messageOf(error) })
          } catch {
            /* the response is already gone */
          }
        })
      },
    }),
  )
}

/* ------------------------------------------------------------------ routing */

async function handleRequest(ctx, settings, cache, req, res) {
  const url = new URL(req.url ?? '/', 'http://localhost')
  const method = req.method ?? 'GET'

  if (method === 'OPTIONS') {
    res.statusCode = 204
    res.end()
    return
  }

  if (method === 'GET' && url.pathname === `${ROUTE_PATH}/quotes`) {
    const symbols = readSymbolsParam(url) ?? settings.symbols
    const forced = url.searchParams.get('source')
    const payload = await buildQuotes(settings, cache, symbols, forced === 'sina' || forced === 'tencent' ? forced : undefined)
    sendJson(res, 200, payload)
    return
  }

  if (method === 'GET' && url.pathname === `${ROUTE_PATH}/kline`) {
    const symbol = normalizeSymbol(url.searchParams.get('symbol') ?? '')
    if (!symbol) {
      sendJson(res, 400, { ok: false, error: 'invalid-symbol' })
      return
    }
    const period = normalizePeriod(url.searchParams.get('period'))
    const adjust = normalizeAdjust(url.searchParams.get('adjust'), period)
    const limit = clampLimit(url.searchParams.get('limit'), period)
    const refresh = url.searchParams.get('refresh') === '1'
    try {
      const rows = await klineFor(cache, symbol, period, adjust, limit, refresh)
      sendJson(res, 200, { ok: true, symbol, period, adjust, limit, rows })
    } catch (error) {
      sendJson(res, 502, { ok: false, error: messageOf(error) })
    }
    return
  }

  if (method === 'GET' && url.pathname === `${ROUTE_PATH}/trend`) {
    const symbol = normalizeSymbol(url.searchParams.get('symbol') ?? '')
    if (!symbol) {
      sendJson(res, 400, { ok: false, error: 'invalid-symbol' })
      return
    }
    try {
      sendJson(res, 200, { ok: true, ...(await trendFor(cache, symbol, url.searchParams.get('refresh') === '1')) })
    } catch (error) {
      sendJson(res, 502, { ok: false, error: messageOf(error) })
    }
    return
  }

  if (method === 'GET' && url.pathname === `${ROUTE_PATH}/settings`) {
    sendJson(res, 200, {
      ok: true,
      settings: { ...publicSettings(settings), symbols: settings.symbols },
    })
    return
  }

  if (method === 'POST' && url.pathname === `${ROUTE_PATH}/config`) {
    if (!isTrustedRequest(ctx, req)) {
      sendJson(res, 403, { ok: false, error: 'forbidden' })
      return
    }
    await saveSymbols(ctx, settings, req, res)
    return
  }

  sendJson(res, 404, { ok: false, error: 'unknown route' })
}

function readSymbolsParam(url) {
  const compact = url.searchParams.get('symbols')
  if (compact) {
    const symbols = normalizeSymbols(compact.split(','))
    if (symbols.length > 0) return symbols
  }
  const repeated = url.searchParams.getAll('symbol')
  const symbols = normalizeSymbols(repeated)
  return symbols.length > 0 ? symbols : undefined
}

/* -------------------------------------------------------------- market time */

const MARKET_SESSIONS = {
  cn: [
    [9 * 60 + 30, 11 * 60 + 30],
    [13 * 60, 15 * 60],
  ],
  hk: [
    [9 * 60 + 30, 12 * 60],
    [13 * 60, 16 * 60],
  ],
  us: [
    [21 * 60 + 30, 24 * 60],
    [0, 4 * 60],
  ],
}

const MARKET_LABEL = { cn: 'A股', hk: '港股', us: '美股' }

/**
 * Shanghai wall-clock parts, because that is the clock every configured market
 * is scheduled against (`21:30` for a US session is a Shanghai time, not a New
 * York one).
 */
function shanghaiNow() {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    hour12: false,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
  const parts = Object.fromEntries(formatter.formatToParts(new Date()).map((part) => [part.type, part.value]))
  const hour = Number.parseInt(parts.hour ?? '0', 10) % 24
  const minute = Number.parseInt(parts.minute ?? '0', 10)
  const weekday = parts.weekday ?? 'Mon'
  return { minutes: hour * 60 + minute, weekday, weekend: weekday === 'Sat' || weekday === 'Sun' }
}

function marketState(market, clock) {
  if (clock.weekend) return 'closed'
  const sessions = MARKET_SESSIONS[market] ?? []
  for (const [start, end] of sessions) {
    if (clock.minutes >= start && clock.minutes < end) return 'trading'
  }
  return 'break'
}

function sessionFor(symbols, refreshSeconds) {
  const clock = shanghaiNow()
  const markets = {}
  for (const symbol of symbols) {
    const market = marketOf(symbol)
    if (markets[market] === undefined) markets[market] = marketState(market, clock)
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
        : clock.weekend
          ? '周末休市'
          : '已收盘'
  return { mode, label, intervalMs, markets, serverTime: clock.minutes, weekend: clock.weekend }
}

/* ------------------------------------------------------------------- config */

function clamp(value, min, max, fallback) {
  const number = typeof value === 'number' ? value : Number.parseFloat(value)
  if (!Number.isFinite(number)) return fallback
  return Math.min(max, Math.max(min, number))
}

function normalizeSettings(config) {
  const raw = config ?? {}
  const symbols = normalizeSymbols(Array.isArray(raw.symbols) ? raw.symbols : [])
  return {
    symbols: symbols.length > 0 ? symbols : DEFAULT_SYMBOLS,
    refreshSeconds: clamp(raw.refreshSeconds, 5, 300, 15),
    klineDays: Math.round(clamp(raw.klineDays, 10, 120, 40)),
    colorMode: raw.colorMode === 'intl' ? 'intl' : 'cn',
  }
}

function publicSettings(settings) {
  return {
    refreshSeconds: settings.refreshSeconds,
    klineDays: settings.klineDays,
    colorMode: settings.colorMode,
  }
}

function marketOf(symbol) {
  if (/^hk/i.test(symbol)) return 'hk'
  if (/^us/i.test(symbol)) return 'us'
  return 'cn'
}

/**
 * Accepts the forms a person types: `sh600519`, `600519`, `hk00700`, `00700`,
 * `usAAPL`, `AAPL`, and the exchange suffixes exports carry (`600519.SH`,
 * `00700.HK`, `AAPL.US`). A bare six-digit code is guessed by its first digit, a
 * bare five-digit code is treated as Hong Kong, and any other letters as a US
 * ticker.
 */
function normalizeSymbol(raw) {
  if (typeof raw !== 'string') return undefined
  let text = raw.trim().replace(/[%^$\s]/g, '')
  if (text === '') return undefined

  const suffixed = /^([a-z0-9]+)\.(sh|ss|sz|bj|hk|us|o|n)$/i.exec(text)
  if (suffixed) {
    const body = suffixed[1]
    const suffix = suffixed[2].toLowerCase()
    const market = suffix === 'ss' ? 'sh' : suffix === 'o' || suffix === 'n' ? 'us' : suffix
    return withMarket(market, body)
  }

  if (/^(sh|sz|bj|hk|us)[a-z0-9._-]{1,16}$/i.test(text)) {
    const prefix = text.slice(0, 2).toLowerCase()
    return withMarket(prefix, text.slice(2))
  }
  if (/^\d{6}$/.test(text)) {
    const head = text[0]
    const market = head === '6' || head === '5' || head === '9' ? 'sh' : 'sz'
    return `${market}${text}`
  }
  if (/^\d{1,5}$/.test(text)) return `hk${text.replace(/^0+/, '').padStart(5, '0')}`
  if (/^[A-Z][A-Z0-9.-]*$/i.test(text)) return `us${text.toUpperCase()}`
  return undefined
}

function withMarket(market, body) {
  if (market === 'us') return `us${body.toUpperCase()}`
  if (market === 'hk') return `hk${body.replace(/^0+/, '').padStart(5, '0')}`
  return `${market}${body.toLowerCase()}`
}

function normalizeSymbols(list) {
  const seen = new Set()
  const result = []
  for (const item of list) {
    const symbol = normalizeSymbol(item)
    if (!symbol || seen.has(symbol)) continue
    seen.add(symbol)
    result.push(symbol)
    if (result.length >= MAX_SYMBOLS) break
  }
  return result
}

async function saveSymbols(ctx, settings, req, res) {
  let body
  try {
    body = await readJsonBody(req)
  } catch {
    sendJson(res, 400, { ok: false, error: 'invalid-body' })
    return
  }
  const symbols = normalizeSymbols(Array.isArray(body.symbols) ? body.symbols : [])
  if (symbols.length === 0) {
    sendJson(res, 400, { ok: false, error: 'symbols-empty' })
    return
  }

  const entry = ctx.fiber?.entry
  const editor = ctx.get('configEditor')
  if (!entry || !editor) {
    sendJson(res, 503, { ok: false, error: 'config-not-writable' })
    return
  }

  try {
    await editor.edit(entry, (current) => ({ ...current, symbols }))
  } catch (error) {
    sendJson(res, 409, { ok: false, error: messageOf(error) })
    return
  }

  settings.symbols = symbols
  sendJson(res, 200, { ok: true, symbols })
}

async function readJsonBody(req) {
  const chunks = []
  let size = 0
  for await (const chunk of req) {
    size += chunk.length
    if (size > MAX_BODY_BYTES) throw new Error('request body too large')
    chunks.push(chunk)
  }
  const text = Buffer.concat(chunks).toString('utf8').trim()
  if (text === '') return {}
  return JSON.parse(text)
}

/* -------------------------------------------------------------------- quotes */

/**
 * The upstream cache keeps a fresh page from hammering the free endpoints:
 * several tabs, the client's own retries, and a page refresh all reuse one
 * recent download.
 */
async function buildQuotes(settings, cache, symbols, forcedSource) {
  const key = `${forcedSource ?? 'auto'}:${symbols.join(',')}`
  const now = Date.now()
  let bundle = cache.quotes.get(key)
  if (!bundle || now - bundle.at > QUOTE_TTL_MS) {
    bundle = { at: now, ...(await fetchQuoteBundle(cache, symbols, forcedSource)) }
    cache.quotes.set(key, bundle)
    if (cache.quotes.size > 8) {
      for (const stale of [...cache.quotes.keys()].slice(0, cache.quotes.size - 8)) cache.quotes.delete(stale)
    }
  }

  const session = sessionFor(symbols, settings.refreshSeconds)
  const quotes = await Promise.all(
    bundle.quotes.map(async (quote) => {
      if (quote.error) return quote
      return { ...quote, kline: await klineFor(cache, quote.symbol, 'day', 'qfq', settings.klineDays).catch(() => []) }
    }),
  )

  return {
    ok: true,
    updatedAt: bundle.at,
    source: bundle.source,
    sources: sourceHealth(cache),
    session,
    settings: publicSettings(settings),
    symbols,
    quotes,
  }
}

async function fetchQuoteBundle(cache, symbols, forcedSource) {
  const order = forcedSource === 'sina' ? ['sina', 'tencent'] : ['tencent', 'sina']
  const failures = []
  for (const source of order) {
    if (!forcedSource && sourceUsable(cache, source) === false) continue
    try {
      const quotes = source === 'tencent' ? await fetchTencentQuotes(symbols) : await fetchSinaQuotes(symbols)
      markSource(cache, source, true)
      return { source, quotes }
    } catch (error) {
      markSource(cache, source, false)
      failures.push(`${source}: ${messageOf(error)}`)
      console.error('[stock-ticker] quote source failed', source, messageOf(error))
    }
  }
  throw new Error(failures.join('; ') || 'no quote source available')
}

function sourceUsable(cache, source) {
  return cache.health[source].cooldownUntil <= Date.now()
}

function markSource(cache, source, ok) {
  const health = cache.health[source]
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

function sourceHealth(cache) {
  const now = Date.now()
  const state = (health) => {
    if (health.cooldownUntil > now) return 'down'
    return health.lastOk > 0 ? 'ok' : 'unknown'
  }
  return { tencent: state(cache.health.tencent), sina: state(cache.health.sina) }
}

async function fetchTencentQuotes(symbols) {
  const response = await fetch(`${TEN_QUOTE}${symbols.map(encodeURIComponent).join(',')}`, {
    headers: { 'User-Agent': USER_AGENT, Referer: 'https://gu.qq.com/' },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  })
  if (!response.ok) throw new Error(`tencent quote endpoint returned ${response.status}`)

  const bytes = new Uint8Array(await response.arrayBuffer())
  const text = new TextDecoder('gbk').decode(bytes)
  const rows = new Map()
  const pattern = /v_([a-z0-9._-]+)="([^"]*)"/gi
  let match
  while ((match = pattern.exec(text)) !== null) rows.set(match[1].toLowerCase(), match[2].split('~'))

  const quotes = symbols.map((symbol) => {
    const fields = rows.get(symbol.toLowerCase())
    if (!fields || fields.length < 35 || !fields[1]) return { symbol, error: 'no-data' }
    return parseTencentQuote(symbol, fields)
  })
  if (quotes.every((quote) => quote.error)) throw new Error('tencent returned no usable rows')
  return quotes
}

/**
 * Field layout differs per venue, so the extras beyond price/OHLC/volume are
 * read only for A-shares, where the positions are verified: 36 volume (lots),
 * 37 turnover (万元), 38 turnover rate, 39 P/E, 43 amplitude, 44/45 market caps
 * (亿), 46 P/B, 47/48 up/down limits, 49 volume ratio.
 */
function parseTencentQuote(symbol, fields) {
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
  if (quote.price === null) return { symbol, error: 'no-data' }

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
 * Sina answers GBK text with one `var hq_str_<key>="..."` row per symbol and
 * needs a Referer. It is the fallback for all three venues, but its field layout
 * differs per market, so each parser is written out instead of guessed.
 */
async function fetchSinaQuotes(symbols) {
  const keys = symbols.map((symbol) => (`us` === marketOf(symbol) ? `gb_${symbol.slice(2).toLowerCase()}` : marketOf(symbol) === 'hk' ? `rt_${symbol}` : symbol))
  const response = await fetch(`${SINA_QUOTE}${keys.map(encodeURIComponent).join(',')}`, {
    headers: { 'User-Agent': USER_AGENT, Referer: 'https://finance.sina.com.cn/' },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  })
  if (!response.ok) throw new Error(`sina quote endpoint returned ${response.status}`)
  const text = new TextDecoder('gbk').decode(new Uint8Array(await response.arrayBuffer()))

  const rows = new Map()
  const pattern = /hq_str_([a-z0-9_]+)="([^"]*)"/gi
  let match
  while ((match = pattern.exec(text)) !== null) rows.set(match[1].toLowerCase(), match[2].split(','))

  const quotes = symbols.map((symbol) => {
    const key = marketOf(symbol) === 'us' ? `gb_${symbol.slice(2).toLowerCase()}` : marketOf(symbol) === 'hk' ? `rt_${symbol}` : symbol
    const fields = rows.get(key.toLowerCase())
    if (!fields || fields.length < 10 || fields.join('') === '') return { symbol, error: 'no-data' }
    const market = marketOf(symbol)
    if (market === 'cn') {
      const price = asNumber(fields[3])
      const prevClose = asNumber(fields[2])
      return {
        symbol,
        market,
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
    if (market === 'hk') {
      const price = asNumber(fields[6])
      const change = asNumber(fields[7])
      return {
        symbol,
        market,
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
    const price = asNumber(fields[1])
    const change = asNumber(fields[4])
    return {
      symbol,
      market,
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
  })
  if (quotes.every((quote) => quote.error)) throw new Error('sina returned no usable rows')
  return quotes
}

/* --------------------------------------------------------------- kline data */

const PERIODS = new Set(['day', 'week', 'month', 'm1', 'm5', 'm15', 'm30', 'm60'])
const MINUTE_PERIODS = new Set(['m1', 'm5', 'm15', 'm30', 'm60'])

function isMinutePeriod(period) {
  return MINUTE_PERIODS.has(period)
}

function normalizePeriod(value) {
  return PERIODS.has(value) ? value : 'day'
}

function normalizeAdjust(value, period) {
  if (isMinutePeriod(period)) return 'none'
  if (value === 'qfq' || value === 'hfq' || value === 'none') return value
  return 'qfq'
}

function clampLimit(value, period) {
  const fallback = isMinutePeriod(period) ? 120 : 40
  return Math.round(clamp(value, 10, 320, fallback))
}

/**
 * Tencent wants the venue suffix on US tickers (`usAAPL.OQ`), which its quote
 * answer already carries; A-share, Hong Kong and index symbols go through as-is.
 * The suffix is cached on the first successful K-line read.
 */
const klineSymbolCache = new Map()

function klineSymbols(symbol) {
  const cached = klineSymbolCache.get(symbol)
  if (cached) return [cached]
  if (!/^us/i.test(symbol)) return [symbol]
  const code = symbol.slice(2)
  if (code.includes('.')) return [`us${code}`]
  return [`us${code}.OQ`, `us${code}.N`, `us${code}`]
}

async function klineFor(cache, symbol, period, adjust, limit, refresh = false) {
  const verbose = isMinutePeriod(period)
  const key = `${symbol}:${period}:${adjust}:${limit}`
  const cached = cache.klines.get(key)
  const ttl = verbose ? MINUTE_KLINE_TTL_MS : KLINE_TTL_MS
  const retry = cached && cached.rows.length > 0 ? ttl : KLINE_RETRY_MS
  if (!refresh && cached && Date.now() - cached.at <= retry) return cached.rows

  for (const candidate of klineSymbols(symbol)) {
    try {
      const rows = verbose
        ? await fetchMinuteKline(candidate, period, limit)
        : await fetchPeriodKline(candidate, period, adjust, limit)
      if (rows.length > 0) {
        if (/^us/i.test(symbol)) klineSymbolCache.set(symbol, candidate)
        cache.klines.set(key, { at: Date.now(), rows })
        return rows
      }
    } catch (error) {
      console.error('[stock-ticker] kline failed', candidate, messageOf(error))
    }
  }
  cache.klines.set(key, { at: Date.now(), rows: [] })
  return []
}

async function fetchPeriodKline(symbol, period, adjust, limit) {
  const adjustParam = adjust === 'none' ? '' : adjust
  const url = `${TEN_KLINE}?param=${encodeURIComponent(`${symbol},${period},,,${limit},${adjustParam}`)}`
  const payload = await fetchJson(url)
  const node = payload?.data?.[symbol]
  const rows = node?.[`${adjustParam}${period}`] ?? node?.[period]
  if (!Array.isArray(rows)) return []
  return rows
    .map((row) => ({
      date: typeof row[0] === 'string' ? row[0] : '',
      open: asNumber(row[1]),
      close: asNumber(row[2]),
      high: asNumber(row[3]),
      low: asNumber(row[4]),
      volume: asNumber(row[5]),
    }))
    .filter((row) => row.close !== null && row.high !== null && row.low !== null)
}

async function fetchMinuteKline(symbol, period, limit) {
  const url = `${TEN_MKLINE}?param=${encodeURIComponent(`${symbol},${period},,${limit}`)}`
  const payload = await fetchJson(url)
  const node = payload?.data?.[symbol]
  const rows = node?.[period]
  if (!Array.isArray(rows)) return []
  return rows
    .map((row) => ({
      date: String(row[0] ?? ''),
      open: asNumber(row[1]),
      close: asNumber(row[2]),
      high: asNumber(row[3]),
      low: asNumber(row[4]),
      volume: asNumber(row[5]),
    }))
    .filter((row) => row.close !== null && row.high !== null && row.low !== null)
}

/* ---------------------------------------------------------------- intraday */

async function trendFor(cache, symbol, refresh = false) {
  if (marketOf(symbol) === 'us') throw new Error('美股暂无分时数据')

  const session = sessionFor([symbol], 15)
  const ttl = session.mode === 'trading' ? TREND_TTL_LIVE_MS : TREND_TTL_CLOSED_MS
  const cached = cache.trends.get(symbol)
  if (!refresh && cached && Date.now() - cached.at <= ttl) return cached.value

  const payload = await fetchJson(`${TEN_TREND}?code=${encodeURIComponent(symbol)}`)
  const node = payload?.data?.[symbol]
  const rows = node?.data?.data
  if (!Array.isArray(rows) || rows.length < 2) throw new Error('分时数据不可用')

  const quoteFields = node?.qt?.[symbol]
  const prevClose = Array.isArray(quoteFields) ? asNumber(quoteFields[4]) : null

  let cumulativeAmount = 0
  let cumulativeVolume = 0
  const points = []
  for (const row of rows) {
    const [time, priceText, volumeText, amountText] = String(row).split(/\s+/)
    const price = asNumber(priceText)
    if (price === null) continue
    const volume = asNumber(volumeText) ?? 0
    cumulativeVolume += volume
    cumulativeAmount += asNumber(amountText) ?? 0
    points.push({
      time,
      price,
      volume,
      amount: asNumber(amountText),
      avg: cumulativeVolume > 0 ? round(cumulativeAmount / (cumulativeVolume * 100), 3) : null,
    })
  }
  if (points.length < 2) throw new Error('分时数据不可用')

  const value = {
    symbol,
    market: marketOf(symbol),
    date: node?.data?.date ?? '',
    prevClose,
    points,
  }
  cache.trends.set(symbol, { at: Date.now(), value })
  if (cache.trends.size > 60) {
    for (const stale of [...cache.trends.keys()].slice(0, cache.trends.size - 60)) cache.trends.delete(stale)
  }
  return value
}

/* ------------------------------------------------------------------- helpers */

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT, Referer: 'https://gu.qq.com/' },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  })
  if (!response.ok) throw new Error(`kline endpoint returned ${response.status}`)
  return response.json()
}

function asNumber(value) {
  const number = Number.parseFloat(value)
  return Number.isFinite(number) ? number : null
}

function round(value, digits) {
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}

/** Tencent reports turnover in 万元; the Client half shows 元. */
function scaleWan(value) {
  return value === null ? null : round(value * 10_000, 0)
}

function messageOf(error) {
  if (error instanceof Error) return error.message
  return String(error)
}

/** An authority is local when its hostname is loopback and its port is the server's. */
function isLoopbackAuthority(value, expectedPort) {
  try {
    const url = new URL(value.includes('://') ? value : `http://${value}`)
    if (!['127.0.0.1', 'localhost', '::1', '[::1]'].includes(url.hostname)) return false
    return expectedPort === '' || url.port === expectedPort
  } catch {
    return false
  }
}

/**
 * Only the local page may rewrite the symbol list. The strip is served over the
 * profile's loopback web server, so a loopback peer plus a loopback Host header
 * cover DNS rebinding, and a present-but-foreign Origin covers another page in
 * the same browser posting on the user's behalf. `127.0.0.1` and `localhost`
 * are both accepted for the same port.
 */
function isTrustedRequest(ctx, req) {
  const remote = req.socket?.remoteAddress ?? ''
  if (remote !== '' && !/^(127\.0\.0\.1|::1|::ffff:127\.0\.0\.1)$/.test(remote)) return false

  let origin
  try {
    origin = ctx.webServer.getOrigin()
  } catch {
    return remote !== ''
  }
  const expectedPort = new URL(origin).port

  const host = req.headers.host
  if (typeof host === 'string' && host !== '' && !isLoopbackAuthority(host, expectedPort)) return false
  const requestOrigin = req.headers.origin
  if (typeof requestOrigin === 'string' && requestOrigin !== '' && !isLoopbackAuthority(requestOrigin, expectedPort)) {
    return false
  }
  return true
}

function sendJson(res, status, value) {
  const body = JSON.stringify(value)
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')
  res.end(body)
}
