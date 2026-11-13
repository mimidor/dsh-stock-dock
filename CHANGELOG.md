# Changelog

## 1.3.0 — 2026-11-12

P0–P3 of the "absorb the community plugins" review, plus the two consistency fixes.

### Host

- Split into modules: `lib/symbols.js`, `lib/session.js`, `lib/http.js`, `lib/cache.js`,
  `lib/providers/{tencent,sina,eastmoney,index}.js`, `lib/store.js`, `lib/alerts.js`,
  `lib/routes.js`, `lib/tool.js`, `lib/config.js`. `index.js` is now wiring only.
- **New tool** `stock_quote` (P2): batch quotes for one symbol or the watchlist, with a
  registry-shaped definition, output schema and text render.
- **Eastmoney** as the third quote source and the search provider (P2/P1). Its history
  endpoints are implemented as a fallback but gated behind a 5-minute cooldown because the
  host is frequently refused.
- **Multi-day intraday** 1/3/5 days from Tencent `day/query`, with the running average
  restarting per trading day (P1).
- **Price alerts** with a hit queue, per-poll evaluation, acknowledge-and-wait-for-flip
  re-arm rule (P1).
- **Holdings** with shares/cost, attached to every quote for the cost line and P/L (P1/P2).
- **Watchlist groups** stored host-side; the default group still seeds from profile config
  and keeps writing it back when the profile allows (P2).
- **Holiday detection** from quote timestamps per market timezone (P3).
- **Preferences** written at runtime and merged over the profile config (P1 settings page).
- Store: atomic writes, corrupt-file quarantine, normalization on load, 200-alert cap.
- Routes gained `/search`, `/prefs`, `/alerts`, `/holdings`, `/groups`, `/health`; every
  upstream failure is now `200 { ok:false }` instead of 502/500 (consistency fix).
- Quote answers carry `source` per row, `kline`, `alerts` and `holding`; sessions carry
  `holiday`; `/quotes` carries the fired alert queue.
- Route prefix alias `/dsh-stock-dock` (the repo name) alongside `/dsh-stock-ticker`.
- K-line cache cap 120 → 400 so 30 symbols × 8 periods survives a full walk (P0).

### Client

- Minute periods 15/30/60 exposed (the host supported them all along) (P0).
- Adjust selector for forward/backward/raw (host supported, UI hardcoded qfq before) (P0).
- Per-card source dot (P0); fired-alert toast with acknowledge.
- Search box in the config form, debounced, feeding off the merged search route (P1).
- MA5/10/20/60 overlays, volume sub-chart and hover readout on K-lines (P1).
- Intraday 1/3/5-day selector, day separators, cost line (P1/P2).
- Alerts panel, position editor, group pills (P1/P2).
- Plugin settings card registered on `settings.plugin.item` (P1).
- Optional `dsh-better-sidebar` tab through `ctx.inject` (soft dependency) (P2).
- Fixed a dead guard in the poll loop: the in-flight request flag was written onto the
  boolean instead of the ref object, so it never worked.

### Tests

- `scripts/verify.mjs`: 68 → 152 checks (115 offline), covering the new routes, alerts,
  holdings, groups, preferences, holiday detection, parsers, the tool and both client
  surfaces.
- `npm test`: 34 tests — endpoint-payload fixtures for the three providers, store
  durability, alert rules, session/holiday logic, tool shape, and render-level tests that
  mount the real client components in a miniature React.

### Consistency

- Version reported by the client (`BUILD`) is checked against `package.json`.
- One name: the package id stays `@local/dsh-stock-ticker` (installed profiles link it),
  the repo/branding and the alias route are `dsh-stock-dock`; both READMEs say so.

## 1.2.0

- Configurable symbols saved through the profile config editor, mini daily K-line per card,
  detail panel with intraday / 5m / daily / weekly / monthly, order book, A-share fields,
  session-aware polling and a Sina fallback.

## 1.1.0

- First DSH bundle release: a fixed ticker strip for a handful of indices.

## 1.4.0 — 2026-11-12

Second review round: transport cost, client robustness, and the features the
probed data sources actually allow.

### Host

- `/quotes` no longer carries K-lines (they were ~83% of a 129 KB payload, re-sent
  every 15 s). `/sparklines` serves them once, keyed by symbol set, with an ETag
  and a 304 path; `/quotes?sparklines=1` keeps the old shape for one release.
- Multi-day intraday is thinned to at most 900 points and drops the unused
  turnover column; a five-day A-share line went from 135 KB to ~55 KB.
- Hong Kong 3/5-day intraday unlocked (Tencent `day/query` serves it; only the US
  is rejected now).
- Trade ledger: weighted-average cost with fees, realised P/L, oversell warnings,
  and `POST /trades` `apply` rebuilding holdings from the ledger (`lib/trades.js`).
- `stock_events` tool: announcements and the daily billboard via the two Eastmoney
  hosts that answer without a key (`lib/events.js`).
- Market-overview group (`大盘`) seeded once for new stores and addable from the
  settings page; index symbols (`hkHSI`, `usIXIC`, `usDJI`, `usINX`) are accepted.
- New routes: `/sparklines`, `GET|POST /trades`; `/groups` gained `addMarket`.

### Client

- Mini charts fetched separately with `If-None-Match`.
- Stylesheet injected once (`data-plugin-css`) instead of one `<style>` per mounted
  component.
- 401/403 map to "the quote service is not loaded; reload or restart DSH" instead
  of an HTTP code.
- Sidebar tab pauses polling when `visible === false`.
- Strip: wheel-to-horizontal, pointer drag, hover progress bar, trailing `＋`.
- Cards: hover `×` removal, HTML5 drag reordering, keyboard activation.
- Intraday: volume bars and a percentage axis; K-lines get price axis labels and
  date/time labels aligned to the actual scale.
- Detail: trade ledger panel (record/sell/delete/rebuild), realised P/L in the
  header; the volume toggle now works on the intraday tab too.
- Settings: "add market group" button, preset badge.

### Tooling

- `oxlint` (zero-config) with a clean run; `npm run test:coverage`; `pack:check`
  asserting the published file list; `check:readme` comparing the zh/en outlines
  and route tables; `scripts/preview.mjs` renders the real components to HTML and
  captures the README screenshots with headless Chrome.
- 53 tests (was 34) including ledger arithmetic, event parsers over captured
  payloads, and intraday thinning.

### Documentation

- Both READMEs rewritten for 1.4.0 with screenshots, the new routes, the trade
  ledger and the event tools; the section outlines are kept identical.

## 1.5.0 — 2026-11-12

Settings discoverability and the options the strip was missing.

### Client

- A gear in the strip header opens the settings panel **inside the dock**, so the
  options are always one click away.
- The same panel is registered as a **first-class settings section** (left nav of
  the settings dialog, next to 通用设置/模型), instead of a tab under 内置插件:
  `settings.section` with id `stock-ticker`, order 40. The client declares
  `@deepseek-ai/dsh-client-ui-settings-general`, which owns that slot.
- New settings: data source (auto / Tencent / Sina / Eastmoney), show mini K-line,
  show order book, show metrics row, show US pre/post market.
- The strip passes the chosen source to `/quotes`; the request is forced on the
  host (`?source=`), falling back to the automatic chain.
- US pre/post market: cards and the detail header show the extended-hours price,
  percent and timestamp when the preference is on.
- Toggles carry `aria-label`s, so the settings panel is operable by name.
- The strip now claims its own full-width line under the composer: DSH's own
  stats pills (轮次/步数/tok/s, 缓存命中) and the context meter share the
  `conversation.composer.dock` flex row, so the strip is re-ordered after them and
  its parent is made to wrap via a structural `:has()` rule. Where `:has()` is
  unavailable the rule is ignored and the layout degrades to the previous inline
  row instead of breaking.
- Wheel-to-horizontal now listens on the window in the capture phase and is
  scoped by pointer containment. The previous element-bound listener was lost
  whenever the strip remounted (opening/closing the settings or symbol form), and
  could be intercepted by the composer before it reached the strip.

### Host

- `prefs` gained `source`, `showMiniChart`, `showOrderBook`, `showStats` and
  `showExtended`; the quote route honours the stored source.
- `lib/providers/sina.js#parseExtended` reads columns 21–24 of a `gb_` row and
  labels the window pre (before 09:30) or post (from 16:00); `attachExtended`
  batches and caches the lookup for a minute.
- `/health` reports the extended-hours cache.

### Tests and docs

- 58 tests and 177 self-checks; the new coverage includes pre-market parsing, the
  settings panel, the source switch and the extended-hours chip.
- READMEs document the in-strip settings panel and the pre-market data source.

## 1.5.1 — 2026-11-13

- The strip now claims its own full-width row at runtime: a CSS-only `:has()`
  rule did not match the real dock in every DSH build (the slot renderer may wrap
  entries in its own element), so the client walks up from the strip to the
  nearest row-flex ancestor, lets it wrap, and promotes the flex item that owns
  the strip to `order: 99; flex: 0 0 100%`. The previous inline styles are
  restored when the strip unmounts, and the `_dock` class lookup is kept as a
  last resort. Set `localStorage['dsh-stock-ticker:debug'] = '1'` to log the
  claimed container.
- Header build chip bumped so a refresh can be verified at a glance.
- The GitHub Actions workflow was removed at the maintainer's request. The same
  checks still run locally: `npm run lint`, `npm test`, `npm run verify:offline`,
  `npm run pack:check`, `npm run check:readme`.

## 1.5.2 — 2026-11-13

- Fixed the dock row claim against DSH's real slot layout: the slot outlet inserts
  a `display: contents` `[data-slot]` element between the dock and the entry, so
  the 1.5.1 walk styled the inner scroll strip instead of the flex item. The
  claim now starts from the component root and, when it meets the contents
  wrapper, descends to that wrapper's first element child (our root). The claim
  is also scoped to the dock variant, so the sidebar tab is untouched.
- Failed claims log the ancestor chain when
  `localStorage['dsh-stock-ticker:debug'] = '1'`.
