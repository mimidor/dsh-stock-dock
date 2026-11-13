/**
 * Client half of the stock ticker bundle: a compact quote strip under the
 * composer, plus the optional sidebar page and the plugin settings card.
 *
 * All data comes from the package's Host half over same-origin routes under
 * `/dsh-stock-ticker`; the only module this file requires is `react`, because
 * the browser module table exposes nothing else and reaching into DSH internals
 * is forbidden for workspace bundles.
 */

window.__ModuleLoader__.load({
  id: '@local/dsh-stock-ticker',
  factory(require) {
    const React = require('react')
    const h = React.createElement
    const { useCallback, useEffect, useMemo, useRef, useState } = React

    const NS = 'stockTicker'
    const BUILD = 'v1.8.3'
    const ENDPOINT = '/dsh-stock-ticker'
    const COLLAPSE_KEY = 'dsh-stock-ticker:collapsed'
    const STYLE_ID = 'stock-ticker'
    /** Mini charts change once a day; five minutes is already generous. */
    const SPARK_TTL_MS = 5 * 60 * 1000

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
      configNotWritable: '当前 profile 不允许保存该配置，已改存到插件数据文件。',
      saved: '已保存，正在更新…',
      savedCount: '已保存 {n} 个标的',
      savedDropped: '（忽略 {n} 个）',
      unitWan: '万',
      unitYi: '亿',
      unitWanYi: '万亿',
      bookBuy: '买',
      bookSell: '卖',
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
      tabM15: '15分',
      tabM30: '30分',
      tabM60: '60分',
      tabDay: '日K',
      tabWeek: '周K',
      tabMonth: '月K',
      orderBook: '五档盘口',
      orderRatio: '委比',
      amount: '成交额',
      turnover: '换手',
      volumeRatio: '量比',
      volumeCompare: '同期量比',
      volumeExpand: '放量',
      volumeShrink: '缩量',
      volumeFlat: '平量',
      volumeBaseline: '前{n}日均量',
      volumeBaselinePrev: '昨日同期量',
      volumePrev: '昨',
      amplitude: '振幅',
      marketCap: '市值',
      limitUp: '涨停',
      limitDown: '跌停',
      sourceTencent: '腾讯',
      sourceSina: '新浪',
      sourceEastmoney: '东财',
      sourceCache: '缓存',
      sessionTrading: '盘中',
      sessionBreak: '休市',
      sessionClosed: '收盘',
      sessionWeekend: '周末',
      sessionHoliday: '节假日',
      staleData: '数据可能不是最新',
      search: '搜索',
      searchPlaceholder: '代码 / 名称 / 拼音，如 600519、茅台、gzmt',
      searching: '搜索中…',
      searchEmpty: '没有匹配的标的',
      addSymbol: '添加',
      alerts: '预警',
      alertAdd: '添加预警',
      alertAbove: '上破',
      alertBelow: '下破',
      alertPrice: '价格',
      alertArmed: '待触发',
      alertFired: '已触发',
      alertAck: '知道了',
      alertEmpty: '还没有设置预警',
      alertRemove: '删除',
      alertHit: '{name} 触发预警：{op} {price}',
      alertNeedPrice: '请填写有效的预警价',
      holding: '持仓',
      shares: '股数',
      cost: '成本',
      marketValue: '市值',
      pnl: '浮动盈亏',
      saveHolding: '保存持仓',
      removeHolding: '清除持仓',
      holdingHint: '填股数与成本价，图上会画出成本线',
      holdingBad: '股数和成本都要大于 0',
      groups: '分组',
      newGroup: '新建分组',
      groupName: '分组名',
      deleteGroup: '删除分组',
      settingsTitle: '行情条',
      refreshSeconds: '刷新间隔（秒）',
      klineDays: '迷你K线根数',
      miniChartType: '迷你图类型',
      miniIntraday: '分时线',
      miniDay: '日K',
      miniWeek: '周K',
      miniMonth: '月K',
      colorMode: '配色',
      colorCn: '红涨绿跌',
      colorIntl: '绿涨红跌',
      defaultPeriod: '默认周期',
      defaultTrendDays: '默认分时天数',
      showMA: '显示均线',
      showVolume: '显示成交量',
      alertToast: '预警弹提示',
      sourceDot: '标记每张卡的数据源',
      savePrefs: '保存设置',
      prefsSaved: '已保存',
      periodTrend: '分时',
      adjust: '复权',
      adjustQfq: '前复权',
      adjustHfq: '后复权',
      adjustNone: '不复权',
      days: '日',
      ma: '均线',
      volume: '量',
      holidayNote: '非交易日',
      sidebarTitle: '行情',
      groupDefault: '自选',
      confirm: '确认',
      dismiss: '忽略',
      openSettings: '打开设置',
      hostMissing: '行情服务未加载，刷新页面或重启 DSH 后再试',
      remove: '移除',
      quickAdd: '添加标的',
      trades: '流水',
      buy: '买入',
      sell: '卖出',
      tradePrice: '价格',
      tradeFee: '手续费',
      tradeDate: '日期',
      saveTrade: '记一笔',
      syncFromTrades: '按流水同步持仓',
      tradesEmpty: '还没有流水',
      realized: '已实现',
      fees: '手续费合计',
      tradeHint: '记买卖流水后，可按加权平均成本反推持仓',
      addMarketGroup: '添加大盘分组',
      preset: '预置',
      deleteTrade: '删除',
      dataSource: '数据源',
      sourceAuto: '自动（腾讯 → 新浪 → 东财）',
      showMiniChart: '显示迷你图',
      showOrderBook: '显示五档盘口',
      showStats: '显示指标行',
      showExtended: '显示美股盘前 / 盘后',
      premarket: '盘前',
      afterHours: '盘后',
      premarketShort: '前',
      afterHoursShort: '后',
      settingsHint: '改动立即生效，保存在插件数据文件',
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
      configNotWritable: 'This profile cannot save the profile config; the list was stored in the plugin data file instead.',
      saved: 'Saved, updating…',
      savedCount: 'Saved {n} symbols',
      savedDropped: ' ({n} skipped)',
      unitWan: '10K',
      unitYi: '100M',
      unitWanYi: 'T',
      bookBuy: 'Bid',
      bookSell: 'Ask',
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
      tabM15: '15m',
      tabM30: '30m',
      tabM60: '60m',
      tabDay: 'Daily',
      tabWeek: 'Weekly',
      tabMonth: 'Monthly',
      orderBook: 'Order book',
      orderRatio: 'Ratio',
      amount: 'Turnover',
      turnover: 'Turn',
      volumeRatio: 'Vol ratio',
      volumeCompare: 'Same-time ratio',
      volumeExpand: 'Expanding',
      volumeShrink: 'Shrinking',
      volumeFlat: 'Steady',
      volumeBaseline: 'prior {n}-day avg',
      volumeBaselinePrev: 'prev session',
      volumePrev: 'prev',
      amplitude: 'Range',
      marketCap: 'Cap',
      limitUp: 'Limit up',
      limitDown: 'Limit down',
      sourceTencent: 'Tencent',
      sourceSina: 'Sina',
      sourceEastmoney: 'Eastmoney',
      sourceCache: 'cache',
      sessionTrading: 'Live',
      sessionBreak: 'Break',
      sessionClosed: 'Closed',
      sessionWeekend: 'Weekend',
      sessionHoliday: 'Holiday',
      staleData: 'Data may be stale',
      search: 'Search',
      searchPlaceholder: 'Code, name or pinyin, e.g. 600519, maotai, gzmt',
      searching: 'Searching…',
      searchEmpty: 'No matching security',
      addSymbol: 'Add',
      alerts: 'Alerts',
      alertAdd: 'Add alert',
      alertAbove: 'Above',
      alertBelow: 'Below',
      alertPrice: 'Price',
      alertArmed: 'Armed',
      alertFired: 'Triggered',
      alertAck: 'Got it',
      alertEmpty: 'No alerts yet',
      alertRemove: 'Delete',
      alertHit: '{name} alert: {op} {price}',
      alertNeedPrice: 'Enter a valid alert price',
      holding: 'Position',
      shares: 'Shares',
      cost: 'Cost',
      marketValue: 'Value',
      pnl: 'P/L',
      saveHolding: 'Save position',
      removeHolding: 'Clear position',
      holdingHint: 'Shares and cost draw the cost line on the chart',
      holdingBad: 'Shares and cost must be greater than 0',
      groups: 'Groups',
      newGroup: 'New group',
      groupName: 'Group name',
      deleteGroup: 'Delete group',
      settingsTitle: 'Quote strip',
      refreshSeconds: 'Refresh seconds',
      klineDays: 'Mini chart bars',
      miniChartType: 'Mini chart type',
      miniIntraday: 'Intraday line',
      miniDay: 'Daily',
      miniWeek: 'Weekly',
      miniMonth: 'Monthly',
      colorMode: 'Colours',
      colorCn: 'Red up / green down',
      colorIntl: 'Green up / red down',
      defaultPeriod: 'Default period',
      defaultTrendDays: 'Default intraday days',
      showMA: 'Show moving averages',
      showVolume: 'Show volume',
      alertToast: 'Toast on alert',
      sourceDot: 'Mark each card’s source',
      savePrefs: 'Save settings',
      prefsSaved: 'Saved',
      periodTrend: 'Intraday',
      adjust: 'Adjust',
      adjustQfq: 'Forward',
      adjustHfq: 'Backward',
      adjustNone: 'Raw',
      days: 'd',
      ma: 'MA',
      volume: 'Vol',
      holidayNote: 'Market holiday',
      sidebarTitle: 'Quotes',
      groupDefault: 'Watchlist',
      confirm: 'Confirm',
      dismiss: 'Dismiss',
      openSettings: 'Open settings',
      hostMissing: 'The quote service is not loaded; reload the page or restart DSH',
      remove: 'Remove',
      quickAdd: 'Add symbol',
      trades: 'Trades',
      buy: 'Buy',
      sell: 'Sell',
      tradePrice: 'Price',
      tradeFee: 'Fee',
      tradeDate: 'Date',
      saveTrade: 'Record',
      syncFromTrades: 'Rebuild position from trades',
      tradesEmpty: 'No trades yet',
      realized: 'Realised',
      fees: 'Fees',
      tradeHint: 'Record buys and sells, then rebuild the position from the weighted-average cost',
      addMarketGroup: 'Add market group',
      preset: 'Preset',
      deleteTrade: 'Delete',
      dataSource: 'Data source',
      sourceAuto: 'Auto (Tencent → Sina → Eastmoney)',
      showMiniChart: 'Show mini chart',
      showOrderBook: 'Show order book',
      showStats: 'Show metrics row',
      showExtended: 'Show US pre/post market',
      premarket: 'Pre',
      afterHours: 'After',
      premarketShort: 'Pre',
      afterHoursShort: 'AH',
      settingsHint: 'Changes apply immediately and are stored in the plugin data file',
    }

    const CSS = `
.dshst {
  --dshst-up: var(--dsw-alias-state-error-primary);
  --dshst-down: color-mix(in srgb, var(--dsw-alias-state-success-primary) 68%, var(--dsw-alias-label-primary));
  --dshst-ease: cubic-bezier(0.2, 0, 0, 1);
  --dshst-dur: 160ms;
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
.dshst[data-variant="sidebar"] {
  height: 100%;
  min-height: 0;
  overflow-y: auto;
  padding: 8px 10px 12px;
}
.dshst-head {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 20px;
  color: var(--dsw-alias-label-secondary);
  flex-wrap: wrap;
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
  gap: 2px;
  min-width: 20px;
  height: 20px;
  padding: 0 3px;
  border: 1px solid transparent;
  border-radius: 6px;
  background: transparent;
  color: var(--dsw-alias-label-secondary);
  font: inherit;
  font-size: 11px;
  cursor: pointer;
  transition: color var(--dshst-dur) var(--dshst-ease), background-color var(--dshst-dur) var(--dshst-ease),
    border-color var(--dshst-dur) var(--dshst-ease);
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
/* A quote app's refresh affordance: the icon turns while a fetch is in flight,
   for both the manual button and the poll, so "is it live?" is visible. */
.dshst-refresh svg {
  transform-origin: center;
}
.dshst-refresh[data-busy="true"] {
  color: var(--dsw-alias-brand-primary);
}
.dshst-refresh[data-busy="true"] svg {
  animation: dshst-spin 700ms linear infinite;
}
@keyframes dshst-spin {
  to { transform: rotate(360deg); }
}
@keyframes dshst-fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}
@keyframes dshst-panel-in {
  from { opacity: 0; transform: translateY(4px); }
  to { opacity: 1; transform: none; }
}
@media (prefers-reduced-motion: reduce) {
  .dshst-refresh[data-busy="true"] svg,
  .dshst-chart,
  .dshst-miniLine,
  .dshst-readout,
  .dshst-detail,
  .dshst-toast,
  .dshst-form,
  .dshst-settings {
    animation: none;
  }
}
.dshst-strip {
  display: flex;
  gap: 6px;
  overflow-x: auto;
  overscroll-behavior-x: contain;
  /* The 3 px custom track below the cards is the only scrollbar; a native one
     would be drawn over the price row on macOS. The padding reserves its room. */
  padding-bottom: 6px;
  scrollbar-width: none;
}
.dshst-strip::-webkit-scrollbar {
  display: none;
  width: 0;
  height: 0;
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
  transition: background-color var(--dshst-dur) var(--dshst-ease), border-color var(--dshst-dur) var(--dshst-ease),
    box-shadow var(--dshst-dur) var(--dshst-ease);
}
.dshst-card:hover {
  border-color: color-mix(in srgb, var(--dsw-alias-brand-primary) 45%, var(--dsw-alias-border-l2));
  background: var(--dsw-alias-interactive-bg-hover);
  box-shadow: var(--dsw-elevation-soft, 0 2px 8px rgba(0, 0, 0, 0.06));
}
.dshst-card[data-selected="true"] {
  border-color: var(--dsw-alias-brand-primary);
  background: color-mix(in srgb, var(--dsw-alias-brand-primary) 6%, var(--dsw-alias-bg-layer-1));
  box-shadow: inset 0 0 0 1px var(--dsw-alias-brand-primary), var(--dsw-elevation-soft, 0 2px 8px rgba(0, 0, 0, 0.06));
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
  display: inline-flex;
  align-items: center;
  gap: 3px;
  font-size: 10px;
  font-variant-numeric: tabular-nums;
  color: var(--dsw-alias-label-secondary);
}
.dshst-src {
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: var(--dsw-alias-label-secondary);
  flex: 0 0 auto;
}
.dshst-src[data-source="sina"] { background: var(--dsw-alias-state-warn-primary); }
.dshst-src[data-source="eastmoney"] { background: var(--dsw-alias-brand-primary); }
.dshst-src[data-source="cache"] { background: var(--dsw-alias-border-l2); }
.dshst-quote {
  display: flex;
  flex-direction: column;
  gap: 1px;
  margin-left: auto;
  text-align: right;
  font-variant-numeric: tabular-nums;
  position: relative;
}
/* A quote app's tick cue: the price and percent highlight briefly when their
   displayed values change; the highlight is a pseudo-element so no text moves. */
.dshst-quote::before {
  content: "";
  position: absolute;
  inset: -1px -4px;
  border-radius: 4px;
  background: var(--dsw-alias-brand-primary);
  opacity: 0;
  pointer-events: none;
  z-index: 0;
  animation: dshst-quote-flash 700ms ease-out;
}
.dshst-quote > span {
  position: relative;
  z-index: 1;
}
@keyframes dshst-quote-flash {
  from { opacity: 0.22; }
  to { opacity: 0; }
}
/* The quote cue is a short opacity fade, not motion; keep it for reduced
   motion. Only the rotating spinner is removed below. */
.dshst-price { font-size: 13px; font-weight: 600; }
.dshst-chg { font-size: 11px; }
.dshst-up { color: var(--dshst-up); }
.dshst-down { color: var(--dshst-down); }
.dshst-flat { color: var(--dsw-alias-label-secondary); }
.dshst-chart { display: block; flex: 0 0 auto; animation: dshst-fade-in 220ms var(--dshst-ease); }
.dshst-miniLine { display: block; flex: 0 0 auto; animation: dshst-fade-in 220ms var(--dshst-ease); }
.dshst-chartWrap { position: relative; width: 100%; }
.dshst-chartNote {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0 2px;
  color: var(--dsw-alias-label-secondary);
  font-size: 10px;
  font-variant-numeric: tabular-nums;
}
.dshst-chartNote b { color: var(--dsw-alias-label-primary); font-weight: 600; }
.dshst-volumeSignal { font-weight: 600; }
.dshst-volumeSignal[data-trend="up"] { color: var(--dsw-alias-state-warn-primary); }
.dshst-volumeSignal[data-trend="down"],
.dshst-volumeSignal[data-trend="flat"] { color: var(--dsw-alias-label-secondary); }
.dshst-baselineSwatch {
  width: 14px;
  height: 0;
  border-top: 1px dashed var(--dsw-alias-label-secondary);
  opacity: 0.8;
}
.dshst-readout {
  position: absolute;
  top: 2px;
  left: 4px;
  padding: 1px 5px;
  border-radius: 4px;
  background: color-mix(in srgb, var(--dsw-alias-bg-layer-1) 80%, transparent);
  font-size: 10px;
  font-variant-numeric: tabular-nums;
  color: var(--dsw-alias-label-secondary);
  pointer-events: none;
  white-space: nowrap;
  animation: dshst-fade-in 120ms var(--dshst-ease);
}
.dshst-chartEmpty {
  display: block;
  flex: 0 0 auto;
  border: 1px dashed var(--dsw-alias-border-l2);
  border-radius: 3px;
}
.dshst-detail {
  display: flex;
  flex-direction: column;
  gap: 5px;
  max-height: min(52vh, 420px);
  overflow-y: auto;
  padding: 7px 10px 8px;
  border: 1px solid var(--dsw-alias-border-l1);
  border-radius: 10px;
  background: var(--dsw-alias-bg-layer-1);
  box-shadow: var(--dsw-elevation-soft, 0 4px 14px rgba(0, 0, 0, 0.06));
  animation: dshst-panel-in 180ms var(--dshst-ease);
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
.dshst-toolbar { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
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
  transition: color var(--dshst-dur) var(--dshst-ease), background-color var(--dshst-dur) var(--dshst-ease),
    border-color var(--dshst-dur) var(--dshst-ease);
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
.dshst-select {
  height: 19px;
  padding: 0 2px;
  border: 1px solid var(--dsw-alias-border-l1);
  border-radius: 5px;
  background: var(--dsw-alias-bg-layer-1);
  color: var(--dsw-alias-label-secondary);
  font: inherit;
  font-size: 11px;
  transition: border-color var(--dshst-dur) var(--dshst-ease), box-shadow var(--dshst-dur) var(--dshst-ease);
}
.dshst-toggle {
  padding: 0 6px;
  border: 1px solid transparent;
  border-radius: 5px;
  background: transparent;
  color: var(--dsw-alias-label-secondary);
  font: inherit;
  font-size: 11px;
  cursor: pointer;
  transition: color var(--dshst-dur) var(--dshst-ease), background-color var(--dshst-dur) var(--dshst-ease),
    border-color var(--dshst-dur) var(--dshst-ease);
}
.dshst-toggle[data-active="true"] {
  border-color: var(--dsw-alias-border-l2);
  color: var(--dsw-alias-label-primary);
}
.dshst-seg { display: inline-flex; gap: 1px; }
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
.dshst-chip[data-tone="alert"] { color: var(--dsw-alias-state-error-primary); border-color: currentColor; }
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
  transition: color var(--dshst-dur) var(--dshst-ease), background-color var(--dshst-dur) var(--dshst-ease),
    border-color var(--dshst-dur) var(--dshst-ease);
}
.dshst-detailClose:hover {
  color: var(--dsw-alias-label-primary);
  background: var(--dsw-alias-interactive-bg-hover);
}
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
.dshst-form {
  display: flex;
  flex-direction: column;
  gap: 6px;
  animation: dshst-panel-in 180ms var(--dshst-ease);
}
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
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--dsw-alias-brand-primary) 18%, transparent);
}
.dshst-miniTypes {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  flex: 0 0 auto;
}
.dshst-icon:focus-visible,
.dshst-card:focus-visible,
.dshst-button:focus-visible,
.dshst-detailClose:focus-visible,
.dshst-link:focus-visible,
.dshst-textarea:focus-visible,
.dshst-input:focus-visible,
.dshst-select:focus-visible,
.dshst-tab:focus-visible,
.dshst-toggle:focus-visible {
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
  transition: border-color var(--dshst-dur) var(--dshst-ease), background-color var(--dshst-dur) var(--dshst-ease),
    color var(--dshst-dur) var(--dshst-ease);
}
.dshst-button:hover {
  border-color: var(--dsw-alias-border-l2);
  background: var(--dsw-alias-interactive-bg-hover);
}
.dshst-button[data-primary="true"] {
  border-color: var(--dsw-alias-brand-primary);
  background: var(--dsw-alias-brand-primary);
  color: var(--dsw-alias-bg-base);
}
.dshst-button:disabled { opacity: 0.55; cursor: default; }
.dshst-input {
  height: 24px;
  padding: 0 7px;
  border: 1px solid var(--dsw-alias-border-l1);
  border-radius: 7px;
  background: var(--dsw-alias-bg-layer-1);
  color: var(--dsw-alias-label-primary);
  font: inherit;
  font-size: 12px;
  min-width: 0;
  transition: border-color var(--dshst-dur) var(--dshst-ease), box-shadow var(--dshst-dur) var(--dshst-ease);
}
.dshst-input:focus,
.dshst-select:focus {
  outline: none;
  border-color: var(--dsw-alias-brand-primary);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--dsw-alias-brand-primary) 18%, transparent);
}
.dshst-search { display: flex; gap: 6px; align-items: center; }
.dshst-searchField { flex: 1 1 220px; }
.dshst-results {
  display: flex;
  flex-direction: column;
  gap: 1px;
  max-height: 170px;
  overflow-y: auto;
  border: 1px solid var(--dsw-alias-border-l1);
  border-radius: 8px;
  padding: 2px;
}
.dshst-result {
  display: flex;
  align-items: baseline;
  gap: 8px;
  padding: 3px 6px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
}
.dshst-result { transition: background-color var(--dshst-dur) var(--dshst-ease); }
.dshst-result:hover { background: var(--dsw-alias-interactive-bg-hover); }
.dshst-resultCode { font-size: 10px; color: var(--dsw-alias-label-secondary); font-variant-numeric: tabular-nums; }
.dshst-resultType { margin-left: auto; font-size: 10px; color: var(--dsw-alias-label-secondary); }
.dshst-groups { display: flex; gap: 4px; align-items: center; flex-wrap: wrap; }
.dshst-pill {
  padding: 0 7px;
  border: 1px solid var(--dsw-alias-border-l1);
  border-radius: 999px;
  background: transparent;
  color: var(--dsw-alias-label-secondary);
  font: inherit;
  font-size: 11px;
  line-height: 17px;
  cursor: pointer;
  transition: color var(--dshst-dur) var(--dshst-ease), background-color var(--dshst-dur) var(--dshst-ease),
    border-color var(--dshst-dur) var(--dshst-ease);
}
.dshst-pill:hover {
  border-color: var(--dsw-alias-border-l2);
  color: var(--dsw-alias-label-primary);
}
.dshst-pill[data-active="true"] {
  border-color: var(--dsw-alias-brand-primary);
  background: color-mix(in srgb, var(--dsw-alias-brand-primary) 9%, transparent);
  color: var(--dsw-alias-label-primary);
}
.dshst-alerts { display: flex; flex-direction: column; gap: 4px; }
.dshst-alertRow {
  display: flex;
  align-items: baseline;
  gap: 8px;
  font-size: 11px;
  font-variant-numeric: tabular-nums;
}
.dshst-alertRow b { font-weight: 600; }
.dshst-toast {
  animation: dshst-panel-in 180ms var(--dshst-ease);
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  padding: 3px 8px;
  border: 1px solid var(--dsw-alias-state-error-primary);
  border-radius: 8px;
  color: var(--dsw-alias-state-error-primary);
  font-size: 11px;
}
.dshst-holding {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  font-size: 11px;
  color: var(--dsw-alias-label-secondary);
  font-variant-numeric: tabular-nums;
}
.dshst-holding b { color: var(--dsw-alias-label-primary); font-weight: 600; }
.dshst-field { display: inline-flex; align-items: center; gap: 4px; font-size: 11px; color: var(--dsw-alias-label-secondary); }
.dshst-inputSmall { width: 74px; height: 20px; }
.dshst-settings {
  display: flex;
  flex-direction: column;
  gap: 8px;
  font-size: 12px;
  animation: dshst-panel-in 180ms var(--dshst-ease);
}
.dshst-settingsRow { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.dshst-settingsRow > label { min-width: 132px; color: var(--dsw-alias-label-secondary); }
.dshst-settingsGroup { display: flex; flex-direction: column; gap: 4px; }
.dshst-sidebarWrap { height: 100%; }
.dshst-scrollWrap { position: relative; }
.dshst-scrollTrack {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 3px;
  border-radius: 2px;
  background: transparent;
  opacity: 0.8;
  transition: opacity 0.15s;
  pointer-events: none;
}
.dshst-scrollWrap:hover .dshst-scrollTrack {
  opacity: 1;
  background: var(--dsw-alias-border-l1);
}
.dshst-scrollThumb {
  position: absolute;
  top: 0;
  width: 16%;
  height: 3px;
  border-radius: 2px;
  background: var(--dsw-alias-label-secondary);
  transition: left 80ms linear;
}
.dshst-addCard {
  flex: 0 0 auto;
  align-self: stretch;
  min-width: 30px;
  border: 1px dashed var(--dsw-alias-border-l2);
  border-radius: 8px;
  background: transparent;
  color: var(--dsw-alias-label-secondary);
  font: inherit;
  font-size: 16px;
  cursor: pointer;
}
.dshst-addCard {
  transition: color var(--dshst-dur) var(--dshst-ease), border-color var(--dshst-dur) var(--dshst-ease),
    background-color var(--dshst-dur) var(--dshst-ease);
}
.dshst-addCard:hover {
  color: var(--dsw-alias-label-primary);
  border-color: var(--dsw-alias-brand-primary);
  background: var(--dsw-alias-interactive-bg-hover);
}
.dshst-card { position: relative; }
.dshst-cardRemove {
  position: absolute;
  top: -6px;
  right: -6px;
  width: 16px;
  height: 16px;
  padding: 0;
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 50%;
  background: var(--dsw-alias-bg-layer-2);
  color: var(--dsw-alias-label-secondary);
  font: inherit;
  font-size: 11px;
  line-height: 14px;
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.12s;
}
.dshst-card:hover .dshst-cardRemove,
.dshst-card:focus-within .dshst-cardRemove { opacity: 1; }
.dshst-cardRemove:hover { color: var(--dsw-alias-state-error-primary); border-color: currentColor; }
.dshst-card[draggable="true"] { cursor: grab; }
.dshst-axisY {
  position: absolute;
  top: 0;
  right: 2px;
  width: 48px;
  height: 100%;
  pointer-events: none;
}
.dshst-axisY span {
  position: absolute;
  right: 0;
  padding: 1px 2px;
  border-radius: 3px;
  background: color-mix(in srgb, var(--dsw-alias-bg-layer-1) 72%, transparent);
  color: var(--dsw-alias-label-secondary);
  font-size: 9px;
  line-height: 1;
  font-variant-numeric: tabular-nums;
}
.dshst-axisX {
  display: flex;
  justify-content: space-between;
  padding: 0 2px;
  color: var(--dsw-alias-label-secondary);
  font-size: 9px;
  font-variant-numeric: tabular-nums;
}
.dshst-trades { display: flex; flex-direction: column; gap: 4px; }
.dshst-tradeRow {
  display: flex;
  align-items: baseline;
  gap: 8px;
  font-size: 11px;
  font-variant-numeric: tabular-nums;
}
.dshst-ext {
  display: inline-flex;
  align-items: baseline;
  gap: 2px;
  font-size: 9px;
  line-height: 12px;
  color: var(--dsw-alias-label-secondary);
  font-variant-numeric: tabular-nums;
}
.dshst-extTag {
  color: var(--dsw-alias-label-secondary);
}
.dshst-settingsPage {
  display: flex;
  flex-direction: column;
  gap: 10px;
  width: 100%;
  max-width: 760px;
}
.dshst-settingsHeading {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  line-height: 26px;
}
.dshst-settingsIntro {
  margin: 0;
  color: var(--dsw-alias-label-secondary);
  font-size: 12px;
}
.dshst-preset {
  padding: 0 3px;
  border: 1px solid var(--dsw-alias-border-l1);
  border-radius: 3px;
  font-size: 9px;
  color: var(--dsw-alias-label-secondary);
}
`

    /**
     * The stylesheet is injected once per page, not once per mounted component:
     * the strip and the optional sidebar tab are two instances of the same panel,
     * and rendering a `<style>` inside each would ship the 14 KB twice (and once
     * more on every HMR reload).
     */
    let styleInjected = false
    function ensureStyles() {
      if (styleInjected) return
      if (typeof document === 'undefined' || typeof document.createElement !== 'function') return
      const existing =
        typeof document.querySelector === 'function'
          ? document.querySelector(`style[data-plugin-css="${STYLE_ID}"]`)
          : null
      if (existing) {
        styleInjected = true
        return
      }
      const tag = document.createElement('style')
      tag.setAttribute('data-plugin-css', STYLE_ID)
      tag.textContent = CSS
      const host = document.head ?? document.body
      if (host && typeof host.appendChild === 'function') host.appendChild(tag)
      styleInjected = true
    }

    /* ------------------------------------------------------------- helpers */

    function priceDigits(value) {
      const abs = Math.abs(value)
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

    function describeLoadError(failure, t) {
      if (failure?.code === 'host-missing') return t('hostMissing')
      const name = failure?.name
      if (name === 'TimeoutError' || name === 'AbortError') return t('timeout')
      if (typeof TypeError !== 'undefined' && failure instanceof TypeError) return t('network')
      return String(failure?.message ?? failure)
    }

    function sessionLabel(t, session) {
      if (!session) return ''
      if (session.mode === 'trading') return t('sessionTrading')
      if (session.holiday) return t('sessionHoliday')
      if (session.weekend) return t('sessionWeekend')
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

    /**
     * One request helper for every route. HTTP 200 still carries `ok:false` for
     * upstream failures, so the body is the thing to look at.
     */
    async function api(path, options = {}) {
      const method = options.method ?? 'GET'
      const timeout = options.timeout ?? 12000
      const response = await fetch(`${ENDPOINT}${path}`, {
        method,
        headers: {
          ...(options.body === undefined
            ? { Accept: 'application/json' }
            : { 'Content-Type': 'application/json', Accept: 'application/json' }),
          ...options.headers,
        },
        body: options.body === undefined ? undefined : JSON.stringify(options.body),
        cache: options.cache ?? 'no-store',
        signal: AbortSignal.timeout(timeout),
      })
      // DSH answers 401 for a route whose plugin is not loaded; that is a
      // "host restarted, reload the page" situation, not a broken request.
      if (response.status === 401 || response.status === 403) {
        const error = new Error('host-missing')
        error.code = 'host-missing'
        throw error
      }
      if (response.status === 304) return { ok: true, notModified: true }
      const payload = await response.json().catch(() => null)
      if (!response.ok) throw new Error(payload?.error || `HTTP ${response.status}`)
      return payload ?? { ok: false, error: `HTTP ${response.status}` }
    }

    /* -------------------------------------------------------------- pieces */

    function movingAverage(rows, window) {
      const out = []
      let sum = 0
      for (let index = 0; index < rows.length; index += 1) {
        const close = rows[index].close
        sum += typeof close === 'number' ? close : 0
        if (index >= window) sum -= typeof rows[index - window].close === 'number' ? rows[index - window].close : 0
        out.push(index >= window - 1 ? sum / window : null)
      }
      return out
    }

    const MA_WINDOWS = [5, 10, 20, 60]
    const MA_COLORS = [
      'var(--dsw-alias-state-warn-primary)',
      'var(--dsw-alias-brand-primary)',
      'color-mix(in srgb, var(--dsw-alias-brand-primary) 55%, var(--dsw-alias-label-secondary))',
      'var(--dsw-alias-label-secondary)',
    ]

    /**
     * Candles with optional moving averages, an optional volume band and a hover
     * readout. The mini version on the strip draws bodies only.
     */
    function Candles(props) {
      const rows = Array.isArray(props.rows) ? props.rows : []
      const width = props.width
      const height = props.height
      const block = Boolean(props.block)
      const showMA = block && props.showMA !== false
      const showVolume = block && props.showVolume !== false
      const t = props.t ?? ((key) => key)
      const [hover, setHover] = useState(null)
      const chartStyle = block ? { width: '100%', height: `${height}px` } : { width: `${width}px`, height: `${height}px` }
      const empty = (extra) =>
        h('div', { className: 'dshst-chartEmpty', style: chartStyle, title: props.emptyLabel ?? '' }, extra)

      if (rows.length < 2) return empty()

      let min = Number.POSITIVE_INFINITY
      let max = Number.NEGATIVE_INFINITY
      for (const row of rows) {
        if (typeof row.high === 'number' && row.high > max) max = row.high
        if (typeof row.low === 'number' && row.low < min) min = row.low
      }
      if (!Number.isFinite(min) || !Number.isFinite(max)) return empty()
      // A halted or limit-locked day has every bar at the same price; the range
      // must be widened rather than reported as "no data".
      if (max <= min) {
        const pad = Math.abs(max) * 0.005 || 0.01
        min -= pad
        max += pad
      }

      const volumeBand = showVolume ? Math.round(height * 0.22) : 0
      const priceHeight = height - volumeBand
      const inset = 2
      const bottom = priceHeight - inset
      const span = max - min
      const scaleY = (value) => bottom - ((value - min) / span) * (bottom - inset)
      const step = width / rows.length
      const bodyWidth = Math.max(1, Math.min(step * 0.62, 6))

      let maxVolume = 0
      for (const row of rows) {
        if (typeof row.volume === 'number' && row.volume > maxVolume) maxVolume = row.volume
      }

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
        if (maxVolume > 0 && typeof row.volume === 'number') {
          const barHeight = Math.max(0.6, (row.volume / maxVolume) * (volumeBand - 3))
          children.push(
            h('rect', {
              key: `v${index}`,
              x: center - bodyWidth / 2,
              y: height - barHeight,
              width: bodyWidth,
              height: barHeight,
              style: { fill: color, fillOpacity: 0.55 },
            }),
          )
        }
      })

      if (showMA) {
        MA_WINDOWS.forEach((window, order) => {
          if (rows.length < window) return
          const values = movingAverage(rows, window)
          const points = values
            .map((value, index) =>
              typeof value === 'number' ? `${(step * (index + 0.5)).toFixed(1)},${scaleY(value).toFixed(1)}` : null,
            )
            .filter(Boolean)
            .join(' ')
          if (points === '') return
          children.push(
            h('polyline', {
              key: `ma${window}`,
              points,
              fill: 'none',
              style: { stroke: MA_COLORS[order] },
              strokeWidth: 1,
              vectorEffect: 'non-scaling-stroke',
              opacity: 0.9,
            }),
          )
        })
      }

      if (typeof props.holdingCost === 'number' && props.holdingCost > 0) {
        const costY = scaleY(props.holdingCost)
        if (costY >= inset && costY <= bottom) {
          children.push(
            h('line', {
              key: 'cost',
              x1: 0,
              x2: width,
              y1: costY,
              y2: costY,
              style: { stroke: 'var(--dsw-alias-state-warn-primary)', strokeDasharray: '3 3' },
              strokeWidth: 1,
              vectorEffect: 'non-scaling-stroke',
            }),
          )
        }
      }

      if (hover !== null && rows[hover]) {
        const center = step * (hover + 0.5)
        children.push(
          h('line', {
            key: 'cross',
            x1: center,
            x2: center,
            y1: inset,
            y2: height,
            style: { stroke: 'var(--dsw-alias-label-secondary)', strokeDasharray: '2 3' },
            strokeWidth: 1,
            vectorEffect: 'non-scaling-stroke',
          }),
        )
      }

      const svg = h(
        'svg',
        {
          className: 'dshst-chart',
          viewBox: `0 0 ${width} ${height}`,
          preserveAspectRatio: 'none',
          style: chartStyle,
          role: 'img',
          'aria-label': props.label ?? '',
          onMouseMove: block
            ? (event) => {
                const rect = event.currentTarget.getBoundingClientRect()
                if (!rect || rect.width <= 0) return
                const ratio = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width))
                setHover(Math.min(rows.length - 1, Math.floor(ratio * rows.length)))
              }
            : undefined,
          onMouseLeave: block ? () => setHover(null) : undefined,
        },
        children,
      )

      if (!block) return svg
      const active = hover !== null ? rows[hover] : null
      const yLabels = [max, (max + min) / 2, min].map((value) => ({
        text: formatPrice(value),
        top: (scaleY(value) / height) * 100,
      }))
      const readout = active
        ? `${active.date} ${t('open')} ${formatPrice(active.open)} ${t('high')} ${formatPrice(active.high)} ${t('low')} ${formatPrice(
            active.low,
          )} ${t('close')} ${formatPrice(active.close)}${typeof active.volume === 'number' ? ` ${t('volume')} ${shortNumber(active.volume)}` : ''}`
        : ''
      return h(
        'div',
        { className: 'dshst-chartWrap' },
        svg,
        readout ? h('span', { className: 'dshst-readout' }, readout) : null,
        h(
          'div',
          { className: 'dshst-axisY' },
          ...yLabels.map((label, index) =>
            h('span', { key: `y${index}`, style: { top: `${label.top}%`, transform: 'translateY(-50%)' } }, label.text),
          ),
        ),
        h(
          'div',
          { className: 'dshst-axisX' },
          h('span', null, rows[0]?.date ?? ''),
          h('span', null, rows[rows.length - 1]?.date ?? ''),
        ),
      )
    }

    function shortNumber(value) {
      if (typeof value !== 'number' || !Number.isFinite(value)) return '--'
      if (Math.abs(value) >= 1e8) return `${(value / 1e8).toFixed(2)}亿`
      if (Math.abs(value) >= 1e4) return `${(value / 1e4).toFixed(2)}万`
      return value.toFixed(0)
    }

    /**
     * The card-sized intraday line. Prices are already sampled by the Host, so
     * this only maps them to the 54x24 box and keeps the day's direction colour.
     */
    function MiniTrend(props) {
      const points = Array.isArray(props.points) ? props.points : []
      const width = props.width ?? 54
      const height = props.height ?? 24
      const values = points.map((point) => point.price).filter((value) => typeof value === 'number' && Number.isFinite(value))
      if (values.length < 2) {
        return h('div', { className: 'dshst-chartEmpty', style: { width, height }, title: props.emptyLabel ?? '' })
      }
      let min = Math.min(...values)
      let max = Math.max(...values)
      if (max <= min) {
        const pad = Math.abs(max) * 0.005 || 0.01
        min -= pad
        max += pad
      }
      const inset = 2
      const scaleX = (index) => (index / (points.length - 1)) * width
      const scaleY = (value) => height - inset - ((value - min) / (max - min)) * (height - inset * 2)
      const line = points
        .map((point, index) =>
          typeof point.price === 'number' ? `${scaleX(index).toFixed(1)},${scaleY(point.price).toFixed(1)}` : null,
        )
        .filter(Boolean)
      if (line.length < 2) {
        return h('div', { className: 'dshst-chartEmpty', style: { width, height }, title: props.emptyLabel ?? '' })
      }
      const color = props.up ?? 'var(--dshst-up)'
      return h(
        'svg',
        {
          className: 'dshst-miniLine',
          width,
          height,
          viewBox: `0 0 ${width} ${height}`,
          preserveAspectRatio: 'none',
          role: 'img',
          'aria-label': props.label ?? '',
        },
        h('path', {
          d: `M0,${height} L${line.join(' L')} L${width},${height} Z`,
          fill: color,
          fillOpacity: 0.12,
          stroke: 'none',
        }),
        h('path', {
          d: `M${line.join(' L')}`,
          fill: 'none',
          stroke: color,
          strokeWidth: 1.2,
          vectorEffect: 'non-scaling-stroke',
        }),
      )
    }

    function QuoteCard(props) {
      const { quote, t, index } = props
      const dragProps = {
        draggable: true,
        onDragStart: (event) => {
          try {
            event.dataTransfer?.setData('text/plain', String(index))
            if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move'
          } catch {
            /* some browsers refuse custom drag data; the drop handler falls back */
          }
        },
        onDragOver: (event) => {
          event.preventDefault?.()
          if (event.dataTransfer) event.dataTransfer.dropEffect = 'move'
        },
        onDrop: (event) => {
          event.preventDefault?.()
          event.stopPropagation?.()
          const raw = event.dataTransfer?.getData('text/plain') ?? ''
          const from = Number.parseInt(raw, 10)
          if (Number.isInteger(from)) props.onMove?.(from, index)
        },
      }

      if (quote.error) {
        return h(
          'div',
          {
            className: 'dshst-card',
            title: `${quote.symbol}: ${quote.error}`,
            'aria-label': `${quote.symbol}: ${t('noData')}`,
          },
          h('span', { className: 'dshst-cardMain' }, h('span', { className: 'dshst-name' }, quote.symbol)),
          h('span', { className: 'dshst-quote' }, h('span', { className: 'dshst-chg dshst-flat' }, t('noData'))),
          h(
            'button',
            {
              type: 'button',
              className: 'dshst-cardRemove',
              title: t('remove'),
              'aria-label': t('remove'),
              onClick: (event) => {
                event.stopPropagation?.()
                props.onRemove?.()
              },
            },
            '×',
          ),
        )
      }
      const trend = trendClass(quote.changePct)
      // Remounting the block on a displayed-value change replays the CSS flash;
      // an unchanged price keeps the same key, so a silent poll does not blink.
      const flashKey = `${formatPrice(quote.price)}|${formatPct(quote.changePct)}|${props.pulse ?? 0}`
      const armed = Array.isArray(quote.alerts) ? quote.alerts.filter((alert) => !alert.firedAt).length : 0
      const chart = props.chart && typeof props.chart === 'object' ? props.chart : null
      const rows = chart?.kind === 'candles' ? chart.rows : Array.isArray(quote.kline) ? quote.kline : []
      const miniUp =
        trend === 'dshst-up'
          ? 'var(--dshst-up)'
          : trend === 'dshst-down'
            ? 'var(--dshst-down)'
            : 'var(--dsw-alias-label-secondary)'
      return h(
        'div',
        {
          role: 'button',
          tabIndex: 0,
          className: 'dshst-card',
          'data-selected': props.selected ? 'true' : 'false',
          onClick: props.onSelect,
          onKeyDown: (event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault?.()
              props.onSelect?.()
            }
          },
          title: `${quote.name ?? quote.symbol} ${quote.code ?? ''}`.trim(),
          'aria-pressed': props.selected ? 'true' : 'false',
          ...dragProps,
        },
        h(
          'span',
          { className: 'dshst-cardMain' },
          h('span', { className: 'dshst-name' }, quote.name ?? quote.symbol),
          h(
            'span',
            { className: 'dshst-code' },
            props.sourceDot
              ? h('span', {
                  className: 'dshst-src',
                  'data-source': quote.source ?? 'tencent',
                  title: quote.source === 'sina' ? t('sourceSina') : quote.source === 'eastmoney' ? t('sourceEastmoney') : t('sourceTencent'),
                })
              : null,
            displayCode(quote),
            armed > 0 ? h('span', { className: 'dshst-limitMark dshst-flat', title: t('alerts') }, String(armed)) : null,
            props.showExtended && quote.extended
              ? h(
                  'span',
                  {
                    className: 'dshst-ext',
                    title: `${quote.extended.session === 'post' ? t('afterHours') : t('premarket')} ${formatPrice(
                      quote.extended.price,
                    )} ${formatPct(quote.extended.changePct)} ${quote.extended.time ?? ''}`.trim(),
                  },
                  h(
                    'span',
                    { className: 'dshst-extTag' },
                    quote.extended.session === 'post' ? t('afterHoursShort') : t('premarketShort'),
                  ),
                  h(
                    'span',
                    { className: trendClass(quote.extended.changePct) },
                    formatPct(quote.extended.changePct),
                  ),
                )
              : null,
            limitState(quote) === 'up' ? h('span', { className: 'dshst-limitMark dshst-up' }, t('limitUp')) : null,
            limitState(quote) === 'down' ? h('span', { className: 'dshst-limitMark dshst-down' }, t('limitDown')) : null,
          ),
        ),
        h(
          'span',
          { key: flashKey, className: 'dshst-quote' },
          h('span', { className: `dshst-price ${trend}` }, formatPrice(quote.price)),
          h('span', { className: `dshst-chg ${trend}` }, formatPct(quote.changePct)),
        ),
        props.showMiniChart === false
          ? null
          : chart?.kind === 'line'
            ? h(MiniTrend, {
                points: chart.points,
                up: miniUp,
                width: 54,
                height: 24,
                label: `${quote.name ?? quote.symbol} ${t('title')}`,
                emptyLabel: t('noKline'),
              })
            : h(Candles, {
                rows: rows.slice(-Math.min(props.previewDays ?? 20, 20)),
                width: 54,
                height: 24,
                label: `${quote.name ?? quote.symbol} ${t('title')}`,
                emptyLabel: t('noKline'),
              }),
        h(
          'button',
          {
            type: 'button',
            className: 'dshst-cardRemove',
            title: t('remove'),
            'aria-label': t('remove'),
            onClick: (event) => {
              event.stopPropagation?.()
              props.onRemove?.()
            },
          },
          '×',
        ),
      )
    }

    const COMPACT_NUMBER = (() => {
      try {
        return new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 2 })
      } catch {
        return null
      }
    })()

    const usesChineseUnits = (t) => t('unitYi') === '亿'

    function formatAmount(value, t) {
      if (typeof value !== 'number' || !Number.isFinite(value)) return '--'
      if (!usesChineseUnits(t)) return COMPACT_NUMBER ? COMPACT_NUMBER.format(value) : value.toFixed(0)
      if (Math.abs(value) >= 1e8) return `${(value / 1e8).toFixed(2)}${t('unitYi')}`
      if (Math.abs(value) >= 1e4) return `${(value / 1e4).toFixed(2)}${t('unitWan')}`
      return value.toFixed(0)
    }

    function formatCap(value, t) {
      if (typeof value !== 'number' || !Number.isFinite(value)) return '--'
      if (!usesChineseUnits(t)) return COMPACT_NUMBER ? COMPACT_NUMBER.format(value * 1e8) : value.toFixed(2)
      if (value >= 10000) return `${(value / 10000).toFixed(2)}${t('unitWanYi')}`
      return `${value.toFixed(2)}${t('unitYi')}`
    }

    /**
     * Intraday line: price, running average, previous close, cost line and one
     * separator per trading day when several days are overlaid.
     */
    function TrendChart(props) {
      const points = Array.isArray(props.points) ? props.points : []
      const prevClose = typeof props.prevClose === 'number' ? props.prevClose : null
      const baseline = Array.isArray(props.baseline) ? props.baseline : []
      const baselineAt = new Map()
      for (const point of baseline) {
        if (typeof point?.volume === 'number') baselineAt.set(point.time, point.volume)
      }
      const baselineDays = typeof props.baselineDays === 'number' ? props.baselineDays : 0
      const width = 640
      const height = 132
      const t = props.t ?? ((key) => key)
      const showVolume = props.showVolume !== false
      const [hover, setHover] = useState(null)

      if (points.length < 2) {
        return h('div', { className: 'dshst-chartEmpty', style: { width: '100%', height: `${height}px` }, title: props.emptyLabel ?? '' })
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
      if (typeof props.holdingCost === 'number' && props.holdingCost > 0) {
        min = Math.min(min, props.holdingCost)
        max = Math.max(max, props.holdingCost)
      }
      if (!Number.isFinite(min) || !Number.isFinite(max)) {
        return h('div', { className: 'dshst-chartEmpty', style: { width: '100%', height: `${height}px` }, title: props.emptyLabel ?? '' })
      }
      if (max <= min) {
        const pad = Math.abs(max) * 0.005 || 0.01
        min -= pad
        max += pad
      }
      const volumeBand = showVolume ? 26 : 0
      const priceHeight = height - volumeBand
      const inset = 6
      const scaleY = (value) => priceHeight - inset - ((value - min) / (max - min)) * (priceHeight - inset * 2)
      const scaleX = (index) => (index / (points.length - 1)) * width
      const priceLine = points.map((point, index) => `${scaleX(index).toFixed(1)},${scaleY(point.price).toFixed(1)}`).join(' ')
      const avgLine = points
        .map((point, index) => (typeof point.avg === 'number' ? `${scaleX(index).toFixed(1)},${scaleY(point.avg).toFixed(1)}` : null))
        .filter(Boolean)
        .join(' ')
      const area = `M0,${priceHeight} L${priceLine.split(' ').join(' L')} L${width},${priceHeight} Z`
      const up = props.up

      const separators = []
      for (let index = 1; index < points.length; index += 1) {
        if (points[index].day && points[index].day !== points[index - 1].day) {
          const x = scaleX(index)
          separators.push(
            h('line', {
              key: `sep${index}`,
              x1: x,
              x2: x,
              y1: 0,
              y2: height,
              style: { stroke: 'var(--dsw-alias-border-l1)' },
              strokeWidth: 1,
              vectorEffect: 'non-scaling-stroke',
            }),
          )
        }
      }

      const children = [
        h('path', { key: 'area', d: area, style: { fill: up, fillOpacity: 0.1 } }),
        prevClose !== null
          ? h('line', {
              key: 'prev',
              x1: 0,
              x2: width,
              y1: scaleY(prevClose),
              y2: scaleY(prevClose),
              style: { stroke: 'var(--dsw-alias-border-l2)', strokeDasharray: '4 4' },
              strokeWidth: 1,
              vectorEffect: 'non-scaling-stroke',
            })
          : null,
        ...separators,
        h('polyline', { key: 'price', points: priceLine, fill: 'none', style: { stroke: up }, strokeWidth: 1.4, vectorEffect: 'non-scaling-stroke' }),
        avgLine
          ? h('polyline', {
              key: 'avg',
              points: avgLine,
              fill: 'none',
              style: { stroke: 'var(--dsw-alias-label-secondary)', strokeDasharray: '3 3' },
              strokeWidth: 1,
              vectorEffect: 'non-scaling-stroke',
            })
          : null,
      ]

      if (typeof props.holdingCost === 'number' && props.holdingCost > 0) {
        children.push(
          h('line', {
            key: 'cost',
            x1: 0,
            x2: width,
            y1: scaleY(props.holdingCost),
            y2: scaleY(props.holdingCost),
            style: { stroke: 'var(--dsw-alias-state-warn-primary)', strokeDasharray: '3 3' },
            strokeWidth: 1,
            vectorEffect: 'non-scaling-stroke',
          }),
        )
      }

      if (hover !== null && points[hover]) {
        const x = scaleX(hover)
        children.push(
          h('line', {
            key: 'cross',
            x1: x,
            x2: x,
            y1: 0,
            y2: height,
            style: { stroke: 'var(--dsw-alias-label-secondary)', strokeDasharray: '2 3' },
            strokeWidth: 1,
            vectorEffect: 'non-scaling-stroke',
          }),
        )
      }

      if (showVolume) {
        let maxVolume = 0
        for (const point of points) {
          if (typeof point.volume === 'number' && point.volume > maxVolume) maxVolume = point.volume
        }
        // The baseline shares the band; scaling to both keeps a heavy prior day
        // from pushing its own line off the top.
        for (const volume of baselineAt.values()) {
          if (volume > maxVolume) maxVolume = volume
        }
        if (maxVolume > 0) {
          const barWidth = Math.max(1, width / points.length - 0.4)
          points.forEach((point, index) => {
            if (typeof point.volume !== 'number') return
            const barHeight = Math.max(0.5, (point.volume / maxVolume) * (volumeBand - 4))
            const rising = index === 0 ? true : point.price >= points[index - 1].price
            // Brighten bars that beat their same-time baseline and fade the ones
            // below it; the colour still means price direction, not volume.
            const reference = baselineAt.get(point.time)
            // Binary against yesterday at this minute: orange = more, grey =
            // less or equal. No third colour, so the volume story stays simple;
            // the price line above already carries direction.
            const above = typeof reference === 'number' && reference > 0 ? point.volume > reference : null
            const fill =
              above === null
                ? rising
                  ? up
                  : 'var(--dshst-down)'
                : above
                  ? 'var(--dsw-alias-state-warn-primary)'
                  : 'var(--dsw-alias-label-secondary)'
            const fillOpacity = above === null ? 0.5 : above ? 0.9 : 0.3
            const hovered = hover === index
            children.push(
              h('rect', {
                key: `v${index}`,
                x: (index / (points.length - 1)) * width,
                y: height - barHeight,
                width: barWidth,
                height: barHeight,
                style: {
                  fill,
                  fillOpacity: hovered ? 1 : fillOpacity,
                  ...(hovered ? { stroke: 'var(--dsw-alias-label-primary)', strokeWidth: 0.8 } : {}),
                },
              }),
            )
          })
          let path = ''
          let drawing = false
          points.forEach((point, index) => {
            const volume = baselineAt.get(point.time)
            if (typeof volume !== 'number' || volume <= 0) {
              drawing = false
              return
            }
            const x = (index / (points.length - 1)) * width
            const barHeight = Math.max(0.5, (volume / maxVolume) * (volumeBand - 4))
            path += `${drawing ? 'L' : 'M'}${x.toFixed(1)},${(height - barHeight).toFixed(1)} `
            drawing = true
          })
          if (path !== '') {
            children.push(
              h('path', {
                key: 'vbaseline',
                d: path.trim(),
                fill: 'none',
                style: { stroke: 'var(--dsw-alias-label-secondary)', strokeDasharray: '2 3', strokeOpacity: 0.8 },
                strokeWidth: 1,
                vectorEffect: 'non-scaling-stroke',
              }),
            )
          }
        }
      }

      const yLabels = [max, (max + min) / 2, min].map((level) => ({
        text:
          prevClose !== null && prevClose > 0
            ? `${((level - prevClose) / prevClose) * 100 > 0 ? '+' : ''}${(((level - prevClose) / prevClose) * 100).toFixed(2)}%`
            : formatPrice(level),
        top: (scaleY(level) / height) * 100,
      }))
      const xLabels = [points[0]?.time, points[Math.floor(points.length / 2)]?.time, points[points.length - 1]?.time]

      const active = hover !== null ? points[hover] : null
      const activeReference = active ? baselineAt.get(active.time) : undefined
      const activeRatio =
        active && typeof active.volume === 'number' && typeof activeReference === 'number' && activeReference > 0
          ? active.volume / activeReference
          : null
      const activeSignal = activeRatio === null ? null : activeRatio > 1 ? 'up' : activeRatio < 1 ? 'down' : 'flat'
      const activeLabel =
        activeSignal === 'up' ? t('volumeExpand') : activeSignal === 'down' ? t('volumeShrink') : t('volumeFlat')
      return h(
        'div',
        { className: 'dshst-chartWrap' },
        h(
          'svg',
          {
            className: 'dshst-chart',
            viewBox: `0 0 ${width} ${height}`,
            preserveAspectRatio: 'none',
            style: { width: '100%', height: `${height}px` },
            role: 'img',
            'aria-label': props.label ?? '',
            onMouseMove: (event) => {
              const rect = event.currentTarget.getBoundingClientRect()
              if (!rect || rect.width <= 0) return
              const ratio = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width))
              setHover(Math.min(points.length - 1, Math.round(ratio * (points.length - 1))))
            },
            onMouseLeave: () => setHover(null),
          },
          children,
        ),
        h(
          'div',
          { className: 'dshst-axisY' },
          ...yLabels.map((label, index) =>
            h('span', { key: `y${index}`, style: { top: `${label.top}%`, transform: 'translateY(-50%)' } }, label.text),
          ),
        ),
        h(
          'div',
          { className: 'dshst-axisX' },
          ...xLabels.map((label, index) => h('span', { key: `x${index}` }, label ?? '')),
        ),
        (() => {
          if (baselineDays < 1 || baselineAt.size === 0) return null
          const todayCum = points.reduce((sum, point) => sum + (typeof point.volume === 'number' ? point.volume : 0), 0)
          const baselineCum = points.reduce((sum, point) => sum + (baselineAt.get(point.time) ?? 0), 0)
          const ratio = baselineCum > 0 ? todayCum / baselineCum : null
          if (ratio === null) return null
          const signal = ratio >= 1.05 ? 'up' : ratio <= 0.95 ? 'down' : 'flat'
          const label = signal === 'up' ? t('volumeExpand') : signal === 'down' ? t('volumeShrink') : t('volumeFlat')
          const arrow = signal === 'up' ? '↑' : signal === 'down' ? '↓' : '→'
          return h(
            'div',
            { className: 'dshst-chartNote' },
            h('span', { className: 'dshst-volumeSignal', 'data-trend': signal }, `${label} ${arrow}`),
            h('span', null, `${t('volumeCompare')} `, h('b', null, ratio.toFixed(2))),
            h('span', { className: 'dshst-baselineSwatch', 'aria-hidden': true }),
            h(
              'span',
              null,
              baselineDays === 1
                ? t('volumeBaselinePrev')
                : t('volumeBaseline').replace('{n}', String(baselineDays)),
            ),
          )
        })(),
        active
          ? h(
              'span',
              { className: 'dshst-readout' },
              `${active.day ? `${active.day} ` : ''}${active.time} ${formatPrice(active.price)}${
                typeof active.avg === 'number' ? ` ${t('ma')} ${formatPrice(active.avg)}` : ''
              }${typeof active.volume === 'number' ? ` ${t('volume')} ${shortNumber(active.volume)}` : ''}`,
              activeSignal === null
                ? null
                : h(
                    'span',
                    { className: 'dshst-volumeSignal', 'data-trend': activeSignal },
                    ` · ${activeLabel} ${activeRatio.toFixed(2)}×`,
                  ),
              activeSignal === null ? null : ` · ${t('volumePrev')} ${shortNumber(activeReference)}`,
            )
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
            h('span', { className: 'dshst-bookLabel' }, `${kind}${levels.length - index}`),
            h('span', { className: `dshst-bookPrice ${tone}` }, formatPrice(price)),
            h('span', { className: 'dshst-bookVolume' }, typeof level.volume === 'number' ? formatAmount(level.volume, t) : '--'),
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
          ratio === null ? null : h('span', { className: ratio >= 0 ? 'dshst-up' : 'dshst-down' }, `${t('orderRatio')} ${ratio.toFixed(1)}%`),
        ),
        h('div', { className: 'dshst-bookGrid' }, side([...asks].reverse(), t('bookSell')), side(bids, t('bookBuy'))),
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
      if (quote.amount !== null && quote.amount !== undefined) chips.push([t('amount'), formatAmount(quote.amount, t)])
      if (typeof extras.turnover === 'number') chips.push([t('turnover'), `${extras.turnover.toFixed(2)}%`])
      if (typeof extras.volumeRatio === 'number') chips.push([t('volumeRatio'), extras.volumeRatio.toFixed(2)])
      if (typeof extras.amplitude === 'number') chips.push([t('amplitude'), `${extras.amplitude.toFixed(2)}%`])
      if (typeof extras.pe === 'number') chips.push(['PE', extras.pe.toFixed(2)])
      if (typeof extras.pb === 'number') chips.push(['PB', extras.pb.toFixed(2)])
      if (typeof extras.totalCap === 'number') chips.push([t('marketCap'), formatCap(extras.totalCap, t)])
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
      { id: 'm5', labelKey: 'tabMinute', kline: true },
      { id: 'm15', labelKey: 'tabM15', kline: true },
      { id: 'm30', labelKey: 'tabM30', kline: true },
      { id: 'm60', labelKey: 'tabM60', kline: true },
      { id: 'day', labelKey: 'tabDay', kline: true },
      { id: 'week', labelKey: 'tabWeek', kline: true },
      { id: 'month', labelKey: 'tabMonth', kline: true },
    ]

    const ADJUST_TABS = new Set(['day', 'week', 'month'])

    /**
     * Detail panel: chart tabs, adjust/MA/volume controls, intraday day count,
     * position editor and alerts for this symbol.
     */
    function Detail(props) {
      const { quote, t, onClose, cycle, klineDays, prefs, onPrefs, onReload } = props
      const trend = trendClass(quote.changePct)
      const tabs = DETAIL_TABS.filter((tab) => {
        if (tab.id === 'trend') return quote.market !== 'us'
        if (tab.kline && tab.id !== 'day' && tab.id !== 'week' && tab.id !== 'month') return quote.market === 'cn'
        return true
      })
      const initialTab = tabs.some((tab) => tab.id === prefs.defaultPeriod) ? prefs.defaultPeriod : tabs[0]?.id ?? 'day'
      const [tab, setTab] = useState(initialTab)
      const [adjust, setAdjust] = useState(prefs.adjust)
      const [trendDays, setTrendDays] = useState(prefs.defaultTrendDays)
      const [showMA, setShowMA] = useState(prefs.showMA)
      const [showVolume, setShowVolume] = useState(prefs.showVolume)
      const [series, setSeries] = useState({})
      const [retryToken, setRetryToken] = useState(0)
      const [holding, setHolding] = useState(quote.holding ?? null)
      const [editHolding, setEditHolding] = useState(false)
      const [sharesText, setSharesText] = useState(quote.holding ? String(quote.holding.shares) : '')
      const [costText, setCostText] = useState(quote.holding ? String(quote.holding.cost) : '')
      const [holdingError, setHoldingError] = useState('')
      const [alertOpen, setAlertOpen] = useState(false)
      const [alertOp, setAlertOp] = useState('above')
      const [alertPrice, setAlertPrice] = useState('')
      const [alertError, setAlertError] = useState('')
      const [tradesOpen, setTradesOpen] = useState(false)
      const [tradeList, setTradeList] = useState(null)
      const [tradeError, setTradeError] = useState('')
      const [tradeForm, setTradeForm] = useState({ side: 'buy', price: '', shares: '', fee: '', date: '' })
      const forceNext = useRef(false)
      const seriesRef = useRef(series)
      seriesRef.current = series
      const isTrend = tab === 'trend'
      const retry = () => {
        setSeries((currentSeries) => {
          const next = { ...currentSeries }
          delete next[tab]
          return next
        })
        forceNext.current = true
        setRetryToken((token) => token + 1)
      }

      // `cycle` is the quote poll counter: it re-runs this effect without making
      // every finished fetch re-trigger itself. An entry is reused until it is a
      // failed one (retried on demand) or an intraday line older than 30 s, since
      // a frozen 分时 line beside a live price is worse than a reload.
      useEffect(() => {
        const key = `${tab}:${adjust}:${isTrend ? trendDays : ''}`
        const entry = seriesRef.current[key]
        // Consumed once: a retry must refresh one fetch, not turn every later
        // poll into a cache-bypassing request.
        const force = forceNext.current
        forceNext.current = false
        if (entry && !force) {
          if (!entry.ok) return undefined
          if (!(isTrend && Date.now() - entry.at > 30_000)) return undefined
        }
        let cancelled = false
        // Five sessions of minute data already ship with the intraday endpoint,
        // so the same-time volume baseline needs no archive; the five-day view
        // keeps its sequential payload and omits the comparison.
        const baselineParam = isTrend && trendDays === 1 && quote.market !== 'us' ? '&baseline=1' : ''
        ;(async () => {
          try {
            const payload = isTrend
              ? await api(`/trend?symbol=${encodeURIComponent(quote.symbol)}&days=${trendDays}${baselineParam}${force || entry ? '&refresh=1' : ''}`)
              : await api(
                  `/kline?symbol=${encodeURIComponent(quote.symbol)}&period=${tab}&adjust=${adjust}&limit=${
                    tab === 'm5' || tab === 'm15' || tab === 'm30' || tab === 'm60'
                      ? 96
                      : tab === 'day'
                        ? Math.max(10, Math.min(klineDays ?? 60, 120))
                        : 60
                  }${force || entry ? '&refresh=1' : ''}`,
                )
            // HTTP 200 still carries `ok:false` for an upstream failure; treat it
            // as an error so the panel offers a retry instead of an empty chart.
            if (payload.ok !== true) throw new Error(payload.error || 'chart-failed')
            if (cancelled) return
            setSeries((currentSeries) => ({ ...currentSeries, [key]: { ok: true, at: Date.now(), payload } }))
          } catch (failure) {
            if (cancelled) return
            setSeries((currentSeries) => ({
              ...currentSeries,
              [key]: { ok: false, at: Date.now(), error: String(failure?.message ?? failure) },
            }))
          }
        })()
        return () => {
          cancelled = true
        }
      }, [quote.symbol, tab, adjust, trendDays, cycle, retryToken, klineDays, isTrend])

      useEffect(() => {
        if (!tradesOpen) return undefined
        let cancelled = false
        ;(async () => {
          try {
            const payload = await api(`/trades?symbol=${encodeURIComponent(quote.symbol)}`)
            if (!cancelled) {
              setTradeList(payload)
              setTradeError('')
            }
          } catch (failure) {
            if (!cancelled) setTradeError(String(failure?.message ?? failure))
          }
        })()
        return () => {
          cancelled = true
        }
      }, [tradesOpen, quote.symbol])

      const refreshTrades = async () => {
        try {
          const payload = await api(`/trades?symbol=${encodeURIComponent(quote.symbol)}`)
          setTradeList(payload)
          setTradeError('')
          onReload?.()
        } catch (failure) {
          setTradeError(String(failure?.message ?? failure))
        }
      }

      const saveTrade = async () => {
        const price = Number.parseFloat(tradeForm.price)
        const shares = Number.parseFloat(tradeForm.shares)
        if (!Number.isFinite(price) || price <= 0 || !Number.isFinite(shares) || shares <= 0) {
          setTradeError(t('holdingBad'))
          return
        }
        try {
          const payload = await api('/trades', {
            method: 'POST',
            body: {
              action: 'save',
              symbol: quote.symbol,
              side: tradeForm.side,
              price,
              shares,
              fee: Number.parseFloat(tradeForm.fee) || 0,
              ...(tradeForm.date ? { date: tradeForm.date } : {}),
            },
          })
          if (payload.ok !== true) throw new Error(payload.error || 'save-failed')
          setTradeForm((current) => ({ ...current, price: '', shares: '', fee: '' }))
          await refreshTrades()
        } catch (failure) {
          setTradeError(String(failure?.message ?? failure))
        }
      }

      const removeTrade = async (id) => {
        await api('/trades', { method: 'POST', body: { action: 'remove', id } }).catch(() => undefined)
        await refreshTrades()
      }

      const applyTrades = async () => {
        try {
          const payload = await api('/trades', { method: 'POST', body: { action: 'apply', symbol: quote.symbol } })
          if (payload.ok !== true) throw new Error(payload.error || 'apply-failed')
          const position = payload.holdings?.[quote.symbol]
          if (position) {
            setHolding(position)
            setSharesText(String(position.shares))
            setCostText(String(position.cost))
          } else {
            setHolding(null)
          }
          await refreshTrades()
        } catch (failure) {
          setTradeError(String(failure?.message ?? failure))
        }
      }

      const seriesKey = `${tab}:${adjust}:${isTrend ? trendDays : ''}`
      const entry = series[seriesKey]

      const chart = (() => {
        if (!entry) return h('div', { className: 'dshst-note' }, t('loading'))
        if (!entry.ok) {
          return h(
            'div',
            { className: 'dshst-note dshst-error' },
            `${entry.payload?.error ?? entry.error} `,
            h('button', { type: 'button', className: 'dshst-link', onClick: retry }, t('retry')),
          )
        }
        if (isTrend) {
          return h(TrendChart, {
            points: entry.payload.points,
            prevClose: entry.payload.prevClose,
            baseline: entry.payload.baseline,
            baselineDays: entry.payload.baselineDays,
            up: quote.changePct >= 0 ? 'var(--dshst-up)' : 'var(--dshst-down)',
            holdingCost: holding?.cost,
            showVolume,
            label: `${quote.name ?? quote.symbol} ${t('tabTrend')}`,
            t,
          })
        }
        if (!Array.isArray(entry.payload.rows) || entry.payload.rows.length === 0) {
          return h(
            'div',
            { className: 'dshst-note' },
            `${t('noKline')} `,
            h('button', { type: 'button', className: 'dshst-link', onClick: retry }, t('retry')),
          )
        }
        return h(Candles, {
          rows: entry.payload.rows,
          width: 640,
          height: 128,
          block: true,
          grid: true,
          showMA,
          showVolume,
          holdingCost: holding?.cost,
          label: `${quote.name ?? quote.symbol} ${t(tab === 'trend' ? 'tabTrend' : `tab${tab.charAt(0).toUpperCase()}${tab.slice(1)}`)}`,
          emptyLabel: t('noKline'),
          t,
        })
      })()

      const saveHolding = async () => {
        const shares = Number.parseFloat(sharesText)
        const cost = Number.parseFloat(costText)
        if (!Number.isFinite(shares) || shares <= 0 || !Number.isFinite(cost) || cost <= 0) {
          setHoldingError(t('holdingBad'))
          return
        }
        try {
          const payload = await api('/holdings', { method: 'POST', body: { symbol: quote.symbol, shares, cost } })
          if (payload.ok !== true) throw new Error(payload.error)
          setHolding(payload.holdings?.[quote.symbol] ?? { shares, cost })
          setHoldingError('')
          setEditHolding(false)
          onReload?.()
        } catch (failure) {
          setHoldingError(String(failure?.message ?? failure))
        }
      }

      const clearHolding = async () => {
        try {
          await api('/holdings', { method: 'POST', body: { action: 'remove', symbol: quote.symbol } })
          setHolding(null)
          setEditHolding(false)
          onReload?.()
        } catch (failure) {
          setHoldingError(String(failure?.message ?? failure))
        }
      }

      const addAlert = async () => {
        const price = Number.parseFloat(alertPrice)
        if (!Number.isFinite(price) || price <= 0) {
          setAlertError(t('alertNeedPrice'))
          return
        }
        try {
          const payload = await api('/alerts', {
            method: 'POST',
            body: { action: 'save', symbol: quote.symbol, op: alertOp, price },
          })
          if (payload.ok !== true) throw new Error(payload.error)
          setAlertPrice('')
          setAlertError('')
          setAlertOpen(false)
          onReload?.()
        } catch (failure) {
          setAlertError(String(failure?.message ?? failure))
        }
      }

      const removeAlert = async (id) => {
        await api('/alerts', { method: 'POST', body: { action: 'remove', id } }).catch(() => undefined)
        onReload?.()
      }

      const holdingLine = holding
        ? h(
            'span',
            { className: 'dshst-holding' },
            `${t('holding')} `,
            h('b', null, `${holding.shares}`),
            ` ${t('cost')} `,
            h('b', null, formatPrice(holding.cost)),
            typeof quote.price === 'number'
              ? h(
                  'span',
                  { className: trendClass(quote.price - holding.cost) },
                  ` ${t('pnl')} ${formatPct(((quote.price - holding.cost) / holding.cost) * 100)}`,
                )
              : null,
            typeof quote.trade?.realized === 'number' && quote.trade.realized !== 0
              ? h(
                  'span',
                  { className: trendClass(quote.trade.realized) },
                  ` ${t('realized')} ${formatPrice(quote.trade.realized)}`,
                )
              : null,
          )
        : null

      const alerts = Array.isArray(quote.alerts) ? quote.alerts : []

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
          quote.extended
            ? h(
                'span',
                { className: 'dshst-chip', title: quote.extended.time ?? '' },
                `${quote.extended.session === 'post' ? t('afterHours') : t('premarket')} ${formatPrice(quote.extended.price)} ${formatPct(quote.extended.changePct)}`,
              )
            : null,
          holdingLine,
          h('button', { type: 'button', className: 'dshst-detailClose', onClick: onClose }, t('close')),
        ),
        h(
          'div',
          { className: 'dshst-toolbar' },
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
          isTrend
            ? h(
                'span',
                { className: 'dshst-seg' },
                ...[1, 3, 5].map((days) =>
                  h(
                    'button',
                    {
                      key: days,
                      type: 'button',
                      className: 'dshst-toggle',
                      'data-active': trendDays === days ? 'true' : 'false',
                      onClick: () => {
                        setTrendDays(days)
                        onPrefs?.({ defaultTrendDays: days })
                      },
                    },
                    `${days}${t('days')}`,
                  ),
                ),
              )
            : null,
          ADJUST_TABS.has(tab)
            ? h(
                'select',
                {
                  className: 'dshst-select',
                  value: adjust,
                  'aria-label': t('adjust'),
                  onChange: (event) => {
                    setAdjust(event.target.value)
                    onPrefs?.({ adjust: event.target.value })
                  },
                },
                h('option', { value: 'qfq' }, t('adjustQfq')),
                h('option', { value: 'hfq' }, t('adjustHfq')),
                h('option', { value: 'none' }, t('adjustNone')),
              )
            : null,
          !isTrend
            ? h(
                'button',
                {
                  type: 'button',
                  className: 'dshst-toggle',
                  'data-active': showMA ? 'true' : 'false',
                  onClick: () => {
                    setShowMA(!showMA)
                    onPrefs?.({ showMA: !showMA })
                  },
                },
                t('ma'),
              )
            : null,
          h(
            'button',
            {
              type: 'button',
              className: 'dshst-toggle',
              'data-active': showVolume ? 'true' : 'false',
              onClick: () => {
                setShowVolume(!showVolume)
                onPrefs?.({ showVolume: !showVolume })
              },
            },
            t('volume'),
          ),
          h(
            'button',
            {
              type: 'button',
              className: 'dshst-toggle',
              'data-active': alertOpen || alerts.length > 0 ? 'true' : 'false',
              onClick: () => setAlertOpen(!alertOpen),
              title: t('alerts'),
            },
            `${t('alerts')}${alerts.length > 0 ? ` ${alerts.length}` : ''}`,
          ),
          h(
            'button',
            {
              type: 'button',
              className: 'dshst-toggle',
              'data-active': tradesOpen ? 'true' : 'false',
              onClick: () => setTradesOpen(!tradesOpen),
              title: t('trades'),
            },
            `${t('trades')}${tradeList?.count ? ` ${tradeList.count}` : ''}`,
          ),
        ),
        alertOpen
          ? h(
              'div',
              { className: 'dshst-alerts' },
              alerts.length === 0
                ? h('span', { className: 'dshst-hint' }, t('alertEmpty'))
                : alerts.map((alert) =>
                    h(
                      'span',
                      { className: 'dshst-alertRow', key: alert.id },
                      h('b', { className: alert.firedAt ? 'dshst-up' : '' }, `${alert.op === 'above' ? t('alertAbove') : t('alertBelow')} ${formatPrice(alert.price)}`),
                      h('span', { className: alert.firedAt ? 'dshst-error' : 'dshst-flat' }, alert.firedAt ? t('alertFired') : t('alertArmed')),
                      h(
                        'button',
                        { type: 'button', className: 'dshst-link', onClick: () => removeAlert(alert.id) },
                        t('alertRemove'),
                      ),
                    ),
                  ),
              h(
                'div',
                { className: 'dshst-formRow' },
                h(
                  'select',
                  { className: 'dshst-select', value: alertOp, onChange: (event) => setAlertOp(event.target.value) },
                  h('option', { value: 'above' }, t('alertAbove')),
                  h('option', { value: 'below' }, t('alertBelow')),
                ),
                h('input', {
                  className: 'dshst-input dshst-inputSmall',
                  value: alertPrice,
                  placeholder: formatPrice(quote.price),
                  inputMode: 'decimal',
                  onChange: (event) => setAlertPrice(event.target.value),
                  'aria-label': t('alertPrice'),
                }),
                h('button', { type: 'button', className: 'dshst-button', onClick: addAlert }, t('alertAdd')),
                alertError ? h('span', { className: 'dshst-error' }, alertError) : null,
              ),
            )
          : null,
        tradesOpen
          ? h(
              'div',
              { className: 'dshst-trades' },
              tradeError ? h('span', { className: 'dshst-error' }, tradeError) : null,
              tradeList === null
                ? h('span', { className: 'dshst-hint' }, t('loading'))
                : tradeList.trades?.length === 0
                  ? h('span', { className: 'dshst-hint' }, t('tradeHint'))
                  : h(
                      React.Fragment,
                      null,
                      ...(tradeList.trades ?? []).map((trade) =>
                        h(
                          'div',
                          { className: 'dshst-tradeRow', key: trade.id },
                          h('span', { className: trade.side === 'buy' ? 'dshst-up' : 'dshst-down' }, trade.side === 'buy' ? t('buy') : t('sell')),
                          h('span', null, `${trade.shares} @ ${formatPrice(trade.price)}`),
                          h('span', { className: 'dshst-hint' }, trade.date),
                          trade.fee > 0 ? h('span', { className: 'dshst-hint' }, `${t('tradeFee')} ${trade.fee}`) : null,
                          h('button', { type: 'button', className: 'dshst-link', onClick: () => removeTrade(trade.id) }, t('deleteTrade')),
                        ),
                      ),
                      tradeList.position
                        ? h(
                            'span',
                            { className: 'dshst-hint' },
                            `${t('holding')} ${tradeList.position.shares} · ${t('cost')} ${formatPrice(tradeList.position.cost)} · ${t('realized')} ${tradeList.position.realized}`,
                          )
                        : null,
                    ),
              h(
                'div',
                { className: 'dshst-formRow' },
                h(
                  'select',
                  {
                    className: 'dshst-select',
                    value: tradeForm.side,
                    onChange: (event) => setTradeForm((current) => ({ ...current, side: event.target.value })),
                  },
                  h('option', { value: 'buy' }, t('buy')),
                  h('option', { value: 'sell' }, t('sell')),
                ),
                h('input', {
                  className: 'dshst-input dshst-inputSmall',
                  value: tradeForm.price,
                  placeholder: t('tradePrice'),
                  inputMode: 'decimal',
                  onChange: (event) => setTradeForm((current) => ({ ...current, price: event.target.value })),
                  'aria-label': t('tradePrice'),
                }),
                h('input', {
                  className: 'dshst-input dshst-inputSmall',
                  value: tradeForm.shares,
                  placeholder: t('shares'),
                  inputMode: 'decimal',
                  onChange: (event) => setTradeForm((current) => ({ ...current, shares: event.target.value })),
                  'aria-label': t('shares'),
                }),
                h('input', {
                  className: 'dshst-input dshst-inputSmall',
                  value: tradeForm.fee,
                  placeholder: t('tradeFee'),
                  inputMode: 'decimal',
                  onChange: (event) => setTradeForm((current) => ({ ...current, fee: event.target.value })),
                  'aria-label': t('tradeFee'),
                }),
                h('input', {
                  className: 'dshst-input dshst-inputSmall',
                  type: 'date',
                  value: tradeForm.date,
                  onChange: (event) => setTradeForm((current) => ({ ...current, date: event.target.value })),
                  'aria-label': t('tradeDate'),
                }),
                h('button', { type: 'button', className: 'dshst-button', onClick: saveTrade }, t('saveTrade')),
                h('button', { type: 'button', className: 'dshst-link', onClick: applyTrades }, t('syncFromTrades')),
              ),
            )
          : null,
        chart,
        prefs.showStats === false ? null : h(StatChips, { quote, t }),
        prefs.showOrderBook === false ? null : h(OrderBook, { depth: quote.depth, prevClose: quote.prevClose, t }),
        h(
          'div',
          { className: 'dshst-holding' },
          editHolding
            ? h(
                React.Fragment,
                null,
                h('span', { className: 'dshst-field' }, `${t('shares')}`, h('input', {
                  className: 'dshst-input dshst-inputSmall',
                  value: sharesText,
                  inputMode: 'decimal',
                  onChange: (event) => setSharesText(event.target.value),
                })),
                h('span', { className: 'dshst-field' }, `${t('cost')}`, h('input', {
                  className: 'dshst-input dshst-inputSmall',
                  value: costText,
                  inputMode: 'decimal',
                  onChange: (event) => setCostText(event.target.value),
                })),
                h('button', { type: 'button', className: 'dshst-button', onClick: saveHolding }, t('saveHolding')),
                holding ? h('button', { type: 'button', className: 'dshst-link', onClick: clearHolding }, t('removeHolding')) : null,
                h('button', { type: 'button', className: 'dshst-link', onClick: () => setEditHolding(false) }, t('cancel')),
                holdingError ? h('span', { className: 'dshst-error' }, holdingError) : null,
              )
            : h(
                React.Fragment,
                null,
                holdingLine ?? h('span', { className: 'dshst-hint' }, t('holdingHint')),
                h(
                  'button',
                  { type: 'button', className: 'dshst-link', onClick: () => setEditHolding(true) },
                  holding ? t('saveHolding') : t('holding'),
                ),
              ),
        ),
      )
    }

    function SymbolForm(props) {
      const { t, symbols, onDone } = props
      const [text, setText] = useState(symbols.length > 0 ? symbols.join('\n') : '')
      const [ready, setReady] = useState(symbols.length > 0)
      const [saving, setSaving] = useState(false)
      const [error, setError] = useState('')
      const [query, setQuery] = useState('')
      const [results, setResults] = useState([])
      const [searching, setSearching] = useState(false)

      // The strip can open this form before its first quote answer arrived, so an
      // empty textarea must never be able to overwrite the saved list: ask the
      // Host for the current list and keep saving disabled until it answers.
      useEffect(() => {
        if (ready) return undefined
        let cancelled = false
        ;(async () => {
          try {
            const payload = await fetch(`${ENDPOINT}/settings`, {
              headers: { Accept: 'application/json' },
              cache: 'no-store',
              signal: AbortSignal.timeout(9000),
            }).then((response) => response.json())
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

      // Debounced search so typing a name does not fire a request per keystroke.
      useEffect(() => {
        const term = query.trim()
        if (term === '') {
          setResults([])
          setSearching(false)
          return undefined
        }
        let cancelled = false
        setSearching(true)
        const timer = window.setTimeout(async () => {
          try {
            const payload = await api(`/search?q=${encodeURIComponent(term)}&limit=8`)
            if (!cancelled) setResults(Array.isArray(payload.items) ? payload.items : [])
          } catch {
            if (!cancelled) setResults([])
          } finally {
            if (!cancelled) setSearching(false)
          }
        }, 260)
        return () => {
          cancelled = true
          window.clearTimeout(timer)
        }
      }, [query])

      const appendSymbol = (symbol) => {
        const current = text
          .split(/[\s,，;；、]+/)
          .map((item) => item.trim())
          .filter(Boolean)
        if (!current.includes(symbol)) current.push(symbol)
        setText(current.join('\n'))
        setQuery('')
        setResults([])
      }

      const submit = useCallback(async () => {
        const items = text
          .split(/[\s,，;；、]+/)
          .map((item) => item.trim())
          .filter(Boolean)
        if (items.length === 0) {
          setError(t('emptySymbols'))
          return
        }
        setSaving(true)
        setError('')
        try {
          const response = await fetch(`${ENDPOINT}/config`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
            body: JSON.stringify({ symbols: items }),
            // A stalled write must not leave the button on "saving" forever.
            signal: AbortSignal.timeout(15000),
          })
          const payload = await response.json().catch(() => ({}))
          if (!response.ok || payload.ok !== true) {
            const rejected = Array.isArray(payload.rejected) ? payload.rejected : []
            if (payload.error === 'symbols-empty' && rejected.length > 0) {
              throw new Error(`${t('unrecognized')}${rejected.slice(0, 4).join('、')}`)
            }
            throw new Error(describeSaveError(payload.error, response.status, t))
          }
          onDone({
            saved: true,
            symbols: Array.isArray(payload.symbols) ? payload.symbols : items,
            dropped: typeof payload.dropped === 'number' ? payload.dropped : 0,
            persisted: payload.persisted,
          })
        } catch (failure) {
          const timeout = failure?.name === 'TimeoutError' || failure?.name === 'AbortError'
          setError(timeout ? t('timeout') : String(failure?.message ?? failure))
        } finally {
          setSaving(false)
        }
      }, [text, t, onDone])

      return h(
        'div',
        { className: 'dshst-form' },
        h(
          'div',
          { className: 'dshst-search' },
          h('input', {
            className: 'dshst-input dshst-searchField',
            value: query,
            placeholder: t('searchPlaceholder'),
            spellCheck: false,
            onChange: (event) => setQuery(event.target.value),
            'aria-label': t('search'),
          }),
          searching ? h('span', { className: 'dshst-hint' }, t('searching')) : null,
        ),
        results.length > 0
          ? h(
              'div',
              { className: 'dshst-results' },
              ...results.map((item) =>
                h(
                  'button',
                  {
                    key: item.symbol,
                    type: 'button',
                    className: 'dshst-result',
                    onClick: () => appendSymbol(item.symbol),
                    title: `${t('addSymbol')} ${item.symbol}`,
                  },
                  h('span', null, item.name),
                  h('span', { className: 'dshst-resultCode' }, item.symbol),
                  h('span', { className: 'dshst-resultType' }, item.type ?? ''),
                ),
              ),
            )
          : query.trim() !== '' && !searching
            ? h('span', { className: 'dshst-hint' }, t('searchEmpty'))
            : null,
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
            { type: 'button', className: 'dshst-button', disabled: saving, onClick: () => onDone({ saved: false }) },
            t('cancel'),
          ),
          h(
            'button',
            { type: 'button', className: 'dshst-button', 'data-primary': 'true', disabled: saving || !ready, onClick: submit },
            saving ? t('saving') : t('save'),
          ),
        ),
      )
    }

    /* --------------------------------------------------------------- strip */

    /**
     * Turn a vertical wheel gesture into a horizontal scroll on the strip.
     *
     * Returns true when the gesture was consumed. Trackpad horizontal swipes
     * (`|deltaX| > |deltaY|`) are left to the browser, and a strip that already
     * fits must not swallow the page scroll. `deltaMode` is honoured because
     * Firefox reports wheel lines instead of pixels.
     */
    function scrollStripByWheel(element, event) {
      if (!element) return false
      const max = element.scrollWidth - element.clientWidth
      if (max <= 2) return false
      const deltaX = event.deltaX ?? 0
      const deltaY = event.deltaY ?? 0
      // A Mac trackpad reports a horizontal swipe as deltaX; a mouse wheel (and
      // an old two-finger vertical gesture) reports deltaY. The dominant axis
      // drives the strip either way, so both gestures work over the strip.
      const delta = Math.abs(deltaX) > Math.abs(deltaY) ? deltaX : deltaY
      if (delta === 0) return false
      const scale = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? element.clientWidth : 1
      event.preventDefault?.()
      event.__dshstStripWheel = true
      if (debugEnabled()) {
        console.debug('[stock-ticker] strip wheel', { deltaX, deltaY, max, scrollLeft: element.scrollLeft })
      }
      const next = element.scrollLeft + delta * scale
      element.scrollLeft = Math.max(0, Math.min(max, next))
      return true
    }

    /**
     * Claim a full-width row for the strip inside DSH's composer dock.
     *
     * The dock is a flex row shared with DSH's own stats pills and the context
     * meter, and the slot renderer may wrap each entry in its own element, so a
     * class-name-based CSS rule is not reliable across releases. This walks up
     * from the strip to the nearest row-flex ancestor, lets that container wrap,
     * and promotes the flex item that owns the strip to a full-width, last row.
     * It returns a restore function so a remount puts the host styles back.
     */
    function claimOwnRow(element) {
      if (!element || typeof element.parentElement === 'undefined' || !element.parentElement) return undefined
      if (typeof window.getComputedStyle !== 'function') return undefined
      const styleOf = (node) => {
        try {
          return window.getComputedStyle(node)
        } catch {
          return undefined
        }
      }
      let container
      let node = element.parentElement
      for (let depth = 0; node && depth < 10; depth += 1) {
        const style = styleOf(node)
        // `inline-flex` is a flex formatting context too; the shipped dock is
        // `flex`, but a wrapper may add `inline-flex` without changing intent.
        if (style && (style.display === 'flex' || style.display === 'inline-flex')) {
          if (String(style.flexDirection || 'row').startsWith('row')) {
            container = node
            break
          }
        }
        node = node.parentElement
      }
      if (!container) {
        if (debugEnabled()) {
          const chain = []
          let cursor = element
          for (let depth = 0; cursor && depth < 10; depth += 1) {
            const style = styleOf(cursor)
            chain.push({
              tag: cursor.tagName,
              className: String(cursor.className ?? ''),
              display: style?.display,
              flexDirection: style?.flexDirection,
              flexWrap: style?.flexWrap,
            })
            cursor = cursor.parentElement
          }
          console.warn('[stock-ticker] dock row: no row-flex ancestor found', chain)
        }
        return undefined
      }

      // Walk up to the flex container's direct child. The slot outlet puts a
      // display:contents `[data-slot]` wrapper between the container and every
      // entry, and ONE outlet is shared by all list entries (DSH's stats pills
      // register before us). That wrapper is not the flex item, and neither is
      // its `firstElementChild` — that is a sibling pill. The flex item is the
      // outermost box on OUR ancestor path: skip `display:contents` wrappers
      // down from the shared outlet until reaching the first real box.
      let top = element
      while (top.parentElement && top.parentElement !== container) top = top.parentElement
      if (!top || top.parentElement !== container) return undefined
      let item = top
      if (styleOf(top)?.display === 'contents') {
        const path = []
        let cursor = element
        while (cursor && cursor !== top) {
          path.push(cursor)
          cursor = cursor.parentElement
        }
        // Outer-to-inner: the first box below the container wins.
        item = path.reverse().find((candidate) => {
          const style = styleOf(candidate)
          return style !== undefined && style.display !== 'contents'
        }) ?? element
      }

      const snapshot = []
      const remember = (target, property) => {
        const style = target.style
        const value = typeof style.getPropertyValue === 'function' ? style.getPropertyValue(property) : style[property]
        const priority = typeof style.getPropertyPriority === 'function' ? style.getPropertyPriority(property) : ''
        snapshot.push({ target, property, value: value ?? '', priority })
      }
      for (const property of ['flex-wrap']) remember(container, property)
      for (const property of ['order', 'flex', 'width', 'min-width']) remember(item, property)

      // `wrap` is written with priority so a future stylesheet `!important`
      // cannot keep the dock on one line; the item styles stay normal because
      // the root's own `flex: 1 1 auto` rule is not important.
      container.style.setProperty('flex-wrap', 'wrap', 'important')
      item.style.setProperty('order', '99')
      item.style.setProperty('flex', '0 0 100%')
      item.style.setProperty('width', '100%')
      item.style.setProperty('min-width', '0')

      if (debugEnabled()) {
        console.debug('[stock-ticker] dock row claimed', {
          container: container.className,
          containerDisplay: styleOf(container)?.display,
          containerWrap: styleOf(container)?.flexWrap,
          item: item.className,
          itemTag: item.tagName,
          itemIsRoot: item === element,
          sharedOutlet: top !== element,
        })
      }

      // One frame later the browser has laid the row out; log the resolved
      // values so a failed claim reports why instead of just "still one line".
      let frame = 0
      if (typeof window.requestAnimationFrame === 'function') {
        frame = window.requestAnimationFrame(() => {
          frame = 0
          if (!debugEnabled()) return
          const containerStyle = styleOf(container)
          const itemStyle = styleOf(item)
          console.debug('[stock-ticker] dock row applied', {
            wrap: containerStyle?.flexWrap,
            order: itemStyle?.order,
            flexBasis: itemStyle?.flexBasis,
            width: itemStyle?.width,
          })
          if (containerStyle?.flexWrap !== 'wrap') {
            console.warn('[stock-ticker] dock row: flex-wrap did not resolve to wrap; the dock may be a grid or a column')
          }
        })
      }

      return () => {
        if (frame && typeof window.cancelAnimationFrame === 'function') window.cancelAnimationFrame(frame)
        for (const { target, property, value, priority } of snapshot) {
          if (value) target.style.setProperty(property, value, priority)
          else target.style.removeProperty(property)
        }
      }
    }

    /** Diagnostics are opt-in: localStorage['dsh-stock-ticker:debug'] = '1'. */
    function debugEnabled() {
      try {
        return window.localStorage.getItem('dsh-stock-ticker:debug') === '1'
      } catch {
        return false
      }
    }

    function Ticker(props) {
      const t = props.t
      const variant = props.variant ?? 'dock'
      const [data, setData] = useState(null)
      const [error, setError] = useState('')
      const [loading, setLoading] = useState(true)
      const [collapsed, setCollapsed] = useState(readCollapsed)
      const [formOpen, setFormOpen] = useState(false)
      const [selected, setSelected] = useState(null)
      const [notice, setNotice] = useState('')
      const [failures, setFailures] = useState(0)
      const [toast, setToast] = useState([])
      const [settingsOpen, setSettingsOpen] = useState(false)
      const prefsRef = useRef({})
      const active = props.active !== false
      const [sparks, setSparks] = useState({})
      const sparkMeta = useRef({ key: '', at: 0, etag: '' })
      const stripRef = useRef(null)
      const stripCleanup = useRef(null)
      const [overflowing, setOverflowing] = useState(false)
      const restoreStripRow = useRef(undefined)
      // The row claim must start from the component root: the dock, the
      // display:contents [data-slot] outlet and our root are three different
      // elements, and only the third one is the flex item.
      const bindRow = useCallback((node) => {
        if (typeof restoreStripRow.current === 'function') {
          restoreStripRow.current()
          restoreStripRow.current = undefined
        }
        if (node) restoreStripRow.current = claimOwnRow(node)
      }, [])
      const [scrollRatio, setScrollRatio] = useState(0)
      // A manual refresh should confirm itself even when the market is closed
      // and every displayed value is identical; auto polls stay value-driven.
      const [manualPulse, setManualPulse] = useState(0)
      // The custom scroll track is also the affordance: showing it when the
      // cards fit made a dead gesture look broken. Measure the real overflow.
      const measureStrip = useCallback((node = stripRef.current) => {
        if (!node || typeof node.scrollWidth !== 'number' || typeof node.clientWidth !== 'number') {
          setOverflowing((current) => (current ? false : current))
          return
        }
        const next = node.scrollWidth - node.clientWidth > 2
        if (debugEnabled()) {
          console.debug('[stock-ticker] strip overflow', {
            clientWidth: node.clientWidth,
            scrollWidth: node.scrollWidth,
            overflowing: next,
          })
        }
        setOverflowing((current) => (current === next ? current : next))
      }, [])
      const bindStrip = useCallback((node) => {
        if (typeof stripCleanup.current === 'function') {
          stripCleanup.current()
          stripCleanup.current = null
        }
        stripRef.current = node
        measureStrip(node)
        if (!node) return
        // A direct listener survives a composer that stops propagation before
        // the window capture handler; the handled flag keeps one gesture from
        // scrolling twice.
        // Both the strip and its wrapper are listened to: the wrapper also sees
        // the absolute scroll-track overlay, which is a sibling of the strip.
        const listenerNodes = node.parentElement && node.parentElement !== node ? [node, node.parentElement] : [node]
        const onWheel = (event) => {
          if (event.__dshstStripWheel === true) return
          scrollStripByWheel(node, event)
        }
        for (const listenerNode of listenerNodes) listenerNode.addEventListener('wheel', onWheel, { passive: false })
        let observer
        if (typeof ResizeObserver === 'function') {
          observer = new ResizeObserver(() => measureStrip(node))
          observer.observe(node)
        }
        const onResize = () => measureStrip(node)
        window.addEventListener('resize', onResize)
        stripCleanup.current = () => {
          for (const listenerNode of listenerNodes) listenerNode.removeEventListener('wheel', onWheel)
          if (observer) observer.disconnect()
          window.removeEventListener('resize', onResize)
        }
      }, [measureStrip])
      const dragState = useRef({ active: false, startX: 0, startLeft: 0, moved: false })
      const alive = useRef(true)
      const refreshing = useRef({ busy: false, startedAt: 0 })
      const [busy, setBusy] = useState(false)
      const spinTimer = useRef(0)
      const loadSeq = useRef(0)
      const noticeTimer = useRef(0)

      // React replays effects in development, so the flag must be raised on every
      // setup rather than once at ref construction.
      useEffect(() => {
        alive.current = true
        return () => {
          alive.current = false
          window.clearTimeout(noticeTimer.current)
          window.clearTimeout(spinTimer.current)
          if (typeof stripCleanup.current === 'function') {
            stripCleanup.current()
            stripCleanup.current = null
          }
          if (typeof restoreStripRow.current === 'function') {
            restoreStripRow.current()
            restoreStripRow.current = undefined
          }
        }
      }, [])

      const flashNotice = useCallback((message) => {
        setNotice(message)
        window.clearTimeout(noticeTimer.current)
        noticeTimer.current = window.setTimeout(() => setNotice(''), 6000)
      }, [])

      const load = useCallback(async () => {
        if (!active) return
        if (typeof document !== 'undefined' && document.hidden) return
        // A request that never settles must not freeze every later tick.
        if (refreshing.current.busy && Date.now() - refreshing.current.startedAt < 20_000) return
        const seq = (loadSeq.current += 1)
        window.clearTimeout(spinTimer.current)
        spinTimer.current = 0
        refreshing.current.busy = true
        refreshing.current.startedAt = Date.now()
        const startedAt = refreshing.current.startedAt
        setBusy(true)
        try {
          const forced = prefsRef.current.source && prefsRef.current.source !== 'auto' ? `&source=${prefsRef.current.source}` : ''
          const payload = await api(`/quotes?sparklines=0${forced}`, { timeout: 9000 })
          if (!alive.current) return
          if (payload.ok !== true) throw new Error(payload.error || 'quotes-failed')
          setData(payload)
          setError('')
          setFailures(0)
          if (Array.isArray(payload.fired) && payload.fired.length > 0 && payload.settings?.alertToast !== false) {
            setToast(payload.fired)
          }
        } catch (failure) {
          if (!alive.current) return
          setError(describeLoadError(failure, t))
          setFailures((count) => count + 1)
        } finally {
          refreshing.current.busy = false
          if (alive.current) setLoading(false)
          if (alive.current && seq === loadSeq.current) {
            // A local poll answers in tens of milliseconds; without a floor the
            // indicator would blink once and the user would miss it. The floor
            // also gives auto-refresh the same visible rhythm as a manual click.
            const hold = Math.max(0, 650 - (Date.now() - startedAt))
            if (hold > 0) {
              spinTimer.current = window.setTimeout(() => {
                spinTimer.current = 0
                if (alive.current && seq === loadSeq.current) setBusy(false)
              }, hold)
            } else {
              setBusy(false)
            }
          }
        }
      }, [t, active])

      const manualRefresh = useCallback(async () => {
        await load()
        if (alive.current) setManualPulse((count) => count + 1)
      }, [load])

      useEffect(() => {
        load()
      }, [load])

      // Mini charts are fetched once per symbol set, revalidated with an ETag and
      // refreshed every five minutes; the quote poll no longer carries them.
      const symbolKey = Array.isArray(data?.symbols) ? data.symbols.join(',') : ''
      const sparkDays = data?.settings?.klineDays ?? 40
      const chartType = data?.settings?.miniChartType ?? 'day'
      const sparkKey = `${symbolKey}|${chartType}|${sparkDays}`
      // An intraday line moves during the session; a K-line page does not. The
      // quote poll supplies the tick, and the 60 s TTL below limits refetches.
      const sparkTick = chartType === 'intraday' ? data?.updatedAt : 0
      useEffect(() => {
        if (!active || symbolKey === '') return undefined
        const cached = sparkMeta.current
        const ttl = chartType === 'intraday' ? 60_000 : SPARK_TTL_MS
        if (cached.key === sparkKey && Date.now() - cached.at < ttl) return undefined
        let cancelled = false
        ;(async () => {
          try {
            const etag = cached.key === sparkKey ? cached.etag : ''
            const payload = await api(`/sparklines?days=${sparkDays}&type=${encodeURIComponent(chartType)}&symbols=${encodeURIComponent(symbolKey)}`, {
              headers: etag ? { 'If-None-Match': etag } : {},
              cache: 'default',
            })
            if (cancelled || !alive.current) return
            if (payload.notModified) {
              sparkMeta.current = { ...cached, key: sparkKey, at: Date.now() }
              return
            }
            if (payload.ok !== true) throw new Error(payload.error || 'sparklines-failed')
            const charts =
              payload.charts && typeof payload.charts === 'object'
                ? payload.charts
                : Object.fromEntries(
                    Object.entries(payload.rows ?? {}).map(([symbol, rows]) => [symbol, { kind: 'candles', rows }]),
                  )
            setSparks(charts)
            sparkMeta.current = { key: sparkKey, at: Date.now(), etag: payload.etag ?? '' }
          } catch (failure) {
            if (!cancelled && failure?.code !== 'host-missing') console.error('[stock-ticker] sparklines failed', failure)
          }
        })()
        return () => {
          cancelled = true
        }
      }, [active, sparkKey, chartType, sparkDays, sparkTick])

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
        if (formOpen || !active) return undefined
        const timer = window.setInterval(load, delay)
        const onVisible = () => {
          if (!document.hidden) load()
        }
        document.addEventListener('visibilitychange', onVisible)
        return () => {
          window.clearInterval(timer)
          document.removeEventListener('visibilitychange', onVisible)
        }
      }, [load, delay, formOpen, active])

      const quotes = Array.isArray(data?.quotes) ? data.quotes : []
      const symbols = useMemo(() => (Array.isArray(data?.symbols) ? data.symbols : []), [data?.symbols])
      const activeQuote = useMemo(
        () => quotes.find((quote) => quote.symbol === selected && !quote.error) ?? null,
        [quotes, selected],
      )
      const colorMode = data?.settings?.colorMode === 'intl' ? 'intl' : 'cn'
      const prefs = data?.settings ?? {}
      prefsRef.current = prefs

      useEffect(() => {
        measureStrip()
      }, [symbols.join(','), collapsed, settingsOpen, formOpen, measureStrip])

      // Wheel-to-horizontal: a strip of thirty cards is much wider than the
      // composer and the 6 px scrollbar is a poor target. The listener lives on
      // the window in the capture phase, because the strip element is replaced
      // whenever the settings/form panel opens or closes (an element-bound
      // listener would be lost on that remount) and because the composer may
      // stop wheel propagation before it reaches the strip.
      useEffect(() => {
        const onWheel = (event) => {
          if (event.__dshstStripWheel === true) return
          const element = stripRef.current
          if (!element || typeof element.contains !== 'function') return
          const target = event.target
          let inside = Boolean(target) && (target === element || element.contains(target))
          if (!inside && typeof element.getBoundingClientRect === 'function' && typeof event.clientX === 'number') {
            const rect = element.getBoundingClientRect()
            inside =
              event.clientX >= rect.left && event.clientX <= rect.right &&
              event.clientY >= rect.top && event.clientY <= rect.bottom
          }
          if (!inside) return
          scrollStripByWheel(element, event)
        }
        const onScroll = (event) => {
          const element = stripRef.current
          if (!element || event.target !== element) return
          const max = Math.max(1, element.scrollWidth - element.clientWidth)
          setScrollRatio(Math.min(1, Math.max(0, element.scrollLeft / max)))
        }
        window.addEventListener('wheel', onWheel, { passive: false, capture: true })
        window.addEventListener('scroll', onScroll, true)
        return () => {
          window.removeEventListener('wheel', onWheel, { capture: true })
          window.removeEventListener('scroll', onScroll, true)
        }
      }, [])

      const toggleCollapsed = () => {
        const next = !collapsed
        writeCollapsed(next)
        setCollapsed(next)
      }

      const savePrefs = async (patch) => {
        try {
          const payload = await api('/prefs', { method: 'POST', body: { patch } })
          if (payload.ok === true) setData((current) => (current ? { ...current, settings: { ...current.settings, ...patch } } : current))
        } catch (failure) {
          flashNotice(String(failure?.message ?? failure))
        }
      }

      const switchGroup = async (id) => {
        try {
          await api('/groups', { method: 'POST', body: { action: 'activate', id } })
          setSelected(null)
          load()
        } catch (failure) {
          flashNotice(String(failure?.message ?? failure))
        }
      }

      const acknowledge = async (entries) => {
        setToast([])
        for (const entry of entries) {
          await api('/alerts', { method: 'POST', body: { action: 'ack', id: entry.id } }).catch(() => undefined)
        }
        load()
      }

      const saveSymbols = async (list) => {
        try {
          const payload = await api('/config', { method: 'POST', body: { symbols: list, group: data?.activeGroup } })
          if (payload.ok !== true) throw new Error(payload.error || 'save-failed')
          // A new list may add symbols the strip has no bars for yet.
          sparkMeta.current = { key: '', at: 0, etag: '' }
          setSparks({})
          await load()
          flashNotice(t('savedCount').replace('{n}', String(list.length)))
        } catch (failure) {
          flashNotice(String(failure?.message ?? failure))
        }
      }

      const removeSymbol = (symbol) => {
        const next = symbols.filter((item) => item !== symbol)
        if (next.length === 0) {
          setFormOpen(true)
          return
        }
        if (selected === symbol) setSelected(null)
        saveSymbols(next)
      }

      const moveSymbol = (from, to) => {
        if (from === to || from < 0 || to < 0 || from >= symbols.length || to >= symbols.length) return
        const next = symbols.slice()
        const [item] = next.splice(from, 1)
        if (!item) return
        next.splice(to, 0, item)
        saveSymbols(next)
      }

      const onCardSelect = (symbol) => {
        // A drag that scrolled the strip must not also open a card.
        if (dragState.current.moved) {
          dragState.current.moved = false
          return
        }
        setSelected((current) => (current === symbol ? null : symbol))
      }

      const body = (() => {
        if (settingsOpen) {
          return h(SettingsCard, {
            t,
            onSaved: (patch) => {
              setData((current) => (current ? { ...current, settings: { ...current.settings, ...patch } } : current))
              prefsRef.current = { ...prefsRef.current, ...patch }
              load()
            },
          })
        }
        if (formOpen) {
          return h(SymbolForm, {
            t,
            symbols,
            onDone: (result) => {
              setFormOpen(false)
              if (!result?.saved) return
              const count = result.symbols?.length ?? 0
              const skipped = result.dropped > 0 ? t('savedDropped').replace('{n}', String(result.dropped)) : ''
              flashNotice(`${t('savedCount').replace('{n}', String(count))}${skipped}`)
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
            h('button', { type: 'button', className: 'dshst-link', onClick: () => setFormOpen(true) }, t('settings')),
          )
        }
        return h(
          React.Fragment,
          null,
          h(
            'div',
            { className: 'dshst-scrollWrap', 'data-overflow': overflowing ? 'true' : 'false' },
            h(
              'div',
              {
                className: 'dshst-strip',
                ref: bindStrip,
                onPointerDown: (event) => {
                  const element = stripRef.current
                  dragState.current = {
                    active: true,
                    startX: event.clientX,
                    startLeft: element ? element.scrollLeft : 0,
                    moved: false,
                  }
                },
                onPointerMove: (event) => {
                  const state = dragState.current
                  if (!state.active) return
                  const delta = event.clientX - state.startX
                  if (Math.abs(delta) > 4) state.moved = true
                  const element = stripRef.current
                  if (element && state.moved) element.scrollLeft = state.startLeft - delta
                },
                onPointerUp: () => {
                  dragState.current.active = false
                },
                onPointerLeave: () => {
                  dragState.current.active = false
                },
              },
              ...quotes.map((quote, index) =>
                h(QuoteCard, {
                  key: quote.symbol,
                  quote,
                  index,
                  t,
                  previewDays: prefs.klineDays,
                  sourceDot: prefs.sourceDot !== false,
                  selected: selected === quote.symbol,
                  chart: prefs.showMiniChart === false ? null : sparks[quote.symbol],
                  pulse: manualPulse,
                  showMiniChart: prefs.showMiniChart !== false,
                  showExtended: prefs.showExtended === true,
                  onSelect: () => onCardSelect(quote.symbol),
                  onRemove: () => removeSymbol(quote.symbol),
                  onMove: moveSymbol,
                }),
              ),
              h(
                'button',
                {
                  type: 'button',
                  className: 'dshst-addCard',
                  title: t('quickAdd'),
                  'aria-label': t('quickAdd'),
                  onClick: () => setFormOpen(true),
                },
                '+',
              ),
            ),
            overflowing
              ? h(
                  'div',
                  { className: 'dshst-scrollTrack', 'aria-hidden': true },
                  h('div', { className: 'dshst-scrollThumb', style: { left: `${scrollRatio * 84}%` } }),
                )
              : null,
          ),
          activeQuote
            ? h(Detail, {
                // Remount per symbol: the tab being open must not leak the previous
                // symbol's fetched series into the next one.
                key: activeQuote.symbol,
                quote: activeQuote,
                t,
                cycle: data?.updatedAt,
                klineDays: prefs.klineDays,
                prefs,
                onPrefs: savePrefs,
                onReload: load,
                onClose: () => setSelected(null),
              })
            : null,
        )
      })()

      const groups = Array.isArray(data?.groups) ? data.groups : []

      return h(
        'div',
        {
          className: 'dshst',
          ref: variant === 'dock' ? bindRow : undefined,
          'data-scheme': colorMode,
          'data-plugin': 'stock-ticker',
          'data-variant': variant,
        },
        h('div', { className: 'dshst-live', 'aria-live': 'polite', role: 'status' }, notice || (error && !data ? error : '')),
        h(
          'div',
          { className: 'dshst-head' },
          h('span', { className: 'dshst-title' }, t('title')),
          data?.source
            ? h(
                'span',
                { className: 'dshst-chip' },
                data.source === 'sina' ? t('sourceSina') : data.source === 'eastmoney' ? t('sourceEastmoney') : t('sourceTencent'),
              )
            : null,
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
          groups.length > 1
            ? h(
                'span',
                { className: 'dshst-groups' },
                ...groups.map((group) =>
                  h(
                    'button',
                    {
                      key: group.id,
                      type: 'button',
                      className: 'dshst-pill',
                      'data-active': data?.activeGroup === group.id ? 'true' : 'false',
                      title: `${group.name} (${group.count})`,
                      onClick: () => switchGroup(group.id),
                    },
                    `${group.name} ${group.count}`,
                  ),
                ),
              )
            : null,
          prefs.showMiniChart === false
            ? null
            : h(
                'span',
                { className: 'dshst-miniTypes', role: 'group', 'aria-label': t('miniChartType') },
                ...[
                  ['intraday', t('miniIntraday')],
                  ['day', t('miniDay')],
                  ['week', t('miniWeek')],
                  ['month', t('miniMonth')],
                ].map(([value, label]) =>
                  h(
                    'button',
                    {
                      key: value,
                      type: 'button',
                      className: 'dshst-pill',
                      title: `${t('miniChartType')} · ${label}`,
                      'aria-pressed': (prefs.miniChartType ?? 'day') === value ? 'true' : 'false',
                      'data-active': (prefs.miniChartType ?? 'day') === value ? 'true' : 'false',
                      onClick: () => savePrefs({ miniChartType: value }),
                    },
                    label,
                  ),
                ),
              ),
          h(
            'button',
            {
              type: 'button',
              className: 'dshst-icon',
              title: t('settingsTitle'),
              'aria-label': t('settingsTitle'),
              'aria-expanded': settingsOpen ? 'true' : 'false',
              onClick: () => {
                if (collapsed) {
                  writeCollapsed(false)
                  setCollapsed(false)
                }
                setSettingsOpen((current) => !current)
              },
            },
            h(
              'svg',
              { width: 14, height: 14, viewBox: '0 0 24 24', 'aria-hidden': true },
              h('circle', {
                cx: 12,
                cy: 12,
                r: 3,
                fill: 'none',
                stroke: 'currentColor',
                strokeWidth: 1.8,
              }),
              h('path', {
                d: 'M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z',
                fill: 'none',
                stroke: 'currentColor',
                strokeWidth: 1.8,
                strokeLinecap: 'round',
                strokeLinejoin: 'round',
              }),
            ),
          ),
          h(
            'button',
            {
              type: 'button',
              className: 'dshst-icon dshst-refresh',
              title: t('refresh'),
              'aria-label': t('refresh'),
              'aria-busy': busy ? 'true' : 'false',
              'data-busy': busy ? 'true' : 'false',
              onClick: manualRefresh,
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
              h('path', {
                d: 'M8 3.2v9.6M3.2 8h9.6',
                fill: 'none',
                stroke: 'currentColor',
                strokeWidth: 1.7,
                strokeLinecap: 'round',
              }),
            ),
          ),
          variant === 'dock'
            ? h(
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
              )
            : null,
        ),
        toast.length > 0
          ? h(
              'div',
              { className: 'dshst-toast', role: 'alert' },
              ...toast.map((entry) =>
                h(
                  'span',
                  { key: entry.id },
                  t('alertHit')
                    .replace('{name}', entry.name ?? entry.symbol)
                    .replace('{op}', entry.op === 'above' ? t('alertAbove') : t('alertBelow'))
                    .replace('{price}', formatPrice(entry.price)),
                ),
              ),
              h('button', { type: 'button', className: 'dshst-link', onClick: () => acknowledge(toast) }, t('alertAck')),
              h('button', { type: 'button', className: 'dshst-link', onClick: () => setToast([]) }, t('dismiss')),
            )
          : null,
        variant === 'dock' && collapsed ? null : body,
      )
    }

    /** The same panel, sized for a sidebar tab instead of the composer dock. */
    function SidebarPage(props) {
      // dsh-better-sidebar hands `visible: false` to a hidden tab; polling must
      // stop there or a background tab keeps the free endpoints busy.
      return h(Ticker, { ...props, variant: 'sidebar', active: props.visible !== false })
    }

    /* ------------------------------------------------------------ settings */

    function SettingsCard(props) {
      const t = props.t
      const onSaved = props.onSaved
      const [prefs, setPrefs] = useState(null)
      const [groups, setGroups] = useState([])
      const [error, setError] = useState('')
      const [saved, setSaved] = useState(false)
      const [draft, setDraft] = useState({ refreshSeconds: 15, klineDays: 40, colorMode: 'cn' })

      useEffect(() => {
        let cancelled = false
        ;(async () => {
          try {
            const payload = await api('/settings')
            if (cancelled) return
            if (payload.ok !== true) throw new Error(payload.error || 'settings-failed')
            setPrefs(payload.settings)
            setGroups(Array.isArray(payload.groups) ? payload.groups : [])
            setDraft({
              refreshSeconds: payload.settings?.refreshSeconds ?? 15,
              klineDays: payload.settings?.klineDays ?? 40,
              colorMode: payload.settings?.colorMode ?? 'cn',
            })
          } catch (failure) {
            if (!cancelled) setError(String(failure?.message ?? failure))
          }
        })()
        return () => {
          cancelled = true
        }
      }, [])

      const save = async (patch) => {
        try {
          const payload = await api('/prefs', { method: 'POST', body: { patch } })
          if (payload.ok !== true) throw new Error(payload.error || 'save-failed')
          setPrefs((current) => ({ ...current, ...patch }))
          onSaved?.(patch)
          setSaved(true)
          window.setTimeout(() => setSaved(false), 2000)
        } catch (failure) {
          setError(String(failure?.message ?? failure))
        }
      }

      const renameGroup = async (id, name) => {
        try {
          const payload = await api('/groups', { method: 'POST', body: { action: 'rename', id, name } })
          if (payload.ok === true) setGroups(payload.groups)
        } catch (failure) {
          setError(String(failure?.message ?? failure))
        }
      }

      const removeGroup = async (id) => {
        try {
          const payload = await api('/groups', { method: 'POST', body: { action: 'remove', id } })
          if (payload.ok === true) setGroups(payload.groups)
        } catch (failure) {
          setError(String(failure?.message ?? failure))
        }
      }

      const addGroup = async () => {
        try {
          const payload = await api('/groups', { method: 'POST', body: { action: 'save', name: t('newGroup'), symbols: [] } })
          if (payload.ok === true) setGroups(payload.groups)
        } catch (failure) {
          setError(String(failure?.message ?? failure))
        }
      }

      const addMarketGroup = async () => {
        try {
          const payload = await api('/groups', { method: 'POST', body: { action: 'addMarket' } })
          if (payload.ok === true) setGroups(payload.groups)
        } catch (failure) {
          setError(String(failure?.message ?? failure))
        }
      }

      if (prefs === null) return h('div', { className: 'dshst-settings' }, h('span', { className: 'dshst-hint' }, error || t('loading')))

      const toggle = (key, label) =>
        h('input', {
          type: 'checkbox',
          checked: prefs[key] !== false,
          'aria-label': label,
          onChange: (event) => save({ [key]: event.target.checked }),
        })
      const select = (key, options, label) =>
        h(
          'select',
          {
            className: 'dshst-select',
            value: prefs[key],
            'aria-label': label ?? key,
            onChange: (event) => save({ [key]: event.target.value }),
          },
          ...options.map(([value, label]) => h('option', { key: value, value }, label)),
        )

      const row = (label, control) =>
        h('div', { className: 'dshst-settingsRow', key: label }, h('label', null, label), control)

      return h(
        'div',
        { className: 'dshst dshst-settings', 'data-scheme': prefs.colorMode === 'intl' ? 'intl' : 'cn' },
        row(
          t('refreshSeconds'),
          h('input', {
            className: 'dshst-input dshst-inputSmall',
            type: 'number',
            min: 5,
            max: 300,
            value: draft.refreshSeconds,
            onChange: (event) => setDraft((current) => ({ ...current, refreshSeconds: event.target.value })),
            onBlur: () => save({ refreshSeconds: Number(draft.refreshSeconds) }),
          }),
        ),
        row(
          t('klineDays'),
          h('input', {
            className: 'dshst-input dshst-inputSmall',
            type: 'number',
            min: 10,
            max: 120,
            value: draft.klineDays,
            onChange: (event) => setDraft((current) => ({ ...current, klineDays: event.target.value })),
            onBlur: () => save({ klineDays: Number(draft.klineDays) }),
          }),
        ),
        row(
          t('miniChartType'),
          select(
            'miniChartType',
            [
              ['intraday', t('miniIntraday')],
              ['day', t('miniDay')],
              ['week', t('miniWeek')],
              ['month', t('miniMonth')],
            ],
            t('miniChartType'),
          ),
        ),
        row(
          t('colorMode'),
          select('colorMode', [
            ['cn', t('colorCn')],
            ['intl', t('colorIntl')],
          ]),
        ),
        row(
          t('defaultPeriod'),
          select('defaultPeriod', [
            ['trend', t('tabTrend')],
            ['m5', t('tabMinute')],
            ['m15', t('tabM15')],
            ['m30', t('tabM30')],
            ['m60', t('tabM60')],
            ['day', t('tabDay')],
            ['week', t('tabWeek')],
            ['month', t('tabMonth')],
          ]),
        ),
        row(
          t('defaultTrendDays'),
          select('defaultTrendDays', [
            [1, `1${t('days')}`],
            [3, `3${t('days')}`],
            [5, `5${t('days')}`],
          ]),
        ),
        row(
          t('adjust'),
          select('adjust', [
            ['qfq', t('adjustQfq')],
            ['hfq', t('adjustHfq')],
            ['none', t('adjustNone')],
          ]),
        ),
        row(
          t('dataSource'),
          select(
            'source',
            [
              ['auto', t('sourceAuto')],
              ['tencent', t('sourceTencent')],
              ['sina', t('sourceSina')],
              ['eastmoney', t('sourceEastmoney')],
            ],
            t('dataSource'),
          ),
        ),
        row(t('showMA'), toggle('showMA', t('showMA'))),
        row(t('showVolume'), toggle('showVolume', t('showVolume'))),
        row(t('showMiniChart'), toggle('showMiniChart', t('showMiniChart'))),
        row(t('showOrderBook'), toggle('showOrderBook', t('showOrderBook'))),
        row(t('showStats'), toggle('showStats', t('showStats'))),
        row(t('showExtended'), toggle('showExtended', t('showExtended'))),
        row(t('alertToast'), toggle('alertToast', t('alertToast'))),
        row(t('sourceDot'), toggle('sourceDot', t('sourceDot'))),
        h(
          'div',
          { className: 'dshst-settingsGroup' },
          h('strong', null, t('groups')),
          ...groups.map((group) =>
            h(
              'div',
              { className: 'dshst-settingsRow', key: group.id },
              h('input', {
                className: 'dshst-input',
                defaultValue: group.name,
                onBlur: (event) => renameGroup(group.id, event.target.value),
                'aria-label': t('groupName'),
              }),
              h('span', { className: 'dshst-hint' }, `${group.symbols?.length ?? group.count ?? 0}`),
              group.preset ? h('span', { className: 'dshst-preset' }, t('preset')) : null,
              group.id === 'default'
                ? null
                : h('button', { type: 'button', className: 'dshst-link', onClick: () => removeGroup(group.id) }, t('deleteGroup')),
            ),
          ),
          h('button', { type: 'button', className: 'dshst-button', onClick: addGroup }, t('newGroup')),
          h('button', { type: 'button', className: 'dshst-button', onClick: addMarketGroup }, t('addMarketGroup')),
        ),
        error ? h('span', { className: 'dshst-error' }, error) : null,
        saved ? h('span', { className: 'dshst-notice' }, t('prefsSaved')) : null,
      )
    }

    /**
     * The settings surface as a first-class Settings section (the dialog's own
     * left-nav entry), not a tab inside 内置插件: a stock plugin's display and
     * source options are not "plugin management".
     */
    function SettingsSection(props) {
      const t = props.t
      ensureStyles()
      return h(
        'div',
        { className: 'dshst dshst-settingsPage' },
        h('h2', { className: 'dshst-settingsHeading' }, t('settingsTitle')),
        h('p', { className: 'dshst-settingsIntro' }, t('settingsHint')),
        h(SettingsCard, { t }),
      )
    }

    /* ---------------------------------------------------------------- apply */

    return {
      inject: ['slots'],
      apply(ctx) {
        ensureStyles()
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

        // A first-class Settings section (the dialog's left nav), not a tab under
        // 内置插件: display and data-source options belong next to 通用设置/模型.
        // The in-strip gear stays as the shortcut that always works.
        if (typeof ctx.slots.inject === 'function') {
          try {
            ctx.slots.inject('settings.section', () =>
              ctx.slots.register(
                {
                  name: 'settings.section',
                  id: 'stock-ticker',
                  order: 40,
                  label: () => translate('settingsTitle'),
                  inject: () => ({}),
                },
                (slotProps) => h(SettingsSection, { ...slotProps, t: translate }),
              ),
            )
          } catch (failure) {
            console.error('[stock-ticker] settings section unavailable', failure)
          }
        }

        // Optional dsh-better-sidebar integration: a soft dependency, so it is
        // waited for at runtime instead of being listed in the static `inject`
        // (a missing service there would suspend the whole plugin).
        if (typeof ctx.inject === 'function') {
          ctx.effect(() => {
            const seat = ctx.inject(['betterSidebar'], (owner) => {
              const service =
                (owner && owner.betterSidebar) ||
                (owner && typeof owner.get === 'function' ? owner.get('betterSidebar') : undefined)
              if (!service || typeof service.registerTab !== 'function') return
              owner.effect(
                () =>
                  service.registerTab({
                    id: 'dsh-stock-ticker:quotes',
                    title: translate('sidebarTitle'),
                    description: translate('title'),
                    order: 60,
                    single: true,
                    component: (slotProps) => h(SidebarPage, { ...slotProps, t: translate }),
                  }),
                'stock-ticker: sidebar tab',
              )
            })
            if (seat && typeof seat.dispose === 'function') return () => seat.dispose()
            if (typeof seat === 'function') return seat
            return undefined
          }, 'stock-ticker: sidebar')
        }
      },
    }
  },
})
