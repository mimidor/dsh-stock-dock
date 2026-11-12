# Stock ticker

A compact quote strip under the composer for the DSH Web GUI. It shows a
configurable list of A-share, Hong Kong and US symbols with name, code, price,
change percent and a mini daily K-line; clicking a card opens a larger chart.

## Install

It is a DeepSeek Harness bundle; `package.json` and `cordis.patch.yml` sit at the repository
root, so the repository itself is the installable package.

```text
plugin_manager  action: install_bundle  target: github:mimidor/dsh-stock-ticker
```

Or from a clone, with the absolute directory as the target:

```text
plugin_manager  action: install_bundle  target: /path/to/dsh-stock-ticker
```

Then reload the page (the packaged Desktop app has no ⌘R shortcut: quit and reopen it, or open
Developer tools and reload there). The strip appears under the composer; its header shows the
data source, the session state and the build marker.

## Use it

The strip sits directly below the input box in every session. It refreshes while the page is
visible, pauses while the tab is hidden, and follows the cadence the Host recommends for the
current session: the configured interval during trading hours, at least 30 s during a break and
at least 60 s after the close. Consecutive failures stretch the interval up to 2 minutes.

- Click a card to open or close its detail panel: 分时 / 5m / daily / weekly / monthly charts,
  open/high/low/previous close, extra A-share fields (turnover value, turnover rate, volume ratio,
  amplitude, P/E, P/B, market cap) and the five-level order book with bid/ask ratio.
- The sliders button opens the symbol form; one symbol per line, or separated by
  spaces or commas.
- The chevron collapses the strip. The collapsed state is kept per browser.

## Symbols

Bare codes are accepted and normalized:

| You type | Stored |
| --- | --- |
| `600519`, `000001`, `510300` | `sh600519`, `sz000001`, `sh510300` |
| `00700` | `hk00700` |
| `AAPL` | `usAAPL` |
| `sh000001`, `sz399001`, `hk00700`, `usAAPL` | unchanged |

The form saves through the profile's config editor, which restarts the plugin so
the new list is live. The same values can be edited in `cordis.patch.yml`:

```yaml
- insert:
    - id: stock-ticker
      name: '@local/dsh-stock-ticker'
      config:
        symbols: [sh000001, sh600519, hk00700, usAAPL]
        refreshSeconds: 15
        klineDays: 40
        colorMode: cn
```

`refreshSeconds` is clamped to 5–300 and `klineDays` to 10–120. `colorMode`
is `cn` (red up, green down) or `intl` (green up, red down).

## Data

| What | Endpoint | Cache |
| --- | --- | --- |
| Quotes (A-share/HK/US, five-level book) | `qt.gtimg.cn/q=...` (GBK) | 3 s |
| Quote fallback when Tencent answers nothing | `hq.sinajs.cn/list=...` (GBK, needs Referer) | 3 s |
| Daily / weekly / monthly K-line, 前复权/后复权/不复权 | `proxy.finance.qq.com/.../newfqkline/get` | 5 min |
| 5-minute K-line | `proxy.finance.qq.com/.../kline/mkline` | 60 s |
| 分时 (intraday line, with average price) | `proxy.finance.qq.com/.../minute/query` | 20 s (5 min closed) |

Five-level depth and the extras (turnover, P/E, P/B, market caps, up/down limits, volume
ratio) are read only for A-shares: Tencent puts different values in those fields for Hong
Kong and US rows. Intraday lines are unavailable for US symbols and 5-minute bars are
A-share only, so those tabs are hidden for other markets.

The plugin displays public market data only; it places no orders and reads no session or
agent data.

Limitations: the upstream endpoints are unofficial and can rate-limit or change
without notice; a failed request leaves the last data on screen and marks it
stale. K-lines are daily bars only.
