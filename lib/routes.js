/**
 * The Host half's HTTP surface.
 *
 * Everything is same-origin under `/dsh-stock-ticker` (with `/dsh-stock-dock`
 * kept as an alias). Two rules are deliberate:
 *
 * 1. Upstream failures never become 5xx. A dead quote source is normal
 *    operation, so it answers `200 {ok:false,error}` and the client keeps
 *    rendering the previous page. Only a malformed request (400), a foreign
 *    origin (403) or an unknown path (404) uses a non-200 status.
 * 2. Writes are loopback-only. The strip is served over the profile's loopback
 *    web server, so a loopback peer plus a loopback Host/Origin covers DNS
 *    rebinding, and a foreign Origin covers another page in the same browser
 *    posting on the user's behalf.
 */

import { createHash } from 'node:crypto'
import { MAX_ALERTS, evaluateAlerts, normalizeAlert, rearmAlert } from './alerts.js'
import { ADJUSTS, clamp, MINI_CHART_TYPES, normalizePrefs, PERIODS, publicSettings } from './config.js'
import { messageOf } from './http.js'
import {
  attachExtended,
  attachSparklines,
  buildQuotes,
  buildSparklines,
  klineFor,
  searchSymbols,
  sourceHealth,
  trendFor,
  trendWithBaseline,
} from './providers/index.js'
import { sessionFor } from './session.js'
import { activeSymbols } from './store.js'
import { MAX_SYMBOLS, normalizeSymbol, parseSymbols } from './symbols.js'
import { MAX_TRADES, computePositions, holdingsFromPositions, normalizeTrade } from './trades.js'

export const ROUTE_PATH = '/dsh-stock-ticker'
export const ROUTE_ALIAS = '/dsh-stock-dock'

const MAX_BODY_BYTES = 64 * 1024
const MINUTE_PERIODS = new Set(['m1', 'm5', 'm15', 'm30', 'm60'])

export function createRouter({ ctx, settings, cache, store }) {
  return async function handle(req, res) {
    try {
      await route(req, res)
    } catch (error) {
      console.error('[stock-ticker] request failed', error)
      // Never let an unexpected throw reach the HTTP server as a 500: the
      // client understands one failure shape.
      sendJson(res, 200, { ok: false, error: messageOf(error) })
    }
  }

  async function route(req, res) {
    const url = new URL(req.url ?? '/', 'http://localhost')
    const path = stripPrefix(url.pathname)
    const method = req.method ?? 'GET'

    if (method === 'OPTIONS') {
      res.statusCode = 204
      res.end()
      return
    }

    if (method === 'GET' && path === '/quotes') return sendQuotes(url, res)
    if (method === 'GET' && path === '/sparklines') return sendSparklines(url, res, req)
    if (method === 'GET' && path === '/trades') return sendTrades(url, res)
    if (method === 'GET' && path === '/kline') return sendKline(url, res)
    if (method === 'GET' && path === '/trend') return sendTrend(url, res)
    if (method === 'GET' && path === '/volume-alerts') return sendVolumeAlerts(url, res)
    if (method === 'GET' && path === '/logo') return sendLogo(url, res)
    if (method === 'GET' && path === '/search') return sendSearch(url, res)
    if (method === 'GET' && path === '/settings') return sendSettings(res)
    if (method === 'GET' && path === '/cache') return sendCache(res)
    if (method === 'POST' && path === '/cache/clear') return clearCache(res)
    if (method === 'GET' && path === '/health') return sendHealth(res)
    if (method === 'POST' && path === '/config') return writeConfig(req, res)
    if (method === 'POST' && path === '/prefs') return writePrefs(req, res)
    if (method === 'POST' && path === '/alerts') return writeAlerts(req, res)
    if (method === 'POST' && path === '/holdings') return writeHoldings(req, res)
    if (method === 'POST' && path === '/trades') return writeTrades(req, res)
    if (method === 'POST' && path === '/groups') return writeGroups(req, res)

    sendJson(res, 404, { ok: false, error: 'unknown route' })
  }

  async function sendQuotes(url, res) {
    const requested = readSymbolsParam(url)
    if (requested.present && requested.symbols.length === 0) {
      sendJson(res, 400, { ok: false, error: 'symbols-empty' })
      return
    }
    const state = await store.snapshot()
    const groupId = url.searchParams.get('group')
    const groupSymbols =
      groupId && state.groups.some((group) => group.id === groupId)
        ? state.groups.find((group) => group.id === groupId).symbols
        : activeSymbols(state)
    const symbols = requested.symbols.length > 0 ? requested.symbols : groupSymbols
    const effective = publicSettings(settings, state.prefs)
    const requestedSource = url.searchParams.get('source')
    const forced =
      requestedSource === 'sina' || requestedSource === 'tencent' || requestedSource === 'eastmoney'
        ? requestedSource
        : effective.source && effective.source !== 'auto'
          ? effective.source
          : undefined
    const bundle = await buildQuotes(cache, symbols, forced)

    // K-lines are no longer part of the poll: they are ~80% of the payload and
    // change once a day. `sparklines=1` keeps the old shape for one release.
    let quotes =
      url.searchParams.get('sparklines') === '1'
        ? await attachSparklines(cache, bundle.quotes, effective.klineDays)
        : bundle.quotes
    if (effective.showExtended) quotes = await attachExtended(cache, quotes)
    const fired = evaluateAlerts(state.alerts, quotes)
    if (fired.length > 0) {
      store.pushFired(fired)
      await store.update((current) => current)
    }

    const alertRows = (symbol) => state.alerts.filter((alert) => alert.symbol === symbol)
    const { positions } = computePositions(state.trades)
    const enriched = quotes.map((quote) => {
      const position = positions.get(quote.symbol)
      return {
        ...quote,
        alerts: alertRows(quote.symbol).map((alert) => ({ id: alert.id, op: alert.op, price: alert.price, firedAt: alert.firedAt })),
        holding: state.holdings[quote.symbol] ?? null,
        trade: position
          ? { shares: position.shares, cost: position.cost, realized: position.realized, fees: position.fees }
          : null,
      }
    })

    sendJson(res, 200, {
      ok: true,
      updatedAt: bundle.at,
      source: bundle.source,
      sources: sourceHealth(cache),
      session: sessionFor(symbols, effective.refreshSeconds, quotes),
      settings: { ...effective, symbols },
      groups: state.groups.map((group) => ({ id: group.id, name: group.name, count: group.symbols.length })),
      activeGroup: state.activeGroup,
      symbols,
      quotes: enriched,
      fired: store.drainFired(),
    })
  }

  /**
   * Mini-chart bars for the whole strip in one request. The ETag is derived from
   * the row dates and lengths, so a client that revalidates with
   * `If-None-Match` gets a 304 until a new daily bar appears.
   */
  async function sendSparklines(url, res, req) {
    const requested = readSymbolsParam(url)
    const state = await store.snapshot()
    const symbols = requested.symbols.length > 0 ? requested.symbols : activeSymbols(state)
    const effective = publicSettings(settings, state.prefs)
    const days = Math.round(clamp(url.searchParams.get('days'), 10, 120, effective.klineDays))
    const requestedType = url.searchParams.get('type')
    const type = MINI_CHART_TYPES.includes(requestedType) ? requestedType : effective.miniChartType
    let charts
    let rows
    try {
      const built = await buildSparklines(cache, symbols, days, type)
      charts = built.charts
      rows = built.rows
    } catch (error) {
      sendJson(res, 200, { ok: false, error: messageOf(error) })
      return
    }
    const signature = [symbols.join(','), type, days, ...symbols.map((symbol) => {
      const chart = charts[symbol]
      if (chart?.kind === 'line') {
        const last = chart.points[chart.points.length - 1]
        return `L${chart.points.length}:${last?.time ?? ''}:${last?.price ?? ''}`
      }
      const list = chart?.rows ?? []
      return `C${list.length}:${list[list.length - 1]?.date ?? ''}`
    })].join('|')
    const etag = `"${createHash('sha1').update(signature).digest('hex').slice(0, 16)}"`
    if (req.headers['if-none-match'] === etag) {
      res.statusCode = 304
      res.setHeader('ETag', etag)
      res.end()
      return
    }
    sendJson(res, 200, { ok: true, updatedAt: Date.now(), days, type, charts, rows, etag }, { etag, cache: 'private, max-age=60' })
  }

  async function sendTrades(url, res) {
    const symbol = url.searchParams.get('symbol')
    const state = await store.snapshot()
    const wanted = symbol ? normalizeSymbol(symbol) : undefined
    if (symbol && !wanted) {
      sendJson(res, 400, { ok: false, error: 'invalid-symbol' })
      return
    }
    const list = wanted ? state.trades.filter((trade) => trade.symbol === wanted) : state.trades
    const { positions, warnings } = computePositions(state.trades)
    const position = wanted ? positions.get(wanted) ?? null : null
    sendJson(res, 200, {
      ok: true,
      symbol: wanted ?? null,
      trades: list.slice(-200),
      position,
      warnings: warnings.filter((warning) => !wanted || warning.symbol === wanted),
      count: list.length,
    })
  }

  async function writeTrades(req, res) {
    if (!isTrustedRequest(ctx, req)) {
      sendJson(res, 403, { ok: false, error: 'forbidden' })
      return
    }
    const body = await readJsonBody(req).catch(() => null)
    if (!body || typeof body !== 'object') {
      sendJson(res, 400, { ok: false, error: 'invalid-body' })
      return
    }
    const action = String(body.action ?? 'save')
    let error
    const state = await store.update((current) => {
      if (action === 'save') {
        const symbol = normalizeSymbol(String(body.symbol ?? body.trade?.symbol ?? ''))
        if (!symbol) {
          error = 'invalid-symbol'
          return current
        }
        const trade = normalizeTrade({ ...body.trade, ...body, symbol })
        if (!trade) {
          error = 'invalid-trade'
          return current
        }
        current.trades = [...current.trades.filter((entry) => entry.id !== trade.id), trade].slice(-MAX_TRADES)
        return current
      }
      if (action === 'remove') {
        current.trades = current.trades.filter((trade) => trade.id !== body.id)
        return current
      }
      if (action === 'clear') {
        const symbol = body.symbol ? normalizeSymbol(String(body.symbol)) : undefined
        current.trades = symbol ? current.trades.filter((trade) => trade.symbol !== symbol) : []
        return current
      }
      if (action === 'apply') {
        const { positions } = computePositions(current.trades)
        current.holdings = holdingsFromPositions(positions)
        return current
      }
      error = 'unknown-action'
      return current
    })
    if (error) {
      sendJson(res, 400, { ok: false, error })
      return
    }
    const { positions, warnings } = computePositions(state.trades)
    sendJson(res, 200, {
      ok: true,
      count: state.trades.length,
      trades: body.symbol ? state.trades.filter((trade) => trade.symbol === normalizeSymbol(String(body.symbol))) : state.trades.slice(-50),
      positions: [...positions.values()],
      warnings,
      holdings: state.holdings,
    })
  }

  async function sendKline(url, res) {
    const symbol = normalizeSymbol(url.searchParams.get('symbol') ?? '')
    if (!symbol) {
      sendJson(res, 400, { ok: false, error: 'invalid-symbol' })
      return
    }
    const period = normalizePeriod(url.searchParams.get('period'))
    const adjust = normalizeAdjust(url.searchParams.get('adjust'), period)
    const limit = clampLimit(url.searchParams.get('limit'), period)
    const refresh = url.searchParams.get('refresh') === '1'
    const result = await klineFor(cache, symbol, period, adjust, limit, refresh).catch((error) => ({
      rows: [],
      source: 'none',
      error: messageOf(error),
    }))
    sendJson(res, 200, {
      ok: result.rows.length > 0,
      symbol,
      period,
      adjust,
      limit,
      rows: result.rows,
      source: result.source,
      ...(result.rows.length === 0 && result.error ? { error: result.error } : {}),
    })
  }

  /** The latest 5m bar versus the same slot on the previous trading day. */
  function latestVolumeAlert(rows) {
    const last = rows[rows.length - 1]
    if (!last || typeof last.volume !== 'number' || typeof last.date !== 'string' || !/^\d{12}$/.test(last.date)) return null
    const day = last.date.slice(0, 8)
    const slot = last.date.slice(8)
    let baseline = null
    let baselineDate = ''
    for (const row of rows) {
      if (typeof row.volume !== 'number' || typeof row.date !== 'string' || !/^\d{12}$/.test(row.date)) continue
      if (row.date.slice(0, 8) >= day || row.date.slice(8) !== slot) continue
      if (row.date > baselineDate) {
        baseline = row.volume
        baselineDate = row.date
      }
    }
    if (baseline === null || baseline <= 0) return null
    const ratio = last.volume / baseline
    return {
      time: last.date,
      volume: last.volume,
      baseline,
      ratio,
      pct: (ratio - 1) * 100,
    }
  }

  async function sendVolumeAlerts(url, res) {
    const state = await store.snapshot()
    const requested = readSymbolsParam(url)
    const symbols = requested.symbols.length > 0 ? requested.symbols : activeSymbols(state)
    const threshold = clamp(url.searchParams.get('pct'), 1, 1000, 100)
    const alerts = {}
    await Promise.all(
      symbols.map(async (symbol) => {
        try {
          const { rows } = await klineFor(cache, symbol, 'm5', 'qfq', 96)
          const alert = latestVolumeAlert(rows)
          if (alert && alert.pct >= threshold) alerts[symbol] = alert
        } catch {
          /* one symbol must not fail the strip */
        }
      }),
    )
    sendJson(res, 200, { ok: true, alerts })
  }

  async function sendTrend(url, res) {
    const symbol = normalizeSymbol(url.searchParams.get('symbol') ?? '')
    if (!symbol) {
      sendJson(res, 400, { ok: false, error: 'invalid-symbol' })
      return
    }
    const days = Math.round(clamp(url.searchParams.get('days'), 1, 5, 1))
    const baseline = Math.round(clamp(url.searchParams.get('baseline'), 0, 4, 0))
    const refresh = url.searchParams.get('refresh') === '1'
    try {
      // A baseline request always serves one day plus its same-time comparison;
      // the five-day overlay keeps its own sequential payload.
      const value = baseline > 0
        ? await trendWithBaseline(cache, symbol, baseline, refresh)
        : await trendFor(cache, symbol, days, refresh)
      sendJson(res, 200, { ok: true, ...value })
    } catch (error) {
      sendJson(res, 200, { ok: false, symbol, days, error: messageOf(error) })
    }
  }

  async function sendCache(res) {
    const info = cache.disk
      ? await cache.disk.info().catch(() => ({ path: '', bytes: 0, entries: { klines: 0, trends: 0 } }))
      : { path: '', bytes: 0, entries: { klines: 0, trends: 0 } }
    sendJson(res, 200, { ok: true, ...info })
  }

  async function clearCache(res) {
    if (cache.disk) await cache.disk.clear().catch(() => {})
    sendJson(res, 200, { ok: true, bytes: 0 })
  }

  /** FMP's public image-stock endpoint; proxied so the browser stays same-origin. */
  function logoSource(symbol) {
    const code = String(symbol).replace(/^(sh|sz|hk|us)/i, '')
    if (/^us/i.test(symbol)) return `https://financialmodelingprep.com/image-stock/${encodeURIComponent(code.toUpperCase())}.png`
    if (/^hk/i.test(symbol)) {
      if (!/^\d{5}$/.test(code)) return null
      const four = code.startsWith('0') ? code.slice(1) : code.slice(-4)
      return `https://financialmodelingprep.com/image-stock/${four}.HK.png`
    }
    if (/^sh/i.test(symbol)) return `https://financialmodelingprep.com/image-stock/${code}.SS.png`
    if (/^sz/i.test(symbol)) return `https://financialmodelingprep.com/image-stock/${code}.SZ.png`
    return null
  }

  async function sendLogo(url, res) {
    const symbol = normalizeSymbol(url.searchParams.get('symbol') ?? '')
    if (!symbol) {
      res.statusCode = 404
      res.end()
      return
    }
    const cached = cache.logos.get(symbol)
    if (cached && Date.now() - cached.at < 24 * 60 * 60 * 1000) {
      res.writeHead(200, {
        'Content-Type': cached.type,
        'Content-Length': cached.body.length,
        'Cache-Control': 'public, max-age=86400',
      })
      res.end(cached.body)
      return
    }
    const source = logoSource(symbol)
    if (!source) {
      res.statusCode = 404
      res.end()
      return
    }
    try {
      const response = await fetch(source, {
        headers: { Accept: 'image/*', 'User-Agent': 'Mozilla/5.0' },
        signal: AbortSignal.timeout(8000),
      })
      const type = response.headers.get('content-type') ?? ''
      if (!response.ok || !type.startsWith('image/')) throw new Error(`logo HTTP ${response.status}`)
      const body = Buffer.from(await response.arrayBuffer())
      if (body.length === 0 || body.length > 512 * 1024) throw new Error('logo size')
      cache.logos.set(symbol, { at: Date.now(), type, body })
      if (cache.logos.size > 100) cache.logos.delete(cache.logos.keys().next().value)
      res.writeHead(200, {
        'Content-Type': type,
        'Content-Length': body.length,
        'Cache-Control': 'public, max-age=86400',
      })
      res.end(body)
    } catch {
      res.statusCode = 404
      res.end()
    }
  }

  async function sendSearch(url, res) {
    const query = (url.searchParams.get('q') ?? '').trim()
    if (query === '') {
      sendJson(res, 200, { ok: true, items: [] })
      return
    }
    const limit = Math.round(clamp(url.searchParams.get('limit'), 1, 20, 8))
    try {
      const items = await searchSymbols(query, limit)
      sendJson(res, 200, { ok: true, query, items })
    } catch (error) {
      sendJson(res, 200, { ok: false, query, items: [], error: messageOf(error) })
    }
  }

  async function sendSettings(res) {
    const state = await store.snapshot()
    sendJson(res, 200, {
      ok: true,
      settings: { ...publicSettings(settings, state.prefs), symbols: activeSymbols(state) },
      prefs: normalizePrefs(state.prefs),
      groups: state.groups,
      activeGroup: state.activeGroup,
    })
  }

  async function sendHealth(res) {
    const state = await store.snapshot()
    sendJson(res, 200, {
      ok: true,
      node: process.version,
      store: store.path,
      sources: sourceHealth(cache),
      caches: {
        quotes: cache.quotes.size,
        klines: cache.klines.size,
        trends: cache.trends.size,
        extended: cache.extended?.size ?? 0,
      },
      counts: {
        groups: state.groups.length,
        symbols: activeSymbols(state).length,
        alerts: state.alerts.length,
        holdings: Object.keys(state.holdings).length,
      },
    })
  }

  async function writeConfig(req, res) {
    if (!isTrustedRequest(ctx, req)) {
      sendJson(res, 403, { ok: false, error: 'forbidden' })
      return
    }
    let body
    try {
      body = await readJsonBody(req)
    } catch {
      sendJson(res, 400, { ok: false, error: 'invalid-body' })
      return
    }
    const parsed = parseSymbols(Array.isArray(body.symbols) ? body.symbols : [])
    if (parsed.symbols.length === 0) {
      sendJson(res, 400, { ok: false, error: 'symbols-empty', rejected: parsed.rejected })
      return
    }
    const target = typeof body.group === 'string' && body.group !== '' ? body.group : 'default'

    const state = await store.update((current) => {
      const group = current.groups.find((entry) => entry.id === target)
      if (group) group.symbols = parsed.symbols
      else current.groups.push({ id: target, name: '自选', symbols: parsed.symbols })
      return current
    })

    let persisted = 'store'
    const entry = ctx.fiber?.entry
    const editor = ctx.get('configEditor')
    if (target === 'default' && entry && editor) {
      try {
        await editor.edit(entry, (current) => ({ ...current, symbols: parsed.symbols }))
        persisted = 'config'
      } catch (error) {
        // The store already holds the list; a failed profile write only means
        // the next profile start falls back to the previous default.
        console.error('[stock-ticker] config write failed', messageOf(error))
      }
    }

    sendJson(res, 200, {
      ok: true,
      symbols: parsed.symbols,
      rejected: parsed.rejected,
      dropped: parsed.dropped,
      group: target,
      persisted,
      groups: state.groups,
    })
  }

  async function writePrefs(req, res) {
    if (!isTrustedRequest(ctx, req)) {
      sendJson(res, 403, { ok: false, error: 'forbidden' })
      return
    }
    const body = await readJsonBody(req).catch(() => null)
    if (!body || typeof body !== 'object') {
      sendJson(res, 400, { ok: false, error: 'invalid-body' })
      return
    }
    const state = await store.update((current) => {
      current.prefs = normalizePrefs({ ...current.prefs, ...(body.patch ?? body) })
      if (body.symbols) {
        const parsed = parseSymbols(Array.isArray(body.symbols) ? body.symbols : [])
        if (parsed.symbols.length > 0) {
          const group = current.groups.find((entry) => entry.id === 'default')
          if (group) group.symbols = parsed.symbols
        }
      }
      return current
    })
    sendJson(res, 200, { ok: true, prefs: state.prefs, settings: publicSettings(settings, state.prefs) })
  }

  async function writeAlerts(req, res) {
    if (!isTrustedRequest(ctx, req)) {
      sendJson(res, 403, { ok: false, error: 'forbidden' })
      return
    }
    const body = await readJsonBody(req).catch(() => null)
    if (!body || typeof body !== 'object') {
      sendJson(res, 400, { ok: false, error: 'invalid-body' })
      return
    }
    const action = String(body.action ?? 'save')
    let error
    const state = await store.update((current) => {
      if (action === 'save') {
        const symbol = normalizeSymbol(String(body.symbol ?? body.alert?.symbol ?? ''))
        if (!symbol) {
          error = 'invalid-symbol'
          return current
        }
        const alert = normalizeAlert({ ...body.alert, symbol, op: body.op ?? body.alert?.op, price: body.price ?? body.alert?.price })
        if (!alert) {
          error = 'invalid-alert'
          return current
        }
        const index = current.alerts.findIndex((entry) => entry.id === alert.id)
        if (index >= 0) current.alerts[index] = alert
        else current.alerts.unshift(alert)
        current.alerts = current.alerts.slice(0, MAX_ALERTS)
        return current
      }
      if (action === 'remove') {
        current.alerts = current.alerts.filter((entry) => entry.id !== body.id)
        return current
      }
      if (action === 'ack') {
        rearmAlert(current.alerts, String(body.id ?? ''))
        return current
      }
      if (action === 'clear') {
        const symbol = body.symbol ? normalizeSymbol(String(body.symbol)) : undefined
        current.alerts = symbol ? current.alerts.filter((entry) => entry.symbol !== symbol) : []
        return current
      }
      error = 'unknown-action'
      return current
    })
    if (error) {
      sendJson(res, 400, { ok: false, error })
      return
    }
    sendJson(res, 200, { ok: true, alerts: state.alerts })
  }

  async function writeHoldings(req, res) {
    if (!isTrustedRequest(ctx, req)) {
      sendJson(res, 403, { ok: false, error: 'forbidden' })
      return
    }
    const body = await readJsonBody(req).catch(() => null)
    if (!body || typeof body !== 'object') {
      sendJson(res, 400, { ok: false, error: 'invalid-body' })
      return
    }
    const symbol = normalizeSymbol(String(body.symbol ?? ''))
    if (!symbol) {
      sendJson(res, 400, { ok: false, error: 'invalid-symbol' })
      return
    }
    let error
    const state = await store.update((current) => {
      if (body.action === 'remove') {
        delete current.holdings[symbol]
        return current
      }
      const shares = Number.parseFloat(body.shares)
      const cost = Number.parseFloat(body.cost)
      if (!Number.isFinite(shares) || shares <= 0 || !Number.isFinite(cost) || cost <= 0) {
        error = 'invalid-holding'
        return current
      }
      current.holdings[symbol] = {
        shares: Math.round(shares * 1000) / 1000,
        cost: Math.round(cost * 1000) / 1000,
      }
      return current
    })
    if (error) {
      sendJson(res, 400, { ok: false, error })
      return
    }
    sendJson(res, 200, { ok: true, holdings: state.holdings })
  }

  async function writeGroups(req, res) {
    if (!isTrustedRequest(ctx, req)) {
      sendJson(res, 403, { ok: false, error: 'forbidden' })
      return
    }
    const body = await readJsonBody(req).catch(() => null)
    if (!body || typeof body !== 'object') {
      sendJson(res, 400, { ok: false, error: 'invalid-body' })
      return
    }
    const action = String(body.action ?? 'activate')
    let error
    const state = await store.update((current) => {
      if (action === 'activate') {
        const id = String(body.id ?? '')
        if (!current.groups.some((group) => group.id === id)) {
          error = 'unknown-group'
          return current
        }
        current.activeGroup = id
        return current
      }
      if (action === 'save') {
        const name = String(body.name ?? '').trim().slice(0, 20)
        const parsed = parseSymbols(Array.isArray(body.symbols) ? body.symbols : [])
        const id = String(body.id ?? `g${Date.now().toString(36)}`)
        const existing = current.groups.find((group) => group.id === id)
        if (existing) {
          if (name !== '') existing.name = name
          existing.symbols = parsed.symbols
        } else {
          current.groups.push({ id, name: name === '' ? '分组' : name, symbols: parsed.symbols.slice(0, MAX_SYMBOLS) })
        }
        return current
      }
      if (action === 'remove') {
        const id = String(body.id ?? '')
        if (id === 'default') {
          error = 'cannot-remove-default'
          return current
        }
        current.groups = current.groups.filter((group) => group.id !== id)
        if (current.activeGroup === id) current.activeGroup = 'default'
        return current
      }
      if (action === 'reorder') {
        const order = Array.isArray(body.order) ? body.order.map((id) => String(id)) : []
        const ids = current.groups.map((group) => group.id)
        if (
          order.length !== ids.length ||
          new Set(order).size !== order.length ||
          !order.every((id) => ids.includes(id))
        ) {
          error = 'invalid-order'
          return current
        }
        current.groups = order.map((id) => current.groups.find((group) => group.id === id))
        return current
      }
      if (action === 'addMarket') {
        if (!current.groups.some((group) => group.id === 'market')) {
          current.groups.push({
            id: 'market',
            name: '大盘',
            preset: true,
            symbols: ['sh000001', 'sz399001', 'sz399006', 'sh000688', 'hkHSI', 'usIXIC'],
          })
        }
        return current
      }
      if (action === 'rename') {
        const id = String(body.id ?? '')
        const group = current.groups.find((entry) => entry.id === id)
        if (!group) {
          error = 'unknown-group'
          return current
        }
        const name = String(body.name ?? '').trim().slice(0, 20)
        if (name !== '') group.name = name
        return current
      }
      error = 'unknown-action'
      return current
    })
    if (error) {
      sendJson(res, 400, { ok: false, error })
      return
    }
    sendJson(res, 200, { ok: true, groups: state.groups, activeGroup: state.activeGroup })
  }

  function stripPrefix(pathname) {
    if (pathname.startsWith(ROUTE_PATH)) return pathname.slice(ROUTE_PATH.length) || '/'
    if (pathname.startsWith(ROUTE_ALIAS)) return pathname.slice(ROUTE_ALIAS.length) || '/'
    return pathname
  }
}

/* ------------------------------------------------------------------ helpers */

function readSymbolsParam(url) {
  const compact = url.searchParams.get('symbols')
  const provided = compact !== null && compact.trim() !== '' ? compact.split(',') : url.searchParams.getAll('symbol')
  return { present: provided.length > 0, symbols: parseSymbols(provided).symbols }
}

function normalizePeriod(value) {
  return PERIODS.includes(value) ? value : 'day'
}

function normalizeAdjust(value, period) {
  if (MINUTE_PERIODS.has(period)) return 'none'
  if (ADJUSTS.includes(value)) return value
  return 'qfq'
}

function clampLimit(value, period) {
  const minute = MINUTE_PERIODS.has(period)
  return Math.round(clamp(value, 10, minute ? 5001 : 1300, minute ? 120 : 40))
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

export function isTrustedRequest(ctx, req) {
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

export function sendJson(res, status, value, options = {}) {
  const body = JSON.stringify(value)
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  if (options.etag) res.setHeader('ETag', options.etag)
  res.setHeader('Cache-Control', options.cache ?? 'no-store')
  res.end(body)
}

export { MAX_BODY_BYTES }
