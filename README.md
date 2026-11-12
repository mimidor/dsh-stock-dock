# dsh-stock-ticker

**中文** · [English](README.en.md)

![version](https://img.shields.io/badge/version-1.1.1-blue)
![license](https://img.shields.io/badge/license-MIT-green)
![dsh](https://img.shields.io/badge/DSH-0.2.x-6f5bd6)
![data](https://img.shields.io/badge/data-Tencent%20%7C%20Sina-orange)

钉在 DeepSeek Harness 输入框下方的自选股行情条：A 股 / 港股 / 美股一张横条，名称、代码、价格、涨跌幅、涨跌停标记和迷你 K 线；点开卡片是详情面板，分时、5 分钟、日/周/月 K 线、五档盘口和 A 股的量价指标。

> 行情来自公开接口的快照数据，仅供查看，**不构成任何投资建议**，不用于交易决策。

## 功能

- **行情条**：常驻输入框下方，横向滚动；涨红跌绿（可切国际配色），A 股打 `涨停`/`跌停` 标记
- **详情面板**：`分时 / 5分 / 日K / 周K / 月K` 五个页签；日/周/月支持前复权、后复权、不复权
- **分时**：价格线 + 均价虚线 + 昨收虚线，按当日涨跌着色
- **五档盘口**：买卖各五档（价 + 量）和委比
- **A 股指标**：成交额、换手率、量比、振幅、市盈率、市净率、流通市值 / 总市值
- **标的可配**：行情条上的滑杆按钮直接改，保存到 profile 配置；也可编辑 `cordis.patch.yml`
- **省电的刷新**：按交易时段给节奏（盘中正常刷、休市 ≥30s、收盘 ≥60s），标签页隐藏或配置面板打开时暂停，连续失败退避到最长 2 分钟
- **备源**：腾讯取不到行情时自动切新浪，头部会显示当前数据源

## 安装

本仓库本身就是可安装的 bundle（`package.json` 与 `cordis.patch.yml` 在根目录）。

```text
plugin_manager  action: install_bundle  target: github:mimidor/dsh-stock-ticker
```

或者克隆后指向目录：

```text
plugin_manager  action: install_bundle  target: /path/to/dsh-stock-ticker
```

要求 DSH 0.2.x，且开启了 Web GUI（插件用 `ctx.webServer` 注册同源路由）。安装后**刷新页面**：打包版桌面应用没有 ⌘R 快捷键，请退出重开，或在「Developer tools」里刷新。

## 使用

| 操作 | 怎么做 |
| --- | --- |
| 看行情 | 输入框下方自动出现，每张卡显示名称 / 代码 / 价格 / 涨跌幅 / 迷你日 K |
| 看详情 | 点卡片展开，再点一次或按「关闭」收起 |
| 切图表 | 详情里的 `分时 / 5分 / 日K / 周K / 月K` |
| 改标的 | 头部滑杆按钮 → 一行一个 → 保存（写入 profile 的配置并热重启插件） |
| 手动刷新 | 头部 ↻ |
| 收起行情条 | 头部 ⌃（状态记在浏览器 localStorage） |

标的写法很宽松：`600519`、`sh600519`、`600519.SH`、`00700`、`hk00700`、`00700.HK`、`AAPL`、`usAAPL` 都能识别，最多 30 个。裸 6 位代码按首位判断市场，裸 5 位数字按港股处理。

## 配置

`cordis.patch.yml`（或用行情条上的表单，两者写同一份配置）：

```yaml
- id: stock-ticker
  name: "@local/dsh-stock-ticker"
  config:
    symbols: [sh000001, sz399001, sh600519, sh510300, hk00700, usAAPL]
    refreshSeconds: 15   # 5–300，仅盘中直接用这个值
    klineDays: 40        # 10–120，行情条迷你图的天数
    colorMode: cn        # cn = 红涨绿跌，intl = 绿涨红跌
```

## 数据来源与刷新

| 用途 | 接口 | 缓存 |
| --- | --- | --- |
| 行情 + 五档 + 指标 | `qt.gtimg.cn/q=...`（GBK） | 3s |
| 行情备源 | `hq.sinajs.cn/list=...`（GBK，需 Referer） | 3s |
| 日 / 周 / 月 K，三种复权 | `proxy.finance.qq.com/.../newfqkline/get` | 5 min（失败 60s 重试） |
| 5 分钟 K | `proxy.finance.qq.com/.../kline/mkline` | 60s |
| 分时 | `proxy.finance.qq.com/.../minute/query` | 20s（收盘后 5 min） |

Host 端路由（同源，客户端直接 `fetch`）：

```text
GET  /dsh-stock-ticker/quotes?symbols=...&source=tencent|sina
GET  /dsh-stock-ticker/kline?symbol=...&period=day|week|month|m1|m5|m15|m30|m60&adjust=qfq|hfq|none&limit=40&refresh=1
GET  /dsh-stock-ticker/trend?symbol=...&refresh=1
GET  /dsh-stock-ticker/settings
POST /dsh-stock-ticker/config           # 仅本机页面可写（Origin / Host 校验）
```

刷新节奏由 Host 按上海时间判断三地市场状态后给出：盘中用 `refreshSeconds`，休市至少 30s，收盘后至少 60s，周末同收盘；失败时客户端按 2ⁿ 退避，最长 120s。

## 已知限制

- 数据源是**腾讯 / 新浪的公开非官方接口**，可能限流、改字段或不可用；没有 SLA，也不会比它们的快照更新。
- A 股的换手率、量比、振幅、涨跌停价等字段对港股 / 美股含义不同，因此只对 A 股展示；指数没有五档，港股的五档腾讯返回 0，所以这两类卡片不显示盘口。
- 分时暂不支持美股（接口只回 1 个点），5 分钟 K 只有 A 股有。
- 只做展示与配置，不涉及下单，不读取会话或 agent 数据。

## 开发与自测

```bash
node scripts/verify.mjs            # 42 项：路由、字段、周期/复权、分时、备源、写保护、客户端装载与注册
node scripts/verify.mjs --offline  # 跳过所有联网检查
```

Host 半区改完需要重启插件（改配置保存一次即可触发热重启），Client 半区改完刷新页面。不带任何运行时依赖，Host 不 import 包外模块，浏览器端只用 `react`。

## 许可

[MIT](LICENSE)
