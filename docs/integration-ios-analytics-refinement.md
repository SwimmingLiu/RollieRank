# iOS 图表化分析接入

## 公共 bridge 导出

新增 `docs/ui-exploration/ios-v3/ui/analytics.tsx`，请在 `ui/bridge.tsx` 转发：

```ts
export { mountAnalyticsReport, mountAnalyticsStats } from "./analytics";
export type { AnalyticsReportProps, AnalyticsStatsProps } from "./analytics";
```

两个 mount 函数都通过现有 `mountRoot` 注册真实 React island，返回清理函数。`AnalyticsReportCard` 和 `AnalyticsDashboard` 也直接导出，供组件专项测试使用。只需统一重新构建 vendor；本任务不写公共编译文件。

## 包装接口与挂载

`features/analytics.js` 继续导出 `createIOSAnalyticsFeature(ctx)`，返回 `statsView(options)`、`afterRender()`、`destroy()`。`ctx` 契约保持不变。包装从当前文档的 `window.RollieUI` 取得上述两个 mount 函数，筛选和选点只更新本模块的原生组件，避免重建整张报告。

`statsView` 返回原生组件宿主。公共页面在插入宿主、完成原生组件 flushSync 后调用 `afterRender()`。省略 `versionId` 时为整体分析；指定版本时仍按 `paperId` 汇集同卷记录，并在评分兼容组内统计。该页面的顶部标题继续由公共 iOS 导航提供，模块不再重复放置主标题和返回段落。

`ui/results.tsx` 中已有的 `analytics-comparison` 宿主默认带 `hidden`。包装只在存在更早的兼容同卷记录时显示它。首刷、样例和缺少可比依据的报告均不渲染说明卡或单点图，也不保留宿主的网格空隙。

估分摘要后、VS 前另提供 `<div data-feature="corrections-status" className="ios-feature-host" />`，交给纠错包装展示实际订正状态。个人记录的工具双卡由公共 `PracticeTools` 组件统一呈现；旧 `analytics-entry` 宿主不存在时，本包装会直接跳过。

`ScoreOverviewProps` 和 `ShareResultProps` 的可选 `verification` 使用 `{ kind: "verified" } | { kind: "legacy" }`。正式答卷不增加状态；示例只在原卡显示静态「示例估分」，报告和分享均不提供手动计分操作。答案订正仍由 `corrections-status` 展示真实更新。

二刷显示原生 VS：总分前后对照、实际变化、得分率与正确率，以及全部实际板块变化。第三次起增加最近最多八次的短曲线。报告区域没有完整筛选、技术规则编号、毫秒时间、键盘说明或全历史表。右上角入口进入同卷完整分析，上一刷分数可进入对应报告。

完整分析使用成熟 Tabs 切换得分率、得分和正确率。题型、计分口径、来源和记录范围使用 beUI BottomSheet；长来源列表提供主题搜索。日期用 React DayPicker 10.0.2 和 beUI Button 组合的主题日历选择，非法范围保留输入并就地反馈。板块题数与满分在口径列表中按需展开，实际签名仍使用原始完整规则，不把同满分的不同规则合并。

## 数据与生命周期

所有评分、兼容、比较对象、时间筛选、分页和图形坐标继续复用 `src/analytics.js`。包装不读取设计 `history`，不保存成绩缓存。纯视图适配导出 `buildIOSReportAnalysis(current, attempts)` 和 `buildIOSStatsAnalysis(attempts, options?, filters?)`，仅供专项验证和组件数据转换。

报告只包含当前提交及严格更早的记录，避免同时间但无法确认先后的其他提交进入报告摘要。独立分析保留全部同时间记录，按既有时间与 ID 顺序展示。曲线可通过方向键、Home、End 或逐次记录选点；每页八次，所有页均可到达。

同步或订正后，公共页面更新 `state.attempts` 并调用渲染流程，包装会重新取得当前快照。页面离开时，断开的宿主及组件会被清理；BottomSheet 复用现有焦点、Escape、遮罩和滚动恢复行为。

## 样式与验证

继续加载 `features/analytics.css`。样式已替换为本模块专用的纸卡、曲线和面板样式，不再导入根应用分析页 CSS。现有白／深灰、浅珊瑚、字体、成绩卡、雷达和分享保持。

专项入口：

```bash
node --test test/ios-analytics*.test.js
```

浏览器专项编译当前 `ui/analytics.tsx`、结果与分享组件到临时目录，在临时 `/ios-v3/` iframe 中操作真实控件，证据保存在 `.beauye/tasks/ios-analytics-refinement/evidence/`。覆盖首刷隐藏、二刷 VS、三刷短曲线、规则与题型筛选、来源、日期、搜索、分页、同时间记录、键盘、焦点、面板清理及 320/390/430 画板和桌面外层。

本轮专项 18 项全部通过，UI 类型检查通过。`validation-summary.json` 固定自有四份源码的哈希、实际测试日志、浏览器检查和截图；未追逐其他对话产生的全目录指纹变化。

公共 app、bridge、records、vendor 和实际 4781 服务由协调对话统一接入；正式提交、学习工具双卡及与岗位、交流、纠错的全场景组合复验仍由协调对话完成。
