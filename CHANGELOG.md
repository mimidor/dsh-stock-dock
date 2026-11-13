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

## 1.5.3 — 2026-11-13

- The dock row claim now targets our own root, not a sibling: a list slot shares
  ONE `display: contents` `[data-slot]` outlet between every entry, and DSH's
  stats pills register before the strip, so the 1.5.2 `firstElementChild`
  descent styled the "18 轮 331 步" pill (moving it to its own row) while the
  strip stayed inline. The claim walks our ancestor path instead, skips every
  `display: contents` layer, and promotes the outermost real box to
  `order: 99; flex: 0 0 100%`; `flex-wrap: wrap` is written with priority and
  the resolved values are checked one frame later when debug logging is on.
- US index K-lines no longer come back as a single bar: Tencent answers only
  the latest bar for a venue-suffixed index (`usIXIC.OQ`, `usNDX.OQ`) but the
  full page for the bare symbol (`usIXIC`). The provider used to accept the
  first non-empty answer and cache that spelling, so the Nasdaq mini chart and
  detail panel stayed empty until restart. It now probes the candidates, keeps
  the longest page, and caches the winning spelling (stocks still answer on the
  first candidate, so their request count is unchanged).
- Tests: the render harness reproduces the shared outlet with a co-located
  native pill and can nest multiple contents wrappers, asserting the pill keeps
  its order/flex; a parser test covers the one-row suffix and the cached
  winner. 67 tests total.

## 1.5.4 — 2026-11-13

- Intraday averages for indices are now on the index scale. Tencent's minute
  `amount / volume` is a turnover-weighted share price, which is meaningless for
  an index: `sz399006` produced averages around 25.8 while the index traded near
  2500. The chart includes the average in its y-domain, so the real line (and
  the axis labels) collapsed against the top of the panel — a flat line reading
  `+0.64% / -49.17% / -98.97%`. `isIndexSymbol()` now distinguishes indices
  (`sh000xxx`, `sz399xxx`, lettered Hong Kong codes such as `hkHSI`) from
  stocks/ETFs, and their average is the cumulative mean of the quoted values;
  stocks keep the turnover-weighted average. The same fix covers the five-day
  overlay, which rebuilds the average per day.
- Tests: fixture-level checks for the CN and HK index averages and the symbol
  classification. 69 tests total.

## 1.5.5 — 2026-11-13

- The intraday volume bars now show the volume of each minute instead of the
  day's cumulative total. Tencent's minute rows carry cumulative volume, so the
  bars grew monotonically and said nothing about when trading happened; the
  provider now emits the per-minute delta (the opening minute keeps its own
  total) while the running average still accumulates the cumulative figures.
  Eastmoney already serves per-minute volume, so both sources now agree on the
  field's meaning.
- The Eastmoney intraday fallback also derives an index's average from the
  quoted values (restarting at each day boundary for a multi-day answer), so a
  Tencent failure cannot bring back the off-scale y-axis.
- Tests: per-minute deltas for the Tencent stock/CN index/HK index fixtures and
  the Eastmoney index average. 70 tests total.

## 1.5.6 — 2026-11-13

- The strip now shows that it is refreshing, for the manual button and for the
  auto poll: the refresh icon spins (and takes the brand color) while a `/quotes`
  request is in flight, held for at least 650 ms so a fast local answer is still
  visible, and the update clock flashes once per successful poll. Both effects
  respect `prefers-reduced-motion` (the color cue remains).
- The busy state is scoped to the newest request (`loadSeq`), so a slow earlier
  answer cannot clear the indicator of a newer one; the hold timer is cleared on
  unmount.
- Test: the refresh button reports `data-busy="true"` during the fetch and
  `"false"` once the hold expires. 71 tests total.

## 1.5.7 — 2026-11-13

- Moved the update cue from the header clock to the values themselves: when a
  card's displayed price or percent changes, that price block remounts and a
  brief brand-colored highlight fades out behind the price and the change. An
  unchanged value keeps its key and does not blink, so a poll where nothing
  traded stays quiet; the header refresh spinner still shows that a request is
  running. The flash respects `prefers-reduced-motion`.
- Test: a changed quote gets a fresh price-block key while the unchanged card
  keeps its key. 72 tests total.

## 1.6.0 — 2026-11-13

- The one-day intraday chart now answers "is volume expanding or shrinking?"
  directly: it overlays the prior four sessions' same-time average volume as a
  dashed line in the volume band and prints the same-time ratio
  (`同期量比 1.23 · 前4日均量`). The ratio is today's cumulative volume divided
  by the average cumulative volume of the prior four sessions at the same
  minute.
- No archive is needed for this window: Tencent's five-session minute endpoint
  already carries it. `GET /trend?...&baseline=4` returns today's full line plus
  the per-minute baseline and prevClose; if the five-session read fails, the
  route falls back to the single-day line without a baseline. The five-day
  overlay keeps its sequential payload and does not show the comparison.
- The volume band scales to the larger of today's bars and the baseline, so a
  heavy prior day cannot clip the reference line.
- Tests: the pure baseline fold (prior days averaged per minute-of-day) and the
  client request/overlay/report. 74 tests total.

## 1.6.1 — 2026-11-13

- The settings button used a sun glyph (circle plus rays); it is a real gear
  now. The symbol-form button used a sliders glyph that read as filtering; it
  is a plus now, matching what the button does (add/edit the watchlist).
- Trackpad horizontal swipes scroll the strip. The wheel handler used to ignore
  a horizontal delta as "the browser's job", but the strip sits inside the
  composer where that gesture reached the page instead. The dominant axis now
  drives the strip (deltaX for a trackpad swipe, deltaY for a wheel), still
  scoped to the strip's bounding box and still preventing the page's
  back/forward gesture while the strip can move.
- Test: a horizontal trackpad event scrolls the strip and is consumed. 74 tests
  total (the former "not hijacked" assertion now covers the intended behavior).

## 1.6.2 — 2026-11-13

- The strip now tells the truth about scrolling: the custom scroll track mounts
  only when `scrollWidth - clientWidth` shows a real overflow. With four cards
  that fit, the track disappears and there is nothing for a two-finger gesture
  to move; previously the track appeared on hover even when the strip fit, which
  made a dead gesture look broken.
- Wheel handling is bound both on the strip and its scroll wrapper (the absolute
  track is a sibling of the strip) and marks a consumed event so the window
  capture listener cannot scroll it a second time. The window listener also
  accepts a pointer inside the strip's rectangle, covering overlay targets.
- `localStorage['dsh-stock-ticker:debug'] = '1'` now logs
  `[stock-ticker] strip overflow {clientWidth, scrollWidth, overflowing}` and
  each consumed `[stock-ticker] strip wheel {deltaX, deltaY, max, scrollLeft}`.
- Tests: the scroll track is absent when the cards fit, and the strip's own
  listener scrolls once (the window listener does not double it). 76 tests.

## 1.6.3 — 2026-11-13

- The manual refresh button now acknowledges itself even when nothing changed:
  after the request settles, every card's price block remounts and replays the
  flash. This is the common case outside trading hours, where the poll returns
  identical values and the previous value-keyed flash stayed silent by design.
  Automatic polls keep the value-driven behavior, so a 5-second poll does not
  blink every card when the market is quiet.
- The price flash is an opacity fade, not motion, so it remains enabled under
  `prefers-reduced-motion`; only the rotating refresh spinner is disabled there.
- Tests: simulate the poll interval to cover the auto value-change path, and
  assert a manual refresh remounts every price block with unchanged values.
  77 tests total.

## 1.7.0 — 2026-11-13

- The card mini chart can now be an intraday line or a K-line: a new
  `miniChartType` preference selects `intraday / day / week / month`, exposed in
  both settings surfaces. The default stays `day`, so existing installs do not
  change appearance.
- `GET /sparklines?type=...` now returns a per-symbol chart descriptor:
  `{kind:'line', points, prevClose}` for intraday or `{kind:'candles', rows}` for
  K-lines. The legacy `rows` map is still present for compatibility and
  verification, and the ETag includes the type.
- Intraday lines are built from `trendFor` for A-shares and Hong Kong; US cards
  fall back to daily candles because free intraday is unavailable. The line is
  sampled to about 80 points and refreshes once a minute (driven by the quote
  poll), while K-line mini charts keep the five-minute TTL.
- The card draws the line with a direction-coloured stroke and a light area
  fill; the settings row is `迷你图类型` / `Mini chart type`.
- Tests: the settings select sends the preference, the intraday route fixture
  renders line charts, and the daily route still renders candles. 78 tests.

## 1.7.1 — 2026-11-13

- The mini-chart type switch is now a segmented control in the strip header
  (`分时线 / 日K / 周K / 月K`), next to the group pills, so it does not require
  opening the settings panel. It hides itself when the mini chart is turned off,
  marks the active type, and saves through the same `miniChartType` preference;
  the settings row remains for discoverability.
- Tests: clicking the header switch posts the preference and refetches the cards
  with `type=intraday`. 79 tests.

## 1.7.2 — 2026-11-13

- The header mini-chart switch was four separate bordered boxes, too heavy for
  the strip. It is now one compact pill with a native select and a chevron
  (`分时线 ▾`), matching the group pills and the icon row; the active value is
  the selected option, the tooltip names it, and it disappears with the mini
  chart. The settings row is unchanged.
- Screenshots refreshed for the header/detail/settings surfaces.

## 1.7.3 — 2026-11-13

- The header mini-chart switch is now a row of pills like the watchlist groups
  (`分时线 / 日K / 周K / 月K`), one active at a time, instead of a dropdown. It
  reuses the group-pill style, hides with the mini chart, and saves the same
  `miniChartType` preference.
- Test: the active pill switches the preference and refetches with
  `type=intraday`. 79 tests.

## 1.7.4 — 2026-11-13

- The strip no longer draws a native horizontal scrollbar over the price row.
  macOS could show a full-height bar that covered the bottom of every card, so
  the native bar is hidden (`scrollbar-width: none` and a zero-sized
  `::-webkit-scrollbar`) and the existing 3 px custom track is the only
  indicator. The strip reserves 6 px of bottom padding, keeping the track below
  the cards instead of on top of them.
- Screenshots refreshed.

## 1.7.5 — 2026-11-13

- The intraday volume band now says, in one line, whether volume is expanding:
  `放量 ↑` / `缩量 ↓` / `平量 →` plus the same-time ratio and the prior-days
  baseline. Bars that beat their same-time baseline are drawn brighter and bars
  below it fade, so the minute-by-minute picture matches the summary without
  changing the price-direction colour.
- The preview fixture now carries the baseline, so the README detail shot shows
  the signal. 79 tests.

## 1.8.0 — 2026-11-13

- The intraday volume comparison is now against the **previous trading session**
  (the immediate prior day), not a four-day average: the dashed line is
  yesterday's volume at the same minute, and each bar is coloured directly:
  orange when it beats yesterday at that minute, grey when it is at or below.
  No third colour, so the volume story stays binary. The note reads
  `放量 ↑ 同期量比 1.25 · 昨日同期量`, and the hover readout adds
  `昨 <volume> (<x>x)`.
- The client asks `/trend?baseline=1`; the Host already supports the count, so
  the route and cache shape are unchanged.
- Tests: the previous-session baseline and the `放量` signal. 79 tests.

## 1.8.1 — 2026-11-13

- Hovering an intraday point now reports that minute's volume verdict explicitly:
  `量 389.14万 · 放量 1.08× · 昨 360.12万`, coloured orange/grey like the bar,
  and the hovered volume bar gets a thin highlight so it is obvious which bar
  the readout describes. The 3/5-day overlays keep the plain readout because
  they have no previous-session baseline.
- Test: hovering the detail chart exposes `放量` and the previous volume. 80
  tests.

## 1.8.2 — 2026-11-13

- Interaction polish, all motion opt-out aware:
  - a shared 160 ms ease drives card, icon, pill, tab, toggle, button, input and
    link transitions; cards lift with a soft elevation on hover and the selected
    card gets a faint brand tint; pills get a subtle active fill;
  - the detail panel, symbol form, settings card, toast and hover readout fade
    in; charts fade in when a new chart mounts; the scroll thumb glides;
  - inputs/selects show a brand focus ring, the add-card and close buttons get
    their own hover states;
  - `prefers-reduced-motion` disables the entrance animations and spinner, while
    the opacity-only price flash stays.
- Preview pages skip transient animations so README screenshots capture the
  settled state.
- No behaviour changes. 80 tests.

## 1.8.3 — 2026-11-13

- The card's US extended-hours chip no longer says `盘前 +1.84%` in a bordered
  pill; it is now a compact `前 +1.84%` (or `后`) with the percent coloured by
  its own direction and no border/padding. The full session, price and timestamp
  move to the tooltip, so the card stops growing just because pre-market is on.
  The detail header keeps the full label because it has the room.
- Test updated for the compact chip and its tooltip. 80 tests.

## 1.8.4 — 2026-11-13

- Switching a watchlist group no longer appears stuck when a quote poll is
  already in flight:
  - the clicked pill highlights immediately instead of waiting for the round
    trip;
  - the switch forces a fresh `/quotes` request and names the group explicitly,
    so the answer cannot belong to the previous selection;
  - the newest request owns the loading/error state and older answers are
    dropped by a sequence guard, so a stale poll cannot repaint the old group;
  - a manual refresh also supersedes an in-flight poll instead of being skipped.
- Test: clicking the second group activates it, requests `group=<id>` and marks
  the pill active. 81 tests.

## 1.8.5 — 2026-11-13

- The strip header is now two rows: the quote title, source, session, build and
  update time stay on top; the watchlist groups and the action bar share the
  second row. Groups sit on the left and scroll inside their own lane, the
  mini-chart pills and header icons are pinned to the right, so switching to a
  group with a longer name/count no longer shifts the action buttons.
- No behaviour changes; screenshots refreshed. 81 tests.

## 1.8.6 — 2026-11-13

- Moved the groups and action bar below the cards, as requested: the top row is
  just the quote title/source/session/build/time, then the cards (and detail
  panel), then a footer with the groups on the left and the mini-chart pills and
  header icons pinned to the right. Switching to a group with a different width
  now only changes the left part of the footer; the action buttons stay put.
- Screenshots refreshed. 81 tests.

## 1.8.7 — 2026-11-13

- Moved the title/source/session/build/time row below the cards as well. The
  strip now opens with the quote cards; the status row sits under them and above
  the groups/actions footer, so everything except the quotes is in the fixed
  control area at the bottom. Screenshots refreshed. 81 tests.

## 1.8.8 — 2026-11-13

- Fixed the real cause of the moving footer buttons: DSH's composer dock is a
  fit-content flex item in a centered column, so its width tracked the number
  of cards in the active group. A nine-card group made the dock wide and a
  four-card group made it narrow, which moved the whole control strip even
  though the footer itself was right-pinned.
- While claiming its row, the strip now sets the dock to `width: 100%` and
  restores the previous width on unmount, so the cards and the footer always
  span the composer. The two-row/footer layout is unchanged.
- Test: the dock is asserted to be full width. 81 tests.

## 1.8.9 — 2026-11-13

- Put the status row on the same line as the groups and actions: the strip is
  now cards on top, then a single control line `行情 腾讯 盘中 v1.8.9 时间`,
  the group pills, a flexible gap, and the mini-chart pills/icons on the right.
  The status block shrinks and wraps internally on narrow widths while the
  action buttons stay right-pinned and the dock stays full width.
- Screenshots refreshed. 81 tests.

## 1.8.10 — 2026-11-13

- The settings gear and the add/symbol-form `+` now show an unmistakable active
  state while their panel is open: brand border, brand icon and a 14% brand
  fill, matching the selected pills. The collapse arrow keeps its neutral state
  because `data-toggle` scopes the fill to panel-owning buttons.
- No behaviour changes. 81 tests.

## 1.9.0 — 2026-11-13

- The 5/15/30/60-minute K charts now tell the same volume story as the intraday
  line: each volume bar is coloured against the **same HH:MM on the previous
  trading day** (orange = heavier, grey = lighter, dashed line = prior-session
  level), and hovering reports `量 ... · 放量/缩量 x.xx× · 昨 ...` plus a small
  legend under the chart.
- This is computed entirely from the rows already returned by `/kline`; no new
  endpoint, no larger fetch and no persistence. Day/week/month K are unchanged
  as requested: they keep the ordinary volume colouring.
- Tests: minute-K baseline, dashed line and the hover verdict. 82 tests.

## 1.10.0 — 2026-11-13

- Added **range selection** to the detail K-line charts, in the spirit of the
  domestic trading apps: drag horizontally across the chart to select an
  interval. The range is shaded, both edges are marked, and the highest/lowest
  points get a dashed guide plus a dot and a price label.
- A summary strip under the chart shows the selected dates and bar count, the
  interval change (`first open → last close`), the highest/lowest price with
  their dates, the amplitude and the summed volume; `清除` clears it. A plain
  click (without dragging) also clears the range.
- Works for all K-line periods; the range resets when the period or the row set
  changes. It composes with the minute-volume comparison (orange/grey bars and
  the prior-session dashed line).
- Test: drag selection produces the summary with change, amplitude and clear.
  83 tests.

## 1.10.1 — 2026-11-13

- Card reordering now previews the destination while dragging instead of only
  moving after the drop: the source card becomes an invisible placeholder and
  the cards between source and target slide 160 ms into/out of the gap as the
  pointer crosses them, then the drop commits in place (the local order is
  updated optimistically before the `/config` round trip). Drag cancellation
  restores the original layout.
- Test: dragging over the second card shifts it into the source slot and saves
  nothing until drop. 84 tests.

## 1.10.2 — 2026-11-13

- Fixed the drag regression introduced by 1.10.1: the drag source was given
  `pointer-events: none` and zero opacity, which can end the browser's HTML5
  drag session before any drop. The source now stays hit-testable and only fades
  to 0.28; the neighbours still slide with the 160 ms preview.
- The strip itself now accepts `dragover`/`drop` and chooses the nearest card,
  so releasing in the gap between cards also commits, not only on a card.
- Test updated for the visible placeholder. 84 tests.

## 1.10.3 — 2026-11-13

- The volume bars now have graduated intensity instead of only orange/grey:
  - `>= 1.5x` a heavy expansion → red;
  - `>= 1.15x` a normal expansion → orange;
  - `>= 1x` a slight expansion → pale orange;
  - `< 1x` shrinking → progressively lighter greys, with very light grey below
    `0.6x` for a clear "quiet" reading.
- Applies to both the intraday volume band and the 5/15/30/60-minute K bars;
  the hover/readout signal turns red for the heavy tier and the minute-K legend
  now says "red/orange = expanding · paler = shrinking". 84 tests.
