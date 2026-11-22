# iOS 成长分析接入

## 包装工厂

模块为 `docs/ui-exploration/ios-v3/features/analytics.js`，导出：

```js
import { createIOSAnalyticsFeature } from "./features/analytics.js";

const analytics = createIOSAnalyticsFeature(ctx);
```

工厂创建一次，返回 `statsView(options?)`、`afterRender()` 和 `destroy()`。它组合现有 `src/features/analytics.js`，不新增评分算法或服务端接口。

`statsView` 使用契约中的 `{ catalog, version, versionId }`。省略 `versionId` 展示整体分析，有值时展示同卷分析。即使调用方提供其他 `state`，分析也只读取当前 `ctx.state().attempts`，不会读取 iOS `history` 或旧设计数据。

`ctx` 使用 `state()`、`catalog()`、`attempt()`、`render()`、`navigate(path)`。可选 `document` 仅供专项测试使用。包装将分析区域内的标准链接交给 `ctx.navigate`；支持 `stats`、`me`、`report/:id` 等契约路由，保留 Ctrl、Meta 及中键的原生链接行为。

当前报告按 ID 从服务状态中重新取得。未标记样例、但找不到对应服务端快照的旧报告，也会在分析区域按样例处理。同步或订正后，更新 `state.attempts` 并渲染即可刷新 VS 和全部曲线。

## 挂载与样式

原生 React islands 完成 flushSync 挂载后，调用 `analytics.afterRender()`。结果组件已在总分、答题摘要和同卷排名之后、雷达图之前增加：

```tsx
<div data-feature="analytics-comparison" className="ios-feature-host" />
```

个人记录页继续提供 `analytics-entry` 挂载点。包装会给这两个宿主增加 `.ios-analytics` 和 `data-ios-analytics`，以限定主题及路由事件的范围。

加载 `features/analytics.css`。该文件引入原分析模块的独立样式，再在 `.ios-feature-host.ios-analytics` 内使用现有字体、白底纸卡、深灰正文和浅珊瑚色。无需引入根应用的 `styles.css` 或侧栏。

## 原生成绩与分享字段

`ui/results.tsx` 中两个公开类型的变更如下，`ui/bridge.tsx` 已有的类型转发和函数签名可继续沿用。

| 类型 | 字段 | 行为 |
| --- | --- | --- |
| `ScoreOverviewProps` | `rank: number \| null` | 空排名、零参与人数或非正名次均显示“未参与排名” |
| `ShareResultProps` | `rank: number \| null` | 与结果页一致，海报也不填入示例名次 |
| 两者 | `maxScore?: number` | 单位为分；缺省 100 仅兼容旧调用 |

真实结果传值：

```js
const standing = positions.standing();
const report = attempt.report;

const resultProps = {
  total: report.totalCents / 100,
  maxScore: report.maxCents / 100,
  correct: report.correct,
  wrong: report.wrong,
  rank: standing.rank,
  participants: standing.count,
  sections: report.breakdown.map(type => ({
    name: type.name,
    earnedCents: type.centsEarned,
    maxCents: type.maxCents,
  })),
};
```

`mountScore` 继续补充 `onRank`、`onReview` 等既有回调；`mountShare` 和 `createSharePoster` 传入相同的真实 `total`、`maxScore`、排名与板块数据，并补齐原有海报身份字段。

结果页正确、错误数量直接使用实际报告。分享的可访问说明按实际聚合板块数生成，不再固定为六个板块。分项进度仍按各板块自己的 `earnedCents / maxCents` 展示；题量与整体满分不改变该口径。

## 专项验证与公共接入边界

专项测试位于 `test/ios-analytics.test.js`、`test/ios-analytics-components.test.js` 和 `test/ios-analytics-browser.test.js`。组件测试把当前 TSX 编译到临时目录，浏览器也使用当前组件的新编译结果，不写入共享 vendor。

```bash
node --test test/ios-analytics*.test.js
```

已验证空排名、零参与人数、真实排名、70/120/37.5 分满分、默认旧调用、五题卷的正确错误数量、实际板块数和分析宿主位置。包装测试验证服务端快照来源、旧样例排除、同规则跨卷、异规则隔离、题型趋势、订正后更新和未来记录排除。

浏览器专项使用临时端口的 `/ios-v3/` iframe，加载真实结果和分享组件、当前原生 CSS 及分析包装；验证白底与字体、路由、键盘、筛选、320/390 像素和桌面 iframe。证据在 `.beauye/tasks/ios-analytics/evidence/`。

已运行 UI 类型检查、现有 bridge 测试、历史模型和板块数据测试，并在内存中成功编译完整 bridge。公共 `app.js`、`service-client.js`、`ui/bridge.tsx`、vendor 与服务入口由协调对话接入。实际 4781 端口的提交、同步、选岗榜单联动、审核重算及旧记录重新核分入口，仍需公共组合验收。
