/**
 * Trade ledger: weighted-average cost and realised P/L.
 *
 * The rules are the ones a broker statement implies: a buy rolls its fee into
 * the average cost, a sell realises `(price - averageCost) * shares - fee`
 * against that average, and selling more than is held is rejected rather than
 * silently going short. Positions can then be rebuilt from the ledger, so the
 * hand-typed shares/cost in the holdings editor stay the source of truth only
 * until the user asks for a rebuild.
 */

export const MAX_TRADES = 500
export const TRADE_SIDES = ['buy', 'sell']

let sequence = 0

export function tradeId(now = Date.now()) {
  sequence = (sequence + 1) % 10_000
  return `t${now.toString(36)}${sequence.toString(36)}`
}

export function normalizeTrade(raw, now = Date.now()) {
  if (!raw || typeof raw !== 'object') return undefined
  const symbol = typeof raw.symbol === 'string' ? raw.symbol.trim() : ''
  const side = raw.side === 'sell' ? 'sell' : raw.side === 'buy' ? 'buy' : undefined
  const price = Number.parseFloat(raw.price)
  const shares = Number.parseFloat(raw.shares)
  const fee = Number.parseFloat(raw.fee ?? 0)
  if (symbol === '' || !side) return undefined
  if (!Number.isFinite(price) || price <= 0) return undefined
  if (!Number.isFinite(shares) || shares <= 0) return undefined
  if (!Number.isFinite(fee) || fee < 0) return undefined
  return {
    id: typeof raw.id === 'string' && raw.id !== '' ? raw.id : tradeId(now),
    symbol,
    side,
    price: round(price, 3),
    shares: round(shares, 3),
    fee: round(fee, 3),
    date: typeof raw.date === 'string' && raw.date !== '' ? raw.date.slice(0, 10) : isoDate(now),
    createdAt: Number.isFinite(raw.createdAt) ? raw.createdAt : now,
    note: typeof raw.note === 'string' ? raw.note.slice(0, 80) : '',
  }
}

function isoDate(now) {
  const date = new Date(now)
  const pad = (value) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/**
 * Rebuild per-symbol positions from the ledger.
 *
 * Returns `{ positions, warnings }`: positions carry the average cost, the
 * remaining shares and the realised P/L; warnings name the trades that sold more
 * than was held, which are still counted (the realised amount is computed on the
 * shares that existed) but flagged so the UI can show them instead of hiding
 * the inconsistency.
 */
export function computePositions(trades) {
  const ordered = (Array.isArray(trades) ? trades : [])
    .filter(Boolean)
    .slice()
    .sort((left, right) => {
      if (left.date !== right.date) return left.date < right.date ? -1 : 1
      return (left.createdAt ?? 0) - (right.createdAt ?? 0)
    })

  const positions = new Map()
  const warnings = []
  for (const trade of ordered) {
    const position = positions.get(trade.symbol) ?? {
      symbol: trade.symbol,
      shares: 0,
      cost: 0,
      realized: 0,
      fees: 0,
      buys: 0,
      sells: 0,
    }
    const amount = trade.price * trade.shares
    position.fees = round(position.fees + trade.fee, 2)

    if (trade.side === 'buy') {
      const totalCost = position.cost * position.shares + amount + trade.fee
      position.shares = round(position.shares + trade.shares, 3)
      position.cost = position.shares > 0 ? round(totalCost / position.shares, 4) : 0
      position.buys += 1
    } else {
      const sellable = Math.min(trade.shares, position.shares)
      if (trade.shares > position.shares + 1e-9) {
        warnings.push({
          id: trade.id,
          symbol: trade.symbol,
          message: `卖出 ${trade.shares} 股超过持仓 ${position.shares} 股`,
        })
      }
      const realised = (trade.price - position.cost) * sellable - trade.fee
      position.realized = round(position.realized + realised, 2)
      position.shares = round(position.shares - sellable, 3)
      if (position.shares <= 0) {
        position.shares = 0
        position.cost = 0
      }
      position.sells += 1
    }
    positions.set(trade.symbol, position)
  }
  return { positions, warnings }
}

/** The holdings map the rest of the plugin uses, rebuilt from the ledger. */
export function holdingsFromPositions(positions) {
  const holdings = {}
  for (const [symbol, position] of positions) {
    if (position.shares > 0 && position.cost > 0) {
      holdings[symbol] = { shares: position.shares, cost: position.cost }
    }
  }
  return holdings
}

export function summarizeTrades(trades, symbol) {
  const list = (Array.isArray(trades) ? trades : []).filter((trade) => !symbol || trade.symbol === symbol)
  const { positions, warnings } = computePositions(list)
  const position = positions.get(symbol) ?? (list[0] ? positions.get(list[0].symbol) : undefined)
  return {
    count: list.length,
    position: position ?? null,
    warnings,
  }
}

function round(value, digits) {
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}
