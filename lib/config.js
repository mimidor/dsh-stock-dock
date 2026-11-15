/**
 * Config → runtime settings.
 *
 * The profile config (`cordis.patch.yml` or the save button) is the seeded
 * default; the store's `prefs` are what the settings page writes at runtime.
 * Keeping both means an existing installation keeps its symbol list, while a
 * toggle in the UI never needs a plugin restart.
 */

import { normalizeSymbols } from './symbols.js'

export const DEFAULT_SYMBOLS = ['sh000001', 'sz399001', 'sh600519', 'sh510300', 'hk00700', 'usAAPL']

/**
 * The "market overview" group a fresh install gets in addition to the default
 * watchlist: the three A-share boards, the STAR 50, the Hang Seng and the
 * Nasdaq. All six answer on Tencent's batch endpoint, so the group costs one
 * request. Existing stores keep their groups; the settings page can add this one.
 */
export const MARKET_GROUP = {
  id: 'market',
  name: '大盘',
  preset: true,
  symbols: ['sh000001', 'sz399001', 'sz399006', 'sh000688', 'hkHSI', 'usIXIC'],
}

export const MINI_CHART_TYPES = ['intraday', 'day', 'week', 'month']
export const DEFAULT_MA_PERIODS = [5, 10, 20, 60]

export const DEFAULT_PREFS = {
  showMA: true,
  maPeriods: DEFAULT_MA_PERIODS,
  showVolume: true,
  defaultPeriod: 'trend',
  defaultTrendDays: 1,
  adjust: 'qfq',
  alertToast: true,
  volumeAlert: true,
  volumeAlertPct: 100,
  sourceDot: true,
  showMiniChart: true,
  showLogos: true,
  miniChartType: 'day',
  showOrderBook: true,
  showStats: true,
  source: 'auto',
  showExtended: false,
  sidebarMode: false,
  sidebarSymbols: [],
}

export const QUOTE_SOURCES = ['auto', 'tencent', 'sina', 'eastmoney']

export const PERIODS = ['trend', 'm5', 'm15', 'm30', 'm60', 'day', 'week', 'month']
export const ADJUSTS = ['qfq', 'hfq', 'none']

export function clamp(value, min, max, fallback) {
  const number = typeof value === 'number' ? value : Number.parseFloat(value)
  if (!Number.isFinite(number)) return fallback
  return Math.min(max, Math.max(min, number))
}

export function normalizeSettings(config) {
  const raw = config ?? {}
  const symbols = normalizeSymbols(Array.isArray(raw.symbols) ? raw.symbols : [])
  const toolSymbols = normalizeSymbols(Array.isArray(raw.toolSymbols) ? raw.toolSymbols : [])
  return {
    symbols: symbols.length > 0 ? symbols : DEFAULT_SYMBOLS,
    refreshSeconds: clamp(raw.refreshSeconds, 5, 300, 15),
    klineDays: Math.round(clamp(raw.klineDays, 10, 120, 40)),
    colorMode: raw.colorMode === 'intl' ? 'intl' : 'cn',
    tool: raw.tool !== false,
    toolSymbols,
  }
}

/**
 * The runtime preferences. The three fields that mirror the profile config are
 * only present when the settings page has actually overridden them, so a config
 * edit still wins until the user picks something different at runtime.
 */
export function normalizeMaPeriods(raw) {
  const values = (Array.isArray(raw) ? raw : String(raw ?? '').split(/[,\s，]+/))
    .map((value) => Math.round(Number.parseFloat(value)))
    .filter((value) => Number.isFinite(value) && value >= 1 && value <= 250)
  const unique = [...new Set(values)].slice(0, 6)
  return unique.length > 0 ? unique : [...DEFAULT_MA_PERIODS]
}

export function normalizePrefs(raw) {
  const source = raw && typeof raw === 'object' ? raw : {}
  const prefs = {
    showMA: source.showMA !== false,
    maPeriods: normalizeMaPeriods(source.maPeriods),
    showVolume: source.showVolume !== false,
    defaultPeriod: PERIODS.includes(source.defaultPeriod) ? source.defaultPeriod : DEFAULT_PREFS.defaultPeriod,
    defaultTrendDays: Math.round(clamp(source.defaultTrendDays, 1, 5, 1)),
    adjust: ADJUSTS.includes(source.adjust) ? source.adjust : DEFAULT_PREFS.adjust,
    alertToast: source.alertToast !== false,
    volumeAlert: source.volumeAlert !== false,
    volumeAlertPct: Math.round(clamp(source.volumeAlertPct, 10, 500, 100)),
    sourceDot: source.sourceDot !== false,
  }
  if (Number.isFinite(Number.parseFloat(source.refreshSeconds))) {
    prefs.refreshSeconds = Math.round(clamp(source.refreshSeconds, 5, 300, 15))
  }
  if (Number.isFinite(Number.parseFloat(source.klineDays))) {
    prefs.klineDays = Math.round(clamp(source.klineDays, 10, 120, 40))
  }
  if (source.colorMode === 'cn' || source.colorMode === 'intl') prefs.colorMode = source.colorMode
  prefs.showMiniChart = source.showMiniChart !== false
  prefs.showLogos = source.showLogos !== false
  prefs.miniChartType = MINI_CHART_TYPES.includes(source.miniChartType) ? source.miniChartType : DEFAULT_PREFS.miniChartType
  prefs.showOrderBook = source.showOrderBook !== false
  prefs.showStats = source.showStats !== false
  prefs.showExtended = source.showExtended === true
  prefs.sidebarMode = source.sidebarMode === true
  prefs.sidebarSymbols = normalizeSymbols(Array.isArray(source.sidebarSymbols) ? source.sidebarSymbols : []).slice(0, 8)
  prefs.source = QUOTE_SOURCES.includes(source.source) ? source.source : 'auto'
  return prefs
}

/** What the client is allowed to see and what the poll cadence should follow. */
export function publicSettings(settings, prefs) {
  const runtime = normalizePrefs(prefs)
  return {
    refreshSeconds: runtime.refreshSeconds ?? settings.refreshSeconds,
    klineDays: runtime.klineDays ?? settings.klineDays,
    colorMode: runtime.colorMode ?? settings.colorMode,
    showMA: runtime.showMA,
    maPeriods: runtime.maPeriods,
    showVolume: runtime.showVolume,
    defaultPeriod: runtime.defaultPeriod,
    defaultTrendDays: runtime.defaultTrendDays,
    adjust: runtime.adjust,
    alertToast: runtime.alertToast,
    volumeAlert: runtime.volumeAlert,
    volumeAlertPct: runtime.volumeAlertPct,
    sourceDot: runtime.sourceDot,
    showMiniChart: runtime.showMiniChart,
    showLogos: runtime.showLogos,
    miniChartType: runtime.miniChartType,
    showOrderBook: runtime.showOrderBook,
    showStats: runtime.showStats,
    showExtended: runtime.showExtended,
    sidebarMode: runtime.sidebarMode,
    sidebarSymbols: runtime.sidebarSymbols,
    source: runtime.source,
  }
}
