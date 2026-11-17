# RollieRank 功能验证图谱

验证手机主入口 `/ios-v3/` 与基础入口 `/`。所有写操作使用CLI创建的临时服务、独立目录和测试身份；4781仅允许只读复验。运行 `npm run verify -- doctor` 检查依赖，`npm run verify -- all` 执行全部检查。截图和业务结果在 `test-results/verification/`，服务清理后仍保留。

每个功能文件包含子功能、全部用户入口、实际驾驶方法和前提。新增入口时必须同时更新图谱、CLI场景与CI；已列出的入口不能用另一个入口替代通过。

- [套卷目录与管理](catalog-admin.md)
- [录答、评分、复盘与本机记录](practice-history.md)
- [报考岗位与练习榜](positions-rank.md)
- [本卷交流与多媒体评论](discussion.md)
- [二刷对比与成长分析](analytics.md)
- [答案反馈、审核与重算](corrections.md)
- [成绩分享与导出](sharing.md)

- [群体分析与公开成绩](insights.md)
- [做题计时与完整录答](timing-practice.md)
