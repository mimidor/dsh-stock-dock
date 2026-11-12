/**
 * Tiny HTTP helpers shared by the quote providers.
 *
 * Everything here is deliberately dependency-free: the bundle is linked into a
 * profile from outside it, so a bare `@deepseek-ai/...` or third-party specifier
 * would not resolve. Only Node built-ins and the global `fetch` are used.
 */

export const REQUEST_TIMEOUT_MS = 8000

export const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) ' +
  'Chrome/124.0.0.0 Safari/537.36'

/** Fetch a URL and throw on a non-2xx answer. */
export async function getResponse(url, { headers = {}, timeoutMs = REQUEST_TIMEOUT_MS } = {}) {
  const response = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT, ...headers },
    signal: AbortSignal.timeout(timeoutMs),
  })
  if (!response.ok) throw new Error(`${safeHost(url)} returned ${response.status}`)
  return response
}

export async function getText(url, options = {}) {
  const response = await getResponse(url, options)
  return response.text()
}

export async function getJson(url, options = {}) {
  const response = await getResponse(url, options)
  return response.json()
}

/**
 * Tencent and Sina quote endpoints answer GBK text. `TextDecoder('gbk')` is
 * available in every Node build the bundle supports (>=20).
 */
export async function getGbkText(url, options = {}) {
  const response = await getResponse(url, options)
  const bytes = new Uint8Array(await response.arrayBuffer())
  return new TextDecoder('gbk').decode(bytes)
}

export function safeHost(url) {
  try {
    return new URL(url).host
  } catch {
    return 'upstream'
  }
}

export function messageOf(error) {
  if (error instanceof Error) return error.message
  return String(error)
}
