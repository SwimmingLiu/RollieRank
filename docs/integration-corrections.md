# 纠错模块接入

四项功能已在公共入口接入，组合流程、构建验收及运行边界见 [公共集成 PR 草稿](pr-feature-integration.md)。

## 导出与挂载

服务端从 server/corrections.mjs 导入 createCorrectionsService，传入契约中的 readCatalog、mutateCatalog、dataDirectory，得到 handle(context)。在公共 POST JSON 验证及同源检查之后路由到 handle；GET summary 也需路由到该处理器。错误的 statusCode 应保留为 HTTP 状态，持久化错误使用公共安全错误信息。

浏览器从 src/features/corrections.js 导入 createCorrectionsFeature(ctx)，工厂只调用一次。每次重绘调用 afterRender；路由完成调用并等待 onRoute；正式提交后可调用 afterSubmit。模块通过 data-correction-action 与 data-correction-form 委托事件，不注册公共 data-action。

styles.css 引入 src/features/corrections.css。父页面提供 corrections-report、corrections-user、corrections-admin 三个 data-feature 挂载点。请移除旧 feedback/save-feedback 下载文件行为，并将原反馈入口改为 data-correction-action="feedback"，或只保留新结果页区域的入口。

模块复用公共 openModal、closeModal、api、render、toast。审核成功会调用 syncAttempts() 与 refreshCatalog()；其中一项失败仍会执行另一项，并保留“刷新正式成绩”入口，不重发审核。维护者凭证仅在模块闭包内保存，退出审核和页面刷新都会清除。

## 请求接口

全部 POST 使用 JSON；不需要额外请求头。reviewToken 为维护者输入的部署凭证，仅用于 admin 和 review；父 api 不得打印请求体或在错误响应中回显凭证。

| 路径 | 方法 | 输入 | 返回 |
| --- | --- | --- | --- |
| /api/corrections/summary | GET | 无 | pendingCount、pendingQuestionCount、reviewEnabled |
| /api/corrections/submit | POST | guestId、attemptId、feedbackId、baseRevision、changes | feedback、replayed |
| /api/corrections/list | POST | guestId | 自己的 feedbacks、自己答卷的 notifications |
| /api/corrections/preview | POST | guestId、feedbackId、可选 attemptId | hypothetical、baseRevision、official、projected、deltaCents、changes |
| /api/corrections/admin | POST | reviewToken | summary 字段、feedbacks、reviews、versions |
| /api/corrections/review | POST | reviewToken、reviewId、feedbackId、questionNumbers、decision、reason、expectedRevision | feedback、review、replayed |

changes 每项为 `{question, suggestedAnswer, evidence}`，题号互不重复，最多 300 题；建议答案须为 A–D，依据为 1–4000 字。feedbackId、reviewId、guestId、attemptId 均使用 10–80 字的字母、数字、下划线或短横线编号，浏览器默认生成 UUID。

decision 为 approve 或 reject；questionNumbers 可选择同一反馈中的一题或多题；reason 为 1–2000 字。审核通过要求 expectedRevision 等于当前版本 answerRevision，且所选题目在反馈后未被订正；无关题号发生订正时，刷新 expectedRevision 后仍可审核。拒绝可处理过期反馈。相同 reviewId 和相同业务请求可安全重试；已处理题号或冲突编号返回 409。

feedback 包含 id、attemptId、versionId、paperTitle、versionLabel、baseRevision、currentRevision、createdAt、status、items。items 包含 question、originalAnswer、suggestedAnswer、evidence、status、stale，处理后增加 reviewId、reviewedAt、reason 以及批准后的 answerRevision。外部响应不包含反馈者 guestId。

notifications 每项对应一份自己的受影响答卷，包含 id、revisionId、reviewId、feedbackId、attemptId、versionId、paperTitle、versionLabel、fromRevision、toRevision、reason、createdAt、changes、before、after、deltaCents。changes 为 `{question,beforeAnswer,afterAnswer}`；before/after 包含 totalCents、maxCents、correct、wrong、blank。管理员响应中的 versions 为 `{id,answerRevision,receiptCount}`。

## 公共存储与成绩同步

readCatalog 返回的对象须含 versions、receipts、audit、features。mutateCatalog 必须把这四项一起快照、串行修改、原子持久化并在失败时一起恢复。模块不自行写目录文件。模块也会让自己的 POST 查询等待审核落盘，避免读到随后回滚的临时状态。

版本新增 answerRevision，未设置时为 0；批准时递增。原有 publicVersion 会保留该元数据。正式提交时请在 receipt 中保存 `answerRevision: version.answerRevision ?? 0`，以便反馈绑定真实使用的答案修订。该字段应在本地状态恢复时保留。

批准时模块只修改相关版本的 questions[].correctAnswer、answerRevision，以及相同 versionId 的 receipts 的 report、answerRevision、correctionHistory。答卷 answers、createdAt 和其他元数据保持原值。correctionHistory 项包含 revisionId、reviewId、createdAt、fromRevision、toRevision、questionNumbers、before、after、deltaCents。请在 prototype-state.js 的恢复验证与备份恢复中保留这些经过验证的订正元数据。

公共 POST /api/attempts/sync 返回 receipts 的最新快照，包括 answerRevision、correctionHistory；父入口应用时保留本地 ownerId、participate。请在初次加载、进入结果/个人记录/排行榜/分析时同步，以便其他考生也能获得已订正的报告。排行榜读取同一 receipts，不保存独立旧分。题量、题型、分值和 scoringRule 均不被纠错模块改变。

features.corrections 使用 feedbacks、reviews、revisions 三个数组。revisions 包含完整答案改动、所影响答卷的前后分数；其私有 receiptKey 只留在服务端，个人通知会剥离。公共 audit 增加中文审核操作及理由，不含凭证。

## 验证边界

服务行为测试位于 test/corrections-service.test.js。test/corrections-api.test.js 已通过真实 createApi 的 HTTP 路由验证提交、审核、未来提交、重启、成绩同步、本地快照恢复和实际落盘失败回滚。模块浏览器测试使用独立服务、临时目录及端口，不触碰日常数据，覆盖提交、试算、授权、分题通过与拒绝、双方通知及 320/390/1280/1440px 布局。

默认 npm test 执行服务和 HTTP 测试。浏览器测试需 Python Playwright 与 Chromium，通过下列命令显式启用；使用虚拟环境时，以 ROLLIERANK_BROWSER_PYTHON 指向该 Python。输出保存在 test-results/corrections。

```bash
ROLLIERANK_BROWSER_TEST=1 node --test test/corrections*.test.js
```

本次也运行了公共构建产物的完整旅程脚本，12 组检查通过，包含旧报告订正、双方通知、排行榜与分析同步、未来提交及备份恢复；报告见 test-results/corrections-integrated/results.json。本任务没有修改公共入口。四项功能整体交付与最终验收汇总仍由协调任务维护。

## 模块锁定与公共复核

纠错模块及三个测试文件的 SHA-256 保存在 docs/corrections-source-lock.json，浏览器结果生成时间晚于这些文件的最后修改时间。模块专项行为、真实 HTTP 和独立浏览器证据均已完成。

最后一次额外公共重跑使用了协调任务随后扩充的旅程脚本，在海报流程等待 `[data-action="poster-style"][data-value="depth"]` 时超时，尚未到达本轮纠错检查。这次失败与先前 12 组通过记录分别保留，日志见 .beauye/tasks/corrections/evidence/public-rerun-poster-timeout.log；该选择器及公共构建产物的新鲜度交由协调任务复核。

按协调任务最新明确要求，其他并行文件变化引起的全目录 Beauye 指纹过期也交由公共集成复核，模块不继续重跑全站或改动已验证源码。交付记录保留过期标记，不将其改写为全系统验收通过。
