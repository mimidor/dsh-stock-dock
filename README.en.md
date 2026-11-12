# dsh-stock-ticker

[中文](README.md) · **English**

![version](https://img.shields.io/badge/version-1.1.1-blue)
![license](https://img.shields.io/badge/license-MIT-green)
![dsh](https://img.shields.io/badge/DSH-0.2.x-6f5bd6)
![data](https://img.shields.io/badge/data-Tencent%20%7C%20Sina-orange)

A watchlist ticker strip pinned under the composer in DeepSeek Harness: A-share, Hong Kong and US symbols in one row, with name, code, price, change percent, limit-up/limit-down marker and a mini daily K-line. Clicking a card opens a detail panel with intraday, 5-minute, daily, weekly and monthly charts, the five-level order book and A-share price/volume metrics.

> Quotes come from public snapshot endpoints. Display only, **not investment advice**, not for trading decisions.

## Features

- **Ticker strip** — always under the composer, horizontally scrollable; red up / green down (switchable to the international palette); `limit up` / `limit down` badges on A-shares
- **Detail panel** — five tabs: `intraday / 5m / daily / weekly / monthly`; daily, weekly and monthly bars support forward-adjusted, backward-adjusted and raw prices
- **Intraday line** — price line, running average and a dashed previous close, coloured by the day's direction
- **Order book** — five bid and five ask levels (price + size) plus the bid/ask ratio
- **A-share metrics** — turnover value, turnover rate, volume ratio, amplitude, P/E, P/B, float and total market cap
- **Configurable symbols** — edit them in the strip's own form (saved to the profile config) or directly in `cordis.patch.yml`
- **Thrifty polling** — the cadence follows the trading session (normal while open, ≥30 s during a break, ≥60 s after the close), pauses while the tab is hidden or the form is open, and backs off up to two minutes while requests keep failing
- **Fallback source** — switches to Sina automatically when Tencent answers nothing; the header shows which source answered

## Install

This repository is itself an installable bundle (`package.json` and `cordis.patch.yml` sit at the root).

```text
plugin_manager  action: install_bundle  target: github:mimidor/dsh-stock-ticker
```

Or clone it and point at the directory:

```text
plugin_manager  action: install_bundle  target: /path/to/dsh-stock-ticker
```

Requires DSH 0.2.x with the Web GUI (the plugin registers same-origin routes through `ctx.webServer`). After installing, **reload the page**: the packaged desktop app has no ⌘R shortcut — quit and reopen it, or reload from "Developer tools".

## Usage

| Action | How |
| --- | --- |
| Read quotes | The strip appears under the composer: name / code / price / change / mini daily K-line per card |
| Open details | Click a card; click again or press "Close" to collapse |
| Switch chart | `intraday / 5m / daily / weekly / monthly` in the detail panel |
| Edit symbols | Sliders button in the header → one per line → save (writes the profile config and restarts the plugin) |
| Refresh now | ↻ in the header |
| Collapse | ⌃ in the header (state kept in localStorage) |

Symbol spellings are forgiving: `600519`, `sh600519`, `600519.SH`, `00700`, `hk00700`, `00700.HK`, `AAPL`, `usAAPL`, up to 30 symbols. A bare six-digit code is read by its first digit; a bare 1–5 digit number is read as Hong Kong.

## Configuration

`cordis.patch.yml` (the strip's form writes the same config):

```yaml
- id: stock-ticker
  name: "@local/dsh-stock-ticker"
  config:
    symbols: [sh000001, sz399001, sh600519, sh510300, hk00700, usAAPL]
    refreshSeconds: 15   # 5-300, used directly while a market is open
    klineDays: 40        # 10-120, bars behind the strip's mini chart
    colorMode: cn        # cn = red up / green down, intl = green up / red down
```

## Data and refresh

| Purpose | Endpoint | Cache |
| --- | --- | --- |
| Quotes, depth, metrics | `qt.gtimg.cn/q=...` (GBK) | 3 s |
| Quote fallback | `hq.sinajs.cn/list=...` (GBK, needs Referer) | 3 s |
| Daily / weekly / monthly bars, three adjustments | `proxy.finance.qq.com/.../newfqkline/get` | 5 min (retried after 60 s) |
| 5-minute bars | `proxy.finance.qq.com/.../kline/mkline` | 60 s |
| Intraday line | `proxy.finance.qq.com/.../minute/query` | 20 s (5 min after the close) |

Host routes (same origin, fetched by the Client half):

```text
GET  /dsh-stock-ticker/quotes?symbols=...&source=tencent|sina
GET  /dsh-stock-ticker/kline?symbol=...&period=day|week|month|m1|m5|m15|m30|m60&adjust=qfq|hfq|none&limit=40&refresh=1
GET  /dsh-stock-ticker/trend?symbol=...&refresh=1
GET  /dsh-stock-ticker/settings
POST /dsh-stock-ticker/config           # writable from the local page only (Origin / Host checked)
```

The Host derives the cadence from the Shanghai clock and the three venues: `refreshSeconds` while a market is open, at least 30 s during a break, at least 60 s after the close and at weekends. The Client backs off 2ⁿ up to 120 s while requests keep failing.

## Known limitations

- The data comes from **unofficial public Tencent / Sina endpoints**: they can rate-limit, change fields or disappear, carry no SLA, and are never fresher than their own snapshots.
- Turnover rate, volume ratio, amplitude and limit prices mean different things outside A-shares, so they are shown for A-shares only. Indices have no order book, and Tencent returns zeroes for Hong Kong depth, so those cards omit it.
- Intraday is unavailable for US symbols (the endpoint answers with a single point) and 5-minute bars exist for A-shares only.
- Display and configuration only: no orders, and no session or agent data is read.

## Development

```bash
node scripts/verify.mjs            # 42 checks: routes, fields, periods/adjustments, intraday, fallback, write guard, client load and registration
node scripts/verify.mjs --offline  # skip every check that needs the network
```

Host changes need a plugin restart (saving the config in the strip triggers one); Client changes need a page reload. There are no runtime dependencies: the Host imports nothing outside its own file and the browser half only requires `react`.

## License

[MIT](LICENSE)
