/**
 * Host half of the stock ticker bundle.
 *
 * It normalizes the configured symbols, keeps a host-side store (watchlist
 * groups, holdings, alerts, UI preferences), fetches quotes, K-lines and
 * intraday lines from Tencent with Sina and Eastmoney as fallbacks, caches every
 * answer briefly, and answers the Client half over same-origin routes under
 * `/dsh-stock-ticker`. It also registers the `stock_quote` tool so the model can
 * read the same quotes inside a conversation.
 *
 * The data layer lives in `lib/` so this file stays a wiring diagram:
 *
 *   lib/symbols.js     normalization + per-provider spellings
 *   lib/session.js     trading sessions and holiday detection
 *   lib/http.js        fetch helpers (GBK decoding, timeouts)
 *   lib/cache.js       bounded TTL caches
 *   lib/providers/*    Tencent, Sina, Eastmoney
 *   lib/store.js       JSON store in the DSH home
 *   lib/alerts.js      price alerts
 *   lib/routes.js      HTTP surface
 *   lib/tool.js        `stock_quote` tool definition
 */

import { KLINES_MAX_ENTRIES, rememberKline } from './lib/cache.js'
import { createDiskCache } from './lib/disk-cache.js'
import { DEFAULT_PREFS, normalizePrefs, normalizeSettings, publicSettings } from './lib/config.js'
import { evaluateAlerts, normalizeAlert, rearmAlert } from './lib/alerts.js'
import { buildQuotes } from './lib/providers/index.js'
import * as eastmoney from './lib/providers/eastmoney.js'
import * as sina from './lib/providers/sina.js'
import * as tencent from './lib/providers/tencent.js'
import { ROUTE_ALIAS, ROUTE_PATH, createRouter } from './lib/routes.js'
import { extendedWindow, freshnessByMarket, marketClock, marketState, parseQuoteDate, sessionFor } from './lib/session.js'
import { MARKET_GROUP } from './lib/config.js'
import { computePositions, holdingsFromPositions, normalizeTrade } from './lib/trades.js'
import { sampleTrend } from './lib/providers/index.js'
import { activeSymbols, createStore, emptyState, normalizeState, storePath } from './lib/store.js'
import {
  cnExchangeOf,
  displayCode,
  marketOf,
  normalizeSymbol,
  parseSymbols,
  secidCandidates,
} from './lib/symbols.js'
import { buildEventsToolDefinition, buildToolDefinition } from './lib/tool.js'

export const name = 'stock-ticker'

/**
 * `webServer` carries the strip's data routes and is the one hard dependency.
 * The tool registry is resolved at runtime instead: a profile without `tools`
 * must still show the strip, so it is looked up with `ctx.get` and only waited
 * for through `ctx.inject` when it is not up yet.
 */
export const inject = ['webServer']

export function apply(ctx, config) {
  const settings = normalizeSettings(config)
  const cache = {
    quotes: new Map(),
    klines: new Map(),
    trends: new Map(),
    extended: new Map(),
    health: {},
  }
  cache.disk = createDiskCache({ maps: { klines: cache.klines, trends: cache.trends } })
  const store = createStore({ seedSymbols: settings.symbols })
  const handle = createRouter({ ctx, settings, cache, store })

  ctx.effect(
    () => ctx.webServer.register({ kind: 'prefix', path: ROUTE_PATH, handler: handle }),
    'stock-ticker: routes',
  )
  // The bundle was published as `dsh-stock-dock` while the package id stayed
  // `@local/dsh-stock-ticker`; the old prefix must keep working for an installed
  // profile whose client bundle still polls it.
  ctx.effect(
    () => ctx.webServer.register({ kind: 'prefix', path: ROUTE_ALIAS, handler: handle }),
    'stock-ticker: alias routes',
  )

  if (settings.tool) {
    const definitions = [
      buildToolDefinition({
        getQuotes: (symbols) => buildQuotes(cache, symbols),
        defaultSymbols: () => (settings.toolSymbols.length > 0 ? settings.toolSymbols : settings.symbols),
      }),
      buildEventsToolDefinition(),
    ]
    registerTools(ctx, definitions)
  }

  // A store write is queued behind the previous one; flushing on dispose keeps a
  // hot reload from dropping the last click. The chart cache is flushed the same
  // way so a reload does not lose the most recent K-line.
  ctx.effect(() => () => void store.flush(), 'stock-ticker: store flush')
  ctx.effect(() => () => void cache.disk.flush(), 'stock-ticker: chart cache flush')

  return { store, cache }
}

/**
 * Register the model-facing tool against the tool registry. The service may not
 * be up yet when the bundle applies, so the lookup is `ctx.get` first and a
 * dynamic `ctx.inject` wait second; failing both only costs the tool, never the
 * strip.
 */
function registerTools(ctx, definitions) {
  // Cordis forbids reading a service property that was not injected, so the
  // eager lookup goes through `ctx.get` (the service store, always readable) and
  // the property access only happens inside the injected fiber below.
  const existing = typeof ctx.get === 'function' ? ctx.get('tools') : undefined
  if (existing && typeof existing.register === 'function') {
    for (const definition of definitions) {
      ctx.effect(() => existing.register(definition), `stock-ticker: ${definition.name} tool`)
    }
    return
  }
  if (typeof ctx.inject === 'function') {
    ctx.effect(() => {
      const seat = ctx.inject(['tools'], (owner) => {
        const service = (owner && owner.tools) ?? (owner && typeof owner.get === 'function' ? owner.get('tools') : undefined)
        if (!service || typeof service.register !== 'function') return
        for (const definition of definitions) {
          owner.effect(() => service.register(definition), `stock-ticker: ${definition.name} tool`)
        }
      })
      if (seat && typeof seat.dispose === 'function') return () => seat.dispose()
      if (typeof seat === 'function') return seat
      return undefined
    }, 'stock-ticker: tool registration')
    return
  }
  console.warn('[stock-ticker] tools service unavailable; stock tools not registered')
}

/* -------------------------------------------------------------------- tests */

/**
 * Pure helpers exposed for `scripts/verify.mjs` and the unit tests only. They
 * are not part of the plugin contract: nothing in the Host or the Client reads
 * them.
 */
export const __test = {
  marketState,
  marketClock,
  sessionFor,
  extendedWindow,
  parseQuoteDate,
  freshnessByMarket,
  normalizeSymbol,
  parseSymbols,
  cnExchangeOf,
  displayCode,
  marketOf,
  secidCandidates,
  rememberKline,
  KLINES_MAX_ENTRIES,
  evaluateAlerts,
  normalizeAlert,
  rearmAlert,
  normalizeState,
  activeSymbols,
  emptyState,
  storePath,
  normalizePrefs,
  publicSettings,
  DEFAULT_PREFS,
  parseTencentQuote: tencent.parseQuote,
  parseSinaQuote: sina.parseQuote,
  parseEastmoneyRow: eastmoney.parseRow,
  buildToolDefinition,
  buildEventsToolDefinition,
  sampleTrend,
  computePositions,
  holdingsFromPositions,
  normalizeTrade,
  MARKET_GROUP,
  routes: { ROUTE_PATH, ROUTE_ALIAS },
}
