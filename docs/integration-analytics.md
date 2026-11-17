# 成长分析接入

四项功能已在公共入口接入，组合流程、构建验收及运行边界见 [公共集成 PR 草稿](pr-feature-integration.md)。

分析模块已按 `docs/parallel-feature-contract.md` 分离。公共入口、现有视图和全局样式由协调对话接入。

## 浏览器模块

```js
import { createAnalyticsFeature } from "./features/analytics.js";

const analytics = createAnalyticsFeature(ctx);
```

工厂仅创建一次，注册 `click`、`change`、`keydown` 三个委托事件。返回 `statsView(args)`、`afterRender()`、`destroy()`。事件使用 `data-analytics-action`、`data-analytics-control`、`data-analytics-chart`，不会注册公共 `data-action`。

`ctx.state()` 返回最新 `{ attempts }`；`ctx.catalog()` 返回版本数组；`ctx.attempt()` 返回当前报告；`ctx.render()` 重新渲染页面。其余契约能力不使用。测试可传入可选 `ctx.document`，正式页面默认使用全局 `document`。

`statsView({ catalog, state, version, versionId })` 返回页面 HTML，可直接替换旧 `statsView` 调用。省略 `versionId` 时展示整体分析。有 `versionId` 时，通过版本或历史记录解析 `paperId`，统计该套卷所有版本，再按评分规则分组；找不到 `paperId` 时退回指定版本。分析记录来自报告快照，版本下线或从目录中移除后仍可查看。

路由需要支持 `#/stats` 与 `#/stats/:versionId`。个人记录入口指向 `#/stats`，同卷链接继续使用现有 `#/stats/:versionId`。

## 挂载与样式

每次公共 DOM 更新后调用 `analytics.afterRender()`。结果页保留 `<div data-feature="analytics-comparison"></div>`，个人记录页保留 `<div data-feature="analytics-entry"></div>`。模块会同步挂载 VS 卡、截至当前提交的同卷多刷曲线和整体分析入口。

在公共 `styles.css` 中加入：

```css
@import "./src/features/analytics.css";
```

所有新增样式均使用 `analytics-` 前缀，并复用现有 `card`、`button` 和主题变量。SVG 图表、原生选择器、日期输入、展开控件和数据表不依赖新增库。

## 替换旧比较逻辑

现有 `src/views-practice.js` 中 `reportView` 的 `.score-comparison` 与题型列表的“上次”文字仍使用旧的同版本比较。请移除旧总分差区域，并将旧题型列表中的 `previous` 选择改为本模块函数，避免同页出现两套比较依据：

```js
import { selectPreviousAttempt } from "./analytics.js";

const previous = selectPreviousAttempt(attempt, state.attempts);
```

`selectPreviousAttempt` 允许同卷不同答案修订版本，但必须满足规则相同且时间严格早于当前提交。跨机构趋势允许同规则合并，结果页上一刷始终只选同一套卷。

## 同步与重算

无需新增服务端路由。父入口完成 `/api/attempts/sync` 后更新 `state.attempts` 并渲染，模块会重新读取报告、签名、对比对象与所有曲线。当前报告也按 ID 优先从最新的 `state.attempts` 取得，避免父入口暂时持有旧对象时显示旧分。

模块仅保存筛选值、分页位置和选中的提交 ID，不缓存成绩。答案修订和重算不会改变签名；题型、题量、权重或折算规则变化会进入另一组。

## 纯数据导出

`src/analytics.js` 导出如下函数：

| 导出 | 返回内容 |
| --- | --- |
| `analyticsTypeKey(row)` | 按完整题型名称生成的对齐键；名称缺失时使用独立的编码键 |
| `describeScoringRule(attemptOrReport)` | `{ valid, signature, code, questionCount, rawMaxCents, maxCents, scale, types }`；无完整依据时为 `{ valid: false, signature: null, reason }` |
| `analyzeAttempt(attempt)` | 报告、规则、整体指标和题型指标；示例或无完整依据时为 `null` |
| `compareAttemptOrder(a, b)` | 提交时间与 ID 的稳定排序 |
| `selectPreviousAttempt(current, attempts)` | 最近一条可比同卷记录，或 `null` |
| `compareAttempts(current, previous)` | 总分、得分率、正确率及题型对比；不可比时为 `null` |
| `analyticsDateBounds(from, to)` | 本地日期的起点、次日终点和有效性 |
| `buildAnalytics(attempts, options)` | 规则分组、当前组、来源、题型、时间序列和排除原因 |
| `paginateTrend(points, page, pageSize)` | 可到达全部记录的分页；默认最近一页，每页 24 条 |
| `buildTrendGeometry(points, options)` | 按真实时间定位的点、坐标轴和在缺失值处断开的线段 |

`buildAnalytics` 的选项为 `paperId`、`versionId`、`ruleSignature`、`dimension`、`metric`、`sourceId`、`from`、`to`、`asOf`。`dimension` 为 `total` 或 `analyticsTypeKey` 返回值；`metric` 为 `totalCents`、`rate` 或 `accuracy`；`sourceId` 为 `all` 或 `paperId`；日期格式为 `YYYY-MM-DD`，起止日均包含；`asOf` 为毫秒时间戳，包含该时刻。

签名保存完整规范 JSON，作为真正分组键。短码 `R-xxxxxxxx` 仅帮助识别规则，不作为分组依据。签名以逐题 `rawMaxCents ?? maxCents` 为基础，包含各题型题量、权重分布及按题号排列的权重序列、原始满分、展示满分、折算方式、比例、舍入及额外计分配置。机构、标题、来源文件、规则 ID 和参考答案不影响签名。同名题型在单份报告内对应多个分组时，模块会标记依据不完整，避免推测分组合并。

## 验证边界

本任务的纯数据和模块行为测试见 `test/analytics.test.js`、`test/analytics-feature.test.js`。浏览器验证见 `test/analytics-browser.test.js`，使用临时端口、人工构造的报告与实际模块、现有页面外壳；不读写日常成绩数据。

```bash
node --test test/analytics*.test.js
npm run build
```

浏览器用例使用本机已安装的 Playwright。未安装时该用例会明确跳过，数据与模块测试仍运行。浏览器证据保存在 `.beauye/tasks/analytics/evidence/`。

公共接入后仍需验证正式提交 → 历史报告 → VS → 同卷分析 → 整体分析的完整流程，以及服务端审核重算 → 同步 → 排名与分析同时更新。独立夹具的结果不代表这些公共链路已经验证。
