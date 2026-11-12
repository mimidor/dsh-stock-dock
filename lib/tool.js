/**
 * The model-facing surface: `stock_quote`.
 *
 * The plugin already owns a provider layer, a cache and a watchlist; this file
 * wraps them into the raw ToolDefinition the registry consumes (a `parameters`
 * JSON Schema plus `output.schema` / `output.render`) so the conversation can
 * answer "茅台现在多少钱" without the user looking at the strip.
 *
 * It deliberately imports nothing outside the package: a workspace-authored
 * bundle is linked into the profile from outside it, so a bare
 * `@deepseek-ai/...` specifier would not resolve and the row would fail to
 * activate.
 */

import { fetchAnnouncements, fetchBillboard } from './events.js'
import { marketOf, normalizeSymbol } from './symbols.js'

const DESCRIPTION = [
  'Read the latest market quote (price, change, percentage, open/high/low, previous close, volume, turnover)',
  'for one or more listed securities: Chinese A-shares (Shanghai/Shenzhen/Beijing), Hong Kong and US stocks.',
  'Call it with the symbols the user named; call it with no arguments for the configured watchlist.',
  'Symbols accept 600519 / sh600519 / 600519.SH / 00700 / hk00700 / AAPL / usAAPL.',
  'Never guess a price: report only what this tool returns.',
].join(' ')

const PARAMETERS = {
  type: 'object',
  additionalProperties: false,
  properties: {
    symbols: {
      type: 'array',
      description: 'Symbols to quote, e.g. ["sh600519", "00700", "AAPL"]. Omit to quote the configured watchlist.',
      items: { type: 'string' },
    },
  },
}

const OUTPUT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    asOf: { type: 'string', description: 'Instant the quotes were read, ISO 8601.' },
    source: { type: 'string', description: 'Quote data provider that answered first.' },
    quotes: {
      type: 'array',
      description: 'One entry per requested symbol, in the order requested.',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          symbol: { type: 'string', description: 'Canonical symbol.' },
          code: { type: 'string', description: 'Exchange security code.' },
          name: { type: 'string', description: 'Security name.' },
          market: { type: 'string', description: 'cn, hk or us.' },
          price: { type: 'number', description: 'Latest price.' },
          change: { type: 'number', description: 'Change against the previous close.' },
          changePct: { type: 'number', description: 'Change percentage.' },
          open: { type: 'number', description: 'Session open.' },
          high: { type: 'number', description: 'Session high.' },
          low: { type: 'number', description: 'Session low.' },
          prevClose: { type: 'number', description: 'Previous close.' },
          volume: { type: 'number', description: 'Volume in lots for A-shares, shares elsewhere.' },
          amount: { type: 'number', description: 'Turnover in the quote currency.' },
          marketCap: { type: 'number', description: 'Total market capitalisation when the source reports it.' },
          error: { type: 'string', description: 'Why this row has no data.' },
        },
        required: ['symbol'],
      },
    },
  },
}

/**
 * @param options.getQuotes - `(symbols) => Promise<{source, at, quotes}>`; the plugin passes its cached provider call.
 * @param options.defaultSymbols - returns the watchlist used when the model names nothing.
 */
export function buildToolDefinition({ getQuotes, defaultSymbols }) {
  return {
    name: 'stock_quote',
    description: DESCRIPTION,
    parameters: PARAMETERS,
    output: {
      schema: OUTPUT_SCHEMA,
      render: (_args, value) => [{ type: 'text', text: renderQuotes(value) }],
    },
    isConcurrencySafe: () => true,
    presentCall(args) {
      const shown = requested(args)
      return {
        card: 'generic',
        title: shown.length > 0 ? `查询行情 ${shown.join(' ')}` : '查询自选股行情',
        kind: 'fetch',
      }
    },
    async execute(args) {
      const wanted = requested(args)
      const symbols = wanted.length > 0 ? wanted : defaultSymbols()
      const resolved = []
      const rejected = []
      for (const raw of symbols) {
        const symbol = normalizeSymbol(raw)
        if (symbol) resolved.push(symbol)
        else rejected.push(raw)
      }
      if (resolved.length === 0) {
        return {
          asOf: new Date().toISOString(),
          source: 'none',
          quotes: rejected.map((symbol) => ({ symbol, error: 'unrecognized' })),
        }
      }
      const bundle = await getQuotes(resolved)
      return {
        asOf: new Date(bundle?.at ?? Date.now()).toISOString(),
        source: bundle?.source ?? 'unknown',
        quotes: (bundle?.quotes ?? []).map(toToolQuote).concat(rejected.map((symbol) => ({ symbol, error: 'unrecognized' }))),
      }
    },
  }
}

function requested(args) {
  const raw = args === null || typeof args !== 'object' ? undefined : args.symbols
  const list = typeof raw === 'string' ? [raw] : Array.isArray(raw) ? raw : []
  return list.map((entry) => (typeof entry === 'string' ? entry.trim() : '')).filter((entry) => entry !== '')
}

/** Only the fields the schema promises, and no nulls: a missing number is omitted. */
function toToolQuote(quote) {
  if (!quote || quote.error) return { symbol: quote?.symbol ?? '', error: quote?.error ?? 'no-data' }
  const out = {
    symbol: quote.symbol,
    code: quote.code ?? quote.symbol.slice(2),
    name: quote.name ?? quote.symbol,
    market: quote.market ?? marketOf(quote.symbol),
  }
  for (const field of ['price', 'change', 'changePct', 'open', 'high', 'low', 'prevClose', 'volume', 'amount']) {
    if (typeof quote[field] === 'number') out[field] = quote[field]
  }
  const cap = quote.extras?.totalCap
  if (typeof cap === 'number') out.marketCap = cap
  return out
}

export function renderQuotes(value) {
  const lines = [`行情（${value?.source ?? 'unknown'} · ${value?.asOf ?? ''}）`]
  for (const quote of value?.quotes ?? []) {
    if (quote.error) {
      lines.push(`${quote.symbol}: 无数据（${quote.error}）`)
      continue
    }
    const pct = typeof quote.changePct === 'number' ? `${quote.changePct > 0 ? '+' : ''}${quote.changePct.toFixed(2)}%` : '--'
    const price = typeof quote.price === 'number' ? quote.price.toFixed(2) : '--'
    const range =
      typeof quote.low === 'number' && typeof quote.high === 'number'
        ? ` 低 ${quote.low.toFixed(2)} / 高 ${quote.high.toFixed(2)}`
        : ''
    lines.push(`${quote.name}（${quote.symbol}） ${price} ${pct}${range}`)
  }
  lines.push('数据来自公开行情接口，有延迟，不构成投资建议。')
  return lines.join('\n')
}


/* ------------------------------------------------------------------ events */

const EVENTS_DESCRIPTION = [
  'Read company events for a Chinese A-share: the announcement list (公告) or the daily billboard (龙虎榜) entries.',
  'Call it with the symbol the user named; action defaults to announcements. A-share symbols only.',
  'Example symbols: 600519 / sh600519.',
].join(' ')

const EVENTS_PARAMETERS = {
  type: 'object',
  additionalProperties: false,
  properties: {
    symbol: { type: 'string', description: 'A-share symbol, e.g. 600519 or sh600519.' },
    action: {
      type: 'string',
      enum: ['announcements', 'billboard'],
      description: 'announcements = 公告; billboard = 龙虎榜 (daily trading billboard). Default announcements.',
    },
    limit: { type: 'number', description: 'How many entries to return, 1-20. Default 10.' },
  },
  required: ['symbol'],
}

const EVENTS_OUTPUT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    symbol: { type: 'string' },
    code: { type: 'string' },
    action: { type: 'string' },
    items: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: true,
        properties: {
          title: { type: 'string' },
          date: { type: 'string' },
          type: { type: 'string' },
          url: { type: 'string' },
        },
      },
    },
    error: { type: 'string' },
  },
}

/** The model-facing events surface; fetched only when called, never polled. */
export function buildEventsToolDefinition() {
  return {
    name: 'stock_events',
    description: EVENTS_DESCRIPTION,
    parameters: EVENTS_PARAMETERS,
    output: {
      schema: EVENTS_OUTPUT_SCHEMA,
      render: (_args, value) => [{ type: 'text', text: renderEvents(value) }],
    },
    isConcurrencySafe: () => true,
    presentCall(args) {
      const symbol = typeof args?.symbol === 'string' ? args.symbol : ''
      const action = args?.action === 'billboard' ? '龙虎榜' : '公告'
      return { card: 'generic', title: `${action} ${symbol}`.trim(), kind: 'fetch' }
    },
    async execute(args) {
      const symbol = normalizeSymbol(typeof args?.symbol === 'string' ? args.symbol : '')
      const action = args?.action === 'billboard' ? 'billboard' : 'announcements'
      const limit = Number.isFinite(Number(args?.limit)) ? Math.max(1, Math.min(Number(args.limit), 20)) : 10
      if (!symbol) return { symbol: String(args?.symbol ?? ''), action, items: [], error: 'invalid-symbol' }
      if (marketOf(symbol) !== 'cn') {
        return { symbol, action, items: [], error: '公告与龙虎榜只支持 A 股' }
      }
      const code = symbol.slice(2)
      try {
        const items = action === 'billboard' ? await fetchBillboard(code, limit) : await fetchAnnouncements(code, limit)
        return { symbol, code, action, items }
      } catch (error) {
        return { symbol, code, action, items: [], error: error instanceof Error ? error.message : String(error) }
      }
    },
  }
}

export function renderEvents(value) {
  if (value?.error) return `读取失败：${value.error}`
  const label = value?.action === 'billboard' ? '龙虎榜' : '公告'
  const lines = [`${value?.symbol ?? ''} ${label}（${value?.items?.length ?? 0} 条）`]
  for (const item of value?.items ?? []) {
    if (item.title) {
      lines.push(`${item.date} ${item.type ? `[${item.type}] ` : ''}${item.title}`)
      continue
    }
    const parts = [item.date]
    if (typeof item.changePct === 'number') parts.push(`${item.changePct > 0 ? '+' : ''}${item.changePct.toFixed(2)}%`)
    if (typeof item.dealAmount === 'number') parts.push(`成交额 ${(item.dealAmount / 1e8).toFixed(2)}亿`)
    if (item.reason) parts.push(item.reason)
    lines.push(parts.join(' '))
  }
  if ((value?.items?.length ?? 0) === 0) lines.push('没有数据。')
  return lines.join('\n')
}
