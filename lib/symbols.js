/**
 * Symbol normalization and the per-provider spellings of the same instrument.
 *
 * The plugin's canonical form is the Tencent one — `sh600519`, `sz000001`,
 * `bj430047`, `hk00700`, `usAAPL` — because that is what both the quote and the
 * K-line endpoints accept. Everything else (Eastmoney `1.600519`, Sina
 * `rt_hk00700` / `gb_aapl`, the suffixes exports carry) is derived from it.
 */

export const MAX_SYMBOLS = 30

/** Eastmoney market ids for the three US exchanges; a ticker can live in any. */
export const US_SECIDS = [105, 106, 107]
/** US indices live under Eastmoney market 100, unlike the three stock exchanges. */
export const US_INDEX_SECIDS = { IXIC: '100.IXIC', NDX: '100.NDX', DJI: '100.DJIA', DJIA: '100.DJIA', SPX: '100.SPX', GSPC: '100.SPX' }

export function marketOf(symbol) {
  if (/^hk/i.test(symbol)) return 'hk'
  if (/^us/i.test(symbol)) return 'us'
  return 'cn'
}

/**
 * An index aggregates its constituents, so its minute `volume` is not a lot
 * count and `amount / volume` is not a price level. The intraday average has to
 * be built from the quoted index values instead.
 *
 * Shanghai indices are `sh000xxx`, Shenzhen indices `sz399xxx`; a lettered Hong
 * Kong code (`hkHSI`, `hkHSCEI`, `hkHSTECH`) is an index while numeric codes
 * are stocks.
 */
export function isIndexSymbol(symbol) {
  const market = marketOf(symbol)
  const body = symbol.slice(2)
  if (market === 'us') return Boolean(US_INDEX_SECIDS[body.toUpperCase()])
  if (market === 'hk') return !/^\d+$/.test(body)
  return /^sh000\d{3}$/.test(symbol) || /^sz399\d{3}$/.test(symbol)
}

/**
 * Accepts the forms a person types: `sh600519`, `600519`, `hk00700`, `00700`,
 * `usAAPL`, `AAPL`, and the exchange suffixes exports carry (`600519.SH`,
 * `00700.HK`, `AAPL.US`). A bare six-digit code is guessed by its exchange
 * prefix, a bare 1–5 digit code is treated as Hong Kong, and any other letters
 * as a US ticker.
 */
export function normalizeSymbol(raw) {
  if (typeof raw !== 'string') return undefined
  const text = raw.trim().replace(/[%^$\s]/g, '')
  if (text === '') return undefined

  const suffixed = /^([a-z0-9]+)\.(sh|ss|sz|bj|hk|us|o|n)$/i.exec(text)
  if (suffixed) {
    const suffix = suffixed[2].toLowerCase()
    const market = suffix === 'ss' ? 'sh' : suffix === 'o' || suffix === 'n' ? 'us' : suffix
    return validSymbol(withMarket(market, suffixed[1]))
  }

  const prefixed = /^(sh|sz|bj|hk|us)(.+)$/i.exec(text)
  if (prefixed) return validSymbol(withMarket(prefixed[1].toLowerCase(), prefixed[2]))
  if (/^\d{6}$/.test(text)) return validSymbol(`${cnExchangeOf(text)}${text}`)
  if (/^\d{1,5}$/.test(text)) return validSymbol(`hk${text.replace(/^0+/, '').padStart(5, '0')}`)
  if (/^[A-Z][A-Z0-9.-]*$/i.test(text)) return validSymbol(`us${text.toUpperCase()}`)
  return undefined
}

/**
 * Where a bare A-share code lives. `430047`/`830799` are Beijing (Tencent
 * answers `v_bj430047` and nothing for `sz430047`), `110038` is a Shanghai
 * convertible, everything else splits on the familiar 6/5/9 vs 0/3 rule.
 */
export function cnExchangeOf(code) {
  const head = code[0]
  if (head === '6' || head === '5' || head === '9') return 'sh'
  if (head === '4' || head === '8') return 'bj'
  if (/^11[0-9]/.test(code)) return 'sh'
  return 'sz'
}

export function withMarket(market, body) {
  if (market === 'us') return `us${body.toUpperCase()}`
  if (market === 'hk') {
    // Hong Kong has two spellings in Tencent's data: five-digit stocks
    // (`hk00700`) and lettered indices (`hkHSI`). Digits pad, letters upper-case.
    return /^\d+$/.test(body)
      ? `hk${body.replace(/^0+/, '').padStart(5, '0')}`
      : `hk${body.toUpperCase()}`
  }
  return `${market}${body.toLowerCase()}`
}

const SYMBOL_PATTERNS = {
  cn: /^(sh|sz|bj)\d{6}$/,
  hk: /^hk(\d{5}|[A-Z]{2,6})$/,
  us: /^us[A-Z0-9.^-]{1,12}$/,
}

/** The prefix branch must not be a hole that lets `sh600519.foo` through. */
export function validSymbol(symbol) {
  return SYMBOL_PATTERNS[marketOf(symbol)].test(symbol) ? symbol : undefined
}

/**
 * Splits a typed list into what will be watched and what was dropped: the
 * unrecognized entries (reported back so the UI can name them) and everything
 * else not kept (duplicates, the 30-symbol ceiling).
 */
export function parseSymbols(list) {
  const seen = new Set()
  const symbols = []
  const rejected = []
  for (const item of list) {
    if (typeof item !== 'string') {
      rejected.push(String(item))
      continue
    }
    const symbol = normalizeSymbol(item)
    if (!symbol) {
      const text = item.trim()
      if (text !== '') rejected.push(text)
      continue
    }
    if (seen.has(symbol)) continue
    seen.add(symbol)
    symbols.push(symbol)
  }
  const kept = symbols.slice(0, MAX_SYMBOLS)
  return { symbols: kept, rejected, dropped: list.length - kept.length }
}

export function normalizeSymbols(list) {
  return parseSymbols(list).symbols
}

/** `sh600519` -> `600519`, the short form the strip has room for. */
export function displayCode(symbol) {
  if (/^us/i.test(symbol)) return symbol.slice(2)
  return symbol.slice(2)
}

/**
 * Eastmoney secids worth trying for a symbol, best first. A US ticker has no
 * single market id, so all three exchanges are returned and the caller keeps
 * whichever the batch answer contains.
 */
/** Eastmoney uses market 100 for the Hang Seng Index, 116 for Hong Kong stocks. */
const HK_INDEX_SECIDS = { HSI: '100.HSI', HSCEI: '100.HSCEI', HSTECH: '100.HSTECH' }

export function secidCandidates(symbol) {
  const market = marketOf(symbol)
  const body = symbol.slice(2)
  if (market === 'hk') return HK_INDEX_SECIDS[body] ? [HK_INDEX_SECIDS[body]] : [`116.${body}`]
  if (market === 'us') {
    const index = US_INDEX_SECIDS[body.toUpperCase()]
    return index ? [index] : US_SECIDS.map((id) => `${id}.${body}`)
  }
  if (/^sh/i.test(symbol)) return [`1.${body}`]
  // Shenzhen and Beijing both live under market 0 at Eastmoney.
  return [`0.${body}`]
}

/** The canonical secid used when building a request; US adds all candidates. */
export function secidsOf(symbol) {
  return secidCandidates(symbol)
}

/**
 * A search hit comes back as `{mktNum, code}`; turn it into a canonical symbol
 * or `undefined` for the venue families this plugin does not quote (sectors,
 * CSI index codes, warrants).
 */
export function symbolFromSecid(mktNum, code) {
  const market = Number.parseInt(String(mktNum), 10)
  const text = String(code ?? '').trim()
  if (!/^[A-Za-z0-9]+$/.test(text)) return undefined
  if (market === 1) return validSymbol(`sh${text.toLowerCase()}`)
  if (market === 0) return validSymbol(`${cnExchangeOf(text)}${text.toLowerCase()}`)
  if (market === 116) return validSymbol(`hk${text.replace(/^0+/, '').padStart(5, '0')}`)
  if (US_SECIDS.includes(market)) return validSymbol(`us${text.toUpperCase()}`)
  if (market === 100) {
    const index = Object.entries(US_INDEX_SECIDS).find(([, secid]) => secid === `100.${text.toUpperCase()}`)
    if (index) return validSymbol(`us${index[0]}`)
  }
  return undefined
}

/**
 * Tencent wants a venue suffix on US K-line requests (`usAAPL.OQ`); everything
 * else goes through as-is. The order is a heuristic until a quote answer tells
 * us the venue, which the provider caches on the first success.
 */
export function klineSymbolCandidates(symbol) {
  if (!/^us/i.test(symbol)) return [symbol]
  const code = symbol.slice(2)
  if (code.includes('.')) return [`us${code}`]
  return [`us${code}.OQ`, `us${code}.N`, `us${code}`]
}

/** Sina spells US tickers `gb_aapl` and Hong Kong `rt_hk00700`. */
export function sinaKeyOf(symbol) {
  const market = marketOf(symbol)
  if (market === 'us') return `gb_${symbol.slice(2).toLowerCase()}`
  if (market === 'hk') return `rt_${symbol}`
  return symbol
}
