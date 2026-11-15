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
    const BUILD = 'v1.16.0'
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
      volumeLegendTitle: '量能',
      volumeLegendHeavy: '大幅放量',
      volumeLegendSlight: '微放量',
      volumeLegendDeepShrink: '大幅缩量',
      volumeLegendPrevious: '昨日量',
      range: '区间',
      rangeBars: '根',
      rangeMinutes: '分钟',
      rangeSpread: '高低价差',
      rangeSpanChange: '起止涨跌',
      rangeChange: '涨跌幅',
      rangeAmplitude: '振幅',
      rangeClear: '清除',
      chartZoomHint: '滚轮缩放 · Shift+拖动平移 · 双击复位',
      echartsHint: '滚轮缩放 · 拖动框选区间 · 双击复位',
      echartsFallback: 'ECharts 不可用，已回退 SVG',
      volumePrev: '昨',
      amplitude: '振幅',
      marketCap: '市值',
      limitUp: '涨停',
      limitDown: '跌停',
      sourceTencent: '腾讯',
      sourceSina: '新浪',
      sourceEastmoney: '东财',
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
      settingsTabGeneral: '常规',
      settingsTabCharts: '图表',
      settingsTabAlerts: '提醒',
      settingsTabGroups: '分组',
      chartCache: '图表缓存',
      clearCache: '清除缓存',
      refreshSeconds: '刷新间隔（秒）',
      klineDays: '迷你K线根数',
      miniChartType: '迷你图类型',
      years: '年',
      historyYears: '拉取更多历史',
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
      compare: '叠加对比',
      loadMoreHistory: '加载更多历史',
      historyCurrent: '当前 {n} 根',
      loadAllHistory: '加载全部',
      historyLoading: '正在加载历史',
      historyLoaded: '已加载 {n} 根',
      historyPartial: '已加载 {n} 根，剩余失败',
      changePctLabel: '涨跌幅',
      compareNone: '不叠加',
      maPeriods: '均线周期',
      showVolume: '显示成交量',
      alertToast: '预警弹提示',
      volumeAlert: '放量提醒（5分钟）',
      volumeAlertPct: '放量阈值（%）',
      volumeAlertBubble: '放量',
      sourceDot: '标记每张卡的数据源',
      prefsSaved: '已保存',
      adjust: '复权',
      adjustQfq: '前复权',
      adjustHfq: '后复权',
      adjustNone: '不复权',
      days: '日',
      ma: '均线',
      volume: '量',
      sidebarTitle: '行情',
      dismiss: '忽略',
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
      realized: '已实现',
      tradeHint: '记买卖流水后，可按加权平均成本反推持仓',
      addMarketGroup: '添加大盘分组',
      preset: '预置',
      deleteTrade: '删除',
      dataSource: '数据源',
      sourceAuto: '自动（腾讯 → 新浪 → 东财）',
      showMiniChart: '显示迷你图',
      showLogos: '显示标的 logo',
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
      volumeLegendTitle: 'Volume',
      volumeLegendHeavy: 'Heavy',
      volumeLegendSlight: 'Slight',
      volumeLegendDeepShrink: 'Heavy shrink',
      volumeLegendPrevious: 'Previous',
      range: 'Range',
      rangeBars: 'bars',
      rangeMinutes: 'min',
      rangeSpread: 'High-low',
      rangeSpanChange: 'Start/end',
      rangeChange: 'Change',
      rangeAmplitude: 'Amplitude',
      rangeClear: 'Clear',
      chartZoomHint: 'Wheel to zoom · Shift-drag to pan · double-click to reset',
      echartsHint: 'Wheel to zoom · drag to select a range · double-click to reset',
      echartsFallback: 'ECharts unavailable; fell back to SVG',
      volumePrev: 'prev',
      amplitude: 'Range',
      marketCap: 'Cap',
      limitUp: 'Limit up',
      limitDown: 'Limit down',
      sourceTencent: 'Tencent',
      sourceSina: 'Sina',
      sourceEastmoney: 'Eastmoney',
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
      settingsTabGeneral: 'General',
      settingsTabCharts: 'Charts',
      settingsTabAlerts: 'Alerts',
      settingsTabGroups: 'Groups',
      chartCache: 'Chart cache',
      clearCache: 'Clear cache',
      refreshSeconds: 'Refresh seconds',
      klineDays: 'Mini chart bars',
      miniChartType: 'Mini chart type',
      years: 'y',
      historyYears: 'Load more history',
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
      compare: 'Compare',
      loadMoreHistory: 'Load more',
      historyCurrent: 'Current: {n} bars',
      loadAllHistory: 'Load all',
      historyLoading: 'Loading history',
      historyLoaded: 'Loaded {n} bars',
      historyPartial: 'Loaded {n} bars; the rest failed',
      changePctLabel: 'Change',
      compareNone: 'None',
      maPeriods: 'MA periods',
      showVolume: 'Show volume',
      alertToast: 'Toast on alert',
      volumeAlert: 'Volume alert (5m)',
      volumeAlertPct: 'Volume alert threshold (%)',
      volumeAlertBubble: 'Volume',
      sourceDot: 'Mark each card’s source',
      prefsSaved: 'Saved',
      adjust: 'Adjust',
      adjustQfq: 'Forward',
      adjustHfq: 'Backward',
      adjustNone: 'Raw',
      days: 'd',
      ma: 'MA',
      volume: 'Vol',
      sidebarTitle: 'Quotes',
      dismiss: 'Dismiss',
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
      realized: 'Realised',
      tradeHint: 'Record buys and sells, then rebuild the position from the weighted-average cost',
      addMarketGroup: 'Add market group',
      preset: 'Preset',
      deleteTrade: 'Delete',
      dataSource: 'Data source',
      sourceAuto: 'Auto (Tencent → Sina → Eastmoney)',
      showMiniChart: 'Show mini chart',
      showLogos: 'Show symbol logos',
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
.dshst[data-variant="dock"] {
  width: 100%;
  max-width: var(--dsh-composer-card-max-width, 952px);
  margin: 0 auto;
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
  flex: 0 1 auto;
  min-width: 0;
  min-height: 20px;
  color: var(--dsw-alias-label-secondary);
}
.dshst-headTop {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  min-width: 0;
}
.dshst-foot {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
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
.dshst-icon[data-toggle="true"][aria-expanded="true"] {
  border-color: var(--dsw-alias-brand-primary);
  background: color-mix(in srgb, var(--dsw-alias-brand-primary) 14%, transparent);
  color: var(--dsw-alias-brand-primary);
}
.dshst-icon[data-toggle="true"]:active {
  background: color-mix(in srgb, var(--dsw-alias-brand-primary) 20%, transparent);
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
    box-shadow var(--dshst-dur) var(--dshst-ease), transform 160ms var(--dshst-ease), opacity 120ms var(--dshst-ease);
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
.dshst-logo,
.dshst-logoFallback {
  width: 18px;
  height: 18px;
  flex: 0 0 auto;
  border-radius: 5px;
  object-fit: contain;
  background: var(--dsw-alias-bg-layer-2);
}
.dshst-logoFallback {
  display: inline-grid;
  place-items: center;
  color: var(--dsw-alias-label-secondary);
  font-size: 9px;
  font-weight: 600;
  border: 1px solid var(--dsw-alias-border-l1);
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
.dshst-historyTools {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  width: 100%;
}
.dshst-historyButton {
  padding: 1px 8px;
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 5px;
  background: transparent;
  color: var(--dsw-alias-label-primary);
  font: inherit;
  font-size: 10px;
  line-height: 16px;
  cursor: pointer;
}
.dshst-historyButton:hover:not(:disabled) {
  border-color: var(--dsw-alias-label-primary);
  background: var(--dsw-alias-interactive-bg-hover);
}
.dshst-historyButton:disabled { opacity: 0.5; cursor: default; }
.dshst-historyLoad {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
}
.dshst-historyBar {
  flex: 1 1 auto;
  height: 3px;
  overflow: hidden;
  border-radius: 2px;
  background: var(--dsw-alias-border-l1);
}
.dshst-historyBar i {
  display: block;
  height: 100%;
  border-radius: 2px;
  background: var(--dsw-alias-brand-primary);
  transition: width 160ms var(--dshst-ease);
}
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
.dshst-volumeSignal[data-trend="up"][data-strength="strong"] { color: var(--dsw-alias-state-error-primary); }
.dshst-volumeSignal[data-trend="down"],
.dshst-volumeSignal[data-trend="flat"] { color: var(--dsw-alias-label-secondary); }
.dshst-chartHint {
  padding: 0 2px;
  color: var(--dsw-alias-label-secondary);
  font-size: 9px;
  font-variant-numeric: tabular-nums;
}
.dshst-volumeLegend {
  position: absolute;
  top: 3px;
  right: 54px;
  z-index: 2;
  display: grid;
  grid-template-columns: repeat(2, auto);
  grid-template-rows: repeat(4, auto);
  grid-auto-flow: column;
  gap: 1px 8px;
  padding: 3px 6px;
  border: 1px solid var(--dsw-alias-border-l1);
  border-radius: 5px;
  background: color-mix(in srgb, var(--dsw-alias-bg-layer-1) 82%, transparent);
  backdrop-filter: blur(3px);
  color: var(--dsw-alias-label-secondary);
  font-size: 9px;
  line-height: 11px;
  font-variant-numeric: tabular-nums;
  pointer-events: none;
}
.dshst-volumeLegendTitle {
  color: var(--dsw-alias-label-secondary);
  font-weight: 600;
}
.dshst-volumeLegendItem {
  display: inline-flex;
  align-items: center;
  gap: 3px;
}
.dshst-volumeSwatch {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 2px;
  flex: 0 0 auto;
}
.dshst-volumeSwatchGhost {
  background: color-mix(in srgb, var(--dsw-alias-label-secondary) 12%, transparent);
  border: 1px solid color-mix(in srgb, var(--dsw-alias-label-secondary) 35%, transparent);
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
.dshst-range {
  position: relative;
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: nowrap;
  overflow-x: auto;
  scrollbar-width: none;
  margin-top: 2px;
  padding: 3px 64px 3px 7px;
  font-size: 9px;
  border: 1px solid var(--dsw-alias-border-l1);
  border-radius: 6px;
  background: color-mix(in srgb, var(--dsw-alias-brand-primary) 6%, var(--dsw-alias-bg-layer-1));
  color: var(--dsw-alias-label-secondary);
  font-size: 10px;
  font-variant-numeric: tabular-nums;
  animation: dshst-fade-in 140ms var(--dshst-ease);
}
.dshst-rangeTitle { color: var(--dsw-alias-label-primary); font-weight: 600; }
.dshst-range::-webkit-scrollbar { display: none; }
.dshst-range > span { flex: 0 0 auto; white-space: nowrap; }
.dshst-range button {
  position: absolute;
  top: 50%;
  right: 7px;
  margin: 0;
  transform: translateY(-50%);
}
.dshst-echartWrap {
  position: relative;
  width: 100%;
  max-width: 1040px;
  margin: 0 auto;
  align-self: stretch;
}
.dshst-echartStage {
  position: relative;
  width: 100%;
  height: 320px;
}
.dshst-echart {
  position: absolute;
  inset: 0;
}
.dshst-echartCrosshair {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 1px;
  border-left: 1px dashed var(--dsw-alias-label-secondary);
  opacity: 0.8;
  pointer-events: none;
  z-index: 3;
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
  border-color: var(--dsw-alias-label-primary);
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
  border-color: var(--dsw-alias-label-primary);
  color: var(--dsw-alias-label-primary);
}
.dshst-toolbar .dshst-select { border-color: var(--dsw-alias-label-primary); }
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
  display: inline-grid;
  place-items: center;
  margin-left: auto;
  width: 20px;
  height: 20px;
  padding: 0;
  border: 1px solid var(--dsw-alias-border-l1);
  border-radius: 6px;
  font-size: 15px;
  line-height: 1;
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
.dshst-groups {
  display: flex;
  gap: 4px;
  align-items: center;
  flex: 0 1 auto;
  min-width: 0;
  overflow-x: auto;
  scrollbar-width: none;
}
.dshst-groups::-webkit-scrollbar {
  display: none;
}
.dshst-pill {
  display: inline-flex;
  align-items: center;
  gap: 4px;
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
.dshst-pill[draggable="true"] { cursor: grab; }
.dshst-pill[data-dragging="true"] { opacity: 0.45; }
.dshst-pill[data-drop="true"] {
  border-color: var(--dsw-alias-label-primary);
  box-shadow: inset 0 0 0 1px var(--dsw-alias-label-primary);
}
.dshst-pillName { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dshst-pillCount {
  display: inline-grid;
  place-items: center;
  min-width: 14px;
  height: 14px;
  padding: 0 3px;
  border-radius: 999px;
  background: var(--dsw-alias-interactive-bg-hover);
  color: var(--dsw-alias-label-secondary);
  font-size: 9px;
  line-height: 1;
  font-variant-numeric: tabular-nums;
}
.dshst-pillCount[data-empty="true"] {
  background: transparent;
  border: 1px solid var(--dsw-alias-border-l1);
  color: var(--dsw-alias-label-tertiary);
}
.dshst-pill[data-active="true"] .dshst-pillCount {
  background: color-mix(in srgb, var(--dsw-alias-brand-primary) 14%, transparent);
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
.dshst-cacheRow { display: flex; align-items: center; gap: 8px; flex: 1 1 auto; min-width: 0; }
.dshst-cacheRow .dshst-link { margin-left: auto; white-space: nowrap; flex: 0 0 auto; }
.dshst-settingsTabs {
  display: flex;
  gap: 2px;
  margin: 2px 0 6px;
  border-bottom: 1px solid var(--dsw-alias-border-l1);
  flex-wrap: wrap;
}
.dshst-settingsTab {
  padding: 3px 10px;
  border: 0;
  border-bottom: 2px solid transparent;
  background: transparent;
  color: var(--dsw-alias-label-secondary);
  font: inherit;
  font-size: 11px;
  cursor: pointer;
}
.dshst-settingsTab[data-active="true"] {
  color: var(--dsw-alias-label-primary);
  border-bottom-color: var(--dsw-alias-label-primary);
  font-weight: 600;
}
.dshst-settings[data-tab="general"] [data-section]:not([data-section="general"]),
.dshst-settings[data-tab="charts"] [data-section]:not([data-section="charts"]),
.dshst-settings[data-tab="alerts"] [data-section]:not([data-section="alerts"]),
.dshst-settings[data-tab="groups"] [data-section]:not([data-section="groups"]) { display: none; }
.dshst-settingsRow { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.dshst-settingsRow > label { min-width: 132px; color: var(--dsw-alias-label-secondary); }
.dshst-settingsGroup { display: flex; flex-direction: column; gap: 4px; }
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
  pointer-events: auto;
  cursor: pointer;
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
  cursor: grab;
}
.dshst-scrollThumb:active { cursor: grabbing; }
.dshst-scrollThumb[data-dragging="true"] { transition: none; }
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
.dshst-miniWrap { position: relative; display: inline-flex; flex: 0 0 auto; }
.dshst-volumeBubble {
  position: absolute;
  top: -6px;
  right: -4px;
  z-index: 2;
  padding: 0 3px;
  border-radius: 4px;
  background: var(--dsw-alias-state-error-primary);
  color: #fff;
  font-size: 8px;
  line-height: 12px;
  font-weight: 600;
  pointer-events: none;
  white-space: nowrap;
}
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
        // HMR can replace the client factory while the old <style> remains;
        // refresh its text instead of silently keeping stale rules.
        existing.textContent = CSS
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

    const SESSION_RANGES = {
      cn: [[570, 690], [780, 900]],
      hk: [[570, 720], [780, 960]],
    }

    /** Position in the full trading day, 0 at the open and 1 at the close. */
    function sessionFraction(time, market) {
      const text = String(time ?? '').replace(':', '')
      const hour = Number(text.slice(0, 2))
      const minute = Number(text.slice(2, 4))
      if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null
      const at = hour * 60 + minute
      const ranges = SESSION_RANGES[market] ?? SESSION_RANGES.cn
      const total = ranges.reduce((sum, [start, end]) => sum + end - start, 0)
      let elapsed = 0
      for (const [start, end] of ranges) {
        if (at >= start && at <= end) return (elapsed + at - start) / total
        if (at < start) return elapsed / total
        elapsed += end - start
      }
      return 1
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
      'var(--dsw-alias-state-error-primary)',
      'var(--dsw-alias-state-success-primary)',
    ]
    const maColorAt = (index) => MA_COLORS[index % MA_COLORS.length]
    const maPeriodsOf = (value) => {
      const list = (Array.isArray(value) ? value : String(value ?? '').split(/[,\s，]+/))
        .map((entry) => Math.round(Number.parseFloat(entry)))
        .filter((entry) => Number.isFinite(entry) && entry >= 1 && entry <= 250)
      const unique = [...new Set(list)].slice(0, 6)
      return unique.length > 0 ? unique : MA_WINDOWS
    }

    /**
     * Volume intensity tiers: red for a heavy expansion, orange for a normal
     * one, pale orange for a slight one, and progressively lighter greys for
     * shrinking volume. Colours are theme tokens; opacity is the intensity.
     */
    const VOLUME_GOLD = '#e2b43c'

    function volumeBarTone(ratio) {
      if (typeof ratio !== 'number' || !Number.isFinite(ratio)) return null
      if (ratio >= 1.5) return { fill: 'var(--dsw-alias-state-error-primary)', fillOpacity: 1 }
      if (ratio >= 1.15) return { fill: 'var(--dsw-alias-state-warn-primary)', fillOpacity: 0.95 }
      if (ratio >= 1) return { fill: VOLUME_GOLD, fillOpacity: 0.9 }
      if (ratio >= 0.85) return { fill: 'var(--dsw-alias-label-secondary)', fillOpacity: 0.55 }
      return { fill: 'var(--dsw-alias-border-l2)', fillOpacity: 0.9 }
    }

    /** A compact swatch legend for the volume tiers and the previous-session ghost. */
    function VolumeLegend(props) {
      const t = props.t ?? ((key) => key)
      const item = (fill, opacity, label) =>
        h(
          'span',
          { className: 'dshst-volumeLegendItem', key: label },
          h('i', { className: 'dshst-volumeSwatch', style: { background: fill, opacity }, 'aria-hidden': true }),
          label,
        )
      return h(
        'div',
        { className: 'dshst-volumeLegend' },
        h('span', { className: 'dshst-volumeLegendTitle' }, t('volumeLegendTitle')),
        item('var(--dsw-alias-state-error-primary)', 1, t('volumeLegendHeavy')),
        item('var(--dsw-alias-state-warn-primary)', 0.95, t('volumeExpand')),
        item(VOLUME_GOLD, 0.9, t('volumeLegendSlight')),
        item('var(--dsw-alias-label-secondary)', 0.55, t('volumeShrink')),
        item('var(--dsw-alias-border-l2)', 0.9, t('volumeLegendDeepShrink')),
        h(
          'span',
          { className: 'dshst-volumeLegendItem', key: 'previous' },
          h('i', { className: 'dshst-volumeSwatch dshst-volumeSwatchGhost', 'aria-hidden': true }),
          t('volumeLegendPrevious'),
        ),
      )
    }

    /** Lines, dots and labels shared by the intraday and K-line range overlays. */
    function rangeMarks({ x1, x2, top, bottom, textBottom = bottom, highY, lowY, highX, lowX, highText, lowText, highColor, lowColor, spreadText }) {
      const brand = 'var(--dsw-alias-brand-primary)'
      const high = highColor ?? brand
      const low = lowColor ?? brand
      const boundary = { stroke: brand, strokeDasharray: '2 3', strokeOpacity: 0.8 }
      const highGuide = { stroke: high, strokeDasharray: '2 3', strokeOpacity: 0.8 }
      const lowGuide = { stroke: low, strokeDasharray: '2 3', strokeOpacity: 0.8 }
      return [
        ['rangeStart', x1, top, x1, bottom, boundary],
        ['rangeEnd', x2, top, x2, bottom, boundary],
        ['rangeHigh', x1, highY, x2, highY, highGuide],
        ['rangeLow', x1, lowY, x2, lowY, lowGuide],
      ].map(([key, left, y1, right, y2, style]) =>
        h('line', { key, x1: left, x2: right, y1, y2, style, strokeWidth: 1, vectorEffect: 'non-scaling-stroke' }),
      ).concat([
        h('circle', { key: 'rangeHighDot', cx: highX, cy: highY, r: 2, style: { fill: high }, pointerEvents: 'none' }),
        h('circle', { key: 'rangeLowDot', cx: lowX, cy: lowY, r: 2, style: { fill: low }, pointerEvents: 'none' }),
        h('text', { key: 'rangeHighText', x: x1 + 3, y: Math.max(9, highY - 3), style: { fill: high, fontSize: '8px' }, pointerEvents: 'none' }, highText),
        h('text', { key: 'rangeLowText', x: x1 + 3, y: Math.min(textBottom - 2, lowY + 9), style: { fill: low, fontSize: '8px' }, pointerEvents: 'none' }, lowText),
        spreadText
          ? h(
              'text',
              {
                key: 'rangeSpreadText',
                x: x2 - 3,
                y: (highY + lowY) / 2,
                textAnchor: 'end',
                style: { fill: 'var(--dsw-alias-label-secondary)', fontSize: '8px' },
                pointerEvents: 'none',
              },
              spreadText,
            )
          : null,
      ])
    }

    function RangeSummary(props) {
      const { t, title, change, changePct, highText, lowText, spread, spreadPct, amplitude, volume, onClear } = props
      const signed = (value) => `${value > 0 ? '+' : ''}${formatPrice(value)}`
      return h(
        'div',
        { className: 'dshst-range' },
        h('span', { className: 'dshst-rangeTitle' }, title),
        change === null || changePct === null
          ? null
          : h('span', { className: trendClass(changePct) }, `${t('rangeSpanChange')} ${signed(change)} (${formatPct(changePct)})`),
        h('span', { className: 'dshst-up' }, `${t('high')} ${highText}`),
        h('span', { className: 'dshst-down' }, `${t('low')} ${lowText}`),
        spread === null || spreadPct === null
          ? null
          : h('span', null, `${t('rangeSpread')} ${signed(spread)} (${formatPct(spreadPct)})`),
        amplitude === null ? null : h('span', null, `${t('rangeAmplitude')} ${formatPct(amplitude)}`),
        h('span', null, `${t('volume')} ${shortNumber(volume)}`),
        h('button', { type: 'button', className: 'dshst-link', onClick: onClear }, t('rangeClear')),
      )
    }

    /**
     * Minute K rows spell their timestamp as YYYYMMDDHHMM. For each row, find
     * the same HHMM on the previous trading day present in this page, which is
     * the baseline the volume comparison uses.
     */
    function minuteVolumeBaseline(rows) {
      const days = []
      const slots = new Map()
      for (const row of rows) {
        const date = String(row.date ?? '')
        if (!/^\d{12}$/.test(date)) continue
        const day = date.slice(0, 8)
        if (!slots.has(day)) {
          slots.set(day, new Map())
          days.push(day)
        }
        if (typeof row.volume === 'number') slots.get(day).set(date.slice(8), row.volume)
      }
      const baseline = new Map()
      for (let index = 1; index < days.length; index += 1) {
        const previous = slots.get(days[index - 1])
        for (const row of rows) {
          const date = String(row.date ?? '')
          if (!date.startsWith(days[index])) continue
          const value = previous.get(date.slice(8))
          if (typeof value === 'number') baseline.set(date, value)
        }
      }
      return baseline
    }

    /**
     * Candles with optional moving averages, an optional volume band and a hover
     * readout. The mini version on the strip draws bodies only.
     */
    function Candles(props) {
      const sourceRows = Array.isArray(props.rows) ? props.rows : []
      const width = props.width
      const height = props.height
      const block = Boolean(props.block)
      const showMA = block && props.showMA !== false
      const maPeriods = maPeriodsOf(props.maPeriods)
      const showVolume = block && props.showVolume !== false
      const t = props.t ?? ((key) => key)
      const minutePeriod = props.period === 'm5' || props.period === 'm15' || props.period === 'm30' || props.period === 'm60'
      const [hover, setHover] = useState(null)
      const [range, setRange] = useState(null)
      const [view, setView] = useState(null)
      const drag = useRef(null)
      const pan = useRef(null)
      const svgRef = useRef(null)
      const wheelHandler = useRef(null)
      const total = sourceRows.length
      const visible = view
        ? Math.min(total, Math.max(Math.min(10, total), view.end - view.start + 1))
        : total
      const viewStart = view ? Math.min(Math.max(0, view.start), Math.max(0, total - visible)) : 0
      const rows = view ? sourceRows.slice(viewStart, viewStart + visible) : sourceRows
      const volumeBaseline = minutePeriod && showVolume ? minuteVolumeBaseline(sourceRows) : new Map()
      const dayKeyOf = (value) => {
        const text = String(value ?? '')
        return /^\d{12}$/.test(text) ? text.slice(0, 8) : text
      }
      const windowKey = `${dayKeyOf(sourceRows[0]?.date)}|${dayKeyOf(sourceRows[sourceRows.length - 1]?.date)}`
      useEffect(() => {
        // Periods have different x scales; a range/view from the old tab is meaningless.
        setRange(null)
        setView(null)
        drag.current = null
        pan.current = null
      }, [props.period, windowKey])
      const indexAt = (event) => {
        const rect = event.currentTarget.getBoundingClientRect()
        if (!rect || rect.width <= 0) return null
        const ratio = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width))
        return Math.min(rows.length - 1, Math.max(0, Math.floor(ratio * rows.length)))
      }
      const setWindow = (start, count) => {
        const nextCount = Math.min(total, Math.max(Math.min(10, total), Math.round(count)))
        const nextStart = Math.min(Math.max(0, Math.round(start)), Math.max(0, total - nextCount))
        setView(nextCount >= total && nextStart === 0 ? null : { start: nextStart, end: nextStart + nextCount - 1 })
        setRange(null)
      }
      const zoomAt = (event) => {
        if (!block || total < 2) return
        const rect = event.currentTarget.getBoundingClientRect()
        if (!rect || rect.width <= 0) return
        const ratio = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width))
        const current = rows.length
        const nextCount = Math.min(total, Math.max(Math.min(10, total), Math.round(current * (event.deltaY > 0 ? 1.25 : 0.8))))
        const anchor = (view ? viewStart : 0) + ratio * current
        setWindow(anchor - ratio * nextCount, nextCount)
      }
      const panBy = (bars) => {
        if (!view) return
        setWindow(viewStart + bars, rows.length)
      }
      const handleWheel = (event) => {
        const native = event.nativeEvent ?? event
        if (native.__dshWheel) return
        native.__dshWheel = true
        event.preventDefault?.()
        if (total < 2) return
        if (Math.abs(event.deltaX) > Math.abs(event.deltaY) && view) {
          panBy(Math.round(event.deltaX / 30))
          return
        }
        zoomAt(event)
      }
      wheelHandler.current = handleWheel
      useEffect(() => {
        const node = svgRef.current
        if (!block || !node) return undefined
        // React's root wheel listener is passive; a native non-passive listener
        // is what actually stops the detail panel from scrolling while zooming.
        const listener = (event) => wheelHandler.current?.(event)
        node.addEventListener('wheel', listener, { passive: false })
        return () => node.removeEventListener('wheel', listener)
      }, [block])
      const chartStyle = block
        ? { width: '100%', height: 'auto', aspectRatio: `${width} / ${height}`, display: 'block' }
        : { width: `${width}px`, height: `${height}px` }
      const empty = () =>
        h('div', { className: 'dshst-chartEmpty', style: chartStyle, title: props.emptyLabel ?? '' })

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
      // Leave a little air above the highest wick and below the lowest so the
      // chart does not look clipped; standard K-line charts do the same.
      const breathing = (max - min) * 0.03
      min -= breathing
      max += breathing

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
      for (const value of volumeBaseline.values()) {
        if (value > maxVolume) maxVolume = value
      }

      let selectedRange = null
      let rangeLabel = (row) => shortDate(row?.date)
      if (range) {
        const start = Math.max(0, Math.min(range.start, range.end))
        const end = Math.min(rows.length - 1, Math.max(range.start, range.end))
        if (end > start) {
          const list = rows.slice(start, end + 1)
          const highRow = list.reduce((best, row) => (row.high > best.high ? row : best), list[0])
          const lowRow = list.reduce((best, row) => (row.low < best.low ? row : best), list[0])
          const first = rows[start]
          const last = rows[end]
          const entry = first.open ?? first.close
          const exit = last.close
          const change = Number.isFinite(entry) && Number.isFinite(exit) ? exit - entry : null
          const changePct = Number.isFinite(entry) && entry !== 0 && Number.isFinite(exit) ? ((exit - entry) / entry) * 100 : null
          const spread = highRow.high - lowRow.low
          const spreadPct = lowRow.low > 0 ? (spread / lowRow.low) * 100 : null
          const amplitude = Number.isFinite(entry) && entry !== 0 ? (spread / entry) * 100 : null
          const volume = list.reduce((sum, row) => sum + (typeof row.volume === 'number' ? row.volume : 0), 0)
          const sameDay = rows.slice(start, end + 1).every((row) => dayKeyOf(row.date) === dayKeyOf(rows[start]?.date))
          rangeLabel = (row) =>
            sameDay && /^\d{12}$/.test(String(row?.date))
              ? `${String(row.date).slice(8, 10)}:${String(row.date).slice(10, 12)}`
              : shortDate(row?.date)
          selectedRange = {
            start,
            end,
            x1: step * start,
            x2: step * (end + 1),
            highRow,
            lowRow,
            change,
            changePct,
            spread,
            spreadPct,
            amplitude,
            volume,
          }
        }
      }

      const children = []
      if (props.grid) {
        for (let index = 0; index <= 4; index += 1) {
          const y = inset + ((bottom - inset) * index) / 4
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

      if (selectedRange) {
        children.push(
          h('rect', {
            key: 'rangeShade',
            x: selectedRange.x1,
            y: inset,
            width: Math.max(0, selectedRange.x2 - selectedRange.x1),
            height: height - inset,
            style: { fill: 'var(--dsw-alias-brand-primary)', fillOpacity: 0.07 },
            pointerEvents: 'none',
          }),
        )
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
          const baseline = volumeBaseline.get(String(row.date))
          const ratio = typeof baseline === 'number' && baseline > 0 ? row.volume / baseline : null
          const tone = volumeBarTone(ratio)
          if (typeof baseline === 'number' && baseline > 0) {
            const ghostHeight = Math.max(0.6, (baseline / maxVolume) * (volumeBand - 3))
            children.push(
              h('rect', {
                key: `gv${index}`,
                x: center - bodyWidth / 2,
                y: height - ghostHeight,
                width: bodyWidth,
                height: ghostHeight,
                style: {
                  fill: 'var(--dsw-alias-label-secondary)',
                  fillOpacity: 0.12,
                  stroke: 'var(--dsw-alias-label-secondary)',
                  strokeOpacity: 0.35,
                  strokeWidth: 0.5,
                },
                pointerEvents: 'none',
              }),
            )
          }
          children.push(
            h('rect', {
              key: `v${index}`,
              x: center - bodyWidth / 2,
              y: height - barHeight,
              width: bodyWidth,
              height: barHeight,
              style: { fill: tone?.fill ?? color, fillOpacity: tone?.fillOpacity ?? 0.55 },
            }),
          )
        }
      })

      if (volumeBaseline.size > 0 && maxVolume > 0) {
        let path = ''
        let drawing = false
        rows.forEach((row, index) => {
          const baseline = volumeBaseline.get(String(row.date))
          if (typeof baseline !== 'number' || baseline <= 0) {
            drawing = false
            return
          }
          const x = step * (index + 0.5)
          const y = height - (baseline / maxVolume) * (volumeBand - 3)
          path += `${drawing ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)} `
          drawing = true
        })
        if (path !== '') {
          children.push(
            h('path', {
              key: 'vbaseline',
              d: path.trim(),
              fill: 'none',
              style: { stroke: 'var(--dsw-alias-label-secondary)', strokeDasharray: '2 3', strokeOpacity: 0.75 },
              strokeWidth: 1,
              vectorEffect: 'non-scaling-stroke',
            }),
          )
        }
      }

      if (minutePeriod) {
        const seenDays = new Set()
        rows.forEach((row, index) => {
          const day = dayKeyOf(row.date)
          if (!/^\d{8}$/.test(day) || seenDays.has(day)) return
          seenDays.add(day)
          if (index === 0) return
          const x = step * index
          children.push(
            h('line', {
              key: `day${day}`,
              x1: x,
              x2: x,
              y1: inset,
              y2: height,
              style: { stroke: 'var(--dsw-alias-border-l2)', strokeDasharray: '2 3', strokeOpacity: 0.65 },
              strokeWidth: 1,
              vectorEffect: 'non-scaling-stroke',
            }),
            h(
              'text',
              {
                key: `dayLabel${day}`,
                x: x + 2,
                y: inset + 8,
                style: { fill: 'var(--dsw-alias-label-secondary)', fontSize: '8px' },
                pointerEvents: 'none',
              },
              shortDate(day),
            ),
          )
        })
      }

      if (selectedRange) {
        children.push(
          ...rangeMarks({
            x1: selectedRange.x1,
            x2: selectedRange.x2,
            top: inset,
            bottom: height,
            textBottom: priceHeight,
            highY: scaleY(selectedRange.highRow.high),
            lowY: scaleY(selectedRange.lowRow.low),
            highX: step * (rows.indexOf(selectedRange.highRow) + 0.5),
            lowX: step * (rows.indexOf(selectedRange.lowRow) + 0.5),
            highText: t('high') + ' ' + formatPrice(selectedRange.highRow.high),
            lowText: t('low') + ' ' + formatPrice(selectedRange.lowRow.low),
            highColor: 'var(--dshst-up)',
            lowColor: 'var(--dshst-down)',
            spreadText: `${t('rangeSpread')} ${formatPrice(selectedRange.spread)} (${formatPct(selectedRange.spreadPct)})`,
          }),
        )
      }

      if (showMA) {
        maPeriods.forEach((window, order) => {
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
              style: { stroke: maColorAt(order) },
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
          ref: block ? svgRef : undefined,
          viewBox: `0 0 ${width} ${height}`,
          preserveAspectRatio: 'none',
          style: chartStyle,
          role: 'img',
          'aria-label': props.label ?? '',
          onMouseDown: block
            ? (event) => {
                if (event.shiftKey && view) {
                  event.preventDefault?.()
                  pan.current = {
                    x: event.clientX,
                    start: viewStart,
                    count: rows.length,
                    width: event.currentTarget.getBoundingClientRect().width,
                  }
                  return
                }
                const index = indexAt(event)
                if (index === null) return
                event.preventDefault?.()
                pan.current = null
                drag.current = { start: index, end: index }
                setHover(index)
              }
            : undefined,
          onMouseMove: block
            ? (event) => {
                if (pan.current) {
                  const { x, start, count, width: pixels } = pan.current
                  if (pixels > 0) {
                    const bars = Math.round((event.clientX - x) / (pixels / count))
                    if (bars !== 0) setWindow(start - bars, count)
                  }
                  return
                }
                const index = indexAt(event)
                if (index === null) return
                setHover(index)
                if (drag.current) {
                  drag.current.end = index
                  setRange(
                    index === drag.current.start
                      ? null
                      : { start: Math.min(drag.current.start, index), end: Math.max(drag.current.start, index) },
                  )
                }
              }
            : undefined,
          onMouseUp: block
            ? (event) => {
                if (pan.current) {
                  pan.current = null
                  return
                }
                if (!drag.current) return
                const index = indexAt(event) ?? drag.current.end
                const start = drag.current.start
                drag.current = null
                setRange(index === start ? null : { start: Math.min(start, index), end: Math.max(start, index) })
              }
            : undefined,
          onMouseLeave: block
            ? () => {
                drag.current = null
                pan.current = null
                setHover(null)
              }
            : undefined,
          onWheel: block ? handleWheel : undefined,
          onDoubleClick: block
            ? () => {
                setView(null)
                setRange(null)
              }
            : undefined,
        },
        children,
      )

      if (!block) return svg
      const active = hover !== null ? rows[hover] : null
      const activeBaseline = active ? volumeBaseline.get(String(active.date)) : undefined
      const activeRatio =
        active && typeof active.volume === 'number' && typeof activeBaseline === 'number' && activeBaseline > 0
          ? active.volume / activeBaseline
          : null
      const activeSignal = activeRatio === null ? null : activeRatio > 1 ? 'up' : activeRatio < 1 ? 'down' : 'flat'
      const activeStrength =
        activeRatio === null ? 'mild' : activeRatio >= 1.5 ? 'strong' : activeRatio >= 1.15 ? 'medium' : 'mild'
      const activeLabel =
        activeSignal === 'up' ? t('volumeExpand') : activeSignal === 'down' ? t('volumeShrink') : t('volumeFlat')
      const yLabels = [max, max - (max - min) / 4, (max + min) / 2, min + (max - min) / 4, min].map((value) => ({
        text: formatPrice(value),
        top: (scaleY(value) / height) * 100,
      }))
      const readoutBase = active
        ? `${active.date} ${t('open')} ${formatPrice(active.open)} ${t('high')} ${formatPrice(active.high)} ${t('low')} ${formatPrice(
            active.low,
          )} ${t('close')} ${formatPrice(active.close)}${typeof active.volume === 'number' ? ` ${t('volume')} ${shortNumber(active.volume)}` : ''}`
        : ''
      return h(
        'div',
        { className: 'dshst-chartWrap', style: { maxWidth: '1040px', margin: '0 auto' } },
        svg,
        active
          ? h(
              'span',
              { className: 'dshst-readout' },
              readoutBase,
              activeSignal === null
                ? null
                : h(
                    'span',
                    { className: 'dshst-volumeSignal', 'data-trend': activeSignal, 'data-strength': activeStrength },
                    ` · ${activeLabel} ${activeRatio.toFixed(2)}×`,
                  ),
              activeSignal === null ? null : ` · ${t('volumePrev')} ${shortNumber(activeBaseline)}`,
            )
          : null,
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
        block
          ? h('div', { className: 'dshst-chartHint' }, `${t('chartZoomHint')} · ${rows.length}/${total}`)
          : null,
        minutePeriod && volumeBaseline.size > 0 ? h(VolumeLegend, { t }) : null,
        selectedRange
          ? h(RangeSummary, {
              t,
              title: `${t('range')} ${rangeLabel(rows[selectedRange.start])} → ${rangeLabel(
                rows[selectedRange.end],
              )} · ${selectedRange.end - selectedRange.start + 1}${t('rangeBars')}`,
              change: selectedRange.change,
              changePct: selectedRange.changePct,
              highText: `${formatPrice(selectedRange.highRow.high)} (${rangeLabel(selectedRange.highRow)})`,
              lowText: `${formatPrice(selectedRange.lowRow.low)} (${rangeLabel(selectedRange.lowRow)})`,
              spread: selectedRange.spread,
              spreadPct: selectedRange.spreadPct,
              amplitude: selectedRange.amplitude,
              volume: selectedRange.volume,
              onClear: () => setRange(null),
            })
          : null,
      )
    }

    function shortDate(value) {
      const text = String(value ?? '')
      if (/^\d{12}$/.test(text)) return `${text.slice(4, 6)}-${text.slice(6, 8)} ${text.slice(8, 10)}:${text.slice(10, 12)}`
      if (/^\d{8}$/.test(text)) return `${text.slice(4, 6)}-${text.slice(6, 8)}`
      if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text.slice(5)
      return text
    }

    function shortNumber(value) {
      if (typeof value !== 'number' || !Number.isFinite(value)) return '--'
      if (Math.abs(value) >= 1e8) return `${(value / 1e8).toFixed(2)}亿`
      if (Math.abs(value) >= 1e4) return `${(value / 1e4).toFixed(2)}万`
      return value.toFixed(0)
    }

    /* ------------------------------------------------------ ECharts K-line */

    let echartsChunkPromise = null
    function loadEchartsChunk() {
      if (typeof require.async !== 'function') return Promise.reject(new Error('echarts chunk loader unavailable'))
      if (!echartsChunkPromise) echartsChunkPromise = require.async('./client.echarts.js').then((module) => module?.default ?? module)
      return echartsChunkPromise
    }

    /** Resolve DSH theme tokens for ECharts, which cannot read CSS variables itself. */
    function chartTheme(host) {
      const style = host && typeof getComputedStyle === 'function' ? getComputedStyle(host) : null
      const read = (name, fallback) => (style?.getPropertyValue(name) ?? '').trim() || fallback
      return {
        text: read('--dsw-alias-label-primary', '#1f2329'),
        muted: read('--dsw-alias-label-secondary', '#646a73'),
        border: read('--dsw-alias-border-l1', '#e5e6eb'),
        bg: read('--dsw-alias-bg-layer-1', '#ffffff'),
        brand: read('--dsw-alias-brand-primary', '#6f5bd6'),
        warn: read('--dsw-alias-state-warn-primary', '#d9822b'),
        error: read('--dsw-alias-state-error-primary', '#e5484d'),
        success: read('--dsw-alias-state-success-primary', '#2f9e63'),
        gold: VOLUME_GOLD,
      }
    }

    function echartsVolumeTone(ratio, theme) {
      if (typeof ratio !== 'number' || !Number.isFinite(ratio)) return null
      if (ratio >= 1.5) return { color: theme.error, opacity: 1 }
      if (ratio >= 1.15) return { color: theme.warn, opacity: 0.95 }
      if (ratio >= 1) return { color: theme.gold, opacity: 0.9 }
      if (ratio >= 0.85) return { color: theme.muted, opacity: 0.55 }
      return { color: theme.border, opacity: 0.9 }
    }

    function echartsDayLines(rows, theme, withLabels) {
      const seen = new Set()
      const lines = []
      rows.forEach((row, index) => {
        const day = String(row.date ?? '').slice(0, 8)
        if (!/^\d{8}$/.test(day) || seen.has(day)) return
        seen.add(day)
        if (index === 0) return
        lines.push({
          xAxis: String(row.date),
          lineStyle: { color: theme.muted, type: 'dashed', width: 1, opacity: 0.45 },
          ...(withLabels
            ? { label: { show: true, formatter: shortDate(day), color: theme.muted, fontSize: 9, position: 'insideEndTop' } }
            : { label: { show: false } }),
        })
      })
      return lines
    }

    function echartsDayOpenPoints(rows, theme) {
      const seen = new Set()
      const points = []
      rows.forEach((row) => {
        const day = String(row.date ?? '').slice(0, 8)
        if (!/^\d{8}$/.test(day) || seen.has(day)) return
        seen.add(day)
        points.push({
          coord: [shortDate(row.date), row.low],
          symbol: 'circle',
          symbolSize: 3,
          itemStyle: { color: theme.brand },
          label: { show: false },
        })
      })
      return points
    }

    function echartsRangeMarks(rows, range, theme, t, holdingCost, up, down) {
      const dates = rows.map((row) => shortDate(row.date))
      const marks = {
        markArea: { silent: true, itemStyle: { color: theme.brand, opacity: 0.08 }, data: [] },
        markLine: {
          symbol: 'none',
          silent: true,
          lineStyle: { color: theme.brand, type: 'dashed', width: 1, opacity: 0.75 },
          label: { show: false },
          data: [],
        },
        markPoint: {
          symbol: 'circle',
          symbolSize: 5,
          itemStyle: { color: theme.brand },
          label: { show: true, position: 'top', color: theme.brand, fontSize: 9 },
          data: [],
        },
      }
      marks.markPoint.data = echartsDayOpenPoints(rows, theme)
      if (range && range.end > range.start) {
        const start = Math.max(0, range.start)
        const end = Math.min(rows.length - 1, range.end)
        const list = rows.slice(start, end + 1)
        const high = list.reduce((best, row) => (row.high > best.high ? row : best), list[0])
        const low = list.reduce((best, row) => (row.low < best.low ? row : best), list[0])
        marks.markArea.data = [[{ xAxis: dates[start] }, { xAxis: dates[end] }]]
        marks.markLine.data = [
          { yAxis: high.high, lineStyle: { color: up, type: 'dashed', width: 1, opacity: 0.85 } },
          { yAxis: low.low, lineStyle: { color: down, type: 'dashed', width: 1, opacity: 0.85 } },
        ]
        const spread = high.high - low.low
        const spreadPct = low.low > 0 ? (spread / low.low) * 100 : null
        marks.markPoint.data.push(
          {
            coord: [shortDate(high.date), high.high],
            value: `${t('high')} ${formatPrice(high.high)}`,
            itemStyle: { color: up },
            label: { color: up },
          },
          {
            coord: [shortDate(low.date), low.low],
            value: `${t('low')} ${formatPrice(low.low)}`,
            itemStyle: { color: down },
            label: { color: down },
          },
          {
            coord: [dates[end], (high.high + low.low) / 2],
            value:
              spreadPct === null
                ? `${t('rangeSpread')} ${formatPrice(spread)}`
                : `${t('rangeSpread')} ${formatPrice(spread)} (${formatPct(spreadPct)})`,
            symbolSize: 0,
            itemStyle: { color: 'transparent' },
            label: { show: true, position: 'left', color: theme.muted, fontSize: 9, distance: 4 },
          },
        )
      }
      if (typeof holdingCost === 'number' && holdingCost > 0) {
        marks.markLine.data.push({
          yAxis: holdingCost,
          lineStyle: { color: theme.warn, type: 'dashed', width: 1, opacity: 0.8 },
        })
      }
      marks.markLine.data.push(...echartsDayLines(rows, theme, true))
      return marks
    }

    function buildEChartOption({ rows, t, colorMode, showMA, showVolume, period, holdingCost, zoom, theme, maPeriods, compareRows }) {
      const dates = rows.map((row) => shortDate(row.date))
      const up = colorMode === 'intl' ? theme.success : theme.error
      const down = colorMode === 'intl' ? theme.error : theme.success
      const minute = period === 'm5' || period === 'm15' || period === 'm30' || period === 'm60'
      const dayStarts = new Set()
      if (minute) {
        let lastDay = ''
        rows.forEach((row, index) => {
          const day = String(row.date ?? '').slice(0, 8)
          if (day !== lastDay) {
            lastDay = day
            dayStarts.add(index)
          }
        })
      }
      const baseline = minute ? minuteVolumeBaseline(rows) : new Map()
      const hasVolume = showVolume !== false
      const axisIndexes = hasVolume ? [0, 1] : [0]
      const priceGrid = hasVolume
        ? [{ left: 6, right: 58, top: 8, height: '54%' }, { left: 6, right: 58, top: '68%', height: '24%' }]
        : [{ left: 6, right: 58, top: 8, bottom: 24 }]
      const axes = [
        {
          type: 'category',
          data: dates,
          boundaryGap: true,
          axisLine: { lineStyle: { color: theme.border } },
          axisLabel: minute
            ? {
                color: theme.muted,
                fontSize: 9,
                hideOverlap: true,
                interval: (index) => dayStarts.has(index),
                formatter: (_value, index) => shortDate(String(rows[index]?.date ?? '').slice(0, 8)),
              }
            : { color: theme.muted, fontSize: 9, hideOverlap: true },
          axisTick: minute
            ? {
                show: true,
                interval: (index) => dayStarts.has(index),
                length: 5,
                lineStyle: { color: theme.muted, width: 1 },
              }
            : { show: false },
          splitLine: { show: false },
          axisPointer: { label: { backgroundColor: theme.muted } },
          gridIndex: 0,
        },
      ]
      if (hasVolume) {
        axes.push({
          type: 'category',
          data: dates,
          boundaryGap: true,
          gridIndex: 1,
          axisLine: { lineStyle: { color: theme.border } },
          axisTick: { show: false },
          axisLabel: { show: false },
          splitLine: { show: false },
        })
      }
      const yAxes = [
        {
          scale: true,
          splitNumber: 4,
          gridIndex: 0,
          axisLine: { show: false },
          axisTick: { show: false },
          axisLabel: { color: theme.muted, fontSize: 9, formatter: (value) => formatPrice(value) },
          splitLine: { lineStyle: { color: theme.border, opacity: 0.7 } },
        },
      ]
      if (hasVolume) {
        yAxes.push({
          gridIndex: 1,
          axisLine: { show: false },
          axisTick: { show: false },
          axisLabel: { show: false },
          splitLine: { show: false },
        })
      }
      const volumeData = rows.map((row) => {
        const ref = baseline.get(String(row.date))
        const ratio = typeof ref === 'number' && ref > 0 && typeof row.volume === 'number' ? row.volume / ref : null
        const tone = echartsVolumeTone(ratio, theme)
        return {
          value: row.volume,
          itemStyle: {
            color: tone?.color ?? (row.close >= row.open ? up : down),
            opacity: tone?.opacity ?? 0.55,
          },
        }
      })
      const ghostData = rows.map((row) => baseline.get(String(row.date)) ?? null)
      const baselineData = rows.map((row) => baseline.get(String(row.date)) ?? null)
      const palette = [theme.warn, theme.brand, theme.gold, theme.muted, theme.error, theme.success]
      const maSeries = showMA === false ? [] : (maPeriodsOf(maPeriods)).map((window, order) => ({
        type: 'line',
        name: `MA${window}`,
        data: movingAverage(rows, window),
        showSymbol: false,
        smooth: false,
        silent: true,
        lineStyle: { width: 1, color: palette[order % palette.length], opacity: 0.85 },
        emphasis: { disabled: true },
        z: 3,
      }))
      const dayLines = hasVolume ? echartsDayLines(rows, theme, false) : []
      const compareData = (() => {
        if (!Array.isArray(compareRows) || compareRows.length === 0) return null
        const byDate = new Map(compareRows.map((row) => [String(row.date), row]))
        const base = compareRows.find((row) => typeof row.close === 'number' && row.close > 0)?.close
        const anchor = rows[0]?.close
        if (!base || !anchor) return null
        return dates.map((date) => {
          const row = byDate.get(date)
          return row && typeof row.close === 'number' ? anchor * (1 + (row.close / base - 1) * 1) : null
        })
      })()
      const series = [
        {
          id: 'kline',
          type: 'candlestick',
          name: t('tabDay'),
          data: rows.map((row) => [row.open, row.close, row.low, row.high]),
          barWidth: '68%',
          itemStyle: { color: up, color0: down, borderColor: up, borderColor0: down },
          ...echartsRangeMarks(rows, null, theme, t, holdingCost, up, down),
          z: 2,
        },
        ...maSeries,
        ...(compareData
          ? [
              {
                id: 'compare',
                type: 'line',
                name: 'compare',
                data: compareData,
                showSymbol: false,
                smooth: false,
                silent: true,
                lineStyle: { width: 1, color: theme.brand, type: 'dashed', opacity: 0.85 },
                emphasis: { disabled: true },
                z: 4,
              },
            ]
          : []),
      ]
      if (hasVolume) {
        series.push(
          {
            id: 'ghost-volume',
            type: 'bar',
            xAxisIndex: 1,
            yAxisIndex: 1,
            data: ghostData,
            barWidth: '40%',
            barGap: '-100%',
            silent: true,
            itemStyle: { color: theme.muted, opacity: 0.1, borderColor: theme.muted, borderWidth: 0.5 },
            z: 1,
          },
          {
            id: 'volume',
            type: 'bar',
            xAxisIndex: 1,
            yAxisIndex: 1,
            data: volumeData,
            barWidth: '68%',
            barGap: '-100%',
            z: 2,
            markLine: {
              symbol: 'none',
              silent: true,
              label: { show: false },
              data: dayLines,
            },
          },
        )
        if (baseline.size > 0) {
          series.push({
            id: 'baseline',
            type: 'line',
            xAxisIndex: 1,
            yAxisIndex: 1,
            data: baselineData,
            showSymbol: false,
            smooth: false,
            silent: true,
            lineStyle: { color: theme.muted, type: 'dashed', width: 1, opacity: 0.75 },
            z: 3,
          })
        }
      }
      const initialStart = rows.length > 250 ? 100 - (250 / rows.length) * 100 : 0
      const zoomStart = typeof zoom?.start === 'number' ? zoom.start : initialStart
      const zoomEnd = typeof zoom?.end === 'number' ? zoom.end : 100
      return {
        animation: false,
        backgroundColor: 'transparent',
        grid: priceGrid,
        xAxis: axes,
        yAxis: yAxes,
        dataZoom: [
          {
            type: 'inside',
            xAxisIndex: axisIndexes,
            start: zoomStart,
            end: zoomEnd,
            zoomOnMouseWheel: true,
            moveOnMouseMove: false,
            moveOnMouseWheel: false,
            preventDefaultMouseMove: true,
          },
          {
            type: 'slider',
            xAxisIndex: axisIndexes,
            start: zoomStart,
            end: zoomEnd,
            height: 14,
            bottom: 2,
            borderColor: theme.border,
            fillerColor: theme.border,
            handleStyle: { color: theme.brand, borderColor: theme.brand },
            textStyle: { color: theme.muted, fontSize: 9 },
            showDetail: false,
            brushSelect: false,
          },
        ],
        tooltip: {
          trigger: 'axis',
          axisPointer: { type: 'cross', label: { backgroundColor: theme.muted } },
          backgroundColor: theme.bg,
          borderColor: theme.border,
          textStyle: { color: theme.text, fontSize: 10 },
          formatter: (params) => {
            const index = Array.isArray(params) ? params[0]?.dataIndex : params?.dataIndex
            const row = rows[index]
            if (!row) return ''
            const ref = baseline.get(String(row.date))
            const ratio = typeof ref === 'number' && ref > 0 && typeof row.volume === 'number' ? row.volume / ref : null
            const previous = index > 0 ? rows[index - 1]?.close : row.open
            const changePct =
              typeof previous === 'number' && previous !== 0 && typeof row.close === 'number'
                ? ((row.close - previous) / previous) * 100
                : null
            const changeColor = changePct === null ? theme.muted : changePct >= 0 ? up : down
            const parts = [
              `<b>${shortDate(row.date)}</b>`,
              `<span style="color:${changeColor};font-weight:600">${t('changePctLabel')} ${formatPct(changePct)}</span>`,
              `${t('open')} ${formatPrice(row.open)}  ${t('high')} ${formatPrice(row.high)}`,
              `${t('low')} ${formatPrice(row.low)}  ${t('close')} ${formatPrice(row.close)}`,
              `${t('volume')} ${shortNumber(row.volume)}${ref ? `  ·  ${t('volumePrev')} ${shortNumber(ref)}${ratio === null ? '' : ` (${ratio.toFixed(2)}×)`}` : ''}`,
            ]
            return parts.join('<br/>')
          },
        },
        series,
      }
    }

    function EChartKline(props) {
      const rows = Array.isArray(props.rows) ? props.rows : []
      const t = props.t ?? ((key) => key)
      const [lib, setLib] = useState(null)
      const [failed, setFailed] = useState(false)
      const [range, setRange] = useState(null)
      const [themeTick, setThemeTick] = useState(0)
      const [crosshairX, setCrosshairX] = useState(null)
      const hostRef = useRef(null)
      const chartRef = useRef(null)
      const rangeRef = useRef(range)
      rangeRef.current = range

      useEffect(() => {
        if (typeof MutationObserver !== 'function') return undefined
        const bump = () => setThemeTick((value) => value + 1)
        const observer = new MutationObserver(bump)
        observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'style', 'data-ds-dark-theme'] })
        if (document.body) observer.observe(document.body, { attributes: true, attributeFilter: ['class', 'style', 'data-ds-dark-theme'] })
        return () => observer.disconnect()
      }, [])

      useEffect(() => {
        let alive = true
        loadEchartsChunk()
          .then((loaded) => alive && setLib(loaded))
          .catch((error) => {
            if (!alive) return
            setFailed(true)
            if (typeof require.async === 'function') {
              console.warn('[stock-ticker] ECharts chunk unavailable; using SVG chart', error?.message ?? error)
            }
          })
        return () => {
          alive = false
        }
      }, [])

      useEffect(() => {
        if (!lib || !hostRef.current || rows.length < 2) return undefined
        let chart
        try {
          chart = lib.init(hostRef.current, null, { renderer: 'svg' })
        } catch (error) {
          setFailed(true)
          console.warn('[stock-ticker] ECharts init failed; using SVG chart', error?.message ?? error)
          return undefined
        }
        chartRef.current = chart
        const observer =
          typeof ResizeObserver === 'function'
            ? new ResizeObserver(() => chart.resize())
            : null
        observer?.observe(hostRef.current)
        requestAnimationFrame(() => chart.resize())
        const rect = () => hostRef.current?.getBoundingClientRect()
        const indexAt = (event) => {
          const box = rect()
          if (!box || box.width <= 0) return null
          const [value] = chart.convertFromPixel(
            { xAxisIndex: 0, yAxisIndex: 0 },
            [event.clientX - box.left, event.clientY - box.top],
          )
          if (typeof value !== 'number' || !Number.isFinite(value)) return null
          return Math.max(0, Math.min(rows.length - 1, Math.round(value)))
        }
        let selecting = null
        const down = (event) => {
          if (event.button !== 0 || event.shiftKey) return
          const index = indexAt(event)
          if (index === null) return
          event.preventDefault()
          selecting = { start: index }
          setRange(null)
        }
        const move = (event) => {
          const box = rect()
          if (box) setCrosshairX(event.clientX - box.left)
          if (!selecting) return
          const index = indexAt(event)
          if (index === null) return
          setRange(index === selecting.start ? null : { start: Math.min(selecting.start, index), end: Math.max(selecting.start, index) })
        }
        const leave = () => setCrosshairX(null)
        const up = (event) => {
          if (!selecting) return
          const index = indexAt(event)
          const start = selecting.start
          selecting = null
          if (index === null) return
          setRange(index === start ? null : { start: Math.min(start, index), end: Math.max(start, index) })
        }
        // ECharts' zrender handlers can stop bubbling; capture before them.
        hostRef.current.addEventListener('mousedown', down, true)
        hostRef.current.addEventListener('mousemove', move, true)
        hostRef.current.addEventListener('mouseup', up, true)
        hostRef.current.addEventListener('mouseleave', leave)
        return () => {
          observer?.disconnect()
          hostRef.current?.removeEventListener('mousedown', down, true)
          hostRef.current?.removeEventListener('mousemove', move, true)
          hostRef.current?.removeEventListener('mouseup', up, true)
          hostRef.current?.removeEventListener('mouseleave', leave)
          chart.dispose()
          chartRef.current = null
        }
      }, [lib, rows.length])

      useEffect(() => {
        const chart = chartRef.current
        if (!lib || !chart || rows.length < 2) return
        const current = chart.getOption()?.dataZoom?.[0]
        const zoom = { start: current?.start ?? 0, end: current?.end ?? 100 }
        chart.setOption(
          buildEChartOption({
            rows,
            t,
            colorMode: props.colorMode,
            showMA: props.showMA,
            showVolume: props.showVolume,
            period: props.period,
            holdingCost: props.holdingCost,
            maPeriods: props.maPeriods,
            compareRows: props.compareRows,
            zoom,
            theme: chartTheme(hostRef.current),
          }),
          { notMerge: true },
        )
      }, [lib, rows, props.colorMode, props.showMA, props.showVolume, props.period, props.holdingCost, props.maPeriods, props.compareRows, t, themeTick])

      useEffect(() => {
        const chart = chartRef.current
        if (!chart) return
        const theme = chartTheme(hostRef.current)
        const up = props.colorMode === 'intl' ? theme.success : theme.error
        const down = props.colorMode === 'intl' ? theme.error : theme.success
        chart.setOption({
          series: [{ id: 'kline', ...echartsRangeMarks(rows, range, theme, t, props.holdingCost, up, down) }],
        })
      }, [range, rows, t, props.holdingCost])

      if (!lib || failed) {
        return h(
          'div',
          { className: 'dshst-echartWrap' },
          failed && typeof require.async === 'function'
            ? h('div', { className: 'dshst-chartHint' }, t('echartsFallback'))
            : null,
          h(Candles, props),
        )
      }

      const selected = range && range.end > range.start ? rows.slice(range.start, range.end + 1) : null
      const high = selected ? selected.reduce((best, row) => (row.high > best.high ? row : best), selected[0]) : null
      const low = selected ? selected.reduce((best, row) => (row.low < best.low ? row : best), selected[0]) : null
      const first = selected?.[0]
      const last = selected?.[selected.length - 1]
      const changePct =
        first && last && Number.isFinite(first.open) && first.open !== 0
          ? ((last.close - first.open) / first.open) * 100
          : null
      const change = first && last ? last.close - first.open : null
      const spread = high && low ? high.high - low.low : null
      const spreadPct = spread !== null && low?.low > 0 ? (spread / low.low) * 100 : null
      const amplitude =
        high && low && first && Number.isFinite(first.open) && first.open !== 0
          ? (spread / first.open) * 100
          : null
      const volume = selected ? selected.reduce((sum, row) => sum + (typeof row.volume === 'number' ? row.volume : 0), 0) : 0
      const minute = props.period === 'm5' || props.period === 'm15' || props.period === 'm30' || props.period === 'm60'
      const baseline = minute ? minuteVolumeBaseline(rows) : new Map()

      return h(
        'div',
        {
          className: 'dshst-echartWrap',
          onDoubleClick: () => {
            chartRef.current?.dispatchAction({ type: 'dataZoom', start: 0, end: 100 })
            setRange(null)
          },
        },
        h(
          'div',
          { className: 'dshst-echartStage' },
          h('div', {
            className: 'dshst-echart',
            ref: hostRef,
            role: 'img',
            'aria-label': props.label ?? '',
          }),
          crosshairX === null
            ? null
            : h('div', { className: 'dshst-echartCrosshair', style: { left: `${crosshairX}px` } }),
        ),
        minute && baseline.size > 0 ? h(VolumeLegend, { t }) : null,
        h(
          'div',
          { className: 'dshst-chartHint' },
          `${t('echartsHint')} · ${rows.length}${props.compareRows ? ` · ${t('compare')} ${props.compareLabel}` : ''}`,
        ),
        selected && high && low
          ? h(RangeSummary, {
              t,
              title: `${t('range')} ${shortDate(rows[range.start]?.date)} → ${shortDate(
                rows[range.end]?.date,
              )} · ${range.end - range.start + 1}${t('rangeBars')}`,
              change,
              changePct,
              highText: `${formatPrice(high.high)} (${shortDate(high.date)})`,
              lowText: `${formatPrice(low.low)} (${shortDate(low.date)})`,
              spread,
              spreadPct,
              amplitude,
              volume,
              onClear: () => {
                setRange(null)
              },
            })
          : null,
      )
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
      const dayList = [...new Set(points.map((point) => point.day).filter(Boolean))]
      const totalDays = Math.max(1, dayList.length)
      const dayIndex = new Map(dayList.map((day, index) => [day, index]))
      const scaleX = (index) => {
        if (dayList.length === 0) return (index / (points.length - 1)) * width
        const point = points[index]
        const fraction = sessionFraction(point?.time, props.market)
        if (!point || fraction === null) return (index / (points.length - 1)) * width
        const day = dayList.length > 1 ? dayIndex.get(point.day) ?? 0 : 0
        return ((day + fraction) / totalDays) * width
      }
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
          d: `M0,${height} L${line.join(' L')} L${scaleX(points.length - 1)},${height} Z`,
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

    function StockLogo(props) {
      const { quote } = props
      const [failed, setFailed] = useState(false)
      const initial = String(quote.name ?? quote.code ?? quote.symbol ?? '?').trim().slice(0, 1).toUpperCase()
      if (failed) {
        return h(
          'span',
          { className: 'dshst-logoFallback', style: { width: '18px', height: '18px' }, title: quote.name ?? quote.symbol, 'aria-hidden': true },
          initial,
        )
      }
      return h('img', {
        className: 'dshst-logo',
        style: { width: '18px', height: '18px' },
        src: `${ENDPOINT}/logo?symbol=${encodeURIComponent(quote.symbol)}`,
        alt: '',
        title: quote.name ?? quote.symbol,
        loading: 'lazy',
        decoding: 'async',
        onError: () => setFailed(true),
      })
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
          props.onDragStart?.(index, event)
        },
        onDragOver: (event) => {
          event.preventDefault?.()
          event.stopPropagation?.()
          if (event.dataTransfer) event.dataTransfer.dropEffect = 'move'
          props.onDragOver?.(index)
        },
        onDrop: (event) => {
          event.preventDefault?.()
          event.stopPropagation?.()
          props.onDrop?.(index)
        },
        onDragEnd: () => props.onDragEnd?.(),
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
      const mini =
        props.showMiniChart === false
          ? null
          : chart?.kind === 'line'
            ? h(MiniTrend, {
                points: chart.points,
                up: miniUp,
                market: quote.market,
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
              })
      const volumeAlert = props.volumeAlert
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
          style: props.dragShift
            ? { transform: `translateX(${props.dragShift}px)`, willChange: 'transform' }
            : props.dragSource
              ? { opacity: 0.28 }
              : undefined,
          'data-dragging': props.dragSource ? 'true' : 'false',
          'data-symbol': quote.symbol,
          ...dragProps,
        },
        props.showLogos ? h(StockLogo, { quote, t }) : null,
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
        mini
          ? h(
              'span',
              { className: 'dshst-miniWrap' },
              mini,
              volumeAlert
                ? h(
                    'span',
                    {
                      className: 'dshst-volumeBubble',
                      title: `${t('volumeAlert')} ${formatPct(volumeAlert.pct)} · ${shortDate(volumeAlert.time)}`,
                    },
                    t('volumeAlertBubble'),
                  )
                : null,
            )
          : null,
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
      const [range, setRange] = useState(null)
      const drag = useRef(null)
      useEffect(() => {
        setRange(null)
        drag.current = null
      }, [points.length])
      const indexAt = (event) => {
        const rect = event.currentTarget.getBoundingClientRect()
        if (!rect || rect.width <= 0) return null
        const x = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width)) * width
        let best = 0
        let distance = Number.POSITIVE_INFINITY
        points.forEach((point, index) => {
          const current = Math.abs(scaleX(index) - x)
          if (current < distance) {
            distance = current
            best = index
          }
        })
        return best
      }

      if (points.length < 2) {
        return h('div', { className: 'dshst-chartEmpty', style: { width: '100%', height: `${height}px` }, title: props.emptyLabel ?? '' })
      }
      // Domestic intraday charts centre the price axis on the previous close:
      // the top and bottom are the same percentage away, so a line above the
      // dashed zero line is immediately "up" and below is "down". A cost line
      // must never stretch this axis; it would flatten the whole session.
      let min
      let max
      let yTicks = []
      if (prevClose !== null && prevClose > 0) {
        let maxAbsPct = 0
        for (const point of points) {
          for (const value of [point.price, point.avg]) {
            if (typeof value !== 'number' || !Number.isFinite(value)) continue
            const pct = Math.abs(((value - prevClose) / prevClose) * 100)
            if (pct > maxAbsPct) maxAbsPct = pct
          }
        }
        // The comparison line is expressed against its own previous close. A
        // symbol that moved further than the current one must still be visible,
        // otherwise the axis clips the overlay entirely.
        const comparison = props.compare
        if (comparison && typeof comparison.prevClose === 'number' && comparison.prevClose > 0) {
          for (const point of comparison.points ?? []) {
            if (typeof point.price !== 'number') continue
            const pct = Math.abs(((point.price - comparison.prevClose) / comparison.prevClose) * 100)
            if (pct > maxAbsPct) maxAbsPct = pct
          }
        }
        // Keep 8% headroom and round up to a half-point so the labels read like
        // +3.00% / -3.00% rather than an arbitrary maximum.
        const boundPct = Math.ceil(Math.max(0.5, maxAbsPct * 1.08) / 0.5) * 0.5
        min = prevClose * (1 - boundPct / 100)
        max = prevClose * (1 + boundPct / 100)
        yTicks = [1, 0.5, 0, -0.5, -1].map((fraction) => ({
          value: prevClose * (1 + (boundPct * fraction) / 100),
          pct: boundPct * fraction,
        }))
      } else {
        let low = Number.POSITIVE_INFINITY
        let high = Number.NEGATIVE_INFINITY
        for (const point of points) {
          for (const value of [point.price, point.avg]) {
            if (typeof value !== 'number' || !Number.isFinite(value)) continue
            if (value < low) low = value
            if (value > high) high = value
          }
        }
        if (!Number.isFinite(low) || !Number.isFinite(high)) {
          return h('div', { className: 'dshst-chartEmpty', style: { width: '100%', height: `${height}px` }, title: props.emptyLabel ?? '' })
        }
        const pad = Math.max((high - low) * 0.06, Math.abs(high) * 0.005 || 0.01)
        min = low - pad
        max = high + pad
        yTicks = [max, max - (max - min) / 4, (max + min) / 2, min + (max - min) / 4, min].map((value) => ({ value, pct: null }))
      }
      if (!Number.isFinite(min) || !Number.isFinite(max)) {
        return h('div', { className: 'dshst-chartEmpty', style: { width: '100%', height: `${height}px` }, title: props.emptyLabel ?? '' })
      }
      const volumeBand = showVolume ? 26 : 0
      const priceHeight = height - volumeBand
      const inset = 6
      const scaleY = (value) => priceHeight - inset - ((value - min) / (max - min)) * (priceHeight - inset * 2)
      const dayList = [...new Set(points.map((point) => point.day).filter(Boolean))]
      const totalDays = Math.max(1, dayList.length)
      const dayIndex = new Map(dayList.map((day, index) => [day, index]))
      const timeAxis = dayList.length > 0
      const xForPoint = (day, time) => {
        const fraction = sessionFraction(time, props.market)
        if (fraction === null) return null
        const index = dayList.length > 1 ? dayIndex.get(day) ?? 0 : 0
        return ((index + fraction) / totalDays) * width
      }
      const scaleX = (index) => {
        if (!timeAxis) return (index / (points.length - 1)) * width
        const point = points[index]
        return (point && xForPoint(point.day, point.time)) || 0
      }
      const priceLine = points.map((point, index) => `${scaleX(index).toFixed(1)},${scaleY(point.price).toFixed(1)}`).join(' ')
      const avgLine = points
        .map((point, index) => (typeof point.avg === 'number' ? `${scaleX(index).toFixed(1)},${scaleY(point.avg).toFixed(1)}` : null))
        .filter(Boolean)
        .join(' ')
      const areaRight = scaleX(points.length - 1)
      const area = `M0,${priceHeight} L${priceLine.split(' ').join(' L')} L${areaRight},${priceHeight} Z`
      const up = props.up
      const compareLine = (() => {
        const info = props.compare
        if (!info || !Array.isArray(info.points) || typeof info.prevClose !== 'number' || info.prevClose <= 0) return ''
        return info.points
          .map((point) => {
            if (typeof point.price !== 'number') return null
            const x = xForPoint(point.day, point.time)
            if (x === null) return null
            const y = scaleY(info.prevClose * (1 + ((point.price - info.prevClose) / info.prevClose) * 1))
            return `${x.toFixed(1)},${y.toFixed(1)}`
          })
          .filter(Boolean)
          .join(' ')
      })()

      let selectedRange = null
      if (range) {
        const start = Math.max(0, Math.min(range.start, range.end))
        const end = Math.min(points.length - 1, Math.max(range.start, range.end))
        if (end > start) {
          const list = points.slice(start, end + 1)
          const highPoint = list.reduce((best, point) => (point.price > best.price ? point : best), list[0])
          const lowPoint = list.reduce((best, point) => (point.price < best.price ? point : best), list[0])
          const first = points[start]
          const last = points[end]
          const entry = first.price
          const change = Number.isFinite(last.price) && Number.isFinite(entry) ? last.price - entry : null
          const changePct = Number.isFinite(entry) && entry !== 0 ? ((last.price - entry) / entry) * 100 : null
          const spread = highPoint.price - lowPoint.price
          const spreadPct = lowPoint.price > 0 ? (spread / lowPoint.price) * 100 : null
          const amplitude = Number.isFinite(entry) && entry !== 0 ? (spread / entry) * 100 : null
          const volume = list.reduce((sum, point) => sum + (typeof point.volume === 'number' ? point.volume : 0), 0)
          selectedRange = {
            start,
            end,
            x1: scaleX(start),
            x2: scaleX(end),
            highPoint,
            lowPoint,
            change,
            changePct,
            spread,
            spreadPct,
            amplitude,
            volume,
          }
        }
      }
      const pointLabel = (point) => `${point.day ? `${shortDate(point.day)} ` : ''}${point.time}`
      const rangeSameDay = (() => {
        if (!selectedRange) return false
        const day = points[selectedRange.start]?.day
        return Boolean(day) && points.slice(selectedRange.start, selectedRange.end + 1).every((point) => point.day === day)
      })()
      const rangeLabel = (point) => (rangeSameDay ? point.time : pointLabel(point))

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
        ...(selectedRange
          ? [
              h('rect', {
                key: 'rangeShade',
                x: selectedRange.x1,
                y: 0,
                width: Math.max(0, selectedRange.x2 - selectedRange.x1),
                height: priceHeight,
                style: { fill: 'var(--dsw-alias-brand-primary)', fillOpacity: 0.07 },
                pointerEvents: 'none',
              }),
            ]
          : []),
        ...yTicks
          .filter((tick) => tick.pct === null || tick.pct !== 0)
          .map((tick, index) =>
            h('line', {
              key: `grid${index}`,
              x1: 0,
              x2: width,
              y1: scaleY(tick.value),
              y2: scaleY(tick.value),
              style: { stroke: 'var(--dsw-alias-border-l1)', strokeOpacity: 0.7 },
              strokeWidth: 1,
              vectorEffect: 'non-scaling-stroke',
            }),
          ),
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
        compareLine
          ? h('polyline', {
              key: 'compare',
              points: compareLine,
              fill: 'none',
              style: { stroke: 'var(--dsw-alias-brand-primary)', strokeDasharray: '3 3', strokeOpacity: 0.85 },
              strokeWidth: 1,
              vectorEffect: 'non-scaling-stroke',
            })
          : null,
      ]

      if (selectedRange) {
        children.push(
          ...rangeMarks({
            x1: selectedRange.x1,
            x2: selectedRange.x2,
            top: 0,
            bottom: priceHeight,
            highY: scaleY(selectedRange.highPoint.price),
            lowY: scaleY(selectedRange.lowPoint.price),
            highX: scaleX(points.indexOf(selectedRange.highPoint)),
            lowX: scaleX(points.indexOf(selectedRange.lowPoint)),
            highText: `${t('high')} ${formatPrice(selectedRange.highPoint.price)} ${rangeLabel(selectedRange.highPoint)}`,
            lowText: `${t('low')} ${formatPrice(selectedRange.lowPoint.price)} ${rangeLabel(selectedRange.lowPoint)}`,
            highColor: 'var(--dshst-up)',
            lowColor: 'var(--dshst-down)',
            spreadText: `${t('rangeSpread')} ${formatPrice(selectedRange.spread)} (${formatPct(selectedRange.spreadPct)})`,
          }),
        )
      }

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
          const sessionSlots = (props.market === 'hk' ? 330 : 240)
          const barWidth = Math.max(1, width / (totalDays * sessionSlots) - 0.4)
          points.forEach((point, index) => {
            if (typeof point.volume !== 'number') return
            const barHeight = Math.max(0.5, (point.volume / maxVolume) * (volumeBand - 4))
            const rising = index === 0 ? true : point.price >= points[index - 1].price
            // Brighten bars that beat their same-time baseline and fade the ones
            // below it; the colour still means price direction, not volume.
            const reference = baselineAt.get(point.time)
            const ratio = typeof reference === 'number' && reference > 0 ? point.volume / reference : null
            const tone = volumeBarTone(ratio)
            const fill = tone?.fill ?? (rising ? up : 'var(--dshst-down)')
            const fillOpacity = tone?.fillOpacity ?? 0.5
            const hovered = hover === index
            if (typeof reference === 'number' && reference > 0) {
              const ghostHeight = Math.max(0.5, (reference / maxVolume) * (volumeBand - 4))
              children.push(
                h('rect', {
                  key: `gv${index}`,
                  x: scaleX(index),
                  y: height - ghostHeight,
                  width: barWidth,
                  height: ghostHeight,
                  style: {
                    fill: 'var(--dsw-alias-label-secondary)',
                    fillOpacity: 0.12,
                    stroke: 'var(--dsw-alias-label-secondary)',
                    strokeOpacity: 0.35,
                    strokeWidth: 0.5,
                  },
                  pointerEvents: 'none',
                }),
              )
            }
            children.push(
              h('rect', {
                key: `v${index}`,
                x: scaleX(index),
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
            const x = scaleX(index)
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
                style: { stroke: 'var(--dsw-alias-label-secondary)', strokeDasharray: '2 3', strokeOpacity: 0.75 },
                strokeWidth: 1,
                vectorEffect: 'non-scaling-stroke',
              }),
            )
          }
        }
      }

      const yLabels = yTicks.map((tick) => ({
        text:
          tick.pct !== null
            ? `${tick.pct > 0 ? '+' : ''}${tick.pct.toFixed(2)}%`
            : formatPrice(tick.value),
        top: (scaleY(tick.value) / height) * 100,
      }))
      const xLabels =
        timeAxis && totalDays === 1
          ? props.market === 'hk'
            ? ['09:30', '12:00/13:00', '16:00']
            : ['09:30', '11:30/13:00', '15:00']
          : [points[0]?.time, points[Math.floor(points.length / 2)]?.time, points[points.length - 1]?.time]

      const active = hover !== null ? points[hover] : null
      const activeReference = active ? baselineAt.get(active.time) : undefined
      const activeRatio =
        active && typeof active.volume === 'number' && typeof activeReference === 'number' && activeReference > 0
          ? active.volume / activeReference
          : null
      const activeSignal = activeRatio === null ? null : activeRatio > 1 ? 'up' : activeRatio < 1 ? 'down' : 'flat'
      const activeStrength = activeRatio === null ? 'mild' : activeRatio >= 1.5 ? 'strong' : activeRatio >= 1.15 ? 'medium' : 'mild'
      const activeLabel =
        activeSignal === 'up' ? t('volumeExpand') : activeSignal === 'down' ? t('volumeShrink') : t('volumeFlat')
      return h(
        'div',
        { className: 'dshst-chartWrap', style: { maxWidth: '1040px', margin: '0 auto' } },
        h(
          'svg',
          {
            className: 'dshst-chart',
            viewBox: `0 0 ${width} ${height}`,
            preserveAspectRatio: 'none',
            role: 'img',
            'aria-label': props.label ?? '',
            style: {
              width: '100%',
              height: 'auto',
              aspectRatio: `${width} / ${height}`,
              display: 'block',
              cursor: 'crosshair',
            },
            onMouseDown: (event) => {
              const index = indexAt(event)
              if (index === null) return
              event.preventDefault?.()
              drag.current = { start: index, end: index }
              setHover(index)
            },
            onMouseMove: (event) => {
              const index = indexAt(event)
              if (index === null) return
              setHover(index)
              if (drag.current) {
                drag.current.end = index
                setRange(
                  index === drag.current.start
                    ? null
                    : { start: Math.min(drag.current.start, index), end: Math.max(drag.current.start, index) },
                )
              }
            },
            onMouseUp: (event) => {
              if (!drag.current) return
              const index = indexAt(event) ?? drag.current.end
              const start = drag.current.start
              drag.current = null
              setRange(index === start ? null : { start: Math.min(start, index), end: Math.max(start, index) })
            },
            onMouseLeave: () => {
              drag.current = null
              setHover(null)
            },
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
          const strength = ratio >= 1.5 ? 'strong' : ratio >= 1.15 ? 'medium' : 'mild'
          const label = signal === 'up' ? t('volumeExpand') : signal === 'down' ? t('volumeShrink') : t('volumeFlat')
          const arrow = signal === 'up' ? '↑' : signal === 'down' ? '↓' : '→'
          return h(
            'div',
            { className: 'dshst-chartNote' },
            h('span', { className: 'dshst-volumeSignal', 'data-trend': signal, 'data-strength': strength }, `${label} ${arrow}`),
            h('span', null, `${t('volumeCompare')} `, h('b', null, ratio.toFixed(2))),
          )
        })(),
        baselineDays > 0 && baselineAt.size > 0 ? h(VolumeLegend, { t }) : null,
        selectedRange
          ? h(RangeSummary, {
              t,
              title: `${t('range')} ${rangeLabel(points[selectedRange.start])} → ${rangeLabel(
                points[selectedRange.end],
              )} · ${selectedRange.end - selectedRange.start + 1}${t('rangeMinutes')}`,
              change: selectedRange.change,
              changePct: selectedRange.changePct,
              highText: `${formatPrice(selectedRange.highPoint.price)} (${rangeLabel(selectedRange.highPoint)})`,
              lowText: `${formatPrice(selectedRange.lowPoint.price)} (${rangeLabel(selectedRange.lowPoint)})`,
              spread: selectedRange.spread,
              spreadPct: selectedRange.spreadPct,
              amplitude: selectedRange.amplitude,
              volume: selectedRange.volume,
              onClear: () => setRange(null),
            })
          : null,
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
                    { className: 'dshst-volumeSignal', 'data-trend': activeSignal, 'data-strength': activeStrength },
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
      const { quote, t, onClose, cycle, klineDays, prefs, onPrefs, onReload, compareOptions = [] } = props
      const trend = trendClass(quote.changePct)
      const tabs = DETAIL_TABS.filter((tab) => {
        if (tab.id === 'trend') return quote.market !== 'us'
        if (tab.kline && tab.id !== 'day' && tab.id !== 'week' && tab.id !== 'month') return quote.market === 'cn'
        return true
      })
      const initialTab = tabs.some((tab) => tab.id === prefs.defaultPeriod) ? prefs.defaultPeriod : tabs[0]?.id ?? 'day'
      const [tab, setTab] = useState(initialTab)
      const [adjust, setAdjust] = useState(prefs.adjust)
      const [historyYears, setHistoryYears] = useState(0)
      const [minuteLimit, setMinuteLimit] = useState(96)
      const [historyLoad, setHistoryLoad] = useState(null)
      const [compareSymbol, setCompareSymbol] = useState('')
      const [compare, setCompare] = useState(null)
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
      const minuteTab = tab === 'm5' || tab === 'm15' || tab === 'm30' || tab === 'm60'
      const maxMinute = quote.market === 'cn' ? (tab === 'm60' ? 4111 : 5001) : 640
      const historyBars = tab === 'day' ? 250 : tab === 'week' ? 52 : 12
      const klineLimit = isTrend
        ? 0
        : tab === 'm5' || tab === 'm15' || tab === 'm30' || tab === 'm60'
          ? minuteLimit
          : tab === 'day'
            ? historyYears
              ? historyYears * historyBars
              : Math.max(10, Math.min(klineDays ?? 60, 120))
            : historyYears
              ? historyYears * historyBars
              : 60
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
        const key = `${tab}:${adjust}:${isTrend ? trendDays : klineLimit}`
        const entry = seriesRef.current[key]
        // Consumed once: a retry must refresh one fetch, not turn every later
        // poll into a cache-bypassing request.
        const force = forceNext.current
        forceNext.current = false
        if (entry && !force) {
          if (!entry.ok) return undefined
          // The intraday line moves continuously; a K-line page can still gain
          // a bar at the session boundary while the panel stays open. Refresh
          // either after 30 s (trend) or 60 s (K-line) so the big chart never
          // shows a window that has become days old.
          const staleAfter = isTrend ? 30_000 : 60_000
          if (Date.now() - entry.at <= staleAfter) return undefined
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
                  `/kline?symbol=${encodeURIComponent(quote.symbol)}&period=${tab}&adjust=${adjust}&limit=${klineLimit}${
                    force || entry ? '&refresh=1' : ''
                  }`,
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
      }, [quote.symbol, tab, adjust, historyYears, trendDays, cycle, retryToken, klineDays, isTrend])

      const compareName =
        compareOptions.find((option) => option.symbol === compareSymbol)?.name ?? compareSymbol
      useEffect(() => {
        if (compareSymbol === '') {
          setCompare(null)
          return undefined
        }
        let cancelled = false
        const loadCompare = async () => {
          try {
            const payload = isTrend
              ? await api(`/trend?symbol=${encodeURIComponent(compareSymbol)}&days=${trendDays}`)
              : await api(
                  `/kline?symbol=${encodeURIComponent(compareSymbol)}&period=${tab}&adjust=${adjust}&limit=${klineLimit}`,
                )
            if (!cancelled && payload.ok === true) {
              setCompare({ kind: isTrend ? 'trend' : 'kline', payload })
            }
          } catch {
            if (!cancelled) setCompare(null)
          }
        }
        loadCompare()
        const timer = window.setInterval(loadCompare, isTrend ? 15_000 : 60_000)
        return () => {
          cancelled = true
          window.clearInterval(timer)
        }
      }, [compareSymbol, isTrend, tab, adjust, trendDays, klineLimit])

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

      const loadMinuteHistory = async (target) => {
        if (historyLoad?.loading || !minuteTab) return
        const desired = Math.min(maxMinute, Math.max(minuteLimit, Math.round(target)))
        if (desired <= minuteLimit) return
        const steps = []
        for (let next = Math.max(1000, minuteLimit + 1000); next < desired; next += 1000) steps.push(next)
        steps.push(desired)
        let best = minuteLimit
        setHistoryLoad({ loading: true, loaded: best, target: desired, error: '' })
        try {
          for (const step of steps) {
            const payload = await api(
              `/kline?symbol=${encodeURIComponent(quote.symbol)}&period=${tab}&adjust=${adjust}&limit=${step}`,
            )
            if (payload.ok !== true) throw new Error(payload.error || 'history-failed')
            best = Math.max(best, Array.isArray(payload.rows) ? payload.rows.length : 0)
            setHistoryLoad({ loading: true, loaded: best, target: desired, error: '' })
            if (best >= desired) break
          }
          setMinuteLimit(best)
          setHistoryLoad({ loading: false, loaded: best, target: desired, error: '' })
        } catch (failure) {
          setMinuteLimit(best)
          setHistoryLoad({
            loading: false,
            loaded: best,
            target: desired,
            error: String(failure?.message ?? failure),
          })
        }
      }

      const seriesKey = `${tab}:${adjust}:${isTrend ? trendDays : klineLimit}`
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
            days: trendDays,
            market: quote.market,
            compare:
              isTrend && compare?.kind === 'trend'
                ? {
                    points: compare.payload.points,
                    prevClose: compare.payload.prevClose,
                    label: compareName,
                  }
                : null,
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
        return h(EChartKline, {
          rows: entry.payload.rows,
          width: 640,
          height: 164,
          block: true,
          grid: true,
          period: tab,
          showMA,
          showVolume,
          maPeriods: prefs.maPeriods,
          colorMode: prefs.colorMode,
          holdingCost: holding?.cost,
          compareRows: !isTrend && compare?.kind === 'kline' ? compare.payload.rows : null,
          compareLabel: compareName,
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
          h(
            'button',
            {
              type: 'button',
              className: 'dshst-detailClose',
              onClick: onClose,
              title: t('close'),
              'aria-label': t('close'),
            },
            '×',
          ),
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
                    setMinuteLimit(96)
                    setHistoryLoad(null)
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
          h(
            'select',
            {
              className: 'dshst-select',
              value: compareSymbol,
              'aria-label': t('compare'),
              onChange: (event) => setCompareSymbol(event.target.value),
            },
            h('option', { value: '' }, t('compareNone')),
            ...compareOptions
              .filter((option) => option.symbol !== quote.symbol)
              .map((option) => h('option', { key: option.symbol, value: option.symbol }, option.name)),
          ),
          ADJUST_TABS.has(tab)
            ? h(
                'span',
                { className: 'dshst-seg', title: t('historyYears') },
                ...[1, 3, 5].map((years) =>
                  h(
                    'button',
                    {
                      key: years,
                      type: 'button',
                      className: 'dshst-toggle',
                      'data-active': historyYears === years ? 'true' : 'false',
                      onClick: () => setHistoryYears(historyYears === years ? 0 : years),
                    },
                    `${years}${t('years')}`,
                  ),
                ),
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
        minuteTab
          ? h(
              'div',
              { className: 'dshst-historyTools' },
              h('span', { className: 'dshst-hint' }, t('historyCurrent').replace('{n}', String(minuteLimit))),
              minuteLimit < maxMinute && maxMinute > 1000
                ? h(
                    'button',
                    {
                      type: 'button',
                      className: 'dshst-historyButton',
                      disabled: historyLoad?.loading,
                      onClick: () => loadMinuteHistory(minuteLimit < 1000 ? 1000 : minuteLimit + 1000),
                    },
                    `${t('loadMoreHistory')} · ${Math.min(maxMinute, minuteLimit < 1000 ? 1000 : minuteLimit + 1000)}`,
                  )
                : null,
              minuteLimit < maxMinute
                ? h(
                    'button',
                    {
                      type: 'button',
                      className: 'dshst-historyButton',
                      disabled: historyLoad?.loading,
                      onClick: () => loadMinuteHistory(maxMinute),
                    },
                    t('loadAllHistory'),
                  )
                : null,
            )
          : null,
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
        historyLoad
          ? h(
              'div',
              { className: 'dshst-historyLoad' },
              h(
                'div',
                { className: 'dshst-historyBar' },
                h('i', {
                  style: {
                    width: `${historyLoad.target > 0 ? Math.min(100, (historyLoad.loaded / historyLoad.target) * 100) : 0}%`,
                  },
                }),
              ),
              h(
                'span',
                { className: 'dshst-hint' },
                historyLoad.loading
                  ? `${t('historyLoading')} ${historyLoad.loaded} / ${historyLoad.target}`
                  : historyLoad.error
                    ? t('historyPartial').replace('{n}', String(historyLoad.loaded))
                    : t('historyLoaded').replace('{n}', String(historyLoad.loaded)),
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
      const { t, symbols, group, onDone } = props
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
            const groupList = payload?.groups?.find((entry) => entry.id === group)?.symbols
            const list = Array.isArray(groupList) ? groupList : payload?.settings?.symbols
            if (!cancelled && Array.isArray(list) && list.length > 0) setText(list.join('\n'))
          } catch {
            /* keep the empty box; typing a fresh list still works */
          }
          if (!cancelled) setReady(true)
        })()
        return () => {
          cancelled = true
        }
      }, [ready, group])

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
            body: JSON.stringify({ symbols: items, group: group ?? 'default' }),
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
      }, [text, group, t, onDone])

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
      for (const property of ['flex-wrap', 'width', 'row-gap']) remember(container, property)
      for (const property of ['order', 'flex', 'width', 'min-width']) remember(item, property)

      // `wrap` is written with priority so a future stylesheet `!important`
      // cannot keep the dock on one line; the item styles stay normal because
      // the root's own `flex: 1 1 auto` rule is not important. The dock is a
      // fit-content flex item in a centered column, so without this its width
      // tracks the number of cards and the footer buttons move between groups.
      container.style.setProperty('flex-wrap', 'wrap', 'important')
      container.style.setProperty('width', '100%')
      // The zero-height break still sits in a flex line; keep the column gap
      // but shrink the two row gaps it creates, otherwise the native pills and
      // the strip look like two unrelated blocks.
      container.style.setProperty('row-gap', '0px')
      // DSH's own token/context pills also participate in this dock. Keep them
      // in the row above and force our strip to the final row. A zero-height
      // full-width spacer is the reliable line break: max-width on our item
      // otherwise makes it fit beside the pills without wrapping.
      item.style.setProperty('order', '1000000')
      item.style.setProperty('flex', '0 0 100%')
      item.style.setProperty('width', '100%')
      item.style.setProperty('min-width', '0')
      let spacer
      if (typeof document !== 'undefined' && typeof document.createElement === 'function') {
        const candidate = document.createElement('div')
        if (candidate?.style) {
          spacer = candidate
          spacer.setAttribute('aria-hidden', 'true')
          spacer.style.cssText =
            'flex:0 0 100%;width:100%;height:0;min-height:0;margin:0;padding:0;pointer-events:none;order:999999'
          container.appendChild(spacer)
        }
      }

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
        if (spacer?.parentElement === container) container.removeChild(spacer)
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
      const [pendingGroup, setPendingGroup] = useState(null)
      const pendingGroupRef = useRef(null)
      const [selected, setSelected] = useState(null)
      const [notice, setNotice] = useState('')
      const [failures, setFailures] = useState(0)
      const [toast, setToast] = useState([])
      const prefsRef = useRef({})
      const active = props.active !== false
      const [sparks, setSparks] = useState({})
      const [volumeAlerts, setVolumeAlerts] = useState({})
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
      const [thumbDragging, setThumbDragging] = useState(false)
      const scrollDrag = useRef(null)
      const setStripScroll = (ratio) => {
        const element = stripRef.current
        if (!element) return
        const max = Math.max(0, element.scrollWidth - element.clientWidth)
        element.scrollLeft = Math.min(1, Math.max(0, ratio)) * max
      }
      const startThumbDrag = (event) => {
        const element = stripRef.current
        if (!element) return
        event.preventDefault?.()
        event.stopPropagation?.()
        const track = event.currentTarget.parentElement
        const trackWidth = track?.getBoundingClientRect?.().width ?? 0
        const thumbWidth = event.currentTarget.getBoundingClientRect?.().width ?? 0
        setThumbDragging(true)
        scrollDrag.current = {
          x: event.clientX,
          startLeft: element.scrollLeft,
          max: Math.max(0, element.scrollWidth - element.clientWidth),
          travel: Math.max(1, trackWidth - thumbWidth),
        }
        event.currentTarget.setPointerCapture?.(event.pointerId)
      }
      const moveThumbDrag = (event) => {
        const drag = scrollDrag.current
        const element = stripRef.current
        if (!drag || !element) return
        const delta = event.clientX - drag.x
        element.scrollLeft = Math.min(drag.max, Math.max(0, drag.startLeft + (delta / drag.travel) * drag.max))
      }
      const endThumbDrag = (event) => {
        scrollDrag.current = null
        setThumbDragging(false)
        event?.currentTarget?.releasePointerCapture?.(event.pointerId)
      }
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

      const load = useCallback(async (options = {}) => {
        const force = options?.force === true
        const group = typeof options?.group === 'string' && options.group !== '' ? options.group : ''
        if (!active) return
        if (typeof document !== 'undefined' && document.hidden) return
        if (pendingGroupRef.current && group !== pendingGroupRef.current) return
        // A request that never settles must not freeze every later tick. A group
        // switch or a manual refresh is allowed to supersede it; the sequence
        // guard below drops the older answer instead of overwriting the new one.
        if (!force && refreshing.current.busy && Date.now() - refreshing.current.startedAt < 20_000) return
        const seq = (loadSeq.current += 1)
        window.clearTimeout(spinTimer.current)
        spinTimer.current = 0
        refreshing.current.busy = true
        refreshing.current.startedAt = Date.now()
        const startedAt = refreshing.current.startedAt
        setBusy(true)
        try {
          const forced = prefsRef.current.source && prefsRef.current.source !== 'auto' ? `&source=${prefsRef.current.source}` : ''
          const groupParam = group ? `&group=${encodeURIComponent(group)}` : ''
          const payload = await api(`/quotes?sparklines=0${forced}${groupParam}`, { timeout: 9000 })
          if (!alive.current || seq !== loadSeq.current) return
          if (payload.ok !== true) throw new Error(payload.error || 'quotes-failed')
          setData(payload)
          setError('')
          setFailures(0)
          if (Array.isArray(payload.fired) && payload.fired.length > 0 && payload.settings?.alertToast !== false) {
            setToast(payload.fired)
          }
        } catch (failure) {
          if (!alive.current || seq !== loadSeq.current) return
          setError(describeLoadError(failure, t))
          setFailures((count) => count + 1)
        } finally {
          // Only the newest request owns the busy/loading state; a stale answer
          // must not clear the indicator of the request that replaced it.
          if (seq === loadSeq.current) {
            refreshing.current.busy = false
            if (alive.current) setLoading(false)
            if (alive.current) {
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
        }
      }, [t, active])

      const manualRefresh = useCallback(async () => {
        await load({ force: true })
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

      const volumeAlertOn = data?.settings?.volumeAlert === true
      const volumeAlertPct = data?.settings?.volumeAlertPct ?? 100
      const tradingNow = data?.session?.mode === 'trading'
      useEffect(() => {
        if (!active || !volumeAlertOn || !tradingNow || symbolKey === '') {
          setVolumeAlerts({})
          return undefined
        }
        let cancelled = false
        const loadAlerts = async () => {
          try {
            const payload = await api(
              `/volume-alerts?symbols=${encodeURIComponent(symbolKey)}&pct=${encodeURIComponent(volumeAlertPct)}`,
            )
            if (!cancelled && payload?.ok === true) setVolumeAlerts(payload.alerts ?? {})
          } catch {
            /* the bubble is optional; never break the strip */
          }
        }
        loadAlerts()
        const timer = window.setInterval(loadAlerts, 30_000)
        return () => {
          cancelled = true
          window.clearInterval(timer)
        }
      }, [active, volumeAlertOn, tradingNow, symbolKey, volumeAlertPct])

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
      }, [symbols.join(','), collapsed, formOpen, measureStrip])

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
        if (pendingGroupRef.current || id === data?.activeGroup) return
        pendingGroupRef.current = id
        setPendingGroup(id)
        loadSeq.current += 1
        refreshing.current.busy = false
        setFormOpen(false)
        setSelected(null)
        try {
          const payload = await api('/groups', { method: 'POST', body: { action: 'activate', id } })
          if (payload.ok !== true) throw new Error(payload.error || 'group-switch-failed')
          if (alive.current) await load({ force: true, group: id })
        } catch (failure) {
          if (alive.current) flashNotice(String(failure?.message ?? failure))
        } finally {
          pendingGroupRef.current = null
          if (alive.current) {
            setPendingGroup(null)
            if (!refreshing.current.busy) setBusy(false)
          }
        }
      }

      const moveGroup = (from, to) => {
        if (from === to || from < 0 || to < 0) return
        const list = Array.isArray(data?.groups) ? data.groups.slice() : []
        if (from >= list.length || to >= list.length) return
        const [item] = list.splice(from, 1)
        if (!item) return
        list.splice(to, 0, item)
        setData((current) => (current ? { ...current, groups: list } : current))
        api('/groups', { method: 'POST', body: { action: 'reorder', order: list.map((group) => group.id) } })
          .then((payload) => {
            if (payload.ok !== true) throw new Error(payload.error || 'group-reorder-failed')
          })
          .catch((failure) => {
            flashNotice(String(failure?.message ?? failure))
            load()
          })
      }

      const startGroupDrag = (index, event) => {
        try {
          event.dataTransfer?.setData('text/plain', String(index))
          if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move'
        } catch {
          /* browsers may refuse drag data */
        }
        groupDragRef.current = true
        setGroupDrag({ from: index, over: index })
      }
      const overGroup = (index) => {
        if (!groupDragRef.current) return
        setGroupDrag((current) => (current && current.over === index ? current : current ? { ...current, over: index } : current))
      }
      const dropGroup = (index) => {
        const current = groupDrag
        groupDragRef.current = false
        groupDragEndedAt.current = Date.now()
        setGroupDrag(null)
        if (current) moveGroup(current.from, index)
      }
      const endGroupDrag = () => {
        groupDragRef.current = false
        groupDragEndedAt.current = Date.now()
        setGroupDrag(null)
      }

      const acknowledge = async (entries) => {
        setToast([])
        for (const entry of entries) {
          await api('/alerts', { method: 'POST', body: { action: 'ack', id: entry.id } }).catch(() => undefined)
        }
        load()
      }

      const saveSymbols = async (list) => {
        if (pendingGroupRef.current || !data?.activeGroup) return
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
        // Put the new order on screen before the round trip; the drag preview is
        // already showing the same gap, so the drop lands where the user aimed.
        const bySymbol = new Map(quotes.map((quote) => [quote.symbol, quote]))
        const reordered = next.map((symbol) => bySymbol.get(symbol)).filter(Boolean)
        setData((current) => (current ? { ...current, symbols: next, quotes: reordered } : current))
        saveSymbols(next)
      }

      const [dragPreview, setDragPreview] = useState(null)
      const dragPreviewRef = useRef(null)
      const [groupDrag, setGroupDrag] = useState(null)
      const groupDragRef = useRef(false)
      const groupDragEndedAt = useRef(0)
      const updateDragPreview = (next) => {
        dragPreviewRef.current = next
        setDragPreview(next)
      }
      const startCardDrag = (from, event) => {
        const width = event?.currentTarget?.getBoundingClientRect?.().width || 132
        updateDragPreview({ from, over: from, width })
      }
      const overCard = (index) => {
        const current = dragPreviewRef.current
        if (!current || current.over === index) return
        updateDragPreview({ ...current, over: index })
      }
      const dropCard = (index) => {
        const current = dragPreviewRef.current
        updateDragPreview(null)
        if (current) moveSymbol(current.from, index)
      }
      const endCardDrag = () => updateDragPreview(null)

      const onCardSelect = (symbol) => {
        // A drag that scrolled the strip must not also open a card.
        if (dragState.current.moved) {
          dragState.current.moved = false
          return
        }
        setSelected((current) => (current === symbol ? null : symbol))
      }

      const body = (() => {
        if (pendingGroup) return h('div', { className: 'dshst-note' }, t('loading'))
        if (formOpen) {
          return h(SymbolForm, {
            key: data?.activeGroup,
            t,
            group: data?.activeGroup ?? 'default',
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
                onDragOver: (event) => {
                  const preview = dragPreviewRef.current
                  if (!preview) return
                  event.preventDefault?.()
                  if (event.dataTransfer) event.dataTransfer.dropEffect = 'move'
                  const strip = stripRef.current
                  const cards = strip && typeof strip.querySelectorAll === 'function' ? [...strip.querySelectorAll('[data-symbol]')] : []
                  if (cards.length === 0) return
                  const x = event.clientX
                  let next = cards.length - 1
                  for (let index = 0; index < cards.length; index += 1) {
                    const rect = cards[index].getBoundingClientRect()
                    if (x < rect.left + rect.width / 2) {
                      next = index
                      break
                    }
                  }
                  overCard(next)
                },
                onDrop: (event) => {
                  if (!dragPreviewRef.current) return
                  event.preventDefault?.()
                  const strip = stripRef.current
                  const cards = strip && typeof strip.querySelectorAll === 'function' ? [...strip.querySelectorAll('[data-symbol]')] : []
                  if (cards.length === 0) {
                    endCardDrag()
                    return
                  }
                  const x = event.clientX
                  let next = cards.length - 1
                  for (let index = 0; index < cards.length; index += 1) {
                    const rect = cards[index].getBoundingClientRect()
                    if (x < rect.left + rect.width / 2) {
                      next = index
                      break
                    }
                  }
                  dropCard(next)
                },
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
              ...quotes.map((quote, index) => {
                const preview = dragPreview
                const from = preview?.from ?? -1
                const over = preview?.over ?? -1
                const headingRight = from < over
                const headingLeft = from > over
                const shift =
                  preview && from !== over
                    ? headingRight && index > from && index <= over
                      ? -(preview.width + 6)
                      : headingLeft && index >= over && index < from
                        ? preview.width + 6
                        : 0
                    : 0
                return h(QuoteCard, {
                  key: quote.symbol,
                  quote,
                  index,
                  t,
                  dragShift: shift,
                  dragSource: preview ? index === from : false,
                  onDragStart: startCardDrag,
                  onDragOver: overCard,
                  onDrop: dropCard,
                  onDragEnd: endCardDrag,
                  previewDays: prefs.klineDays,
                  sourceDot: prefs.sourceDot !== false,
                  selected: selected === quote.symbol,
                  chart: prefs.showMiniChart === false ? null : sparks[quote.symbol],
                  pulse: manualPulse,
                  showMiniChart: prefs.showMiniChart !== false,
                  showLogos: prefs.showLogos !== false,
                  showExtended: prefs.showExtended === true,
                  volumeAlert: chartType === 'intraday' ? volumeAlerts[quote.symbol] ?? null : null,
                  onSelect: () => onCardSelect(quote.symbol),
                  onRemove: () => removeSymbol(quote.symbol),
                })
              }),
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
                  {
                    className: 'dshst-scrollTrack',
                    'aria-hidden': true,
                    onPointerDown: (event) => {
                      if (event.target !== event.currentTarget) return
                      const rect = event.currentTarget.getBoundingClientRect()
                      if (rect.width > 0) setStripScroll((event.clientX - rect.left) / rect.width)
                    },
                  },
                  h('div', {
                    className: 'dshst-scrollThumb',
                    style: { left: `${scrollRatio * 84}%` },
                    'data-dragging': thumbDragging ? 'true' : 'false',
                    onPointerDown: startThumbDrag,
                    onPointerMove: moveThumbDrag,
                    onPointerUp: endThumbDrag,
                    onPointerCancel: endThumbDrag,
                  }),
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
                compareOptions: quotes
                  .filter((row) => !row.error)
                  .map((row) => ({ symbol: row.symbol, name: row.name ?? row.symbol })),
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
        h(
          'div',
          { className: 'dshst-foot' },
          h(
            'div',
            { className: 'dshst-head' },
            h(
              'div',
              { className: 'dshst-headTop' },
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
            ),
          ),
          groups.length > 1
          ? h(
              'span',
              { className: 'dshst-groups' },
              ...groups.map((group, index) =>
                h(
                  'button',
                  {
                    key: group.id,
                    type: 'button',
                    className: 'dshst-pill',
                    draggable: true,
                    'data-active': (pendingGroup ?? data?.activeGroup) === group.id ? 'true' : 'false',
                    'data-dragging': groupDrag?.from === index ? 'true' : 'false',
                    'data-drop': groupDrag && groupDrag.from !== groupDrag.over && groupDrag.over === index ? 'true' : 'false',
                    title: `${group.name} (${group.count})`,
                    onClick: () => {
                      if (Date.now() - groupDragEndedAt.current < 250) return
                      switchGroup(group.id)
                    },
                    onDragStart: (event) => startGroupDrag(index, event),
                    onDragOver: (event) => {
                      event.preventDefault?.()
                      if (event.dataTransfer) event.dataTransfer.dropEffect = 'move'
                      overGroup(index)
                    },
                    onDrop: (event) => {
                      event.preventDefault?.()
                      event.stopPropagation?.()
                      dropGroup(index)
                    },
                    onDragEnd: endGroupDrag,
                  },
                  h('span', { className: 'dshst-pillName' }, group.name),
                  h(
                    'span',
                    { className: 'dshst-pillCount', 'data-empty': group.count === 0 ? 'true' : 'false' },
                    String(group.count),
                  ),
                ),
              ),
            )
          : null,
          h('span', { className: 'dshst-spacer' }),
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
            'data-toggle': 'true',
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
      const [cacheBytes, setCacheBytes] = useState(null)
      const [clearing, setClearing] = useState(false)
      const [settingsTab, setSettingsTab] = useState('general')

      useEffect(() => {
        let cancelled = false
        api('/cache')
          .then((payload) => {
            if (!cancelled && payload?.ok === true) setCacheBytes(Number(payload.bytes) || 0)
          })
          .catch(() => {})
        return () => {
          cancelled = true
        }
      }, [])

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

      const clearCache = async () => {
        setClearing(true)
        try {
          const payload = await api('/cache/clear', { method: 'POST' })
          if (payload.ok !== true) throw new Error(payload.error || 'cache-clear-failed')
          setCacheBytes(0)
          setSaved(true)
          window.setTimeout(() => setSaved(false), 2000)
        } catch (failure) {
          setError(String(failure?.message ?? failure))
        } finally {
          setClearing(false)
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

      const row = (label, control, section = 'general') =>
        h('div', { className: 'dshst-settingsRow', key: label, 'data-section': section }, h('label', null, label), control)

      const formatBytes = (value) => {
        if (typeof value !== 'number' || !Number.isFinite(value)) return t('loading')
        if (value < 1024) return `${value} B`
        if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`
        return `${(value / 1024 / 1024).toFixed(1)} MB`
      }

      return h(
        'div',
        {
          className: 'dshst dshst-settings',
          'data-scheme': prefs.colorMode === 'intl' ? 'intl' : 'cn',
          'data-tab': settingsTab,
        },
        h(
          'div',
          { className: 'dshst-settingsTabs', role: 'tablist' },
          ...[
            ['general', t('settingsTabGeneral')],
            ['charts', t('settingsTabCharts')],
            ['alerts', t('settingsTabAlerts')],
            ['groups', t('settingsTabGroups')],
          ].map(([id, label]) =>
            h(
              'button',
              {
                key: id,
                type: 'button',
                role: 'tab',
                className: 'dshst-settingsTab',
                'data-active': settingsTab === id ? 'true' : 'false',
                'aria-selected': settingsTab === id ? 'true' : 'false',
                onClick: () => setSettingsTab(id),
              },
              label,
            ),
          ),
        ),
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
        row(t('showMA'), toggle('showMA', t('showMA')), 'charts'),
        row(
          t('maPeriods'),
          h('input', {
            className: 'dshst-input dshst-inputSmall',
            defaultValue: (prefs.maPeriods ?? MA_WINDOWS).join(','),
            title: '5,10,20,60',
            onBlur: (event) => {
              const next = maPeriodsOf(event.target.value)
              save({ maPeriods: next })
            },
          }),
          'charts',
        ),
        row(t('showVolume'), toggle('showVolume', t('showVolume')), 'charts'),
        row(t('showMiniChart'), toggle('showMiniChart', t('showMiniChart')), 'charts'),
        row(t('showLogos'), toggle('showLogos', t('showLogos')), 'charts'),
        row(t('showOrderBook'), toggle('showOrderBook', t('showOrderBook')), 'charts'),
        row(t('showStats'), toggle('showStats', t('showStats')), 'charts'),
        row(t('showExtended'), toggle('showExtended', t('showExtended')), 'charts'),
        row(t('alertToast'), toggle('alertToast', t('alertToast')), 'alerts'),
        row(t('volumeAlert'), toggle('volumeAlert', t('volumeAlert')), 'alerts'),
        row(
          t('volumeAlertPct'),
          h('input', {
            className: 'dshst-input dshst-inputSmall',
            type: 'number',
            min: 10,
            max: 500,
            value: prefs.volumeAlertPct ?? 100,
            onChange: (event) => save({ volumeAlertPct: Number(event.target.value) }),
          }),
          'alerts',
        ),
        row(t('sourceDot'), toggle('sourceDot', t('sourceDot')), 'charts'),
        row(
          t('chartCache'),
          h(
            'div',
            { className: 'dshst-cacheRow' },
            h('span', { className: 'dshst-hint' }, formatBytes(cacheBytes)),
            h(
              'button',
              { type: 'button', className: 'dshst-link', onClick: clearCache, disabled: clearing },
              t('clearCache'),
            ),
          ),
        ),
        h(
          'div',
          { className: 'dshst-settingsGroup', 'data-section': 'groups' },
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
