# 四项功能的并行实现约定

用户已要求将四项功能拆到独立对话，并使用 goal 模式持续完成。当前对话负责公共入口、接口衔接和最终回归。

## 文件归属

| 任务 | 负责文件 | 功能边界 |
| --- | --- | --- |
| 选岗与排行 | `src/features/positions.js`、`src/features/positions.css`、`server/positions.mjs`、岗位数据与导入脚本、`test/positions*.test.js`、对应任务文档 | 岗位目录、Excel 导入、选岗提醒、全国和岗位榜 |
| 讨论区 | `src/features/discussions.js`、`src/features/discussions.css`、`server/discussions.mjs`、`test/discussions*.test.js`、对应任务文档 | 结果页评论、文字、语音、图片、链接、头像 |
| 成长分析 | `src/features/analytics.js`、`src/features/analytics.css`、`src/analytics.js`、`test/analytics*.test.js`、对应任务文档 | 二刷 VS、多刷曲线、同规则跨卷和题型趋势 |
| 纠错与重算 | `src/features/corrections.js`、`src/features/corrections.css`、`server/corrections.mjs`、`test/corrections*.test.js`、对应任务文档 | 真实反馈、提醒、审核权限、批量订正、历史重算 |
| 当前协调对话 | `src/app.js`、`server/api.mjs`、`src/prototype-state.js`、现有 `src/views-*.js`、`styles.css`、构建与服务入口、集成测试 | 接入四项功能，保持原有流程可用 |

共享工作区已有大量未提交修改。各对话不得撤销其他人的改动，不提交或暂存他人的文件，不改动上述公共文件。需要的公共改动写到各自的 `docs/integration-任务名.md`，由协调对话执行。

## 服务端接口

三个服务模块分别导出 `createPositionsService`、`createDiscussionsService`、`createCorrectionsService`。工厂接收 `{ readCatalog, mutateCatalog, dataDirectory }`，同步或异步均可，返回处理函数 `handle(context)`。

`readCatalog()` 返回当前 `{ versions, receipts, audit, features }`。`features` 是随 catalog.json 持久化的扩展对象，各模块分别使用 `features.positions`、`features.discussions`、`features.corrections`。

`await mutateCatalog(store => result)` 串行执行同步回调，并以临时文件加重命名持久化整个目录。失败回滚四项状态。回调可以修改版本、提交凭证和自身命名空间，不可异步等待。跨模块读取通过 `readCatalog()`，不得自行写 catalog.json。

处理函数接收 `{ request, response, pathname, method, input, query, send }`。`input` 是已校验为普通对象的 POST JSON；`query` 是 URLSearchParams；`send(status, body)` 写 JSON 响应。处理了请求返回 `true`，未匹配返回 `false`。父入口负责同源检查、请求大小和统一错误响应，错误可抛出并带 `statusCode`。

除讨论区媒体请求允许较大 JSON 外，默认上限为 1 MB。评论可用已校验、限量和限大小的数据 URI 保存媒体；不要自行引入云服务或密钥。

排行榜只可使用服务端持有的提交凭证计算分数；用户参与状态和岗位存在 positions 命名空间中。纠错改动 receipts 后，排行榜读取同一数据，避免缓存旧分。

## 浏览器接口

四个模块分别导出 `createPositionsFeature(ctx)`、`createDiscussionsFeature(ctx)`、`createAnalyticsFeature(ctx)`、`createCorrectionsFeature(ctx)`，返回包含可选钩子的对象。

`ctx` 提供实时 getter：`state()`、`catalog()`、`route()`、`attempt()`、`version()`、`dimension()`；以及 `api(path, data?)`、`persist()`、`toast(message)`、`openModal(title, body, actions?, className?)`、`closeModal()`、`navigate(path)`、`render()`、`refreshCatalog()`、`submitAttempt()`、`syncAttempts()`。

各模块在工厂中注册一次委托事件，使用独立属性（例如 `data-position-action`），不要复用公共 `data-action` 注册新行为。

| 钩子 | 调用位置 |
| --- | --- |
| `afterRender()` | 每次页面 DOM 更新后，同步挂载自身区域 |
| `onRoute()` | 路由完成后，可异步读取服务并调用 `ctx.render()` |
| `beforeSubmit()` | 正式提交前；返回 false 可提示选岗。继续按钮可调用 `ctx.submitAttempt()`；模块自行避免重复提示 |
| `afterSubmit(attempt)` | 成绩保存后，用于同步参与信息或清理缓存 |
| `rankView({catalog,state,version,dimension})` | 选岗模块可替代旧演示榜；异步状态由模块缓存 |
| `statsView({catalog,state,version,versionId})` | 分析模块可替代旧同卷趋势页；无 versionId 时为整体分析 |

父入口提供以下挂载点：个人记录页 `[data-feature="positions-profile"]`、`[data-feature="analytics-entry"]`、`[data-feature="corrections-user"]`；结果页 `[data-feature="analytics-comparison"]`、`[data-feature="discussions"]`、`[data-feature="corrections-report"]`；管理页 `[data-feature="positions-admin"]`、`[data-feature="corrections-admin"]`。

CSS 各自放在 features 目录中，由公共 styles.css 通过 @import 引入，所有类加任务前缀，适配 320px 手机及桌面。使用现有 ui.js 的转义和格式化方法。评论头像优先使用可复用头像组件，网络头像失败应有本地回退。

## 成绩同步与计分兼容

公共服务将提供 `POST /api/attempts/sync`，输入 `{guestId, attemptIds?}`，返回 `{attempts}`。只返回该 guestId 的提交凭证。客户端同步时保留本地 ownerId、participate，将服务端最新成绩替换到相同 id 的记录；不会删除浏览器独有记录。

分析模块从报告行的 `rawMaxCents ?? maxCents`、题型、题数、折算规则等计算稳定规则签名；相同评分规则才可合并。避免将“同为百分制”直接认作同一规则。

纠错服务可以在原版本修订正确答案，并记录答案修订号、审核审计和被影响的提交。题量、题型与分值不变。审核通过后调用 gradeVersion 为受影响 receipts 重算，保留原提交时间和答案。服务端持久化审核前后变化，处理重复审核和过期依据。

## 验证与完成条件

各对话加载仓库和用户级指令，创建自己的 goal，完成本地 Issue 草稿、方案、模块实现、行为测试和本地 PR 草稿。模块接入由协调对话完成后，以真实浏览器验证和完整回归作为整体完成依据。测试用独立临时数据目录与端口，不污染日常数据。没有实际完成时不得将 goal 标记完成。

岗位目录必须来自可核验的官方来源，保留招考年份、来源页面、下载地址和获取日期。当前日期为 2026 年 11 月 14 日；核实最新公告所属招考年度，不能把演示岗位称为真实岗位。
