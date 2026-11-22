# iOS 成长分析与成绩组件方案

`createIOSAnalyticsFeature(ctx)` 组合已有分析工厂，保留规则兼容、上一刷选择、筛选、曲线、键盘操作和数据表。数据只读取 `ctx.state().attempts`，当前对象优先按 ID 从同一状态取得；没有对应服务端答卷的旧记录作为样例处理。包装中的链接通过 `ctx.navigate` 进入 iOS 路由。

独立样式引入原模块 CSS，并在 `.ios-feature-host.ios-analytics` 内映射现有颜色和字体。对比卡放在原生成绩摘要与雷达图之间，其余报告与分享结构沿用当前组件。

`ScoreOverviewProps` 和 `ShareResultProps` 接受 `rank: number | null`，并增加 `maxScore?: number`。空排名、零参与人数或无有效名次时显示“未参与排名”；省略满分仅兼容旧调用，真实路径传入 `report.maxCents / 100`。分项得分、百分比和板块数量根据实际数据展示。

专项验证直接编译现有 React 组件到临时目录，检查空排名、不同满分、短卷和动态板块；浏览器使用独立临时服务和 iframe 加载实际组件、样式及包装模块。公共 vendor 构建、4781 服务切换和正式流程组合验收由协调对话执行。
