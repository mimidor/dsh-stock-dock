/**
 * Host-side store: watchlist groups, holdings, alerts and UI preferences.
 *
 * Browser storage would lose the list on a cache clear, so the state lives in a
 * JSON file next to the DSH home (`$DSH_HOME/dsh-stock-dock/store.json`, or
 * `$DSH_STOCK_DOCK_STORE` when set). Writes go through a temp file and a rename,
 * so a crash mid-write cannot truncate the original; a file that no longer
 * parses is renamed to `.broken-<timestamp>` and kept instead of being silently
 * replaced with an empty one.
 */

import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { MAX_ALERTS, normalizeAlert } from './alerts.js'
import { DEFAULT_PREFS, MARKET_GROUP, normalizePrefs } from './config.js'
import { MAX_SYMBOLS, normalizeSymbols } from './symbols.js'
import { MAX_TRADES, normalizeTrade } from './trades.js'

export const STORE_VERSION = 1
export const MAX_GROUPS = 12
export const MAX_HOLDINGS = 60

export function storePath() {
  const override = process.env.DSH_STOCK_DOCK_STORE
  if (override && override.trim() !== '') return override
  const home = process.env.DSH_HOME || join(homedir(), '.dsh')
  return join(home, 'dsh-stock-dock', 'store.json')
}

export function emptyState() {
  return {
    version: STORE_VERSION,
    groups: [],
    activeGroup: 'default',
    alerts: [],
    holdings: {},
    trades: [],
    prefs: { ...DEFAULT_PREFS },
    presetSeeded: false,
  }
}

export function normalizeState(raw, seedSymbols = []) {
  const state = raw && typeof raw === 'object' ? raw : {}
  const groups = []
  const seenGroups = new Set()
  for (const group of Array.isArray(state.groups) ? state.groups : []) {
    if (!group || typeof group !== 'object') continue
    const id = typeof group.id === 'string' && group.id !== '' ? group.id : undefined
    if (!id || seenGroups.has(id)) continue
    seenGroups.add(id)
    groups.push({
      id,
      name: typeof group.name === 'string' && group.name !== '' ? group.name.slice(0, 20) : '自选',
      symbols: normalizeSymbols(Array.isArray(group.symbols) ? group.symbols : []),
    })
    if (groups.length >= MAX_GROUPS) break
  }
  if (groups.length === 0) {
    groups.push({ id: 'default', name: '自选', symbols: normalizeSymbols(seedSymbols).slice(0, MAX_SYMBOLS) })
  }
  if (!groups.some((group) => group.id === 'default')) groups.unshift({ id: 'default', name: '自选', symbols: [] })

  // The market-overview group is seeded once. The flag (rather than "does the
  // group exist") is what keeps a user who deleted it from getting it back on
  // every store write.
  const presetSeeded = state.presetSeeded === true
  if (!presetSeeded && !groups.some((group) => group.id === MARKET_GROUP.id)) {
    groups.push({
      id: MARKET_GROUP.id,
      name: MARKET_GROUP.name,
      preset: true,
      symbols: normalizeSymbols(MARKET_GROUP.symbols),
    })
  }

  const holdings = {}
  for (const [symbol, value] of Object.entries(state.holdings ?? {})) {
    if (!value || typeof value !== 'object') continue
    const shares = Number.parseFloat(value.shares)
    const cost = Number.parseFloat(value.cost)
    if (!Number.isFinite(shares) || shares <= 0) continue
    if (!Number.isFinite(cost) || cost <= 0) continue
    holdings[symbol] = { shares: Math.round(shares * 1000) / 1000, cost: Math.round(cost * 1000) / 1000 }
    if (Object.keys(holdings).length >= MAX_HOLDINGS) break
  }

  const alerts = (Array.isArray(state.alerts) ? state.alerts : [])
    .map((alert) => normalizeAlert(alert))
    .filter(Boolean)
    .slice(0, MAX_ALERTS)

  const trades = (Array.isArray(state.trades) ? state.trades : [])
    .map((trade) => normalizeTrade(trade))
    .filter(Boolean)
    .slice(-MAX_TRADES)

  const activeGroup = groups.some((group) => group.id === state.activeGroup) ? state.activeGroup : groups[0].id

  return {
    version: STORE_VERSION,
    groups,
    activeGroup,
    alerts,
    holdings,
    trades,
    prefs: normalizePrefs(state.prefs),
    presetSeeded: true,
  }
}

export function activeSymbols(state) {
  const group = state.groups.find((entry) => entry.id === state.activeGroup) ?? state.groups[0]
  return group?.symbols ?? []
}

/**
 * A tiny write-behind store. `update()` is synchronous for the caller and
 * serializes the disk write behind any in-flight one, so two POSTs landing
 * together cannot interleave their temp files.
 */
export function createStore({ seedSymbols = [], filePath = storePath(), logger = console } = {}) {
  let state = null
  let loading = null
  let writing = Promise.resolve()
  let updating = Promise.resolve()
  const fired = []

  async function load() {
    if (state) return state
    if (loading) return loading
    loading = (async () => {
      try {
        const text = await readFile(filePath, 'utf8')
        state = normalizeState(JSON.parse(text), seedSymbols)
      } catch (error) {
        if (error && error.code !== 'ENOENT') {
          logger.error?.(`[stock-ticker] store unreadable, starting fresh: ${error.message}`)
          await rename(filePath, `${filePath}.broken-${Date.now()}`).catch(() => {})
        }
        state = normalizeState(emptyState(), seedSymbols)
      }
      return state
    })()
    return loading
  }

  function persist(value = state) {
    if (!value) return Promise.resolve()
    const payload = `${JSON.stringify(value, null, 2)}\n`
    const target = filePath
    const attempt = writing.then(async () => {
      await mkdir(dirname(target), { recursive: true })
      const temp = `${target}.tmp-${process.pid}-${Math.random().toString(36).slice(2)}`
      await writeFile(temp, payload, 'utf8')
      await rename(temp, target)
    })
    // Keep the queue usable after a failed write, but report this one to the
    // caller so a route does not answer "saved" with nothing on disk.
    writing = attempt.catch(() => {})
    return attempt.catch((error) => {
      logger.error?.(`[stock-ticker] store write failed: ${error.message}`)
      throw error
    })
  }

  return {
    path: filePath,
    async ready() {
      return load()
    },
    async snapshot() {
      return load()
    },
    /** Mutate and persist; the mutator may return a replacement state. */
    async update(mutator) {
      // Serialize updates so concurrent writes each see the previous result,
      // but never expose the new state until its disk write has succeeded.
      const run = updating.then(async () => {
        const current = await load()
        const draft = structuredClone(current)
        const next = mutator(draft) ?? draft
        const candidate = normalizeState(next, seedSymbols)
        await persist(candidate)
        state = candidate
        return state
      })
      updating = run.catch(() => {})
      return run
    },
    /** Alert hits waiting for the next poll; the strip is the only consumer. */
    drainFired() {
      return fired.splice(0, fired.length)
    },
    pushFired(entries) {
      if (!Array.isArray(entries) || entries.length === 0) return
      fired.push(...entries)
      if (fired.length > 40) fired.splice(0, fired.length - 40)
    },
    async flush() {
      await updating.catch(() => {})
      await writing
    },
  }
}
