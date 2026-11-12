/**
 * Client half of the stock ticker bundle: a compact quote strip under the
 * composer. It reads its data from the package's Host half over the same-origin
 * route `/dsh-stock-ticker/quotes` and saves a new symbol list to the Host,
 * which persists it through the profile's config editor.
 */

window.__ModuleLoader__.load({
  id: '@local/dsh-stock-ticker',
  factory(require) {
    const React = require('react')
    const h = React.createElement
    const { useCallback, useEffect, useMemo, useRef, useState } = React

    const NS = 'stockTicker'
    const BUILD = 'v1.1'
    const ENDPOINT = '/dsh-stock-ticker'
    const COLLAPSE_KEY = 'dsh-stock-ticker:collapsed'

    const DICT_ZH = {
      title: '行情',
      settings: '配置标的',
      collapse: '收起',
      expand: '展开',
      refresh: '刷新',
      loading: '加载中…',
      unavailable: '行情暂不可用',
      retry: '重试',
      noSymbols: '还没有配置标的',
      hint: '每行一个，或用空格、逗号分隔。可直接写六位代码（600519、000001）、港股（00700）或美股（AAPL），也支持 sh/sz/hk/us 前缀。',
      save: '保存',
      saving: '保存中…',
      cancel: '取消',
      configNotWritable: '当前 profile 不允许保存该配置，请改为编辑 cordis.patch.yml。',
      saved: '已保存，正在更新…',
      timeout: '请求超时，请检查网络后重试',
      network: '连不上本机行情服务，请刷新页面重试',
      unrecognized: '无法识别：',
      noData: '无数据',
      forbiddenWrite: '只有本机页面可以修改标的配置。',
      emptySymbols: '至少填写一个标的',
      open: '开',
      high: '高',
      low: '低',
      prevClose: '昨收',
      close: '关闭',
      noKline: '暂无K线',
      tabTrend: '分时',
      tabMinute: '5分',
      tabDay: '日K',
      tabWeek: '周K',
      tabMonth: '月K',
      orderBook: '五档盘口',
      orderRatio: '委比',
      amount: '成交额',
      turnover: '换手',
      volumeRatio: '量比',
      amplitude: '振幅',
      marketCap: '市值',
      limitUp: '涨停',
      limitDown: '跌停',
      sourceTencent: '腾讯',
      sourceSina: '新浪',
      sessionTrading: '盘中',
      sessionBreak: '休市',
      sessionClosed: '收盘',
      sessionWeekend: '周末',
      staleData: '数据可能不是最新',
    }

    const DICT_EN = {
      title: 'Quotes',
      settings: 'Configure symbols',
      collapse: 'Collapse',
      expand: 'Expand',
      refresh: 'Refresh',
      loading: 'Loading…',
      unavailable: 'Quotes unavailable',
      retry: 'Retry',
      noSymbols: 'No symbols configured',
      hint: 'One symbol per line, or separated by spaces or commas. Bare codes work too: 600519, 000001, 00700, AAPL; sh/sz/hk/us prefixes are accepted.',
      save: 'Save',
      saving: 'Saving…',
      cancel: 'Cancel',
      configNotWritable: 'This profile cannot save the configuration; edit cordis.patch.yml instead.',
      saved: 'Saved, updating…',
      timeout: 'The request timed out; check the network and retry',
      network: 'The local quote service is unreachable; reload the page',
      unrecognized: 'Unrecognized: ',
      noData: 'No data',
      forbiddenWrite: 'Only the local page may change the symbol list.',
      emptySymbols: 'Add at least one symbol',
      open: 'Open',
      high: 'High',
      low: 'Low',
      prevClose: 'Prev',
      close: 'Close',
      noKline: 'No K-line data',
      tabTrend: 'Intraday',
      tabMinute: '5m',
      tabDay: 'Daily',
      tabWeek: 'Weekly',
      tabMonth: 'Monthly',
      orderBook: 'Order book',
      orderRatio: 'Ratio',
      amount: 'Turnover',
      turnover: 'Turn',
      volumeRatio: 'Vol ratio',
      amplitude: 'Range',
      marketCap: 'Cap',
      limitUp: 'Limit up',
      limitDown: 'Limit down',
      sourceTencent: 'Tencent',
      sourceSina: 'Sina',
      sessionTrading: 'Live',
      sessionBreak: 'Break',
      sessionClosed: 'Closed',
      sessionWeekend: 'Weekend',
      staleData: 'Data may be stale',
    }

    const CSS = `
.dshst {
  --dshst-up: var(--dsw-alias-state-error-primary);
  --dshst-down: color-mix(in srgb, var(--dsw-alias-state-success-primary) 68%, var(--dsw-alias-label-primary));
  display: flex;
  flex-direction: column;
  gap: 6px;
  flex: 1 1 auto;
  min-width: 0;
  max-width: 100%;
  padding: 2px 2px 0;
  font-size: 12px;
  line-height: 1.35;
  color: var(--dsw-alias-label-primary);
}
.dshst[data-scheme="intl"] {
  --dshst-up: color-mix(in srgb, var(--dsw-alias-state-success-primary) 68%, var(--dsw-alias-label-primary));
  --dshst-down: var(--dsw-alias-state-error-primary);
}
.dshst-head {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 20px;
  color: var(--dsw-alias-label-secondary);
}
.dshst-title {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.04em;
  color: var(--dsw-alias-label-secondary);
}
.dshst-meta {
  font-size: 11px;
  font-variant-numeric: tabular-nums;
  color: var(--dsw-alias-label-secondary);
}
.dshst-spacer { flex: 1 1 auto; }
.dshst-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  padding: 0;
  border: 1px solid transparent;
  border-radius: 6px;
  background: transparent;
  color: var(--dsw-alias-label-secondary);
  cursor: pointer;
}
.dshst-icon:hover {
  border-color: var(--dsw-alias-border-l2);
  background: var(--dsw-alias-interactive-bg-hover);
  color: var(--dsw-alias-label-primary);
}
.dshst-icon[aria-expanded="true"] {
  border-color: var(--dsw-alias-border-l2);
  color: var(--dsw-alias-label-primary);
}
.dshst-strip {
  display: flex;
  gap: 6px;
  overflow-x: auto;
  padding-bottom: 2px;
  scrollbar-width: thin;
}
.dshst-card {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 0 0 auto;
  min-width: 132px;
  padding: 5px 8px;
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 8px;
  background: var(--dsw-alias-bg-layer-1);
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
}
.dshst-card:hover {
  border-color: var(--dsw-alias-border-l2);
  background: var(--dsw-alias-interactive-bg-hover);
}
.dshst-card[data-selected="true"] {
  border-color: var(--dsw-alias-brand-primary);
  box-shadow: inset 0 0 0 1px var(--dsw-alias-brand-primary);
}
.dshst-cardMain {
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
}
.dshst-name {
  max-width: 74px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
  font-weight: 600;
}
.dshst-code {
  font-size: 10px;
  font-variant-numeric: tabular-nums;
  color: var(--dsw-alias-label-secondary);
}
.dshst-quote {
  display: flex;
  flex-direction: column;
  gap: 1px;
  margin-left: auto;
  text-align: right;
  font-variant-numeric: tabular-nums;
}
.dshst-price { font-size: 13px; font-weight: 600; }
.dshst-chg { font-size: 11px; }
.dshst-up { color: var(--dshst-up); }
.dshst-down { color: var(--dshst-down); }
.dshst-flat { color: var(--dsw-alias-label-secondary); }
.dshst-chart { display: block; flex: 0 0 auto; }
.dshst-chartEmpty {
  display: block;
  flex: 0 0 auto;
  border: 1px dashed var(--dsw-alias-border-l2);
  border-radius: 3px;
}
.dshst-detail {
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-height: min(46vh, 360px);
  overflow-y: auto;
  padding: 7px 10px 8px;
  border: 1px solid var(--dsw-alias-border-l1);
  border-radius: 10px;
  background: var(--dsw-alias-bg-layer-1);
}
.dshst-detailHead {
  display: flex;
  align-items: baseline;
  gap: 8px;
  flex-wrap: wrap;
}
.dshst-detailName { font-size: 13px; font-weight: 600; }
.dshst-detailPrice { font-size: 15px; font-weight: 600; font-variant-numeric: tabular-nums; }
.dshst-detailChg { font-size: 12px; font-variant-numeric: tabular-nums; }
.dshst-stats {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  font-size: 11px;
  color: var(--dsw-alias-label-secondary);
  font-variant-numeric: tabular-nums;
}
.dshst-stats b { font-weight: 600; color: var(--dsw-alias-label-primary); }
.dshst-tabs { display: flex; gap: 2px; flex-wrap: wrap; }
.dshst-tab {
  padding: 1px 8px;
  border: 1px solid transparent;
  border-radius: 6px;
  background: transparent;
  color: var(--dsw-alias-label-secondary);
  font: inherit;
  font-size: 11px;
  cursor: pointer;
}
.dshst-tab:hover {
  color: var(--dsw-alias-label-primary);
  background: var(--dsw-alias-interactive-bg-hover);
}
.dshst-tab[data-active="true"] {
  color: var(--dsw-alias-label-primary);
  border-color: var(--dsw-alias-border-l2);
  background: var(--dsw-alias-bg-layer-2);
}
.dshst-limitMark {
  margin-left: 4px;
  padding: 0 3px;
  border: 1px solid currentColor;
  border-radius: 3px;
  font-size: 9px;
  line-height: 12px;
}
.dshst-limit {
  padding: 0 4px;
  border: 1px solid currentColor;
  border-radius: 4px;
  font-size: 10px;
  line-height: 14px;
}
.dshst-book { display: flex; flex-direction: column; gap: 3px; }
.dshst-bookHead {
  display: flex;
  justify-content: space-between;
  font-size: 11px;
  color: var(--dsw-alias-label-secondary);
  font-variant-numeric: tabular-nums;
}
.dshst-bookGrid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 2px 16px;
  font-size: 11px;
  font-variant-numeric: tabular-nums;
}
.dshst-bookRow { display: flex; align-items: baseline; gap: 6px; }
.dshst-bookLabel { width: 20px; color: var(--dsw-alias-label-secondary); }
.dshst-bookPrice { min-width: 54px; text-align: right; }
.dshst-bookVolume { margin-left: auto; color: var(--dsw-alias-label-secondary); }
.dshst-chip {
  padding: 0 5px;
  border: 1px solid var(--dsw-alias-border-l1);
  border-radius: 4px;
  font-size: 10px;
  color: var(--dsw-alias-label-secondary);
}
.dshst-chip[data-tone="warn"] { color: var(--dsw-alias-state-warn-primary); border-color: currentColor; }
.dshst-detailClose {
  margin-left: auto;
  padding: 1px 6px;
  border: 1px solid var(--dsw-alias-border-l1);
  border-radius: 6px;
  background: transparent;
  color: var(--dsw-alias-label-secondary);
  font: inherit;
  font-size: 11px;
  cursor: pointer;
}
.dshst-detailClose:hover { color: var(--dsw-alias-label-primary); }
.dshst-note {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  padding: 2px 0;
  color: var(--dsw-alias-label-secondary);
}
.dshst-notice {
  padding: 0 2px;
  color: var(--dsw-alias-state-success-primary);
}
.dshst-live {
  position: absolute;
  width: 1px;
  height: 1px;
  margin: -1px;
  padding: 0;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
  border: 0;
}
.dshst-error { color: var(--dsw-alias-state-error-primary); }
.dshst-link {
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--dsw-alias-brand-primary);
  font: inherit;
  cursor: pointer;
  text-decoration: underline;
}
.dshst-form { display: flex; flex-direction: column; gap: 6px; }
.dshst-textarea {
  width: 100%;
  min-height: 68px;
  padding: 6px 8px;
  border: 1px solid var(--dsw-alias-border-l1);
  border-radius: 8px;
  background: var(--dsw-alias-bg-layer-1);
  color: var(--dsw-alias-label-primary);
  font-family: inherit;
  font-size: 12px;
  line-height: 1.5;
  resize: vertical;
}
.dshst-textarea:focus {
  outline: none;
  border-color: var(--dsw-alias-brand-primary);
}
.dshst-icon:focus-visible,
.dshst-card:focus-visible,
.dshst-button:focus-visible,
.dshst-detailClose:focus-visible,
.dshst-link:focus-visible,
.dshst-textarea:focus-visible {
  outline: 2px solid var(--dsw-alias-brand-primary);
  outline-offset: 1px;
}
.dshst-formRow {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.dshst-hint {
  flex: 1 1 240px;
  font-size: 11px;
  color: var(--dsw-alias-label-secondary);
}
.dshst-button {
  padding: 3px 12px;
  border: 1px solid var(--dsw-alias-border-l1);
  border-radius: 7px;
  background: var(--dsw-alias-bg-layer-1);
  color: var(--dsw-alias-label-primary);
  font: inherit;
  font-size: 12px;
  cursor: pointer;
}
.dshst-button:hover { border-color: var(--dsw-alias-border-l2); }
.dshst-button[data-primary="true"] {
  border-color: var(--dsw-alias-brand-primary);
  background: var(--dsw-alias-brand-primary);
  color: var(--dsw-alias-bg-base);
}
.dshst-button:disabled { opacity: 0.55; cursor: default; }
`

    /* ------------------------------------------------------------- helpers */

    function priceDigits(value) {
      const abs = Math.abs(value)
      if (abs >= 100) return 2
      if (abs >= 1) return 2
      return 3
    }

    function formatPrice(value) {
      if (typeof value !== 'number' || !Number.isFinite(value)) return '--'
      return value.toFixed(priceDigits(value))
    }

    function formatPct(value) {
      if (typeof value !== 'number' || !Number.isFinite(value)) return '--'
      const sign = value > 0 ? '+' : ''
      return `${sign}${value.toFixed(2)}%`
    }

    function trendClass(value) {
      if (typeof value !== 'number' || !Number.isFinite(value) || value === 0) return 'dshst-flat'
      return value > 0 ? 'dshst-up' : 'dshst-down'
    }

    function describeSaveError(code, status, t) {
      if (code === 'config-not-writable') return t('configNotWritable')
      if (code === 'forbidden') return t('forbiddenWrite')
      if (code === 'symbols-empty' || code === 'invalid-body') return t('emptySymbols')
      return code || `HTTP ${status}`
    }

    function displayCode(quote) {
      const code = typeof quote.code === 'string' && quote.code !== '' ? quote.code : quote.symbol
      return code.split('.')[0]
    }

    /** Mirrors the Host normalizer so the form can name the input it rejects. */
    function normalizeSymbolText(raw) {
      if (typeof raw !== 'string') return undefined
      const text = raw.trim().replace(/[%^$\s]/g, '')
      if (text === '') return undefined
      if (/^(sh|sz|hk|us)[a-z0-9._-]{1,16}$/i.test(text)) {
        const prefix = text.slice(0, 2).toLowerCase()
        const body = text.slice(2)
        return `${prefix}${prefix === 'us' ? body.toUpperCase() : body.toLowerCase()}`
      }
      if (/^\d{6}$/.test(text)) {
        const head = text[0]
        return `${head === '6' || head === '5' || head === '9' ? 'sh' : 'sz'}${text}`
      }
      if (/^\d{5}$/.test(text)) return `hk${text}`
      if (/^[A-Z][A-Z.]{0,9}$/i.test(text)) return `us${text.toUpperCase()}`
      return undefined
    }

    function describeLoadError(failure, t) {
      const name = failure?.name
      if (name === 'TimeoutError' || name === 'AbortError') return t('timeout')
      if (typeof TypeError !== 'undefined' && failure instanceof TypeError) return t('network')
      return String(failure?.message ?? failure)
    }

    function sessionLabel(t, session) {
      if (!session) return ''
      if (session.weekend) return t('sessionWeekend')
      if (session.mode === 'trading') return t('sessionTrading')
      if (session.mode === 'break') return t('sessionBreak')
      return t('sessionClosed')
    }

    function formatClock(timestamp) {
      if (typeof timestamp !== 'number') return ''
      const date = new Date(timestamp)
      const pad = (part) => String(part).padStart(2, '0')
      return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
    }

    function readCollapsed() {
      try {
        return window.localStorage.getItem(COLLAPSE_KEY) === '1'
      } catch {
        return false
      }
    }

    function writeCollapsed(value) {
      try {
        window.localStorage.setItem(COLLAPSE_KEY, value ? '1' : '0')
      } catch {
        /* storage may be unavailable; collapsing still works for this page */
      }
    }

    /* -------------------------------------------------------------- pieces */

    function Candles(props) {
      const rows = Array.isArray(props.rows) ? props.rows : []
      const width = props.width
      const height = props.height
      const chartStyle = props.block
        ? { width: '100%', height: `${height}px` }
        : { width: `${width}px`, height: `${height}px` }

      if (rows.length < 2) {
        return h('div', {
          className: 'dshst-chartEmpty',
          style: chartStyle,
          title: props.emptyLabel ?? '',
        })
      }

      let min = Number.POSITIVE_INFINITY
      let max = Number.NEGATIVE_INFINITY
      for (const row of rows) {
        if (typeof row.high === 'number' && row.high > max) max = row.high
        if (typeof row.low === 'number' && row.low < min) min = row.low
      }
      if (!Number.isFinite(min) || !Number.isFinite(max) || max <= min) {
        return h('div', { className: 'dshst-chartEmpty', style: chartStyle })
      }

      const inset = 2
      const bottom = height - inset
      const span = max - min
      const scaleY = (value) => bottom - ((value - min) / span) * (bottom - inset)
      const step = width / rows.length
      const bodyWidth = Math.max(1, Math.min(step * 0.62, 6))

      const children = []
      if (props.grid) {
        for (let index = 0; index <= 3; index += 1) {
          const y = inset + ((bottom - inset) * index) / 3
          children.push(
            h('line', {
              key: `g${index}`,
              x1: 0,
              x2: width,
              y1: y,
              y2: y,
              style: { stroke: 'var(--dsw-alias-border-l1)' },
              strokeWidth: 1,
              vectorEffect: 'non-scaling-stroke',
            }),
          )
        }
      }

      rows.forEach((row, index) => {
        const center = step * (index + 0.5)
        const rising = row.close >= row.open
        const color = rising ? 'var(--dshst-up)' : 'var(--dshst-down)'
        const highY = scaleY(row.high)
        const lowY = scaleY(row.low)
        const openY = scaleY(row.open)
        const closeY = scaleY(row.close)
        const top = Math.min(openY, closeY)
        const bodyHeight = Math.max(0.8, Math.abs(closeY - openY))
        children.push(
          h('line', {
            key: `w${index}`,
            x1: center,
            x2: center,
            y1: highY,
            y2: lowY,
            style: { stroke: color },
            strokeWidth: 1,
            vectorEffect: 'non-scaling-stroke',
          }),
          h('rect', {
            key: `b${index}`,
            x: center - bodyWidth / 2,
            y: top,
            width: bodyWidth,
            height: bodyHeight,
            style: { fill: color },
          }),
        )
      })

      return h(
        'svg',
        {
          className: props.block ? 'dshst-chart' : 'dshst-chart',
          viewBox: `0 0 ${width} ${height}`,
          preserveAspectRatio: 'none',
          style: chartStyle,
          role: 'img',
          'aria-label': props.label ?? '',
        },
        children,
      )
    }

    function QuoteCard(props) {
      const { quote, t } = props
      if (quote.error) {
        return h(
          'div',
          {
            className: 'dshst-card',
            title: `${quote.symbol}: ${quote.error}`,
            'aria-label': `${quote.symbol}: ${t('noData')}`,
          },
          h('span', { className: 'dshst-cardMain' }, h('span', { className: 'dshst-name' }, quote.symbol)),
          h(
            'span',
            { className: 'dshst-quote' },
            h('span', { className: 'dshst-chg dshst-flat' }, t('noData')),
          ),
        )
      }
      const trend = trendClass(quote.changePct)
      return h(
        'button',
        {
          type: 'button',
          className: 'dshst-card',
          'data-selected': props.selected ? 'true' : 'false',
          onClick: props.onSelect,
          title: `${quote.name ?? quote.symbol} ${quote.code ?? ''}`.trim(),
          'aria-pressed': props.selected ? 'true' : 'false',
        },
        h(
          'span',
          { className: 'dshst-cardMain' },
          h('span', { className: 'dshst-name' }, quote.name ?? quote.symbol),
          h(
            'span',
            { className: 'dshst-code' },
            displayCode(quote),
            limitState(quote) === 'up' ? h('span', { className: 'dshst-limitMark dshst-up' }, t('limitUp')) : null,
            limitState(quote) === 'down' ? h('span', { className: 'dshst-limitMark dshst-down' }, t('limitDown')) : null,
          ),
        ),
        h(
          'span',
          { className: 'dshst-quote' },
          h('span', { className: `dshst-price ${trend}` }, formatPrice(quote.price)),
          h('span', { className: `dshst-chg ${trend}` }, formatPct(quote.changePct)),
        ),
        h(Candles, {
          rows: Array.isArray(quote.kline) ? quote.kline.slice(-20) : quote.kline,
          width: 54,
          height: 24,
          label: `${quote.name ?? quote.symbol} ${t('title')}`,
          emptyLabel: t('noKline'),
        }),
      )
    }

    function formatAmount(value) {
      if (typeof value !== 'number' || !Number.isFinite(value)) return '--'
      if (Math.abs(value) >= 1e8) return `${(value / 1e8).toFixed(2)}亿`
      if (Math.abs(value) >= 1e4) return `${(value / 1e4).toFixed(2)}万`
      return value.toFixed(0)
    }

    function formatCap(value) {
      if (typeof value !== 'number' || !Number.isFinite(value)) return '--'
      if (value >= 10000) return `${(value / 10000).toFixed(2)}万亿`
      return `${value.toFixed(2)}亿`
    }

    async function fetchJson(path) {
      const response = await fetch(`${ENDPOINT}${path}`, {
        headers: { Accept: 'application/json' },
        cache: 'no-store',
        signal: AbortSignal.timeout(12000),
      })
      const payload = await response.json().catch(() => null)
      if (!response.ok || payload?.ok !== true) {
        throw new Error(payload?.error || `HTTP ${response.status}`)
      }
      return payload
    }

    function TrendChart(props) {
      const points = Array.isArray(props.points) ? props.points : []
      const prevClose = typeof props.prevClose === 'number' ? props.prevClose : null
      const width = 640
      const height = 132
      if (points.length < 2) {
        return h('div', { className: 'dshst-chartEmpty', style: { width: '100%', height: `${height}px` } })
      }
      let min = Number.POSITIVE_INFINITY
      let max = Number.NEGATIVE_INFINITY
      for (const point of points) {
        if (point.price < min) min = point.price
        if (point.price > max) max = point.price
        if (typeof point.avg === 'number') {
          if (point.avg < min) min = point.avg
          if (point.avg > max) max = point.avg
        }
      }
      if (prevClose !== null) {
        min = Math.min(min, prevClose)
        max = Math.max(max, prevClose)
      }
      if (!Number.isFinite(min) || !Number.isFinite(max) || max <= min) {
        return h('div', { className: 'dshst-chartEmpty', style: { width: '100%', height: `${height}px` } })
      }
      const inset = 6
      const scaleY = (value) => height - inset - ((value - min) / (max - min)) * (height - inset * 2)
      const scaleX = (index) => (index / (points.length - 1)) * width
      const priceLine = points.map((point, index) => `${scaleX(index).toFixed(1)},${scaleY(point.price).toFixed(1)}`).join(' ')
      const avgLine = points
        .map((point, index) => (typeof point.avg === 'number' ? `${scaleX(index).toFixed(1)},${scaleY(point.avg).toFixed(1)}` : null))
        .filter(Boolean)
        .join(' ')
      const area = `M0,${height} L${priceLine.split(' ').join(' L')} L${width},${height} Z`
      const up = props.up
      return h(
        'svg',
        {
          className: 'dshst-chart',
          viewBox: `0 0 ${width} ${height}`,
          preserveAspectRatio: 'none',
          style: { width: '100%', height: `${height}px` },
          role: 'img',
          'aria-label': props.label ?? '',
        },
        h('path', { d: area, style: { fill: up, fillOpacity: 0.1 } }),
        prevClose !== null
          ? h('line', {
              x1: 0,
              x2: width,
              y1: scaleY(prevClose),
              y2: scaleY(prevClose),
              style: { stroke: 'var(--dsw-alias-border-l2)', strokeDasharray: '4 4' },
              strokeWidth: 1,
              vectorEffect: 'non-scaling-stroke',
            })
          : null,
        h('polyline', { points: priceLine, fill: 'none', style: { stroke: up }, strokeWidth: 1.4, vectorEffect: 'non-scaling-stroke' }),
        avgLine
          ? h('polyline', {
              points: avgLine,
              fill: 'none',
              style: { stroke: 'var(--dsw-alias-label-secondary)', strokeDasharray: '3 3' },
              strokeWidth: 1,
              vectorEffect: 'non-scaling-stroke',
            })
          : null,
      )
    }

    function OrderBook(props) {
      const depth = props.depth
      const t = props.t
      const prevClose = props.prevClose
      const levelsOf = (value) =>
        Array.isArray(value) ? value.filter((level) => level !== null && typeof level === 'object') : []
      const bids = levelsOf(depth?.bids)
      const asks = levelsOf(depth?.asks)
      if (bids.length === 0 && asks.length === 0) return null
      const side = (levels, kind) =>
        levels.map((level, index) => {
          const price = level.price
          const tone =
            typeof price !== 'number' || typeof prevClose !== 'number'
              ? 'dshst-flat'
              : price > prevClose
                ? 'dshst-up'
                : price < prevClose
                  ? 'dshst-down'
                  : 'dshst-flat'
          return h(
            'div',
            { className: 'dshst-bookRow', key: `${kind}${index}` },
            h('span', { className: 'dshst-bookLabel' }, `${kind}${5 - index}`),
            h('span', { className: `dshst-bookPrice ${tone}` }, formatPrice(price)),
            h('span', { className: 'dshst-bookVolume' }, typeof level.volume === 'number' ? level.volume : '--'),
          )
        })
      const ratio = typeof depth.ratio === 'number' ? depth.ratio : null
      return h(
        'div',
        { className: 'dshst-book' },
        h(
          'div',
          { className: 'dshst-bookHead' },
          h('span', null, t('orderBook')),
          ratio === null
            ? null
            : h('span', { className: ratio >= 0 ? 'dshst-up' : 'dshst-down' }, `${t('orderRatio')} ${ratio.toFixed(1)}%`),
        ),
        h('div', { className: 'dshst-bookGrid' }, side([...asks].reverse(), '卖'), side(bids, '买')),
      )
    }

    function StatChips(props) {
      const { quote, t } = props
      const extras = quote.extras ?? {}
      const chips = [
        [t('open'), formatPrice(quote.open)],
        [t('high'), formatPrice(quote.high)],
        [t('low'), formatPrice(quote.low)],
        [t('prevClose'), formatPrice(quote.prevClose)],
      ]
      if (quote.amount !== null && quote.amount !== undefined) chips.push([t('amount'), formatAmount(quote.amount)])
      if (typeof extras.turnover === 'number') chips.push([t('turnover'), `${extras.turnover.toFixed(2)}%`])
      if (typeof extras.volumeRatio === 'number') chips.push([t('volumeRatio'), extras.volumeRatio.toFixed(2)])
      if (typeof extras.amplitude === 'number') chips.push([t('amplitude'), `${extras.amplitude.toFixed(2)}%`])
      if (typeof extras.pe === 'number') chips.push(['PE', extras.pe.toFixed(2)])
      if (typeof extras.pb === 'number') chips.push(['PB', extras.pb.toFixed(2)])
      if (typeof extras.totalCap === 'number') chips.push([t('marketCap'), formatCap(extras.totalCap)])
      return h(
        'div',
        { className: 'dshst-stats' },
        ...chips.map(([label, value]) => h('span', { key: label }, `${label} `, h('b', null, value))),
      )
    }

    function limitState(quote) {
      const extras = quote?.extras
      if (!extras || typeof quote.price !== 'number') return null
      if (typeof extras.limitUp === 'number' && extras.limitUp > 0 && quote.price >= extras.limitUp - 0.001) return 'up'
      if (typeof extras.limitDown === 'number' && extras.limitDown > 0 && quote.price <= extras.limitDown + 0.001) return 'down'
      return null
    }

    function limitLabel(quote, t) {
      const state = limitState(quote)
      if (state === 'up') return h('span', { className: 'dshst-limit dshst-up' }, t('limitUp'))
      if (state === 'down') return h('span', { className: 'dshst-limit dshst-down' }, t('limitDown'))
      return null
    }

    const DETAIL_TABS = [
      { id: 'trend', labelKey: 'tabTrend' },
      { id: 'm5', labelKey: 'tabMinute', minute: true },
      { id: 'day', labelKey: 'tabDay' },
      { id: 'week', labelKey: 'tabWeek' },
      { id: 'month', labelKey: 'tabMonth' },
    ]

    function Detail(props) {
      const { quote, t, onClose, cycle } = props
      const trend = trendClass(quote.changePct)
      const tabs = DETAIL_TABS.filter((tab) => {
        if (tab.id === 'trend') return quote.market !== 'us'
        if (tab.minute) return quote.market === 'cn'
        return true
      })
      const [tab, setTab] = useState(tabs[0]?.id ?? 'day')
      const [series, setSeries] = useState({})
      const [retryToken, setRetryToken] = useState(0)
      const seriesRef = useRef(series)
      seriesRef.current = series
      const current = series[tab]
      const retry = () => {
        setSeries((currentSeries) => {
          const next = { ...currentSeries }
          delete next[tab]
          return next
        })
        setRetryToken((token) => token + 1)
      }

      // `cycle` is the quote poll counter: it re-runs this effect without making
      // every finished fetch re-trigger itself. An entry is reused until it is a
      // failed one (retried on demand) or an intraday line older than 30 s, since
      // a frozen 分时 line beside a live price is worse than a reload.
      useEffect(() => {
        const entry = seriesRef.current[tab]
        const force = retryToken > 0
        if (entry && !force) {
          if (!entry.ok) return undefined
          if (!(tab === 'trend' && Date.now() - entry.at > 30_000)) return undefined
        }
        let cancelled = false
        ;(async () => {
          try {
            const payload =
              tab === 'trend'
                ? await fetchJson(`/trend?symbol=${encodeURIComponent(quote.symbol)}${force || entry ? '&refresh=1' : ''}`)
                : await fetchJson(
                    `/kline?symbol=${encodeURIComponent(quote.symbol)}&period=${tab}&adjust=qfq&limit=${tab === 'm5' ? 96 : 60}${force || entry ? '&refresh=1' : ''}`,
                  )
            if (cancelled) return
            setSeries((currentSeries) => ({ ...currentSeries, [tab]: { ok: true, at: Date.now(), payload } }))
          } catch (failure) {
            if (cancelled) return
            setSeries((currentSeries) => ({
              ...currentSeries,
              [tab]: { ok: false, at: Date.now(), error: String(failure?.message ?? failure) },
            }))
          }
        })()
        return () => {
          cancelled = true
        }
      }, [quote.symbol, tab, cycle, retryToken])

      const chart = (() => {
        if (!current) return h('div', { className: 'dshst-note' }, t('loading'))
        if (!current.ok) {
          return h(
            'div',
            { className: 'dshst-note dshst-error' },
            `${current.error} `,
            h('button', { type: 'button', className: 'dshst-link', onClick: retry }, t('retry')),
          )
        }
        if (tab !== 'trend' && (!Array.isArray(current.payload.rows) || current.payload.rows.length === 0)) {
          return h(
            'div',
            { className: 'dshst-note' },
            `${t('noKline')} `,
            h('button', { type: 'button', className: 'dshst-link', onClick: retry }, t('retry')),
          )
        }
        if (tab === 'trend') {
          return h(TrendChart, {
            points: current.payload.points,
            prevClose: current.payload.prevClose,
            up: quote.changePct >= 0 ? 'var(--dshst-up)' : 'var(--dshst-down)',
            label: `${quote.name ?? quote.symbol} ${t('tabTrend')}`,
          })
        }
        return h(Candles, {
          rows: current.payload.rows,
          width: 640,
          height: 118,
          block: true,
          grid: true,
          label: `${quote.name ?? quote.symbol} ${t(tab === 'm5' ? 'tabMinute' : tab === 'day' ? 'tabDay' : tab === 'week' ? 'tabWeek' : 'tabMonth')}`,
          emptyLabel: t('noKline'),
        })
      })()

      return h(
        'div',
        { className: 'dshst-detail' },
        h(
          'div',
          { className: 'dshst-detailHead' },
          h('span', { className: 'dshst-detailName' }, quote.name ?? quote.symbol),
          h('span', { className: 'dshst-code', title: quote.symbol }, displayCode(quote)),
          h('span', { className: `dshst-detailPrice ${trend}` }, formatPrice(quote.price)),
          h(
            'span',
            { className: `dshst-detailChg ${trend}` },
            `${quote.change === null ? '--' : `${quote.change > 0 ? '+' : ''}${formatPrice(quote.change)}`}  ${formatPct(quote.changePct)}`,
          ),
          limitLabel(quote, t),
          h('button', { type: 'button', className: 'dshst-detailClose', onClick: onClose }, t('close')),
        ),
        h(
          'div',
          { className: 'dshst-tabs', role: 'tablist' },
          ...tabs.map((item) =>
            h(
              'button',
              {
                key: item.id,
                type: 'button',
                role: 'tab',
                className: 'dshst-tab',
                'data-active': tab === item.id ? 'true' : 'false',
                'aria-selected': tab === item.id ? 'true' : 'false',
                onClick: () => {
                  setTab(item.id)
                  setRetryToken(0)
                },
              },
              t(item.labelKey),
            ),
          ),
        ),
        chart,
        h(StatChips, { quote, t }),
        h(OrderBook, { depth: quote.depth, prevClose: quote.prevClose, t }),
      )
    }

    function SymbolForm(props) {
      const { t, symbols, onDone } = props
      const [text, setText] = useState(symbols.length > 0 ? symbols.join('\n') : '')
      const [ready, setReady] = useState(symbols.length > 0)
      const [saving, setSaving] = useState(false)
      const [error, setError] = useState('')

      // The strip can open this form before its first quote answer arrived, so an
      // empty textarea must never be able to overwrite the saved list: ask the
      // Host for the current list and keep saving disabled until it answers.
      useEffect(() => {
        if (ready) return undefined
        let cancelled = false
        ;(async () => {
          try {
            const response = await fetch(`${ENDPOINT}/settings`, {
              headers: { Accept: 'application/json' },
              cache: 'no-store',
              signal: AbortSignal.timeout(9000),
            })
            const payload = await response.json().catch(() => null)
            const list = payload?.settings?.symbols
            if (!cancelled && Array.isArray(list) && list.length > 0) setText(list.join('\n'))
          } catch {
            /* keep the empty box; typing a fresh list still works */
          }
          if (!cancelled) setReady(true)
        })()
        return () => {
          cancelled = true
        }
      }, [ready])

      const submit = useCallback(async () => {
        const items = text
          .split(/[\s,，;；、]+/)
          .map((item) => item.trim())
          .filter(Boolean)
        if (items.length === 0) {
          setError(t('emptySymbols'))
          return
        }
        const normalized = []
        const unknown = []
        for (const item of items) {
          const symbol = normalizeSymbolText(item)
          if (!symbol) unknown.push(item)
          else if (!normalized.includes(symbol)) normalized.push(symbol)
        }
        if (unknown.length > 0) {
          setError(`${t('unrecognized')}${unknown.slice(0, 4).join('、')}`)
          return
        }
        setSaving(true)
        setError('')
        try {
          const response = await fetch(`${ENDPOINT}/config`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
            body: JSON.stringify({ symbols: normalized }),
          })
          const payload = await response.json().catch(() => ({}))
          if (!response.ok || payload.ok !== true) {
            throw new Error(describeSaveError(payload.error, response.status, t))
          }
          onDone({
            saved: true,
            symbols: Array.isArray(payload.symbols) ? payload.symbols : normalized,
            dropped: normalized.length < items.length,
          })
        } catch (failure) {
          setError(String(failure?.message ?? failure))
        } finally {
          setSaving(false)
        }
      }, [text, t, onDone])

      return h(
        'div',
        { className: 'dshst-form' },
        h('textarea', {
          className: 'dshst-textarea',
          value: text,
          spellCheck: false,
          placeholder: t('hint'),
          onChange: (event) => setText(event.target.value),
          'aria-label': t('settings'),
        }),
        h(
          'div',
          { className: 'dshst-formRow' },
          h('span', { className: 'dshst-hint' }, ready ? t('hint') : t('loading')),
          error ? h('span', { className: 'dshst-error' }, error) : null,
          h(
            'button',
            { type: 'button', className: 'dshst-button', onClick: () => onDone({ saved: false }) },
            t('cancel'),
          ),
          h(
            'button',
            {
              type: 'button',
              className: 'dshst-button',
              'data-primary': 'true',
              disabled: saving || !ready,
              onClick: submit,
            },
            saving ? t('saving') : t('save'),
          ),
        ),
      )
    }

    /* --------------------------------------------------------------- strip */

    function Ticker(props) {
      const t = props.t
      const [data, setData] = useState(null)
      const [error, setError] = useState('')
      const [loading, setLoading] = useState(true)
      const [collapsed, setCollapsed] = useState(readCollapsed)
      const [formOpen, setFormOpen] = useState(false)
      const [selected, setSelected] = useState(null)
      const [notice, setNotice] = useState('')
      const [failures, setFailures] = useState(0)
      const alive = useRef(true)
      const refreshing = useRef({ current: false, startedAt: 0 })
      const noticeTimer = useRef(0)

      // React replays effects in development, so the flag must be raised on every
      // setup rather than once at ref construction.
      useEffect(() => {
        alive.current = true
        return () => {
          alive.current = false
          window.clearTimeout(noticeTimer.current)
        }
      }, [])

      const flashNotice = useCallback((message) => {
        setNotice(message)
        window.clearTimeout(noticeTimer.current)
        noticeTimer.current = window.setTimeout(() => setNotice(''), 6000)
      }, [])

      const load = useCallback(async () => {
        if (typeof document !== 'undefined' && document.hidden) return
        // A request that never settles must not freeze every later tick.
        if (refreshing.current && Date.now() - refreshing.startedAt < 20_000) return
        refreshing.current = true
        refreshing.startedAt = Date.now()
        try {
          const response = await fetch(`${ENDPOINT}/quotes`, {
            headers: { Accept: 'application/json' },
            cache: 'no-store',
            signal: AbortSignal.timeout(9000),
          })
          const payload = await response.json().catch(() => null)
          if (!response.ok || payload?.ok !== true) {
            throw new Error(payload?.error || `HTTP ${response.status}`)
          }
          if (!alive.current) return
          setData(payload)
          setError('')
          setFailures(0)
        } catch (failure) {
          if (!alive.current) return
          setError(describeLoadError(failure, t))
          setFailures((count) => count + 1)
        } finally {
          refreshing.current = false
          if (alive.current) setLoading(false)
        }
      }, [t])

      useEffect(() => {
        load()
      }, [load])

      const refreshSeconds = data?.settings?.refreshSeconds
      const serverInterval = data?.session?.intervalMs
      // The Host already widens the interval outside trading hours; consecutive
      // failures stretch it further so a dead endpoint is not hammered.
      const baseInterval =
        typeof serverInterval === 'number'
          ? serverInterval
          : Math.max(5, typeof refreshSeconds === 'number' ? refreshSeconds : 15) * 1000
      const delay = Math.min(120_000, Math.max(5_000, baseInterval * (failures === 0 ? 1 : Math.min(2 ** failures, 8))))
      useEffect(() => {
        if (formOpen) return undefined
        const timer = window.setInterval(load, delay)
        const onVisible = () => {
          if (!document.hidden) load()
        }
        document.addEventListener('visibilitychange', onVisible)
        return () => {
          window.clearInterval(timer)
          document.removeEventListener('visibilitychange', onVisible)
        }
      }, [load, delay, formOpen])

      const quotes = Array.isArray(data?.quotes) ? data.quotes : []
      const symbols = useMemo(
        () => (Array.isArray(data?.symbols) ? data.symbols : []),
        [data?.symbols],
      )
      const activeQuote = useMemo(
        () => quotes.find((quote) => quote.symbol === selected && !quote.error) ?? null,
        [quotes, selected],
      )
      const colorMode = data?.settings?.colorMode === 'intl' ? 'intl' : 'cn'

      const toggleCollapsed = () => {
        const next = !collapsed
        writeCollapsed(next)
        setCollapsed(next)
      }

      const body = (() => {
        if (formOpen) {
          return h(SymbolForm, {
            t,
            symbols,
            onDone: (result) => {
              setFormOpen(false)
              if (!result?.saved) return
              flashNotice(`${t('saved')} ${result.symbols.join(' ')}`)
              setSelected(null)
              load()
              window.setTimeout(load, 1500)
            },
          })
        }
        if (loading && !data) return h('div', { className: 'dshst-note' }, t('loading'))
        if (error && !data) {
          return h(
            'div',
            { className: 'dshst-note dshst-error' },
            `${t('unavailable')} · ${error} `,
            h('button', { type: 'button', className: 'dshst-link', onClick: load }, t('retry')),
          )
        }
        if (quotes.length === 0) {
          return h(
            'div',
            { className: 'dshst-note' },
            `${t('noSymbols')} `,
            h(
              'button',
              { type: 'button', className: 'dshst-link', onClick: () => setFormOpen(true) },
              t('settings'),
            ),
          )
        }
        return h(
          React.Fragment,
          null,
          h(
            'div',
            { className: 'dshst-strip' },
            ...quotes.map((quote) =>
              h(QuoteCard, {
                key: quote.symbol,
                quote,
                t,
                selected: selected === quote.symbol,
                onSelect: () => setSelected((current) => (current === quote.symbol ? null : quote.symbol)),
              }),
            ),
          ),
          activeQuote
            ? h(Detail, {
                // Remount per symbol: the tab being open must not leak the previous
                // symbol's fetched series into the next one.
                key: activeQuote.symbol,
                quote: activeQuote,
                t,
                cycle: data?.updatedAt,
                onClose: () => setSelected(null),
              })
            : null,
        )
      })()

      return h(
        'div',
        { className: 'dshst', 'data-scheme': colorMode, 'data-plugin': 'stock-ticker' },
        h('style', null, CSS),
        h(
          'div',
          { className: 'dshst-live', 'aria-live': 'polite', role: 'status' },
          notice || (error && !data ? error : ''),
        ),
        h(
          'div',
          { className: 'dshst-head' },
          h('span', { className: 'dshst-title' }, t('title')),
          data?.source ? h('span', { className: 'dshst-chip' }, data.source === 'sina' ? t('sourceSina') : t('sourceTencent')) : null,
          data?.session ? h('span', { className: 'dshst-chip' }, sessionLabel(t, data.session)) : null,
          h('span', { className: 'dshst-chip', title: 'stock-ticker build' }, BUILD),
          data?.updatedAt ? h('span', { className: 'dshst-meta' }, formatClock(data.updatedAt)) : null,
          error && data
            ? h(
                'span',
                { className: 'dshst-meta dshst-error', title: error },
                `${t('staleData')} · `,
                h('button', { type: 'button', className: 'dshst-link', onClick: load }, t('retry')),
              )
            : null,
          notice ? h('span', { className: 'dshst-meta dshst-notice' }, notice) : null,
          h('span', { className: 'dshst-spacer' }),
          h(
            'button',
            {
              type: 'button',
              className: 'dshst-icon',
              title: t('refresh'),
              'aria-label': t('refresh'),
              onClick: load,
            },
            h(
              'svg',
              { width: 14, height: 14, viewBox: '0 0 16 16', 'aria-hidden': true },
              h('path', {
                d: 'M12.5 8a4.5 4.5 0 1 1-1.5-3.35',
                fill: 'none',
                stroke: 'currentColor',
                strokeWidth: 1.5,
                strokeLinecap: 'round',
              }),
              h('path', {
                d: 'M11.6 1.7v3.2H8.4',
                fill: 'none',
                stroke: 'currentColor',
                strokeWidth: 1.5,
                strokeLinecap: 'round',
                strokeLinejoin: 'round',
              }),
            ),
          ),
          h(
            'button',
            {
              type: 'button',
              className: 'dshst-icon',
              title: t('settings'),
              'aria-label': t('settings'),
              'aria-expanded': formOpen && !collapsed ? 'true' : 'false',
              onClick: () => {
                // Opening the form from the collapsed header must also unfold the
                // strip; otherwise the click looks like it did nothing.
                if (collapsed) {
                  writeCollapsed(false)
                  setCollapsed(false)
                }
                setFormOpen((current) => !current)
              },
            },
            h(
              'svg',
              { width: 14, height: 14, viewBox: '0 0 16 16', 'aria-hidden': true },
              h('line', { x1: 2.5, y1: 4.5, x2: 13.5, y2: 4.5, stroke: 'currentColor', strokeWidth: 1.3, strokeLinecap: 'round' }),
              h('circle', { cx: 10.5, cy: 4.5, r: 1.9, fill: 'currentColor' }),
              h('line', { x1: 2.5, y1: 8, x2: 13.5, y2: 8, stroke: 'currentColor', strokeWidth: 1.3, strokeLinecap: 'round' }),
              h('circle', { cx: 5.5, cy: 8, r: 1.9, fill: 'currentColor' }),
              h('line', { x1: 2.5, y1: 11.5, x2: 13.5, y2: 11.5, stroke: 'currentColor', strokeWidth: 1.3, strokeLinecap: 'round' }),
              h('circle', { cx: 11.5, cy: 11.5, r: 1.9, fill: 'currentColor' }),
            ),
          ),
          h(
            'button',
            {
              type: 'button',
              className: 'dshst-icon',
              title: collapsed ? t('expand') : t('collapse'),
              'aria-label': collapsed ? t('expand') : t('collapse'),
              'aria-expanded': collapsed ? 'false' : 'true',
              onClick: toggleCollapsed,
            },
            h(
              'svg',
              {
                width: 14,
                height: 14,
                viewBox: '0 0 16 16',
                'aria-hidden': true,
                style: { transform: collapsed ? 'rotate(180deg)' : 'none' },
              },
              h('path', {
                d: 'M4 6.5 8 10.5l4-4',
                fill: 'none',
                stroke: 'currentColor',
                strokeWidth: 1.6,
                strokeLinecap: 'round',
                strokeLinejoin: 'round',
              }),
            ),
          ),
        ),
        collapsed ? null : body,
      )
    }

    return {
      inject: ['slots'],
      apply(ctx) {
        // The strip must appear even when the dictionary registry is unavailable
        // or rejects a registration, so localization is best-effort only.
        let translate = (key) => DICT_ZH[key] ?? key
        const locale = typeof ctx.get === 'function' ? ctx.get('locale') : undefined
        if (locale) {
          try {
            ctx.effect(() => locale.register(NS, 'zh', DICT_ZH), 'stock-ticker:locale-zh')
            ctx.effect(() => locale.register(NS, 'en', DICT_EN), 'stock-ticker:locale-en')
            translate = locale.bind(NS)
          } catch (failure) {
            console.error('[stock-ticker] locale registration failed', failure)
          }
        }

        ctx.slots.inject('conversation.composer.dock', () =>
          ctx.slots.register(
            {
              name: 'conversation.composer.dock',
              id: 'stock-ticker',
              order: 5,
              label: () => translate('title'),
            },
            (slotProps) => h(Ticker, { ...slotProps, t: translate }),
          ),
        )
      },
    }
  },
})
