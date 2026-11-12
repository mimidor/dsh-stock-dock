/**
 * Price alerts: normalization, evaluation and the re-arm rules.
 *
 * An alert is one directional line on one symbol. It fires once, then stays
 * quiet until the user acknowledges it (the toast's confirm button), which is
 * what keeps a price parked at the line from re-firing on every poll.
 */

export const ALERT_OPS = ['above', 'below']
export const MAX_ALERTS = 200

let sequence = 0

export function alertId(now = Date.now()) {
  sequence = (sequence + 1) % 10_000
  return `a${now.toString(36)}${sequence.toString(36)}`
}

export function normalizeAlert(raw, now = Date.now()) {
  if (!raw || typeof raw !== 'object') return undefined
  const symbol = typeof raw.symbol === 'string' ? raw.symbol.trim() : ''
  const op = raw.op === 'below' ? 'below' : raw.op === 'above' ? 'above' : undefined
  const price = Number.parseFloat(raw.price)
  if (symbol === '' || !op || !Number.isFinite(price) || price <= 0) return undefined
  return {
    id: typeof raw.id === 'string' && raw.id !== '' ? raw.id : alertId(now),
    symbol,
    op,
    price: Math.round(price * 1000) / 1000,
    note: typeof raw.note === 'string' ? raw.note.slice(0, 80) : '',
    createdAt: Number.isFinite(raw.createdAt) ? raw.createdAt : now,
    firedAt: Number.isFinite(raw.firedAt) ? raw.firedAt : null,
    // Survives a store round-trip: the re-arm rule is meaningless if the flag is
    // dropped by normalization.
    muteUntilFlip: raw.muteUntilFlip === true,
  }
}

/**
 * Evaluate every armed alert against this poll's quotes. Returns the hits and
 * mutates the alerts' `firedAt` so a caller that persists afterwards keeps the
 * quiet state across a restart.
 */
export function evaluateAlerts(alerts, quotes, now = Date.now()) {
  const bySymbol = new Map()
  for (const quote of Array.isArray(quotes) ? quotes : []) {
    if (quote && !quote.error && typeof quote.price === 'number') bySymbol.set(quote.symbol, quote)
  }
  const fired = []
  for (const alert of Array.isArray(alerts) ? alerts : []) {
    if (alert.firedAt) continue
    const quote = bySymbol.get(alert.symbol)
    if (!quote) continue
    const hit = alert.op === 'above' ? quote.price >= alert.price : quote.price <= alert.price
    // Acknowledging an alert re-arms it, but a price parked at the line would
    // otherwise re-fire on the very next poll. Wait for the price to leave the
    // line once before the alert can fire again.
    if (alert.muteUntilFlip) {
      if (hit) continue
      alert.muteUntilFlip = false
      continue
    }
    if (!hit) continue
    alert.firedAt = now
    fired.push({
      id: alert.id,
      symbol: alert.symbol,
      name: quote.name ?? alert.symbol,
      op: alert.op,
      price: alert.price,
      current: quote.price,
      at: now,
      note: alert.note ?? '',
    })
  }
  return fired
}

export function rearmAlert(alerts, id, now = Date.now()) {
  const alert = (Array.isArray(alerts) ? alerts : []).find((entry) => entry.id === id)
  if (!alert) return false
  alert.firedAt = null
  alert.ackAt = now
  alert.muteUntilFlip = true
  return true
}
